"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionInputChannel = exports.SessionOutputChannel = exports.SessionHandle = exports.sessions = void 0;
exports.__setSessionOpenImplForTests = __setSessionOpenImplForTests;
exports.__setSessionStartImplForTests = __setSessionStartImplForTests;
exports.__setSessionCloseImplForTests = __setSessionCloseImplForTests;
const api_1 = require("@opentelemetry/api");
const v3_1 = require("@trigger.dev/core/v3");
const ioSerialization_1 = require("@trigger.dev/core/v3/utils/ioSerialization");
const externalDeploymentId_js_1 = require("./externalDeploymentId.js");
const tracer_js_1 = require("./tracer.js");
const sessionTracing_js_1 = require("./sessionTracing.js");
exports.sessions = {
    start: startSession,
    retrieve: retrieveSession,
    update: updateSession,
    close: closeSession,
    list: listSessions,
    open,
    defineChannel,
};
let sessionOpenImpl;
function __setSessionOpenImplForTests(impl) {
    sessionOpenImpl = impl;
}
let sessionStartImpl;
function __setSessionStartImplForTests(impl) {
    sessionStartImpl = impl;
}
let sessionCloseImpl;
function __setSessionCloseImplForTests(impl) {
    sessionCloseImpl = impl;
}
/**
 * Start a {@link Session} — a stateful execution of an agent, with
 * two-way streaming and durable compute, that can span multiple runs.
 * The server creates the row (idempotent on `externalId`)
 * and triggers the first run from `triggerConfig` in one round-trip.
 * Returns the new run's id and a session-scoped public access token
 * for browser-side use against `.in/append`, `.out` SSE, and
 * `end-and-continue`.
 *
 * If a session with the same `(env, externalId)` already exists,
 * returns the existing row plus the live (or freshly re-triggered) run.
 * Two browser tabs of the same chat converge to one session.
 */
function startSession(input, requestOptions) {
    // Resolved before the test hook so fixtures observe the body that would go on the wire.
    const body = (0, externalDeploymentId_js_1.withResolvedExternalDeploymentId)(input);
    if (sessionStartImpl) {
        const result = sessionStartImpl(body);
        return Promise.resolve(result);
    }
    const apiClient = v3_1.apiClientManager.clientOrThrow();
    const $requestOptions = (0, v3_1.mergeRequestOptions)({
        tracer: tracer_js_1.tracer,
        name: "sessions.start()",
        icon: "sessions",
        attributes: sessionAttributes(body.externalId ?? body.type, {
            type: body.type,
            ...(body.externalId ? { externalId: body.externalId } : {}),
        }),
    }, requestOptions);
    return apiClient.createSession(body, $requestOptions);
}
/**
 * Retrieve a Session by `friendlyId` (`session_*`) or user-supplied
 * `externalId`. The server disambiguates via the `session_` prefix.
 */
function retrieveSession(sessionIdOrExternalId, requestOptions) {
    const apiClient = v3_1.apiClientManager.clientOrThrow();
    const $requestOptions = (0, v3_1.mergeRequestOptions)({
        tracer: tracer_js_1.tracer,
        name: "sessions.retrieve()",
        icon: "sessions",
        attributes: sessionAttributes(sessionIdOrExternalId),
    }, requestOptions);
    return apiClient.retrieveSession(sessionIdOrExternalId, $requestOptions);
}
/** Update mutable fields on a Session (tags, metadata, externalId). */
function updateSession(sessionIdOrExternalId, body, requestOptions) {
    const apiClient = v3_1.apiClientManager.clientOrThrow();
    const $requestOptions = (0, v3_1.mergeRequestOptions)({
        tracer: tracer_js_1.tracer,
        name: "sessions.update()",
        icon: "sessions",
        attributes: sessionAttributes(sessionIdOrExternalId),
    }, requestOptions);
    return apiClient.updateSession(sessionIdOrExternalId, body, $requestOptions);
}
/** Mark a Session as closed (terminal, idempotent). */
function closeSession(sessionIdOrExternalId, body, requestOptions) {
    if (sessionCloseImpl) {
        return Promise.resolve(sessionCloseImpl(sessionIdOrExternalId, body));
    }
    const apiClient = v3_1.apiClientManager.clientOrThrow();
    const $requestOptions = (0, v3_1.mergeRequestOptions)({
        tracer: tracer_js_1.tracer,
        name: "sessions.close()",
        icon: "sessions",
        attributes: sessionAttributes(sessionIdOrExternalId, {
            ...(body?.reason ? { reason: body.reason } : {}),
        }),
    }, requestOptions);
    return apiClient.closeSession(sessionIdOrExternalId, body, $requestOptions);
}
/**
 * List Sessions in the current environment with filters + cursor pagination.
 * Returns a {@link CursorPagePromise} so callers can iterate pages with
 * `for await`.
 */
function listSessions(options, requestOptions) {
    const apiClient = v3_1.apiClientManager.clientOrThrow();
    const $requestOptions = (0, v3_1.mergeRequestOptions)({
        tracer: tracer_js_1.tracer,
        name: "sessions.list()",
        icon: "sessions",
        attributes: {
            ...(options?.type ? { type: toAttr(options.type) } : {}),
            ...(options?.tag ? { tag: toAttr(options.tag) } : {}),
            ...(options?.status ? { status: toAttr(options.status) } : {}),
            ...(options?.externalId ? { externalId: options.externalId } : {}),
        },
    }, requestOptions);
    return apiClient.listSessions(options, $requestOptions);
}
/**
 * Open a lightweight handle to a Session's realtime channels. Does not
 * perform a network call on its own — each channel method hits the
 * corresponding realtime endpoint.
 */
function open(sessionIdOrExternalId) {
    if (sessionOpenImpl)
        return sessionOpenImpl(sessionIdOrExternalId);
    return new SessionHandle(sessionIdOrExternalId);
}
class SessionHandle {
    id;
    /**
     * Producer-to-consumer channel: the task writes records; external
     * clients read them. Mirrors `streams.define` — `append` / `pipe` /
     * `writer` / `read`.
     */
    out;
    /**
     * Consumer-to-producer channel: external clients call `.send()`; the
     * task consumes via `.on` / `.once` / `.peek` / `.wait` /
     * `.waitWithIdleTimeout`. Mirrors `streams.input` but keyed on the
     * session so a conversation can survive across run boundaries.
     */
    in;
    constructor(id, overrides) {
        this.id = id;
        this.out = overrides?.out ?? new SessionOutputChannel(id);
        this.in = overrides?.in ?? new SessionInputChannel(id);
    }
    /**
     * Open a named side channel on this session: a durable, cross-run `.in`/`.out`
     * pair addressed by `name` rather than the reserved default pair. Writing a
     * side channel's `.in` does not wake or trigger a run; a run observes it via
     * `.in.on()` / `.in.once()`. Records outlive any single run and are bounded by
     * the org's stream retention, the same as the reserved chat streams.
     *
     * Pass a `sessions.defineChannel(...)` definition to type `.in`/`.out` records;
     * a bare name string works too, with records typed `unknown`.
     */
    channel(channel) {
        const name = typeof channel === "string" ? channel : channel.name;
        if (!SESSION_CHANNEL_NAME_REGEX.test(name)) {
            throw new Error(`Invalid session channel name "${name}": use 1-128 chars from [A-Za-z0-9._-].`);
        }
        return {
            name,
            out: new SessionOutputChannel(this.id, name),
            in: new SessionInputChannel(this.id, name),
        };
    }
}
exports.SessionHandle = SessionHandle;
const SESSION_CHANNEL_NAME_REGEX = /^[A-Za-z0-9._-]{1,128}$/;
/**
 * Declare a named Session channel with typed `.in` / `.out` records, inferred
 * on both the producer and the consumer. The channel analogue of a task
 * definition: pass the result to `session.channel(...)` / `chat.channel(...)`
 * and to `useSessionStreamChannel<typeof channel>` so the record types line up
 * on every side.
 */
function defineChannel(name) {
    if (!SESSION_CHANNEL_NAME_REGEX.test(name)) {
        throw new Error(`Invalid session channel name "${name}": use 1-128 chars from [A-Za-z0-9._-].`);
    }
    return { name };
}
/**
 * The `.out` side of a Session's bidirectional channel pair. Mirrors the
 * consume-side of {@link streams.define}: `pipe` / `writer` / `append`
 * for the task to produce records, `read` for external clients to
 * consume via SSE. S2 credentials for direct writes are fetched
 * internally by `pipe`/`writer` — there's no public `initialize()`.
 */
class SessionOutputChannel {
    sessionId;
    channel;
    // Cache of the in-flight / resolved `initializeSessionStream` PUT for
    // this channel. Every `pipe()` / `writer()` call needs the same S2
    // credentials, so we share a single promise instead of re-PUTing on
    // every chunk. Hot-loop writers (per-chunk `chat.response.write` /
    // direct `session.out.writer` calls) drop from N PUTs to 1 PUT for
    // the lifetime of the channel. The S2 access token has a 1-day TTL
    // server-side so reusing it across calls within a single run is safe.
    // Evicts on failure (so the next call retries) and on `reset()`.
    #initPromise;
    constructor(sessionId, channel) {
        this.sessionId = sessionId;
        this.channel = channel;
    }
    /**
     * Drop the cached `initializeSessionStream` response. Surfaces for
     * tests and lifecycle hooks that need the next write to re-mint S2
     * credentials. The cache also self-evicts on `initializeSession`
     * rejection, so callers don't need to invoke this on failures.
     *
     * @internal
     */
    reset() {
        this.#initPromise = undefined;
    }
    /**
     * Append a single record. Routes through {@link writer} internally so
     * subscribers receive the same parsed-object shape as multi-record
     * writes — the server-side append endpoint wraps the body in a string,
     * which would give SSE consumers a JSON-string instead of an object.
     * Mirrors how `streams.define.append` delegates to `streams.writer`.
     */
    async append(value, options) {
        const { waitUntilComplete } = this.writer({
            ...options,
            spanName: "sessions.append()",
            execute: ({ write }) => {
                write(value);
            },
        });
        await waitUntilComplete();
    }
    /**
     * Pipe an `AsyncIterable` / `ReadableStream` directly to S2. Fetches
     * session S2 credentials internally and streams through
     * {@link SessionStreamInstance}. Parallel to {@link streams.pipe} but
     * session-scoped — no `target` option because the session is the target.
     */
    pipe(value, options) {
        return this.#pipeInternal(value, options, "sessions.pipe()");
    }
    /**
     * Mirror of {@link streams.writer}: runs `execute({ write, merge })`
     * against an in-memory queue whose records are piped to S2. Returns
     * `{ stream, waitUntilComplete }` so callers can observe the local
     * stream and await completion. Span is collapsible via `options.spanName`
     * / `options.collapsed`.
     */
    writer(options) {
        let controller;
        const ongoingStreamPromises = [];
        const stream = new ReadableStream({
            start(controllerArg) {
                controller = controllerArg;
            },
        });
        const safeEnqueue = (data) => {
            try {
                controller.enqueue(data);
            }
            catch {
                // Suppress errors when the stream has been closed.
            }
        };
        try {
            const result = options.execute({
                write(part) {
                    safeEnqueue(part);
                },
                merge(streamArg) {
                    ongoingStreamPromises.push((async () => {
                        const reader = streamArg.getReader();
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done)
                                break;
                            safeEnqueue(value);
                        }
                    })().catch((error) => {
                        console.error(error);
                    }));
                },
            });
            if (result) {
                ongoingStreamPromises.push(result.catch((error) => {
                    console.error(error);
                }));
            }
        }
        catch (error) {
            console.error(error);
        }
        const waitForStreams = new Promise((resolve, reject) => {
            (async () => {
                while (ongoingStreamPromises.length > 0) {
                    await ongoingStreamPromises.shift();
                }
                resolve();
            })().catch(reject);
        });
        waitForStreams.finally(() => {
            try {
                controller.close();
            }
            catch {
                // Already closed.
            }
        });
        return this.#pipeInternal(stream, options, options.spanName ?? "sessions.writer()");
    }
    /**
     * Subscribe to SSE records on `.out`. Returns an async-iterable stream —
     * auto-retry, Last-Event-ID resume, and abort propagation come from the
     * shared {@link SSEStreamSubscription} plumbing used by run-scoped
     * realtime streams.
     */
    async read(options) {
        const apiClient = v3_1.apiClientManager.clientOrThrow();
        return apiClient.subscribeToSessionStream(this.sessionId, "out", {
            signal: options?.signal,
            channel: this.channel,
            timeoutInSeconds: options?.timeoutInSeconds,
            lastEventId: options?.lastEventId != null ? String(options.lastEventId) : undefined,
            onPart: options?.onPart,
            onControl: options?.onControl,
            onComplete: options?.onComplete,
            onError: options?.onError,
        });
    }
    #pipeInternal(value, options, spanName) {
        const apiClient = v3_1.apiClientManager.clientOrThrow();
        const collapsed = options?.collapsed;
        const span = tracer_js_1.tracer.startSpan(spanName, {
            attributes: {
                session: this.sessionId,
                io: "out",
                ...(this.channel ? { channel: this.channel } : {}),
                [v3_1.SemanticInternalAttributes.ENTITY_TYPE]: "session-stream",
                [v3_1.SemanticInternalAttributes.ENTITY_ID]: `${this.sessionId}:${this.channel ?? ""}:out`,
                [v3_1.SemanticInternalAttributes.STYLE_ICON]: "sessions",
                ...(collapsed ? { [v3_1.SemanticInternalAttributes.COLLAPSED]: true } : {}),
                ...(this.channel
                    ? (0, v3_1.accessoryAttributes)({
                        items: [
                            { text: this.channel, variant: "normal" },
                            { text: "out", variant: "normal" },
                        ],
                        style: "codepath",
                    })
                    : {}),
            },
        });
        const readableStreamSource = (0, v3_1.ensureReadableStream)(value);
        const abortController = new AbortController();
        // `AbortSignal.any` lands in Node 20.3; the SDK still supports Node
        // 18.20+. On older runtimes fall back to wiring `options.signal` into
        // `abortController` manually so caller-driven cancellation propagates.
        let combinedSignal = abortController.signal;
        // Set in the Node 18 fallback path so the caller's `signal.addEventListener`
        // registration can be cleared once the stream finishes. Without this, a
        // long-lived caller signal (e.g. one reused across many `writer()` calls)
        // accumulates listeners on every completed turn.
        let removeCallerAbortListener;
        if (options?.signal) {
            if (typeof AbortSignal.any === "function") {
                combinedSignal = AbortSignal.any([options.signal, abortController.signal]);
            }
            else {
                const callerSignal = options.signal;
                if (callerSignal.aborted) {
                    abortController.abort(callerSignal.reason);
                }
                else {
                    const onCallerAbort = () => abortController.abort(callerSignal.reason);
                    callerSignal.addEventListener("abort", onCallerAbort, { once: true });
                    removeCallerAbortListener = () => callerSignal.removeEventListener("abort", onCallerAbort);
                }
            }
        }
        // Resolve the init promise eagerly so we can capture which one this
        // writer uses for reactive invalidation below.
        const writerInitPromise = (() => {
            if (this.#initPromise) {
                return this.#initPromise;
            }
            const fresh = apiClient.initializeSessionStream(this.sessionId, "out", options?.requestOptions, this.channel);
            this.#initPromise = fresh;
            // Evict on failure so the next call retries instead of returning a
            // poisoned cache entry forever.
            fresh.catch((err) => {
                if (this.#initPromise === fresh) {
                    this.#initPromise = undefined;
                }
            });
            return fresh;
        })();
        try {
            const instance = new v3_1.SessionStreamInstance({
                apiClient,
                baseUrl: v3_1.apiClientManager.baseURL ?? "",
                sessionId: this.sessionId,
                io: "out",
                source: readableStreamSource,
                signal: combinedSignal,
                requestOptions: options?.requestOptions,
                initializeSession: () => writerInitPromise,
            });
            // Single internal chain that handles span lifecycle AND reactive
            // invalidation. On rejection we evict the cached init promise so
            // the next pipe()/writer() re-PUTs and recovers (e.g. when a
            // cached S2 access token expired mid-process). Compare by identity
            // so a concurrent caller's fresh promise isn't accidentally cleared.
            // Customer awaiters still observe the rejection via the returned
            // `waitUntilComplete()`; this chain just keeps the cleanup path
            // from surfacing as unhandled.
            instance.wait().then(() => {
                removeCallerAbortListener?.();
                span.end();
            }, () => {
                removeCallerAbortListener?.();
                if (this.#initPromise === writerInitPromise) {
                    this.#initPromise = undefined;
                }
                span.end();
            });
            return {
                stream: instance.stream,
                waitUntilComplete: async () => {
                    return instance.wait();
                },
            };
        }
        catch (error) {
            removeCallerAbortListener?.();
            if (error instanceof Error && error.name === "AbortError") {
                span.end();
                throw error;
            }
            if (error instanceof Error || typeof error === "string") {
                span.recordException(error);
            }
            else {
                span.recordException(String(error));
            }
            span.setStatus({ code: api_1.SpanStatusCode.ERROR });
            span.end();
            throw error;
        }
    }
    /**
     * Write a single Trigger control record to `.out`. The record carries a
     * `trigger-control` header valued with `subtype` plus any sibling
     * `extraHeaders`; the body is empty. Control records are filtered out of
     * the consumer-facing chunk stream by the SDK transport — readers route
     * them via the `onControl` callback instead.
     *
     * The returned `lastEventId` is the S2 seq_num of the written record,
     * useful for trim chains (e.g. trim back to the previous turn-complete).
     */
    async writeControl(subtype, extraHeaders) {
        const apiClient = v3_1.apiClientManager.clientOrThrow();
        return (0, v3_1.writeSessionControlRecord)(apiClient, this.sessionId, "out", subtype, extraHeaders, this.channel);
    }
    /**
     * Append an S2 `trim` command record to `.out`. Records with seq_num
     * less than `earliestSeqNum` are eventually removed from the stream.
     *
     * Idempotent and monotonic at S2's layer (`max(existing, min(provided,
     * current_tail))`) — backward trims are silently no-ops for deletion
     * but still consume a seq_num. Used by `chat.agent`'s turn loop to
     * keep `session.out` bounded to roughly one turn at steady state.
     */
    async trimTo(earliestSeqNum) {
        const apiClient = v3_1.apiClientManager.clientOrThrow();
        await (0, v3_1.trimSessionStream)(apiClient, this.sessionId, earliestSeqNum, this.channel);
    }
}
exports.SessionOutputChannel = SessionOutputChannel;
/**
 * The `.in` side of a Session's bidirectional channel pair. Mirrors
 * {@link streams.input} — consumer-side primitives for the task
 * (`on`/`once`/`peek`/`wait`/`waitWithIdleTimeout`) plus `send` for
 * external clients. Keyed on the session rather than the run so a
 * conversation can survive across run boundaries.
 */
class SessionInputChannel {
    sessionId;
    channel;
    constructor(sessionId, channel) {
        this.sessionId = sessionId;
        this.channel = channel;
    }
    #assertReservedChannelForWait(method) {
        if (this.channel) {
            throw new Error(`session.channel("${this.channel}").in.${method} is not supported: a named side channel does not wake a run. Use .in.on() / .in.once() to observe it instead.`);
        }
    }
    /**
     * Send a single record to the channel. Called by external clients
     * (browser, server action, another task) producing input for the run.
     * Matches {@link streams.input.send} but session-scoped — the session
     * is the address, no `runId` required.
     */
    async send(value, requestOptions) {
        const apiClient = v3_1.apiClientManager.clientOrThrow();
        const body = typeof value === "string" ? value : JSON.stringify(value);
        const spanName = this.channel
            ? `sessions.open(${this.sessionId}).channel(${this.channel}).in.send()`
            : `sessions.open(${this.sessionId}).in.send()`;
        const $requestOptions = (0, v3_1.mergeRequestOptions)({
            tracer: tracer_js_1.tracer,
            name: spanName,
            icon: "sessions",
            attributes: sessionAttributes(this.sessionId, {
                io: "in",
                ...(this.channel ? { channel: this.channel } : {}),
            }),
        }, requestOptions);
        await apiClient.appendToSessionStream(this.sessionId, "in", body, $requestOptions, this.channel);
    }
    /**
     * Register a handler that fires for every record landing on `.in`.
     * Buffered records are offered to the handler on attach, and handlers
     * are cleaned up automatically when the task run completes. Returns
     * `{ off }` to unsubscribe early.
     *
     * A handler that synchronously returns `true` CONSUMES the record: it
     * won't be buffered for a later `once()` and won't be re-delivered on a
     * future `on()` attach. Plain observers should return nothing.
     */
    on(handler) {
        return v3_1.sessionStreams.on(this.sessionId, "in", handler, this.channel);
    }
    /**
     * Wait for the next record on `.in` without suspending the run.
     * Returns `{ ok: true, output }` on arrival or `{ ok: false, error }`
     * when the timeout fires. Chain `.unwrap()` to get the data directly.
     */
    once(options) {
        const ctx = v3_1.taskContext.ctx;
        const runId = ctx?.run.id;
        const innerPromise = v3_1.sessionStreams.once(this.sessionId, "in", options, this.channel);
        return new v3_1.InputStreamOncePromise((resolve, reject) => {
            tracer_js_1.tracer
                .startActiveSpan(options?.spanName ?? `sessions.open(${this.sessionId}).in.once()`, async () => {
                const result = await innerPromise;
                resolve(result);
            }, {
                attributes: {
                    [v3_1.SemanticInternalAttributes.STYLE_ICON]: "sessions",
                    [v3_1.SemanticInternalAttributes.ENTITY_TYPE]: "session-stream",
                    ...(runId
                        ? {
                            [v3_1.SemanticInternalAttributes.ENTITY_ID]: `${runId}:${this.sessionId}:${this.channel ?? ""}:in`,
                        }
                        : {}),
                    session: this.sessionId,
                    io: "in",
                    ...(this.channel ? { channel: this.channel } : {}),
                    ...(0, v3_1.accessoryAttributes)({
                        items: this.channel
                            ? [
                                { text: this.channel, variant: "normal" },
                                { text: "in", variant: "normal" },
                            ]
                            : [{ text: `${this.sessionId}.in`, variant: "normal" }],
                        style: "codepath",
                    }),
                },
            })
                .catch(reject);
        });
    }
    /** Non-blocking peek at the head of the `.in` buffer. */
    peek() {
        return v3_1.sessionStreams.peek(this.sessionId, "in", this.channel);
    }
    /**
     * The highest S2 sequence number that is safe to persist as consumed.
     * This stays behind the earliest unconsumed record if a later record was
     * handled first. Distinct from "last received", which advances for records
     * that may still be pending.
     *
     * Used by `chat.agent` to persist the `.in` resume cursor on each
     * `turn-complete` control record, so the next worker boot can subscribe
     * past already-processed user messages.
     */
    lastDispatchedSeqNum() {
        return v3_1.sessionStreams.lastDispatchedSeqNum(this.sessionId, "in", this.channel);
    }
    /**
     * Suspend the current run until the next record arrives on `.in`.
     * Unlike {@link once}, `wait()` frees compute while blocked — the
     * run-engine waitpoint holds the run until the session append handler
     * fires it. Only callable from inside `task.run()`.
     */
    /**
     * Suspend until the channel wakes this run, and read nothing.
     *
     * The waitpoint is only a wake signal: the append route commits the record to
     * the channel before it drains any waitpoint, so once this resolves the
     * record is durably readable from the channel itself, carrying its real
     * sequence. Separating the wake from the read is what lets a consumer that
     * owns its own delivery (the chat input router) reuse this without the
     * channel also taking a record out from under it.
     *
     * @internal
     */
    async awaitWake(options) {
        this.#assertReservedChannelForWait("awaitWake()");
        const ctx = v3_1.taskContext.ctx;
        if (!ctx) {
            throw new Error("session.in.wait() can only be used from inside a task.run()");
        }
        const apiClient = v3_1.apiClientManager.clientOrThrow();
        const lastConsumedSeqNum = options?.lastSeqNum ?? v3_1.sessionStreams.lastDispatchedSeqNum(this.sessionId, "in");
        const response = await apiClient.createSessionStreamWaitpoint(ctx.run.id, {
            session: this.sessionId,
            io: "in",
            timeout: options?.timeout,
            idempotencyKey: options?.idempotencyKey,
            idempotencyKeyTTL: options?.idempotencyKeyTTL,
            tags: options?.tags,
            lastSeqNum: lastConsumedSeqNum,
        });
        const waitResponse = await apiClient.waitForWaitpointToken({
            runFriendlyId: ctx.run.id,
            waitpointFriendlyId: response.waitpointId,
        });
        if (!waitResponse.success) {
            throw new Error("Failed to block on session stream waitpoint");
        }
        v3_1.sessionStreams.disconnectStream(this.sessionId, "in");
        // Create the waitpoint span only once setup is complete, at the boundary
        // where runtime.waitUntil pauses usage. Its identity must be present at
        // span creation so the inspector also works while the run is waiting.
        const wake = await (0, sessionTracing_js_1.traceSessionWait)(this.sessionId, response.waitpointId, async () => {
            const waitResult = await v3_1.runtime.waitUntil(response.waitpointId);
            if (!waitResult.ok) {
                const parsed = waitResult.output !== undefined
                    ? await (0, ioSerialization_1.conditionallyImportAndParsePacket)({
                        data: waitResult.output,
                        dataType: waitResult.outputType ?? "application/json",
                    }, apiClient)
                    : undefined;
                const error = new v3_1.WaitpointTimeoutError(parsed?.message ?? "Timed out");
                return { ok: false, error };
            }
            return { ok: true, waitpointId: response.waitpointId };
        });
        if (!wake.ok)
            return wake;
        v3_1.sessionStreams.reconnectStream(this.sessionId, "in");
        return wake;
    }
    wait(options) {
        return new v3_1.ManualWaitpointPromise(async (resolve, reject) => {
            try {
                this.#assertReservedChannelForWait("wait()");
                const apiClient = v3_1.apiClientManager.clientOrThrow();
                const result = await tracer_js_1.tracer.startActiveSpan(options?.spanName ?? `sessions.open(${this.sessionId}).in.wait()`, async (span) => {
                    const wake = await this.awaitWake(options);
                    if (!wake.ok) {
                        span.recordException(wake.error);
                        span.setStatus({ code: api_1.SpanStatusCode.ERROR });
                        return { ok: false, error: wake.error };
                    }
                    const record = await v3_1.sessionStreams.onceRecord(this.sessionId, "in");
                    if (!record.ok) {
                        const error = new v3_1.WaitpointTimeoutError("Timed out");
                        span.recordException(error);
                        span.setStatus({ code: api_1.SpanStatusCode.ERROR });
                        return { ok: false, error };
                    }
                    v3_1.sessionStreams.setLastSeqNum(this.sessionId, "in", record.output.seqNum);
                    const data = await (0, ioSerialization_1.conditionallyImportAndParsePacket)({
                        data: typeof record.output.data === "string"
                            ? record.output.data
                            : JSON.stringify(record.output.data),
                        dataType: "application/json",
                    }, apiClient);
                    return { ok: true, output: data };
                }, {
                    attributes: {
                        [v3_1.SemanticInternalAttributes.STYLE_ICON]: "sessions",
                        session: this.sessionId,
                        io: "in",
                    },
                });
                resolve(result);
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Wait for a record with an idle-then-suspend strategy. Keeps the run
     * active (using compute) for `idleTimeoutInSeconds`, then suspends via
     * {@link wait} if nothing arrives. If a record arrives during the idle
     * phase the run responds without suspending.
     */
    async waitWithIdleTimeout(options) {
        this.#assertReservedChannelForWait("waitWithIdleTimeout()");
        // eslint-disable-next-line no-this-alias
        const self = this;
        const spanName = options.spanName ?? `sessions.open(${this.sessionId}).in.waitWithIdleTimeout()`;
        return tracer_js_1.tracer.startActiveSpan(spanName, async (span) => {
            if (options.idleTimeoutInSeconds > 0) {
                const warm = await (0, sessionTracing_js_1.traceSessionIdle)(self.sessionId, options.idleTimeoutInSeconds, () => v3_1.sessionStreams.once(self.sessionId, "in", {
                    timeoutMs: options.idleTimeoutInSeconds * 1000,
                }));
                if (warm.ok) {
                    span.setAttribute("wait.resolved", "idle");
                    return { ok: true, output: warm.output };
                }
            }
            if (options.skipSuspend) {
                // Match the cold-phase `self.wait()` result shape below so any
                // caller that does `throw result.error` gets a real error
                // instead of `undefined`.
                span.setAttribute("wait.resolved", "skipped");
                return {
                    ok: false,
                    error: new v3_1.WaitpointTimeoutError("Idle timeout elapsed and skipSuspend is set"),
                };
            }
            if (options.onSuspend) {
                await options.onSuspend();
            }
            span.setAttribute("wait.resolved", "suspended");
            const waitResult = await self.wait({
                timeout: options.timeout,
                spanName: "suspended",
            });
            if (waitResult.ok && options.onResume) {
                await options.onResume();
            }
            return waitResult;
        }, {
            attributes: {
                [v3_1.SemanticInternalAttributes.STYLE_ICON]: "sessions",
                session: self.sessionId,
                io: "in",
            },
        });
    }
}
exports.SessionInputChannel = SessionInputChannel;
// ─── helpers ────────────────────────────────────────────────────────
function sessionAttributes(id, extra) {
    return {
        session: id,
        ...(extra ?? {}),
        ...(0, v3_1.accessoryAttributes)({
            items: [{ text: id, variant: "normal" }],
            style: "codepath",
        }),
    };
}
function toAttr(value) {
    return Array.isArray(value) ? value.join(",") : value;
}
//# sourceMappingURL=sessions.js.map