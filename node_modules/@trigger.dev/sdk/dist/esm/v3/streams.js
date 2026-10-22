import { realtimeStreams, inputStreams, taskContext, mergeRequestOptions, accessoryAttributes, SemanticInternalAttributes, apiClientManager, ManualWaitpointPromise, WaitpointTimeoutError, runtime, logger, InputStreamOncePromise, } from "@trigger.dev/core/v3";
import { conditionallyImportAndParsePacket } from "@trigger.dev/core/v3/utils/ioSerialization";
import { tracer } from "./tracer.js";
import { locals } from "./locals.js";
import { SpanStatusCode } from "@opentelemetry/api";
const DEFAULT_STREAM_KEY = "default";
// `chat.agent` sets this once at the top of every run via
// `markChatAgentRunForStreamsWarning`. The flag lives on the run's
// AsyncLocalStorage frame, so it naturally resets between runs and stays
// invisible to subtasks (where `streams.*` is a normal API).
const inChatAgentRunKey = locals.create("streams.inChatAgentRun");
// Once-per-run dedup. `streams.*` callers inside a chat.agent run get the
// nudge on the first call and silence afterwards; a single tight loop
// won't spam the logs.
const chatAgentStreamsWarnedKey = locals.create("streams.chatAgentWarned");
/**
 * Marks the current run as a `chat.agent` run so subsequent `streams.pipe` /
 * `streams.append` / `streams.read` calls can warn the user that they're
 * writing to a run-scoped stream rather than the chat's `session.out`.
 *
 * Called from inside the `chat.agent` task wrapper at the top of every run.
 *
 * @internal
 */
export function markChatAgentRunForStreamsWarning() {
    locals.set(inChatAgentRunKey, true);
}
function warnIfChatAgentStreamsMisuse(method) {
    if (!locals.get(inChatAgentRunKey))
        return;
    if (locals.get(chatAgentStreamsWarnedKey))
        return;
    locals.set(chatAgentStreamsWarnedKey, true);
    logger.warn(`streams.${method}() was called inside a chat.agent run. This writes to a run-scoped realtime stream and is NOT visible on the chat session, so the chat UI will not see these chunks. For chat output use chat.response.write() or chat.stream.* instead. See https://trigger.dev/docs/ai-chat/patterns/large-payloads. (Logged once per run; subsequent streams.${method}() calls in this run are silent.)`);
}
function pipe(keyOrValue, valueOrOptions, options) {
    // Handle overload: pipe(value, options?) or pipe(key, value, options?)
    let key;
    let value;
    let opts;
    if (typeof keyOrValue === "string") {
        // pipe(key, value, options?)
        key = keyOrValue;
        value = valueOrOptions;
        opts = options;
    }
    else {
        // pipe(value, options?)
        key = DEFAULT_STREAM_KEY;
        value = keyOrValue;
        opts = valueOrOptions;
    }
    return pipeInternal(key, value, opts, opts?.spanName ?? "streams.pipe()");
}
/**
 * Internal pipe implementation that allows customizing the span name.
 * This is used by both the public `pipe` method and the `writer` method.
 */
function pipeInternal(key, value, opts, spanName) {
    warnIfChatAgentStreamsMisuse(spanName === "streams.writer()" ? "writer" : "pipe");
    const runId = getRunIdForOptions(opts);
    if (!runId) {
        throw new Error("Could not determine the target run ID for the realtime stream. Please specify a target run ID using the `target` option or use this function from inside a task.");
    }
    const span = tracer.startSpan(spanName, {
        attributes: {
            key,
            runId,
            [SemanticInternalAttributes.ENTITY_TYPE]: "realtime-stream",
            [SemanticInternalAttributes.ENTITY_ID]: `${runId}:${key}`,
            [SemanticInternalAttributes.STYLE_ICON]: "streams",
            ...(opts?.collapsed ? { [SemanticInternalAttributes.COLLAPSED]: true } : {}),
            ...accessoryAttributes({
                items: [
                    {
                        text: key,
                        variant: "normal",
                    },
                ],
                style: "codepath",
            }),
        },
    });
    const requestOptions = mergeRequestOptions({}, opts?.requestOptions);
    try {
        const instance = realtimeStreams.pipe(key, value, {
            signal: opts?.signal,
            target: runId,
            requestOptions,
        });
        instance.wait().finally(() => {
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
        // if the error is a signal abort error, we need to end the span but not record an exception
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
        span.setStatus({ code: SpanStatusCode.ERROR });
        span.end();
        throw error;
    }
}
async function read(runId, keyOrOptions, options) {
    // Handle overload: read(runId, options?) or read(runId, key, options?)
    let key;
    let opts;
    if (typeof keyOrOptions === "string") {
        // read(runId, key, options?)
        key = keyOrOptions;
        opts = options;
    }
    else {
        // read(runId, options?)
        key = DEFAULT_STREAM_KEY;
        opts = keyOrOptions;
    }
    // Rename to readStream for consistency with existing code
    return readStreamImpl(runId, key, opts);
}
async function readStreamImpl(runId, key, options) {
    warnIfChatAgentStreamsMisuse("read");
    const apiClient = apiClientManager.clientOrThrow();
    const span = tracer.startSpan("streams.read()", {
        attributes: {
            key,
            runId,
            [SemanticInternalAttributes.ENTITY_TYPE]: "realtime-stream",
            [SemanticInternalAttributes.ENTITY_ID]: `${runId}:${key}`,
            [SemanticInternalAttributes.ENTITY_METADATA]: JSON.stringify({
                startIndex: options?.startIndex,
            }),
            [SemanticInternalAttributes.STYLE_ICON]: "streams",
            ...accessoryAttributes({
                items: [
                    {
                        text: key,
                        variant: "normal",
                    },
                ],
                style: "codepath",
            }),
        },
    });
    return await apiClient.fetchStream(runId, key, {
        signal: options?.signal,
        timeoutInSeconds: options?.timeoutInSeconds ?? 60,
        lastEventId: options?.startIndex ? (options.startIndex - 1).toString() : undefined,
        from: options?.startIndex !== undefined ? undefined : options?.from,
        onComplete: () => {
            span.end();
        },
        onError: (error) => {
            span.recordException(error);
            span.setStatus({ code: SpanStatusCode.ERROR });
            span.end();
        },
    });
}
function append(keyOrValue, valueOrOptions, options) {
    if (typeof keyOrValue === "string" && typeof valueOrOptions === "string") {
        return appendInternal(keyOrValue, valueOrOptions, options);
    }
    if (typeof keyOrValue === "string") {
        if (isAppendStreamOptions(valueOrOptions)) {
            return appendInternal(DEFAULT_STREAM_KEY, keyOrValue, valueOrOptions);
        }
        else {
            if (!valueOrOptions) {
                return appendInternal(DEFAULT_STREAM_KEY, keyOrValue, options);
            }
            return appendInternal(keyOrValue, valueOrOptions, options);
        }
    }
    else {
        if (isAppendStreamOptions(valueOrOptions)) {
            return appendInternal(DEFAULT_STREAM_KEY, keyOrValue, valueOrOptions);
        }
        else {
            return appendInternal(DEFAULT_STREAM_KEY, keyOrValue, options);
        }
    }
}
async function appendInternal(key, part, options) {
    warnIfChatAgentStreamsMisuse("append");
    const runId = getRunIdForOptions(options);
    if (!runId) {
        throw new Error("Could not determine the target run ID for the realtime stream. Please specify a target run ID using the `target` option or use this function from inside a task.");
    }
    const span = tracer.startSpan("streams.append()", {
        attributes: {
            key,
            runId,
            [SemanticInternalAttributes.ENTITY_TYPE]: "realtime-stream",
            [SemanticInternalAttributes.ENTITY_ID]: `${runId}:${key}`,
            [SemanticInternalAttributes.STYLE_ICON]: "streams",
            ...accessoryAttributes({
                items: [
                    {
                        text: key,
                        variant: "normal",
                    },
                ],
                style: "codepath",
            }),
        },
    });
    try {
        await realtimeStreams.append(key, part, options);
        span.end();
    }
    catch (error) {
        // if the error is a signal abort error, we need to end the span but not record an exception
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
        span.setStatus({ code: SpanStatusCode.ERROR });
        span.end();
        throw error;
    }
}
function isAppendStreamOptions(val) {
    return (typeof val === "object" &&
        val !== null &&
        !Array.isArray(val) &&
        (("target" in val && typeof val.target === "string") ||
            ("requestOptions" in val && typeof val.requestOptions === "object")));
}
function writer(keyOrOptions, valueOrOptions) {
    if (typeof keyOrOptions === "string") {
        return writerInternal(keyOrOptions, valueOrOptions);
    }
    return writerInternal(DEFAULT_STREAM_KEY, keyOrOptions);
}
function writerInternal(key, options) {
    let controller;
    const ongoingStreamPromises = [];
    const stream = new ReadableStream({
        start(controllerArg) {
            controller = controllerArg;
        },
    });
    function safeEnqueue(data) {
        try {
            controller.enqueue(data);
        }
        catch (_error) {
            // suppress errors when the stream has been closed
        }
    }
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
        catch (_error) {
            // suppress errors when the stream has been closed
        }
    });
    return pipeInternal(key, stream, options, options.spanName ?? "streams.writer()");
}
function define(opts) {
    return {
        id: opts.id,
        pipe(value, options) {
            return pipe(opts.id, value, options);
        },
        read(runId, options) {
            return read(runId, opts.id, options);
        },
        async append(value, options) {
            // Use a single-write writer so objects are serialized the same way
            // as stream.writer() — the raw append API sends BodyInit which
            // doesn't serialize objects correctly for SSE consumers.
            const { waitUntilComplete } = writer(opts.id, {
                ...options,
                spanName: "streams.append()",
                execute: ({ write }) => {
                    write(value);
                },
            });
            await waitUntilComplete();
        },
        writer(options) {
            return writer(opts.id, options);
        },
    };
}
/**
 * Define an input stream that can receive typed data from external callers.
 *
 * Inside a task, use `.on()`, `.once()`, or `.peek()` to receive data.
 * Outside a task (e.g., from your backend), use `.send(runId, data)` to send data.
 *
 * @template TData - The type of data this input stream receives
 * @param opts - Options including a unique `id` for this input stream
 *
 * @example
 * ```ts
 * import { streams, task } from "@trigger.dev/sdk";
 *
 * const approval = streams.input<{ approved: boolean; reviewer: string }>({ id: "approval" });
 *
 * export const myTask = task({
 *   id: "my-task",
 *   run: async (payload) => {
 *     // Wait for the next approval
 *     const data = await approval.once().unwrap();
 *     console.log(data.approved, data.reviewer);
 *   },
 * });
 *
 * // From your backend:
 * // await approval.send(runId, { approved: true, reviewer: "alice" });
 * ```
 */
function input(opts) {
    return {
        id: opts.id,
        on(handler) {
            return inputStreams.on(opts.id, handler);
        },
        once(options) {
            const ctx = taskContext.ctx;
            const runId = ctx?.run.id;
            const innerPromise = inputStreams.once(opts.id, options);
            return new InputStreamOncePromise((resolve, reject) => {
                tracer
                    .startActiveSpan(options?.spanName ?? `inputStream.once()`, async () => {
                    const result = await innerPromise;
                    resolve(result);
                }, {
                    attributes: {
                        [SemanticInternalAttributes.STYLE_ICON]: "streams",
                        [SemanticInternalAttributes.ENTITY_TYPE]: "input-stream",
                        ...(runId ? { [SemanticInternalAttributes.ENTITY_ID]: `${runId}:${opts.id}` } : {}),
                        streamId: opts.id,
                        ...accessoryAttributes({
                            items: [{ text: opts.id, variant: "normal" }],
                            style: "codepath",
                        }),
                    },
                })
                    .catch(reject);
            });
        },
        peek() {
            return inputStreams.peek(opts.id);
        },
        wait(options) {
            return new ManualWaitpointPromise(async (resolve, reject) => {
                try {
                    const ctx = taskContext.ctx;
                    if (!ctx) {
                        throw new Error("inputStream.wait() can only be used from inside a task.run()");
                    }
                    const apiClient = apiClientManager.clientOrThrow();
                    // Create the waitpoint before the span so we have the entity ID upfront
                    const response = await apiClient.createInputStreamWaitpoint(ctx.run.id, {
                        streamId: opts.id,
                        timeout: options?.timeout,
                        idempotencyKey: options?.idempotencyKey,
                        idempotencyKeyTTL: options?.idempotencyKeyTTL,
                        tags: options?.tags,
                        lastSeqNum: inputStreams.lastSeqNum(opts.id),
                    });
                    const result = await tracer.startActiveSpan(options?.spanName ?? `inputStream.wait()`, async (span) => {
                        // 1. Block the run on the waitpoint
                        const waitResponse = await apiClient.waitForWaitpointToken({
                            runFriendlyId: ctx.run.id,
                            waitpointFriendlyId: response.waitpointId,
                        });
                        if (!waitResponse.success) {
                            throw new Error("Failed to block on input stream waitpoint");
                        }
                        // 2. Disconnect the SSE tail and clear the buffer before suspending.
                        // Without this, the tail stays alive during the suspension window and
                        // may buffer a copy of the same message that will be delivered via the
                        // waitpoint, causing a duplicate on resume.
                        inputStreams.disconnectStream(opts.id);
                        // 3. Suspend the task
                        const waitResult = await runtime.waitUntil(response.waitpointId);
                        // 4. Parse the output
                        const data = waitResult.output !== undefined
                            ? await conditionallyImportAndParsePacket({
                                data: waitResult.output,
                                dataType: waitResult.outputType ?? "application/json",
                            }, apiClient)
                            : undefined;
                        if (waitResult.ok) {
                            // Advance the seq counter so the SSE tail doesn't replay
                            // the record that was consumed via the waitpoint path when
                            // it lazily reconnects on the next on()/once() call.
                            const prevSeq = inputStreams.lastSeqNum(opts.id);
                            inputStreams.setLastSeqNum(opts.id, (prevSeq ?? -1) + 1);
                            return { ok: true, output: data };
                        }
                        else {
                            const error = new WaitpointTimeoutError(data?.message ?? "Timed out");
                            span.recordException(error);
                            span.setStatus({ code: SpanStatusCode.ERROR });
                            return { ok: false, error };
                        }
                    }, {
                        attributes: {
                            [SemanticInternalAttributes.STYLE_ICON]: "wait",
                            [SemanticInternalAttributes.ENTITY_TYPE]: "waitpoint",
                            [SemanticInternalAttributes.ENTITY_ID]: response.waitpointId,
                            streamId: opts.id,
                            ...accessoryAttributes({
                                items: [
                                    {
                                        text: opts.id,
                                        variant: "normal",
                                    },
                                ],
                                style: "codepath",
                            }),
                        },
                    });
                    resolve(result);
                }
                catch (error) {
                    reject(error);
                }
            });
        },
        async waitWithIdleTimeout(options) {
            // eslint-disable-next-line no-this-alias
            const self = this;
            const spanName = options.spanName ?? `inputStream.waitWithIdleTimeout()`;
            return tracer.startActiveSpan(spanName, async (span) => {
                // Idle phase: keep compute alive
                if (options.idleTimeoutInSeconds > 0) {
                    const warm = await inputStreams.once(opts.id, {
                        timeoutMs: options.idleTimeoutInSeconds * 1000,
                    });
                    if (warm.ok) {
                        span.setAttribute("wait.resolved", "idle");
                        return { ok: true, output: warm.output };
                    }
                }
                // Skip suspend if requested — return a real WaitpointTimeoutError
                // so the result shape matches the cold-phase `self.wait()` path
                // below. Callers that check `if (!result.ok)` work the same as
                // before; callers that do `throw result.error` get a useful error
                // instead of `undefined`.
                if (options.skipSuspend) {
                    span.setAttribute("wait.resolved", "skipped");
                    return {
                        ok: false,
                        error: new WaitpointTimeoutError("Idle timeout elapsed and skipSuspend is set"),
                    };
                }
                // Fire onSuspend callback before entering cold phase
                if (options.onSuspend) {
                    await options.onSuspend();
                }
                // Cold phase: suspend via .wait() — creates a child span
                span.setAttribute("wait.resolved", "suspended");
                const waitResult = await self.wait({
                    timeout: options.timeout,
                    spanName: "suspended",
                });
                // Fire onResume callback after successful resume
                if (waitResult.ok && options.onResume) {
                    await options.onResume();
                }
                return waitResult;
            }, {
                attributes: {
                    [SemanticInternalAttributes.STYLE_ICON]: "streams",
                    streamId: opts.id,
                    ...accessoryAttributes({
                        items: [{ text: opts.id, variant: "normal" }],
                        style: "codepath",
                    }),
                },
            });
        },
        async send(runId, data, options) {
            return tracer.startActiveSpan(`inputStream.send()`, async () => {
                const apiClient = apiClientManager.clientOrThrow();
                await apiClient.sendInputStream(runId, opts.id, data, options?.requestOptions);
            }, {
                attributes: {
                    [SemanticInternalAttributes.STYLE_ICON]: "streams",
                    [SemanticInternalAttributes.ENTITY_TYPE]: "input-stream",
                    [SemanticInternalAttributes.ENTITY_ID]: `${runId}:${opts.id}`,
                    streamId: opts.id,
                    runId,
                    ...accessoryAttributes({
                        items: [{ text: opts.id, variant: "normal" }],
                        style: "codepath",
                    }),
                },
            });
        },
    };
}
export const streams = {
    pipe,
    read,
    append,
    writer,
    define,
    input,
};
function getRunIdForOptions(options) {
    if (options?.target) {
        if (options.target === "parent") {
            return taskContext.ctx?.run?.parentTaskRunId ?? taskContext.ctx?.run?.id;
        }
        if (options.target === "root") {
            return taskContext.ctx?.run?.rootTaskRunId ?? taskContext.ctx?.run?.id;
        }
        if (options.target === "self") {
            return taskContext.ctx?.run?.id;
        }
        return options.target;
    }
    return taskContext.ctx?.run?.id;
}
//# sourceMappingURL=streams.js.map