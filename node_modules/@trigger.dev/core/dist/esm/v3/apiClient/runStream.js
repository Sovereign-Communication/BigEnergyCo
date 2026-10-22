import { EventSourceParserStream } from "eventsource-parser/stream";
import { createJsonErrorObject } from "../errors.js";
import { SubscribeRunRawShape } from "../schemas/api.js";
import { createAsyncIterableReadable } from "../streams/asyncIterableStream.js";
import { getEnvVar } from "../utils/getEnv.js";
import { conditionallyImportAndParsePacket, parsePacket } from "../utils/ioSerialization.js";
import { ApiError, isTriggerRealtimeAuthError } from "./errors.js";
import { zodShapeStream } from "./stream.js";
/**
 * Request header carrying the start position for a fresh realtime-stream
 * subscription. Value `"latest"` asks the server to start at the current tail
 * (only records appended after connect). Only sent when there is no
 * `Last-Event-ID`. Read by the realtime streams route on the server.
 */
export const STREAM_START_HEADER = "X-Trigger-Stream-Start";
export function runShapeStream(url, options) {
    const abortController = new AbortController();
    const streamFactory = new SSEStreamSubscriptionFactory(getEnvVar("TRIGGER_STREAM_URL", getEnvVar("TRIGGER_API_URL")) ?? "https://api.trigger.dev", {
        headers: options?.headers,
        resolveHeaders: options?.resolveHeaders,
        signal: abortController.signal,
    });
    // If the user supplied AbortSignal is aborted, we should abort the internal controller
    options?.signal?.addEventListener("abort", () => {
        if (!abortController.signal.aborted) {
            abortController.abort();
        }
    }, { once: true });
    const runStreamInstance = zodShapeStream(SubscribeRunRawShape, url, {
        ...options,
        signal: abortController.signal,
        onError: (e) => {
            options?.onFetchError?.(e);
        },
    });
    const $options = {
        runShapeStream: runStreamInstance.stream,
        stopRunShapeStream: () => runStreamInstance.stop(30 * 1000),
        streamFactory: streamFactory,
        abortController,
        ...options,
    };
    return new RunSubscription($options);
}
// Real implementation for production
export class SSEStreamSubscription {
    url;
    options;
    lastEventId;
    from;
    retryCount = 0;
    maxRetries;
    retryDelayMs;
    maxRetryDelayMs;
    retryJitter;
    fetchTimeoutMs;
    stallTimeoutMs;
    nonRetryableStatuses;
    retryNowController = null;
    internalAbort = null;
    cancelledByConsumer = false;
    completeNotified = false;
    /** Headers for the next attempt. Replaced by `resolveHeaders` after an auth failure. */
    currentHeaders;
    /** A refresh has already been tried on this connection; a second auth failure is terminal. */
    authRefreshed = false;
    /** Headers were just refreshed for the auth error now unwinding; retry once instead of failing. */
    retryAfterAuthRefresh = false;
    /**
     * True when the most recent response carried `X-Session-Settled: true` —
     * the server has no more records coming, so a clean end of the body is
     * terminal rather than the end of a long-poll window.
     */
    sessionSettled = false;
    constructor(url, options) {
        this.url = url;
        this.options = options;
        this.currentHeaders = options.headers;
        this.lastEventId = options.lastEventId;
        this.from = options.from ?? "beginning";
        this.maxRetries = options.maxRetries ?? Infinity;
        this.retryDelayMs = options.retryDelayMs ?? 100;
        this.maxRetryDelayMs = options.maxRetryDelayMs ?? 5000;
        this.retryJitter = options.retryJitter ?? 0.5;
        this.fetchTimeoutMs = options.fetchTimeoutMs ?? 30_000;
        this.stallTimeoutMs = options.stallTimeoutMs ?? 0;
        this.nonRetryableStatuses = new Set(options.nonRetryableStatuses ?? [400, 404, 409, 410, 422]);
    }
    /**
     * Wake an in-flight retry backoff and reconnect immediately.
     *
     * No-op if no retry is currently waiting (i.e. we're already
     * connected and reading). Use this for cheap "hint" wakeups like
     * the `online` event or a short-hidden visibility return —
     * `forceReconnect()` is the heavier hammer.
     */
    retryNow() {
        this.retryNowController?.abort();
    }
    /**
     * Drop the current connection (or wake a pending backoff) and
     * reconnect.
     *
     * Use when the existing TCP socket is suspected dead but the reader
     * hasn't noticed yet — common after a mobile tab background-kill or
     * a Safari bfcache restore. Aborts the in-flight fetch / read so
     * the catch path takes us through `retryConnection` and re-fetches
     * with `Last-Event-ID`.
     */
    forceReconnect() {
        this.internalAbort?.abort();
        this.retryNowController?.abort();
    }
    /** Fire `onComplete` at most once, even if both the drain and cancel paths reach it. */
    notifyComplete() {
        if (this.completeNotified)
            return;
        this.completeNotified = true;
        this.options.onComplete?.();
    }
    /**
     * The transport pumps decoded records into an internal stream; the returned
     * stream drains it on demand.
     */
    async subscribe() {
        // eslint-disable-next-line no-this-alias
        const self = this;
        const internal = new ReadableStream({
            async start(controller) {
                await self.connectStream(controller);
            },
            cancel() {
                self.cancelledByConsumer = true;
                self.internalAbort?.abort();
                self.retryNowController?.abort();
            },
        });
        const internalReader = internal.getReader();
        return new ReadableStream({
            async pull(controller) {
                let result;
                try {
                    result = await internalReader.read();
                }
                catch (err) {
                    controller.error(err);
                    return;
                }
                if (result.done) {
                    self.notifyComplete();
                    try {
                        controller.close();
                    }
                    catch { }
                    return;
                }
                controller.enqueue(result.value.part);
            },
            cancel(reason) {
                self.cancelledByConsumer = true;
                self.notifyComplete();
                internalReader.cancel(reason).catch(() => { });
            },
        }, { highWaterMark: 0 });
    }
    async connectStream(controller) {
        // Two abort sources flow through `internalAbort.signal`:
        //   - this.options.signal: caller cancel — bypass retry, exit cleanly.
        //   - this.internalAbort: per-attempt force-reconnect / fetch-timeout
        //     / stall-timeout — treated as a transient error, retry path runs.
        // Use `this.options.signal?.aborted` in the catch to distinguish.
        this.internalAbort = new AbortController();
        const unlinkUserAbort = linkAbort(this.options.signal, this.internalAbort);
        // Per-attempt fetch timeout. Cleared once response headers arrive;
        // chunk-read latency is governed by `stallTimeoutMs` instead.
        const fetchTimer = setTimeout(() => this.internalAbort?.abort(), this.fetchTimeoutMs);
        let stallTimer;
        const armStall = () => {
            if (this.stallTimeoutMs <= 0)
                return;
            clearTimeout(stallTimer);
            stallTimer = setTimeout(() => this.internalAbort?.abort(), this.stallTimeoutMs);
        };
        // Idempotent — both the catch (before recursion) and the finally
        // call this. Without the catch-side call, every retry leaks an
        // abort listener on `this.options.signal` because the finally
        // doesn't run until the entire recursion unwinds.
        const cleanupAttempt = () => {
            clearTimeout(fetchTimer);
            clearTimeout(stallTimer);
            unlinkUserAbort();
            this.internalAbort = null;
        };
        try {
            const headers = {
                Accept: "text/event-stream",
                ...this.currentHeaders,
            };
            if (this.lastEventId)
                headers["Last-Event-ID"] = this.lastEventId;
            else if (this.from === "latest")
                headers[STREAM_START_HEADER] = "latest";
            if (this.options.timeoutInSeconds) {
                headers["Timeout-Seconds"] = this.options.timeoutInSeconds.toString();
            }
            const fetchClient = this.options.fetchClient ?? fetch;
            const response = await fetchClient(this.url, {
                headers,
                signal: this.internalAbort.signal,
            });
            clearTimeout(fetchTimer);
            if (!response.ok) {
                const error = ApiError.generate(response.status, {}, "Could not subscribe to stream", Object.fromEntries(response.headers));
                if (this.nonRetryableStatuses.has(response.status)) {
                    this.options.onError?.(error);
                    controller.error(error);
                    return;
                }
                if (!(await this.refreshHeadersForAuthError(response.status))) {
                    this.options.onError?.(error);
                }
                throw error;
            }
            if (!response.body) {
                const error = new Error("No response body");
                this.options.onError?.(error);
                throw error;
            }
            const streamVersion = response.headers.get("X-Stream-Version") ?? "v1";
            this.sessionSettled = response.headers.get("X-Session-Settled") === "true";
            this.retryCount = 0; // reset on success
            armStall();
            // Dedup window for record ids. Bounded with FIFO eviction so a
            // long-lived `watch: true` subscription (one connection across many
            // turns) doesn't grow this set without bound. The window only needs
            // to cover the overlap a reconnect/replay can re-deliver, so a few
            // thousand ids is ample.
            const SEEN_IDS_CAP = 5000;
            const seenIds = new Set();
            const rememberSeen = (id) => {
                seenIds.add(id);
                if (seenIds.size > SEEN_IDS_CAP) {
                    const oldest = seenIds.values().next().value;
                    if (oldest !== undefined)
                        seenIds.delete(oldest);
                }
            };
            const stream = response.body
                .pipeThrough(new TextDecoderStream())
                .pipeThrough(new EventSourceParserStream())
                .pipeThrough(new TransformStream({
                transform: (chunk, chunkController) => {
                    if (streamVersion === "v1") {
                        if (chunk.id) {
                            this.lastEventId = chunk.id;
                        }
                        const timestamp = parseRedisStreamIdTimestamp(chunk.id);
                        chunkController.enqueue({
                            type: "part",
                            part: {
                                id: chunk.id ?? "unknown",
                                chunk: safeParseJSON(chunk.data),
                                timestamp,
                            },
                        });
                    }
                    else {
                        if (chunk.event === "batch") {
                            const data = safeParseJSON(chunk.data);
                            if (!data || !Array.isArray(data.records))
                                return;
                            for (const record of data.records) {
                                // Always advance the resume cursor — even for records we
                                // skip — so a future Last-Event-ID reconnect lands past
                                // them.
                                this.lastEventId = record.seq_num.toString();
                                // S2 command records (trim, fence) have a single header
                                // with an empty name. They are S2-interpreted directives
                                // that consume a seq_num but are not application data.
                                // Skip enqueue; consumers shouldn't see them.
                                if (record.headers?.[0]?.[0] === "") {
                                    continue;
                                }
                                // Data record (and Trigger control records — see
                                // `trigger-control` header in `client-protocol.mdx`).
                                // Control records have an empty body; data records have a
                                // JSON envelope. `safeParseJSON("")` returns undefined,
                                // which is what we want for control records — downstream
                                // consumers route by `headers` and ignore `chunk`.
                                const parsedBody = safeParseJSON(record.body);
                                if (parsedBody?.id) {
                                    if (seenIds.has(parsedBody.id))
                                        continue;
                                    rememberSeen(parsedBody.id);
                                }
                                chunkController.enqueue({
                                    type: "part",
                                    part: {
                                        recordId: parsedBody?.id,
                                        id: record.seq_num.toString(),
                                        chunk: parsedBody?.data,
                                        timestamp: record.timestamp,
                                        headers: record.headers ?? [],
                                    },
                                });
                            }
                        }
                    }
                },
            }));
            const reader = stream.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        reader.releaseLock();
                        this.notifyComplete();
                        controller.close();
                        return;
                    }
                    if (this.options.signal?.aborted) {
                        reader.cancel();
                        reader.releaseLock();
                        this.notifyComplete();
                        controller.close();
                        return;
                    }
                    armStall(); // any chunk (including server keepalives) resets the silence timer
                    this.authRefreshed = false;
                    controller.enqueue(value);
                }
            }
            catch (error) {
                reader.releaseLock();
                throw error;
            }
        }
        catch (error) {
            if (this.options.signal?.aborted || this.cancelledByConsumer) {
                // User cancel — exit cleanly, don't retry.
                this.notifyComplete();
                controller.close();
                return;
            }
            if (isTriggerRealtimeAuthError(error)) {
                if (this.retryAfterAuthRefresh) {
                    this.retryAfterAuthRefresh = false;
                }
                else {
                    // `onError` was already invoked in the `!response.ok` branch above
                    // (where the auth ApiError was originally constructed and thrown).
                    // Auth errors are non-retryable: terminate the stream cleanly.
                    controller.error(error);
                    return;
                }
            }
            cleanupAttempt();
            await this.retryConnection(controller, error);
        }
        finally {
            cleanupAttempt();
        }
    }
    /**
     * Re-resolve the headers after a 401/403 so the retry carries a fresh token.
     * At most once per live connection: if the refreshed token is rejected too,
     * the auth error stays terminal. A refresher that can't mint leaves the
     * rejected token in place so the auth error stays terminal too. Returns true
     * when a retry should follow.
     */
    async refreshHeadersForAuthError(status) {
        if (status !== 401 && status !== 403)
            return false;
        if (!this.options.resolveHeaders || this.authRefreshed)
            return false;
        this.authRefreshed = true;
        try {
            this.currentHeaders = await this.options.resolveHeaders();
        }
        catch {
            return false;
        }
        this.retryAfterAuthRefresh = true;
        return true;
    }
    async retryConnection(controller, error) {
        if (this.options.signal?.aborted || this.cancelledByConsumer) {
            this.notifyComplete();
            controller.close();
            return;
        }
        if (this.retryCount >= this.maxRetries) {
            const finalError = error || new Error("Max retries reached");
            controller.error(finalError);
            this.options.onError?.(finalError);
            return;
        }
        this.retryCount++;
        const baseDelay = Math.min(this.retryDelayMs * Math.pow(2, this.retryCount - 1), this.maxRetryDelayMs);
        // Jitter scales the delay into [(1 - retryJitter) * base, base].
        // E.g. retryJitter=0.5 → final delay is in [50%, 100%] of base.
        // Spreads simultaneous reconnect attempts so many clients don't
        // dogpile on the server right after a brief outage.
        const delay = baseDelay * (1 - this.retryJitter * Math.random());
        // Wait before retrying. The wait is wakeable: `retryNow()` aborts
        // `retryNowController` so the timer resolves immediately and the
        // next connect attempt starts now (e.g. on tab focus / `online`
        // event from the browser layer).
        this.retryNowController = new AbortController();
        await new Promise((resolve) => {
            const timer = setTimeout(() => {
                this.retryNowController?.signal.removeEventListener("abort", onAbort);
                resolve();
            }, delay);
            const onAbort = () => {
                clearTimeout(timer);
                resolve();
            };
            this.retryNowController.signal.addEventListener("abort", onAbort, { once: true });
        });
        this.retryNowController = null;
        if (this.options.signal?.aborted || this.cancelledByConsumer) {
            controller.close();
            return;
        }
        // Reconnect
        await this.connectStream(controller);
    }
}
/**
 * One-way abort link: when `parent` aborts, abort `child` too. Returns
 * a cleanup that removes the listener so `parent` doesn't accumulate
 * subscriptions across many connect attempts.
 */
function linkAbort(parent, child) {
    if (!parent)
        return () => { };
    if (parent.aborted) {
        child.abort();
        return () => { };
    }
    const onAbort = () => child.abort();
    parent.addEventListener("abort", onAbort, { once: true });
    return () => parent.removeEventListener("abort", onAbort);
}
export class SSEStreamSubscriptionFactory {
    baseUrl;
    options;
    constructor(baseUrl, options) {
        this.baseUrl = baseUrl;
        this.options = options;
    }
    createSubscription(runId, streamKey, options) {
        if (!runId || !streamKey) {
            throw new Error("runId and streamKey are required");
        }
        const url = `${options?.baseUrl ?? this.baseUrl}/realtime/v1/streams/${runId}/${streamKey}`;
        return new SSEStreamSubscription(url, {
            ...this.options,
            ...options,
        });
    }
}
export class RunSubscription {
    options;
    stream;
    packetCache = new Map();
    _closeOnComplete;
    _isRunComplete = false;
    constructor(options) {
        this.options = options;
        this._closeOnComplete =
            typeof options.closeOnComplete === "undefined" ? true : options.closeOnComplete;
        this.stream = createAsyncIterableReadable(this.options.runShapeStream, {
            transform: async (chunk, controller) => {
                const run = await this.transformRunShape(chunk);
                controller.enqueue(run);
                // only set the run to complete when finishedAt is set
                this._isRunComplete = !!run.finishedAt;
                if (this._closeOnComplete &&
                    this._isRunComplete &&
                    !this.options.abortController.signal.aborted) {
                    this.options.stopRunShapeStream();
                }
            },
        }, this.options.abortController.signal);
    }
    unsubscribe() {
        if (!this.options.abortController.signal.aborted) {
            this.options.abortController.abort();
        }
        this.options.stopRunShapeStream();
    }
    [Symbol.asyncIterator]() {
        return this.stream[Symbol.asyncIterator]();
    }
    getReader() {
        return this.stream.getReader();
    }
    withStreams() {
        // Keep track of which streams we've already subscribed to
        const activeStreams = new Set();
        return createAsyncIterableReadable(this.stream, {
            transform: async (run, controller) => {
                controller.enqueue({
                    type: "run",
                    run,
                });
                const streams = getStreamsFromRunShape(run);
                // Check for stream metadata
                if (streams.length > 0) {
                    for (const streamKey of streams) {
                        if (typeof streamKey !== "string") {
                            continue;
                        }
                        if (!activeStreams.has(streamKey)) {
                            activeStreams.add(streamKey);
                            const subscription = this.options.streamFactory.createSubscription(run.id, streamKey, {
                                baseUrl: this.options.client?.baseUrl,
                            });
                            // Start stream processing in the background
                            subscription.subscribe().then((stream) => {
                                stream
                                    .pipeThrough(new TransformStream({
                                    transform(chunk, controller) {
                                        controller.enqueue({
                                            type: streamKey,
                                            chunk: chunk.chunk,
                                            run,
                                        });
                                    },
                                }))
                                    .pipeTo(new WritableStream({
                                    write(chunk) {
                                        controller.enqueue(chunk);
                                    },
                                }));
                            });
                        }
                    }
                }
            },
        }, this.options.abortController.signal);
    }
    async transformRunShape(row) {
        const payloadPacket = row.payloadType
            ? { data: row.payload ?? undefined, dataType: row.payloadType }
            : undefined;
        const outputPacket = row.outputType
            ? { data: row.output ?? undefined, dataType: row.outputType }
            : undefined;
        const [payload, output] = await Promise.all([
            { packet: payloadPacket, key: "payload" },
            { packet: outputPacket, key: "output" },
        ].map(async ({ packet, key }) => {
            if (!packet) {
                return;
            }
            const cacheKey = `${row.friendlyId}/${key}`;
            const cachedResult = this.packetCache.get(cacheKey);
            if (cachedResult &&
                cachedResult.data === packet.data &&
                cachedResult.dataType === packet.dataType) {
                return cachedResult.value;
            }
            const field = key;
            const result = await conditionallyImportAndParsePacket(packet, this.options.client, {
                runId: row.friendlyId,
                field,
            });
            this.packetCache.set(cacheKey, {
                data: packet.data,
                dataType: packet.dataType,
                value: result,
            });
            return result;
        }));
        const metadata = row.metadata && row.metadataType
            ? await parsePacket({ data: row.metadata, dataType: row.metadataType })
            : undefined;
        const status = apiStatusFromRunStatus(row.status);
        return {
            id: row.friendlyId,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            taskIdentifier: row.taskIdentifier,
            status,
            payload,
            output,
            durationMs: row.usageDurationMs ?? 0,
            costInCents: row.costInCents ?? 0,
            baseCostInCents: row.baseCostInCents ?? 0,
            tags: row.runTags ?? [],
            idempotencyKey: row.idempotencyKey ?? undefined,
            expiredAt: row.expiredAt ?? undefined,
            finishedAt: row.completedAt ?? undefined,
            startedAt: row.startedAt ?? undefined,
            delayedUntil: row.delayUntil ?? undefined,
            queuedAt: row.queuedAt ?? undefined,
            error: row.error ? createJsonErrorObject(row.error) : undefined,
            isTest: row.isTest ?? false,
            metadata,
            realtimeStreams: row.realtimeStreams ?? [],
            ...booleanHelpersFromRunStatus(status),
        };
    }
}
const queuedStatuses = ["PENDING_VERSION", "QUEUED", "PENDING", "DELAYED"];
const waitingStatuses = ["WAITING"];
const executingStatuses = ["DEQUEUED", "EXECUTING"];
const failedStatuses = ["FAILED", "CRASHED", "SYSTEM_FAILURE", "EXPIRED", "TIMED_OUT"];
const successfulStatuses = ["COMPLETED"];
function booleanHelpersFromRunStatus(status) {
    return {
        isQueued: queuedStatuses.includes(status),
        isWaiting: waitingStatuses.includes(status),
        isExecuting: executingStatuses.includes(status),
        isCompleted: successfulStatuses.includes(status) || failedStatuses.includes(status),
        isFailed: failedStatuses.includes(status),
        isSuccess: successfulStatuses.includes(status),
        isCancelled: status === "CANCELED",
    };
}
function apiStatusFromRunStatus(status) {
    switch (status) {
        case "DELAYED": {
            return "DELAYED";
        }
        case "WAITING_FOR_DEPLOY":
        case "PENDING_VERSION": {
            return "PENDING_VERSION";
        }
        case "PENDING": {
            return "QUEUED";
        }
        case "PAUSED":
        case "WAITING_TO_RESUME": {
            return "WAITING";
        }
        case "DEQUEUED": {
            return "DEQUEUED";
        }
        case "RETRYING_AFTER_FAILURE":
        case "EXECUTING": {
            return "EXECUTING";
        }
        case "CANCELED": {
            return "CANCELED";
        }
        case "COMPLETED_SUCCESSFULLY": {
            return "COMPLETED";
        }
        case "SYSTEM_FAILURE": {
            return "SYSTEM_FAILURE";
        }
        case "CRASHED": {
            return "CRASHED";
        }
        case "INTERRUPTED":
        case "COMPLETED_WITH_ERRORS": {
            return "FAILED";
        }
        case "EXPIRED": {
            return "EXPIRED";
        }
        case "TIMED_OUT": {
            return "TIMED_OUT";
        }
        default: {
            return "QUEUED";
        }
    }
}
function safeParseJSON(data) {
    try {
        return JSON.parse(data);
    }
    catch (_error) {
        return data;
    }
}
const isSafari = () => {
    // Check if we're in a browser environment
    if (typeof window !== "undefined" &&
        typeof navigator !== "undefined" &&
        typeof navigator.userAgent === "string") {
        return (/^((?!chrome|android).)*safari/i.test(navigator.userAgent) ||
            /iPad|iPhone|iPod/.test(navigator.userAgent));
    }
    // If we're not in a browser environment, return false
    return false;
};
/**
 * A polyfill for `ReadableStream.protototype[Symbol.asyncIterator]`,
 * aligning as closely as possible to the specification.
 *
 * @see https://streams.spec.whatwg.org/#rs-asynciterator
 * @see https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream#async_iteration
 *
 * This is needed for Safari: https://bugs.webkit.org/show_bug.cgi?id=194379
 *
 * From https://gist.github.com/MattiasBuelens/496fc1d37adb50a733edd43853f2f60e
 *
 */
if (isSafari()) {
    // @ts-ignore-error
    ReadableStream.prototype.values ??= function ({ preventCancel = false } = {}) {
        const reader = this.getReader();
        return {
            async next() {
                try {
                    const result = await reader.read();
                    if (result.done) {
                        reader.releaseLock();
                    }
                    return {
                        done: result.done,
                        value: result.value,
                    };
                }
                catch (e) {
                    reader.releaseLock();
                    throw e;
                }
            },
            async return(value) {
                if (!preventCancel) {
                    const cancelPromise = reader.cancel(value);
                    reader.releaseLock();
                    await cancelPromise;
                }
                else {
                    reader.releaseLock();
                }
                return { done: true, value };
            },
            [Symbol.asyncIterator]() {
                return this;
            },
        };
    };
    // @ts-ignore-error
    ReadableStream.prototype[Symbol.asyncIterator] ??= ReadableStream.prototype.values;
}
function getStreamsFromRunShape(run) {
    const metadataStreams = run.metadata &&
        "$$streams" in run.metadata &&
        Array.isArray(run.metadata.$$streams) &&
        run.metadata.$$streams.length > 0 &&
        run.metadata.$$streams.every((stream) => typeof stream === "string")
        ? run.metadata.$$streams
        : undefined;
    if (metadataStreams) {
        return metadataStreams;
    }
    return run.realtimeStreams;
}
// Redis stream IDs are in the format: <timestamp>-<sequence>
function parseRedisStreamIdTimestamp(id) {
    if (!id) {
        return Date.now();
    }
    const timestamp = parseInt(id.split("-")[0], 10);
    if (isNaN(timestamp)) {
        return Date.now();
    }
    return timestamp;
}
//# sourceMappingURL=runStream.js.map