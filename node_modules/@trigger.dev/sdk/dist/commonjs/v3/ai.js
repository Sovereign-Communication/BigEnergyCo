"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chat = exports.__buildManagedStreamTextOptionsForTests = exports.upsertIncomingMessage = exports.PENDING_MESSAGE_INJECTED_TYPE = exports.ai = exports.snapshotTranscriptStorage = exports.reduceTranscriptChanges = exports.memoryTranscriptStorage = exports.defaultStorage = exports.__writeChatSnapshotProductionPathForTests = exports.__setWriteChatSnapshotImplForTests = exports.__setReadChatSnapshotImplForTests = exports.__readChatSnapshotProductionPathForTests = void 0;
exports.__setTranscriptStorageForTests = __setTranscriptStorageForTests;
exports.__mergeByIdReplaceWinsForTests = __mergeByIdReplaceWinsForTests;
exports.__setReplaySessionOutTailImplForTests = __setReplaySessionOutTailImplForTests;
exports.__replaySessionOutTailProductionPathForTests = __replaySessionOutTailProductionPathForTests;
exports.__setReplaySessionInTailImplForTests = __setReplaySessionInTailImplForTests;
exports.__replaySessionInTailProductionPathForTests = __replaySessionInTailProductionPathForTests;
exports.__resetChatInputRouterForTests = __resetChatInputRouterForTests;
exports.__chatInputCheckpointForTests = __chatInputCheckpointForTests;
exports.__findLatestSessionInCheckpointForTests = __findLatestSessionInCheckpointForTests;
exports.buildSkillTools = buildSkillTools;
const v3_1 = require("@trigger.dev/core/v3");
// Runtime VALUES go through the ESM/CJS shim so the CJS build can `require`
// ESM-only `ai@7` (see ../imports/ai-runtime.ts).
const api_1 = require("@opentelemetry/api");
const sessionTracing_js_1 = require("./sessionTracing.js");
const ai_runtime_js_1 = require("../imports/ai-runtime.js");
const transcriptStorage_js_1 = require("./transcriptStorage.js");
const compactionResponse_js_1 = require("./compactionResponse.js");
let transcriptStorageOverride;
/**
 * Test-only override for the storage `chat.agent` persists through, so a
 * test can capture the exact changesets the runtime produces.
 * @internal
 */
function __setTranscriptStorageForTests(storage) {
    transcriptStorageOverride = storage;
}
const ai_shared_js_1 = require("./ai-shared.js");
Object.defineProperty(exports, "PENDING_MESSAGE_INJECTED_TYPE", { enumerable: true, get: function () { return ai_shared_js_1.PENDING_MESSAGE_INJECTED_TYPE; } });
Object.defineProperty(exports, "upsertIncomingMessage", { enumerable: true, get: function () { return ai_shared_js_1.upsertIncomingMessage; } });
const auth_js_1 = require("./auth.js");
const locals_js_1 = require("./locals.js");
const metadata_js_1 = require("./metadata.js");
// Bash-skill runtime lives in `./agentSkillsRuntime.ts` (exposed as
// the `@trigger.dev/sdk/ai/skills-runtime` subpath). It's a normal
// static import — `ai.ts` is server-only by reachability now that
// browser-side primitives (PENDING_MESSAGE_INJECTED_TYPE and the
// chat-task wire types) live in `./ai-shared.ts`. Any browser bundle
// that wants those primitives imports `./ai-shared.js` directly and
// never touches `ai.ts`'s module graph, so the `node:*` builtins
// pulled in transitively here never reach a client chunk.
const agentSkillsRuntime_js_1 = require("./agentSkillsRuntime.js");
const aiAutoTelemetry_js_1 = require("./aiAutoTelemetry.js");
const externalDeploymentId_js_1 = require("./externalDeploymentId.js");
const chatVersionSkew_js_1 = require("./chatVersionSkew.js");
const sessions_js_1 = require("./sessions.js");
const shared_js_1 = require("./shared.js");
const streams_js_1 = require("./streams.js");
const tracer_js_1 = require("./tracer.js");
const METADATA_KEY = "tool.execute.options";
/**
 * Wrapper around `convertToModelMessages` that always passes
 * `ignoreIncompleteToolCalls: true` to prevent failures from
 * stopped/aborted conversations with partial tool parts.
 */
function toModelMessages(messages) {
    // Pass the resolved per-turn `tools` (if any) so the AI SDK can look up each
    // tool's `toModelOutput` and re-apply it to prior-turn tool results. Without
    // `tools` it falls back to JSON-stringifying the raw output (TRI-10149). The
    // conditional spread keeps the options object byte-identical to the no-tools
    // path when nothing was declared.
    const tools = locals_js_1.locals.get(chatResolvedToolsKey);
    return (0, ai_runtime_js_1.convertToModelMessages)(messages, {
        ignoreIncompleteToolCalls: true,
        ...(tools ? { tools } : {}),
    });
}
const chatTurnContextKey = locals_js_1.locals.create("chat.turnContext");
/**
 * Per-run slot holding the Session handle that backs this chat's `.in` /
 * `.out` channels. Populated at the top of `chatAgent`'s run function from
 * `payload.sessionId`; read by every module-level helper (`chatStream`,
 * `messagesInput`, `stopInput`) so the chat.agent internals can remain
 * the same module-level shape they were when the I/O was run-scoped.
 * @internal
 */
const chatSessionHandleKey = locals_js_1.locals.create("chat.sessionHandle");
// The external `chatId` from the boot payload — the value `ToolCallExecutionOptions.chatId`
// is documented to carry. Custom-agent loops never set per-turn context, so subtask tool
// metadata reads this directly rather than the Session handle id.
const chatExternalIdKey = locals_js_1.locals.create("chat.externalId");
/**
 * S2 seq_num of the most recent `turn-complete` control record written by
 * this worker. Read by `writeTurnCompleteChunk` to know what to trim back
 * to when the next turn finishes, keeping `session.out` bounded to ~one
 * turn at steady state.
 *
 * Seeded at boot from `ChatSnapshotV1.lastOutEventId` (which is exactly
 * the previous turn-complete's seq_num). Wrapped in a mutable holder so
 * `writeTurnCompleteChunk` can advance it without going through a setter.
 * @internal
 */
const lastTurnCompleteSeqNumKey = locals_js_1.locals.create("chat.lastTurnCompleteSeqNum");
/**
 * Scan `session.out` for the latest `turn-complete` control record and
 * return its `session-in-event-id` header value — the committed-consume
 * cursor on `.in` as of that turn-complete. Used at worker boot to seed
 * the `.in` subscription so already-processed user messages don't get
 * replayed from S2.
 *
 * Implementation is a non-blocking records read (`wait=0`) — the
 * endpoint returns everything currently stored (including pre-trim
 * records, since S2 trims are eventually consistent) in one shot, and
 * we keep the LAST matching header. The previous SSE-based scan had to
 * idle-wait a full 5s window to know it reached the tail, which put a
 * constant ~6s tax on every continuation boot.
 *
 * Returns `undefined` if no `turn-complete` carrying the header has been
 * written yet — first-turn-ever, first turn post-OOM-with-no-prior-runs,
 * a `turn-complete` written before this header existed, or a server old
 * enough that the records endpoint doesn't serialize headers. Callers
 * fall back to subscribing `.in` from seq 0 in that case; the slim-wire
 * merge handles any dedup against snapshot-restored messages.
 * @internal
 */
async function findLatestSessionInCursor(chatId) {
    const apiClient = v3_1.apiClientManager.clientOrThrow();
    const response = await apiClient.readSessionStreamRecords(chatId, "out");
    let latestCursor;
    for (const record of response.records) {
        if ((0, v3_1.controlSubtype)(record.headers) !== v3_1.TRIGGER_CONTROL_SUBTYPE.TURN_COMPLETE)
            continue;
        const raw = (0, v3_1.headerValue)(record.headers, v3_1.SESSION_IN_EVENT_ID_HEADER);
        if (!raw)
            continue;
        const parsed = Number.parseInt(raw, 10);
        if (Number.isFinite(parsed))
            latestCursor = parsed;
    }
    return latestCursor;
}
var chatSnapshotIo_js_1 = require("./chatSnapshotIo.js");
Object.defineProperty(exports, "__readChatSnapshotProductionPathForTests", { enumerable: true, get: function () { return chatSnapshotIo_js_1.__readChatSnapshotProductionPathForTests; } });
Object.defineProperty(exports, "__setReadChatSnapshotImplForTests", { enumerable: true, get: function () { return chatSnapshotIo_js_1.__setReadChatSnapshotImplForTests; } });
Object.defineProperty(exports, "__setWriteChatSnapshotImplForTests", { enumerable: true, get: function () { return chatSnapshotIo_js_1.__setWriteChatSnapshotImplForTests; } });
Object.defineProperty(exports, "__writeChatSnapshotProductionPathForTests", { enumerable: true, get: function () { return chatSnapshotIo_js_1.__writeChatSnapshotProductionPathForTests; } });
var transcriptStorage_js_2 = require("./transcriptStorage.js");
Object.defineProperty(exports, "defaultStorage", { enumerable: true, get: function () { return transcriptStorage_js_2.defaultStorage; } });
Object.defineProperty(exports, "memoryTranscriptStorage", { enumerable: true, get: function () { return transcriptStorage_js_2.memoryTranscriptStorage; } });
Object.defineProperty(exports, "reduceTranscriptChanges", { enumerable: true, get: function () { return transcriptStorage_js_2.reduceTranscriptChanges; } });
Object.defineProperty(exports, "snapshotTranscriptStorage", { enumerable: true, get: function () { return transcriptStorage_js_2.snapshotTranscriptStorage; } });
/**
 * Merge two `UIMessage[]` lists by `id`, with the second list winning on
 * collision. Used at run boot to combine the snapshot's persisted history
 * with the replayed `session.out` tail — replay produces the freshest
 * representation of any assistant message that landed after the snapshot's
 * cursor, so it should overwrite the older copy from the snapshot.
 *
 * Order: items unique to `a` keep their original positions; items unique to
 * `b` are appended at the end in their `b` order; collisions take `b`'s
 * value but keep the position they had in `a`.
 *
 * @internal
 */
function mergeByIdReplaceWins(a, b) {
    if (b.length === 0)
        return [...a];
    if (a.length === 0)
        return [...b];
    const indexById = new Map();
    for (let i = 0; i < a.length; i++) {
        const id = a[i].id;
        if (typeof id === "string" && id.length > 0)
            indexById.set(id, i);
    }
    const result = [...a];
    for (const next of b) {
        const id = next.id;
        if (typeof id === "string" && id.length > 0 && indexById.has(id)) {
            result[indexById.get(id)] = next;
        }
        else {
            const newIdx = result.length;
            result.push(next);
            if (typeof id === "string" && id.length > 0)
                indexById.set(id, newIdx);
        }
    }
    return result;
}
/**
 * Test-only entry point for `mergeByIdReplaceWins`. The merge helper is the
 * one piece of slim-wire boot logic that's purely functional, so it earns a
 * direct unit test that exercises empty inputs, id collisions, no-id append,
 * order preservation, and the replay-wins-on-collision invariant. Mirrors
 * the `__*ProductionPathForTests` pattern used for the snapshot/replay
 * helpers above.
 *
 * Not part of the public API.
 * @internal
 */
function __mergeByIdReplaceWinsForTests(a, b) {
    return mergeByIdReplaceWins(a, b);
}
let replaySessionOutTailImpl;
function __setReplaySessionOutTailImplForTests(impl) {
    replaySessionOutTailImpl = impl;
}
/**
 * Drain `session.out` from `lastEventId` (or the start) and reduce the
 * remaining `UIMessageChunk`s back into `UIMessage[]`. Used at run boot to
 * catch any chunks that landed AFTER the last persisted snapshot — typically
 * the chunks from the turn whose `onTurnComplete` ran but whose snapshot
 * write didn't make it to S3 before the run crashed / suspended.
 *
 * Implementation:
 *   1. `apiClient.readSessionStreamRecords` — non-SSE, `wait=0` drain.
 *      Returns immediately with whatever records exist after the cursor.
 *      The previous SSE-subscribe path paid a fixed ~1s long-poll tax on
 *      every fresh chat (timeout duration on empty streams) — unacceptable
 *      for the first-message TTFC budget.
 *   2. Filter out the agent's control chunks (`type: "trigger:*"`) — they
 *      ride on the same stream as the user-visible UIMessageChunks.
 *   3. Split chunks at `start`/`finish` boundaries so each segment is a
 *      single message, then feed each segment through the AI SDK's
 *      `readUIMessageStream` reducer (the same one `useChat` uses on the
 *      browser side) and grab the final emitted snapshot.
 *   4. The trailing message — if it never received a `finish` chunk —
 *      goes through `cleanupAbortedParts` so partial in-flight parts
 *      don't leak into the next turn's accumulator. Drop it entirely
 *      if cleanup empties it.
 *
 * Errors are propagated to the caller (the boot loop wraps in try/catch and
 * `logger.warn`s); we don't swallow here so test code can observe failures
 * directly.
 * @internal
 */
async function replaySessionOutTail(sessionId, options) {
    if (replaySessionOutTailImpl) {
        return await replaySessionOutTailImpl(sessionId, options);
    }
    const apiClient = v3_1.apiClientManager.clientOrThrow();
    const response = await apiClient.readSessionStreamRecords(sessionId, "out", {
        afterEventId: options?.lastEventId,
    });
    const collected = [];
    for (const record of response.records) {
        // `data` is the chunk object as written by the SDK's session-out
        // writer (an AI SDK `UIMessageChunk` or a Trigger control object).
        // The route forwards it as-is — no JSON envelope to unwrap here.
        // Defensive shape checks below tolerate malformed records by
        // skipping them instead of throwing.
        const chunk = record.data;
        if (!chunk || typeof chunk !== "object")
            continue;
        const type = chunk.type;
        if (typeof type !== "string")
            continue;
        // Drop agent control chunks (`trigger:turn-complete`, `trigger:upgrade-required`,
        // session-state telemetry, etc.). They ride the same stream but aren't part
        // of the UIMessageChunk discriminated union and would confuse the reducer.
        if (type.startsWith("trigger:"))
            continue;
        collected.push(chunk);
    }
    if (collected.length === 0)
        return { settled: [], partial: undefined, partialRaw: undefined };
    const segments = [];
    let current;
    for (const chunk of collected) {
        if (chunk.type === "start") {
            current = { chunks: [chunk], closed: false };
            segments.push(current);
            continue;
        }
        if (!current) {
            // Chunk arrived before any `start`. Synthesize a segment so the reducer
            // has something to work with — `readUIMessageStream` tolerates a missing
            // `start` because we pass `message: undefined`.
            current = { chunks: [], closed: false };
            segments.push(current);
        }
        current.chunks.push(chunk);
        if (chunk.type === "finish") {
            current.closed = true;
            current = undefined;
        }
    }
    const settled = [];
    let partial;
    let partialRaw;
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const isTrailing = i === segments.length - 1 && !seg.closed;
        const segmentStream = new ReadableStream({
            start(controller) {
                for (const c of seg.chunks)
                    controller.enqueue(c);
                controller.close();
            },
        });
        let last;
        try {
            for await (const snapshot of (0, ai_runtime_js_1.readUIMessageStream)({ stream: segmentStream })) {
                last = snapshot;
            }
        }
        catch (error) {
            // Reducer error — the segment is malformed. Skip it and keep going so a
            // single corrupt chunk doesn't sink the entire replay.
            v3_1.logger.warn("chat.agent: replay reducer failed for segment; skipping", {
                sessionId,
                segmentIndex: i,
                error: error instanceof Error ? error.message : String(error),
            });
            continue;
        }
        if (!last)
            continue;
        if (isTrailing) {
            const cleaned = cleanupAbortedParts(last);
            if (cleaned.parts.length === 0)
                continue;
            partial = cleaned;
            // Keep the raw pre-cleanup message too — recovery boot extracts
            // `pendingToolCalls` from it, since `cleanupAbortedParts` strips
            // exactly the input-streaming / input-available tool parts that
            // we want to surface.
            partialRaw = last;
        }
        else {
            settled.push(last);
        }
    }
    return { settled, partial, partialRaw };
}
/**
 * Test-only entry point that bypasses `__setReplaySessionOutTailImplForTests`
 * and reaches the real `apiClient.subscribeToSessionStream` + chunk-segment
 * splitter + `readUIMessageStream` reducer. Pairs with the snapshot
 * production-path wrappers above. Lets `replay-session-out.test.ts` drive
 * synthetic chunk sequences through the real reducer to lock down chunk-
 * stream → `UIMessage[]` correctness — if the AI SDK's chunk semantics
 * shift in a future version, the test catches it before customers do.
 *
 * Tests should mock `apiClient.subscribeToSessionStream` (e.g. via
 * `vi.spyOn(apiClient, ...)`) to feed a `ReadableStream<UIMessageChunk>`.
 *
 * Not part of the public API.
 * @internal
 */
async function __replaySessionOutTailProductionPathForTests(sessionId, options) {
    const saved = replaySessionOutTailImpl;
    replaySessionOutTailImpl = undefined;
    try {
        const { settled, partial } = await replaySessionOutTail(sessionId, options);
        return partial !== undefined ? [...settled, partial] : settled;
    }
    finally {
        replaySessionOutTailImpl = saved;
    }
}
let replaySessionInTailImpl;
function __setReplaySessionInTailImplForTests(impl) {
    replaySessionInTailImpl = impl;
}
/**
 * Drain `session.in` from `lastEventId` (or the start) and surface the user
 * messages that landed past the cursor. Mirror of `replaySessionOutTail` —
 * both reads run at continuation boot so the SDK can reconstruct
 * conversational order across a dead run that never wrote `onTurnComplete`.
 *
 * `session.in` carries the {@link ChatInputChunk} tagged union:
 *   - `kind: "message"` — a `ChatTaskWirePayload` envelope for a new user
 *     message (`trigger: "submit-message"`) or a regeneration. Only the
 *     submit-message records carry a `payload.message`; regenerations,
 *     preload / close / action / handover-prepare have no message.
 *   - `kind: "stop"` — mid-turn cancellation signal. Not a message.
 *   - `kind: "handover"` / `kind: "handover-skip"` — head-start signals.
 *     Not user messages.
 *
 * This function filters to the first variant and returns the embedded
 * `UIMessage`s in seq_num order, paired with their seq_num so the caller
 * can advance the session.in cursor past them.
 *
 * Errors are propagated to the caller (the boot loop wraps in try/catch
 * and `logger.warn`s); we don't swallow here so test code can observe
 * failures directly.
 * @internal
 */
async function replaySessionInTail(sessionId, options) {
    if (replaySessionInTailImpl) {
        return await replaySessionInTailImpl(sessionId, options);
    }
    const apiClient = v3_1.apiClientManager.clientOrThrow();
    const response = await apiClient.readSessionStreamRecords(sessionId, "in", {
        afterEventId: options?.lastEventId,
    });
    const out = [];
    for (const record of response.records) {
        // session.in writers POST `JSON.stringify(chunk)` directly; the
        // webapp wraps that in `{ data: <string>, id }` and stores it on
        // S2. The records endpoint hands `data` back as the original
        // string — unlike session.out (where the writer puts a chunk
        // OBJECT into the envelope and the route forwards it as an
        // object). Defensive: handle both shapes so future writer changes
        // on either side don't silently lose records.
        let chunk = record.data;
        if (typeof chunk === "string") {
            try {
                chunk = JSON.parse(chunk);
            }
            catch {
                continue;
            }
        }
        if (!chunk || typeof chunk !== "object")
            continue;
        const kind = chunk.kind;
        if (kind !== "message")
            continue;
        const payload = chunk.payload;
        if (!payload || payload.trigger !== "submit-message")
            continue;
        const message = payload.message;
        if (!message || typeof message !== "object")
            continue;
        out.push({
            message: message,
            metadata: payload.metadata,
            seqNum: record.seqNum,
        });
    }
    return out;
}
/**
 * Test-only entry point that bypasses
 * `__setReplaySessionInTailImplForTests` and reaches the real
 * `apiClient.readSessionStreamRecords` + filter pipeline. Mirrors
 * `__replaySessionOutTailProductionPathForTests`.
 * @internal
 */
async function __replaySessionInTailProductionPathForTests(sessionId, options) {
    const saved = replaySessionInTailImpl;
    replaySessionInTailImpl = undefined;
    try {
        return await replaySessionInTail(sessionId, options);
    }
    finally {
        replaySessionInTailImpl = saved;
    }
}
/**
 * Resolve the Session handle for the current chat.agent run.
 *
 * Two contexts populate this:
 *   1. Inside a `chat.agent` run — `locals.chatSessionHandleKey` is set
 *      at boot (lines 4665 / 4760).
 *   2. Inside an `ai.toolExecute` subtask — the tool wrapper threads the
 *      parent's `chatId` through tool metadata under `METADATA_KEY`. We
 *      lazily open the session from that chatId here so subtasks can use
 *      `chat.stream.writer({ target: "root" })` to write back to the
 *      parent's chat session without any wiring.
 *
 * Throws if neither is available.
 * @internal
 */
function getChatSession() {
    let handle = locals_js_1.locals.get(chatSessionHandleKey);
    if (handle)
        return handle;
    // Fallback: subtask context. The parent threaded chatId via tool metadata.
    const toolMeta = metadata_js_1.metadata.get(METADATA_KEY);
    if (toolMeta?.chatId) {
        handle = sessions_js_1.sessions.open(toolMeta.chatId);
        locals_js_1.locals.set(chatSessionHandleKey, handle);
        return handle;
    }
    throw new Error("chat.agent session handle is not initialized. This indicates a chat.agent helper was used outside of a chat.agent run, or the transport did not send a sessionId.");
}
/**
 * Stamp `gen_ai.conversation.id` on the active span at chat-run boot.
 * The run-level span is already alive when the run callback fires, so
 * `TaskContextSpanProcessor.onStart` (which stamps subsequent spans
 * automatically) won't catch it — set explicitly here.
 */
function stampConversationIdOnActiveSpan(conversationId, span = api_1.trace.getActiveSpan()) {
    if (!span || !conversationId)
        return;
    span.setAttribute(v3_1.SemanticInternalAttributes.GEN_AI_CONVERSATION_ID, conversationId);
}
function assertTaskUsableAsTool(task) {
    if (("schema" in task && !task.schema) || ("jsonSchema" in task && !task.jsonSchema)) {
        throw new Error("Cannot convert this task to to a tool because the task has no schema. Make sure to either use schemaTask or a task with an input jsonSchema.");
    }
}
/**
 * Shared implementation: run a task as a tool invocation (`triggerAndSubscribe` + tool metadata).
 * Used by {@link toolExecute} and the deprecated `ai.tool()` wrapper.
 */
function createTaskToolExecuteHandler(task) {
    assertTaskUsableAsTool(task);
    return async function taskToolExecuteHandler(input, toolOpts) {
        const toolMeta = {
            toolCallId: toolOpts?.toolCallId ?? "",
        };
        // v6 passes user context as `experimental_context`, v7 as `context`. Read
        // whichever is set and stamp both so subtasks reading either name work.
        const toolContext = toolOpts?.context ?? toolOpts?.experimental_context;
        if (toolContext !== undefined) {
            try {
                const serialized = JSON.parse(JSON.stringify(toolContext));
                toolMeta.experimental_context = serialized;
                toolMeta.context = serialized;
            }
            catch {
                /* non-serializable */
            }
        }
        const chatCtx = locals_js_1.locals.get(chatTurnContextKey);
        if (chatCtx) {
            toolMeta.chatId = chatCtx.chatId;
            toolMeta.turn = chatCtx.turn;
            toolMeta.continuation = chatCtx.continuation;
            toolMeta.clientData = chatCtx.clientData;
        }
        else {
            // Hand-rolled chat.customAgent loops never set per-turn context, but
            // the wrapper records the boot payload's external chatId at run boot
            // — thread it so subtask chat helpers (`chat.stream.writer` with
            // target "root") can open the parent's session.
            const chatExternalId = locals_js_1.locals.get(chatExternalIdKey);
            if (chatExternalId) {
                toolMeta.chatId = chatExternalId;
            }
        }
        const chatLocals = {};
        for (const entry of chatLocalRegistry) {
            const value = locals_js_1.locals.get(entry.key);
            if (value !== undefined) {
                chatLocals[entry.id] = value;
            }
        }
        if (Object.keys(chatLocals).length > 0) {
            toolMeta.chatLocals = chatLocals;
        }
        return await task
            .triggerAndSubscribe(input, {
            metadata: {
                [METADATA_KEY]: toolMeta,
            },
            tags: toolOpts?.toolCallId ? [`toolCallId:${toolOpts.toolCallId}`] : undefined,
            signal: toolOpts?.abortSignal,
        })
            .unwrap();
    };
}
function toolExecute(task) {
    return createTaskToolExecuteHandler(task);
}
/** @deprecated Use `tool()` from `ai` with `execute: ai.toolExecute(task)`. */
function toolFromTask(task, options) {
    const executeFromTaskInput = createTaskToolExecuteHandler(task);
    // Zod-backed tasks: use static `tool()` so runtime shape matches `ToolSet`. Generic task context
    // prevents `tool()` overloads from inferring input; `as any` is localized to this call only.
    if ("schema" in task && task.schema && (0, v3_1.isSchemaZodEsque)(task.schema)) {
        const staticTool = (0, ai_runtime_js_1.tool)({
            description: task.description ?? "",
            inputSchema: (0, ai_runtime_js_1.zodSchema)(task.schema),
            execute: async (input, toolOpts) => executeFromTaskInput(input, toolOpts),
            ...(options?.experimental_toToolResultContent !== undefined
                ? { experimental_toToolResultContent: options.experimental_toToolResultContent }
                : {}),
        });
        return staticTool;
    }
    const toolDefinition = (0, ai_runtime_js_1.dynamicTool)({
        description: task.description,
        inputSchema: convertTaskSchemaToToolParameters(task),
        ...(options?.experimental_toToolResultContent !== undefined
            ? { experimental_toToolResultContent: options.experimental_toToolResultContent }
            : {}),
        execute: async (input, toolOpts) => executeFromTaskInput(input, toolOpts),
    });
    return toolDefinition;
}
function getToolOptionsFromMetadata() {
    const tool = metadata_js_1.metadata.get(METADATA_KEY);
    if (!tool) {
        return undefined;
    }
    return tool;
}
/**
 * Get the current tool call ID from inside a subtask invoked via `ai.toolExecute()` (or legacy `ai.tool()`).
 * Returns `undefined` if not running as a tool subtask.
 */
function getToolCallId() {
    return getToolOptionsFromMetadata()?.toolCallId;
}
/**
 * Get the chat context from inside a subtask invoked via `ai.toolExecute()` (or legacy `ai.tool()`) within a `chat.agent`.
 * Pass `typeof yourChatTask` as the type parameter to get typed `clientData`.
 * Returns `undefined` if the parent is not a chat task.
 *
 * @example
 * ```ts
 * const ctx = ai.chatContext<typeof myChat>();
 * // ctx?.clientData is typed based on myChat's clientDataSchema
 * ```
 */
function getToolChatContext() {
    const opts = getToolOptionsFromMetadata();
    if (!opts?.chatId)
        return undefined;
    return {
        chatId: opts.chatId,
        turn: opts.turn ?? 0,
        continuation: opts.continuation ?? false,
        clientData: opts.clientData,
    };
}
/**
 * Get the chat context from inside a subtask, throwing if not in a chat context.
 * Pass `typeof yourChatTask` as the type parameter to get typed `clientData`.
 *
 * @example
 * ```ts
 * const ctx = ai.chatContextOrThrow<typeof myChat>();
 * // ctx.chatId, ctx.clientData are guaranteed non-null
 * ```
 */
function getToolChatContextOrThrow() {
    const ctx = getToolChatContext();
    if (!ctx) {
        throw new Error("ai.chatContextOrThrow() called outside of a chat.agent context. " +
            "This helper can only be used inside a subtask invoked via ai.toolExecute() (or legacy ai.tool()) from a chat.agent.");
    }
    return ctx;
}
function convertTaskSchemaToToolParameters(task) {
    if ("schema" in task) {
        // If TaskSchema is ArkTypeEsque, use ai.jsonSchema to convert it to a Schema
        if ("toJsonSchema" in task.schema && typeof task.schema.toJsonSchema === "function") {
            return (0, ai_runtime_js_1.jsonSchema)(task.schema.toJsonSchema());
        }
        // If TaskSchema is ZodEsque, use ai.zodSchema to convert it to a Schema
        if ((0, v3_1.isSchemaZodEsque)(task.schema)) {
            return (0, ai_runtime_js_1.zodSchema)(task.schema);
        }
    }
    if ("jsonSchema" in task) {
        return (0, ai_runtime_js_1.jsonSchema)(task.jsonSchema);
    }
    throw new Error("Cannot convert task to a tool. Make sure to use a task with a schema or jsonSchema.");
}
exports.ai = {
    /**
     * @deprecated Use `tool()` from the `ai` package with `execute: ai.toolExecute(task)` instead.
     */
    tool: toolFromTask,
    /**
     * Preferred: return value for the `execute` field of AI SDK `tool()`. Keeps Trigger subtask and
     * metadata behavior without coupling to a specific `ai` version’s `Tool` / `ToolSet` types.
     */
    toolExecute,
    currentToolOptions: getToolOptionsFromMetadata,
    /** Get the tool call ID from inside a subtask invoked via `ai.toolExecute()` (or legacy `ai.tool()`). */
    toolCallId: getToolCallId,
    /** Get chat context (chatId, turn, clientData, etc.) from inside a subtask of a `chat.agent`. Returns undefined if not in a chat context. */
    chatContext: getToolChatContext,
    /** Get chat context or throw if not in a chat context. Pass `typeof yourChatTask` for typed clientData. */
    chatContextOrThrow: getToolChatContextOrThrow,
};
/**
 * Creates a public access token for a chat task.
 *
 * This is a convenience helper that creates a multi-use trigger public token
 * scoped to the given task. Use it in a server action to provide the frontend
 * `TriggerChatTransport` with an `accessToken`.
 *
 * @example
 * ```ts
 * // actions.ts
 * "use server";
 * import { chat } from "@trigger.dev/sdk/ai";
 * import type { myChat } from "@/trigger/chat";
 *
 * export const getChatToken = () => chat.createAccessToken<typeof myChat>("my-chat");
 * ```
 */
function createChatAccessToken(taskId) {
    return auth_js_1.auth.createTriggerPublicToken(taskId, { expirationTime: "24h" });
}
function createChatOutGate() {
    let resolveOpened;
    const opened = new Promise((resolve) => {
        resolveOpened = resolve;
    });
    const gate = {
        pending: new Set(),
        open: false,
        opened,
        failOpen() {
            if (gate.open)
                return;
            gate.open = true;
            resolveOpened();
        },
    };
    return gate;
}
const chatOutGateKey = locals_js_1.locals.create("chat.outGate");
/**
 * How long a write waits on the gate before giving up. A storage that hangs
 * degrades to an ungated write rather than stalling the conversation.
 * @internal
 */
const CHAT_OUT_GATE_TIMEOUT_MS = 10_000;
/**
 * The ids to save non-final after a failed turn: the stream's partial answer,
 * but only while the message under its id is still that partial by content.
 * `onTurnComplete` may hand back a cloned history (same content, new objects),
 * which keeps it partial, or replace it in place, which finishes it.
 * @internal
 */
function partialStillUnfinished(partial, fingerprint, messages) {
    if (!partial || fingerprint === undefined)
        return undefined;
    const current = messages.find((message) => message.id === partial.id);
    if (!current || (0, transcriptStorage_js_1.fingerprintMessage)(current) !== fingerprint)
        return undefined;
    return new Set([partial.id]);
}
async function awaitChatOutGate() {
    const gate = locals_js_1.locals.get(chatOutGateKey);
    if (!gate || gate.open)
        return;
    const deadline = Date.now() + CHAT_OUT_GATE_TIMEOUT_MS;
    while (gate.pending.size > 0) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
            gate.failOpen();
            return;
        }
        const waitingOn = [...gate.pending];
        let timedOut = false;
        let timer;
        try {
            await Promise.race([
                Promise.allSettled(waitingOn),
                gate.opened,
                new Promise((resolve) => {
                    timer = setTimeout(() => {
                        timedOut = true;
                        resolve();
                    }, remaining);
                }),
            ]);
        }
        finally {
            if (timer)
                clearTimeout(timer);
        }
        if (gate.open)
            return;
        if (timedOut) {
            gate.failOpen();
            return;
        }
        for (const settled of waitingOn)
            gate.pending.delete(settled);
    }
}
/**
 * Register work that must land before anything from this turn reaches the
 * frontend.
 *
 * Like {@link chatDefer} the work starts immediately and is never awaited by
 * the hook that registered it, so it runs alongside the model and costs no
 * time to first token. Unlike `chat.defer`, the output stream waits for it:
 * no chunk of the answer is written to the session until it settles. That
 * makes it the right home for a write the next page load has to see (a
 * conversation row, a message insert), because a reader that can see the
 * answer can also see what the write persisted.
 *
 * Reach for `chat.defer` instead when the timing does not matter for a
 * reload: analytics, audit logs, search-index updates.
 *
 * This is not a consistency barrier for the turn. The work is still in flight
 * while the model runs, so a tool, a `prepareStep`, or anything else executing
 * during the turn can still read the state as it was before the write. It
 * orders the write against what the frontend can see, nothing more. When the
 * turn's own code has to read the write back, `await` it instead and accept
 * the cost.
 *
 * A write registered here that fails, or outlasts the internal timeout, lets
 * the stream through rather than stalling the conversation.
 *
 * @example
 * ```ts
 * onTurnStart: async ({ chatId, uiMessages }) => {
 *   chat.deferBeforeOutput(
 *     db.chat.update({ where: { id: chatId }, data: { messages: uiMessages } })
 *   );
 * },
 * ```
 */
function chatDeferBeforeOutput(promiseOrFn) {
    const gate = locals_js_1.locals.get(chatOutGateKey);
    const work = typeof promiseOrFn === "function" ? promiseOrFn() : promiseOrFn;
    if (!gate || gate.open)
        return;
    gate.pending.add(work);
}
function gateWriterOptions(options) {
    return {
        ...options,
        execute: async (api) => {
            await awaitChatOutGate();
            return await options.execute(api);
        },
    };
}
function gateOutStream(value) {
    return (async function* () {
        await awaitChatOutGate();
        if (isReadableStream(value)) {
            const reader = value.getReader();
            try {
                while (true) {
                    const { done, value: chunk } = await reader.read();
                    if (done)
                        break;
                    yield chunk;
                }
            }
            finally {
                reader.releaseLock();
            }
        }
        else {
            yield* value;
        }
    })();
}
const chatStream = {
    // Stable opaque label for the run-scoped `RealtimeDefinedStream` shape.
    // `chatStream` is backed by the Session's `.out` channel — this id is
    // not the real addressing key (the session is). Kept as a literal so
    // the facade type stays satisfied without re-introducing a top-level
    // constant; dashboards/telemetry that already read "chat" keep working.
    id: "chat",
    pipe(value, options) {
        const { target: _target, ...sessionOptions } = (options ?? {});
        return getChatSession().out.pipe(gateOutStream(value), sessionOptions);
    },
    async read(_runId, options) {
        // Session channels don't need a runId — the session is the address.
        // Keep the signature for backward compatibility with the run-scoped
        // RealtimeDefinedStream shape, but ignore the argument.
        return getChatSession().out.read(options);
    },
    async append(value, options) {
        const { target: _target, ...sessionOptions } = (options ?? {});
        await awaitChatOutGate();
        return getChatSession().out.append(value, sessionOptions);
    },
    writer(options) {
        return getChatSession().out.writer(gateWriterOptions(options));
    },
};
// ---------------------------------------------------------------------------
// chat.response — write data parts that persist to the response message
// ---------------------------------------------------------------------------
/**
 * Write data parts that both stream to the frontend AND persist in
 * `onTurnComplete`'s `responseMessage` and `uiMessages`.
 *
 * Non-transient data chunks (`type` starts with `data-`, no `transient: true`)
 * are queued for accumulation into the assistant response message.
 * Transient or non-data chunks are streamed only (same as `chat.stream`).
 *
 * @example
 * ```ts
 * // Persists to responseMessage.parts
 * chat.response.write({ type: "data-handover", data: { context: summary } });
 *
 * // Transient — streams only, not in responseMessage
 * chat.response.write({ type: "data-progress", data: { percent: 50 }, transient: true });
 * ```
 */
const chatResponse = {
    /**
     * Write a single chunk. Non-transient data parts are accumulated into the
     * response message; everything else is stream-only.
     */
    write(part) {
        queueResponsePart(part);
        const { waitUntilComplete } = chatStream.writer({
            spanName: "chat.response.write",
            collapsed: true,
            execute: ({ write }) => {
                write(part);
            },
        });
        waitUntilComplete().catch(() => { });
    },
};
/**
 * Creates a lazy ChatWriter that only opens a realtime stream on first use.
 * Call `flush()` after the callback returns to await stream completion.
 * @internal
 */
function createLazyChatWriter() {
    let writeImpl = null;
    let mergeImpl = null;
    let waitPromise = null;
    let resolveExecute = null;
    let started = false;
    const bufferedParts = [];
    const bufferedStreams = [];
    function ensureInitialized() {
        if (started)
            return;
        started = true;
        const executePromise = new Promise((resolve) => {
            resolveExecute = resolve;
        });
        const { waitUntilComplete } = chatStream.writer({
            collapsed: true,
            spanName: "callback writer",
            execute: ({ write, merge }) => {
                writeImpl = write;
                mergeImpl = merge;
                for (const part of bufferedParts.splice(0))
                    write(part);
                for (const stream of bufferedStreams.splice(0))
                    merge(stream);
                return executePromise;
            },
        });
        waitPromise = waitUntilComplete;
    }
    return {
        writer: {
            write(part) {
                ensureInitialized();
                queueResponsePart(part);
                if (writeImpl)
                    writeImpl(part);
                else
                    bufferedParts.push(part);
            },
            merge(stream) {
                ensureInitialized();
                if (mergeImpl)
                    mergeImpl(stream);
                else
                    bufferedStreams.push(stream);
            },
        },
        async flush() {
            if (resolveExecute) {
                resolveExecute(); // Signal execute to complete
                await waitPromise(); // Wait for stream to finish piping
            }
        },
    };
}
/**
 * Runs a callback with a lazy ChatWriter, flushing the stream after completion.
 * @internal
 */
async function withChatWriter(fn) {
    const { writer, flush } = createLazyChatWriter();
    const result = await fn(writer);
    await flush();
    return result;
}
const CHAT_CUSTOM_AGENT_CLIENT_DATA_ERROR_TEXT = "Invalid client data";
const chatCustomAgentClientDataParserKey = locals_js_1.locals.create("chat.customAgentClientDataParser");
const chatCustomAgentClientDataErrorHandlerKey = locals_js_1.locals.create("chat.customAgentClientDataErrorHandler");
function shouldValidateChatCustomAgentPayload(payload) {
    return (payload.trigger !== "close" && locals_js_1.locals.get(chatCustomAgentClientDataParserKey) !== undefined);
}
function assertChatCustomAgentSyncParseResult(result) {
    if (result && typeof result.then === "function") {
        void Promise.resolve(result).catch(() => { });
        throw new Error("chat.messages.peek() cannot validate clientData with an asynchronous schema. " +
            "Use chat.messages.once(), chat.messages.wait(), or chat.messages.waitWithIdleTimeout().");
    }
    return result;
}
function getChatCustomAgentSyncSchemaParseFn(schema) {
    const parser = schema;
    if (typeof parser === "function" && typeof parser.assert === "function") {
        return parser.assert.bind(parser);
    }
    if (typeof parser === "function") {
        return (value) => assertChatCustomAgentSyncParseResult(parser(value));
    }
    if (typeof parser.parse === "function") {
        return (value) => assertChatCustomAgentSyncParseResult(parser.parse(value));
    }
    if (typeof parser.validateSync === "function") {
        return parser.validateSync.bind(parser);
    }
    if (typeof parser.create === "function") {
        return parser.create.bind(parser);
    }
    if (typeof parser.assert === "function") {
        return (value) => {
            parser.assert(value);
            return value;
        };
    }
    return () => {
        throw new Error("chat.messages.peek() cannot validate clientData with this schema. " +
            "Use chat.messages.once(), chat.messages.wait(), or chat.messages.waitWithIdleTimeout().");
    };
}
async function writeChatCustomAgentClientDataErrorToStream(payload) {
    try {
        await withChatWriter((writer) => {
            writer.write({
                type: "error",
                errorText: CHAT_CUSTOM_AGENT_CLIENT_DATA_ERROR_TEXT,
            });
        });
        await chatWriteTurnComplete();
    }
    catch (signalError) {
        v3_1.logger.warn("chat.customAgent: failed to report clientData validation error", {
            chatId: payload.chatId,
            trigger: payload.trigger,
            error: signalError instanceof Error ? signalError.message : String(signalError),
        });
    }
}
async function reportChatCustomAgentClientDataError(payload, error, options) {
    const errorText = error instanceof Error && error.message ? error.message : "An unexpected error occurred";
    v3_1.logger.warn("chat.customAgent: clientData validation failed", {
        chatId: payload.chatId,
        trigger: payload.trigger,
        error: errorText,
    });
    const errorHandler = options.callHandler === false
        ? undefined
        : locals_js_1.locals.get(chatCustomAgentClientDataErrorHandlerKey);
    if (errorHandler) {
        try {
            await errorHandler({ error, payload });
        }
        catch (handlerError) {
            v3_1.logger.warn("chat.customAgent: clientData validation error handler failed", {
                chatId: payload.chatId,
                trigger: payload.trigger,
                error: handlerError instanceof Error ? handlerError.message : String(handlerError),
            });
        }
    }
    if (!options.writeToStream) {
        return;
    }
    await writeChatCustomAgentClientDataErrorToStream(payload);
}
async function parseChatCustomAgentPayload(payload) {
    const parser = locals_js_1.locals.get(chatCustomAgentClientDataParserKey);
    if (!parser || payload.trigger === "close") {
        return { ok: true, payload };
    }
    try {
        const metadata = await parser.parse(payload.metadata);
        return { ok: true, payload: { ...payload, metadata } };
    }
    catch (error) {
        return { ok: false, error };
    }
}
async function validateChatCustomAgentPayload(payload, options = {}) {
    const result = await parseChatCustomAgentPayload(payload);
    if (!result.ok) {
        await reportChatCustomAgentClientDataError(payload, result.error, {
            writeToStream: options.writeErrorToStream ?? true,
        });
    }
    return result;
}
function validateChatCustomAgentPayloadSync(payload) {
    const parser = locals_js_1.locals.get(chatCustomAgentClientDataParserKey);
    if (!parser || payload.trigger === "close") {
        return payload;
    }
    try {
        return { ...payload, metadata: parser.parseSync(payload.metadata) };
    }
    catch (error) {
        v3_1.logger.warn("chat.customAgent: clientData validation failed in chat.messages.peek()", {
            chatId: payload.chatId,
            trigger: payload.trigger,
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}
/**
 * Read one record from a route, suspending the run if nothing is there yet.
 *
 * The wake and the read are separate steps: the channel wakes the run, then the
 * router hands over whatever it routed. Nothing else can take the record in
 * between, which is what keeps the published cursors and the delivered record
 * in agreement.
 * @internal
 */
async function waitOnChatRoute(route, options) {
    const router = chatInputRouter();
    const session = getChatSession();
    return tracer_js_1.tracer.startActiveSpan(options.spanName ?? `chat.${route}.wait()`, async (span) => {
        const idleMs = (options.idleTimeoutInSeconds ?? 0) * 1000;
        if (idleMs > 0) {
            const warm = await (0, sessionTracing_js_1.traceSessionIdle)(session.id, idleMs / 1000, () => router.next(route, { timeoutMs: idleMs }));
            if (warm) {
                span.setAttribute("wait.resolved", "idle");
                return { ok: true, output: warm.data, record: warm };
            }
        }
        else {
            const buffered = await router.next(route, { timeoutMs: 0 });
            if (buffered) {
                span.setAttribute("wait.resolved", "buffered");
                return { ok: true, output: buffered.data, record: buffered };
            }
        }
        if (options.skipSuspend) {
            span.setAttribute("wait.resolved", "skipped");
            return {
                ok: false,
                error: new Error("Idle timeout elapsed and skipSuspend is set"),
            };
        }
        if (options.onSuspend)
            await options.onSuspend();
        span.setAttribute("wait.resolved", "suspended");
        while (true) {
            /**
             * The floor doubles as the wake cursor: the server completes the
             * waitpoint immediately if anything sits after this sequence, so a
             * floor that has advanced past an unread record parks a waitpoint
             * nothing will complete. Recorded on the span so a run that never woke
             * can be diagnosed from its trace alone.
             */
            const wakeFrom = router.resumeFloor();
            span.setAttribute("wait.lastSeqNum", wakeFrom ?? -1);
            const wake = await session.in.awaitWake({
                timeout: options.timeout,
                lastSeqNum: wakeFrom,
            });
            if (!wake.ok) {
                span.recordException(wake.error);
                return { ok: false, error: wake.error };
            }
            const record = await router.next(route);
            if (!record)
                continue;
            if (options.onResume)
                await options.onResume();
            return { ok: true, output: record.data, record };
        }
    }, {
        attributes: {
            [v3_1.SemanticInternalAttributes.STYLE_ICON]: "sessions",
            session: session.id,
            io: "in",
            route,
        },
    });
}
/**
 * Raw `.in` message delivery, with no client-data validation.
 *
 * Sits directly on the router's `messages` route, so a record handed to the
 * handler is consumed and the resume floor is free to advance past it.
 */
function subscribeToRawChatMessages(handler) {
    return chatInputRouter().on(CHAT_ROUTE_MESSAGES, (record) => {
        const chunk = record.data;
        void Promise.resolve(handler(chunk.payload)).catch(() => { });
    });
}
/**
 * Message delivery with client-data validation in front of it.
 *
 * Parses are chained so payloads are validated in wire order, which is the
 * point of the feature: a later message must not be validated against state a
 * earlier one has not established yet.
 *
 * The handler is dispatched but **not** awaited by that chain. Awaiting it
 * would serialise user code, so one slow or never-resolving handler would stall
 * delivery of every later message, and only when a schema is declared. Raw
 * delivery has always been fire-and-forget, so awaiting here would also make
 * handler concurrency differ between the validated and unvalidated paths for no
 * stated reason.
 *
 * `off()` detaches from the router but does not cancel work already chained:
 * the parse chain is a live promise chain and runs to completion on its own, so
 * a frame that arrives just before a turn closes is still parsed and a failure
 * is still reported (through the `!active` branch). Nothing therefore has to
 * wait on it, which is why no `drain()` hook is exposed. The one uncovered edge
 * is a parse still in flight when the task itself returns, where teardown can
 * cut the report short; give this a bounded wait at the run-end boundary rather
 * than an unbounded one, since the chain awaits a user-supplied schema.
 */
function subscribeToValidatedChatMessages(handler, options = {}) {
    let active = true;
    let delivery = Promise.resolve();
    const subscription = subscribeToRawChatMessages((payload) => {
        delivery = delivery
            .then(async () => {
            const result = await parseChatCustomAgentPayload(payload);
            if (!result.ok) {
                if (active) {
                    // Completing the turn here could close an active response.
                    await reportChatCustomAgentClientDataError(payload, result.error, {
                        writeToStream: false,
                    });
                }
                else if (options.onInvalidAfterOff) {
                    await options.onInvalidAfterOff(payload, result.error);
                }
                else {
                    // The subscription was removed while parsing. Keep the failure
                    // observable without invoking a user callback after off().
                    await reportChatCustomAgentClientDataError(payload, result.error, {
                        writeToStream: false,
                        callHandler: false,
                    });
                }
                return;
            }
            if (active) {
                void Promise.resolve(handler(result.payload, () => active)).catch(() => { });
            }
            else {
                void Promise.resolve(options.onAfterOff?.(result.payload)).catch(() => { });
            }
        })
            .catch(() => { });
    });
    return {
        off() {
            active = false;
            subscription.off();
        },
    };
}
/**
 * Validated delivery that does **not** consume.
 *
 * The steering path must observe rather than take: a record it does not inject
 * has to stay queued so a later turn answers it. Validation still runs in wire
 * order in front of the handler, so `clientData` is parsed before steering code
 * sees it, and a frame whose parse finishes after the turn closed needs no
 * buffer of its own, because the record was never removed from the channel.
 */
function observeValidatedChatMessages(
/**
 * Receives the observed record's own `seqNum`. It is passed per record rather
 * than tracked outside, because the handler runs after an await: with two
 * frames in flight a shared slot already holds the newer sequence by the time
 * the older frame's parse resolves, and the steering queue would then take
 * the wrong record off the channel.
 */
handler) {
    let active = true;
    let delivery = Promise.resolve();
    const claims = locals_js_1.locals.get(chatObserverClaimedSeqNumsKey) ??
        new Map();
    locals_js_1.locals.set(chatObserverClaimedSeqNumsKey, claims);
    const subscription = chatInputRouter().observe(CHAT_ROUTE_MESSAGES, (record) => {
        const payload = record.data.payload;
        const seqNum = record.seqNum;
        /**
         * Claimed synchronously, before any await, so a read cannot validate the
         * same record. The promise lets a read wait for the outcome rather than
         * spin on a record it is not allowed to take.
         */
        let release;
        const released = new Promise((resolve) => {
            release = resolve;
        });
        claims.set(record.seqNum, { released, release });
        const releaseClaim = () => {
            claims.delete(record.seqNum);
            release();
        };
        delivery = delivery
            .then(async () => {
            const result = await parseChatCustomAgentPayload(payload);
            if (!result.ok) {
                /**
                 * Reported once, then taken off the channel.
                 *
                 * Observing does not consume, so without this the record would be
                 * read again by the next turn and parsed a second time, firing a
                 * user-supplied schema and reporting the same failure twice. A frame
                 * that fails validation is never going to be answered by this run or
                 * a later one, so removing it loses nothing that was still owed.
                 */
                const timing = locals_js_1.locals.get(chatCustomAgentClientDataErrorTimingKey) ?? "turn-end";
                const writeNow = timing === "arrival" || !active;
                await reportChatCustomAgentClientDataError(payload, result.error, {
                    writeToStream: writeNow,
                });
                if (!writeNow) {
                    const deferred = locals_js_1.locals.get(chatCustomAgentDeferredClientDataErrorsKey) ?? [];
                    deferred.push(payload);
                    locals_js_1.locals.set(chatCustomAgentDeferredClientDataErrorsKey, deferred);
                }
                // Drop the record: an invalid frame is never answered, by this run or
                // a later one. Released so a waiting read stops waiting, finds it
                // gone, and goes back to waiting for the next message.
                chatInputRouter().take(CHAT_ROUTE_MESSAGES, record.seqNum);
                releaseClaim();
                return;
            }
            // Valid, so release. The record is still queued, and whichever comes
            // first, an injection or a later turn's read, now owns it.
            releaseClaim();
            void Promise.resolve(handler(result.payload, seqNum, () => active)).catch(() => { });
        })
            .catch(() => { });
    });
    return {
        off() {
            active = false;
            subscription.off();
        },
    };
}
/**
 * Whether a record is currently owned by the validating observer.
 *
 * A read that pulls one puts it back and keeps waiting, so the observer's parse
 * stays the only one and the record is not consumed out from under it.
 */
function observerClaimFor(record) {
    return locals_js_1.locals.get(chatObserverClaimedSeqNumsKey)?.get(record.seqNum)?.released;
}
const messagesInput = {
    id: "chat-messages",
    on(handler) {
        if (!locals_js_1.locals.get(chatCustomAgentClientDataParserKey)) {
            return subscribeToRawChatMessages(handler);
        }
        const deliver = (payload) => handler(payload);
        return subscribeToValidatedChatMessages(deliver, { onAfterOff: deliver });
    },
    once(options) {
        return new v3_1.InputStreamOncePromise((resolve, reject) => {
            /**
             * Same skip-and-wait rule as `waitWithIdleTimeout`: a payload that fails
             * validation is reported and not surfaced. The timeout is a total budget
             * across retries, so skipping a frame cannot extend the wait forever.
             */
            const deadline = options?.timeoutMs === undefined ? undefined : Date.now() + options.timeoutMs;
            const take = () => {
                chatInputRouter()
                    .next(CHAT_ROUTE_MESSAGES, {
                    timeoutMs: deadline === undefined ? undefined : Math.max(0, deadline - Date.now()),
                })
                    .then(async (record) => {
                    if (!record) {
                        resolve({
                            ok: false,
                            error: new v3_1.InputStreamTimeoutError("chat-messages", options?.timeoutMs ?? 0),
                        });
                        return;
                    }
                    const claim = observerClaimFor(record);
                    if (claim) {
                        chatInputRouter().untake(CHAT_ROUTE_MESSAGES, record);
                        await claim;
                        take();
                        return;
                    }
                    const payload = record.data.payload;
                    if (!shouldValidateChatCustomAgentPayload(payload)) {
                        resolve({ ok: true, output: payload });
                        return;
                    }
                    const validated = await validateChatCustomAgentPayload(payload);
                    if (validated.ok) {
                        resolve({ ok: true, output: validated.payload });
                        return;
                    }
                    take();
                }, reject);
            };
            take();
        });
    },
    peek() {
        const record = chatInputRouter().peek(CHAT_ROUTE_MESSAGES);
        if (!record)
            return undefined;
        const payload = record.data.payload;
        return validateChatCustomAgentPayloadSync(payload);
    },
    async hasPending() {
        return chatInputRouter().hasPending(CHAT_ROUTE_MESSAGES);
    },
    async next(options) {
        const timeoutInSeconds = options?.timeoutInSeconds;
        if (timeoutInSeconds !== undefined &&
            (!Number.isFinite(timeoutInSeconds) || timeoutInSeconds < 0)) {
            throw new TypeError("chat.messages.next() timeoutInSeconds must be a finite non-negative number");
        }
        // Consuming read, so it takes the same claim-and-validate path as the other
        // reads: a record the observer still owns is put back and awaited, and an
        // invalid payload is reported and skipped rather than surfaced raw.
        const totalMs = timeoutInSeconds === undefined ? undefined : timeoutInSeconds * 1000;
        /**
         * The caller's timeout is a total budget, not a per-attempt one. Skipping an
         * invalid frame must not buy another full wait, or a client sending invalid
         * frames faster than the timeout would keep the read blocked indefinitely
         * and it would never return.
         */
        const deadline = totalMs === undefined ? undefined : Date.now() + totalMs;
        while (true) {
            const record = await chatInputRouter().next(CHAT_ROUTE_MESSAGES, {
                timeoutMs: deadline === undefined ? undefined : Math.max(0, deadline - Date.now()),
            });
            if (!record)
                return undefined;
            const claim = observerClaimFor(record);
            if (claim) {
                chatInputRouter().untake(CHAT_ROUTE_MESSAGES, record);
                await claim;
                continue;
            }
            const chunk = record.data;
            if (!shouldValidateChatCustomAgentPayload(chunk.payload)) {
                return { id: record.id, seqNum: record.seqNum, payload: chunk.payload };
            }
            const validated = await validateChatCustomAgentPayload(chunk.payload);
            if (validated.ok) {
                return { id: record.id, seqNum: record.seqNum, payload: validated.payload };
            }
        }
    },
    wait(options) {
        return new v3_1.ManualWaitpointPromise(async (resolve, reject) => {
            try {
                // Same skip-and-wait rule as `waitWithIdleTimeout`, looping back into
                // the suspending wait rather than surfacing an unvalidated payload.
                while (true) {
                    const result = await waitOnChatRoute(CHAT_ROUTE_MESSAGES, { timeout: options?.timeout, spanName: options?.spanName });
                    if (!result.ok) {
                        resolve({ ok: false, error: result.error ?? new Error("Timed out") });
                        return;
                    }
                    const claim = observerClaimFor(result.record);
                    if (claim) {
                        chatInputRouter().untake(CHAT_ROUTE_MESSAGES, result.record);
                        await claim;
                        continue;
                    }
                    const payload = result.output.payload;
                    if (!shouldValidateChatCustomAgentPayload(payload)) {
                        resolve({ ok: true, output: payload });
                        return;
                    }
                    const validated = await validateChatCustomAgentPayload(payload);
                    if (validated.ok) {
                        resolve({ ok: true, output: validated.payload });
                        return;
                    }
                }
            }
            catch (error) {
                reject(error);
            }
        });
    },
    async waitWithIdleTimeout(options) {
        /**
         * A payload that fails client-data validation is reported and skipped
         * rather than surfaced, so the caller never sees an unvalidated
         * `clientData`. The loop waits for the next message instead of returning an
         * error, which keeps a single bad client send from ending the turn.
         */
        while (true) {
            const result = await waitOnChatRoute(CHAT_ROUTE_MESSAGES, options);
            if (!result.ok)
                return { ok: false, error: result.error };
            const claim = observerClaimFor(result.record);
            if (claim) {
                chatInputRouter().untake(CHAT_ROUTE_MESSAGES, result.record);
                await claim;
                continue;
            }
            const payload = result.output.payload;
            if (!shouldValidateChatCustomAgentPayload(payload)) {
                return { ok: true, output: payload };
            }
            const validated = await validateChatCustomAgentPayload(payload);
            if (validated.ok) {
                return { ok: true, output: validated.payload };
            }
        }
    },
    async send(_runId, data, options) {
        await getChatSession().in.send({ kind: "message", payload: data }, options?.requestOptions);
    },
};
const stopInput = {
    id: "chat-stop",
    on(handler) {
        return chatInputRouter().on(CHAT_ROUTE_STOP, (record) => {
            const chunk = record.data;
            void Promise.resolve(handler({ stop: true, message: chunk.message })).catch(() => { });
        });
    },
    once(options) {
        return new v3_1.InputStreamOncePromise((resolve, reject) => {
            chatInputRouter()
                .next(CHAT_ROUTE_STOP, { timeoutMs: options?.timeoutMs })
                .then((record) => {
                if (!record) {
                    resolve({
                        ok: false,
                        error: new v3_1.InputStreamTimeoutError("chat-stop", options?.timeoutMs ?? 0),
                    });
                    return;
                }
                const chunk = record.data;
                resolve({ ok: true, output: { stop: true, message: chunk.message } });
            }, reject);
        });
    },
    peek() {
        const record = chatInputRouter().peek(CHAT_ROUTE_STOP);
        if (!record)
            return undefined;
        const chunk = record.data;
        return { stop: true, message: chunk.message };
    },
    wait(options) {
        return new v3_1.ManualWaitpointPromise(async (resolve, reject) => {
            try {
                const result = await waitOnChatRoute(CHAT_ROUTE_STOP, { timeout: options?.timeout, spanName: options?.spanName });
                resolve(result.ok
                    ? { ok: true, output: { stop: true, message: result.output.message } }
                    : { ok: false, error: result.error ?? new Error("Timed out") });
            }
            catch (error) {
                reject(error);
            }
        });
    },
    async waitWithIdleTimeout(options) {
        const result = await waitOnChatRoute(CHAT_ROUTE_STOP, options);
        return result.ok
            ? { ok: true, output: { stop: true, message: result.output.message } }
            : { ok: false, error: result.error };
    },
    async send(_runId, data, options) {
        await getChatSession().in.send({ kind: "stop", message: data?.message }, options?.requestOptions);
    },
};
/**
 * Internal facade for waiting on the handover signal. Mirrors
 * `messagesInput` / `stopInput` so the wait paths and tracing
 * attributes stay consistent across all input-stream branches.
 * @internal
 */
const handoverInput = {
    async waitWithIdleTimeout(options) {
        const result = await waitOnChatRoute(CHAT_ROUTE_HANDOVER, options);
        return result.ok ? { ok: true, output: result.output } : result;
    },
};
/**
 * Wait for a `chat.headStart` handover signal inside a custom-agent loop or
 * `chat.createSession`. Returns:
 * - `null` — this run is not a `handover-prepare` boot, or the wait idled out /
 *   the warm handler crashed before signaling. Treat as "no handover".
 * - `{ kind: "handover-skip" }` — the warm handler aborted; exit without a turn.
 * - `{ kind: "handover", partialAssistantMessage, messageId?, isFinal }` — splice
 *   the partial (`chat.MessageAccumulator.applyHandover`) and, when `isFinal` is
 *   false, fall through to `streamText` to run the handed-over tool round.
 *
 * For the common case prefer `accumulator.consumeHandover()`, which also seeds
 * `payload.headStartMessages` and applies the partial for you.
 *
 * Safe to call at any point in turn 0: the handover signal has its own route,
 * so a message facade waiting at the same time cannot take it.
 */
async function waitForHandover(options) {
    if (options.payload.trigger !== "handover-prepare")
        return null;
    try {
        const result = await handoverInput.waitWithIdleTimeout({
            idleTimeoutInSeconds: options.idleTimeoutInSeconds ?? options.payload.idleTimeoutInSeconds ?? 60,
            timeout: options.timeout,
            spanName: options.spanName ?? "waiting for handover signal",
        });
        // Non-ok = idle timeout or the warm handler crashed without signaling.
        if (!result.ok)
            return null;
        return result.output;
    }
    finally {
        chatInputRouter().clearRoute(CHAT_ROUTE_HANDOVER);
    }
}
/**
 * Everything `session.in` carries, and what happens to each kind.
 *
 * A route's two properties are what make the resume protocol derivable rather
 * than hand-maintained. `messages` is replayable because losing a user message
 * is data loss. `stop` is neither queued nor replayable: it only means anything
 * to the turn that is live when it lands, and a replayed one would abort
 * whichever turn happened to be running. `handover` is queued but not
 * replayable, because it can arrive before its consumer is ready yet is
 * meaningless to any later boot.
 *
 * A kind absent from this table has no consumer, so the router discards it
 * instead of letting it park at the head of a queue.
 * @internal
 */
const CHAT_INPUT_ROUTES = {
    kindOf: (data) => data?.kind,
    routes: [
        { name: "messages", delivery: "queue", replayable: true, kinds: ["message"] },
        { name: "stop", delivery: "at-arrival", replayable: false, kinds: ["stop"] },
        {
            name: "handover",
            delivery: "queue",
            replayable: false,
            kinds: ["handover", "handover-skip"],
        },
    ],
};
const CHAT_ROUTE_MESSAGES = "messages";
const CHAT_ROUTE_STOP = "stop";
const CHAT_ROUTE_HANDOVER = "handover";
/**
 * The `.in` router for the run this worker is currently serving.
 *
 * One slot rather than a map, because the facades have to reach the same router
 * the boot attached without depending on a locals scope being active. Tagged
 * with the run as well as the chat: a warm process is reused across runs and the
 * executor tears the channel subscription down at the end of each one, so
 * reusing a router across runs would leave the new run with no input at all. A
 * nested `chat.createSession` within the same run still shares it.
 * @internal
 */
let currentChatInputRouter;
/**
 * Both cursors from the latest `turn-complete` on `.out`, in one scan.
 *
 * Absent for a chat whose turns predate the headers, in which case the router
 * starts from the beginning of the channel and nothing is treated as replayed.
 * @internal
 */
async function findLatestSessionInCheckpoint(chatId) {
    const apiClient = v3_1.apiClientManager.clientOrThrow();
    const response = await apiClient.readSessionStreamRecords(chatId, "out");
    const checkpoint = {};
    for (const record of response.records) {
        if ((0, v3_1.controlSubtype)(record.headers) !== v3_1.TRIGGER_CONTROL_SUBTYPE.TURN_COMPLETE)
            continue;
        const resumeFrom = Number.parseInt((0, v3_1.headerValue)(record.headers, v3_1.SESSION_IN_EVENT_ID_HEADER) ?? "", 10);
        if (Number.isFinite(resumeFrom))
            checkpoint.resumeFrom = resumeFrom;
        const appliedThrough = Number.parseInt((0, v3_1.headerValue)(record.headers, v3_1.SESSION_IN_CONSUMED_ID_HEADER) ?? "", 10);
        if (Number.isFinite(appliedThrough))
            checkpoint.appliedThrough = appliedThrough;
    }
    return checkpoint;
}
/**
 * The highest `.in` sequence already on the channel at boot, above the floor.
 *
 * Everything already on the channel when a run boots is, by definition, not
 * arriving live on this run, so the channel's own tail is the end of this run's
 * replay window.
 *
 * The turn boundary's value is not enough on its own. A boundary is written when
 * a turn ends, so a control record that arrived after the last boundary is not
 * covered by it, and a boundary written by an older SDK does not carry one at
 * all. Both cases leave an already-applied record looking live.
 *
 * Bounded by `afterEventId` when a floor is known, which is the common case, so
 * the read covers the replay window rather than the conversation. An absent
 * floor means no boundary has committed a cursor yet, and the channel is still
 * short.
 *
 * Returns `undefined` if the read fails; the caller then falls back to the
 * floor, which is the previous release's behaviour.
 * @internal
 */
async function findSessionInReplayWindowEnd(chatId, afterSeqNum) {
    try {
        const apiClient = v3_1.apiClientManager.clientOrThrow();
        const response = await apiClient.readSessionStreamRecords(chatId, "in", {
            ...(afterSeqNum === undefined ? {} : { afterEventId: String(afterSeqNum) }),
        });
        let highest;
        for (const record of response.records) {
            const seqNum = typeof record.seqNum === "number" ? record.seqNum : Number.NaN;
            if (Number.isFinite(seqNum) && (highest === undefined || seqNum > highest)) {
                highest = seqNum;
            }
        }
        return highest;
    }
    catch {
        return undefined;
    }
}
/**
 * Attach the `.in` router for this run.
 *
 * Reads the checkpoint and subscribes in one call, so there is no window in
 * which a listener is attached before the resume cursor is seeded. Attaching
 * first would open the tail at sequence 0 and replay every record the previous
 * run already answered, which is a mistake the previous shape of this code made
 * possible and this shape does not.
 *
 * The router consumes every record at dispatch, so the channel's own buffer
 * stays empty for chat and its cursor bookkeeping never engages. Delivery,
 * ordering and the published cursors are the router's, entirely.
 * @internal
 */
async function installChatInputRouter(chatId, options) {
    const entry = chatInputRouterEntry(chatId);
    if (entry.attached)
        return entry.router;
    let checkpoint = {};
    try {
        checkpoint = await findLatestSessionInCheckpoint(chatId);
    }
    catch (error) {
        v3_1.logger.warn("chat session: session.in resume cursor lookup failed; old messages may replay", {
            error: error instanceof Error ? error.message : String(error),
        });
    }
    if (checkpoint.resumeFrom === undefined && options?.fallbackResumeFrom !== undefined) {
        checkpoint.resumeFrom = options.fallbackResumeFrom;
    }
    // Only a resuming run has a replay window. On a first boot nothing has been
    // applied by anyone, so treating what is already on the channel as replayed
    // would discard a signal that arrived before the agent got here, which is
    // exactly how a head-start handover reaches a cold run.
    const resuming = checkpoint.resumeFrom !== undefined || options?.resuming === true;
    if (resuming) {
        const replayWindowEnd = await findSessionInReplayWindowEnd(chatId, checkpoint.resumeFrom);
        if (replayWindowEnd !== undefined) {
            checkpoint.appliedThrough = Math.max(checkpoint.appliedThrough ?? replayWindowEnd, replayWindowEnd);
        }
    }
    const router = entry.router;
    router.restore(checkpoint);
    if (options?.recoveredSeqNums && options.recoveredSeqNums.length > 0) {
        router.markRecovered(options.recoveredSeqNums);
    }
    const floor = router.resumeFrom();
    if (floor !== undefined) {
        v3_1.sessionStreams.setLastSeqNum(chatId, "in", floor);
        v3_1.sessionStreams.setLastDispatchedSeqNum(chatId, "in", floor);
    }
    v3_1.sessionStreams.onRecord(chatId, "in", (record) => {
        // The floor is the tail's `Last-Event-ID`, but a reconnect can still
        // re-deliver below it and a replayable route would re-queue it.
        if (floor !== undefined && record.seqNum <= floor)
            return true;
        router.ingest(record);
        return true;
    });
    entry.attached = true;
    return router;
}
function chatInputRouterEntry(chatId) {
    const runId = v3_1.taskContext.ctx?.run.id;
    if (currentChatInputRouter?.chatId === chatId && currentChatInputRouter.runId === runId) {
        return currentChatInputRouter;
    }
    currentChatInputRouter = {
        chatId,
        runId,
        router: new v3_1.SessionChannelRouter(CHAT_INPUT_ROUTES, {
            onDrop: (record, reason) => {
                if (reason === "unroutable" || reason === "malformed") {
                    v3_1.logger.warn("chat: discarded a session.in record nothing on this worker can consume", {
                        reason,
                        seqNum: record.seqNum,
                    });
                }
            },
        }),
        attached: false,
    };
    return currentChatInputRouter;
}
/** Drop the router so the next boot attaches a fresh one. @internal */
function __resetChatInputRouterForTests() {
    currentChatInputRouter = undefined;
}
/** The cursors this run would publish on its next turn boundary. @internal */
function __chatInputCheckpointForTests() {
    return currentChatInputRouter?.router.checkpoint() ?? {};
}
/** Test-only entry point for the turn-boundary cursor scan. @internal */
async function __findLatestSessionInCheckpointForTests(chatId) {
    return findLatestSessionInCheckpoint(chatId);
}
/**
 * This chat's router. Created on first use so a facade reached before the
 * install still shares the one the install will attach.
 * @internal
 */
function chatInputRouter() {
    return chatInputRouterEntry(getChatSession().id).router;
}
/**
 * Per-turn deferred promises. Registered via `chat.defer()`, awaited
 * before `onTurnComplete` fires. Reset each turn.
 * @internal
 */
const chatDeferKey = locals_js_1.locals.create("chat.defer");
/**
 * Run-scoped slot holding the partial assistant message handed over by
 * `chat.handover` from a customer's first-turn `streamText`. Appended
 * to `accumulatedMessages` during turn 0 setup so `streamText` resumes
 * at tool execution. Cleared (read once) after consumption.
 * @internal
 */
const chatHandoverPartialKey = locals_js_1.locals.create("chat.handoverPartial");
/**
 * Run-scoped slot holding the assistant `messageId` the customer's
 * `chat.handover` handler used for its step-1 stream. The agent reuses
 * it on the agent-side `toUIMessageStream` (and the synthesized
 * partial UIMessage in `originalMessages`) so all chunks merge into a
 * single assistant message on the browser side.
 * @internal
 */
const chatHandoverMessageIdKey = locals_js_1.locals.create("chat.handoverMessageId");
/**
 * The model messages a turn-0 head-start splice contributed to the model lane,
 * keyed by the UI message id it was synthesized under. When the agent's response
 * completes that message under the same id, this is the run to replace: the UI
 * form alone converts to something else (its pending tool calls drop out, the
 * approval round was never on it), so it cannot locate the run itself.
 */
const chatHandoverSplicedRunKey = locals_js_1.locals.create("chat.handoverSplicedRun");
/**
 * Run-scoped slot indicating that the customer's step-1 head-start
 * response is the FINAL turn response. When true, turn 0 runs through
 * the full turn-loop hooks but SKIPS the `userRun` / `streamText`
 * call — the customer's partial already IS the response. The agent's
 * `onTurnComplete` fires with that partial so persistence + any
 * post-turn work happens normally. Cleared after consumption.
 * @internal
 */
const chatHandoverIsFinalKey = locals_js_1.locals.create("chat.handoverIsFinal");
/**
 * Build a UIMessage representation of a `chat.handover` partial so AI
 * SDK's `processUIMessageStream` can transition `tool-output-available`
 * chunks (emitted by the initial-tool-execution branch when the
 * approval round runs) onto the existing tool-call. Without this,
 * `state.message.parts` is empty when the agent's `streamText`
 * finishes, and AI SDK throws
 * `UIMessageStreamError: No tool invocation found`.
 *
 * Only the assistant message matters — the synthesized
 * `tool-approval-response` rows are AI-SDK-internal and don't need a
 * UIMessage representation. We map:
 *   - `text` parts → `{ type: "text", text }`
 *   - `reasoning` parts → `{ type: "reasoning", text, state: "done" }`
 *      (provider metadata carried so an Anthropic thinking signature
 *      survives a UIMessage → ModelMessage round trip)
 *   - `tool-call` parts → `{ type: "tool-${name}", toolCallId,
 *      state: "input-available", input }`
 *   - `tool-approval-request` parts → skipped (AI SDK derives the
 *      approval state from chunks during processing)
 *
 * @internal
 */
function synthesizeHandoverUIMessage(partial, messageId) {
    const assistant = partial.find((m) => m.role === "assistant");
    if (!assistant || typeof assistant.content === "string")
        return undefined;
    const parts = [];
    for (const part of assistant.content) {
        if (part.type === "text" && typeof part.text === "string") {
            parts.push({ type: "text", text: part.text });
        }
        else if (part.type === "reasoning" && typeof part.text === "string") {
            parts.push({
                type: "reasoning",
                text: part.text,
                state: "done",
                ...(part.providerOptions ? { providerMetadata: part.providerOptions } : {}),
            });
        }
        else if (part.type === "tool-call" && part.toolCallId && part.toolName) {
            parts.push({
                type: `tool-${part.toolName}`,
                toolCallId: part.toolCallId,
                state: "input-available",
                input: part.input,
            });
        }
        // tool-approval-request parts intentionally skipped — they're an
        // AI-SDK protocol detail, not a UI surface.
    }
    if (parts.length === 0)
        return undefined;
    // Use the customer's step-1 messageId if provided (so the agent's
    // post-handover chunks merge into the same assistant message on the
    // browser). Fall back to a fresh id only if the handover signal
    // didn't carry one.
    return {
        id: messageId ?? (0, ai_runtime_js_1.generateId)(),
        role: "assistant",
        parts,
    };
}
/**
 * Splice a head-start handover partial into an accumulating message pair
 * (model + UI). Dedups by `messageId` against the UI chain (so a hydrated
 * history that already persisted the partial isn't doubled), then pushes the
 * partial into `modelMessages` and the synthesized UIMessage into `uiMessages`.
 * Shared by the `chat.agent` turn-0 splice and `ChatMessageAccumulator.applyHandover`.
 * @internal
 */
function spliceHandoverPartial(modelMessages, uiMessages, signal) {
    if (!signal.partialAssistantMessage || signal.partialAssistantMessage.length === 0) {
        return undefined;
    }
    // Skip if the hydrated chain already persisted the partial under this id.
    const alreadyInChain = signal.messageId !== undefined && uiMessages.some((m) => m.id === signal.messageId);
    if (alreadyInChain)
        return undefined;
    const run = [...signal.partialAssistantMessage];
    modelMessages.push(...run);
    const partialUI = synthesizeHandoverUIMessage(signal.partialAssistantMessage, signal.messageId);
    if (!partialUI)
        return undefined;
    uiMessages.push(partialUI);
    return { id: partialUI.id, run };
}
/**
 * Per-turn background context queue. Messages added via `chat.backgroundWork.inject()`
 * are drained at the next `prepareStep` boundary and appended to the model messages.
 * @internal
 */
const chatBackgroundQueueKey = locals_js_1.locals.create("chat.backgroundQueue");
/**
 * Background injections a step-boundary drain handed to the model this turn,
 * with the transcript message they followed. Reconciled into the model lane
 * and the persisted injections once the turn's response is in.
 */
const chatPendingBackgroundKey = locals_js_1.locals.create("chat.pendingBackground");
/**
 * System-role context injected mid-conversation, held for the instructions lane.
 *
 * Kept apart from the message queue because ai@7 rejects a system message inside
 * `messages` for every provider — `standardizePrompt` throws upstream of any
 * provider call, and its own advice is to use the instructions option. Instructions
 * accept `Array<SystemModelMessage>`, so a system-role injection has a correct
 * home: appended as another system block rather than smuggled into the transcript.
 *
 * This is also the only way to inject *trusted* context. A message injected as
 * `user` is untrusted by construction, and a well-aligned model treats it that
 * way — it will say so, and re-derive the answer from tools instead.
 */
const chatInjectedInstructionsKey = locals_js_1.locals.create("chat.injectedInstructions");
/**
 * What a turn already consumed from the instructions lane, so a second
 * `toStreamTextOptions()` call in the same turn sees the same blocks.
 *
 * Consumed blocks are moved here rather than left in the pending lane: leaving
 * them there means an injection made during the consumed turn sits behind them,
 * and clearing the lane on the next turn destroys both.
 */
const chatInstructionsConsumedKey = locals_js_1.locals.create("chat.injectedInstructionsConsumed");
/**
 * Run-scoped pipe counter. Stored in locals so concurrent runs in the
 * same worker don't share state.
 * @internal
 */
const chatPipeCountKey = locals_js_1.locals.create("chat.pipeCount");
const chatStopControllerKey = locals_js_1.locals.create("chat.stopController");
/** Static (task-level) UIMessageStream options, set once during chatAgent setup. @internal */
const chatUIStreamStaticKey = locals_js_1.locals.create("chat.uiMessageStreamOptions.static");
/** Per-turn UIMessageStream options, set via chat.setUIMessageStreamOptions(). @internal */
const chatUIStreamPerTurnKey = locals_js_1.locals.create("chat.uiMessageStreamOptions.perTurn");
/**
 * Run-scoped `toolCallId → assistant messageId` map. Records the head
 * assistant id whenever the accumulator absorbs an assistant message
 * containing tool parts. Used as a fallback in the id-merge for
 * incoming tool-answer messages — if the AI SDK regenerates the
 * assistant id on a HITL `addToolOutput` resume, we look up the
 * original head id by `toolCallId` and rewrite it before the merge.
 *
 * Customer-side workaround for the same case is documented in Arena
 * AI's chat-agent task; lifting it into the SDK so customers don't
 * have to. See TRI-9137.
 * @internal
 */
const chatToolCallToMessageIdKey = locals_js_1.locals.create("chat.toolCallToMessageId");
function recordToolCallIdsFromMessage(message) {
    if (!message || message.role !== "assistant" || !message.id)
        return;
    let map = locals_js_1.locals.get(chatToolCallToMessageIdKey);
    if (!map) {
        map = new Map();
        locals_js_1.locals.set(chatToolCallToMessageIdKey, map);
    }
    for (const part of message.parts ?? []) {
        if (typeof part !== "object" || part == null)
            continue;
        const toolCallId = part.toolCallId;
        if (typeof toolCallId === "string" && toolCallId.length > 0) {
            map.set(toolCallId, message.id);
        }
    }
}
function rewriteIncomingIdViaToolCallMap(incoming) {
    const map = locals_js_1.locals.get(chatToolCallToMessageIdKey);
    if (!map || map.size === 0)
        return incoming;
    for (const part of incoming.parts ?? []) {
        if (typeof part !== "object" || part == null)
            continue;
        const toolCallId = part.toolCallId;
        if (typeof toolCallId !== "string" || toolCallId.length === 0)
            continue;
        const headId = map.get(toolCallId);
        if (headId && headId !== incoming.id) {
            return { ...incoming, id: headId };
        }
    }
    return incoming;
}
function emptyUsage() {
    return {
        inputTokens: undefined,
        outputTokens: undefined,
        totalTokens: undefined,
        inputTokenDetails: {
            noCacheTokens: undefined,
            cacheReadTokens: undefined,
            cacheWriteTokens: undefined,
        },
        outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
    };
}
function addUsage(a, b) {
    const add = (x, y) => x != null || y != null ? (x ?? 0) + (y ?? 0) : undefined;
    return {
        inputTokens: add(a.inputTokens, b.inputTokens),
        outputTokens: add(a.outputTokens, b.outputTokens),
        totalTokens: add(a.totalTokens, b.totalTokens),
        inputTokenDetails: {
            noCacheTokens: add(a.inputTokenDetails?.noCacheTokens, b.inputTokenDetails?.noCacheTokens),
            cacheReadTokens: add(a.inputTokenDetails?.cacheReadTokens, b.inputTokenDetails?.cacheReadTokens),
            cacheWriteTokens: add(a.inputTokenDetails?.cacheWriteTokens, b.inputTokenDetails?.cacheWriteTokens),
        },
        outputTokenDetails: {
            textTokens: add(a.outputTokenDetails?.textTokens, b.outputTokenDetails?.textTokens),
            reasoningTokens: add(a.outputTokenDetails?.reasoningTokens, b.outputTokenDetails?.reasoningTokens),
        },
    };
}
// ---------------------------------------------------------------------------
// chat.setMessages — replace accumulated messages for compaction
// ---------------------------------------------------------------------------
/** @internal */
const chatOverrideMessagesKey = locals_js_1.locals.create("chat.overrideMessages");
/**
 * Tracks the current accumulated UI messages so chat.history.all() can
 * read them from outside the chatAgent closure.
 * @internal
 */
const chatCurrentUIMessagesKey = locals_js_1.locals.create("chat.currentUIMessages");
/**
 * Replace the accumulated conversation messages for the current run.
 *
 * Call from `onTurnStart` to compact before `run()` executes, or from
 * `onTurnComplete` to compact before the next turn. Takes `UIMessage[]`
 * and converts to `ModelMessage[]` internally.
 */
function setChatMessages(uiMessages) {
    locals_js_1.locals.set(chatOverrideMessagesKey, uiMessages);
}
// ---------------------------------------------------------------------------
// chat.history — imperative message history mutations
// ---------------------------------------------------------------------------
/**
 * Read the current message history state, accounting for pending overrides.
 * @internal
 */
function getChatHistoryState() {
    const pending = locals_js_1.locals.get(chatOverrideMessagesKey);
    if (pending)
        return pending;
    return locals_js_1.locals.get(chatCurrentUIMessagesKey) ?? [];
}
/**
 * Tool parts that are "done" — either succeeded with a value or failed
 * with an error. Excludes pending (`input-streaming`/`input-available`)
 * and approval (`approval-requested`/`approval-responded`) states.
 * @internal
 */
function isResolvedToolState(state) {
    return state === "output-available" || state === "output-error";
}
/** @internal */
function isPendingToolState(state) {
    return state === "input-available";
}
/**
 * Walk an assistant message and yield each tool part with its callId,
 * name, and state. Skips non-assistant messages and non-tool parts.
 * @internal
 */
function* iterateToolParts(message) {
    if (message.role !== "assistant")
        return;
    for (const part of (message.parts ?? [])) {
        if (!(0, ai_runtime_js_1.isToolUIPart)(part))
            continue;
        const toolCallId = part.toolCallId;
        if (typeof toolCallId !== "string" || toolCallId.length === 0)
            continue;
        yield {
            part,
            toolCallId,
            toolName: (0, ai_runtime_js_1.getToolName)(part),
            state: part.state,
        };
    }
}
/**
 * Walk a partial assistant message and surface the tool calls the model
 * had started but never received a result for. Used at recovery boot to
 * populate `RecoveryBootEvent.pendingToolCalls`.
 *
 * The partial assistant in question is the orphan from a dead run — its
 * `turn-complete` never fired, so any `input-available` tool part is
 * truly orphan (NOT a stable HITL pause; HITL parts live on settled
 * messages, not on the partial).
 *
 * @internal
 */
function extractPendingToolCallsFromPartial(partial) {
    if (!partial)
        return [];
    const out = [];
    const parts = (partial.parts ?? []);
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!(0, ai_runtime_js_1.isToolUIPart)(part))
            continue;
        if (!isPendingToolState(part.state))
            continue;
        const toolCallId = part.toolCallId;
        if (typeof toolCallId !== "string" || toolCallId.length === 0)
            continue;
        out.push({
            toolCallId,
            toolName: (0, ai_runtime_js_1.getToolName)(part),
            input: part.input,
            partIndex: i,
        });
    }
    return out;
}
/**
 * Tool parts on the *leaf* assistant message that are still waiting on
 * an answer (`input-available` state). Used to gate fresh user turns
 * during HITL flows.
 * @internal
 */
function getPendingToolCallsFromHistory(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role !== "assistant")
            continue;
        const pending = [];
        for (const { toolCallId, toolName, state } of iterateToolParts(msg)) {
            if (isPendingToolState(state)) {
                pending.push({ toolCallId, toolName, messageId: msg.id });
            }
        }
        return pending;
    }
    return [];
}
/**
 * All tool parts across the chain that have already produced an output
 * (`output-available` or `output-error`). Used to dedup re-saves when
 * the AI SDK resends an assistant with progressively more answered
 * parts.
 * @internal
 */
function getResolvedToolCallsFromHistory(messages) {
    const out = [];
    for (const msg of messages) {
        for (const { toolCallId, toolName, state } of iterateToolParts(msg)) {
            if (isResolvedToolState(state)) {
                out.push({ toolCallId, toolName, messageId: msg.id });
            }
        }
    }
    return out;
}
/**
 * Pure helper: tool parts in `message` that have a fresh result not
 * already represented by the resolved toolCallIds in `messages`. The
 * `errorText` field is present only for `output-error` parts.
 *
 * Within a single `message`, duplicate `toolCallId`s emit only once
 * (first occurrence wins). This guards against malformed assistants
 * with repeated tool parts.
 * @internal
 */
function extractNewToolResultsFromHistory(message, messages) {
    const resolved = new Set(getResolvedToolCallsFromHistory(messages).map((r) => r.toolCallId));
    const seen = new Set();
    const out = [];
    for (const { part, toolCallId, toolName, state } of iterateToolParts(message)) {
        if (!isResolvedToolState(state))
            continue;
        if (resolved.has(toolCallId))
            continue;
        if (seen.has(toolCallId))
            continue;
        seen.add(toolCallId);
        if (state === "output-error") {
            out.push({ toolCallId, toolName, output: undefined, errorText: part.errorText });
        }
        else {
            out.push({ toolCallId, toolName, output: part.output });
        }
    }
    return out;
}
/**
 * Per-turn merge of an incoming wire `UIMessage` onto the matching entry
 * a `hydrateMessages` hook (or the default accumulator) provides. Used
 * to fold tool-state advances from the client into the agent's
 * authoritative chain without trusting the wire copy for fields the
 * LLM consumes.
 *
 * `hydrated` is treated as the source of truth for everything outside
 * tool-state advancement: text, reasoning blobs, provider metadata,
 * and tool `input` all stay as hydrated had them. We only overlay
 * tool parts whose incoming state is wire-advanced — `output-available`
 * / `output-error` (HITL `addToolOutput`) or `approval-responded` /
 * `output-denied` (approval flow) — and only the corresponding
 * resolution fields (`output` / `errorText` / `approval`). Hydrated
 * `input` and everything else stay put.
 *
 * Without this, a slim wire copy (which `TriggerChatTransport` /
 * `AgentChat.sendRaw` ship by default on HITL continuations) would
 * clobber the hydrated assistant — the next LLM call would receive a
 * tool call with no `input` and 4xx.
 *
 * @internal
 */
function mergeIncomingIntoHydrated(hydrated, incoming) {
    const incomingAdvancedByCallId = new Map();
    for (const part of (incoming.parts ?? [])) {
        if (!(0, ai_runtime_js_1.isToolUIPart)(part))
            continue;
        const toolCallId = part.toolCallId;
        if (typeof toolCallId !== "string" || toolCallId.length === 0)
            continue;
        if (!isWireAdvanceableToolState(part.state))
            continue;
        incomingAdvancedByCallId.set(toolCallId, part);
    }
    if (incomingAdvancedByCallId.size === 0)
        return hydrated;
    let mutated = false;
    const hydratedParts = (hydrated.parts ?? []);
    const mergedParts = hydratedParts.map((part) => {
        if (!(0, ai_runtime_js_1.isToolUIPart)(part))
            return part;
        const toolCallId = part.toolCallId;
        if (typeof toolCallId !== "string" || toolCallId.length === 0)
            return part;
        const incomingPart = incomingAdvancedByCallId.get(toolCallId);
        if (!incomingPart)
            return part;
        // Terminal hydrated states (`output-available`, `output-error`,
        // `output-denied`) are authoritative — never regressed by a stale
        // wire arrival (replay, retry, out-of-order). `output-denied`
        // matters here because the wire's `approval-responded` could
        // otherwise overwrite a hydrated denial back to a non-terminal
        // state.
        if (isResolvedToolState(part.state) || part.state === "output-denied") {
            return part;
        }
        // Same state on both sides — no progression to apply.
        if (part.state === incomingPart.state)
            return part;
        mutated = true;
        if (incomingPart.state === "output-available") {
            return {
                ...part,
                state: incomingPart.state,
                output: incomingPart.output,
                ...(incomingPart.approval !== undefined ? { approval: incomingPart.approval } : {}),
            };
        }
        if (incomingPart.state === "output-error") {
            return {
                ...part,
                state: incomingPart.state,
                errorText: incomingPart.errorText,
                ...(incomingPart.approval !== undefined ? { approval: incomingPart.approval } : {}),
            };
        }
        // approval-responded / output-denied — overlay state + approval.
        return {
            ...part,
            state: incomingPart.state,
            ...(incomingPart.approval !== undefined ? { approval: incomingPart.approval } : {}),
        };
    });
    if (!mutated)
        return hydrated;
    return { ...hydrated, parts: mergedParts };
}
/**
 * Mirror of `slimSubmitMessageForWire`'s predicate. Kept here so the
 * agent runtime doesn't have to import from `ai-shared.ts` for a
 * one-liner. See that file for the full state-machine docs.
 *
 * @internal
 */
function isWireAdvanceableToolState(state) {
    return (state === "output-available" ||
        state === "output-error" ||
        state === "approval-responded" ||
        state === "output-denied");
}
/**
 * Imperative API for reading and modifying the accumulated message history.
 *
 * Mutations use the same deferred override mechanism as `chat.setMessages()`:
 * they are applied at lifecycle checkpoints (after hooks return). Reads are
 * synchronous against the current accumulator state.
 *
 * Can be called from `onTurnStart`, `onBeforeTurnComplete`, `onTurnComplete`,
 * `run()`, `onAction`, or AI SDK tools.
 */
const chatHistory = {
    /** Read the current accumulated UI messages (copy). */
    all() {
        return [...getChatHistoryState()];
    },
    /**
     * Read the current chain as an ordered `UIMessage[]`. Identical to
     * `all()`; use whichever name reads better in context.
     */
    getChain() {
        return chatHistory.all();
    },
    /**
     * Find a message by id. Returns `undefined` if no message with that id
     * is present in the current chain.
     */
    findMessage(messageId) {
        return getChatHistoryState().find((m) => m.id === messageId);
    },
    /**
     * Tool calls on the *most recent* assistant message that are still in
     * `input-available` state (waiting on an `addToolOutput` answer). The
     * scan walks back from the tail and stops at the first assistant
     * message it finds, so a trailing user message does not change the
     * result — pending tool calls remain pending until they're resolved
     * on that assistant or the assistant is removed.
     *
     * Use this to gate fresh user turns or actions during HITL flows: if
     * `getPendingToolCalls().length > 0`, an `addToolOutput` is expected.
     *
     * Returns `[]` if there is no assistant message yet, or if the most
     * recent assistant has no pending tool calls.
     *
     * Approval flows (`approval-requested` / `approval-responded` states)
     * are not surfaced here. Those are about the user authorizing a tool
     * to run; "pending" is about the user *answering* a tool call.
     */
    getPendingToolCalls() {
        return getPendingToolCallsFromHistory(getChatHistoryState());
    },
    /**
     * Tool calls across the chain with a final result (`output-available`
     * or `output-error`). Use this to dedup re-saves when the AI SDK
     * resends an assistant message with progressively more answered parts.
     */
    getResolvedToolCalls() {
        return getResolvedToolCallsFromHistory(getChatHistoryState());
    },
    /**
     * Pure helper: returns the tool parts in `message` whose results are
     * not already represented in the current chain. Use this when
     * persisting tool results to your own store: each call surfaces only
     * the *new* answers, so writes stay idempotent across re-streams.
     * Duplicate `toolCallId`s within `message` itself are also collapsed
     * to a single entry.
     */
    extractNewToolResults(message) {
        return extractNewToolResultsFromHistory(message, getChatHistoryState());
    },
    /** Replace all accumulated messages. Same as `chat.setMessages()`. */
    set(messages) {
        locals_js_1.locals.set(chatOverrideMessagesKey, messages);
    },
    /** Remove a specific message by ID. */
    remove(messageId) {
        chatHistory.set(getChatHistoryState().filter((m) => m.id !== messageId));
    },
    /** Keep messages up to and including the given ID (undo/rollback). */
    rollbackTo(messageId) {
        const current = getChatHistoryState();
        const idx = current.findIndex((m) => m.id === messageId);
        if (idx !== -1) {
            chatHistory.set(current.slice(0, idx + 1));
        }
    },
    /** Replace a specific message by ID (edit). */
    replace(messageId, message) {
        chatHistory.set(getChatHistoryState().map((m) => (m.id === messageId ? message : m)));
    },
    /** Keep only messages in the given range. */
    slice(start, end) {
        chatHistory.set(getChatHistoryState().slice(start, end));
    },
};
/**
 * Model-only message override. Set by compaction to replace only the model
 * messages (what goes to the LLM) without affecting UI messages (what gets
 * persisted and displayed). This preserves full conversation history for the
 * user while keeping LLM context compact.
 * @internal
 */
const chatOverrideModelMessagesKey = locals_js_1.locals.create("chat.overrideModelMessages");
/** @internal */
const chatCompactionStateKey = locals_js_1.locals.create("chat.compaction");
const chatOnCompactedKey = locals_js_1.locals.create("chat.onCompacted");
/** @internal Full task `ctx` for the active `chat.agent` run (for hooks invoked from nested compaction). */
const chatAgentRunContextKey = locals_js_1.locals.create("chat.agentRunContext");
/** @internal When a mid-turn validation failure writes its terminal error. */
const chatCustomAgentClientDataErrorTimingKey = locals_js_1.locals.create("chat.customAgent.clientDataErrorTiming");
/**
 * @internal Client-data errors held back until the open turn closes.
 *
 * The default timing exists so a bad send cannot truncate an answer already
 * being read, which means the write has to happen later rather than not at all:
 * the callback and the task log are server-side, so dropping the stream write
 * would leave the client with no signal that its frame was rejected.
 */
const chatCustomAgentDeferredClientDataErrorsKey = locals_js_1.locals.create("chat.customAgent.deferredClientDataErrors");
/**
 * @internal Sequences the validating observer has claimed.
 *
 * The observer watches without consuming, so a record it is still validating is
 * also visible to a turn's read. Claiming makes ownership single: a read that
 * pulls a claimed record puts it back and keeps waiting, so exactly one of them
 * validates it and the schema runs once per frame.
 */
const chatObserverClaimedSeqNumsKey = locals_js_1.locals.create("chat.customAgent.observerClaims");
/** @internal Marks the root run created by `chat.customAgent()`. */
const chatCustomAgentRunKey = locals_js_1.locals.create("chat.customAgentRun");
/** @internal Number of active `chat.createSession()` iterators in this run. */
const chatActiveSessionIteratorsKey = locals_js_1.locals.create("chat.createSession.activeIterators");
const chatPrepareMessagesKey = locals_js_1.locals.create("chat.prepareMessages");
/**
 * @internal The raw `tools` option from `chat.agent({ tools })`, either a
 * static `ToolSet` or a per-turn function. Set once at boot.
 */
const chatToolsOptionKey = locals_js_1.locals.create("chat.toolsOption");
/**
 * @internal The concrete `ToolSet` resolved for the current turn. Read by
 * `toModelMessages` so `convertToModelMessages` can re-run `toModelOutput` on
 * prior-turn tool results. Unset when no `tools` were declared (preserves the
 * exact pre-feature conversion behavior).
 */
const chatResolvedToolsKey = locals_js_1.locals.create("chat.resolvedTools");
/** @internal Flag set by `chat.requestUpgrade()` to exit the loop after the current turn. */
const chatUpgradeRequestedKey = locals_js_1.locals.create("chat.upgradeRequested");
/** @internal Target for the upgrade handoff, set by `chat.requestUpgrade({ externalDeploymentId })`. */
const chatUpgradeExternalDeploymentIdKey = locals_js_1.locals.create("chat.upgradeExternalDeploymentId");
/**
 * @internal Flag set by `chat.endRun()` to exit the loop after the current
 * turn completes, without any upgrade semantics. Checked at the same
 * post-turn / pre-wait sites as `chatUpgradeRequestedKey`.
 */
const chatEndRunRequestedKey = locals_js_1.locals.create("chat.endRunRequested");
/**
 * @internal Set by `chat.close()`. Holds the close request (and its reason)
 * for the rest of the run: the loop writes the terminal `session-closed`
 * record, closes the session row, and exits at the same post-turn /
 * pre-wait sites as `chatEndRunRequestedKey`.
 */
const chatCloseRequestedKey = locals_js_1.locals.create("chat.closeRequested");
/** @internal Matches the server's `CloseSessionRequestBody.reason` cap. */
const CHAT_CLOSE_REASON_MAX_LENGTH = 256;
/** @internal Set once the session row is closed, so the close happens once. */
const chatClosePerformedKey = locals_js_1.locals.create("chat.closePerformed");
/**
 * @internal Set once the terminal `.out` record is written. Tracked apart from
 * {@link chatClosePerformedKey} so a retried close does not emit a second
 * client-visible event.
 */
const chatCloseRecordWrittenKey = locals_js_1.locals.create("chat.closeRecordWritten");
/** @internal */
const chatAgentCompactionKey = locals_js_1.locals.create("chat.agentCompaction");
/** @internal */
const chatPendingMessagesKey = locals_js_1.locals.create("chat.pendingMessages");
/** @internal */
const chatSteeringQueueKey = locals_js_1.locals.create("chat.steeringQueue");
/**
 * This turn's new messages, as `onTurnComplete.newUIMessages` will see them.
 *
 * Held in locals because `drainSteeringQueue` runs outside the turn closure and
 * has to append the messages it injects. Without that, an injected message
 * reaches the model and the browser but no hook, so an app persisting from
 * `onTurnComplete` never learns it existed.
 */
const chatTurnNewUIMessagesKey = locals_js_1.locals.create("chat.turnNewUIMessages");
/**
 * Steering messages a drain consumed that the model accumulator has not been
 * given yet.
 *
 * The two accumulators are maintained separately, and the model one is
 * normally advanced by appending each turn's delta. A drained message is
 * appended to the UI one but reaches the model only through the `prepareStep`
 * return value, which is per-step: without this the model lane never learns
 * the message exists and every later turn of the run answers without it,
 * while the browser, the snapshot and `chat.history.*` all still show it.
 *
 * Held as the messages rather than a "rebuild me" flag because the model lane
 * can only be appended to, never reconstructed. Compaction replaces it with a
 * summary and deliberately leaves the UI lane whole, so reconverting the UI
 * lane restores every message the summary replaced.
 */
const chatPendingSteerKey = locals_js_1.locals.create("chat.pendingSteer");
/** @internal — IDs of messages that were successfully injected via prepareStep */
const chatInjectedMessageIdsKey = locals_js_1.locals.create("chat.injectedMessageIds");
/** @internal — non-transient data parts queued via chat.response or writer.write() for accumulation into the response message */
const chatResponsePartsKey = locals_js_1.locals.create("chat.responseParts");
/**
 * Check if a chunk is a non-transient data part that should persist to the response message.
 * @internal
 */
function isNonTransientDataPart(part) {
    if (typeof part !== "object" || part === null)
        return false;
    const p = part;
    return typeof p.type === "string" && p.type.startsWith("data-") && p.transient !== true;
}
/**
 * Queue a chunk for accumulation into the response message (if it's a non-transient data part).
 * Called by `chat.response.write()` and `ChatWriter.write()`.
 * @internal
 */
function queueResponsePart(part) {
    if (!isNonTransientDataPart(part))
        return;
    const parts = locals_js_1.locals.get(chatResponsePartsKey) ?? [];
    parts.push(part);
    locals_js_1.locals.set(chatResponsePartsKey, parts);
}
/**
 * Check that no tool calls are in-flight in a step's content.
 * Used before compaction to avoid losing tool state mid-execution.
 * @internal
 */
function isStepBoundarySafe(step) {
    if (step.finishReason === "error")
        return false;
    const callIds = new Set(step.content.filter((p) => p.type === "tool-call").map((p) => p.toolCallId));
    const settledIds = new Set(step.content
        .filter((p) => p.type === "tool-result" || p.type === "tool-error")
        .map((p) => p.toolCallId));
    return ![...callIds].some((id) => !settledIds.has(id));
}
/**
 * True when a model message is a `tool` message carrying a
 * `tool-approval-response` part — the trailing row a head-start handover
 * reshapes a pending first-turn tool call into. AI SDK's `collectToolApprovals`
 * only inspects the conversation's last message, so this row must survive to
 * `streamText` intact for the agent to execute the handed-over call.
 * @internal
 */
function hasToolApprovalResponse(message) {
    return (message?.role === "tool" &&
        Array.isArray(message.content) &&
        message.content.some((part) => part != null &&
            typeof part === "object" &&
            part.type === "tool-approval-response"));
}
/**
 * Keep a head-start handover's tool-approval tail intact across `prepareMessages`.
 *
 * The handover reshapes the warm step-1's pending tool call into AI SDK's
 * tool-approval round: a `tool-approval-request` on the assistant plus a
 * trailing `tool` message with `tool-approval-response { approved: true }`. The
 * agent's next `streamText` runs `collectToolApprovals`, which ONLY looks at the
 * last message — so that tool row must stay last and unmodified for the pending
 * call to execute. A user `prepareMessages` hook that rewrites or drops the last
 * message (e.g. rolling a provider cache breakpoint onto it) silently breaks the
 * resume: the agent sends a bare `tool_use` and the turn dies with
 * "tool_use ids were found without tool_result". If the hook's input ended with
 * that approval tail, re-assert the original tail as the last message.
 *
 * No-op for every normal turn — only fires when the input genuinely ended with a
 * pending tool-approval response (i.e. a head-start resume).
 * @internal
 */
function preserveToolApprovalTail(original, prepared) {
    const originalTail = original[original.length - 1];
    if (!hasToolApprovalResponse(originalTail))
        return prepared;
    // Hook left the exact tail object in place — nothing to do.
    if (prepared[prepared.length - 1] === originalTail)
        return prepared;
    // Otherwise drop only the trailing approval tail the hook produced (the
    // original moved, or a rewritten copy) and re-append the original so it is
    // last and intact. Older approval rounds deeper in history must survive.
    const withoutMovedOriginal = prepared.filter((m) => m !== originalTail);
    while (hasToolApprovalResponse(withoutMovedOriginal[withoutMovedOriginal.length - 1])) {
        withoutMovedOriginal.pop();
    }
    return [...withoutMovedOriginal, originalTail];
}
/**
 * Apply the prepareMessages hook if one is set in locals.
 * @internal
 */
async function applyPrepareMessages(messages, reason) {
    const hook = locals_js_1.locals.get(chatPrepareMessagesKey);
    if (!hook)
        return messages;
    const turnCtx = locals_js_1.locals.get(chatTurnContextKey);
    const prepared = await tracer_js_1.tracer.startActiveSpan("prepareMessages()", async () => {
        return hook({
            messages,
            reason,
            chatId: turnCtx?.chatId ?? "",
            turn: turnCtx?.turn ?? 0,
            clientData: turnCtx?.clientData,
        });
    }, {
        attributes: {
            [v3_1.SemanticInternalAttributes.STYLE_ICON]: "task-hook-onStart",
            [v3_1.SemanticInternalAttributes.COLLAPSED]: true,
            "chat.prepareMessages.reason": reason,
            "chat.prepareMessages.messageCount": messages.length,
        },
    });
    // A user hook must never be able to break the head-start handover resume by
    // disturbing the trailing tool-approval row (see preserveToolApprovalTail).
    return preserveToolApprovalTail(messages, prepared);
}
/**
 * Resolve the `tools` option into a concrete `ToolSet` and cache it in locals so
 * `toModelMessages` can pass it to `convertToModelMessages`. For the function
 * form, invokes the user function with the given context (or the current turn
 * context when no override is passed). Pass an `override` for the boot-time
 * history conversion, which runs before the per-turn context exists and uses
 * the run/continuation payload's `clientData`.
 *
 * Fails closed: a throwing resolver propagates rather than carrying a prior
 * turn's set forward. The function form can gate capabilities by user or flag,
 * so reusing stale tools would leak capabilities. No-op when no `tools` were
 * declared.
 * @internal
 */
async function resolveTurnTools(override) {
    const option = locals_js_1.locals.get(chatToolsOptionKey);
    if (!option)
        return;
    if (typeof option !== "function") {
        locals_js_1.locals.set(chatResolvedToolsKey, option);
        return;
    }
    const ctx = override ?? locals_js_1.locals.get(chatTurnContextKey);
    const resolved = await option({
        chatId: ctx?.chatId ?? "",
        turn: ctx?.turn ?? 0,
        continuation: ctx?.continuation ?? false,
        clientData: ctx?.clientData,
    });
    locals_js_1.locals.set(chatResolvedToolsKey, resolved);
}
/**
 * Read the current compaction state. Returns the summary and base message count
 * if compaction has occurred in this turn, or `undefined` if not.
 *
 * Use in a custom `prepareStep` to rebuild from a previous compaction:
 * ```ts
 * const state = chat.getCompactionState();
 * if (state) {
 *   return { messages: [{ role: "user", content: state.summary }, ...newMsgs] };
 * }
 * ```
 */
function getCompactionState() {
    return locals_js_1.locals.get(chatCompactionStateKey);
}
/**
 * Low-level compaction for use inside a custom `prepareStep`.
 *
 * Handles the full decision tree: first step, already-compacted rebuild,
 * boundary safety, threshold check, summarization, stream chunks, state
 * storage, and accumulator update.
 *
 * Returns a `CompactResult` — inspect `result.type` to see what happened,
 * or convert to a prepareStep return with `result.type === "skipped" ? undefined : result`.
 *
 * @example
 * ```ts
 * prepareStep: async ({ messages, steps }) => {
 *   // your custom logic here...
 *   const result = await chat.compact(messages, steps, {
 *     threshold: 80_000,
 *     summarize: async (msgs) => generateText({ model, messages: msgs }).then(r => r.text),
 *   });
 *   if (result.type === "compacted") {
 *     logger.info("Compacted!", { summary: result.summary });
 *   }
 *   return result.type === "skipped" ? undefined : result;
 * },
 * ```
 */
async function chatCompact(messages, steps, options) {
    const currentStep = steps.at(-1);
    // First step — nothing to check
    if (!currentStep) {
        return { type: "skipped" };
    }
    // Already compacted — rebuild from summary + new response messages
    const state = locals_js_1.locals.get(chatCompactionStateKey);
    if (state && isStepBoundarySafe(currentStep)) {
        return {
            type: "rebuilt",
            messages: await applyPrepareMessages([
                { role: "user", content: state.summary },
                ...currentStep.response.messages.slice(state.baseResponseMessageCount),
            ], "compaction-rebuild"),
        };
    }
    // Boundary unsafe — skip
    if (!isStepBoundarySafe(currentStep)) {
        return { type: "skipped" };
    }
    const totalTokens = currentStep.usage.totalTokens;
    const inputTokens = currentStep.usage.inputTokens;
    const outputTokens = currentStep.usage.outputTokens;
    const turnCtx = locals_js_1.locals.get(chatTurnContextKey);
    const stepNumber = steps.length - 1;
    const shouldTrigger = options.shouldCompact
        ? await options.shouldCompact({
            messages,
            totalTokens,
            inputTokens,
            outputTokens,
            usage: currentStep.usage,
            source: "inner",
            stepNumber,
            steps,
            chatId: turnCtx?.chatId,
            turn: turnCtx?.turn,
            clientData: turnCtx?.clientData,
        })
        : totalTokens != null && options.threshold != null && totalTokens > options.threshold;
    if (!shouldTrigger) {
        return { type: "skipped" };
    }
    const result = await tracer_js_1.tracer.startActiveSpan("context compaction", async (span) => {
        const compactionId = (0, ai_runtime_js_1.generateId)();
        let summary;
        const { waitUntilComplete } = chatStream.writer({
            spanName: "stream compaction chunks",
            collapsed: true,
            execute: async ({ write, merge }) => {
                // Control chunks aren't part of UIMessageChunk's discriminated
                // union but flow on the same session.out so subscribers can
                // intercept them — cast on the way out.
                write({ type: "step-start" });
                write({
                    type: "data-compaction",
                    id: compactionId,
                    data: { status: "compacting", totalTokens },
                    transient: true,
                });
                // Generate summary
                summary = await options.summarize(messages);
                // Store state in locals for subsequent steps
                locals_js_1.locals.set(chatCompactionStateKey, {
                    summary,
                    baseResponseMessageCount: currentStep.response.messages.length,
                    baseResponseStepCount: steps.length,
                });
                // Set model-only override — UI messages stay intact for persistence.
                // The summary becomes the model message history for the next turn,
                // while accumulatedUIMessages keeps the full conversation for display.
                locals_js_1.locals.set(chatOverrideModelMessagesKey, [
                    {
                        role: "assistant",
                        content: [{ type: "text", text: `[Conversation summary]\n\n${summary}` }],
                    },
                ]);
                // Fire onCompacted hook — pass the existing writer so the callback
                // can write custom chunks without creating a separate stream.
                const onCompactedHook = locals_js_1.locals.get(chatOnCompactedKey);
                if (onCompactedHook) {
                    await onCompactedHook({
                        ctx: locals_js_1.locals.get(chatAgentRunContextKey),
                        summary,
                        messages,
                        messageCount: messages.length,
                        usage: currentStep.usage,
                        totalTokens,
                        inputTokens,
                        outputTokens,
                        stepNumber,
                        chatId: turnCtx?.chatId,
                        turn: turnCtx?.turn,
                        writer: { write, merge },
                    });
                }
                write({
                    type: "data-compaction",
                    id: compactionId,
                    data: { status: "complete", totalTokens },
                    transient: true,
                });
                write({ type: "finish-step" });
            },
        });
        await waitUntilComplete();
        // Set attributes after we have the summary
        span.setAttribute("compaction.summary_length", summary.length);
        return {
            type: "compacted",
            messages: await applyPrepareMessages([{ role: "user", content: summary }], "compaction-result"),
            summary,
        };
    }, {
        attributes: {
            [v3_1.SemanticInternalAttributes.STYLE_ICON]: "tabler-scissors",
            "compaction.threshold": options.threshold,
            "compaction.total_tokens": totalTokens ?? 0,
            "compaction.input_tokens": inputTokens ?? 0,
            "compaction.message_count": messages.length,
            "compaction.step_number": stepNumber,
            ...(turnCtx?.chatId ? { "compaction.chat_id": turnCtx.chatId } : {}),
            ...(turnCtx?.turn != null ? { "compaction.turn": turnCtx.turn } : {}),
            ...(0, v3_1.accessoryAttributes)({
                items: [
                    { text: `${totalTokens ?? 0} tokens`, variant: "normal" },
                    { text: `${messages.length} msgs`, variant: "normal" },
                ],
                style: "codepath",
            }),
        },
    });
    return result;
}
/**
 * Returns a `prepareStep` function that handles context compaction automatically.
 *
 * Monitors token usage between tool-call steps. When `totalTokens` exceeds
 * the threshold, generates a summary via `summarize()`, replaces the message
 * history, and emits `data-compaction` stream chunks for the frontend.
 *
 * @example
 * ```ts
 * return streamText({
 *   ...chat.toStreamTextOptions({ registry }),
 *   messages: chat.addCacheBreaks(messages),
 *   prepareStep: chat.compactionStep({
 *     threshold: 80_000,
 *     summarize: async (messages) => {
 *       return generateText({ model, messages: [...messages, { role: "user", content: "Summarize." }] })
 *         .then((r) => r.text);
 *     },
 *   }),
 *   tools: { ... },
 * });
 * ```
 */
function chatCompactionStep(options) {
    return async ({ messages, steps }) => {
        const result = await chatCompact(messages, steps, options);
        return result.type === "skipped" ? undefined : result;
    };
}
const EMPTY_DRAIN = { injected: [], claimed: [] };
/**
 * The model messages to record for one claimed message. Without `prepare`
 * each entry's own conversion is used. With it, `prepare` returned one list
 * for the whole batch, so the first claimed message carries all of it and the
 * rest carry none, which keeps the total exactly what the model received.
 */
function modelFormOf(m, batch, injected) {
    return batch[0] === m ? injected : [];
}
/**
 * Drain the steering queue as a batch. Calls `shouldInject` once with all
 * pending messages. If it returns true, calls `prepareMessages` once to
 * transform the batch, then clears the queue.
 * Returns the model messages to inject and the UI messages actually claimed.
 *
 * `claimed` is returned rather than only published to locals because each
 * surface files it somewhere different: `chat.agent` has an accumulator in
 * locals, while `chat.createSession` keeps its own. Publishing to locals alone
 * is silently a no-op for any surface that never set the key.
 * @internal
 */
async function drainSteeringQueue(config, messages, steps, queueOverride) {
    const queue = queueOverride ?? locals_js_1.locals.get(chatSteeringQueueKey);
    if (!queue || queue.length === 0)
        return EMPTY_DRAIN;
    const ctx = locals_js_1.locals.get(chatTurnContextKey);
    const stepNumber = steps.length - 1;
    /**
     * Snapshot, because `shouldInject` and `prepare` can await. A record arriving
     * during either is not in this batch, so it must not be consumed by it: the
     * callbacks never saw it and could not have injected it, and taking it would
     * lose a message that should become a later turn instead.
     */
    const batch = [...queue];
    const uiMessages = batch.map((e) => e.uiMessage);
    const batchEvent = {
        messages: uiMessages,
        modelMessages: messages,
        steps,
        stepNumber,
        chatId: ctx?.chatId ?? "",
        turn: ctx?.turn ?? 0,
        clientData: ctx?.clientData,
    };
    // Call shouldInject once for the whole batch
    const shouldInject = config.shouldInject ? await config.shouldInject(batchEvent) : false;
    if (!shouldInject)
        return EMPTY_DRAIN;
    const textOfUIMessage = (m) => (m.parts ?? [])
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("") || "";
    // Span attributes describe the offered batch; the chunk and callback below
    // describe what was actually claimed and injected.
    const messageTexts = uiMessages.map(textOfUIMessage);
    const _previewText = messageTexts.length === 1 ? messageTexts[0].slice(0, 80) : `${queue.length} messages`;
    return tracer_js_1.tracer.startActiveSpan("pending message injected", async () => {
        /**
         * Claim before transforming, and inject only what was claimed.
         *
         * Injection is the point of consumption: the records were only observed
         * on arrival, so they are still queued on the router and still holding
         * the resume floor, and taking them here is what stops the same message
         * also being answered as a later turn. A declined batch never reaches
         * this line, so its records stay queued and become later turns, which is
         * what "messages queue for the next turn" means.
         *
         * A failed claim means something else already consumed that record while
         * `shouldInject` was awaiting, so it is already being answered as a turn
         * of its own. Injecting it as well would process the same message twice.
         * An entry with no `seqNum` did not come from a channel record (the
         * accumulator's own queue), so there is nothing to claim and it is kept.
         */
        const router = chatInputRouter();
        const claimed = [];
        const takenRecords = [];
        for (const entry of batch) {
            if (entry.seqNum === undefined) {
                claimed.push(entry);
                continue;
            }
            const record = router.take(CHAT_ROUTE_MESSAGES, entry.seqNum);
            if (!record)
                continue;
            takenRecords.push(record);
            claimed.push(entry);
        }
        for (const entry of claimed) {
            const at = queue.indexOf(entry);
            if (at !== -1)
                queue.splice(at, 1);
        }
        if (claimed.length === 0)
            return EMPTY_DRAIN;
        /**
         * Give the claim back if the transform fails. `prepare` is caller code and
         * can throw; the records have already left the router by this point, so
         * without returning them a failed transform would consume the messages and
         * they would never be answered at all.
         */
        const releaseClaim = () => {
            for (const record of takenRecords)
                router.untake(CHAT_ROUTE_MESSAGES, record);
            for (const entry of claimed)
                if (!queue.includes(entry))
                    queue.push(entry);
        };
        const claimedUIMessages = claimed.map((e) => e.uiMessage);
        let injected;
        try {
            injected = config.prepare
                ? await config.prepare({ ...batchEvent, messages: claimedUIMessages })
                : claimed.flatMap((e) => e.modelMessages);
        }
        catch (err) {
            releaseClaim();
            throw err;
        }
        const injectedIds = locals_js_1.locals.get(chatInjectedMessageIdsKey);
        if (injectedIds) {
            for (const m of claimedUIMessages)
                injectedIds.add(m.id);
        }
        // Record them as part of the conversation.
        //
        // The model has them and the browser has them; without this the
        // accumulator does not, so they reach neither `uiMessages` nor
        // `newUIMessages` on `onTurnComplete` and an app that persists from there
        // silently loses the instruction the answer was shaped by. Appending here
        // rather than at turn end keeps them in the order they happened: after the
        // message that started the turn, before the response that answers it.
        //
        // De-duplicated by id because a step boundary can drain more than once per
        // turn, and because a message that failed to inject falls back to becoming
        // its own turn, where it is accumulated the normal way.
        const currentUIMessages = locals_js_1.locals.get(chatCurrentUIMessagesKey);
        const turnNew = locals_js_1.locals.get(chatTurnNewUIMessagesKey);
        for (const m of claimedUIMessages) {
            if (currentUIMessages && !currentUIMessages.some((existing) => existing.id === m.id)) {
                currentUIMessages.push(m);
            }
            if (turnNew && !turnNew.some((existing) => existing.id === m.id)) {
                turnNew.push(m);
            }
        }
        if (claimedUIMessages.length > 0 && currentUIMessages) {
            const pendingSteer = locals_js_1.locals.get(chatPendingSteerKey) ?? [];
            for (const m of claimedUIMessages) {
                if (!pendingSteer.some((existing) => existing.ui.id === m.id)) {
                    pendingSteer.push({ ui: m, model: modelFormOf(m, claimedUIMessages, injected) });
                }
            }
            locals_js_1.locals.set(chatPendingSteerKey, pendingSteer);
        }
        // Write injection confirmation chunk to the stream so the frontend
        // knows which messages were injected and where in the response.
        if (injected.length > 0) {
            try {
                const { waitUntilComplete } = chatStream.writer({
                    collapsed: true,
                    execute: ({ write }) => {
                        write({
                            type: ai_shared_js_1.PENDING_MESSAGE_INJECTED_TYPE,
                            id: (0, ai_runtime_js_1.generateId)(),
                            data: {
                                messageIds: claimedUIMessages.map((m) => m.id),
                                messages: claimedUIMessages.map((m) => ({
                                    id: m.id,
                                    text: textOfUIMessage(m),
                                })),
                            },
                        });
                    },
                });
                await waitUntilComplete();
            }
            catch {
                /* non-fatal — stream write failed */
            }
        }
        // Fire onInjected callback
        if (config.onInjected && injected.length > 0) {
            try {
                await config.onInjected({
                    messages: claimedUIMessages,
                    injectedModelMessages: injected,
                    chatId: ctx?.chatId ?? "",
                    turn: ctx?.turn ?? 0,
                    stepNumber,
                });
            }
            catch {
                /* non-fatal */
            }
        }
        return { injected, claimed: claimedUIMessages };
    }, {
        attributes: {
            [v3_1.SemanticInternalAttributes.STYLE_ICON]: "tabler-message-forward",
            "pending.message_count": uiMessages.length,
            "pending.step_number": stepNumber,
            "pending.messages": messageTexts,
            ...(ctx?.chatId ? { "pending.chat_id": ctx.chatId } : {}),
            ...(ctx?.turn != null ? { "pending.turn": ctx.turn } : {}),
            ...(0, v3_1.accessoryAttributes)({
                items: [
                    {
                        text: `${uiMessages.length} message${uiMessages.length === 1 ? "" : "s"}`,
                        variant: "normal",
                    },
                    { text: `between steps ${stepNumber} and ${stepNumber + 1}`, variant: "normal" },
                ],
                style: "codepath",
            }),
        },
    });
}
// ---------------------------------------------------------------------------
// chat.isCompactionSafe — check if it's safe to compact messages
// ---------------------------------------------------------------------------
/**
 * Checks whether it's safe to compact the message history. Returns `false`
 * if any tool calls are in-flight (incomplete tool invocations without results).
 *
 * Call before `chat.setMessages()` to avoid corrupting tool-call state.
 */
function isCompactionSafe(messages) {
    for (const msg of messages) {
        if (msg.role !== "assistant")
            continue;
        for (const part of msg.parts) {
            if (part.type === "tool-invocation") {
                const state = part.toolInvocation?.state ?? part.state;
                if (state !== "result" && state !== "error") {
                    return false;
                }
            }
        }
    }
    return true;
}
/** @internal */
const chatPromptKey = locals_js_1.locals.create("chat.prompt");
/**
 * @internal Provider options attached to the system message that
 * `toStreamTextOptions()` builds from the stored prompt — lets a provider cache
 * the system block. Stored separately so it works for both the `ResolvedPrompt`
 * and plain-string forms without mutating the prompt object.
 */
const chatPromptProviderOptionsKey = locals_js_1.locals.create("chat.prompt.providerOptions");
/**
 * Store a resolved prompt (or plain string) for the current run.
 * Call from any hook (`onPreload`, `onChatStart`, `onTurnStart`) or `run()`.
 */
function setChatPrompt(resolved, options) {
    if (typeof resolved === "string") {
        locals_js_1.locals.set(chatPromptKey, {
            text: resolved,
            model: undefined,
            config: undefined,
            promptId: "",
            version: 0,
            labels: [],
            toAISDKTelemetry: () => ({
                experimental_telemetry: { isEnabled: true, metadata: {} },
            }),
        });
    }
    else {
        locals_js_1.locals.set(chatPromptKey, resolved);
    }
    // Always overwrite the slot (even with undefined) so a later prompt.set with
    // no options clears a previous prompt's cache opt-in rather than leaking it.
    locals_js_1.locals.set(chatPromptProviderOptionsKey, options?.providerOptions);
}
/**
 * Read the stored prompt. Throws if `chat.prompt.set()` has not been called.
 */
function getChatPrompt() {
    const prompt = locals_js_1.locals.get(chatPromptKey);
    if (!prompt) {
        throw new Error("chat.prompt() called before chat.prompt.set(). Set a prompt in onPreload, onChatStart, onTurnStart, or run() first.");
    }
    return prompt;
}
// ---------------------------------------------------------------------------
// chat.skills — store resolved agent skills and inject them into streamText
// ---------------------------------------------------------------------------
/** @internal */
const chatSkillsKey = locals_js_1.locals.create("chat.skills");
/**
 * Store resolved skills for the current run. Call from any hook
 * (`onPreload`, `onChatStart`, `onTurnStart`) or `run()`.
 */
function setChatSkills(skills) {
    locals_js_1.locals.set(chatSkillsKey, skills);
}
/** Read the stored skills. Returns `undefined` if none set. */
function getChatSkills() {
    return locals_js_1.locals.get(chatSkillsKey);
}
/**
 * Build the system-prompt preamble advertising available skills. Only the
 * frontmatter description surfaces here — full SKILL.md body is loaded
 * on-demand via the `loadSkill` tool.
 */
function buildSkillsSystemPrompt(skills) {
    if (skills.length === 0)
        return "";
    const lines = skills.map((s) => `- ${s.frontmatter.name}: ${s.frontmatter.description}`);
    return [
        "Available skills (call `loadSkill` to read the full instructions before using one):",
        ...lines,
    ].join("\n");
}
/** Resolve a skill by its frontmatter `name`. */
function findSkillByName(skills, name) {
    return skills.find((s) => s.frontmatter.name === name);
}
/**
 * Build the three tools we auto-inject into `streamText` when skills are
 * set: `loadSkill`, `readFile`, `bash`. Scoped per-skill by name.
 *
 * Exported so callers can use the same tools outside the auto-wired path
 * (e.g. in a `chat.createSession` loop with custom streamText).
 */
function buildSkillTools(skills) {
    const loadSkill = (0, ai_runtime_js_1.tool)({
        description: "Load the full instructions for a skill by its name. Call this first before using a skill.",
        inputSchema: (0, ai_runtime_js_1.jsonSchema)({
            type: "object",
            properties: {
                name: {
                    type: "string",
                    description: "The `name` field from the skill's frontmatter.",
                },
            },
            required: ["name"],
            additionalProperties: false,
        }),
        execute: async ({ name }) => {
            const skill = findSkillByName(skills, name);
            if (!skill) {
                return {
                    error: `Skill "${name}" not found. Available: ${skills
                        .map((s) => s.frontmatter.name)
                        .join(", ")}`,
                };
            }
            return {
                name: skill.frontmatter.name,
                description: skill.frontmatter.description,
                body: skill.body,
                path: skill.path,
            };
        },
    });
    const readFile = (0, ai_runtime_js_1.tool)({
        description: "Read a file from a skill's bundled folder. Paths must be relative to the skill's root.",
        inputSchema: (0, ai_runtime_js_1.jsonSchema)({
            type: "object",
            properties: {
                skill: { type: "string", description: "The skill's name (from frontmatter)." },
                path: {
                    type: "string",
                    description: "Relative path inside the skill folder (e.g. `references/citation-style.md`).",
                },
            },
            required: ["skill", "path"],
            additionalProperties: false,
        }),
        execute: async ({ skill: skillName, path: relPath }) => {
            const skill = findSkillByName(skills, skillName);
            if (!skill) {
                return { error: `Skill "${skillName}" not found.` };
            }
            try {
                return await (0, agentSkillsRuntime_js_1.readFileInSkill)({
                    skillPath: skill.path,
                    relativePath: relPath,
                });
            }
            catch (err) {
                return { error: err.message };
            }
        },
    });
    const bash = (0, ai_runtime_js_1.tool)({
        description: "Run a bash command inside a skill's bundled folder. Use this to invoke the skill's scripts. The working directory is the skill's root.",
        inputSchema: (0, ai_runtime_js_1.jsonSchema)({
            type: "object",
            properties: {
                skill: { type: "string", description: "The skill's name (from frontmatter)." },
                command: {
                    type: "string",
                    description: "Bash command to run. Relative script paths resolve against the skill's root.",
                },
            },
            required: ["skill", "command"],
            additionalProperties: false,
        }),
        execute: async ({ skill: skillName, command }, { abortSignal } = {}) => {
            const skill = findSkillByName(skills, skillName);
            if (!skill) {
                return { error: `Skill "${skillName}" not found.` };
            }
            try {
                return await (0, agentSkillsRuntime_js_1.runBashInSkill)({
                    skillPath: skill.path,
                    command,
                    abortSignal,
                });
            }
            catch (err) {
                return { error: err.message };
            }
        },
    });
    return { loadSkill, readFile, bash };
}
/**
 * A `streamText` with the agent's managed options already applied.
 *
 * Handed to `run()` so the managed state cannot be missed by omission. Spreading
 * `chat.toStreamTextOptions()` is still supported and equivalent; this exists
 * because forgetting the spread silently drops the managed prompt, the skill
 * tools, telemetry, and the `prepareStep` that delivers steering, compaction and
 * conversational injection.
 *
 * Caller options win for everything the caller owns (model, messages, signal,
 * stopWhen). The three that would otherwise clobber managed behaviour are
 * merged instead of replaced:
 *
 * - `tools` are passed into the helper, so skill tools survive.
 * - `prepareStep` is composed after the managed one, so a caller's per-step
 *   overrides apply on top of steering and compaction instead of disabling them.
 *
 * `system` may be set at the call site, on `chat.agent({ system })`, or
 * through `chat.prompt.set()`, but only in one of them. Setting it in two
 * places throws: no shape merges two system values on every supported
 * version, and dropping one silently is the failure this seam exists to
 * prevent. Injected instructions append to whichever one is in play.
 */
/**
 * The agent-level managed options (`registry`, `system`, `cacheControl`,
 * `systemProviderOptions`), published for the run so that
 * `chat.toStreamTextOptions()` applies them too. Without this only the bound
 * `streamText` saw them, and the documented spread form silently ran without
 * the agent's system prompt or model.
 */
const chatAgentManagedConfigKey = locals_js_1.locals.create("chat.agentManagedConfig");
/**
 * The caller's `streamText` options merged with the agent's managed ones.
 *
 * Pure, and separate from the call so it can be asserted directly: everything
 * the caller did not name has to survive the merge, and the way to be sure of
 * that is to look at the merged object rather than at what the model received.
 */
function buildManagedStreamTextOptions(options, config) {
    const { registry, system: agentSystem, cacheControl, systemProviderOptions, tools: agentTools, } = config;
    /**
     * Only the three keys that collide are intercepted. Everything else, telemetry
     * included, stays in `rest` and reaches `streamText` untouched, with the
     * caller's value winning because `rest` is spread after `managed`. Pulling a
     * key out to "handle" it is how a caller's option gets silently dropped.
     */
    const { tools, system: callerSystem, prepareStep: callerPrepareStep, ...rest } = options;
    const managed = toStreamTextOptions({
        registry,
        system: callerSystem ?? agentSystem,
        cacheControl,
        systemProviderOptions,
        /**
         * A call site that names `tools` replaces the agent's set rather than
         * adding to it, so narrowing the tools for one call still works. Omitting
         * `tools` falls back to the agent's, which is what an `onAction`
         * regenerate needs: without it a regenerated answer can call nothing.
         */
        tools: (tools ?? agentTools),
    });
    const promptSystem = locals_js_1.locals.get(chatPromptKey)?.text;
    /**
     * Two managed sources conflict too, not only a caller against a managed one.
     * `toStreamTextOptions` resolves `prompt?.text || agentSystem`, so the prompt
     * would win and `chat.agent({ system })` would go nowhere.
     */
    if (promptSystem && agentSystem) {
        throw new Error("chat.agent: `system` is set both on chat.agent({ system }) and by chat.prompt.set(), and only one " +
            "of them can apply. The prompt would win and the agent's `system` would go nowhere. Keep it in one " +
            "place, and add per-turn context with chat.inject({ role: 'system' }).");
    }
    const managedSystem = promptSystem || agentSystem;
    if (callerSystem !== undefined && managedSystem) {
        throw new Error("chat.agent: `system` is already set " +
            (promptSystem ? "by chat.prompt.set()" : "on chat.agent({ system })") +
            ", so it cannot also be passed to the `streamText` given to run(). Set it in one place, and add " +
            "per-turn context with chat.inject({ role: 'system' }) rather than a second system value.");
    }
    const managedPrepareStep = managed.prepareStep;
    if (typeof callerPrepareStep === "function") {
        managed.prepareStep = async (arg) => {
            const first = managedPrepareStep ? await managedPrepareStep(arg) : undefined;
            const second = await callerPrepareStep({ ...arg, ...(first ?? {}) });
            return { ...(first ?? {}), ...(second ?? {}) };
        };
    }
    return { ...managed, ...rest };
}
/** @internal Test hook for {@link buildManagedStreamTextOptions}. */
exports.__buildManagedStreamTextOptionsForTests = buildManagedStreamTextOptions;
function createBoundStreamText(registry, agentSystem, agentCacheControl, agentSystemProviderOptions) {
    const bound = (options = {}) => (0, ai_runtime_js_1.streamText)(buildManagedStreamTextOptions(options, {
        registry,
        system: agentSystem,
        cacheControl: agentCacheControl,
        systemProviderOptions: agentSystemProviderOptions,
        /** Read per call, so per-turn tools resolved after binding are included. */
        tools: locals_js_1.locals.get(chatResolvedToolsKey),
    }));
    return bound;
}
function toStreamTextOptions(options) {
    const agentDefaults = locals_js_1.locals.get(chatAgentManagedConfigKey);
    if (agentDefaults) {
        options = {
            registry: agentDefaults.registry,
            system: agentDefaults.system,
            cacheControl: agentDefaults.cacheControl,
            systemProviderOptions: agentDefaults.systemProviderOptions,
            ...options,
        };
    }
    const prompt = locals_js_1.locals.get(chatPromptKey);
    const skills = locals_js_1.locals.get(chatSkillsKey);
    const result = {};
    // Build the combined system prompt: stored prompt + skills preamble.
    const baseSystem = options?.system;
    const baseSystemText = typeof baseSystem === "string"
        ? baseSystem
        : typeof baseSystem?.content === "string"
            ? baseSystem.content
            : "";
    const promptText = prompt?.text || baseSystemText;
    const skillsText = skills && skills.length > 0 ? buildSkillsSystemPrompt(skills) : "";
    if (promptText || skillsText) {
        const systemText = [promptText, skillsText].filter(Boolean).join("\n\n");
        /**
         * Resolve system-prompt provider options for caching. Precedence, most
         * specific first and no deep merge: explicit `systemProviderOptions`, the
         * `cacheControl` sugar, the ones carried on a structured `system` message,
         * then whatever `chat.prompt.set()` stored.
         *
         * A structured `system` counts only when its own text is the one being
         * sent. When `chat.prompt.set()` supplied the text, its provider options
         * are the ones that describe it.
         */
        const baseSystemProviderOptions = !prompt?.text && baseSystem && typeof baseSystem !== "string"
            ? baseSystem.providerOptions
            : undefined;
        const systemProviderOptions = options?.systemProviderOptions ??
            (options?.cacheControl
                ? { anthropic: { cacheControl: options.cacheControl } }
                : undefined) ??
            baseSystemProviderOptions ??
            locals_js_1.locals.get(chatPromptProviderOptionsKey);
        // A bare string stays a bare string (the unchanged default). With provider
        // options, emit a structured `SystemModelMessage` so the provider can cache
        // the system block — `streamText`'s `system` accepts string | message.
        result.system = systemProviderOptions
            ? { role: "system", content: systemText, providerOptions: systemProviderOptions }
            : systemText;
    }
    /**
     * Append anything injected as system context, in whichever shape the installed
     * AI SDK accepts.
     *
     * `system` widened over time: on ai@5 it is `string` only, and from ai@6 it is
     * `string | SystemModelMessage | Array<SystemModelMessage>`. This package's peer
     * range still spans all three, so emitting an array unconditionally would break
     * v5 consumers — for whom a system-role injection used to work, since v5 accepted
     * a system message inside `messages` that v7 rejects.
     *
     * So: concatenate into one string when the base is a plain string, which every
     * version accepts and which loses nothing (separate blocks only matter for
     * per-block `providerOptions`). Use the array form only when the base is already
     * a structured message — that path requires v6+ regardless, because it is how
     * prompt caching marks the system block, and flattening it would silently throw
     * the cache away.
     *
     * Either way the injected text goes last: the base prompt keeps its position for
     * caching, and the addition reads as a later amendment. A changed prefix does
     * cost the first call its cache hit, on turns that actually injected.
     */
    /**
     * Consumed once per turn, not once per read, and moved out of the lane rather
     * than marked read in place.
     *
     * Per turn, because a `run()` that builds options twice (a cheap classifier
     * pass and then the answer) has to see the injection in both, and draining on
     * read hands it to whichever call ran first. Moved out, because blocks left in
     * the lane sit in front of anything injected during the same turn, and
     * clearing the lane on the next turn then destroys both. Outside a turn there
     * is no turn to scope the stash to, so the lane drains on read there.
     */
    const injectedInstructions = locals_js_1.locals.get(chatInjectedInstructionsKey);
    const currentTurn = locals_js_1.locals.get(chatTurnContextKey)?.turn;
    const consumedThisTurn = currentTurn === undefined ? undefined : locals_js_1.locals.get(chatInstructionsConsumedKey);
    let injectedBlocks = [];
    if (consumedThisTurn && consumedThisTurn.turn === currentTurn) {
        injectedBlocks = consumedThisTurn.blocks;
        // Anything injected since the stash was taken joins it, so an instruction
        // added after an action read the lane still reaches the real turn that
        // shares the action's turn number, rather than the one after.
        if (injectedInstructions && injectedInstructions.length > 0) {
            injectedBlocks.push(...injectedInstructions.splice(0));
        }
    }
    else if (injectedInstructions && injectedInstructions.length > 0) {
        injectedBlocks = injectedInstructions.splice(0);
        if (currentTurn !== undefined) {
            locals_js_1.locals.set(chatInstructionsConsumedKey, { turn: currentTurn, blocks: injectedBlocks });
        }
    }
    if (injectedBlocks.length > 0) {
        const blocks = injectedBlocks;
        const injectedText = blocks
            .map((block) => (typeof block.content === "string" ? block.content : ""))
            .filter(Boolean)
            .join("\n\n");
        const base = result.system;
        if (base === undefined) {
            result.system = injectedText;
        }
        else if (typeof base === "string") {
            result.system = [base, injectedText].filter(Boolean).join("\n\n");
        }
        else {
            // Merged into the existing block rather than added as a second one. An array
            // of system blocks would keep the base block's cache entry, but ai@5 rejects
            // it outright ("Invalid prompt: system must be a string") while accepting a
            // single structured block, and this package's peer range still spans v5.
            // Choosing per version would mean resolving the installed version at runtime,
            // which is not something to build on: `import.meta.url` is illegal in this
            // package's CommonJS output, and a bundled task may have no resolvable `ai`
            // to read. One shape that works everywhere beats a cache hit.
            const baseBlock = base;
            result.system = {
                ...baseBlock,
                content: [typeof baseBlock.content === "string" ? baseBlock.content : "", injectedText]
                    .filter(Boolean)
                    .join("\n\n"),
            };
        }
    }
    // Prompt-related options (only if chat.prompt.set() was called)
    if (prompt) {
        // Resolve model via registry if both are present
        if (options?.registry && prompt.model) {
            result.model = options.registry.languageModel(prompt.model);
        }
        // Spread config (temperature, maxTokens, etc.)
        if (prompt.config) {
            Object.assign(result, prompt.config);
        }
        // Add telemetry (forward additional metadata from caller)
        const telemetry = prompt.toAISDKTelemetry(options?.telemetry);
        Object.assign(result, telemetry);
    }
    // Skills: merge auto-injected tools with any user-provided tools.
    // User tools override on name conflict (though we namespace ours).
    if (skills && skills.length > 0) {
        const skillTools = buildSkillTools(skills);
        result.tools = { ...skillTools, ...(options?.tools ?? {}) };
    }
    else if (options?.tools) {
        result.tools = options.tools;
    }
    // Auto-inject prepareStep for compaction, pending messages, and background context injection.
    // This runs regardless of whether a prompt is set — these features are independent.
    const taskCompaction = locals_js_1.locals.get(chatAgentCompactionKey);
    const taskPendingMessages = locals_js_1.locals.get(chatPendingMessagesKey);
    {
        result.prepareStep = async ({ messages, steps, }) => {
            let resultMessages;
            // 1. Compaction
            if (taskCompaction) {
                const compactResult = await chatCompact(messages, steps, {
                    shouldCompact: taskCompaction.shouldCompact,
                    summarize: (msgs) => {
                        const ctx = locals_js_1.locals.get(chatTurnContextKey);
                        const lastStep = steps.at(-1);
                        return taskCompaction.summarize({
                            messages: msgs,
                            usage: lastStep?.usage,
                            source: "inner",
                            stepNumber: steps.length - 1,
                            chatId: ctx?.chatId,
                            turn: ctx?.turn,
                            clientData: ctx?.clientData,
                        });
                    },
                });
                if (compactResult.type !== "skipped") {
                    resultMessages = compactResult.messages;
                }
            }
            // 2. Pending message injection (steering)
            if (taskPendingMessages) {
                const { injected } = await drainSteeringQueue(taskPendingMessages, resultMessages ?? messages, steps);
                if (injected.length > 0) {
                    resultMessages = [...(resultMessages ?? messages), ...injected];
                }
            }
            // 3. Background context injection
            const bgQueue = locals_js_1.locals.get(chatBackgroundQueueKey);
            if (bgQueue && bgQueue.length > 0) {
                const injected = bgQueue.splice(0); // drain
                resultMessages = [...(resultMessages ?? messages), ...injected];
                const pendingBackground = locals_js_1.locals.get(chatPendingBackgroundKey) ?? [];
                pendingBackground.push({
                    afterId: locals_js_1.locals.get(chatCurrentUIMessagesKey)?.at(-1)?.id ?? "",
                    messages: injected,
                });
                locals_js_1.locals.set(chatPendingBackgroundKey, pendingBackground);
            }
            return resultMessages ? { messages: resultMessages } : undefined;
        };
    }
    return result;
}
const actionTurnBrand = Symbol.for("trigger.dev/chat/actionTurn");
/**
 * Turn the current action into a turn.
 *
 * Return it from `onAction` after editing history. The action's own work is
 * finished first (the edit is applied and snapshotted), then a turn runs on the
 * result exactly as a message turn does: `onTurnStart`, `run()` with the edited
 * history, `onBeforeTurnComplete`, `onTurnComplete`, and the turn counter
 * advances. That gives the answer everything a turn has, the system prompt,
 * tools, steering, compaction, injected instructions and persistence, with no
 * action-specific handling.
 *
 * @example
 * ```ts
 * onAction: async ({ action }) => {
 *   if (action.type === "regenerate") {
 *     chat.history.slice(0, -1);
 *     return chat.turn();
 *   }
 *   if (action.type === "undo") chat.history.slice(0, -2); // no turn
 * },
 * ```
 */
function chatTurn() {
    return { [actionTurnBrand]: true };
}
function isActionTurn(value) {
    return typeof value === "object" && value !== null && value[actionTurnBrand] === true;
}
/**
 * Replace, in a model lane, the run of messages one UI message contributed.
 *
 * Used when a UI message is replaced in place (a tool-approval continuation
 * merging onto the trailing assistant, a captured response reusing an existing
 * id, a partial replacing an existing message). Reconverting the whole lane
 * from the UI lane would also replace a compaction summary with the full
 * transcript and drop the model forms `pendingMessages.prepare` produced.
 *
 * The replaced message is the trailing one, so its run is the lane's tail,
 * before any steer forms appended after it this turn (`tailAfter`). If the
 * tail does not match the old message's conversion, nothing is changed and
 * `false` is returned so the caller can fall back to a full reconversion.
 */
async function replaceModelRun(lane, oldUi, newUi, tailAfter, knownOldRun) {
    const oldRun = knownOldRun ?? (await toModelMessages([stripProviderMetadata(oldUi)]));
    const newRun = await toModelMessages([stripProviderMetadata(newUi)]);
    // A message that converts to nothing (a pending tool call with no output yet,
    // which `ignoreIncompleteToolCalls` drops) locates no run in the lane. Matching
    // an empty slice would splice the new run in without removing what the message
    // actually contributed, such as a spliced head-start partial, and the lane would
    // then carry the same tool call twice.
    if (oldRun.length === 0)
        return false;
    const end = lane.length - tailAfter;
    const start = end - oldRun.length;
    if (start < 0 || end > lane.length)
        return false;
    if (JSON.stringify(lane.slice(start, end)) !== JSON.stringify(oldRun))
        return false;
    lane.splice(start, oldRun.length, ...newRun);
    return true;
}
function isUIMessageStreamable(value) {
    return (typeof value === "object" &&
        value !== null &&
        "toUIMessageStream" in value &&
        typeof value.toUIMessageStream === "function");
}
const warnedHydrateMessagesDeprecated = new Set();
function warnHydrateMessagesDeprecatedOnce(agentId) {
    if (warnedHydrateMessagesDeprecated.has(agentId))
        return;
    warnedHydrateMessagesDeprecated.add(agentId);
    console.warn(`[chat.agent] \`hydrateMessages\` on "${agentId}" is deprecated. Give the agent a transcript ` +
        "storage instead: `save` receives every change to the conversation and `loadContext` " +
        "lets the application own the model's context, with crash recovery and durable " +
        "compaction that `hydrateMessages` never had.");
}
let warnedMissingOnAction = false;
function warnMissingOnActionOnce() {
    if (warnedMissingOnAction)
        return;
    warnedMissingOnAction = true;
    console.warn("[chat.agent] Received an action but no `onAction` handler is configured. " +
        "The action is being ignored. Define `onAction` (and optionally `actionSchema`) on " +
        "your agent to handle it.");
}
function isAsyncIterable(value) {
    return typeof value === "object" && value !== null && Symbol.asyncIterator in value;
}
function isReadableStream(value) {
    return (typeof value === "object" && value !== null && typeof value.getReader === "function");
}
/**
 * Pipes a chat stream to the realtime stream, making it available to the
 * `TriggerChatTransport` on the frontend.
 *
 * Accepts:
 * - A `StreamTextResult` from `streamText()` (has `.toUIMessageStream()`)
 * - An `AsyncIterable` of `UIMessageChunk`s
 * - A `ReadableStream` of `UIMessageChunk`s
 *
 * Must be called from inside a Trigger.dev task's `run` function.
 *
 * @example
 * ```ts
 * import { task } from "@trigger.dev/sdk";
 * import { chat, type ChatTaskPayload } from "@trigger.dev/sdk/ai";
 * import { streamText, convertToModelMessages } from "ai";
 *
 * export const myChatTask = task({
 *   id: "my-chat-task",
 *   run: async (payload: ChatTaskPayload) => {
 *     const result = streamText({
 *       model: openai("gpt-4o"),
 *       messages: payload.messages,
 *     });
 *
 *     await chat.pipe(result);
 *   },
 * });
 * ```
 *
 * @example
 * ```ts
 * // Works from anywhere inside a task — even deep in your agent code
 * async function runAgentLoop(messages: CoreMessage[]) {
 *   const result = streamText({ model, messages });
 *   await chat.pipe(result);
 * }
 * ```
 */
async function pipeChat(source, options) {
    locals_js_1.locals.set(chatPipeCountKey, (locals_js_1.locals.get(chatPipeCountKey) ?? 0) + 1);
    let stream;
    if (isUIMessageStreamable(source)) {
        stream = source.toUIMessageStream();
    }
    else if (isAsyncIterable(source) || isReadableStream(source)) {
        stream = source;
    }
    else {
        throw new Error("pipeChat: source must be a StreamTextResult (with .toUIMessageStream()), " +
            "an AsyncIterable, or a ReadableStream");
    }
    const pipeOptions = {};
    if (options?.signal) {
        pipeOptions.signal = options.signal;
    }
    if (options?.spanName) {
        pipeOptions.spanName = options.spanName;
    }
    // `options.target` / `options.streamKey` are accepted for API parity
    // with the pre-migration run-scoped pipe but no longer have meaning —
    // sessions are the address (single stream per session, no sub-run
    // targeting). Sub-agents that need to write into a parent's chat now
    // open that session explicitly via `sessions.open(parentSessionId).out.pipe`.
    // The generic is typed for `UIMessageChunk`, but `pipeChat` also
    // accepts opaque UIMessageStreamable / raw iterables whose element
    // type we don't know at compile time. Cast — runtime behaviour is
    // identical (bytes go to session.out either way).
    const { waitUntilComplete } = chatStream.pipe(stream, pipeOptions);
    await waitUntilComplete();
}
function chatCustomAgent(options) {
    const { clientDataSchema, onClientDataValidationError, clientDataReportErrorAt, run: userRun, ...restOptions } = options;
    const parseClientData = clientDataSchema ? (0, v3_1.getSchemaParseFn)(clientDataSchema) : undefined;
    const parseClientDataSync = clientDataSchema
        ? getChatCustomAgentSyncSchemaParseFn(clientDataSchema)
        : undefined;
    const task = (0, shared_js_1.createTask)({
        ...restOptions,
        triggerSource: "agent",
        agentConfig: { type: "ai-sdk-chat" },
        run: async (payload, runOptions) => {
            // Bind the run to its backing Session so module-level helpers
            // (chat.messages, chat.stream, chat.createStopSignal, chat.createSession)
            // resolve to this chat's `.in` / `.out` channels. Address
            // everywhere by `payload.chatId` (the session externalId) so the
            // agent's writes and the transport's reads converge on the same
            // S2 stream key + waitpoint key.
            //
            // The Session row is created server-side by `POST /sessions` (or
            // `chat.createStartSessionAction`) before this run is triggered.
            // No client-side upsert needed.
            locals_js_1.locals.set(chatSessionHandleKey, sessions_js_1.sessions.open(payload.chatId));
            locals_js_1.locals.set(chatExternalIdKey, payload.chatId);
            locals_js_1.locals.set(chatAgentRunContextKey, runOptions.ctx);
            locals_js_1.locals.set(chatCustomAgentRunKey, true);
            if (parseClientData && parseClientDataSync) {
                locals_js_1.locals.set(chatCustomAgentClientDataParserKey, {
                    parse: parseClientData,
                    parseSync: parseClientDataSync,
                });
            }
            if (onClientDataValidationError) {
                locals_js_1.locals.set(chatCustomAgentClientDataErrorHandlerKey, onClientDataValidationError);
            }
            locals_js_1.locals.set(chatCustomAgentClientDataErrorTimingKey, clientDataReportErrorAt ?? "turn-end");
            // Initialize the turn-complete trim slot so `chat.writeTurnComplete`
            // trims `session.out` back to the previous turn boundary. Without
            // this the slot is undefined and the trim never runs, so `.out`
            // grows without bound for the whole custom-agent surface.
            locals_js_1.locals.set(lastTurnCompleteSeqNumKey, { value: undefined });
            (0, streams_js_1.markChatAgentRunForStreamsWarning)();
            v3_1.taskContext.setConversationId(payload.chatId);
            stampConversationIdOnActiveSpan(payload.chatId);
            await installChatInputRouter(payload.chatId, {
                resuming: Boolean(payload.continuation),
            });
            // A custom agent's loop is the customer's, so there is no exit site the
            // SDK controls. Perform a requested close when `run()` returns, whatever
            // shape the loop had. Idempotent, so the createSession iterator having
            // already closed on its own exit costs nothing.
            const withClose = async (result) => {
                try {
                    return await result;
                }
                finally {
                    await performChatClose();
                }
            };
            // Keep the schema-free path identical to the original custom-agent
            // wrapper, including when userRun starts executing.
            if (!parseClientData) {
                return withClose(userRun(payload, runOptions));
            }
            const isHandoverBoot = payload.trigger === "handover-prepare";
            const isMessagelessBoot = payload.trigger === "preload" ||
                (payload.continuation === true &&
                    payload.message === undefined &&
                    payload.trigger !== "action" &&
                    payload.trigger !== "regenerate-message" &&
                    !isHandoverBoot);
            const validated = await validateChatCustomAgentPayload(payload, {
                // Preload and continuation boots do not represent a submitted turn,
                // so there is no sender waiting for a terminal frame. Handover errors
                // must be written after the warm response flushes and signals below.
                writeErrorToStream: !isMessagelessBoot && !isHandoverBoot,
            });
            if (validated.ok) {
                return withClose(userRun(validated.payload, runOptions));
            }
            if (isHandoverBoot) {
                const signal = await waitForHandover({
                    payload,
                    timeout: "1h",
                    spanName: "waiting for handover signal (invalid clientData)",
                });
                if (!signal || signal.kind === "handover-skip") {
                    return;
                }
                // The head-start writer flushes before sending this signal. Writing
                // the terminal error now preserves stream order and closes the stitch.
                await writeChatCustomAgentClientDataErrorToStream(payload);
                return;
            }
            // The Session base payload is sticky across continuation runs. If it is
            // invalid, returning here would boot the same bad metadata again on the
            // next message. Stay attached and wait for a valid wire frame instead.
            const next = await messagesInput.waitWithIdleTimeout({
                idleTimeoutInSeconds: payload.idleTimeoutInSeconds ?? 30,
                timeout: "1h",
                spanName: "waiting for valid clientData",
            });
            if (!next.ok || next.output.trigger === "close") {
                return;
            }
            // Normal input frames omit run-level boot context. Carry it forward so
            // a continuation still tells the custom loop to restore prior state.
            const recoveredPayload = {
                ...next.output,
                continuation: next.output.continuation ?? payload.continuation,
                previousRunId: next.output.previousRunId ?? payload.previousRunId,
                sessionId: next.output.sessionId ?? payload.sessionId,
                idleTimeoutInSeconds: next.output.idleTimeoutInSeconds ?? payload.idleTimeoutInSeconds,
            };
            return withClose(userRun(recoveredPayload, runOptions));
        },
    });
    // Register clientDataSchema so the CLI converts it to JSONSchema
    // and stores it as payloadSchema — used by the Playground UI
    if (clientDataSchema) {
        v3_1.resourceCatalog.updateTaskMetadata(options.id, {
            schema: clientDataSchema,
        });
    }
    return task;
}
function chatAgent(options) {
    const { run: userRun, clientDataSchema, onBoot, onRecoveryBoot, onPreload, onChatStart, onValidateMessages, hydrateMessages, storage, actionSchema, onAction, onTurnStart, onBeforeTurnComplete, onCompacted, compaction, pendingMessages: pendingMessagesConfig, prepareMessages, tools: toolsOption, onTurnComplete, maxTurns = 100, turnTimeout = "1h", idleTimeoutInSeconds = 30, chatAccessTokenTTL = "1h", preloadIdleTimeoutInSeconds, preloadTimeout, uiMessageStreamOptions, onChatSuspend, onChatResume, exitAfterPreloadIdle = false, oomMachine, registry: promptRegistry, system: agentSystem, cacheControl: agentCacheControl, systemProviderOptions: agentSystemProviderOptions, versionSkew, ...restOptions } = options;
    if (hydrateMessages) {
        if (storage) {
            throw new Error(`chat.agent: "${options.id}" sets both \`hydrateMessages\` and \`storage\`. ` +
                "`hydrateMessages` is deprecated and replaced by the storage: `save` receives every " +
                "change and `loadContext` on the storage owns the model's context. Remove `hydrateMessages`.");
        }
        if (typeof (transcriptStorageOverride ?? transcriptStorage_js_1.defaultStorage).loadContext === "function") {
            throw new Error(`chat.agent: "${options.id}" sets \`hydrateMessages\` and uses a transcript storage with ` +
                "`loadContext`. Both would own the model's context; keep one.");
        }
        warnHydrateMessagesDeprecatedOnce(options.id);
    }
    const parseClientData = clientDataSchema ? (0, v3_1.getSchemaParseFn)(clientDataSchema) : undefined;
    const parseAction = actionSchema ? (0, v3_1.getSchemaParseFn)(actionSchema) : undefined;
    // chat.agent does not expose generic retry options (see docstring on
    // `oomMachine`). The only opt-in is an OOM-triggered machine swap. If
    // `oomMachine` is set we allow one retry on a larger machine; otherwise
    // we keep the historical no-retry default.
    const retry = oomMachine
        ? { maxAttempts: 2, outOfMemory: { machine: oomMachine } }
        : { maxAttempts: 1 };
    const task = (0, shared_js_1.createTask)({
        ...restOptions,
        retry,
        triggerSource: "agent",
        agentConfig: { type: "ai-sdk-chat" },
        run: async (payload, { signal: runSignal, ctx }) => {
            locals_js_1.locals.set(chatAgentRunContextKey, ctx);
            locals_js_1.locals.set(chatCustomAgentRunKey, false);
            // On AI SDK 7, register the `@ai-sdk/otel` integration (once per process)
            // so `experimental_telemetry` spans flow into the run trace. Awaited here
            // at run boot — before any `streamText` — and a no-op on v5/v6 or when the
            // optional `@ai-sdk/otel` peer isn't installed. See ./aiAutoTelemetry.ts.
            await (0, aiAutoTelemetry_js_1.ensureAiSdkTelemetry)();
            // Bind the run to its backing Session so every module-level helper
            // (chat.stream, chat.messages, chat.stopSignal) resolves to this
            // chat's `.in` / `.out` channels.
            //
            // Address everywhere by `payload.chatId` (the session externalId):
            // matches what the transport puts in URL paths and waitpoint keys,
            // and what the server-side trigger flow uses as the session
            // identity. The Session row is created by `POST /sessions` (via
            // `chat.createStartSessionAction` or browser-direct) before this
            // run is triggered — no client-side upsert needed here.
            locals_js_1.locals.set(chatSessionHandleKey, sessions_js_1.sessions.open(payload.chatId));
            locals_js_1.locals.set(chatExternalIdKey, payload.chatId);
            // Mutable holder; advances in `writeTurnCompleteChunk` after each turn
            // and is the trim target for the NEXT turn's trim record.
            locals_js_1.locals.set(lastTurnCompleteSeqNumKey, { value: undefined });
            (0, streams_js_1.markChatAgentRunForStreamsWarning)();
            v3_1.taskContext.setConversationId(payload.chatId);
            // Stamp `gen_ai.conversation.id` on the run-level span. Every
            // nested span inherits the same attribute via
            // `TaskContextSpanProcessor.onStart`.
            const activeSpan = api_1.trace.getActiveSpan();
            stampConversationIdOnActiveSpan(payload.chatId, activeSpan);
            // Store static UIMessageStream options in locals so resolveUIMessageStreamOptions() can read them
            if (uiMessageStreamOptions) {
                locals_js_1.locals.set(chatUIStreamStaticKey, uiMessageStreamOptions);
            }
            // Store onCompacted hook in locals so chat.compact() can call it
            if (onCompacted) {
                locals_js_1.locals.set(chatOnCompactedKey, onCompacted);
            }
            if (prepareMessages) {
                locals_js_1.locals.set(chatPrepareMessagesKey, prepareMessages);
            }
            if (toolsOption) {
                // Cast: the option's function form is typed against the parsed
                // `clientData` (`ResolveToolsEvent<inferSchemaOut<...>>`), but the
                // locals key uses the erased `ResolveToolsEvent<unknown>`. The runtime
                // value is identical; this mirrors how `prepareMessages` is stored.
                locals_js_1.locals.set(chatToolsOptionKey, toolsOption);
                // Static tools are usable immediately. The function form is resolved
                // just before the boot history conversion (with the payload's
                // clientData) and again per-turn (see resolveTurnTools).
                if (typeof toolsOption !== "function") {
                    locals_js_1.locals.set(chatResolvedToolsKey, toolsOption);
                }
            }
            if (compaction) {
                locals_js_1.locals.set(chatAgentCompactionKey, compaction);
            }
            if (pendingMessagesConfig) {
                locals_js_1.locals.set(chatPendingMessagesKey, pendingMessagesConfig);
            }
            let currentWirePayload = payload;
            const continuation = payload.continuation ?? false;
            const previousRunId = payload.previousRunId;
            const preloaded = payload.trigger === "preload";
            // Accumulated model messages across turns. Seeded at boot from a
            // durable snapshot + `session.out` replay (or `hydrateMessages` if
            // registered) — the wire is delta-only now, no longer a seed.
            let accumulatedMessages = [];
            /**
             * Give the model accumulator the background injections a step-boundary
             * drain handed to the model this turn, and record them for persistence.
             * Returns how many model messages were appended.
             */
            const reconcilePendingBackground = () => {
                const pending = locals_js_1.locals.get(chatPendingBackgroundKey);
                if (!pending || pending.length === 0)
                    return 0;
                locals_js_1.locals.set(chatPendingBackgroundKey, []);
                let appended = 0;
                for (const entry of pending) {
                    accumulatedMessages.push(...entry.messages);
                    laneInjections.push(entry);
                    appended += entry.messages.length;
                }
                return appended;
            };
            /**
             * Give the model accumulator the steering messages a drain consumed,
             * in the form the model actually received. Appended, never reconverted
             * from the UI lane, so a model-only compaction summary survives. Called
             * on both the success and the error path, before the response or the
             * partial joins the lane, so the order stays steer-then-answer.
             */
            const reconcilePendingSteer = (options) => {
                const pending = locals_js_1.locals.get(chatPendingSteerKey);
                if (!pending || pending.length === 0)
                    return [];
                locals_js_1.locals.set(chatPendingSteerKey, []);
                for (const entry of pending) {
                    accumulatedMessages.push(...entry.model);
                    options?.turnNew?.push(...entry.model);
                }
                return pending;
            };
            // Accumulated UI messages for persistence. Mirrors the model accumulator
            // but in frontend-friendly UIMessage format (with parts, id, etc.).
            let accumulatedUIMessages = [];
            // ── Snapshot + replay (gated on prior-state signals) ─────────────
            //
            // With `hydrateMessages` registered the customer owns history — the
            // hook fires per-turn and produces the canonical chain from their DB.
            // Skip both reads entirely: no need to load a blob the customer's
            // hook will overwrite.
            //
            // Without it, both reads are gated on `couldHavePriorState`. A fresh
            // chat (no continuation, attempt 1) can't have a snapshot OR replay
            // records by definition — `readChatSnapshot` would 404 and
            // `replaySessionOutTail` would return [], and the round-trips
            // collectively cost ~600ms on every first-message TTFC. Both reads
            // swallow errors internally; the agent stays available either way.
            const sessionIdForSnapshot = payload.sessionId ?? payload.chatId;
            const transcriptStorage = storage ??
                transcriptStorageOverride ??
                transcriptStorage_js_1.defaultStorage;
            const storageLoadContext = transcriptStorage.loadContext?.bind(transcriptStorage);
            /**
             * Who supplies the model's context each turn: the deprecated
             * `hydrateMessages` hook, the storage's `loadContext`, or (undefined)
             * the runtime's own transcript.
             */
            const loadContextHook = hydrateMessages
                ? (event) => hydrateMessages(event)
                : storageLoadContext
                    ? (event) => storageLoadContext({ chatId: event.chatId, clientData: event.clientData }, event)
                    : undefined;
            let transcriptShadow = (0, transcriptStorage_js_1.createTranscriptShadow)([]);
            let bootTranscriptState = null;
            /**
             * True while the model lane holds a compaction summary, so it cannot be
             * rebuilt from the transcript and has to be persisted as state. Reset
             * wherever the lane is reconverted from the UI lane.
             */
            let laneCompacted = false;
            /** Conversational `chat.inject` messages in the lane, anchored to the transcript. */
            let laneInjections = [];
            let persistedStateSet = false;
            let bootSnapshot;
            let bootClientData = payload.metadata;
            if (parseClientData) {
                try {
                    bootClientData = await parseClientData(payload.metadata);
                }
                catch {
                    bootClientData = payload.metadata;
                }
            }
            /**
             * The `lastOutEventId` the most recent snapshot carried.
             *
             * A snapshot written outside a turn — after an action mutates history — has
             * no turn cursor of its own, and writing `undefined` there would drop the
             * resume point and make the next boot replay from further back. Retaining it
             * keeps an action's write cursor-neutral.
             */
            let lastSnapshotOutEventId;
            /**
             * The `lastInEventId` the most recent snapshot carried.
             *
             * A turn-start save happens after the incoming message has been handed to
             * the turn loop, so the router's live resume floor has already advanced
             * past it. Persisting that floor before the turn runs would let the next
             * boot resume past a message this run never answered, which is exactly
             * what a deferred or recovered message depends on. Turn-start carries
             * this instead.
             */
            let lastSnapshotInEventId;
            const storageTrigger = (trigger) => trigger === "regenerate-message"
                ? "regenerate-message"
                : trigger === "action" || trigger === "action-turn"
                    ? "action"
                    : "submit-message";
            /**
             * Hand the runtime's view of the transcript to the storage as a
             * changeset: the diff against what was last saved, plus the cursors the
             * next boot resumes from. The shadow only advances when the save
             * succeeds, so a failed save is folded into the next changeset.
             */
            /** The runtime's opaque state as of the last save; carried on every changeset's transcript. */
            let transcriptState = null;
            let transcriptSaveChain = Promise.resolve();
            const runSaveTranscript = async (opts) => {
                const { changes, shadow } = (0, transcriptStorage_js_1.diffTranscript)(transcriptShadow, opts.messages, {
                    nonFinalIds: opts.nonFinalIds,
                });
                const throughId = opts.messages.at(-1)?.id ?? "";
                const queued = locals_js_1.locals.get(chatBackgroundQueueKey) ?? [];
                const runtimeState = laneCompacted || laneInjections.length > 0 || queued.length > 0
                    ? {
                        v: 1,
                        ...(laneCompacted
                            ? {
                                compaction: {
                                    modelMessages: accumulatedMessages,
                                    throughId,
                                },
                            }
                            : {}),
                        ...(laneInjections.length > 0 ? { injections: laneInjections } : {}),
                        ...(queued.length > 0 ? { queued: [...queued] } : {}),
                    }
                    : null;
                if (runtimeState !== null || persistedStateSet) {
                    changes.push({ op: "state", value: runtimeState });
                }
                if (opts.skipIfUnchanged && changes.length === 0)
                    return;
                transcriptState = runtimeState;
                const liveInCursor = chatInputRouter().resumeFloor();
                const inCursor = opts.carryInCursor
                    ? lastSnapshotInEventId
                    : liveInCursor !== undefined
                        ? String(liveInCursor)
                        : undefined;
                await transcriptStorage.save({
                    chatId: payload.chatId,
                    clientData: opts.clientData,
                    turn: opts.turn,
                    trigger: opts.trigger,
                    runId: ctx.run.id,
                    ctx,
                }, {
                    reason: opts.reason,
                    changes,
                    transcript: {
                        entries: opts.messages.map((message) => ({
                            id: message.id,
                            final: !shadow.nonFinal.has(message.id),
                            message,
                        })),
                        state: transcriptState,
                    },
                    cursors: {
                        lastOutEventId: opts.lastOutEventId,
                        lastInEventId: inCursor,
                    },
                });
                transcriptShadow = shadow;
                lastSnapshotInEventId = inCursor;
                persistedStateSet = runtimeState !== null;
            };
            /**
             * Serialise every save onto one chain. `runSaveTranscript` derives its
             * changeset from `transcriptShadow` and only advances it once the write
             * lands, so two overlapping saves would diff against stale state. The
             * message list is copied on the way in because the accumulator keeps
             * mutating while a queued save waits its turn. A rejection is handed to
             * the caller but never poisons the chain.
             */
            const saveTranscript = (opts) => {
                const queued = { ...opts, messages: [...opts.messages] };
                const run = () => runSaveTranscript(queued);
                const next = transcriptSaveChain.then(run, run);
                transcriptSaveChain = next.then(() => undefined, () => undefined);
                return next;
            };
            /**
             * Persist the accumulator outside a turn.
             *
             * An action is not a turn, so it never reaches the turn-complete path where
             * the transcript is normally saved, but a `chat.history` mutation changes
             * the conversation and has to survive the run ending.
             *
             * Cursor-neutral: an action has no turn cursor of its own, and writing
             * `undefined` would drop the resume point the last turn established and make
             * the next boot replay from further back.
             */
            const writeSnapshotOutsideTurn = async (reason, turnContext) => {
                if (hydrateMessages)
                    return;
                try {
                    await tracer_js_1.tracer.startActiveSpan("snapshot.write", async () => {
                        await saveTranscript({
                            reason: "action",
                            messages: accumulatedUIMessages,
                            turn: turnContext.turn,
                            trigger: "action",
                            clientData: turnContext.clientData,
                            lastOutEventId: lastSnapshotOutEventId,
                        });
                    }, {
                        attributes: {
                            [v3_1.SemanticInternalAttributes.STYLE_ICON]: "task-hook-onStart",
                            [v3_1.SemanticInternalAttributes.COLLAPSED]: true,
                            "chat.snapshot.reason": reason,
                            "chat.messages.count": accumulatedUIMessages.length,
                        },
                    });
                }
                catch (error) {
                    v3_1.logger.warn("chat.agent: snapshot write outside a turn failed; the change may not survive a continuation", {
                        error: error instanceof Error ? error.message : String(error),
                        sessionId: sessionIdForSnapshot,
                        reason,
                    });
                }
            };
            let replayedSettled = [];
            let replayedPartial;
            let replayedPartialRaw;
            let replayedInTail = [];
            // Wire payloads to dispatch as turns before the regular session.in
            // pump kicks in. Populated by `onRecoveryBoot.recoveredTurns` (or its
            // default, `inFlightUsers`). The turn-loop checks this queue ahead of
            // `messagesInput.waitWithIdleTimeout` so recovered turns fire first.
            const bootInjectedQueue = [];
            const recoveredSeqByPayload = new WeakMap();
            const dispatchBootInjected = () => bootInjectedQueue.shift();
            const settleRecoveredTurn = (wirePayload) => {
                const settledSeq = recoveredSeqByPayload.get(wirePayload);
                if (settledSeq !== undefined)
                    chatInputRouter().settleRecovered(settledSeq);
            };
            const couldHavePriorState = payload.continuation === true || ctx.attempt.number > 1;
            // `.in` resume cursor, computed at most once per boot. The boot
            // block below resolves it (snapshot field or records scan) and the
            // resume-cursor block reuses it instead of re-scanning.
            let bootInCursor;
            let bootInCursorResolved = false;
            if (couldHavePriorState) {
                // Single parent span for the whole boot read phase — snapshot
                // read, session.out replay, session.in replay. Per-phase timing
                // + result counts are attributes on the span.
                await tracer_js_1.tracer.startActiveSpan("chat.boot", async (bootSpan) => {
                    // snapshot read
                    const snapStart = Date.now();
                    try {
                        const loaded = hydrateMessages
                            ? undefined
                            : await transcriptStorage.load({
                                chatId: payload.chatId,
                                clientData: bootClientData,
                            });
                        if (loaded) {
                            transcriptShadow = (0, transcriptStorage_js_1.createTranscriptShadow)(loaded.messages, new Set(loaded.nonFinalIds ?? []));
                            bootTranscriptState = loaded.state;
                            transcriptState = loaded.state ?? null;
                            persistedStateSet = loaded.state !== null && loaded.state !== undefined;
                            bootSnapshot = {
                                messages: loaded.messages,
                                lastOutEventId: loaded.cursors?.lastOutEventId,
                                lastInEventId: loaded.cursors?.lastInEventId,
                            };
                        }
                    }
                    catch (error) {
                        v3_1.logger.warn("chat.agent: transcript load failed; continuing from the stream tail", {
                            error: error instanceof Error ? error.message : String(error),
                            sessionId: sessionIdForSnapshot,
                        });
                    }
                    bootSpan.setAttribute("chat.boot.snapshot.durationMs", Date.now() - snapStart);
                    bootSpan.setAttribute("chat.boot.snapshot.present", bootSnapshot !== undefined &&
                        (bootSnapshot.messages.length > 0 || bootSnapshot.lastOutEventId !== undefined));
                    bootSpan.setAttribute("chat.boot.snapshot.messageCount", bootSnapshot?.messages?.length ?? 0);
                    // Seed the trim chain from the snapshot's `lastOutEventId` (the SSE
                    // id of the previous turn's `turn-complete` control record). The
                    // first turn-complete this worker writes will then trim back to it.
                    // Without seeding, the new worker would emit no trim on its first
                    // turn (chain self-bootstraps from turn 2), so this is purely an
                    // optimization to keep continuation runs bounded from the first turn.
                    lastSnapshotOutEventId = bootSnapshot?.lastOutEventId;
                    lastSnapshotInEventId = bootSnapshot?.lastInEventId;
                    if (bootSnapshot?.lastOutEventId !== undefined) {
                        const seeded = Number.parseInt(bootSnapshot.lastOutEventId, 10);
                        if (Number.isFinite(seeded)) {
                            const slot = locals_js_1.locals.get(lastTurnCompleteSeqNumKey);
                            if (slot)
                                slot.value = seeded;
                        }
                    }
                    // The `.out` replay and the `.in` cursor + tail read are
                    // independent (both depend only on the snapshot) — run them
                    // concurrently. Each phase keeps its own catch + duration
                    // attribute.
                    const replayOutPhase = async () => {
                        const replayOutStart = Date.now();
                        try {
                            const replayResult = await replaySessionOutTail(sessionIdForSnapshot, {
                                lastEventId: bootSnapshot?.lastOutEventId,
                            });
                            replayedSettled = replayResult.settled;
                            replayedPartial = replayResult.partial;
                            replayedPartialRaw = replayResult.partialRaw;
                        }
                        catch (error) {
                            v3_1.logger.warn("chat.agent: session.out replay failed; using snapshot only", {
                                error: error instanceof Error ? error.message : String(error),
                                sessionId: sessionIdForSnapshot,
                            });
                        }
                        bootSpan.setAttribute("chat.boot.replay.out.durationMs", Date.now() - replayOutStart);
                        bootSpan.setAttribute("chat.boot.replay.out.settledCount", replayedSettled.length);
                        bootSpan.setAttribute("chat.boot.replay.out.partialPresent", replayedPartial !== undefined);
                    };
                    // session.in tail read
                    //
                    // session.in carries the user-side of the conversation
                    // (ChatInputChunk records). On a continuation boot we read past
                    // the last turn-complete's `session-in-event-id` header so any
                    // user message the dead predecessor hadn't acknowledged surfaces
                    // here. Without this read, in-flight user messages would only be
                    // visible via the live SSE subscription — by which point they
                    // would arrive AFTER the partial-assistant orphan and look like
                    // brand-new turns to the model, producing inverted chains.
                    //
                    // The cursor comes from the snapshot when present (written
                    // there since `lastInEventId` was added) — otherwise from a
                    // records scan of `.out`'s latest turn-complete header.
                    const replayInPhase = async () => {
                        const replayInStart = Date.now();
                        const snapshotInCursor = bootSnapshot?.lastInEventId !== undefined
                            ? Number.parseInt(bootSnapshot.lastInEventId, 10)
                            : undefined;
                        if (snapshotInCursor !== undefined && Number.isFinite(snapshotInCursor)) {
                            bootInCursor = snapshotInCursor;
                            bootInCursorResolved = true;
                        }
                        else {
                            try {
                                bootInCursor = await findLatestSessionInCursor(payload.chatId);
                                bootInCursorResolved = true;
                            }
                            catch {
                                // Transient scan failure: leave unresolved so the
                                // resume-cursor block below retries the lookup.
                                bootInCursor = undefined;
                            }
                        }
                        bootSpan.setAttribute("chat.boot.replay.in.cursorFromSnapshot", snapshotInCursor !== undefined);
                        try {
                            replayedInTail = await replaySessionInTail(payload.chatId, {
                                lastEventId: bootInCursor !== undefined ? String(bootInCursor) : undefined,
                            });
                        }
                        catch (error) {
                            v3_1.logger.warn("chat.agent: session.in replay failed; in-flight users may not be recovered", { error: error instanceof Error ? error.message : String(error) });
                        }
                        bootSpan.setAttribute("chat.boot.replay.in.durationMs", Date.now() - replayInStart);
                        bootSpan.setAttribute("chat.boot.replay.in.userCount", replayedInTail.length);
                    };
                    await Promise.all([replayOutPhase(), replayInPhase()]);
                }, {
                    attributes: {
                        [v3_1.SemanticInternalAttributes.STYLE_ICON]: "tabler-rotate-clockwise",
                        [v3_1.SemanticInternalAttributes.COLLAPSED]: true,
                        "chat.id": payload.chatId,
                        "chat.continuation": payload.continuation ?? false,
                        "chat.attempt": ctx.attempt.number,
                    },
                });
            }
            // ── session.in router ──────────────────────────────────────────
            //
            const recoveredSeqNums = replayedInTail.map((r) => r.seqNum);
            await installChatInputRouter(payload.chatId, {
                fallbackResumeFrom: bootInCursorResolved ? bootInCursor : undefined,
                recoveredSeqNums,
                resuming: Boolean(payload.continuation) || ctx.attempt.number > 1,
            });
            // ── Recovery boot + chain reconstruction ────────────────────────
            {
                const settledMessages = mergeByIdReplaceWins(bootSnapshot?.messages ?? [], replayedSettled);
                const inFlightUsers = replayedInTail.map((r) => r.message);
                const partialAssistant = replayedPartial;
                // Fire the hook only when there's a partial assistant — the
                // mid-stream-died signal. In-flight users alone (no partial)
                // cover graceful exits like `chat.requestUpgrade()` where the
                // predecessor chose to end before processing the message;
                // those route through the normal continuation-wait path.
                const hasRecoveredState = partialAssistant !== undefined;
                let hookChain;
                let hookRecoveredTurns;
                let hookBeforeBoot;
                if (couldHavePriorState && hasRecoveredState && onRecoveryBoot) {
                    // Extract from the RAW partial (pre-cleanup). `cleanupAbortedParts`
                    // strips exactly the input-streaming / input-available tool parts
                    // we want to surface here, so the cleaned `partialAssistant` would
                    // always report zero pending tool calls.
                    const pendingToolCalls = extractPendingToolCallsFromPartial(replayedPartialRaw);
                    const previousRunIdForHook = previousRunId ?? "";
                    let hookResult = undefined;
                    const { writer: hookWriter, flush: hookFlush } = createLazyChatWriter();
                    try {
                        hookResult = await tracer_js_1.tracer.startActiveSpan("onRecoveryBoot()", async () => onRecoveryBoot({
                            ctx,
                            chatId: payload.chatId,
                            runId: ctx.run.id,
                            previousRunId: previousRunIdForHook,
                            cause: "unknown",
                            settledMessages,
                            inFlightUsers,
                            partialAssistant,
                            pendingToolCalls,
                            writer: hookWriter,
                        }), {
                            attributes: {
                                [v3_1.SemanticInternalAttributes.STYLE_ICON]: "task-hook-onStart",
                                [v3_1.SemanticInternalAttributes.COLLAPSED]: true,
                                "chat.id": payload.chatId,
                            },
                        });
                    }
                    catch (error) {
                        v3_1.logger.warn("chat.agent: onRecoveryBoot threw; using defaults", {
                            error: error instanceof Error ? error.message : String(error),
                            chatId: payload.chatId,
                        });
                    }
                    // Flush any chunks the hook wrote so they land on session.out
                    // BEFORE the first recovered turn fires.
                    try {
                        await hookFlush();
                    }
                    catch (error) {
                        v3_1.logger.warn("chat.agent: onRecoveryBoot writer flush failed", {
                            error: error instanceof Error ? error.message : String(error),
                        });
                    }
                    if (hookResult && typeof hookResult === "object") {
                        if (Array.isArray(hookResult.chain))
                            hookChain = hookResult.chain;
                        if (Array.isArray(hookResult.recoveredTurns))
                            hookRecoveredTurns = hookResult.recoveredTurns;
                        if (typeof hookResult.beforeBoot === "function")
                            hookBeforeBoot = hookResult.beforeBoot;
                    }
                }
                // Default: splice partial + the user it was answering into the chain
                // so follow-ups like "keep going" still have context, and re-dispatch
                // the users that arrived after it.
                //
                // The splice needs a follow-up user to answer — it consumes
                // `inFlightUsers[0]` into the chain instead of dispatching it. With
                // exactly ONE in-flight user (the plain OOM / crash-mid-answer case)
                // there is nothing left to dispatch, so splicing would strand that
                // user unanswered and idle the run. Require `length > 1` on both
                // branches: at n=1 the orphan partial is dropped and the interrupted
                // user is re-dispatched as a fresh turn instead.
                let seedChain;
                let recoveredEntries;
                if (hookChain !== undefined) {
                    seedChain = hookChain;
                }
                else if (partialAssistant !== undefined && inFlightUsers.length > 1) {
                    seedChain = [...settledMessages, inFlightUsers[0], partialAssistant];
                }
                else {
                    seedChain = settledMessages;
                }
                if (hookRecoveredTurns !== undefined) {
                    const seqNumsByRecoveredId = new Map();
                    for (const entry of replayedInTail) {
                        const existing = seqNumsByRecoveredId.get(entry.message.id);
                        if (existing)
                            existing.push(entry.seqNum);
                        else
                            seqNumsByRecoveredId.set(entry.message.id, [entry.seqNum]);
                    }
                    recoveredEntries = hookRecoveredTurns.map((message) => ({
                        message,
                        seqNum: seqNumsByRecoveredId.get(message.id)?.shift(),
                    }));
                }
                else if (partialAssistant !== undefined && inFlightUsers.length > 1) {
                    recoveredEntries = replayedInTail
                        .slice(1)
                        .map((r) => ({ message: r.message, seqNum: r.seqNum }));
                }
                else {
                    recoveredEntries = replayedInTail.map((r) => ({ message: r.message, seqNum: r.seqNum }));
                }
                // `beforeBoot` errors bubble — the customer opted into blocking
                // persistence and a failure there should fail the run rather than
                // dispatch recovered turns against half-persisted state.
                if (hookBeforeBoot) {
                    await hookBeforeBoot();
                }
                // Synthesize wire payloads for each recoveredTurn. The turn-loop
                // pops these ahead of `messagesInput.waitWithIdleTimeout` so they
                // dispatch as normal turns with the existing hook stack.
                //
                // Per-record metadata preservation: each session.in record
                // carries its own `payload.metadata` (the transport sets it at
                // send time). Look up the original by message id so a recovered
                // turn dispatches with the metadata its writer actually sent.
                // Fall back to the boot payload's metadata for hook-synthesized
                // messages (customer returned a recoveredTurn with no matching
                // session.in record).
                //
                // OOM-retry dedup: if `payload.message` is the same user message
                // the queue is about to redispatch (the wire payload survives
                // across attempts, but session.in records it once), the wire
                // payload already runs turn 0 — drop the duplicate from the queue
                // so we don't fire the same turn twice.
                const wireMessageId = payload.message?.id;
                const metadataById = new Map();
                for (const entry of replayedInTail) {
                    metadataById.set(entry.message.id, entry.metadata);
                }
                const dispatchedRecoveredSeqs = new Set();
                for (const { message: msg, seqNum } of recoveredEntries) {
                    if (wireMessageId && msg.id === wireMessageId)
                        continue;
                    const recoveredMetadata = metadataById.has(msg.id)
                        ? metadataById.get(msg.id)
                        : payload.metadata;
                    const injectedPayload = {
                        chatId: payload.chatId,
                        sessionId: payload.sessionId,
                        metadata: recoveredMetadata,
                        trigger: "submit-message",
                        message: msg,
                        messageId: msg.id,
                        continuation: payload.continuation,
                        previousRunId: payload.previousRunId,
                    };
                    bootInjectedQueue.push(injectedPayload);
                    if (seqNum !== undefined) {
                        recoveredSeqByPayload.set(injectedPayload, seqNum);
                        dispatchedRecoveredSeqs.add(seqNum);
                    }
                }
                for (const entry of replayedInTail) {
                    if (!dispatchedRecoveredSeqs.has(entry.seqNum)) {
                        chatInputRouter().settleRecovered(entry.seqNum);
                    }
                }
                accumulatedUIMessages = seedChain;
                // ── Head-start bootstrap ─────────────────────────────────────
                //
                // The very-first turn of a head-start handover has no snapshot
                // (it doesn't exist yet) and no `session.out` history (the run
                // just woke up). The customer's HTTP route handler ships full
                // UIMessage history via `headStartMessages` — that's the only
                // path where wire-borne UIMessage[] still seeds the accumulator,
                // and it's safe because the route handler isn't subject to the
                // `/in/append` 512 KiB cap.
                if (!loadContextHook &&
                    accumulatedUIMessages.length === 0 &&
                    payload.trigger === "handover-prepare" &&
                    Array.isArray(payload.headStartMessages) &&
                    payload.headStartMessages.length > 0) {
                    accumulatedUIMessages = [...payload.headStartMessages];
                }
                if (accumulatedUIMessages.length > 0) {
                    // Resolve a function-form `tools` with the run/continuation payload's
                    // clientData so this conversion of the restored history applies each
                    // tool's toModelOutput (static tools were already seeded above). This
                    // only re-renders saved history, so it fails open: a resolver hiccup
                    // logs and converts without tools rather than blocking the resume.
                    // Per-turn resolveTurnTools still fails closed for live turns.
                    if (typeof toolsOption === "function") {
                        try {
                            await resolveTurnTools({
                                chatId: payload.chatId,
                                turn: 0,
                                continuation: payload.continuation ?? false,
                                clientData: parseClientData
                                    ? await parseClientData(payload.metadata)
                                    : payload.metadata,
                            });
                        }
                        catch (error) {
                            v3_1.logger.warn("chat.agent: tools() resolver threw at boot; restored history converted without toModelOutput", { error: error instanceof Error ? error.message : String(error) });
                        }
                    }
                    try {
                        const bootRuntimeState = (0, transcriptStorage_js_1.parseTranscriptRuntimeState)(bootTranscriptState);
                        const restored = await (0, transcriptStorage_js_1.restoreModelLane)(accumulatedUIMessages, bootRuntimeState, (messages) => toModelMessages(messages));
                        accumulatedMessages = restored.messages;
                        laneCompacted = restored.compacted;
                        laneInjections = restored.injections;
                        if (bootRuntimeState?.queued && bootRuntimeState.queued.length > 0) {
                            locals_js_1.locals.set(chatBackgroundQueueKey, [
                                ...(locals_js_1.locals.get(chatBackgroundQueueKey) ?? []),
                                ...bootRuntimeState.queued,
                            ]);
                        }
                    }
                    catch (error) {
                        v3_1.logger.warn("chat.agent: toModelMessages failed at boot; starting empty", {
                            error: error instanceof Error ? error.message : String(error),
                            sessionId: sessionIdForSnapshot,
                        });
                        accumulatedMessages = [];
                    }
                }
                // Make the seeded UI accumulator visible to `chat.history.*`
                // before any hook (`onChatStart`, `onTurnStart`, etc.) fires.
                locals_js_1.locals.set(chatCurrentUIMessagesKey, accumulatedUIMessages);
            }
            locals_js_1.locals.set(chatAgentManagedConfigKey, {
                registry: promptRegistry,
                system: agentSystem,
                cacheControl: agentCacheControl,
                systemProviderOptions: agentSystemProviderOptions,
            });
            // Token usage tracking across turns
            let previousTurnUsage;
            let cumulativeUsage = emptyUsage();
            // Mutable reference to the current turn's stop controller so the
            // stop input stream listener (registered once) can abort the right turn.
            let currentStopController;
            // Stop-input subscription is registered AFTER preload's wait resolves
            // (see the post-preload block below). Registering it earlier would
            // cause it to drain any session.in records buffered before the runtime
            // started — including the customer's first user message arriving on
            // `kind: "message"`. The persistent-listener semantics of session.in
            // pop the buffer when a handler attaches; the stop listener filters
            // out anything that isn't `kind: "stop"` and silently swallows the
            // user message instead of leaving it for `messagesInput.waitWithIdleTimeout`
            // to pick up.
            let stopSub;
            try {
                // ── onBoot — fires once per fresh worker process picking up the chat.
                //
                // Runs BEFORE `onPreload`, `onChatStart`, the continuation-wait
                // branch, and any turn. This is the hook customers use to do
                // per-process setup that has to repeat for every boot (initial
                // run, preloaded run, AND reactive continuation): `chat.local`
                // initialization, opening per-process resources, re-hydrating
                // customer state from their DB on continuation.
                //
                // `onChatStart` is once-per-chat (`!couldHavePriorState` gate);
                // when the prior run dies and a fresh worker boots, `onChatStart`
                // does NOT fire — which is why customers initializing
                // `chat.local` only in `onChatStart` previously crashed in
                // `run()` on continuation. `onBoot` fills that gap.
                if (onBoot) {
                    const bootClientData = (parseClientData ? await parseClientData(payload.metadata) : payload.metadata);
                    let bootAccessToken = "";
                    const bootRunId = ctx.run.id;
                    if (bootRunId) {
                        try {
                            bootAccessToken = await auth_js_1.auth.createPublicToken({
                                scopes: {
                                    read: {
                                        runs: bootRunId,
                                        sessions: payload.chatId,
                                    },
                                    write: {
                                        inputStreams: bootRunId,
                                        sessions: payload.chatId,
                                    },
                                },
                                expirationTime: chatAccessTokenTTL,
                            });
                        }
                        catch {
                            // Token mint is best-effort — customers can re-mint from
                            // their own backend if they need one.
                        }
                    }
                    await tracer_js_1.tracer.startActiveSpan("onBoot()", async () => {
                        await onBoot({
                            ctx,
                            chatId: payload.chatId,
                            runId: bootRunId,
                            chatAccessToken: bootAccessToken,
                            clientData: bootClientData,
                            continuation,
                            previousRunId,
                            preloaded,
                        });
                    }, {
                        attributes: {
                            [v3_1.SemanticInternalAttributes.STYLE_ICON]: "task-hook-onStart",
                            [v3_1.SemanticInternalAttributes.COLLAPSED]: true,
                            "chat.id": payload.chatId,
                            "chat.continuation": continuation,
                            "chat.preloaded": preloaded,
                        },
                    });
                }
                /**
                 * A retry (e.g. OOM) or continuation whose boot recovery restored an
                 * in-flight `.in` message dispatches it as the first turn. The recovery
                 * block already advanced the `.in` cursor past the recovered message,
                 * so the preload wait below would otherwise strand it (the run would
                 * sit waiting for a "first message" that already arrived). `onPreload`
                 * is a one-time start-of-run hook and is deliberately not re-run on a
                 * recovered/continuation turn.
                 */
                let dispatchedRecoveredFirstTurn = false;
                if (preloaded && bootInjectedQueue.length > 0) {
                    currentWirePayload = dispatchBootInjected();
                    dispatchedRecoveredFirstTurn = true;
                }
                // Handle preloaded runs — fire onPreload, then wait for the first real message
                if (preloaded && !dispatchedRecoveredFirstTurn) {
                    if (activeSpan) {
                        activeSpan.setAttribute("chat.preloaded", true);
                    }
                    const currentRunId = ctx.run.id;
                    let preloadAccessToken = "";
                    if (currentRunId) {
                        try {
                            preloadAccessToken = await auth_js_1.auth.createPublicToken({
                                scopes: {
                                    read: {
                                        runs: currentRunId,
                                        sessions: payload.chatId,
                                    },
                                    write: {
                                        inputStreams: currentRunId,
                                        sessions: payload.chatId,
                                    },
                                },
                                expirationTime: chatAccessTokenTTL,
                            });
                        }
                        catch {
                            // Token creation failed
                        }
                    }
                    // Parse client data for the preload hook
                    const preloadClientData = (parseClientData ? await parseClientData(payload.metadata) : payload.metadata);
                    // Fire onPreload hook
                    if (onPreload) {
                        await tracer_js_1.tracer.startActiveSpan("onPreload()", async () => {
                            await withChatWriter(async (writer) => {
                                await onPreload({
                                    ctx,
                                    chatId: payload.chatId,
                                    runId: currentRunId,
                                    chatAccessToken: preloadAccessToken,
                                    clientData: preloadClientData,
                                    writer,
                                });
                            });
                        }, {
                            attributes: {
                                [v3_1.SemanticInternalAttributes.STYLE_ICON]: "task-hook-onStart",
                                [v3_1.SemanticInternalAttributes.COLLAPSED]: true,
                                "chat.id": payload.chatId,
                                "chat.preloaded": true,
                            },
                        });
                    }
                    // Wait for the first real message — task-level idle settings win over
                    // `transport.preload(..., { idleTimeoutInSeconds })` / wire payload so
                    // `chat.agent({ idleTimeoutInSeconds, preloadIdleTimeoutInSeconds })` is authoritative.
                    const effectivePreloadIdleTimeout = preloadIdleTimeoutInSeconds ?? idleTimeoutInSeconds ?? payload.idleTimeoutInSeconds;
                    const effectivePreloadTimeout = metadata_js_1.metadata.get(TURN_TIMEOUT_METADATA_KEY) ??
                        preloadTimeout ??
                        turnTimeout;
                    const preloadResult = await messagesInput.waitWithIdleTimeout({
                        idleTimeoutInSeconds: effectivePreloadIdleTimeout,
                        timeout: effectivePreloadTimeout,
                        spanName: "first message",
                        skipSuspend: exitAfterPreloadIdle,
                        onSuspend: onChatSuspend
                            ? async () => {
                                await tracer_js_1.tracer.startActiveSpan("onChatSuspend()", async () => {
                                    await onChatSuspend({
                                        phase: "preload",
                                        ctx,
                                        chatId: payload.chatId,
                                        runId: currentRunId,
                                        clientData: preloadClientData,
                                    });
                                }, {
                                    attributes: {
                                        [v3_1.SemanticInternalAttributes.STYLE_ICON]: "task-hook-onComplete",
                                        [v3_1.SemanticInternalAttributes.COLLAPSED]: true,
                                        "chat.id": payload.chatId,
                                        "chat.suspend.phase": "preload",
                                    },
                                });
                            }
                            : undefined,
                        onResume: onChatResume
                            ? async () => {
                                await tracer_js_1.tracer.startActiveSpan("onChatResume()", async () => {
                                    await onChatResume({
                                        phase: "preload",
                                        ctx,
                                        chatId: payload.chatId,
                                        runId: currentRunId,
                                        clientData: preloadClientData,
                                    });
                                }, {
                                    attributes: {
                                        [v3_1.SemanticInternalAttributes.STYLE_ICON]: "task-hook-onStart",
                                        [v3_1.SemanticInternalAttributes.COLLAPSED]: true,
                                        "chat.id": payload.chatId,
                                        "chat.resume.phase": "preload",
                                    },
                                });
                            }
                            : undefined,
                    });
                    if (!preloadResult.ok) {
                        return; // Timed out waiting for first message — end run
                    }
                    let firstMessage = preloadResult.output;
                    currentWirePayload = firstMessage;
                    // Close signal during preload — exit before first turn
                    if (currentWirePayload.trigger === "close") {
                        return;
                    }
                }
                // Listen for stop signals for the rest of the run. Registered AFTER
                // the preload wait resolves (or skipped immediately for non-preload
                // triggers) so the persistent-listener semantics on session.in
                // don't drain the buffered user message before
                // `messagesInput.waitWithIdleTimeout` can pick it up. A stop signal
                // that lands during the preload window is dropped — acceptable, the
                // customer can't reasonably stop a chat that hasn't started.
                stopSub = stopInput.on((data) => {
                    currentStopController?.abort(data?.message || "stopped");
                });
                // Handle handover-prepare runs — wait on session.in for the
                // customer's `chat.handover` route handler to either hand off
                // mid-turn (tool calls) or signal pure-text completion.
                if (payload.trigger === "handover-prepare") {
                    if (activeSpan) {
                        activeSpan.setAttribute("chat.handoverPreparing", true);
                    }
                    const handoverResult = await handoverInput.waitWithIdleTimeout({
                        idleTimeoutInSeconds: idleTimeoutInSeconds ?? payload.idleTimeoutInSeconds ?? 60,
                        spanName: "waiting for handover signal",
                    });
                    if (!handoverResult.ok) {
                        // Handler crashed before signaling — exit cleanly.
                        return;
                    }
                    if (handoverResult.output.kind === "handover-skip") {
                        // Sent only when the customer's handler aborts before
                        // producing a finishReason. Normal pure-text and
                        // tool-call finishes go through `kind: "handover"` with
                        // `isFinal: true | false`. Exit without firing any turn
                        // hooks.
                        return;
                    }
                    // kind === "handover": stash the partial assistant message
                    // so turn-0 setup can append it after loading user
                    // messages. Two branches downstream, switched by `isFinal`:
                    //   - `false`: customer's step 1 ended with `tool-calls`.
                    //     The agent's `streamText` sees pending tool-calls (via
                    //     the approval round in the partial) and executes them,
                    //     then runs step 2's LLM call.
                    //   - `true`: customer's step 1 ended pure-text. The agent
                    //     runs the turn-loop hooks but SKIPS the `streamText`
                    //     call entirely (the response is already complete).
                    //     `onTurnComplete` fires with the partial as
                    //     `responseMessage` so persistence works normally.
                    locals_js_1.locals.set(chatHandoverPartialKey, handoverResult.output.partialAssistantMessage);
                    // Stash the customer-side step-1 messageId. Turn-0 setup
                    // uses it to seed the synthesized partial UIMessage with the
                    // SAME id, so the agent's post-handover chunks merge into
                    // the same assistant message on the browser side.
                    if (handoverResult.output.messageId) {
                        locals_js_1.locals.set(chatHandoverMessageIdKey, handoverResult.output.messageId);
                    }
                    locals_js_1.locals.set(chatHandoverIsFinalKey, handoverResult.output.isFinal);
                    // Synthesize a wire payload that the turn loop treats as a
                    // normal first-turn message. The accumulator was already seeded
                    // at boot from `payload.headStartMessages` (see B.3 head-start
                    // bootstrap), so the rewritten `submit-message` carries no
                    // delta — the loop runs streamText against the seeded state.
                    currentWirePayload = {
                        ...payload,
                        trigger: "submit-message",
                        message: undefined,
                        headStartMessages: undefined,
                    };
                }
                // Continuation-wait: a continuation run (post-`endRun`,
                // post-waitpoint-timeout, etc.) booted with no incoming message.
                // The server strips the Session's basePayload `message` /
                // `messages` / `trigger` on continuation so a stale one-shot boot
                // payload doesn't re-fire on every resume. Without a real first
                // message, we have nothing to process at turn 0 — wait silently
                // for the next session.in record before entering the turn loop.
                // Unlike preload, `onPreload` does NOT fire (the chat already
                // started); `onChatStart` will fire on the first turn with
                // `continuation: true, preloaded: false`.
                if (!preloaded &&
                    payload.continuation === true &&
                    !payload.message &&
                    payload.trigger !== "handover-prepare" &&
                    payload.trigger !== "close") {
                    if (activeSpan) {
                        activeSpan.setAttribute("chat.continuationWaiting", true);
                    }
                    const continuationClientData = (parseClientData ? await parseClientData(payload.metadata) : payload.metadata);
                    // Recovery-boot injection: if `onRecoveryBoot` (or its default
                    // `inFlightUsers`) populated `bootInjectedQueue`, dispatch the
                    // first synthesized payload as the very first turn instead of
                    // waiting on the live session.in. Subsequent recovered turns
                    // get drained by the end-of-turn picker below.
                    if (bootInjectedQueue.length > 0) {
                        currentWirePayload = dispatchBootInjected();
                    }
                    else {
                        const effectiveIdleTimeout = idleTimeoutInSeconds ?? payload.idleTimeoutInSeconds;
                        const effectiveTurnTimeout = metadata_js_1.metadata.get(TURN_TIMEOUT_METADATA_KEY) ?? turnTimeout;
                        const continuationResult = await messagesInput.waitWithIdleTimeout({
                            idleTimeoutInSeconds: effectiveIdleTimeout,
                            timeout: effectiveTurnTimeout,
                            spanName: "first message (continuation)",
                            onSuspend: onChatSuspend
                                ? async () => {
                                    await tracer_js_1.tracer.startActiveSpan("onChatSuspend()", async () => {
                                        await onChatSuspend({
                                            phase: "continuation",
                                            ctx,
                                            chatId: payload.chatId,
                                            runId: ctx.run.id,
                                            clientData: continuationClientData,
                                        });
                                    }, {
                                        attributes: {
                                            [v3_1.SemanticInternalAttributes.STYLE_ICON]: "task-hook-onComplete",
                                            [v3_1.SemanticInternalAttributes.COLLAPSED]: true,
                                            "chat.id": payload.chatId,
                                            "chat.suspend.phase": "continuation",
                                        },
                                    });
                                }
                                : undefined,
                            onResume: onChatResume
                                ? async () => {
                                    await tracer_js_1.tracer.startActiveSpan("onChatResume()", async () => {
                                        await onChatResume({
                                            phase: "continuation",
                                            ctx,
                                            chatId: payload.chatId,
                                            runId: ctx.run.id,
                                            clientData: continuationClientData,
                                        });
                                    }, {
                                        attributes: {
                                            [v3_1.SemanticInternalAttributes.STYLE_ICON]: "task-hook-onStart",
                                            [v3_1.SemanticInternalAttributes.COLLAPSED]: true,
                                            "chat.id": payload.chatId,
                                            "chat.resume.phase": "continuation",
                                        },
                                    });
                                }
                                : undefined,
                        });
                        if (!continuationResult.ok) {
                            // Timed out waiting for the customer's next message — exit.
                            return;
                        }
                        currentWirePayload = continuationResult.output;
                        if (currentWirePayload.trigger === "close") {
                            return;
                        }
                    } // end else (no boot-injected first turn)
                }
                for (let turn = 0; turn < maxTurns; turn++) {
                    let turnClientData = payload.metadata;
                    // Declared here so the finally can detach it — a handler leaked past
                    // its turn duplicates every mid-stream message into the shared buffer.
                    let turnMsgSub;
                    let capturedPartialResponse;
                    let responseCommitted = false;
                    const turnBufferedChunks = [];
                    try {
                        // Extract turn-level context before entering the span. Slim
                        // wire: at most one delta message per record. `headStartMessages`
                        // is consumed at boot only (via `payload.headStartMessages`)
                        // and intentionally discarded here.
                        const { metadata: wireMetadata, message: incomingMessage, headStartMessages: _hsm, ...restWire } = currentWirePayload;
                        void _hsm;
                        const incomingMessages = incomingMessage
                            ? [incomingMessage]
                            : [];
                        // Cleaning happens once here so `extractLastUserMessageText` and
                        // every downstream consumer see the same message shape — and
                        // `cleanupAbortedParts` no longer has to be re-applied below.
                        const cleanedIncomingMessages = incomingMessages.map((msg) => msg.role === "assistant" ? cleanupAbortedParts(msg) : msg);
                        const clientData = (parseClientData ? await parseClientData(wireMetadata) : wireMetadata);
                        turnClientData = clientData;
                        const lastUserMessage = extractLastUserMessageText(cleanedIncomingMessages);
                        // Actions are not turns. They use a different span name
                        // and don't carry a turn.number. Branched on at `isAction`.
                        const isAction = currentWirePayload.trigger === "action";
                        const spanName = isAction ? "chat action" : `chat turn ${turn + 1}`;
                        const turnAttributes = {
                            ...(isAction ? {} : { "turn.number": turn + 1 }),
                            "gen_ai.conversation.id": currentWirePayload.chatId,
                            "gen_ai.operation.name": "chat",
                            "chat.trigger": currentWirePayload.trigger,
                            [v3_1.SemanticInternalAttributes.STYLE_ICON]: isAction
                                ? "tabler-bolt"
                                : "tabler-message-chatbot",
                            [v3_1.SemanticInternalAttributes.ENTITY_TYPE]: isAction ? "chat-action" : "chat-turn",
                        };
                        if (lastUserMessage) {
                            turnAttributes["chat.user_message"] = lastUserMessage;
                            // Show a truncated preview of the user message as an accessory
                            const preview = lastUserMessage.length > 80
                                ? lastUserMessage.slice(0, 80) + "..."
                                : lastUserMessage;
                            Object.assign(turnAttributes, (0, v3_1.accessoryAttributes)({
                                items: [{ text: preview, variant: "normal" }],
                                style: "codepath",
                            }));
                        }
                        if (wireMetadata !== undefined) {
                            turnAttributes["chat.client_data"] =
                                typeof wireMetadata === "string" ? wireMetadata : JSON.stringify(wireMetadata);
                        }
                        const turnResult = await tracer_js_1.tracer.startActiveSpan(spanName, async (turnSpan) => {
                            // (errors are caught by the outer try/catch which writes an error chunk)
                            locals_js_1.locals.set(chatPipeCountKey, 0);
                            locals_js_1.locals.set(chatDeferKey, new Set());
                            locals_js_1.locals.set(chatOutGateKey, createChatOutGate());
                            locals_js_1.locals.set(chatCompactionStateKey, undefined);
                            locals_js_1.locals.set(chatSteeringQueueKey, []);
                            locals_js_1.locals.set(chatPendingBackgroundKey, []);
                            locals_js_1.locals.set(chatResponsePartsKey, []);
                            // NOTE: chatBackgroundQueueKey is NOT reset here — messages injected
                            // by deferred work from the previous turn's onTurnComplete need to
                            // survive into the next turn. The queue is drained before run().
                            locals_js_1.locals.set(chatInjectedMessageIdsKey, new Set());
                            // Store chat context for auto-detection by task-tool subtasks (ai.toolExecute / legacy ai.tool)
                            locals_js_1.locals.set(chatTurnContextKey, {
                                chatId: currentWirePayload.chatId,
                                turn,
                                continuation,
                                clientData,
                            });
                            // Resolve the per-turn `tools` set now that turn context
                            // (incl. parsed clientData) exists, so every toModelMessages
                            // call this turn can re-apply tool `toModelOutput`.
                            await resolveTurnTools();
                            // Per-turn stop controller (reset each turn)
                            const stopController = new AbortController();
                            currentStopController = stopController;
                            locals_js_1.locals.set(chatStopControllerKey, stopController);
                            // Three signals for the user's run function
                            const stopSignal = stopController.signal;
                            const cancelSignal = runSignal;
                            const combinedSignal = AbortSignal.any([runSignal, stopController.signal]);
                            const pmConfig = locals_js_1.locals.get(chatPendingMessagesKey);
                            /**
                             * Only attached when there is a steering config to feed. Without
                             * one a mid-turn message is left queued on the router, which is
                             * what holds the resume floor behind it: a record handed to a
                             * handler counts as terminally decided, so buffering one here
                             * published a cursor past a message held only in memory and a
                             * crash before the next turn lost it.
                             */
                            const msgSub = pmConfig
                                ? chatInputRouter().observe(CHAT_ROUTE_MESSAGES, async (record) => {
                                    const msg = record.data
                                        .payload;
                                    // Slim wire: at most one delta message per record. The
                                    // pendingMessages handler reads `msg.message` directly
                                    // instead of slicing an array — a wire record arrives
                                    // with the new user message in `.message`, or no message
                                    // at all (regenerate / preload / close / handover-prepare).
                                    const lastUIMessage = msg.message;
                                    if (lastUIMessage) {
                                        if (pmConfig.onReceived) {
                                            try {
                                                await pmConfig.onReceived({
                                                    message: lastUIMessage,
                                                    chatId: currentWirePayload.chatId,
                                                    turn,
                                                });
                                            }
                                            catch {
                                                /* non-fatal */
                                            }
                                        }
                                        try {
                                            const queue = locals_js_1.locals.get(chatSteeringQueueKey) ?? [];
                                            // Deduplicate by message ID — guards against double-sends
                                            if (lastUIMessage.id &&
                                                queue.some((e) => e.uiMessage.id === lastUIMessage.id)) {
                                                return;
                                            }
                                            const modelMsgs = await toModelMessages([lastUIMessage]);
                                            queue.push({
                                                uiMessage: lastUIMessage,
                                                modelMessages: modelMsgs,
                                                seqNum: record.seqNum,
                                            });
                                            locals_js_1.locals.set(chatSteeringQueueKey, queue);
                                        }
                                        catch {
                                            /* conversion failed — skip steering queue */
                                        }
                                    }
                                })
                                : undefined;
                            turnMsgSub = msgSub;
                            // Track new messages for this turn (user input + assistant response).
                            const turnNewModelMessages = [];
                            const turnNewUIMessages = [];
                            locals_js_1.locals.set(chatTurnNewUIMessagesKey, turnNewUIMessages);
                            // A head-start handover deliberately resumes from an assistant
                            // message it spliced in, so it isn't a no-op turn.
                            let splicedHandoverPartial = false;
                            // ── Action handling ──────────────────────────────────────
                            // Actions arrive on the same input stream but with
                            // trigger === "action". They are NOT turns — only
                            // `hydrateMessages` and `onAction` fire. No turn lifecycle
                            // hooks (`onTurnStart` / `prepareMessages` /
                            // `onBeforeTurnComplete` / `onTurnComplete`) and no
                            // `run()` invocation. To produce a model response from
                            // an action, return a `StreamTextResult` (auto-piped),
                            // string, or UIMessage from `onAction`. Turn counter
                            // does not advance.
                            let actionResult = undefined;
                            /** Set when `onAction` returned `chat.turn()`: the turn block below runs. */
                            let actionTurn = false;
                            /**
                             * Whether this action changed the conversation, by rolling history
                             * back or by streaming a response. Drives the single snapshot write
                             * at the end — an action never reaches the turn-complete path that
                             * normally does it.
                             */
                            let actionChangedHistory = false;
                            if (isAction) {
                                // Parse and validate the action payload
                                const parsedAction = parseAction
                                    ? await parseAction(currentWirePayload.action)
                                    : currentWirePayload.action;
                                // Hydrate messages from backend if configured
                                if (loadContextHook) {
                                    const hydrated = await tracer_js_1.tracer.startActiveSpan("hydrateMessages()", async () => {
                                        return loadContextHook({
                                            chatId: currentWirePayload.chatId,
                                            turn,
                                            trigger: "action",
                                            incomingMessages: [],
                                            previousMessages: [...accumulatedUIMessages],
                                            clientData,
                                            continuation,
                                            previousRunId,
                                        });
                                    }, {
                                        attributes: {
                                            [v3_1.SemanticInternalAttributes.STYLE_ICON]: "task-hook-onStart",
                                            [v3_1.SemanticInternalAttributes.COLLAPSED]: true,
                                            "chat.id": currentWirePayload.chatId,
                                            "chat.trigger": "action",
                                        },
                                    });
                                    accumulatedUIMessages = [...hydrated];
                                    accumulatedMessages = await toModelMessages(hydrated);
                                    laneCompacted = false;
                                    laneInjections = [];
                                    locals_js_1.locals.set(chatCurrentUIMessagesKey, accumulatedUIMessages);
                                }
                                // Fire onAction — handler may mutate state via
                                // `chat.history.*` and / or return a model response.
                                if (onAction) {
                                    actionResult = await tracer_js_1.tracer.startActiveSpan("onAction()", async () => {
                                        return await onAction({
                                            action: parsedAction,
                                            chatId: currentWirePayload.chatId,
                                            turn,
                                            clientData,
                                            uiMessages: accumulatedUIMessages,
                                            messages: accumulatedMessages,
                                        });
                                    }, {
                                        attributes: {
                                            [v3_1.SemanticInternalAttributes.STYLE_ICON]: "task-hook-onStart",
                                            [v3_1.SemanticInternalAttributes.COLLAPSED]: true,
                                            "chat.id": currentWirePayload.chatId,
                                            "chat.action": typeof parsedAction === "object" && parsedAction !== null
                                                ? JSON.stringify(parsedAction)
                                                : String(parsedAction),
                                        },
                                    });
                                    // Apply chat.history mutations from onAction
                                    const actionOverride = locals_js_1.locals.get(chatOverrideMessagesKey);
                                    if (actionOverride) {
                                        locals_js_1.locals.set(chatOverrideMessagesKey, undefined);
                                        accumulatedUIMessages = [...actionOverride];
                                        accumulatedMessages = await toModelMessages(actionOverride);
                                        laneCompacted = false;
                                        laneInjections = [];
                                        locals_js_1.locals.set(chatCurrentUIMessagesKey, accumulatedUIMessages);
                                        actionChangedHistory = true;
                                    }
                                }
                                else {
                                    warnMissingOnActionOnce();
                                }
                            }
                            // ── Message handling (non-action turns) ───────────────────
                            //
                            // Slim wire: at most one delta message arrives per record.
                            // The accumulator was already seeded at boot from a durable
                            // snapshot + `session.out` replay (or `hydrateMessages`,
                            // which also fires per-turn below). Per-turn handling is
                            // therefore a delta merge, not a full-history reset.
                            if (currentWirePayload.trigger !== "action") {
                                let cleanedUIMessages = cleanedIncomingMessages;
                                // Turn-0 head-start with hydrateMessages: the boot seeding from
                                // `payload.headStartMessages` is non-hydrate-only, so ship the
                                // route handler's first-turn history to the hydrate hook as
                                // incoming messages instead (gated on the pending handover).
                                if (turn === 0 &&
                                    loadContextHook &&
                                    cleanedUIMessages.length === 0 &&
                                    (locals_js_1.locals.get(chatHandoverPartialKey)?.length ?? 0) > 0 &&
                                    Array.isArray(payload.headStartMessages) &&
                                    payload.headStartMessages.length > 0) {
                                    cleanedUIMessages = payload.headStartMessages;
                                }
                                // Validate/transform UIMessages before conversion — catches malformed
                                // messages from storage or untrusted input before they reach the model.
                                // Slim wire: triggers like `regenerate-message` carry no incoming
                                // message; nothing to validate, so skip the hook to avoid feeding
                                // `[]` to validators (AI SDK's `validateUIMessages` rejects empty).
                                if (onValidateMessages && cleanedUIMessages.length > 0) {
                                    cleanedUIMessages = (await tracer_js_1.tracer.startActiveSpan("onValidateMessages()", async () => {
                                        return onValidateMessages({
                                            messages: cleanedUIMessages,
                                            chatId: currentWirePayload.chatId,
                                            turn,
                                            trigger: currentWirePayload.trigger,
                                        });
                                    }, {
                                        attributes: {
                                            [v3_1.SemanticInternalAttributes.STYLE_ICON]: "task-hook-onStart",
                                            [v3_1.SemanticInternalAttributes.COLLAPSED]: true,
                                            "chat.id": currentWirePayload.chatId,
                                            "chat.turn": turn + 1,
                                            "chat.messages.count": cleanedUIMessages.length,
                                        },
                                    }));
                                }
                                if (loadContextHook) {
                                    // Snapshot the ids the accumulator knew BEFORE this
                                    // turn ran — used below to decide whether an
                                    // incoming wire message is genuinely new or just a
                                    // state advance on an existing entry. We can't use
                                    // the post-`hydrateMessages` array for this because
                                    // the canonical hook pattern pushes the incoming
                                    // user message into the persisted chain and
                                    // returns it.
                                    const previouslyKnownMessageIds = new Set(accumulatedUIMessages
                                        .map((m) => m.id)
                                        .filter((id) => typeof id === "string"));
                                    // Backend hydration: load the full message history from the user's
                                    // backend, replacing the built-in accumulator entirely. With slim
                                    // wire, `incomingMessages` is consistently 0-or-1-length — what
                                    // was always true for `submit-message` is now true for every
                                    // trigger.
                                    const hydrated = await tracer_js_1.tracer.startActiveSpan("hydrateMessages()", async () => {
                                        return loadContextHook({
                                            chatId: currentWirePayload.chatId,
                                            turn,
                                            trigger: currentWirePayload.trigger,
                                            incomingMessages: cleanedUIMessages,
                                            previousMessages: [...accumulatedUIMessages],
                                            clientData,
                                            continuation,
                                            previousRunId,
                                        });
                                    }, {
                                        attributes: {
                                            [v3_1.SemanticInternalAttributes.STYLE_ICON]: "task-hook-onStart",
                                            [v3_1.SemanticInternalAttributes.COLLAPSED]: true,
                                            "chat.id": currentWirePayload.chatId,
                                            "chat.turn": turn + 1,
                                            "chat.trigger": currentWirePayload.trigger,
                                            "chat.incoming_messages.count": cleanedUIMessages.length,
                                        },
                                    });
                                    // Per-turn merge of incoming wire messages onto the hydrated
                                    // chain. Hydrated stays authoritative for text, reasoning
                                    // blobs, provider metadata, and tool `input`; we only
                                    // overlay tool-part state/output/errorText for tool calls
                                    // the wire copy has just resolved. Apps that slim the wire
                                    // copy to fit the .in/append cap (or drop fields they
                                    // re-source from their own DB) get the hydrated copy
                                    // through unchanged.
                                    const merged = [...hydrated];
                                    for (const incoming of cleanedUIMessages) {
                                        if (!incoming.id)
                                            continue;
                                        const idx = merged.findIndex((m) => m.id === incoming.id);
                                        if (idx !== -1) {
                                            merged[idx] = mergeIncomingIntoHydrated(merged[idx], incoming);
                                        }
                                    }
                                    accumulatedUIMessages = merged;
                                    accumulatedMessages = await toModelMessages(merged);
                                    laneCompacted = false;
                                    laneInjections = [];
                                    locals_js_1.locals.set(chatCurrentUIMessagesKey, accumulatedUIMessages);
                                    // Track new messages for onTurnComplete.newUIMessages.
                                    // Only push for genuinely new ids — HITL continuations
                                    // whose incoming wire id matches an existing entry are
                                    // state advances on an old message, not new messages.
                                    // We compare against `previouslyKnownMessageIds`
                                    // captured BEFORE hydration, not against `hydrated`:
                                    // the canonical hydrate pattern pushes the incoming
                                    // user message into the persisted chain and returns
                                    // it, so the new id IS in `hydrated`, which would
                                    // wrongly drop every fresh user turn from
                                    // `newUIMessages`. The non-hydrate branch below has
                                    // the same "push only on append" semantic via its
                                    // own append-vs-replace path.
                                    if (currentWirePayload.trigger === "submit-message" &&
                                        cleanedUIMessages.length > 0) {
                                        const lastUI = cleanedUIMessages[cleanedUIMessages.length - 1];
                                        const matchedExisting = lastUI.id !== undefined && previouslyKnownMessageIds.has(lastUI.id);
                                        if (!matchedExisting) {
                                            turnNewUIMessages.push(lastUI);
                                            const lastModel = (await toModelMessages([lastUI]))[0];
                                            if (lastModel)
                                                turnNewModelMessages.push(lastModel);
                                        }
                                    }
                                }
                                else {
                                    // Default delta-merge accumulation.
                                    //
                                    // The accumulator was seeded at boot from snapshot+replay,
                                    // so it already reflects prior history. Per-turn handling
                                    // appends/replaces the single incoming delta message and
                                    // (for regenerate) trims the tail.
                                    if (currentWirePayload.trigger === "regenerate-message") {
                                        // Regenerate: trim trailing assistant messages from the
                                        // accumulator until the tail is a user message. AI SDK's
                                        // frontend `regenerate()` already removed the trailing
                                        // assistant from its local store; the wire signals "do
                                        // the same here", and the agent re-runs from the new
                                        // tail. No incoming message accompanies this trigger.
                                        while (accumulatedUIMessages.length > 0 &&
                                            accumulatedUIMessages[accumulatedUIMessages.length - 1].role !== "user") {
                                            accumulatedUIMessages.pop();
                                        }
                                        accumulatedMessages = await toModelMessages(accumulatedUIMessages);
                                        laneCompacted = false;
                                        laneInjections = [];
                                    }
                                    else if (cleanedUIMessages.length > 0) {
                                        // Submit-message (and the special-cased
                                        // handover-prepare → submit-message rewrite earlier in
                                        // this scope): merge-or-append for the single delta
                                        // message.
                                        //
                                        // Tool approval responses arrive as a single assistant
                                        // message whose id collides with the existing assistant
                                        // in the accumulator — we merge the resolved tool-part
                                        // resolutions onto the existing entry, keeping text,
                                        // reasoning, and tool `input` from the prior snapshot.
                                        // The fallback for HITL `addToolOutput` continuations
                                        // where AI SDK regenerates the id (TRI-9137) still
                                        // applies via `rewriteIncomingIdViaToolCallMap`.
                                        let replaced = false;
                                        const replacedPairs = [];
                                        for (const raw of cleanedUIMessages) {
                                            let incoming = raw;
                                            let idx = accumulatedUIMessages.findIndex((m) => m.id === incoming.id);
                                            if (idx === -1) {
                                                const rewritten = rewriteIncomingIdViaToolCallMap(incoming);
                                                if (rewritten.id !== incoming.id) {
                                                    incoming = rewritten;
                                                    idx = accumulatedUIMessages.findIndex((m) => m.id === incoming.id);
                                                }
                                            }
                                            if (idx !== -1) {
                                                const previous = accumulatedUIMessages[idx];
                                                accumulatedUIMessages[idx] = mergeIncomingIntoHydrated(previous, incoming);
                                                replacedPairs.push({ previous, merged: accumulatedUIMessages[idx] });
                                                replaced = true;
                                            }
                                            else {
                                                accumulatedUIMessages.push(incoming);
                                                turnNewUIMessages.push(incoming);
                                            }
                                            recordToolCallIdsFromMessage(incoming);
                                        }
                                        if (replaced) {
                                            let inPlace = true;
                                            for (const { previous, merged } of replacedPairs) {
                                                if (!(await replaceModelRun(accumulatedMessages, previous, merged, 0))) {
                                                    inPlace = false;
                                                    break;
                                                }
                                            }
                                            if (!inPlace) {
                                                v3_1.logger.warn("chat.agent: replaced message not found at the model lane tail; reconverting the lane");
                                                accumulatedMessages = await toModelMessages(accumulatedUIMessages);
                                                laneCompacted = false;
                                                laneInjections = [];
                                            }
                                        }
                                        else {
                                            const incomingModelMessages = await toModelMessages(cleanedUIMessages);
                                            accumulatedMessages.push(...incomingModelMessages);
                                        }
                                        if (turnNewUIMessages.length > 0) {
                                            turnNewModelMessages.push(...(await toModelMessages(turnNewUIMessages)));
                                        }
                                    }
                                    // `preload` / `close` / `handover-prepare` and submits
                                    // with no incoming message fall through with the boot-
                                    // seeded accumulator unchanged.
                                }
                                if (turn === 0) {
                                    // Head-start handover splice (turn 0 only, BOTH
                                    // accumulation branches — hydrate and default): the
                                    // `chat.handover` route handler signalled a mid-turn
                                    // handover, so splice its partial assistant response
                                    // (text + pending tool-calls + the synthesized
                                    // tool-approval round) onto the accumulator.
                                    // `streamText` then hits AI SDK's initial-tool-
                                    // execution branch, runs the agent-side tool executes,
                                    // and resumes from step 2 — skipping the first model
                                    // call (already done by the handler).
                                    //
                                    // We also synthesize a UIMessage form of the partial
                                    // assistant and push it to `accumulatedUIMessages` so
                                    // AI SDK's `processUIMessageStream` (invoked when the
                                    // run loop calls `runResult.toUIMessageStream({
                                    // onFinish })`) can initialize `state.message` from
                                    // the trailing assistant in `originalMessages`. Without
                                    // that, the `tool-output-available` chunks emitted by
                                    // the initial-tool-execution branch can't find their
                                    // matching tool-call in state and AI SDK throws
                                    // `UIMessageStreamError: No tool invocation found`.
                                    const pendingHandoverPartial = locals_js_1.locals.get(chatHandoverPartialKey);
                                    if (pendingHandoverPartial && pendingHandoverPartial.length > 0) {
                                        const spliced = spliceHandoverPartial(accumulatedMessages, accumulatedUIMessages, {
                                            partialAssistantMessage: pendingHandoverPartial,
                                            messageId: locals_js_1.locals.get(chatHandoverMessageIdKey),
                                        });
                                        if (spliced)
                                            locals_js_1.locals.set(chatHandoverSplicedRunKey, spliced);
                                        locals_js_1.locals.set(chatHandoverPartialKey, []); // consume once
                                        splicedHandoverPartial = true;
                                    }
                                }
                                locals_js_1.locals.set(chatCurrentUIMessagesKey, accumulatedUIMessages);
                            } // end if (trigger !== "action")
                            // ── No-op turn ──────────────────────────────────────────
                            //
                            // A submit that added no new user message and leaves the model
                            // chain ending on an assistant message has nothing to answer —
                            // calling the model would prefill its own last reply. Keyed on
                            // the model tail, so a `tool`-terminated chain (a merged tool
                            // approval) still runs.
                            const isNoOpTurn = !isAction &&
                                !splicedHandoverPartial &&
                                currentWirePayload.trigger === "submit-message" &&
                                turnNewUIMessages.length === 0 &&
                                accumulatedMessages[accumulatedMessages.length - 1]?.role === "assistant";
                            if (isNoOpTurn) {
                                msgSub?.off();
                                v3_1.logger.warn("chat.agent: turn added no new user message; skipping the model", {
                                    chatId: currentWirePayload.chatId,
                                    messageId: currentWirePayload.messageId,
                                });
                                settleRecoveredTurn(currentWirePayload);
                                await writeTurnCompleteChunk(currentWirePayload.chatId);
                                // Not a turn — don't consume an iteration.
                                turn--;
                            }
                            // ── Action result handling ──────────────────────────────
                            // For action turns, skip the turn machinery entirely.
                            // If `onAction` returned a stream / string / UIMessage,
                            // pipe it as the response. Either way, emit
                            // `trigger:turn-complete` and then fall through to the
                            // wait-for-next-message logic (shared with message turns).
                            // The turn counter is decremented so the next iteration
                            // sees the same `turn` value — actions don't count.
                            if (isAction) {
                                if (isActionTurn(actionResult)) {
                                    // Persist the edit before the turn starts, so a turn that is
                                    // cancelled or runs out of memory continues from the edited
                                    // history rather than from the snapshot the edit replaced.
                                    // The turn then does its own hooks, completion and snapshot.
                                    if (actionChangedHistory) {
                                        await writeSnapshotOutsideTurn("action", { turn, clientData });
                                    }
                                    actionTurn = true;
                                }
                                else if (actionResult !== undefined) {
                                    throw new Error("chat.agent: onAction returned a value. An action is a state edit; to answer " +
                                        "after the edit, return chat.turn() and a turn runs on the edited history. " +
                                        "Returning a StreamTextResult, string or UIMessage is no longer supported.");
                                }
                                else {
                                    msgSub?.off();
                                    if (actionChangedHistory) {
                                        await writeSnapshotOutsideTurn("action", { turn, clientData });
                                    }
                                    await writeTurnCompleteChunk(currentWirePayload.chatId);
                                    // Don't consume a turn iteration — actions aren't turns.
                                    turn--;
                                }
                            }
                            // A no-op turn skips this block, and with it `followSessionPin`:
                            // there is nothing to answer, so nothing to hand over.
                            if ((!isAction || actionTurn) && !isNoOpTurn) {
                                if (!hydrateMessages) {
                                    chatDeferBeforeOutput(saveTranscript({
                                        reason: "turn-start",
                                        messages: accumulatedUIMessages,
                                        turn,
                                        trigger: storageTrigger(currentWirePayload.trigger),
                                        clientData,
                                        lastOutEventId: lastSnapshotOutEventId,
                                        skipIfUnchanged: true,
                                        carryInCursor: true,
                                    }).catch((error) => {
                                        v3_1.logger.warn("chat.agent: turn-start transcript write failed; a reload mid-answer may not show the message being answered", {
                                            error: error instanceof Error ? error.message : String(error),
                                            sessionId: sessionIdForSnapshot,
                                        });
                                    }));
                                }
                                // Mint a scoped public access token once per turn, reused for
                                // onChatStart, onTurnStart, onTurnComplete, and the turn-complete chunk.
                                const currentRunId = ctx.run.id;
                                let turnAccessToken = "";
                                if (currentRunId) {
                                    try {
                                        turnAccessToken = await auth_js_1.auth.createPublicToken({
                                            scopes: {
                                                read: {
                                                    runs: currentRunId,
                                                    sessions: payload.chatId,
                                                },
                                                write: {
                                                    inputStreams: currentRunId,
                                                    sessions: payload.chatId,
                                                },
                                            },
                                            expirationTime: chatAccessTokenTTL,
                                        });
                                    }
                                    catch {
                                        // Token creation failed
                                    }
                                }
                                // Fire onChatStart on the very first message of a chat
                                // (across the chat's entire lifetime). Gated on
                                // `!couldHavePriorState` so it does NOT re-fire on
                                // continuation runs (post-`endRun`, post-waitpoint-timeout)
                                // or on OOM-retry attempts. Customers put one-time
                                // chat-setup work in `onChatStart` (e.g. create the Chat
                                // DB row, init user context) and that contract relies on
                                // it firing exactly once per chat.
                                if (turn === 0 && onChatStart && !couldHavePriorState) {
                                    await tracer_js_1.tracer.startActiveSpan("onChatStart()", async () => {
                                        await withChatWriter(async (writer) => {
                                            await onChatStart({
                                                ctx,
                                                chatId: currentWirePayload.chatId,
                                                messages: accumulatedMessages,
                                                clientData,
                                                runId: currentRunId,
                                                chatAccessToken: turnAccessToken,
                                                continuation,
                                                previousRunId,
                                                preloaded,
                                                writer,
                                            });
                                        });
                                    }, {
                                        attributes: {
                                            [v3_1.SemanticInternalAttributes.STYLE_ICON]: "task-hook-onStart",
                                            [v3_1.SemanticInternalAttributes.COLLAPSED]: true,
                                            "chat.id": currentWirePayload.chatId,
                                            "chat.messages.count": accumulatedMessages.length,
                                            "chat.continuation": continuation,
                                            "chat.preloaded": preloaded,
                                            ...(previousRunId ? { "chat.previous_run_id": previousRunId } : {}),
                                        },
                                    });
                                }
                                // Fire onTurnStart before running user code — persist messages
                                // so a mid-stream page refresh still shows the user's message.
                                if (onTurnStart) {
                                    await tracer_js_1.tracer.startActiveSpan("onTurnStart()", async () => {
                                        await withChatWriter(async (writer) => {
                                            await onTurnStart({
                                                ctx,
                                                chatId: currentWirePayload.chatId,
                                                messages: accumulatedMessages,
                                                uiMessages: accumulatedUIMessages,
                                                turn,
                                                runId: currentRunId,
                                                chatAccessToken: turnAccessToken,
                                                clientData,
                                                continuation,
                                                previousRunId,
                                                preloaded,
                                                previousTurnUsage,
                                                totalUsage: cumulativeUsage,
                                                writer,
                                            });
                                        });
                                        // Check if onTurnStart replaced messages (compaction or chat.history)
                                        const turnStartOverride = locals_js_1.locals.get(chatOverrideMessagesKey);
                                        if (turnStartOverride) {
                                            locals_js_1.locals.set(chatOverrideMessagesKey, undefined);
                                            accumulatedUIMessages = [...turnStartOverride];
                                            accumulatedMessages = await toModelMessages(turnStartOverride);
                                            laneCompacted = false;
                                            laneInjections = [];
                                            locals_js_1.locals.set(chatCurrentUIMessagesKey, accumulatedUIMessages);
                                        }
                                    }, {
                                        attributes: {
                                            [v3_1.SemanticInternalAttributes.STYLE_ICON]: "task-hook-onStart",
                                            [v3_1.SemanticInternalAttributes.COLLAPSED]: true,
                                            "chat.id": currentWirePayload.chatId,
                                            "chat.turn": turn + 1,
                                            "chat.messages.count": accumulatedMessages.length,
                                            "chat.trigger": currentWirePayload.trigger,
                                            "chat.continuation": continuation,
                                            "chat.preloaded": preloaded,
                                            ...(previousRunId ? { "chat.previous_run_id": previousRunId } : {}),
                                        },
                                    });
                                }
                                await followSessionPin(currentWirePayload.chatId, versionSkew);
                                // chat.requestUpgrade() called in onTurnStart (or onValidateMessages) —
                                // skip run() and hand over to a fresh run on the new version. The
                                // successor picks the message up off session.in; the transport only
                                // keeps reading.
                                if (locals_js_1.locals.get(chatUpgradeRequestedKey)) {
                                    await writeUpgradeRequiredChunk();
                                    return "exit";
                                }
                                // Captured by the onFinish callback below — works even on abort/stop.
                                let capturedResponseMessage;
                                let capturedFinishReason;
                                // Promise that resolves when the AI SDK's onFinish fires.
                                // On abort, the stream's cancel() handler calls onFinish
                                // asynchronously AFTER pipeChat resolves, so we must await
                                // this to avoid a race where we check capturedResponseMessage
                                // before it's been set.
                                let resolveOnFinish;
                                const onFinishPromise = new Promise((r) => {
                                    resolveOnFinish = r;
                                });
                                let onFinishAttached = false;
                                let runResult;
                                // Pure-text head-start: customer's step 1 IS the
                                // final response. Skip the user's `run` callback
                                // (no LLM call) and use the synthesized partial
                                // UIMessage as `capturedResponseMessage`. The post-
                                // turn flow (`onBeforeTurnComplete` →
                                // `onTurnComplete` → trigger:turn-complete) fires
                                // normally so persistence works.
                                const headStartIsFinal = locals_js_1.locals.get(chatHandoverIsFinalKey);
                                const isHeadStartFinalTurn = turn === 0 && headStartIsFinal === true;
                                if (isHeadStartFinalTurn) {
                                    locals_js_1.locals.set(chatHandoverIsFinalKey, undefined); // consume once
                                }
                                try {
                                    // Drain any messages injected by background work (e.g. self-review from previous turn).
                                    // Skip if the last message is a tool message — appending after it would
                                    // prevent streamText from finding pending tool approvals (it checks
                                    // the last message). The queued messages will be picked up by prepareStep
                                    // at the next step boundary instead.
                                    const lastAccumulated = accumulatedMessages[accumulatedMessages.length - 1];
                                    const bgQueue = locals_js_1.locals.get(chatBackgroundQueueKey);
                                    if (bgQueue && bgQueue.length > 0 && lastAccumulated?.role !== "tool") {
                                        const injected = bgQueue.splice(0);
                                        accumulatedMessages.push(...injected);
                                        laneInjections.push({
                                            afterId: accumulatedUIMessages.at(-1)?.id ?? "",
                                            messages: injected,
                                        });
                                    }
                                    if (isHeadStartFinalTurn) {
                                        // The synthesized partial UIMessage IS the response.
                                        // It was pushed to `accumulatedUIMessages` during the
                                        // submit-message branch's splice; recover it as the
                                        // last assistant.
                                        const lastUI = accumulatedUIMessages[accumulatedUIMessages.length - 1];
                                        if (lastUI && lastUI.role === "assistant") {
                                            capturedResponseMessage = lastUI;
                                            capturedFinishReason = "stop";
                                        }
                                        // Don't call userRun. Don't pipe. Skip directly
                                        // to the post-turn flow below.
                                    }
                                    else {
                                        const preparedMessages = await applyPrepareMessages(accumulatedMessages, "run");
                                        runResult = await userRun({
                                            ...restWire,
                                            // A turn requested by chat.turn() is not the action itself:
                                            // a run() that short-circuits on "action" must still answer.
                                            ...(actionTurn ? { trigger: "action-turn" } : {}),
                                            messages: preparedMessages,
                                            clientData,
                                            continuation,
                                            previousRunId,
                                            preloaded,
                                            previousTurnUsage,
                                            totalUsage: cumulativeUsage,
                                            ctx,
                                            tools: locals_js_1.locals.get(chatResolvedToolsKey) ?? {},
                                            signal: combinedSignal,
                                            cancelSignal,
                                            stopSignal,
                                            streamText: createBoundStreamText(promptRegistry, agentSystem, agentCacheControl, agentSystemProviderOptions),
                                        });
                                    }
                                    // Auto-pipe if the run function returned a StreamTextResult or similar,
                                    // but only if pipeChat() wasn't already called manually during this turn.
                                    // We call toUIMessageStream ourselves to attach onFinish for response capture.
                                    // Pass originalMessages so the AI SDK reuses message IDs across turns
                                    // (e.g. for tool approval continuations / HITL flows).
                                    if ((locals_js_1.locals.get(chatPipeCountKey) ?? 0) === 0 &&
                                        isUIMessageStreamable(runResult)) {
                                        onFinishAttached = true;
                                        const resolvedOptions = resolveUIMessageStreamOptions();
                                        // For action turns, don't pass originalMessages: the response
                                        // should always be a fresh assistant message, not a continuation
                                        // of whatever trailing assistant was left after chat.history
                                        // mutations.
                                        const isActionTurn = currentWirePayload.trigger === "action";
                                        const uiStream = runResult.toUIMessageStream({
                                            ...resolvedOptions,
                                            // Pass originalMessages so the AI SDK reuses message IDs across
                                            // turns (e.g. for tool approval continuations / HITL flows).
                                            // Omit for action turns to force a fresh response ID.
                                            ...(isActionTurn ? {} : { originalMessages: accumulatedUIMessages }),
                                            // Always provide generateMessageId so the start chunk carries a
                                            // messageId. Without this, the frontend and backend generate IDs
                                            // independently and they won't match for ID-based dedup.
                                            generateMessageId: resolvedOptions.generateMessageId ?? ai_runtime_js_1.generateId,
                                            onFinish: ({ responseMessage, finishReason, }) => {
                                                capturedResponseMessage = responseMessage;
                                                capturedPartialResponse = responseMessage;
                                                capturedFinishReason = finishReason;
                                                resolveOnFinish();
                                            },
                                        });
                                        await pipeChat(tapUIMessageChunks(uiStream, turnBufferedChunks), {
                                            signal: combinedSignal,
                                            spanName: "stream response",
                                        });
                                    }
                                }
                                catch (error) {
                                    // Handle AbortError from streamText gracefully
                                    if (error instanceof Error && error.name === "AbortError") {
                                        if (runSignal.aborted) {
                                            return "exit"; // Full run cancellation — exit
                                        }
                                        // Stop generation — fall through to continue the loop
                                    }
                                    else {
                                        throw error;
                                    }
                                }
                                finally {
                                    msgSub?.off();
                                }
                                // Wait for onFinish to fire — on abort this may resolve slightly
                                // after pipeChat, since the stream's cancel() handler is async.
                                // Race with a timeout so a stop-abort that prevents onFinish from
                                // firing doesn't hang the turn loop indefinitely.
                                if (onFinishAttached) {
                                    await Promise.race([
                                        onFinishPromise,
                                        new Promise((r) => setTimeout(r, 2_000)),
                                    ]);
                                }
                                // Capture token usage from the streamText result (if available).
                                // totalUsage is a PromiseLike that resolves after the stream is consumed.
                                // Race with a 2s timeout — on stop-abort the AI SDK's totalUsage
                                // promise can hang indefinitely (the underlying provider stream
                                // never reports final usage), which would block the turn loop
                                // from ever firing onTurnComplete / writeTurnComplete.
                                let turnUsage;
                                let lastStepUsage;
                                if (runResult != null &&
                                    typeof runResult.totalUsage?.then === "function") {
                                    try {
                                        turnUsage = (await Promise.race([
                                            runResult.totalUsage,
                                            new Promise((r) => setTimeout(() => r(undefined), 2_000)),
                                        ]));
                                    }
                                    catch {
                                        /* non-fatal — usage capture failed */
                                    }
                                }
                                const lastStepUsagePromise = runResult != null ? runResult.usage : undefined;
                                if (typeof lastStepUsagePromise?.then === "function") {
                                    try {
                                        lastStepUsage = (await Promise.race([
                                            lastStepUsagePromise,
                                            new Promise((r) => setTimeout(() => r(undefined), 2_000)),
                                        ]));
                                    }
                                    catch {
                                        /* non-fatal — usage capture failed */
                                    }
                                }
                                if (turnUsage) {
                                    cumulativeUsage = addUsage(cumulativeUsage, turnUsage);
                                    previousTurnUsage = turnUsage;
                                    // Add usage attributes to the turn span
                                    if (turnUsage.inputTokens != null) {
                                        turnSpan.setAttribute("gen_ai.usage.input_tokens", turnUsage.inputTokens);
                                    }
                                    if (turnUsage.outputTokens != null) {
                                        turnSpan.setAttribute("gen_ai.usage.output_tokens", turnUsage.outputTokens);
                                    }
                                    if (turnUsage.totalTokens != null) {
                                        turnSpan.setAttribute("gen_ai.usage.total_tokens", turnUsage.totalTokens);
                                    }
                                    if (cumulativeUsage.totalTokens != null) {
                                        turnSpan.setAttribute("gen_ai.usage.cumulative_total_tokens", cumulativeUsage.totalTokens);
                                    }
                                    if (cumulativeUsage.inputTokens != null) {
                                        turnSpan.setAttribute("gen_ai.usage.cumulative_input_tokens", cumulativeUsage.inputTokens);
                                    }
                                    if (cumulativeUsage.outputTokens != null) {
                                        turnSpan.setAttribute("gen_ai.usage.cumulative_output_tokens", cumulativeUsage.outputTokens);
                                    }
                                }
                                // Check if run() (e.g. via prepareStep or chat.history) replaced messages
                                // during this turn. The updated messages become the new base, and the
                                // response gets appended on top.
                                const runOverride = locals_js_1.locals.get(chatOverrideMessagesKey);
                                if (runOverride) {
                                    locals_js_1.locals.set(chatOverrideMessagesKey, undefined);
                                    accumulatedUIMessages = [...runOverride];
                                    /**
                                     * Steers the drain consumed are left out of the rebuild and
                                     * appended by the reconciliation below instead, so the lane
                                     * gets the form the model actually received rather than a
                                     * reconversion of the UI message, and gets it once. A steer
                                     * the edit removed is dropped from the pending list too, so
                                     * the edit is honoured.
                                     */
                                    const overrideIds = new Set(runOverride.map((m) => m.id));
                                    const pending = (locals_js_1.locals.get(chatPendingSteerKey) ?? []).filter((e) => overrideIds.has(e.ui.id));
                                    locals_js_1.locals.set(chatPendingSteerKey, pending);
                                    const pendingIds = new Set(pending.map((e) => e.ui.id));
                                    accumulatedMessages = await toModelMessages(runOverride.filter((m) => !pendingIds.has(m.id)));
                                    laneCompacted = false;
                                    laneInjections = [];
                                    locals_js_1.locals.set(chatCurrentUIMessagesKey, accumulatedUIMessages);
                                }
                                // Check if compaction set a model-only override (preserves UI messages).
                                // Apply compactUIMessages/compactModelMessages callbacks if configured.
                                const modelOnlyOverride = locals_js_1.locals.get(chatOverrideModelMessagesKey);
                                const responseCompaction = modelOnlyOverride
                                    ? locals_js_1.locals.get(chatCompactionStateKey)
                                    : undefined;
                                // Capture the original assistant before compactUIMessages can remove it.
                                const originalResponse = responseCompaction && capturedResponseMessage
                                    ? accumulatedUIMessages.find((m) => m.id === capturedResponseMessage?.id)
                                    : undefined;
                                if (modelOnlyOverride) {
                                    const compactionSummary = locals_js_1.locals.get(chatCompactionStateKey)?.summary ?? "";
                                    const taskCompactionConfig = locals_js_1.locals.get(chatAgentCompactionKey);
                                    locals_js_1.locals.set(chatOverrideModelMessagesKey, undefined);
                                    const compactEvent = {
                                        summary: compactionSummary,
                                        uiMessages: accumulatedUIMessages,
                                        modelMessages: accumulatedMessages,
                                        chatId: currentWirePayload.chatId,
                                        turn,
                                        clientData,
                                        source: "inner",
                                    };
                                    // Apply model messages: callback or default (use override)
                                    accumulatedMessages = taskCompactionConfig?.compactModelMessages
                                        ? await taskCompactionConfig.compactModelMessages(compactEvent)
                                        : modelOnlyOverride;
                                    laneCompacted = true;
                                    laneInjections = [];
                                    // Apply UI messages: callback or default (preserve all)
                                    if (taskCompactionConfig?.compactUIMessages) {
                                        accumulatedUIMessages = (await taskCompactionConfig.compactUIMessages(compactEvent));
                                    }
                                }
                                // Determine if the user stopped generation this turn (not a full run cancel).
                                const wasStopped = stopController.signal.aborted && !runSignal.aborted;
                                // Give the model accumulator the steering messages the drain
                                // consumed. Appended, never reconverted from the UI lane, so a
                                // model-only compaction summary set just above survives; and done
                                // before the response is appended so the order stays
                                // steer-then-answer. Outside the `capturedResponseMessage`
                                // branches below, so a turn that captured no response is covered.
                                const steerTailThisTurn = reconcilePendingSteer({
                                    turnNew: turnNewModelMessages,
                                }).reduce((n, e) => n + e.model.length, 0) + reconcilePendingBackground();
                                // Append the assistant's response (partial or complete) to the accumulator.
                                // The onFinish callback fires even on abort/stop, so partial responses
                                // from stopped generation are captured correctly.
                                let rawResponseMessage;
                                let responseWasSkipped = false;
                                if (capturedResponseMessage) {
                                    // Keep the raw message before cleanup for users who want custom handling
                                    rawResponseMessage = capturedResponseMessage;
                                    // Clean up aborted parts (streaming tool calls, reasoning) when stopped
                                    if (wasStopped) {
                                        capturedResponseMessage = cleanupAbortedParts(capturedResponseMessage);
                                    }
                                    // Ensure the response message has an ID (the stream's onFinish
                                    // may produce a message with an empty ID since IDs are normally
                                    // assigned by the frontend's useChat).
                                    if (!capturedResponseMessage.id) {
                                        capturedResponseMessage = {
                                            ...capturedResponseMessage,
                                            id: (0, ai_runtime_js_1.generateId)(),
                                        };
                                    }
                                    // Append any non-transient data parts queued via chat.response or writer.write()
                                    const queuedParts = locals_js_1.locals.get(chatResponsePartsKey);
                                    if (queuedParts && queuedParts.length > 0) {
                                        capturedResponseMessage = {
                                            ...capturedResponseMessage,
                                            parts: [...capturedResponseMessage.parts, ...queuedParts],
                                        };
                                        locals_js_1.locals.set(chatResponsePartsKey, []);
                                    }
                                    const responseHasContent = capturedResponseMessage.parts.some((part) => part.type !== "step-start");
                                    if (responseHasContent) {
                                        // Tool-approval continuations: the AI SDK reuses the trailing
                                        // assistant's ID (via originalMessages) so the captured response
                                        // carries the same ID as an existing message. Replace in place
                                        // instead of pushing a duplicate. For action turns this never
                                        // matches because originalMessages is omitted (fresh ID).
                                        const existingIdx = capturedResponseMessage.id
                                            ? accumulatedUIMessages.findIndex((m) => m.id === capturedResponseMessage.id)
                                            : -1;
                                        const previousAtIdx = existingIdx !== -1 ? accumulatedUIMessages[existingIdx] : undefined;
                                        if (existingIdx !== -1) {
                                            accumulatedUIMessages[existingIdx] = capturedResponseMessage;
                                        }
                                        else {
                                            accumulatedUIMessages.push(capturedResponseMessage);
                                        }
                                        turnNewUIMessages.push(capturedResponseMessage);
                                        locals_js_1.locals.set(chatCurrentUIMessagesKey, accumulatedUIMessages);
                                        // Record toolCallId → head messageId so a HITL
                                        // continuation next turn can recover the head id
                                        // even if the AI SDK regenerates it. See
                                        // `chatToolCallToMessageIdKey` for the full
                                        // rationale (TRI-9137).
                                        recordToolCallIdsFromMessage(capturedResponseMessage);
                                        try {
                                            const responseForModel = (0, compactionResponse_js_1.responseAfterCompaction)(capturedResponseMessage, responseCompaction?.baseResponseStepCount, originalResponse);
                                            // Preserve the complete persistence response, including same-ID
                                            // replacements whose old tool parts can contain new results.
                                            // Convert prefix and suffix separately so each tool output is
                                            // converted once, while only the suffix enters model context.
                                            const responsePrefixMessages = responseCompaction
                                                ? await toModelMessages([
                                                    stripProviderMetadata({
                                                        ...capturedResponseMessage,
                                                        parts: capturedResponseMessage.parts.slice(0, capturedResponseMessage.parts.length -
                                                            responseForModel.parts.length),
                                                    }),
                                                ])
                                                : [];
                                            const responseModelMessages = await toModelMessages([
                                                stripProviderMetadata(responseForModel),
                                            ]);
                                            if (responseCompaction) {
                                                // The summary already replaced the original response, including
                                                // a same-ID approval/handover prefix. Replacing its old model run
                                                // would miss and fall back to the full, uncompacted UI history.
                                                accumulatedMessages.push(...responseModelMessages);
                                                locals_js_1.locals.set(chatHandoverSplicedRunKey, undefined);
                                            }
                                            else if (existingIdx !== -1) {
                                                const spliced = locals_js_1.locals.get(chatHandoverSplicedRunKey);
                                                const splicedRun = spliced && previousAtIdx && spliced.id === previousAtIdx.id
                                                    ? spliced.run
                                                    : undefined;
                                                const ok = previousAtIdx !== undefined &&
                                                    (await replaceModelRun(accumulatedMessages, previousAtIdx, capturedResponseMessage, steerTailThisTurn, splicedRun));
                                                if (splicedRun)
                                                    locals_js_1.locals.set(chatHandoverSplicedRunKey, undefined);
                                                if (!ok) {
                                                    v3_1.logger.warn("chat.agent: replaced response not found at the model lane tail; reconverting the lane");
                                                    accumulatedMessages = await toModelMessages(accumulatedUIMessages);
                                                    laneCompacted = false;
                                                    laneInjections = [];
                                                }
                                            }
                                            else {
                                                accumulatedMessages.push(...responseModelMessages);
                                            }
                                            turnNewModelMessages.push(...responsePrefixMessages, ...responseModelMessages);
                                        }
                                        catch {
                                            // Conversion failed — skip accumulation for this turn
                                        }
                                    }
                                    else {
                                        responseWasSkipped = true;
                                    }
                                }
                                // If there's no captured response (manual pipe mode) but there are
                                // queued data parts, create a minimal response message to hold them.
                                if (!capturedResponseMessage) {
                                    const remainingParts = locals_js_1.locals.get(chatResponsePartsKey);
                                    if (remainingParts && remainingParts.length > 0) {
                                        capturedResponseMessage = {
                                            id: (0, ai_runtime_js_1.generateId)(),
                                            role: "assistant",
                                            parts: [...remainingParts],
                                        };
                                        locals_js_1.locals.set(chatResponsePartsKey, []);
                                        accumulatedUIMessages.push(capturedResponseMessage);
                                        turnNewUIMessages.push(capturedResponseMessage);
                                        locals_js_1.locals.set(chatCurrentUIMessagesKey, accumulatedUIMessages);
                                    }
                                }
                                if (capturedResponseMessage) {
                                    responseCommitted = true;
                                    capturedPartialResponse = capturedResponseMessage;
                                    turnBufferedChunks.length = 0;
                                }
                                if (runSignal.aborted)
                                    return "exit";
                                // Await deferred background work (e.g. DB writes from onTurnStart)
                                // before firing hooks so they can rely on the work being done.
                                const deferredWork = locals_js_1.locals.get(chatDeferKey);
                                if (deferredWork && deferredWork.size > 0) {
                                    await Promise.race([
                                        Promise.allSettled(deferredWork),
                                        new Promise((r) => setTimeout(r, 5_000)),
                                    ]);
                                }
                                // Outer-loop compaction: runs between turns for single-step responses
                                // where prepareStep never fires (no tool calls = no step boundaries).
                                // Only triggers when: task has compaction configured, prepareStep didn't
                                // already compact this turn, and shouldCompact returns true.
                                const outerCompaction = locals_js_1.locals.get(chatAgentCompactionKey);
                                const innerCompactionState = locals_js_1.locals.get(chatCompactionStateKey);
                                if (outerCompaction && !innerCompactionState && turnUsage && !wasStopped) {
                                    const contextUsage = lastStepUsage ?? turnUsage;
                                    const shouldTrigger = await outerCompaction.shouldCompact({
                                        messages: accumulatedMessages,
                                        totalTokens: contextUsage.totalTokens,
                                        inputTokens: contextUsage.inputTokens,
                                        outputTokens: contextUsage.outputTokens,
                                        usage: contextUsage,
                                        turnUsage,
                                        totalUsage: cumulativeUsage,
                                        chatId: currentWirePayload.chatId,
                                        turn,
                                        clientData,
                                        source: "outer",
                                    });
                                    if (shouldTrigger) {
                                        await tracer_js_1.tracer.startActiveSpan("context compaction (outer loop)", async (compactionSpan) => {
                                            const compactionId = (0, ai_runtime_js_1.generateId)();
                                            const { waitUntilComplete } = chatStream.writer({
                                                spanName: "stream compaction chunks",
                                                collapsed: true,
                                                execute: async ({ write, merge }) => {
                                                    write({
                                                        type: "data-compaction",
                                                        id: compactionId,
                                                        data: { status: "compacting", totalTokens: turnUsage.totalTokens },
                                                        transient: true,
                                                    });
                                                    const summary = await outerCompaction.summarize({
                                                        messages: accumulatedMessages,
                                                        usage: turnUsage,
                                                        totalUsage: cumulativeUsage,
                                                        chatId: currentWirePayload.chatId,
                                                        turn,
                                                        clientData,
                                                        source: "outer",
                                                    });
                                                    // Apply compactModelMessages/compactUIMessages callbacks, or defaults.
                                                    const outerCompactEvent = {
                                                        summary,
                                                        uiMessages: accumulatedUIMessages,
                                                        modelMessages: accumulatedMessages,
                                                        chatId: currentWirePayload.chatId,
                                                        turn,
                                                        clientData,
                                                        source: "outer",
                                                    };
                                                    // Model messages: callback or default (replace with summary)
                                                    accumulatedMessages = outerCompaction.compactModelMessages
                                                        ? await outerCompaction.compactModelMessages(outerCompactEvent)
                                                        : [
                                                            {
                                                                role: "assistant",
                                                                content: [
                                                                    {
                                                                        type: "text",
                                                                        text: `[Conversation summary]\n\n${summary}`,
                                                                    },
                                                                ],
                                                            },
                                                        ];
                                                    laneCompacted = true;
                                                    laneInjections = [];
                                                    // UI messages: callback or default (preserve all)
                                                    if (outerCompaction.compactUIMessages) {
                                                        accumulatedUIMessages = (await outerCompaction.compactUIMessages(outerCompactEvent));
                                                    }
                                                    // Fire onCompacted hook
                                                    const onCompactedHook = locals_js_1.locals.get(chatOnCompactedKey);
                                                    if (onCompactedHook) {
                                                        await onCompactedHook({
                                                            ctx,
                                                            summary,
                                                            messages: accumulatedMessages,
                                                            messageCount: accumulatedMessages.length,
                                                            usage: turnUsage,
                                                            totalTokens: turnUsage.totalTokens,
                                                            inputTokens: turnUsage.inputTokens,
                                                            outputTokens: turnUsage.outputTokens,
                                                            stepNumber: -1, // outer loop, not a step
                                                            chatId: currentWirePayload.chatId,
                                                            turn,
                                                            writer: { write, merge },
                                                        });
                                                    }
                                                    compactionSpan.setAttribute("compaction.summary_length", summary.length);
                                                    write({
                                                        type: "data-compaction",
                                                        id: compactionId,
                                                        data: { status: "complete", totalTokens: turnUsage.totalTokens },
                                                        transient: true,
                                                    });
                                                },
                                            });
                                            await waitUntilComplete();
                                        }, {
                                            attributes: {
                                                [v3_1.SemanticInternalAttributes.STYLE_ICON]: "tabler-scissors",
                                                "compaction.total_tokens": turnUsage.totalTokens ?? 0,
                                                "compaction.input_tokens": turnUsage.inputTokens ?? 0,
                                                "compaction.message_count": accumulatedMessages.length,
                                                "compaction.outer_loop": true,
                                                "compaction.turn": turn,
                                                ...(currentWirePayload.chatId
                                                    ? { "compaction.chat_id": currentWirePayload.chatId }
                                                    : {}),
                                                ...(0, v3_1.accessoryAttributes)({
                                                    items: [
                                                        { text: `${turnUsage.totalTokens ?? 0} tokens`, variant: "normal" },
                                                        { text: `${accumulatedMessages.length} msgs`, variant: "normal" },
                                                        { text: "outer loop", variant: "normal" },
                                                    ],
                                                    style: "codepath",
                                                }),
                                            },
                                        });
                                    }
                                }
                                const turnCompleteEvent = {
                                    ctx,
                                    chatId: currentWirePayload.chatId,
                                    messages: accumulatedMessages,
                                    uiMessages: accumulatedUIMessages,
                                    newMessages: turnNewModelMessages,
                                    newUIMessages: turnNewUIMessages,
                                    responseMessage: capturedResponseMessage,
                                    rawResponseMessage,
                                    turn,
                                    runId: currentRunId,
                                    chatAccessToken: turnAccessToken,
                                    clientData,
                                    stopped: wasStopped,
                                    continuation,
                                    previousRunId,
                                    preloaded,
                                    usage: turnUsage,
                                    totalUsage: cumulativeUsage,
                                    finishReason: capturedFinishReason,
                                };
                                // Fire onBeforeTurnComplete — stream is still open so the hook
                                // can write custom chunks to the frontend (e.g. compaction progress).
                                if (onBeforeTurnComplete) {
                                    await tracer_js_1.tracer.startActiveSpan("onBeforeTurnComplete()", async () => {
                                        await withChatWriter(async (writer) => {
                                            await onBeforeTurnComplete({ ...turnCompleteEvent, writer });
                                        });
                                        // Check if the hook replaced messages (compaction or chat.history)
                                        const override = locals_js_1.locals.get(chatOverrideMessagesKey);
                                        if (override) {
                                            locals_js_1.locals.set(chatOverrideMessagesKey, undefined);
                                            accumulatedUIMessages = [...override];
                                            accumulatedMessages = await toModelMessages(override);
                                            laneCompacted = false;
                                            laneInjections = [];
                                            locals_js_1.locals.set(chatCurrentUIMessagesKey, accumulatedUIMessages);
                                            // Update event so onTurnComplete sees compacted messages
                                            turnCompleteEvent.messages = accumulatedMessages;
                                            turnCompleteEvent.uiMessages = accumulatedUIMessages;
                                        }
                                    }, {
                                        attributes: {
                                            [v3_1.SemanticInternalAttributes.STYLE_ICON]: "task-hook-onComplete",
                                            [v3_1.SemanticInternalAttributes.COLLAPSED]: true,
                                            "chat.id": currentWirePayload.chatId,
                                            "chat.turn": turn + 1,
                                        },
                                    });
                                }
                                // Drain any late response parts added during onBeforeTurnComplete
                                const lateParts = locals_js_1.locals.get(chatResponsePartsKey);
                                if (lateParts && lateParts.length > 0 && capturedResponseMessage) {
                                    const idx = accumulatedUIMessages.findIndex((m) => m.id === capturedResponseMessage.id);
                                    if (idx !== -1) {
                                        const msg = accumulatedUIMessages[idx];
                                        accumulatedUIMessages[idx] = {
                                            ...msg,
                                            parts: [...(msg.parts ?? []), ...lateParts],
                                        };
                                        capturedResponseMessage = accumulatedUIMessages[idx];
                                        capturedPartialResponse = capturedResponseMessage;
                                        turnCompleteEvent.responseMessage = capturedResponseMessage;
                                        turnCompleteEvent.uiMessages = accumulatedUIMessages;
                                        locals_js_1.locals.set(chatCurrentUIMessagesKey, accumulatedUIMessages);
                                    }
                                    else if (responseWasSkipped) {
                                        capturedResponseMessage = {
                                            ...capturedResponseMessage,
                                            parts: [...(capturedResponseMessage.parts ?? []), ...lateParts],
                                        };
                                        accumulatedUIMessages.push(capturedResponseMessage);
                                        turnNewUIMessages.push(capturedResponseMessage);
                                        capturedPartialResponse = capturedResponseMessage;
                                        turnCompleteEvent.responseMessage = capturedResponseMessage;
                                        turnCompleteEvent.uiMessages = accumulatedUIMessages;
                                        locals_js_1.locals.set(chatCurrentUIMessagesKey, accumulatedUIMessages);
                                    }
                                    locals_js_1.locals.set(chatResponsePartsKey, []);
                                }
                                settleRecoveredTurn(currentWirePayload);
                                // Write turn-complete control chunk — closes the frontend stream.
                                const turnCompleteResult = await writeTurnCompleteChunk(currentWirePayload.chatId, turnAccessToken);
                                // Fire onTurnComplete — stream is closed, use for persistence.
                                if (onTurnComplete) {
                                    await tracer_js_1.tracer.startActiveSpan("onTurnComplete()", async () => {
                                        await onTurnComplete({
                                            ...turnCompleteEvent,
                                            lastEventId: turnCompleteResult?.lastEventId,
                                        });
                                        // Check if onTurnComplete replaced messages (compaction or chat.history)
                                        const turnCompleteOverride = locals_js_1.locals.get(chatOverrideMessagesKey);
                                        if (turnCompleteOverride) {
                                            locals_js_1.locals.set(chatOverrideMessagesKey, undefined);
                                            accumulatedUIMessages = [...turnCompleteOverride];
                                            accumulatedMessages = await toModelMessages(turnCompleteOverride);
                                            laneCompacted = false;
                                            laneInjections = [];
                                            locals_js_1.locals.set(chatCurrentUIMessagesKey, accumulatedUIMessages);
                                        }
                                    }, {
                                        attributes: {
                                            [v3_1.SemanticInternalAttributes.STYLE_ICON]: "task-hook-onComplete",
                                            [v3_1.SemanticInternalAttributes.COLLAPSED]: true,
                                            "chat.id": currentWirePayload.chatId,
                                            "chat.turn": turn + 1,
                                            "chat.stopped": wasStopped,
                                            "chat.continuation": continuation,
                                            "chat.preloaded": preloaded,
                                            ...(previousRunId ? { "chat.previous_run_id": previousRunId } : {}),
                                            "chat.messages.count": accumulatedMessages.length,
                                            "chat.response.parts.count": capturedResponseMessage?.parts?.length ?? 0,
                                            "chat.new_messages.count": turnNewUIMessages.length,
                                            ...(turnUsage?.inputTokens != null
                                                ? { "gen_ai.usage.input_tokens": turnUsage.inputTokens }
                                                : {}),
                                            ...(turnUsage?.outputTokens != null
                                                ? { "gen_ai.usage.output_tokens": turnUsage.outputTokens }
                                                : {}),
                                            ...(turnUsage?.totalTokens != null
                                                ? { "gen_ai.usage.total_tokens": turnUsage.totalTokens }
                                                : {}),
                                            ...(cumulativeUsage.totalTokens != null
                                                ? {
                                                    "gen_ai.usage.cumulative_total_tokens": cumulativeUsage.totalTokens,
                                                }
                                                : {}),
                                        },
                                    });
                                }
                                // ── Snapshot write ─────────────────────────────────────
                                //
                                // Persist the post-turn accumulator so the next run boot
                                // can replay history without the wire shipping it. Skipped
                                // when `hydrateMessages` is registered — those customers
                                // own persistence and would never read this blob.
                                //
                                // AWAITED, not fire-and-forget: the agent may suspend (idle
                                // timeout) immediately after this point, and in-flight
                                // promises don't reliably complete on suspend. The user-
                                // visible turn already finished (the turn-complete chunk
                                // closed the response stream above), so the await delay
                                // only affects "when can the NEXT turn start," gated by
                                // user typing — not TTFC.
                                //
                                // `writeChatSnapshot` swallows errors internally; this
                                // outer try/catch is just belt-and-suspenders against
                                // tracer/span failures.
                                if (!hydrateMessages) {
                                    try {
                                        await tracer_js_1.tracer.startActiveSpan("snapshot.write", async () => {
                                            lastSnapshotOutEventId =
                                                turnCompleteResult?.lastEventId ?? lastSnapshotOutEventId;
                                            await saveTranscript({
                                                reason: "turn-complete",
                                                messages: accumulatedUIMessages,
                                                turn,
                                                trigger: storageTrigger(currentWirePayload.trigger),
                                                clientData,
                                                lastOutEventId: lastSnapshotOutEventId,
                                                nonFinalIds: wasStopped && capturedResponseMessage?.id
                                                    ? new Set([capturedResponseMessage.id])
                                                    : undefined,
                                            });
                                        }, {
                                            attributes: {
                                                [v3_1.SemanticInternalAttributes.STYLE_ICON]: "task-hook-onComplete",
                                                [v3_1.SemanticInternalAttributes.COLLAPSED]: true,
                                                "chat.id": currentWirePayload.chatId,
                                                "chat.turn": turn + 1,
                                                "chat.messages.count": accumulatedUIMessages.length,
                                            },
                                        });
                                    }
                                    catch (error) {
                                        v3_1.logger.warn("chat.agent: snapshot write failed; next run will replay further", {
                                            error: error instanceof Error ? error.message : String(error),
                                            sessionId: sessionIdForSnapshot,
                                        });
                                    }
                                }
                            } // end if (!isAction)
                            // NOTE: We intentionally do NOT await deferred work from onTurnComplete here.
                            // Promises deferred in onTurnComplete (e.g. background self-review via
                            // chat.defer + chat.inject) run during the idle wait. If they complete
                            // before the next message, their injected context is picked up in prepareStep.
                            // The pre-onBeforeTurnComplete drain handles promises from onTurnStart/run().
                            // Recovery-boot injection: drain remaining recovered turns
                            // before any other source. `onRecoveryBoot` (or its default)
                            // produced these from in-flight user messages on session.in
                            // that the dead predecessor never acknowledged.
                            if (bootInjectedQueue.length > 0) {
                                currentWirePayload = dispatchBootInjected();
                                return "continue";
                            }
                            // chat.requestUpgrade() was called — exit the loop; the handover
                            // has already triggered a new run on the latest version.
                            // chat.endRun() — same exit, no upgrade semantics.
                            if (locals_js_1.locals.get(chatCloseRequestedKey)) {
                                await performChatClose();
                                return "exit";
                            }
                            if (locals_js_1.locals.get(chatUpgradeRequestedKey) || locals_js_1.locals.get(chatEndRunRequestedKey)) {
                                if (locals_js_1.locals.get(chatUpgradeRequestedKey)) {
                                    await persistUpgradeHandoff();
                                }
                                return "exit";
                            }
                            // Wait for the next message — stay idle briefly, then suspend
                            const effectiveIdleTimeout = metadata_js_1.metadata.get(IDLE_TIMEOUT_METADATA_KEY) ??
                                idleTimeoutInSeconds;
                            const effectiveTurnTimeout = metadata_js_1.metadata.get(TURN_TIMEOUT_METADATA_KEY) ?? turnTimeout;
                            const next = await messagesInput.waitWithIdleTimeout({
                                idleTimeoutInSeconds: effectiveIdleTimeout,
                                timeout: effectiveTurnTimeout,
                                spanName: "next message",
                                onSuspend: onChatSuspend
                                    ? async () => {
                                        await tracer_js_1.tracer.startActiveSpan("onChatSuspend()", async () => {
                                            await onChatSuspend({
                                                phase: "turn",
                                                ctx,
                                                chatId: currentWirePayload.chatId,
                                                runId: ctx.run.id,
                                                turn,
                                                messages: accumulatedMessages,
                                                uiMessages: accumulatedUIMessages,
                                                clientData,
                                            });
                                        }, {
                                            attributes: {
                                                [v3_1.SemanticInternalAttributes.STYLE_ICON]: "task-hook-onComplete",
                                                [v3_1.SemanticInternalAttributes.COLLAPSED]: true,
                                                "chat.id": currentWirePayload.chatId,
                                                "chat.suspend.phase": "turn",
                                                "chat.turn": turn + 1,
                                            },
                                        });
                                    }
                                    : undefined,
                                onResume: onChatResume
                                    ? async () => {
                                        await tracer_js_1.tracer.startActiveSpan("onChatResume()", async () => {
                                            await onChatResume({
                                                phase: "turn",
                                                ctx,
                                                chatId: currentWirePayload.chatId,
                                                runId: ctx.run.id,
                                                turn,
                                                messages: accumulatedMessages,
                                                uiMessages: accumulatedUIMessages,
                                                clientData,
                                            });
                                        }, {
                                            attributes: {
                                                [v3_1.SemanticInternalAttributes.STYLE_ICON]: "task-hook-onStart",
                                                [v3_1.SemanticInternalAttributes.COLLAPSED]: true,
                                                "chat.id": currentWirePayload.chatId,
                                                "chat.resume.phase": "turn",
                                                "chat.turn": turn + 1,
                                            },
                                        });
                                    }
                                    : undefined,
                            });
                            if (!next.ok) {
                                return "exit";
                            }
                            currentWirePayload = next.output;
                            // Close signal — exit the loop gracefully
                            if (currentWirePayload.trigger === "close") {
                                return "exit";
                            }
                            return "continue";
                        }, {
                            attributes: turnAttributes,
                        });
                        if (turnResult === "exit")
                            return;
                        // "continue" means proceed to next iteration
                    }
                    catch (turnError) {
                        // Turn error handler: write an error chunk + turn-complete to the stream
                        // so the client sees the error, then wait for the next message instead
                        // of killing the entire run. This keeps the conversation alive.
                        // Detach the turn's message handler first — left attached it would
                        // eat the very message the wait below is waiting for.
                        turnMsgSub?.off();
                        if (turnError instanceof Error &&
                            turnError.name === "AbortError" &&
                            runSignal.aborted) {
                            // Full run cancellation — exit immediately
                            throw turnError;
                        }
                        // OOM errors must escape the turn loop so the task runtime can
                        // honor `retry.outOfMemory.machine` (set on chat.agent via
                        // `oomMachine`). Catching them here would keep the dead worker
                        // alive and defeat the machine swap. Re-throw and let the
                        // runtime dispatch the retry on a larger machine; recovery on
                        // attempt 2 picks up via the standard continuation path
                        // (same chatId / Session, accumulator rehydrates).
                        if (turnError instanceof v3_1.OutOfMemoryError) {
                            throw turnError;
                        }
                        let errorTurnCompleteResult;
                        try {
                            await withChatWriter(async (writer) => {
                                const errorText = turnError instanceof Error && turnError.message
                                    ? turnError.message
                                    : "An unexpected error occurred";
                                writer.write({ type: "error", errorText });
                            });
                            // Signal turn complete so the client knows this turn is done
                            errorTurnCompleteResult = await writeTurnCompleteChunk(currentWirePayload.chatId);
                            // A later action's snapshot reuses this cursor, so it has to move
                            // here too or that snapshot resumes from before the failed turn.
                            lastSnapshotOutEventId =
                                errorTurnCompleteResult?.lastEventId ?? lastSnapshotOutEventId;
                        }
                        catch {
                            // Best-effort — if stream write fails, let the run continue anyway
                        }
                        // The submit-message merge into the accumulator may not have run
                        // yet (a pre-run hook threw), so fold the wire message in for the
                        // error event + snapshot — the cursor has already advanced past it,
                        // so otherwise it survives in neither the snapshot nor the `.in` tail.
                        const erroredWireMessage = currentWirePayload.message;
                        const erroredUIMessages = erroredWireMessage &&
                            !accumulatedUIMessages.some((m) => m.id === erroredWireMessage.id)
                            ? [...accumulatedUIMessages, erroredWireMessage]
                            : accumulatedUIMessages;
                        let partialResponse = capturedPartialResponse ??
                            (await assemblePartialFromChunks(turnBufferedChunks));
                        if (partialResponse) {
                            partialResponse = cleanupAbortedParts(partialResponse);
                        }
                        let partialIdx = partialResponse?.id
                            ? erroredUIMessages.findIndex((m) => m.id === partialResponse.id)
                            : -1;
                        if (partialResponse && capturedPartialResponse === undefined && partialIdx !== -1) {
                            partialResponse = undefined;
                            partialIdx = -1;
                        }
                        if (partialResponse && !partialResponse.id) {
                            partialResponse = { ...partialResponse, id: (0, ai_runtime_js_1.generateId)() };
                        }
                        if (partialResponse && !responseCommitted) {
                            const queuedParts = locals_js_1.locals.get(chatResponsePartsKey);
                            if (queuedParts && queuedParts.length > 0) {
                                partialResponse = {
                                    ...partialResponse,
                                    parts: [...partialResponse.parts, ...queuedParts],
                                };
                                locals_js_1.locals.set(chatResponsePartsKey, []);
                            }
                        }
                        const includePartial = partialResponse != null && !responseCommitted;
                        // What the stream left behind, by content. After `onTurnComplete` the
                        // partial is still unfinished only if the message under its id is
                        // byte-for-byte this: a clone keeps it partial, an edit finishes it.
                        const partialFingerprint = includePartial && partialResponse ? (0, transcriptStorage_js_1.fingerprintMessage)(partialResponse) : undefined;
                        let erroredUIMessagesWithPartial = !includePartial
                            ? erroredUIMessages
                            : partialIdx === -1
                                ? [...erroredUIMessages, partialResponse]
                                : erroredUIMessages.map((m, i) => i === partialIdx ? partialResponse : m);
                        /**
                         * Seeded from the per-turn list, not just the wire message and the
                         * partial, so a steering message the drain consumed is reported too.
                         * An app persisting from `newUIMessages` would otherwise lose the
                         * instruction whenever the turn it steered went on to fail.
                         */
                        const buildErroredNew = () => {
                            const out = [];
                            const addUnique = (m) => {
                                if (m && !out.some((existing) => existing.id === m.id))
                                    out.push(m);
                            };
                            addUnique(erroredWireMessage);
                            for (const m of (locals_js_1.locals.get(chatTurnNewUIMessagesKey) ?? [])) {
                                addUnique(m);
                            }
                            if (includePartial)
                                addUnique(partialResponse);
                            return out;
                        };
                        let erroredNewUIMessages = buildErroredNew();
                        let erroredNewModelMessages = [];
                        const reconciledSteer = reconcilePendingSteer();
                        const backgroundTailThisTurn = reconcilePendingBackground();
                        if (!responseCommitted) {
                            try {
                                if (erroredNewUIMessages.length > 0) {
                                    /**
                                     * Built in order from the recorded forms rather than by
                                     * converting the UI list, so a steer appears in the delta as
                                     * the model received it (what `prepare` produced), matching the
                                     * lane. The wire message and partial are converted as before.
                                     */
                                    const steerModelById = new Map(reconciledSteer.map((e) => [e.ui.id, e.model]));
                                    for (const m of erroredNewUIMessages) {
                                        const recorded = steerModelById.get(m.id);
                                        if (recorded)
                                            erroredNewModelMessages.push(...recorded);
                                        else
                                            erroredNewModelMessages.push(...(await toModelMessages([stripProviderMetadata(m)])));
                                    }
                                }
                                if (erroredUIMessagesWithPartial !== accumulatedUIMessages) {
                                    if (partialIdx === -1) {
                                        const appended = erroredUIMessagesWithPartial.slice(accumulatedUIMessages.length);
                                        accumulatedMessages.push(...(await toModelMessages(appended.map((m) => stripProviderMetadata(m)))));
                                    }
                                    else {
                                        const ok = await replaceModelRun(accumulatedMessages, erroredUIMessages[partialIdx], partialResponse, reconciledSteer.reduce((n, e) => n + e.model.length, 0) +
                                            backgroundTailThisTurn);
                                        if (!ok) {
                                            v3_1.logger.warn("chat.agent: replaced partial not found at the model lane tail; reconverting the lane");
                                            accumulatedMessages = await toModelMessages(erroredUIMessagesWithPartial);
                                            laneCompacted = false;
                                            laneInjections = [];
                                        }
                                    }
                                    accumulatedUIMessages = erroredUIMessagesWithPartial;
                                    locals_js_1.locals.set(chatCurrentUIMessagesKey, accumulatedUIMessages);
                                }
                            }
                            catch {
                                erroredNewModelMessages = [];
                                erroredUIMessagesWithPartial = erroredUIMessages;
                                erroredNewUIMessages = buildErroredNew().filter((m) => m !== partialResponse);
                            }
                        }
                        // An earlier hook that set the history and then threw (which is one way
                        // to get here) left its abandoned edit pending. Discard it before the
                        // failed turn continues, so neither the error-path `onTurnComplete`
                        // below nor the next turn's history reads mistake it for a real edit.
                        locals_js_1.locals.set(chatOverrideMessagesKey, undefined);
                        if (onTurnComplete) {
                            try {
                                await tracer_js_1.tracer.startActiveSpan("onTurnComplete()", async () => {
                                    await onTurnComplete({
                                        ctx,
                                        chatId: currentWirePayload.chatId,
                                        messages: accumulatedMessages,
                                        uiMessages: erroredUIMessagesWithPartial,
                                        newMessages: erroredNewModelMessages,
                                        newUIMessages: erroredNewUIMessages,
                                        responseMessage: partialResponse,
                                        rawResponseMessage: partialResponse,
                                        turn,
                                        runId: ctx.run.id,
                                        chatAccessToken: "",
                                        // Parsed `clientData` isn't reliably in scope here (parsing
                                        // may itself be the failure), and the raw metadata is the
                                        // wrong shape — leave it undefined on the error path.
                                        clientData: undefined,
                                        stopped: false,
                                        continuation,
                                        previousRunId,
                                        preloaded,
                                        totalUsage: cumulativeUsage,
                                        finishReason: "error",
                                        error: turnError,
                                        lastEventId: errorTurnCompleteResult?.lastEventId,
                                    });
                                    // The hook may edit the history here too (a failure record, a
                                    // card the turn left open). Honour it the way the success path
                                    // does, so the edit reaches the accumulator and the save below.
                                    const errorTurnOverride = locals_js_1.locals.get(chatOverrideMessagesKey);
                                    if (errorTurnOverride) {
                                        locals_js_1.locals.set(chatOverrideMessagesKey, undefined);
                                        // Convert first: a rejected conversion (a tool's `toModelOutput`
                                        // can throw) must leave every lane on the history it had.
                                        const overrideUIMessages = [...errorTurnOverride];
                                        const overrideModelMessages = await toModelMessages(errorTurnOverride);
                                        erroredUIMessagesWithPartial = overrideUIMessages;
                                        accumulatedUIMessages = overrideUIMessages;
                                        accumulatedMessages = overrideModelMessages;
                                        laneCompacted = false;
                                        laneInjections = [];
                                        locals_js_1.locals.set(chatCurrentUIMessagesKey, accumulatedUIMessages);
                                    }
                                }, {
                                    attributes: {
                                        [v3_1.SemanticInternalAttributes.STYLE_ICON]: "task-hook-onComplete",
                                        [v3_1.SemanticInternalAttributes.COLLAPSED]: true,
                                        "chat.id": currentWirePayload.chatId,
                                        "chat.turn": turn + 1,
                                        "chat.errored": true,
                                    },
                                });
                            }
                            catch {
                                // A throwing onTurnComplete on the error path must not crash
                                // the run — keep the conversation alive for the next message.
                                locals_js_1.locals.set(chatOverrideMessagesKey, undefined);
                            }
                        }
                        // Persist a snapshot so the failed turn's user message isn't
                        // stranded. `writeTurnCompleteChunk` already advanced the `.in`
                        // cursor past it (via the session-in-event-id header), and the
                        // success-path snapshot write is skipped on error — without this
                        // the next boot would resume past a message that exists in
                        // neither the snapshot nor the replayable `.in` tail.
                        if (!hydrateMessages) {
                            try {
                                await saveTranscript({
                                    reason: "turn-error",
                                    messages: erroredUIMessagesWithPartial,
                                    turn,
                                    trigger: storageTrigger(currentWirePayload.trigger),
                                    clientData: turnClientData,
                                    lastOutEventId: lastSnapshotOutEventId,
                                    // The partial is non-final only while the message under its id is
                                    // still what the stream left behind. A hook that replaced it (a
                                    // closed card, a finished body) produced a final message.
                                    nonFinalIds: partialStillUnfinished(partialResponse, partialFingerprint, erroredUIMessagesWithPartial),
                                });
                            }
                            catch (error) {
                                v3_1.logger.warn("chat.agent: error-path snapshot write failed", {
                                    error: error instanceof Error ? error.message : String(error),
                                    sessionId: sessionIdForSnapshot,
                                });
                            }
                        }
                        if (locals_js_1.locals.get(chatCloseRequestedKey)) {
                            await performChatClose();
                            return;
                        }
                        // chat.requestUpgrade() / chat.endRun() — exit after error turn too
                        if (locals_js_1.locals.get(chatUpgradeRequestedKey) || locals_js_1.locals.get(chatEndRunRequestedKey)) {
                            if (locals_js_1.locals.get(chatUpgradeRequestedKey)) {
                                await persistUpgradeHandoff();
                            }
                            return;
                        }
                        // Drain remaining recovered turns before idling — a thrown
                        // recovered turn shouldn't strand the rest of the boot queue
                        // until an unrelated live message arrives.
                        if (bootInjectedQueue.length > 0) {
                            currentWirePayload = dispatchBootInjected();
                            continue;
                        }
                        // Wait for the next message — same as after a successful turn
                        const effectiveIdleTimeout = metadata_js_1.metadata.get(IDLE_TIMEOUT_METADATA_KEY) ??
                            idleTimeoutInSeconds;
                        const effectiveTurnTimeout = metadata_js_1.metadata.get(TURN_TIMEOUT_METADATA_KEY) ?? turnTimeout;
                        const next = await messagesInput.waitWithIdleTimeout({
                            idleTimeoutInSeconds: effectiveIdleTimeout,
                            timeout: effectiveTurnTimeout,
                            spanName: "next message (after error)",
                        });
                        if (!next.ok) {
                            return; // Timed out — end run gracefully
                        }
                        currentWirePayload = next.output;
                        // Same close check the success path makes. Without it a close
                        // record that lands after a failed turn is consumed as if it were
                        // a turn payload, and the loop runs on against a closed session.
                        if (currentWirePayload.trigger === "close") {
                            return;
                        }
                        // Continue to next iteration of the for loop
                    }
                    finally {
                        turnMsgSub?.off();
                    }
                }
            }
            finally {
                // Safety net for a close requested on a path that exits without
                // reaching one of the loop's close checks (a turn timeout, an OOM
                // re-throw). `performChatClose` is idempotent, so the ordinary path
                // having already run it costs nothing here.
                await performChatClose();
                // `stopSub` is registered post-preload so the close-during-preload
                // early-return path may exit before it ever attached. Guard the
                // cleanup so a missing subscription doesn't throw.
                stopSub?.off();
            }
        },
    });
    // Register clientDataSchema so the CLI converts it to JSONSchema
    // and stores it as payloadSchema — used by the Playground UI
    if (clientDataSchema) {
        v3_1.resourceCatalog.updateTaskMetadata(options.id, {
            schema: clientDataSchema,
        });
    }
    return task;
}
function composeHooks(builderHook, taskHook) {
    if (!builderHook)
        return taskHook;
    if (!taskHook)
        return builderHook;
    return async (event) => {
        await builderHook(event);
        await taskHook(event);
    };
}
function createChatBuilder(config) {
    return {
        withUIMessage(uimConfig) {
            return createChatBuilder({
                ...config,
                uiStreamOptions: uimConfig?.streamOptions ?? config.uiStreamOptions,
            });
        },
        withClientData(cdConfig) {
            return createChatBuilder({
                ...config,
                clientDataSchema: cdConfig.schema,
                clientDataReportErrorAt: cdConfig.reportErrorAt ?? config.clientDataReportErrorAt,
                clientDataOnValidationError: cdConfig.onValidationError ?? config.clientDataOnValidationError,
            });
        },
        onBoot(fn) {
            return createChatBuilder({
                ...config,
                hooks: { ...config.hooks, onBoot: fn },
            });
        },
        onPreload(fn) {
            return createChatBuilder({
                ...config,
                hooks: { ...config.hooks, onPreload: fn },
            });
        },
        onChatStart(fn) {
            return createChatBuilder({
                ...config,
                hooks: { ...config.hooks, onChatStart: fn },
            });
        },
        onTurnStart(fn) {
            return createChatBuilder({
                ...config,
                hooks: { ...config.hooks, onTurnStart: fn },
            });
        },
        onBeforeTurnComplete(fn) {
            return createChatBuilder({
                ...config,
                hooks: { ...config.hooks, onBeforeTurnComplete: fn },
            });
        },
        onTurnComplete(fn) {
            return createChatBuilder({
                ...config,
                hooks: { ...config.hooks, onTurnComplete: fn },
            });
        },
        onCompacted(fn) {
            return createChatBuilder({
                ...config,
                hooks: { ...config.hooks, onCompacted: fn },
            });
        },
        onChatSuspend(fn) {
            return createChatBuilder({
                ...config,
                hooks: { ...config.hooks, onChatSuspend: fn },
            });
        },
        onChatResume(fn) {
            return createChatBuilder({
                ...config,
                hooks: { ...config.hooks, onChatResume: fn },
            });
        },
        agent(options) {
            const mergedUiStream = config.uiStreamOptions && options.uiMessageStreamOptions
                ? { ...config.uiStreamOptions, ...options.uiMessageStreamOptions }
                : (options.uiMessageStreamOptions ?? config.uiStreamOptions);
            return chatAgent({
                ...options,
                ...(config.clientDataSchema ? { clientDataSchema: config.clientDataSchema } : {}),
                uiMessageStreamOptions: mergedUiStream,
                onBoot: composeHooks(config.hooks.onBoot, options.onBoot),
                onRecoveryBoot: options.onRecoveryBoot,
                onPreload: composeHooks(config.hooks.onPreload, options.onPreload),
                onChatStart: composeHooks(config.hooks.onChatStart, options.onChatStart),
                onTurnStart: composeHooks(config.hooks.onTurnStart, options.onTurnStart),
                onBeforeTurnComplete: composeHooks(config.hooks.onBeforeTurnComplete, options.onBeforeTurnComplete),
                onTurnComplete: composeHooks(config.hooks.onTurnComplete, options.onTurnComplete),
                onCompacted: composeHooks(config.hooks.onCompacted, options.onCompacted),
                onChatSuspend: composeHooks(config.hooks.onChatSuspend, options.onChatSuspend),
                onChatResume: composeHooks(config.hooks.onChatResume, options.onChatResume),
            });
        },
        customAgent(options) {
            return chatCustomAgent({
                ...options,
                ...(config.clientDataSchema ? { clientDataSchema: config.clientDataSchema } : {}),
                ...(config.clientDataReportErrorAt
                    ? { clientDataReportErrorAt: config.clientDataReportErrorAt }
                    : {}),
                onClientDataValidationError: composeHooks(config.clientDataOnValidationError, options.onClientDataValidationError),
            });
        },
    };
}
/**
 * Fix the UI message type for a chat task (AI SDK `UIMessage` generics) while
 * keeping `id` and `clientDataSchema` inference on the inner {@link chat.agent} call.
 *
 * Returns a {@link ChatBuilder} that supports chaining `.withClientData()`,
 * hook methods (`.onPreload()`, `.onChatSuspend()`, etc.), and `.task()`.
 *
 * @example
 * ```ts
 * type AgentUiMessage = UIMessage<unknown, UIDataTypes, UITools>;
 *
 * export const myChat = chat.withUIMessage<AgentUiMessage>({
 *   streamOptions: { sendReasoning: true },
 * }).task({
 *   id: "my-chat",
 *   run: async ({ messages, signal }) => { ... },
 * });
 * ```
 */
function withUIMessage(config) {
    return createChatBuilder({
        uiStreamOptions: config?.streamOptions,
        hooks: {},
    });
}
/**
 * Fix the client data schema for a chat task, providing typed `clientData`
 * in all hooks and the `run` function.
 *
 * Returns a {@link ChatBuilder} that supports chaining `.withUIMessage()`,
 * hook methods (`.onPreload()`, `.onChatSuspend()`, etc.), and `.task()`.
 *
 * @example
 * ```ts
 * export const myChat = chat
 *   .withClientData({ schema: z.object({ userId: z.string() }) })
 *   .task({
 *     id: "my-chat",
 *     onPreload: async ({ clientData }) => {
 *       // clientData is typed as { userId: string }
 *     },
 *     run: async ({ messages, signal }) => { ... },
 *   });
 * ```
 */
function withClientData(config) {
    return createChatBuilder({
        clientDataSchema: config.schema,
        clientDataReportErrorAt: config.reportErrorAt,
        clientDataOnValidationError: config.onValidationError,
        hooks: {},
    });
}
/**
 * Namespace for AI SDK chat integration.
 *
 * @example
 * ```ts
 * import { chat } from "@trigger.dev/sdk/ai";
 *
 * // Define a chat task
 * export const myChat = chat.agent({
 *   id: "my-chat",
 *   run: async ({ messages, signal }) => {
 *     return streamText({ model, messages, abortSignal: signal });
 *   },
 * });
 *
 * // Pipe a stream manually (from inside a task)
 * await chat.pipe(streamTextResult);
 *
 * // Create an access token (from a server action)
 * const token = await chat.createAccessToken("my-chat");
 * ```
 */
// ---------------------------------------------------------------------------
// Runtime configuration helpers
// ---------------------------------------------------------------------------
const TURN_TIMEOUT_METADATA_KEY = "chat.turnTimeout";
const IDLE_TIMEOUT_METADATA_KEY = "chat.idleTimeout";
/**
 * Override the turn timeout for subsequent turns in the current run.
 *
 * The turn timeout controls how long the run stays suspended (freeing compute)
 * waiting for the next user message. When it expires, the run completes
 * gracefully and the next message starts a fresh run.
 *
 * Call from inside a `chatAgent` run function to adjust based on context.
 *
 * @param duration - A duration string (e.g. `"5m"`, `"1h"`, `"30s"`)
 *
 * @example
 * ```ts
 * run: async ({ messages, signal }) => {
 *   chat.setTurnTimeout("2h");
 *   return streamText({ model, messages, abortSignal: signal });
 * }
 * ```
 */
function setTurnTimeout(duration) {
    metadata_js_1.metadata.set(TURN_TIMEOUT_METADATA_KEY, duration);
}
/**
 * Override the turn timeout in seconds for subsequent turns in the current run.
 *
 * @param seconds - Number of seconds to wait for the next message before ending the run
 *
 * @example
 * ```ts
 * run: async ({ messages, signal }) => {
 *   chat.setTurnTimeoutInSeconds(3600); // 1 hour
 *   return streamText({ model, messages, abortSignal: signal });
 * }
 * ```
 */
function setTurnTimeoutInSeconds(seconds) {
    metadata_js_1.metadata.set(TURN_TIMEOUT_METADATA_KEY, `${seconds}s`);
}
/**
 * Override the idle timeout for subsequent turns in the current run.
 *
 * The idle timeout controls how long the run stays active (using compute)
 * after each turn, waiting for the next message. During this window,
 * responses are instant. After it expires, the run suspends.
 *
 * @param seconds - Number of seconds to stay idle (0 to suspend immediately)
 *
 * @example
 * ```ts
 * run: async ({ messages, signal }) => {
 *   chat.setIdleTimeoutInSeconds(60);
 *   return streamText({ model, messages, abortSignal: signal });
 * }
 * ```
 */
function setIdleTimeoutInSeconds(seconds) {
    metadata_js_1.metadata.set(IDLE_TIMEOUT_METADATA_KEY, seconds);
}
/**
 * Override the `toUIMessageStream()` options for the current turn.
 *
 * These options control how the `StreamTextResult` is converted to a
 * `UIMessageChunk` stream — error handling, reasoning/source visibility,
 * message metadata, etc.
 *
 * Per-turn options are merged on top of the static `uiMessageStreamOptions`
 * set on `chat.agent()`. Per-turn values win on conflicts.
 *
 * @example
 * ```ts
 * run: async ({ messages, signal }) => {
 *   chat.setUIMessageStreamOptions({
 *     sendReasoning: true,
 *     onError: (error) => error instanceof Error ? error.message : "An error occurred.",
 *   });
 *   return streamText({ model, messages, abortSignal: signal });
 * }
 * ```
 */
function setUIMessageStreamOptions(options) {
    locals_js_1.locals.set(chatUIStreamPerTurnKey, options);
}
/**
 * Resolve the effective UIMessageStream options by merging:
 * 1. Static task-level options (from `chat.agent({ uiMessageStreamOptions })`)
 * 2. Per-turn overrides (from `chat.setUIMessageStreamOptions()`)
 *
 * Per-turn values win on conflicts. Clears the per-turn override after reading
 * so it doesn't leak into subsequent turns.
 * @internal
 */
function resolveUIMessageStreamOptions() {
    const staticOptions = locals_js_1.locals.get(chatUIStreamStaticKey) ?? {};
    const perTurnOptions = locals_js_1.locals.get(chatUIStreamPerTurnKey) ?? {};
    // Clear per-turn override so it doesn't leak into subsequent turns
    locals_js_1.locals.set(chatUIStreamPerTurnKey, undefined);
    return { ...staticOptions, ...perTurnOptions };
}
// ---------------------------------------------------------------------------
// Stop detection
// ---------------------------------------------------------------------------
/**
 * Check whether the user stopped generation during the current turn.
 *
 * Works from **anywhere** inside a `chat.agent` run — including inside
 * `streamText`'s `onFinish` callback — without needing to thread the
 * `stopSignal` through closures.
 *
 * This is especially useful when the AI SDK's `isAborted` flag is unreliable
 * (e.g. when using `createUIMessageStream` + `writer.merge()`).
 *
 * @example
 * ```ts
 * onFinish: ({ isAborted }) => {
 *   const wasStopped = isAborted || chat.isStopped();
 *   if (wasStopped) {
 *     // handle stop
 *   }
 * }
 * ```
 */
function isStopped() {
    const controller = locals_js_1.locals.get(chatStopControllerKey);
    return controller?.signal.aborted ?? false;
}
// ---------------------------------------------------------------------------
// Version upgrade
// ---------------------------------------------------------------------------
/**
 * Hand the conversation over to another deployment.
 *
 * The handover happens immediately and server-side: a successor run is created
 * and picks the conversation up from `session.in`. The transport keeps reading
 * the same session output, so no client action is needed and nothing waits for
 * the next message.
 *
 * Without a target the session's pin is cleared, so the successor lands on the
 * latest deployed version; with `externalDeploymentId` the session is re-pinned
 * to that deployment.
 *
 * When called from `onTurnStart` or `onValidateMessages`, `run()` is skipped
 * entirely and the successor answers the message that opened the turn.
 *
 * When called from `run()` or `chat.defer()`, the current turn completes
 * normally and the handover happens afterward.
 *
 * Call from `onTurnStart`, `onValidateMessages`, `onChatResume`, `run()`,
 * or inside `chat.defer()`.
 *
 * @example
 * ```ts
 * const SUPPORTED_VERSIONS = new Set(["v2", "v3"]);
 *
 * chat.agent({
 *   id: "my-chat",
 *   onTurnStart: async ({ clientData }) => {
 *     if (clientData?.protocolVersion && !SUPPORTED_VERSIONS.has(clientData.protocolVersion)) {
 *       chat.requestUpgrade();
 *     }
 *   },
 *   run: async ({ messages }) => { ... },
 * });
 * ```
 */
function requestUpgrade(options) {
    locals_js_1.locals.set(chatUpgradeRequestedKey, true);
    // Without a target the handoff clears the session's pin; with one it re-pins to that deployment.
    const target = options?.externalDeploymentId?.trim();
    if (target)
        locals_js_1.locals.set(chatUpgradeExternalDeploymentIdKey, target);
}
/** @internal Requests a handoff when the session's pin no longer names this deployment. */
async function followSessionPin(chatId, policy) {
    if (!chatId) {
        return;
    }
    const deployedExternalId = locals_js_1.locals.get(chatAgentRunContextKey)?.deployment?.externalId;
    if (policy !== "hold" && !deployedExternalId) {
        v3_1.logger.debug("chat.versionSkew: cannot follow the session pin", {
            chatId,
            reason: "the run context carries no deployment.externalId",
        });
    }
    const target = await (0, chatVersionSkew_js_1.resolvePinToFollow)({
        policy,
        deployedExternalId,
        upgradeAlreadyRequested: locals_js_1.locals.get(chatUpgradeRequestedKey) === true,
        readPin: async () => (await sessions_js_1.sessions.retrieve(chatId, { retry: { maxAttempts: 2, randomize: true } }))
            .triggerConfig,
    });
    if (!target) {
        return;
    }
    v3_1.logger.info("chat.versionSkew: following the session pin", { chatId, target });
    requestUpgrade({ externalDeploymentId: target });
}
/**
 * Hand off the current custom agent Session to a fresh run.
 *
 * This is the low-level handoff for a fully hand-rolled
 * `chat.customAgent()` loop. This method rejects while a
 * `chat.createSession()` iterator is active. Close the iterator before calling
 * it. If `return()` races an active `next()`, it waits for that read to settle
 * before releasing the handoff guard. Call only between turns and after
 * detaching input listeners for the old run. If the old run completed its
 * current turn, persist its state and call {@link chatWriteTurnComplete} before
 * handing off.
 * Do not write a new turn boundary after input that the continuation run should
 * process has been dispatched: the boundary acknowledges that input.
 *
 * The server starts the continuation run but does not stop this run, so return
 * from the task immediately after awaiting this function. The promise rejects
 * if the server cannot complete the handoff.
 *
 * Pending Session input that the old run has not consumed remains on the
 * durable `.in` stream and is delivered to the continuation run.
 *
 * @example
 * ```ts
 * // Detach any chat.messages.on() subscriptions you created.
 * await persistMessages();
 * await chat.writeTurnComplete();
 * await chat.endAndContinue();
 * return;
 * ```
 */
async function endAndContinue() {
    if (locals_js_1.locals.get(chatCustomAgentRunKey) !== true) {
        throw new Error("chat.endAndContinue() can only be called from inside a chat.customAgent() run");
    }
    if ((locals_js_1.locals.get(chatActiveSessionIteratorsKey) ?? 0) > 0) {
        throw new Error("chat.endAndContinue() cannot be called while a chat.createSession() iterator is active. Close the iterator, then call chat.endAndContinue().");
    }
    await performEndAndContinue({ reason: "continuation" });
}
/** @internal Shared server handoff used by managed and custom agent loops. */
async function performEndAndContinue(options) {
    const chatId = locals_js_1.locals.get(chatExternalIdKey);
    const callingRunId = locals_js_1.locals.get(chatAgentRunContextKey)?.run.id;
    if (!chatId || !callingRunId) {
        throw new Error("Cannot end and continue without an active chat agent run");
    }
    const externalDeploymentId = options.externalDeploymentId;
    const apiClient = v3_1.apiClientManager.clientOrThrow();
    const result = await apiClient.endAndContinueSession(chatId, {
        callingRunId,
        reason: options.reason,
        ...(externalDeploymentId ? { externalDeploymentId } : {}),
    });
    if (result?.pendingVersion !== true) {
        return;
    }
    // The successor parked. Say so on `.out` while this run still can — the transport's
    // subscription survives the swap, so the client learns without waiting for its next send.
    const [error] = await (0, v3_1.tryCatch)(getChatSession().out.writeControl(v3_1.TRIGGER_CONTROL_SUBTYPE.PENDING_VERSION));
    if (error) {
        v3_1.logger.warn("could not signal a parked handoff", { chatId, error });
    }
}
/**
 * Exit the run after the current turn completes, without waiting for the
 * next message. Unlike {@link requestUpgrade}, no upgrade-required signal
 * is sent to the client — the turn finishes normally, `onTurnComplete`
 * fires, and the loop exits instead of going idle.
 *
 * Call from `run()`, `chat.defer()`, `onBeforeTurnComplete`, or
 * `onTurnComplete` to end the run on your own terms (budget exhausted,
 * task complete, goal achieved, etc.).
 *
 * The next user message on the same `chatId` starts a fresh run via the
 * normal continuation mechanism.
 *
 * @example
 * ```ts
 * chat.agent({
 *   id: "one-shot-agent",
 *   run: async ({ messages, signal }) => {
 *     const result = streamText({ model: openai("gpt-4o"), messages, abortSignal: signal });
 *     // Single-response agent — exit after this turn.
 *     chat.endRun();
 *     return result;
 *   },
 * });
 * ```
 */
function endRun() {
    locals_js_1.locals.set(chatEndRunRequestedKey, true);
}
/**
 * End the whole conversation, permanently. The session row is closed, further
 * appends are refused, and the run exits without scheduling a continuation.
 *
 * This is the session-level stop. {@link endRun} ends the current run and lets
 * the next message start a fresh one; `chat.close()` ends the session itself,
 * so there is no next message. Use it for a budget cap, a completed goal,
 * abuse detection, or a user signing out.
 *
 * In a `chat.agent`, call it from `run()`, `prepareStep`, or
 * `onBeforeTurnComplete`. Called mid-step, it aborts the in-flight
 * `streamText` the same way the stop signal does, so the partial response is
 * still captured and streamed. The turn then completes normally, a terminal
 * `session-closed` record carrying `reason` is written to the response stream,
 * and the loop exits.
 *
 * Prefer `onBeforeTurnComplete` over `onTurnComplete`. It carries the same
 * fields but still runs while the stream is open, so the closed state rides
 * out on the turn's final record. `onTurnComplete` runs after that record, so
 * a close decided there does not reach a reader that has already finished the
 * turn, and the user only finds out when their next message is refused.
 *
 * In a `chat.customAgent`, call it anywhere in your own loop. The close is
 * performed when `run()` returns, so it lands whether you break out of a
 * `chat.createSession` loop, return early, or hand-roll the loop entirely.
 *
 * Closing is one-way: a closed session cannot be reopened. Its transcript
 * stays readable.
 *
 * @example
 * ```ts
 * chat.agent({
 *   id: "budgeted-agent",
 *   onBeforeTurnComplete: async ({ usage }) => {
 *     if (await overBudget(usage)) {
 *       chat.close({ reason: "Monthly budget reached" });
 *     }
 *   },
 * });
 * ```
 */
function close(options) {
    if (!locals_js_1.locals.get(chatExternalIdKey)) {
        throw new Error("chat.close() can only be called from inside a chat.agent() or chat.customAgent() run");
    }
    // Bound the reason once, here. It goes out on S2 record headers as well as
    // the close API, and an oversized value would fail the turn-complete write
    // that carries the turn boundary, costing the client far more than the
    // reason text.
    // Trailing high surrogate: the cut landed between the two halves of an
    // astral character, and encoding the orphan to UTF-8 for a record header
    // yields a replacement character. Drop it rather than ship mojibake.
    const reason = options?.reason
        ?.slice(0, CHAT_CLOSE_REASON_MAX_LENGTH)
        .replace(/[\uD800-\uDBFF]$/, "");
    locals_js_1.locals.set(chatCloseRequestedKey, reason ? { reason } : {});
    // Mid-step call: unblock the in-flight streamText exactly like the stop
    // signal, so the turn can reach its turn boundary instead of running the
    // model out to completion after the decision to close has been made.
    locals_js_1.locals.get(chatStopControllerKey)?.abort(reason ?? "closed");
}
/**
 * @internal Terminal close sequence, run once at whichever exit site observes
 * the close request. Writes the standalone `session-closed` record, then closes
 * the session row.
 *
 * The record lands after the turn's `turn-complete`, so a client reading that
 * turn's stream has already terminated on it and will not see this one. It is
 * there for a reconnect and for replay. What a live client reads is the
 * `session-closed` header stamped onto `turn-complete` itself by
 * `writeTurnCompleteChunk`, which fires whenever the close was decided before
 * the turn ended. A close decided from `onTurnComplete` is past that point, so
 * the client learns from the 409 on its next send.
 */
async function performChatClose() {
    const request = locals_js_1.locals.get(chatCloseRequestedKey);
    if (!request || locals_js_1.locals.get(chatClosePerformedKey))
        return;
    const reason = request.reason;
    // Two flags, not one. The record is a client-visible event and must not be
    // written twice, but the row close is the part that actually ends the
    // conversation: flagging it as done before it succeeds would let a transient
    // failure leave the session open with no later call willing to retry.
    if (!locals_js_1.locals.get(chatCloseRecordWrittenKey)) {
        locals_js_1.locals.set(chatCloseRecordWrittenKey, true);
        try {
            const session = getChatSession();
            await session.out.writeControl(v3_1.TRIGGER_CONTROL_SUBTYPE.SESSION_CLOSED, reason ? [[v3_1.SESSION_CLOSED_REASON_HEADER, reason]] : undefined);
        }
        catch (error) {
            v3_1.logger.warn("chat.close: failed to write the session-closed record", {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    const chatId = locals_js_1.locals.get(chatExternalIdKey);
    if (!chatId)
        return;
    try {
        await sessions_js_1.sessions.close(chatId, {
            ...(reason ? { reason } : {}),
            ...(locals_js_1.locals.get(chatAgentRunContextKey)?.run.id
                ? { callingRunId: locals_js_1.locals.get(chatAgentRunContextKey).run.id }
                : {}),
        });
        locals_js_1.locals.set(chatClosePerformedKey, true);
    }
    catch (error) {
        // Deliberately NOT flagged as performed: the close API is idempotent, so a
        // later exit site on this run gets to retry it. Losing every retry to a
        // transient failure would leave the row open and the conversation alive.
        // Non-fatal either way — the run still exits.
        v3_1.logger.error("chat.close: failed to close the session", {
            chatId,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
// ---------------------------------------------------------------------------
// Per-turn deferred work
// ---------------------------------------------------------------------------
/**
 * Register a promise that runs in the background during the current turn.
 *
 * Use this to move non-blocking work (DB writes, analytics, etc.) out of
 * the critical path. The promise runs in parallel with streaming and is
 * awaited (with a 5 s timeout) before `onTurnComplete` fires.
 *
 * @example
 * ```ts
 * onTurnStart: async ({ chatId, uiMessages }) => {
 *   // Pass a promise directly
 *   chat.defer(db.chat.update({ where: { id: chatId }, data: { messages: uiMessages } }));
 *
 *   // Or pass an async function — cleaner for multi-step work
 *   chat.defer(async () => {
 *     const flags = await getFeatureFlags();
 *     if (flags.forceUpgrade) chat.requestUpgrade();
 *   });
 * },
 * ```
 */
function chatDefer(promiseOrFn) {
    const promises = locals_js_1.locals.get(chatDeferKey);
    if (promises) {
        promises.add(typeof promiseOrFn === "function" ? promiseOrFn() : promiseOrFn);
    }
}
// ---------------------------------------------------------------------------
// Background context injection
// ---------------------------------------------------------------------------
/**
 * Queue model messages for injection at the next `prepareStep` boundary.
 *
 * Use this to inject context from background work into the agent's conversation.
 * Messages are appended to the model messages before the next LLM inference call.
 *
 * Combine with `chat.defer()` to run background analysis and inject results:
 *
 * @example
 * ```ts
 * onTurnComplete: async ({ messages }) => {
 *   chat.defer((async () => {
 *     const review = await generateObject({
 *       model: openai("gpt-4o-mini"),
 *       messages: [...messages, { role: "user", content: "Review the last response." }],
 *       schema: z.object({ suggestions: z.array(z.string()) }),
 *     });
 *     if (review.object.suggestions.length > 0) {
 *       chat.inject([{
 *         role: "system",
 *         content: `Improvements for next response:\n${review.object.suggestions.join("\n")}`,
 *       }]);
 *     }
 *   })());
 * },
 * ```
 */
function injectBackgroundContext(messages) {
    const systemBlocks = messages.filter((message) => message.role === "system");
    const conversational = messages.filter((message) => message.role !== "system");
    if (systemBlocks.length > 0) {
        const instructions = locals_js_1.locals.get(chatInjectedInstructionsKey) ?? [];
        instructions.push(...systemBlocks);
        locals_js_1.locals.set(chatInjectedInstructionsKey, instructions);
    }
    if (conversational.length > 0) {
        const queue = locals_js_1.locals.get(chatBackgroundQueueKey) ?? [];
        queue.push(...conversational);
        locals_js_1.locals.set(chatBackgroundQueueKey, queue);
    }
}
// ---------------------------------------------------------------------------
// Aborted message cleanup
// ---------------------------------------------------------------------------
/**
 * Clean up a UIMessage that was captured during an aborted/stopped turn.
 *
 * When generation is stopped mid-stream, the captured message may contain:
 * - Tool parts stuck in incomplete states (`partial-call`, `input-available`,
 *   `input-streaming`) that cause permanent UI spinners
 * - Reasoning parts with `state: "streaming"` instead of `"done"`
 * - Text parts with `state: "streaming"` instead of `"done"`
 *
 * This function returns a cleaned copy with:
 * - Incomplete tool parts removed entirely
 * - Reasoning and text parts marked as `"done"`
 *
 * `chat.agent` calls this automatically when stop is detected before passing
 * the response to `onTurnComplete`. Use this manually when calling `pipeChat`
 * directly and capturing response messages yourself.
 *
 * @example
 * ```ts
 * onTurnComplete: async ({ responseMessage, stopped }) => {
 *   // Already cleaned automatically by chat.agent — but if you captured
 *   // your own message via pipeChat, clean it manually:
 *   const cleaned = chat.cleanupAbortedParts(myMessage);
 *   await db.messages.save(cleaned);
 * }
 * ```
 */
function cleanupAbortedParts(message) {
    if (!message.parts)
        return message;
    const isToolPart = (part) => part.type === "tool-invocation" ||
        part.type?.startsWith("tool-") ||
        part.type === "dynamic-tool";
    return {
        ...message,
        parts: message.parts
            .filter((part) => {
            if (!isToolPart(part))
                return true;
            // Remove tool parts that never completed execution.
            // partial-call: input was still streaming when aborted.
            // input-available: input was complete but tool never ran.
            // input-streaming: input was mid-stream.
            const state = part.toolInvocation?.state ?? part.state;
            return (state !== "partial-call" && state !== "input-available" && state !== "input-streaming");
        })
            .map((part) => {
            // Mark streaming reasoning as done
            if (part.type === "reasoning" && part.state === "streaming") {
                return { ...part, state: "done" };
            }
            // Mark streaming text as done
            if (part.type === "text" && part.state === "streaming") {
                return { ...part, state: "done" };
            }
            return part;
        }),
    };
}
// ---------------------------------------------------------------------------
// Composable primitives for raw task chat
// ---------------------------------------------------------------------------
/**
 * Create a managed stop signal wired to the chat stop input stream.
 *
 * Call once at the start of your run. Use `signal` as the abort signal for
 * `streamText`. Call `reset()` at the start of each turn to get a fresh
 * per-turn signal. Call `cleanup()` when the run ends.
 *
 * @example
 * ```ts
 * const stop = chat.createStopSignal();
 * for (let turn = 0; turn < 100; turn++) {
 *   stop.reset();
 *   const result = streamText({ model, messages, abortSignal: stop.signal });
 *   await chat.pipe(result);
 *   // ...
 * }
 * stop.cleanup();
 * ```
 */
function createStopSignal() {
    let controller = new AbortController();
    const sub = stopInput.on((data) => {
        controller.abort(data?.message || "stopped");
    });
    return {
        get signal() {
            return controller.signal;
        },
        reset() {
            controller = new AbortController();
        },
        cleanup() {
            sub.off();
        },
    };
}
/**
 * Signal the frontend that the current turn is complete.
 *
 * The `TriggerChatTransport` intercepts this to close the ReadableStream
 * for the current turn. Call after piping the response stream.
 *
 * Returns two resume cursors for the turn boundary, both saveable from the
 * task instead of round-tripping them back from the client:
 * - `lastEventId` — the turn-complete control record's seq_num on
 *   `session.out`; where the next turn's output stream resumes.
 * - `sessionInEventId` — the safe-to-resume-from cursor on `session.in` as of
 *   this turn-complete. It is the highest sequence that can be resumed past
 *   without skipping an unhandled message, so it is held back behind any
 *   message still buffered unconsumed and is NOT necessarily the sequence of
 *   the record this turn answered. Trigger owns input-cursor recovery, so this
 *   is for correlation / out-of-sync detection, not required. Treat it as a
 *   lower bound: a value below the record you just handled is expected, not a
 *   sign of a lost turn.
 *
 * Either is `undefined` when the corresponding cursor isn't available.
 *
 * @example
 * ```ts
 * await chat.pipe(result);
 * const { lastEventId, sessionInEventId } = await chat.writeTurnComplete();
 * await db.chats.update(chatId, { lastEventId, sessionInEventId });
 * ```
 */
async function chatWriteTurnComplete(options) {
    await flushDeferredChatCustomAgentClientDataErrors();
    const result = await writeTurnCompleteChunk(undefined, options?.publicAccessToken);
    // Same cursor written to the `session-in-event-id` header inside
    // `writeTurnCompleteChunk`; surfaced here so the caller can persist it.
    const inCursor = chatInputRouter().resumeFloor();
    return {
        lastEventId: result?.lastEventId,
        ...(inCursor !== undefined ? { sessionInEventId: String(inCursor) } : {}),
    };
}
/**
 * Writes the client-data errors held back by the default `"turn-end"` timing.
 *
 * Ordered before the turn-complete chunk, matching the error-then-turn-complete
 * shape the submitted-turn and async-read paths already write.
 */
async function flushDeferredChatCustomAgentClientDataErrors() {
    const deferred = locals_js_1.locals.get(chatCustomAgentDeferredClientDataErrorsKey);
    if (!deferred || deferred.length === 0)
        return;
    locals_js_1.locals.set(chatCustomAgentDeferredClientDataErrorsKey, []);
    for (const payload of deferred) {
        try {
            await writeChatCustomAgentClientDataErrorToStream(payload);
        }
        catch {
            /* non-fatal */
        }
    }
}
/**
 * Pass every chunk through untouched while recording it in `buffer`. Handles
 * both the `AsyncIterable` and `ReadableStream` shapes `toUIMessageStream()`
 * can return, and propagates a source error to the consumer after buffering
 * whatever streamed first. See {@link pipeChatAndCapture} for why.
 */
function tapUIMessageChunks(source, buffer) {
    if (isReadableStream(source)) {
        return source.pipeThrough(new TransformStream({
            transform(chunk, controller) {
                buffer.push(chunk);
                controller.enqueue(chunk);
            },
        }));
    }
    return (async function* () {
        for await (const chunk of source) {
            buffer.push(chunk);
            yield chunk;
        }
    })();
}
/**
 * Reconstruct a partial assistant `UIMessage` from the raw chunks that
 * streamed before a failure — the fallback for {@link pipeChatAndCapture}
 * when a transport error abandons the stream before `onFinish` runs. Uses the
 * same `readUIMessageStream` reducer as the boot-time replay path. Returns
 * `undefined` if there's nothing to assemble or the reducer throws.
 */
async function assemblePartialFromChunks(chunks) {
    const relevant = chunks.filter((c) => {
        const type = c.type;
        return typeof type === "string" && !type.startsWith("trigger:");
    });
    if (relevant.length === 0)
        return undefined;
    try {
        const stream = new ReadableStream({
            start(controller) {
                for (const chunk of relevant)
                    controller.enqueue(chunk);
                controller.close();
            },
        });
        let last;
        for await (const message of (0, ai_runtime_js_1.readUIMessageStream)({ stream })) {
            last = message;
        }
        return last;
    }
    catch {
        return undefined;
    }
}
/**
 * Pipe a `StreamTextResult` (or similar) to the chat stream and capture
 * the assistant's response message via `onFinish`.
 *
 * Combines `toUIMessageStream()` + `onFinish` callback + `chat.pipe()`.
 * Never throws on a stopped or failed stream: it returns a
 * {@link PipeAndCaptureResult} whose `message` holds any partial output
 * captured before the stop/failure, alongside a typed `status` (and `error`
 * on failure). Save the partial after a stop or error without separate
 * capture logic.
 *
 * @example
 * ```ts
 * const result = streamText({ model, messages, abortSignal: signal });
 * const { message, status, error } = await chat.pipeAndCapture(result, { signal });
 * if (message) conversation.addResponse(message);
 * if (status === "error") logger.error("turn failed", { error });
 * ```
 */
async function pipeChatAndCapture(source, options) {
    let captured;
    let capturedFinishReason;
    let resolveOnFinish;
    const onFinishPromise = new Promise((r) => {
        resolveOnFinish = r;
    });
    const resolvedOptions = resolveUIMessageStreamOptions();
    const uiStream = source.toUIMessageStream({
        ...resolvedOptions,
        // Thread the prior chain (incl. a spliced handover partial) so a resumed
        // tool round's tool-output chunks merge into the originating tool-call
        // instead of throwing "No tool invocation found".
        ...(options?.originalMessages ? { originalMessages: options.originalMessages } : {}),
        // Stamp a server-generated id on the start chunk, same as chat.agent's
        // pipe. Without it the AI SDK regenerates the assistant id when a
        // prepareStep injection (steering) starts a new step mid-stream, and
        // the frontend replaces the partial message — wiping the
        // pre-injection text from the UI and the captured response.
        generateMessageId: resolvedOptions.generateMessageId ?? ai_runtime_js_1.generateId,
        onFinish: ({ responseMessage, finishReason, }) => {
            captured = responseMessage;
            capturedFinishReason = finishReason;
            resolveOnFinish();
        },
    });
    // Buffer chunks as they flow to the pipe so a transport failure that
    // abandons the UI stream before `onFinish` fires — the one termination path
    // that skips `onFinish` — can still reconstruct the partial. This retains
    // chunk references only; the reassembly runs solely in the failure fallback
    // below, so the happy path pays nothing extra.
    const bufferedChunks = [];
    const tappedStream = tapUIMessageChunks(uiStream, bufferedChunks);
    let status = "complete";
    let error;
    try {
        await pipeChat(tappedStream, {
            signal: options?.signal,
            spanName: options?.spanName ?? "stream response",
        });
        // The pipe can drain cleanly on a stop — the source stream just ends
        // early — so classify by the signal rather than relying on a throw.
        if (options?.signal?.aborted) {
            status = "aborted";
        }
    }
    catch (err) {
        if ((err instanceof Error && err.name === "AbortError") || options?.signal?.aborted) {
            status = "aborted";
        }
        else {
            status = "error";
            error = err;
        }
    }
    // `onFinish` fires even on abort, carrying the partial — but a hard stop can
    // prevent it from firing at all, so race it against a timeout to avoid
    // hanging the caller. Mirrors chat.agent's capture path.
    await Promise.race([onFinishPromise, new Promise((r) => setTimeout(r, 2_000))]);
    // A transport failure can abandon the UI stream before `onFinish` fires, so
    // reconstruct the partial from the buffered chunks rather than losing output
    // that already streamed. Only runs when `onFinish` produced nothing.
    if (!captured && bufferedChunks.length > 0) {
        captured = await assemblePartialFromChunks(bufferedChunks);
    }
    return {
        message: captured,
        status,
        finishReason: capturedFinishReason,
        ...(error !== undefined ? { error } : {}),
    };
}
/**
 * Accumulates conversation messages across turns.
 *
 * Handles the transport protocol: turn 0 sends full history (replace),
 * subsequent turns send only new messages (append), regenerate sends
 * full history minus last assistant message (replace).
 *
 * @example
 * ```ts
 * const conversation = new chat.MessageAccumulator();
 * for (let turn = 0; turn < 100; turn++) {
 *   const messages = await conversation.addIncoming(payload.messages, payload.trigger, turn);
 *   const result = streamText({ model, messages });
 *   const { message } = await chat.pipeAndCapture(result);
 *   if (message) await conversation.addResponse(message);
 * }
 * ```
 */
class ChatMessageAccumulator {
    modelMessages = [];
    uiMessages = [];
    _compaction;
    /** The run a spliced head-start partial contributed, until its response replaces it. */
    _handoverRun;
    _pendingMessages;
    _steeringQueue = [];
    constructor(options) {
        this._compaction = options?.compaction;
        this._pendingMessages = options?.pendingMessages;
    }
    /**
     * Add incoming messages from the transport payload.
     * Returns the full accumulated model messages for `streamText`.
     */
    async addIncoming(messages, trigger, turn) {
        const cleaned = messages.map((m) => (m.role === "assistant" ? cleanupAbortedParts(m) : m));
        const model = await toModelMessages(cleaned);
        if (turn === 0 || trigger === "regenerate-message") {
            this.modelMessages = model;
            this.uiMessages = [...cleaned];
        }
        else {
            this.modelMessages.push(...model);
            this.uiMessages.push(...cleaned);
        }
        return this.modelMessages;
    }
    /**
     * Add the assistant's response to the accumulator.
     * Call after `pipeAndCapture` with the captured response.
     */
    /**
     * Replace all accumulated messages (for compaction).
     * Converts UIMessages to ModelMessages internally.
     */
    async setMessages(uiMessages) {
        this.uiMessages = [...uiMessages];
        this.modelMessages = await toModelMessages(uiMessages);
    }
    /**
     * Splice a `chat.headStart` handover partial into the accumulator (the warm
     * step-1 response). Dedups by `messageId` so a seeded/hydrated history that
     * already carries the partial isn't doubled. Seed any prior history first
     * (e.g. `setMessages(payload.headStartMessages)`). Low-level — see
     * `consumeHandover` for the wait+seed+apply convenience.
     */
    applyHandover(signal) {
        this._handoverRun = spliceHandoverPartial(this.modelMessages, this.uiMessages, signal);
    }
    /**
     * One-call `chat.headStart` handover for a custom-agent loop: waits for the
     * handover signal, seeds prior history from `payload.headStartMessages`,
     * applies the warm step-1 partial, and reports what to do next.
     *
     * Returns `{ isFinal, skipped }`:
     * - `skipped: true` — not a `handover-prepare` run, the wait idled out, or the
     *   warm handler aborted. Exit the run without a turn.
     * - `isFinal: true` — step 1 IS the response (pure text). Write turn-complete
     *   and continue; do not call `streamText`.
     * - `isFinal: false` — fall through to `streamText`, which runs the pending
     *   tool round handed over from step 1.
     */
    async consumeHandover(options) {
        const signal = await waitForHandover({
            payload: options.payload,
            idleTimeoutInSeconds: options.idleTimeoutInSeconds,
            timeout: options.timeout,
        });
        if (!signal || signal.kind === "handover-skip") {
            return { isFinal: false, skipped: true };
        }
        if (options.payload.headStartMessages && options.payload.headStartMessages.length > 0) {
            await this.setMessages(options.payload.headStartMessages);
        }
        this.applyHandover(signal);
        return { isFinal: signal.isFinal, skipped: false };
    }
    async addResponse(response) {
        if (!response.id) {
            response = { ...response, id: (0, ai_runtime_js_1.generateId)() };
        }
        // Tool-approval and handover-resume continuations reuse the trailing
        // assistant's ID (via originalMessages on the pipe), so the captured
        // response can carry the same ID as a message already in the chain
        // (e.g. a spliced handover partial). Replace in place instead of pushing
        // a duplicate, mirroring the chat.agent accumulator.
        const existingIdx = this.uiMessages.findIndex((m) => m.id === response.id);
        if (existingIdx !== -1) {
            const previous = this.uiMessages[existingIdx];
            this.uiMessages[existingIdx] = response;
            const handoverRun = this._handoverRun && this._handoverRun.id === previous.id
                ? this._handoverRun.run
                : undefined;
            if (handoverRun)
                this._handoverRun = undefined;
            try {
                if (!(await replaceModelRun(this.modelMessages, previous, response, 0, handoverRun))) {
                    this.modelMessages = await toModelMessages(this.uiMessages.map((m) => stripProviderMetadata(m)));
                }
            }
            catch {
                // Conversion failed — leave the existing model messages in place
            }
            return;
        }
        this.uiMessages.push(response);
        try {
            const msgs = await toModelMessages([stripProviderMetadata(response)]);
            this.modelMessages.push(...msgs);
        }
        catch {
            // Conversion failed — skip model message accumulation for this response
        }
    }
    /**
     * Queue a message for injection via `prepareStep`. Call from a
     * `messagesInput.on()` listener when a message arrives during streaming.
     */
    steer(message, modelMessages) {
        if (modelMessages) {
            this._steeringQueue.push({ uiMessage: message, modelMessages });
        }
        else {
            // Defer conversion — will be done in prepareStep if needed
            this._steeringQueue.push({ uiMessage: message, modelMessages: [] });
        }
    }
    /**
     * Queue a message for injection, converting to model messages automatically.
     */
    async steerAsync(message) {
        const modelMsgs = await toModelMessages([message]);
        this._steeringQueue.push({ uiMessage: message, modelMessages: modelMsgs });
    }
    /**
     * Record the messages a steering drain consumed.
     *
     * The drain only puts them in this step's prompt, so without this they
     * shape one answer and then exist in neither lane: not in `uiMessages`,
     * which is what an app persists from, and not in `modelMessages`, which is
     * what every later turn sends.
     *
     * Both lanes are appended to. The model lane is never reconverted from the
     * UI lane, because `compactIfNeeded` replaces it with a summary and leaves
     * the UI lane whole: a reconversion would restore everything the summary
     * replaced.
     */
    async absorbSteering(claimed, injected) {
        const fresh = claimed.filter((m) => !this.uiMessages.some((e) => e.id === m.id));
        if (fresh.length === 0)
            return;
        this.uiMessages.push(...fresh);
        // Record what the model received. Only when the whole batch is new is
        // `injected` known to describe exactly these messages.
        this.modelMessages.push(...(injected && fresh.length === claimed.length ? injected : await toModelMessages(fresh)));
    }
    /**
     * Get and clear unconsumed steering messages.
     */
    drainSteering() {
        const result = this._steeringQueue.map((e) => e.uiMessage);
        this._steeringQueue = [];
        return result;
    }
    /**
     * Returns a `prepareStep` function that handles both compaction and
     * pending message injection. Pass to `streamText({ prepareStep: conversation.prepareStep() })`.
     */
    prepareStep() {
        if (!this._compaction && !this._pendingMessages)
            return undefined;
        const comp = this._compaction;
        const pm = this._pendingMessages;
        const queue = this._steeringQueue;
        return async ({ messages, steps }) => {
            let resultMessages;
            // 1. Compaction
            if (comp) {
                const result = await chatCompact(messages, steps, {
                    shouldCompact: comp.shouldCompact,
                    summarize: (msgs) => comp.summarize({ messages: msgs, source: "inner" }),
                });
                if (result.type !== "skipped") {
                    resultMessages = result.messages;
                }
            }
            // 2. Pending message injection
            if (pm && queue.length > 0) {
                const { injected, claimed } = await drainSteeringQueue(pm, resultMessages ?? messages, steps, queue);
                await this.absorbSteering(claimed, injected);
                if (injected.length > 0) {
                    resultMessages = [...(resultMessages ?? messages), ...injected];
                }
            }
            return resultMessages ? { messages: resultMessages } : undefined;
        };
    }
    /**
     * Run outer-loop compaction if needed. Call after adding the response
     * and capturing usage. Pass the LAST step's usage (`result.usage`), which is
     * the context the model held on its final call; `result.totalUsage` sums every
     * step of a tool-using turn and belongs in `context.turnUsage`. Applies
     * `compactModelMessages` and `compactUIMessages` callbacks if configured.
     *
     * @returns `true` if compaction was performed, `false` otherwise.
     */
    async compactIfNeeded(usage, context) {
        if (!this._compaction || !usage)
            return false;
        const shouldTrigger = await this._compaction.shouldCompact({
            messages: this.modelMessages,
            totalTokens: usage.totalTokens,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            usage,
            turnUsage: context?.turnUsage,
            totalUsage: context?.totalUsage,
            chatId: context?.chatId,
            turn: context?.turn,
            clientData: context?.clientData,
            source: "outer",
        });
        if (!shouldTrigger)
            return false;
        const summary = await this._compaction.summarize({
            messages: this.modelMessages,
            usage,
            totalUsage: context?.totalUsage,
            chatId: context?.chatId,
            turn: context?.turn,
            clientData: context?.clientData,
            source: "outer",
        });
        const compactEvent = {
            summary,
            uiMessages: this.uiMessages,
            modelMessages: this.modelMessages,
            chatId: context?.chatId ?? "",
            turn: context?.turn ?? 0,
            clientData: context?.clientData,
            source: "outer",
        };
        this.modelMessages = this._compaction.compactModelMessages
            ? await this._compaction.compactModelMessages(compactEvent)
            : [
                {
                    role: "assistant",
                    content: [{ type: "text", text: `[Conversation summary]\n\n${summary}` }],
                },
            ];
        if (this._compaction.compactUIMessages) {
            this.uiMessages = await this._compaction.compactUIMessages(compactEvent);
        }
        return true;
    }
}
function trackActiveChatSessionIterator(iterator) {
    locals_js_1.locals.set(chatActiveSessionIteratorsKey, (locals_js_1.locals.get(chatActiveSessionIteratorsKey) ?? 0) + 1);
    let active = true;
    let closing = false;
    let activeNextCalls = 0;
    let closePromise;
    const nextSettledWaiters = new Set();
    function finish() {
        if (!active)
            return;
        active = false;
        const remaining = Math.max((locals_js_1.locals.get(chatActiveSessionIteratorsKey) ?? 1) - 1, 0);
        locals_js_1.locals.set(chatActiveSessionIteratorsKey, remaining);
    }
    function settleNextCall() {
        activeNextCalls = Math.max(activeNextCalls - 1, 0);
        if (activeNextCalls > 0)
            return;
        for (const resolve of nextSettledWaiters) {
            resolve();
        }
        nextSettledWaiters.clear();
    }
    function waitForNextCalls() {
        if (activeNextCalls === 0)
            return Promise.resolve();
        return new Promise((resolve) => nextSettledWaiters.add(resolve));
    }
    function closeIterator() {
        closing = true;
        if (!closePromise) {
            closePromise = (async () => {
                // A blocked next() can install a new message listener after it resumes.
                // Let every started call settle, then make the inner cleanup final.
                await waitForNextCalls();
                try {
                    return iterator.return
                        ? await iterator.return()
                        : { done: true, value: undefined };
                }
                finally {
                    finish();
                }
            })();
        }
        return closePromise;
    }
    return {
        async next() {
            if (closing) {
                return { done: true, value: undefined };
            }
            activeNextCalls++;
            let result;
            try {
                result = await iterator.next();
            }
            catch (error) {
                settleNextCall();
                try {
                    await closeIterator();
                }
                catch {
                    // Preserve the original iterator error after best-effort cleanup.
                }
                throw error;
            }
            settleNextCall();
            if (result.done) {
                try {
                    await closeIterator();
                }
                catch {
                    // The inner next() already ended cleanly; cleanup remains best-effort.
                }
            }
            else if (closing) {
                // return() won the race. Do not expose a turn the caller has already
                // abandoned; without a new turn-complete boundary its input remains
                // replayable by the continuation run.
                return { done: true, value: undefined };
            }
            return result;
        },
        return() {
            return closeIterator();
        },
    };
}
/**
 * Create a chat session that yields turns as an async iterator.
 *
 * Handles: preload wait, stop signals, message accumulation, turn-complete
 * signaling, and idle/suspend between turns. You control: initialization,
 * model/tool selection, persistence, and any custom per-turn logic.
 *
 * Call from inside a `chat.customAgent()` run — the wrapper binds the
 * backing Session that the iterator's stop signal and message channels
 * resolve to. (A plain `task()` does not bind it, so `createSession`
 * would throw "session handle is not initialized".)
 *
 * @example
 * ```ts
 * import { chat, type ChatTaskWirePayload } from "@trigger.dev/sdk/ai";
 * import { streamText } from "ai";
 * import { openai } from "@ai-sdk/openai";
 *
 * export const myChat = chat.customAgent({
 *   id: "my-chat",
 *   run: async (payload: ChatTaskWirePayload, { signal }) => {
 *     const session = chat.createSession(payload, { signal });
 *
 *     for await (const turn of session) {
 *       const result = streamText({
 *         model: openai("gpt-4o"),
 *         messages: turn.messages,
 *         abortSignal: turn.signal,
 *       });
 *       await turn.complete(result);
 *     }
 *   },
 * });
 * ```
 */
function createChatSession(payload, options) {
    const { signal: runSignal, idleTimeoutInSeconds: sessionIdleTimeoutOpt, timeout = "1h", maxTurns = 100, compaction: sessionCompaction, pendingMessages: sessionPendingMessages, versionSkew: sessionVersionSkew, } = options;
    const idleTimeoutInSeconds = sessionIdleTimeoutOpt ?? 30;
    return {
        [Symbol.asyncIterator]() {
            let currentPayload = payload;
            let turn = -1;
            // Created on the first next() call, AFTER the resume-cursor seed —
            // createStopSignal attaches the `.in` SSE tail, and attaching
            // before the seed replays every record from seq 0 (the seed is a
            // no-op when the chatCustomAgent wrapper already ran it).
            let stop;
            let booted = false;
            const accumulator = new ChatMessageAccumulator();
            let previousTurnUsage;
            let cumulativeUsage = emptyUsage();
            // The current turn's message subscription — detached defensively at the
            // top of next() in case user code threw without complete()/done().
            let activeMsgSub;
            const iterator = {
                async next() {
                    activeMsgSub?.off();
                    activeMsgSub = undefined;
                    if (!booted) {
                        booted = true;
                        await installChatInputRouter(currentPayload.chatId, {
                            resuming: Boolean(currentPayload.continuation),
                        });
                        stop = createStopSignal();
                    }
                    turn++;
                    // Head-start handover: the server triggered this run with
                    // `trigger: "handover-prepare"` and signals the warm step-1 partial on
                    // `session.in`. Wait for it BEFORE any `messagesInput.waitWithIdleTimeout`
                    // (that facade consumes-and-discards non-message chunks and would swallow
                    // the signal). Turn-0 only — continuation boots never carry this trigger.
                    let handoverThisTurn = null;
                    let pendingHandoverSignal = null;
                    if (turn === 0 && currentPayload.trigger === "handover-prepare") {
                        const signal = await waitForHandover({
                            payload: currentPayload,
                            idleTimeoutInSeconds: sessionIdleTimeoutOpt ??
                                currentPayload.idleTimeoutInSeconds ??
                                idleTimeoutInSeconds,
                            timeout,
                        });
                        if (!signal || signal.kind === "handover-skip" || runSignal.aborted) {
                            stop.cleanup();
                            return { done: true, value: undefined };
                        }
                        pendingHandoverSignal = signal;
                        handoverThisTurn = { isFinal: signal.isFinal };
                        // Rewrite to a normal first-turn message turn so the rest of the loop
                        // (steering setup, addIncoming, turnObj) runs unchanged.
                        currentPayload = { ...currentPayload, trigger: "submit-message", message: undefined };
                    }
                    // First turn: wait when the boot payload carries no message.
                    // Preload boots wait for the first real message; continuation
                    // boots (fresh run via `ensureRunForSession` / end-and-continue)
                    // arrive with the sticky boot-payload fields stripped, so running
                    // a turn immediately would invoke the model with no user input.
                    const isMessagelessContinuationBoot = currentPayload.continuation === true && !currentPayload.message;
                    if (turn === 0 &&
                        (currentPayload.trigger === "preload" || isMessagelessContinuationBoot)) {
                        const result = await messagesInput.waitWithIdleTimeout({
                            idleTimeoutInSeconds: sessionIdleTimeoutOpt ?? currentPayload.idleTimeoutInSeconds ?? 30,
                            timeout,
                            spanName: currentPayload.trigger === "preload"
                                ? "first message"
                                : "first message (continuation)",
                        });
                        if (!result.ok || runSignal.aborted) {
                            stop.cleanup();
                            return { done: true, value: undefined };
                        }
                        const continuationBoot = isMessagelessContinuationBoot;
                        currentPayload = result.output;
                        // Preserve the continuation flag — the wire payload of the next
                        // message doesn't carry it, and `turn.continuation` is how the
                        // user knows to seed history (e.g. `turn.setMessages(stored)`).
                        if (continuationBoot && currentPayload.continuation === undefined) {
                            currentPayload = { ...currentPayload, continuation: true };
                        }
                    }
                    /**
                     * Subsequent turns take the next message from the router. A record
                     * that arrived mid-turn is already queued there, so this returns it
                     * without suspending.
                     */
                    if (turn > 0) {
                        if (locals_js_1.locals.get(chatCloseRequestedKey)) {
                            await performChatClose();
                            stop.cleanup();
                            return { done: true, value: undefined };
                        }
                        // chat.requestUpgrade() / chat.endRun() — exit before waiting
                        if (locals_js_1.locals.get(chatUpgradeRequestedKey) || locals_js_1.locals.get(chatEndRunRequestedKey)) {
                            if (locals_js_1.locals.get(chatUpgradeRequestedKey)) {
                                await persistUpgradeHandoff();
                            }
                            stop.cleanup();
                            return { done: true, value: undefined };
                        }
                        const next = await messagesInput.waitWithIdleTimeout({
                            idleTimeoutInSeconds,
                            timeout,
                            spanName: "next message",
                        });
                        if (!next.ok || runSignal.aborted) {
                            stop.cleanup();
                            return { done: true, value: undefined };
                        }
                        /**
                         * The facade validated `clientData` against the configured schema
                         * before returning, so the parsed shape is what arrives here. The
                         * cast carries that across the untyped wire payload boundary.
                         */
                        currentPayload = next.output;
                    }
                    // Check limits
                    if (turn >= maxTurns || runSignal.aborted) {
                        stop.cleanup();
                        return { done: true, value: undefined };
                    }
                    // Reset stop signal for this turn
                    stop.reset();
                    // Reset per-turn state
                    locals_js_1.locals.set(chatResponsePartsKey, []);
                    // Set up steering queue and pending messages config in locals
                    // so toStreamTextOptions() auto-injects prepareStep for steering
                    const turnSteeringQueue = [];
                    locals_js_1.locals.set(chatSteeringQueueKey, turnSteeringQueue);
                    if (sessionPendingMessages) {
                        locals_js_1.locals.set(chatPendingMessagesKey, sessionPendingMessages);
                    }
                    locals_js_1.locals.set(chatTurnContextKey, {
                        chatId: currentPayload.chatId,
                        turn,
                        continuation: currentPayload.continuation ?? false,
                        clientData: currentPayload.metadata,
                    });
                    /**
                     * Only attached when there is a steering config to feed. Without one a
                     * mid-turn message stays queued on the router, which is what keeps the
                     * resume floor behind it.
                     */
                    const handleSteeringMessage = async (msg, seqNum, isActive = () => true) => {
                        const lastUIMessage = msg.message;
                        if (lastUIMessage) {
                            if (sessionPendingMessages?.onReceived) {
                                try {
                                    await sessionPendingMessages.onReceived({
                                        message: lastUIMessage,
                                        chatId: currentPayload.chatId,
                                        turn,
                                    });
                                }
                                catch {
                                    /* non-fatal */
                                }
                            }
                            if (!isActive())
                                return;
                            try {
                                const modelMsgs = await toModelMessages([lastUIMessage]);
                                turnSteeringQueue.push({
                                    uiMessage: lastUIMessage,
                                    modelMessages: modelMsgs,
                                    seqNum,
                                });
                            }
                            catch {
                                /* non-fatal */
                            }
                        }
                    };
                    const sessionMsgSub = sessionPendingMessages
                        ? locals_js_1.locals.get(chatCustomAgentClientDataParserKey)
                            ? observeValidatedChatMessages((msg, seqNum, isActive) => handleSteeringMessage(msg, seqNum, isActive))
                            : chatInputRouter().observe(CHAT_ROUTE_MESSAGES, (record) => {
                                const msg = record.data.payload;
                                void handleSteeringMessage(msg, record.seqNum);
                            })
                        : undefined;
                    activeMsgSub = sessionMsgSub;
                    // Accumulate messages. Slim wire: pass the single delta message as
                    // a 0-or-1-length array. The accumulator's behavior is unchanged —
                    // it still appends user messages and reconverts on regenerate.
                    const incomingForAccumulator = currentPayload.message
                        ? [currentPayload.message]
                        : [];
                    const _messages = await accumulator.addIncoming(incomingForAccumulator, currentPayload.trigger, turn);
                    // Apply the head-start handover AFTER addIncoming — turn-0 addIncoming
                    // replaces accumulator state, which would wipe a pre-applied splice.
                    // Seed prior history first, then splice the warm step-1 partial.
                    if (pendingHandoverSignal) {
                        const priorHistory = currentPayload.headStartMessages;
                        if (priorHistory && priorHistory.length > 0) {
                            await accumulator.setMessages(priorHistory);
                        }
                        accumulator.applyHandover(pendingHandoverSignal);
                    }
                    await followSessionPin(currentPayload.chatId, sessionVersionSkew);
                    // chat.requestUpgrade() called before this turn — signal transport and exit
                    if (locals_js_1.locals.get(chatUpgradeRequestedKey)) {
                        await writeUpgradeRequiredChunk();
                        sessionMsgSub?.off();
                        stop.cleanup();
                        return { done: true, value: undefined };
                    }
                    const combinedSignal = AbortSignal.any([runSignal, stop.signal]);
                    const turnObj = {
                        number: turn,
                        chatId: currentPayload.chatId,
                        trigger: currentPayload.trigger,
                        clientData: currentPayload.metadata,
                        get messages() {
                            return accumulator.modelMessages;
                        },
                        get uiMessages() {
                            return accumulator.uiMessages;
                        },
                        signal: combinedSignal,
                        get stopped() {
                            return stop.signal.aborted && !runSignal.aborted;
                        },
                        continuation: currentPayload.continuation ?? false,
                        previousTurnUsage,
                        totalUsage: cumulativeUsage,
                        handover: handoverThisTurn,
                        async setMessages(uiMessages) {
                            await accumulator.setMessages(uiMessages);
                        },
                        async complete(source) {
                            // Head-start final turn: the warm step-1 partial is already spliced
                            // into the accumulator and IS the response — nothing to pipe. Only
                            // valid on a final handover; a missing source on any other turn is a
                            // mistake (it would silently finalize without an assistant response).
                            if (!source) {
                                if (!handoverThisTurn?.isFinal) {
                                    throw new Error("turn.complete() requires a stream source unless turn.handover.isFinal is true");
                                }
                                const response = accumulator.uiMessages.at(-1);
                                if (!response || response.role !== "assistant") {
                                    throw new Error("turn.complete() could not find the spliced handover response");
                                }
                                sessionMsgSub?.off();
                                await chatWriteTurnComplete();
                                return response;
                            }
                            let response;
                            try {
                                const captured = await pipeChatAndCapture(source, {
                                    signal: combinedSignal,
                                    // On a non-final handover turn, thread the spliced partial so a
                                    // resumed tool round's tool-output chunks merge into the
                                    // handed-over tool-call. Gated on the handover turn only — a
                                    // normal turn must not pass originalMessages (it would merge the
                                    // fresh response into the prior assistant message).
                                    ...(handoverThisTurn ? { originalMessages: accumulator.uiMessages } : {}),
                                });
                                if (runSignal.aborted) {
                                    // Full cancel — don't accumulate
                                    sessionMsgSub?.off();
                                    await chatWriteTurnComplete();
                                    return undefined;
                                }
                                // Surface a genuine stream failure to the caller. A user stop
                                // (status "aborted") falls through so the partial is accumulated.
                                if (captured.status === "error") {
                                    if (captured.message) {
                                        const partial = cleanupAbortedParts(captured.message);
                                        const queuedParts = locals_js_1.locals.get(chatResponsePartsKey);
                                        if (queuedParts && queuedParts.length > 0) {
                                            partial.parts = [...(partial.parts ?? []), ...queuedParts];
                                            locals_js_1.locals.set(chatResponsePartsKey, []);
                                        }
                                        await accumulator.addResponse(partial);
                                    }
                                    throw captured.error;
                                }
                                response = captured.message;
                            }
                            finally {
                                // Detach at stream end (like the agent loop): the steering queue
                                // can't inject anymore, so later arrivals must buffer for the next turn.
                                sessionMsgSub?.off();
                            }
                            if (response) {
                                const cleaned = stop.signal.aborted && !runSignal.aborted
                                    ? cleanupAbortedParts(response)
                                    : response;
                                // Append any non-transient data parts queued via chat.response or writer.write()
                                const queuedParts = locals_js_1.locals.get(chatResponsePartsKey);
                                if (queuedParts && queuedParts.length > 0) {
                                    cleaned.parts = [...(cleaned.parts ?? []), ...queuedParts];
                                    locals_js_1.locals.set(chatResponsePartsKey, []);
                                }
                                await accumulator.addResponse(cleaned);
                            }
                            else {
                                // No response (manual pipe mode) but there are queued data parts
                                const queuedParts = locals_js_1.locals.get(chatResponsePartsKey);
                                if (queuedParts && queuedParts.length > 0) {
                                    await accumulator.addResponse({
                                        id: (0, ai_runtime_js_1.generateId)(),
                                        role: "assistant",
                                        parts: queuedParts,
                                    });
                                    locals_js_1.locals.set(chatResponsePartsKey, []);
                                }
                            }
                            // Capture token usage from the streamText result. Race with a 2s
                            // timeout — on stop-abort the AI SDK's totalUsage promise can hang
                            // indefinitely, which would wedge the turn loop (same guard as
                            // chat.agent's turn loop).
                            let turnUsage;
                            let lastStepUsage;
                            if (typeof source.totalUsage?.then === "function") {
                                try {
                                    const usage = (await Promise.race([
                                        source.totalUsage,
                                        new Promise((r) => setTimeout(() => r(undefined), 2_000)),
                                    ]));
                                    if (usage) {
                                        turnUsage = usage;
                                        previousTurnUsage = usage;
                                        cumulativeUsage = addUsage(cumulativeUsage, usage);
                                    }
                                }
                                catch {
                                    /* non-fatal */
                                }
                            }
                            const lastStepUsagePromise = source.usage;
                            if (typeof lastStepUsagePromise?.then === "function") {
                                try {
                                    lastStepUsage = (await Promise.race([
                                        lastStepUsagePromise,
                                        new Promise((r) => setTimeout(() => r(undefined), 2_000)),
                                    ]));
                                }
                                catch {
                                    /* non-fatal */
                                }
                            }
                            // Outer-loop compaction (same logic as chat.agent)
                            if (sessionCompaction && turnUsage && !turnObj.stopped) {
                                const contextUsage = lastStepUsage ?? turnUsage;
                                const shouldTrigger = await sessionCompaction.shouldCompact({
                                    messages: accumulator.modelMessages,
                                    totalTokens: contextUsage.totalTokens,
                                    inputTokens: contextUsage.inputTokens,
                                    outputTokens: contextUsage.outputTokens,
                                    usage: contextUsage,
                                    turnUsage,
                                    totalUsage: cumulativeUsage,
                                    chatId: currentPayload.chatId,
                                    turn,
                                    clientData: currentPayload.metadata,
                                    source: "outer",
                                });
                                if (shouldTrigger) {
                                    const summary = await sessionCompaction.summarize({
                                        messages: accumulator.modelMessages,
                                        usage: turnUsage,
                                        totalUsage: cumulativeUsage,
                                        chatId: currentPayload.chatId,
                                        turn,
                                        clientData: currentPayload.metadata,
                                        source: "outer",
                                    });
                                    const compactEvent = {
                                        summary,
                                        uiMessages: accumulator.uiMessages,
                                        modelMessages: accumulator.modelMessages,
                                        chatId: currentPayload.chatId,
                                        turn,
                                        clientData: currentPayload.metadata,
                                        source: "outer",
                                    };
                                    accumulator.modelMessages = sessionCompaction.compactModelMessages
                                        ? await sessionCompaction.compactModelMessages(compactEvent)
                                        : [
                                            {
                                                role: "assistant",
                                                content: [
                                                    { type: "text", text: `[Conversation summary]\n\n${summary}` },
                                                ],
                                            },
                                        ];
                                    if (sessionCompaction.compactUIMessages) {
                                        accumulator.uiMessages =
                                            await sessionCompaction.compactUIMessages(compactEvent);
                                    }
                                }
                            }
                            sessionMsgSub?.off();
                            await chatWriteTurnComplete();
                            return response;
                        },
                        async addResponse(response) {
                            // Append any non-transient data parts queued via chat.response or writer.write()
                            const queuedParts = locals_js_1.locals.get(chatResponsePartsKey);
                            if (queuedParts && queuedParts.length > 0) {
                                response = {
                                    ...response,
                                    parts: [...(response.parts ?? []), ...queuedParts],
                                };
                                locals_js_1.locals.set(chatResponsePartsKey, []);
                            }
                            await accumulator.addResponse(response);
                        },
                        async done() {
                            sessionMsgSub?.off();
                            await chatWriteTurnComplete();
                        },
                        prepareStep() {
                            const hasCompaction = !!sessionCompaction;
                            const hasPending = !!sessionPendingMessages;
                            if (!hasCompaction && !hasPending)
                                return undefined;
                            return async ({ messages: stepMsgs, steps, }) => {
                                let resultMessages;
                                if (sessionCompaction) {
                                    const compactResult = await chatCompact(stepMsgs, steps, {
                                        shouldCompact: sessionCompaction.shouldCompact,
                                        summarize: (msgs) => sessionCompaction.summarize({ messages: msgs, source: "inner" }),
                                    });
                                    if (compactResult.type !== "skipped") {
                                        resultMessages = compactResult.messages;
                                    }
                                }
                                if (sessionPendingMessages) {
                                    const { injected, claimed } = await drainSteeringQueue(sessionPendingMessages, resultMessages ?? stepMsgs, steps, turnSteeringQueue);
                                    await accumulator.absorbSteering(claimed, injected);
                                    if (injected.length > 0) {
                                        resultMessages = [...(resultMessages ?? stepMsgs), ...injected];
                                    }
                                }
                                return resultMessages ? { messages: resultMessages } : undefined;
                            };
                        },
                    };
                    return { done: false, value: turnObj };
                },
                async return() {
                    activeMsgSub?.off();
                    activeMsgSub = undefined;
                    // Reached when the consumer leaves the `for await` early (`break`,
                    // `return`, a throw). A `chat.close()` from the loop body would
                    // otherwise be dropped: the exit that performs it lives in `next()`,
                    // and `next()` is never called again.
                    await performChatClose();
                    // `stop` only exists once next() has booted the iterator.
                    stop?.cleanup();
                    return { done: true, value: undefined };
                },
            };
            return trackActiveChatSessionIterator(iterator);
        },
    };
}
// ---------------------------------------------------------------------------
// chat.local — per-run typed data with Proxy access
// ---------------------------------------------------------------------------
/** @internal Symbol for storing the locals key on the proxy target. */
const CHAT_LOCAL_KEY = Symbol("chatLocalKey");
/** @internal Symbol for storing the dirty-tracking locals key. */
const CHAT_LOCAL_DIRTY_KEY = Symbol("chatLocalDirtyKey");
const chatLocalRegistry = new Set();
/** @internal Run-scoped flag to ensure hydration happens at most once per run. */
const chatLocalsHydratedKey = locals_js_1.locals.create("chat.locals.hydrated");
/**
 * Hydrate chat.local values from subtask metadata (set by `ai.toolExecute()` or legacy `ai.tool()`).
 * Runs once per run — subsequent calls are no-ops.
 * @internal
 */
function hydrateLocalsFromMetadata() {
    if (locals_js_1.locals.get(chatLocalsHydratedKey))
        return;
    locals_js_1.locals.set(chatLocalsHydratedKey, true);
    const opts = metadata_js_1.metadata.get(METADATA_KEY);
    if (!opts?.chatLocals)
        return;
    for (const [id, value] of Object.entries(opts.chatLocals)) {
        locals_js_1.locals.set(locals_js_1.locals.create(id), value);
    }
}
/**
 * Creates a per-run typed data object accessible from anywhere during task execution.
 *
 * Declare at module level, then initialize inside `onBoot` (recommended — fires
 * on every fresh worker including continuation runs). Do NOT initialize in
 * `onChatStart` alone: `onChatStart` only fires on the chat's very first
 * message, so `chat.local` would be uninitialized on continuation runs and
 * `run()` would throw.
 *
 * Multiple locals can coexist — each gets its own isolated run-scoped storage.
 *
 * The `id` is required and must be unique across all `chat.local()` calls in
 * your project. It's used to serialize values into subtask metadata so that
 * `ai.toolExecute()` (or legacy `ai.tool()`) subtasks can auto-hydrate parent locals (read-only).
 *
 * @example
 * ```ts
 * import { chat } from "@trigger.dev/sdk/ai";
 *
 * const userPrefs = chat.local<{ theme: string; language: string }>({ id: "userPrefs" });
 * const gameState = chat.local<{ score: number; streak: number }>({ id: "gameState" });
 *
 * export const myChat = chat.agent({
 *   id: "my-chat",
 *   onBoot: async ({ clientData }) => {
 *     const prefs = await db.prefs.findUnique({ where: { userId: clientData.userId } });
 *     userPrefs.init(prefs ?? { theme: "dark", language: "en" });
 *     gameState.init({ score: 0, streak: 0 });
 *   },
 *   onTurnComplete: async ({ chatId }) => {
 *     if (gameState.hasChanged()) {
 *       await db.save({ where: { chatId }, data: gameState.get() });
 *     }
 *   },
 *   run: async ({ messages }) => {
 *     gameState.score++;
 *     return streamText({
 *       system: `User prefers ${userPrefs.theme} theme. Score: ${gameState.score}`,
 *       messages,
 *     });
 *   },
 * });
 * ```
 */
function chatLocal(options) {
    const id = `chat.local.${options.id}`;
    const localKey = locals_js_1.locals.create(id);
    const dirtyKey = locals_js_1.locals.create(`${id}.dirty`);
    chatLocalRegistry.add({ key: localKey, id });
    const target = {};
    target[CHAT_LOCAL_KEY] = localKey;
    target[CHAT_LOCAL_DIRTY_KEY] = dirtyKey;
    return new Proxy(target, {
        get(_target, prop, _receiver) {
            // Internal Symbol properties
            if (prop === CHAT_LOCAL_KEY)
                return _target[CHAT_LOCAL_KEY];
            if (prop === CHAT_LOCAL_DIRTY_KEY)
                return _target[CHAT_LOCAL_DIRTY_KEY];
            // Instance methods
            if (prop === "init") {
                return (value) => {
                    locals_js_1.locals.set(localKey, value);
                    locals_js_1.locals.set(dirtyKey, false);
                };
            }
            if (prop === "hasChanged") {
                return () => {
                    const dirty = locals_js_1.locals.get(dirtyKey) ?? false;
                    locals_js_1.locals.set(dirtyKey, false);
                    return dirty;
                };
            }
            if (prop === "get") {
                return () => {
                    let current = locals_js_1.locals.get(localKey);
                    if (current === undefined) {
                        hydrateLocalsFromMetadata();
                        current = locals_js_1.locals.get(localKey);
                    }
                    if (current === undefined) {
                        throw new Error("local.get() called before initialization. Call local.init() in onBoot (recommended — fires on every fresh worker including continuation runs) or run() first.");
                    }
                    return { ...current };
                };
            }
            // toJSON for serialization (JSON.stringify(local))
            if (prop === "toJSON") {
                return () => {
                    let current = locals_js_1.locals.get(localKey);
                    if (current === undefined) {
                        hydrateLocalsFromMetadata();
                        current = locals_js_1.locals.get(localKey);
                    }
                    return current ? { ...current } : undefined;
                };
            }
            let current = locals_js_1.locals.get(localKey);
            if (current === undefined) {
                // Auto-hydrate from parent metadata in subtask context
                hydrateLocalsFromMetadata();
                current = locals_js_1.locals.get(localKey);
            }
            if (current === undefined)
                return undefined;
            return current[prop];
        },
        set(_target, prop, value) {
            // Don't allow setting internal Symbols
            if (typeof prop === "symbol")
                return false;
            const current = locals_js_1.locals.get(localKey);
            if (current === undefined) {
                throw new Error("chat.local can only be modified after initialization. " +
                    "Call local.init() in onBoot (recommended — fires on every fresh worker including continuation runs) or run() first. " +
                    "If you previously initialized in onChatStart, move it to onBoot — onChatStart only fires on the chat's very first message and will not run on a continuation.");
            }
            locals_js_1.locals.set(localKey, { ...current, [prop]: value });
            locals_js_1.locals.set(dirtyKey, true);
            return true;
        },
        has(_target, prop) {
            if (typeof prop === "symbol")
                return prop in _target;
            let current = locals_js_1.locals.get(localKey);
            if (current === undefined) {
                hydrateLocalsFromMetadata();
                current = locals_js_1.locals.get(localKey);
            }
            return current !== undefined && prop in current;
        },
        ownKeys() {
            let current = locals_js_1.locals.get(localKey);
            if (current === undefined) {
                hydrateLocalsFromMetadata();
                current = locals_js_1.locals.get(localKey);
            }
            return current ? Reflect.ownKeys(current) : [];
        },
        getOwnPropertyDescriptor(_target, prop) {
            if (typeof prop === "symbol")
                return undefined;
            let current = locals_js_1.locals.get(localKey);
            if (current === undefined) {
                hydrateLocalsFromMetadata();
                current = locals_js_1.locals.get(localKey);
            }
            if (current === undefined || !(prop in current))
                return undefined;
            return {
                configurable: true,
                enumerable: true,
                writable: true,
                value: current[prop],
            };
        },
    });
}
/**
 * Creates a server-side helper that starts (or resumes) a Session for a
 * given chatId — atomically creating the row, triggering the first run,
 * and returning a session-scoped PAT for the browser to use.
 *
 * Wrap in a Next.js server action (or any server-side handler) so the
 * customer's secret key never crosses to the browser.
 *
 * Parameterise the action with `<typeof yourChatAgent>` to type the
 * `clientData` field against your agent's `clientDataSchema`.
 *
 * @example
 * ```ts
 * // actions.ts
 * "use server";
 * import { chat } from "@trigger.dev/sdk/ai";
 * import type { myChat } from "@/trigger/chat";
 *
 * export const startChatSession = chat.createStartSessionAction<typeof myChat>(
 *   "my-chat",
 *   { triggerConfig: { machine: "small-1x" } }
 * );
 * ```
 *
 * Then in the browser, threading the typed `clientData` from the transport:
 * ```tsx
 * const transport = useTriggerChatTransport<typeof myChat>({
 *   task: "my-chat",
 *   accessToken: ({ chatId }) => mintChatAccessToken(chatId),
 *   startSession: ({ chatId, clientData }) =>
 *     startChatSession({ chatId, clientData }),
 * });
 * ```
 */
function createChatStartSessionAction(taskId, options) {
    return async (params) => {
        if (!params.chatId) {
            throw new Error("chat.createStartSessionAction: params.chatId is required — used as the session externalId.");
        }
        // Scope the action to `apiClient`'s env: re-enter without it so the body
        // runs once, under that config (read via apiClientManager.accessToken/.baseURL).
        if (options?.apiClient) {
            const { apiClient, ...rest } = options;
            return v3_1.apiClientManager.runWithConfig(apiClient, () => createChatStartSessionAction(taskId, rest)(params));
        }
        // The first run boots before the user's first message lands on
        // `.in/append`, so it sees an empty `messages` array and `trigger:
        // "preload"`. This matches the pre-Sessions preload semantics:
        // `onPreload` fires, the runtime opens its `.in` subscription, the
        // first user message arrives moments later via `.in/append`.
        //
        // `clientData` is folded into `basePayload.metadata` so the agent's
        // `clientDataSchema` validates on the very first turn against the same
        // shape per-turn `metadata` carries via the transport.
        // Auto-tag every chat.agent run with `chat:{chatId}` so the dashboard /
        // run-list filter by chat works without the customer having to wire it
        // up. Mirrors the browser-mediated `TriggerChatTransport.doStart` path.
        // IDs too long to fit within the tag length limit get no automatic tag.
        const tags = (0, ai_shared_js_1.chatRunTags)(params.chatId, params.triggerConfig?.tags ?? options?.triggerConfig?.tags);
        const clientDataMetadata = params.clientData !== undefined ? { metadata: params.clientData } : {};
        const maxAttempts = params.triggerConfig?.maxAttempts ?? options?.triggerConfig?.maxAttempts;
        const maxDuration = params.triggerConfig?.maxDuration ?? options?.triggerConfig?.maxDuration;
        const idleTimeoutInSeconds = params.triggerConfig?.idleTimeoutInSeconds ?? options?.triggerConfig?.idleTimeoutInSeconds;
        // Only `undefined` means "not supplied": a per-call `null` (opt out) has to beat a pinning
        // action default, which neither truthiness nor `??` would allow.
        const externalDeploymentId = params.triggerConfig?.externalDeploymentId !== undefined
            ? params.triggerConfig.externalDeploymentId
            : options?.triggerConfig?.externalDeploymentId;
        const triggerConfig = {
            basePayload: {
                messages: [],
                trigger: "preload",
                ...(options?.triggerConfig?.basePayload ?? {}),
                ...(params.triggerConfig?.basePayload ?? {}),
                ...clientDataMetadata,
                chatId: params.chatId,
            },
            ...(options?.triggerConfig?.machine || params.triggerConfig?.machine
                ? { machine: params.triggerConfig?.machine ?? options?.triggerConfig?.machine }
                : {}),
            ...(options?.triggerConfig?.queue || params.triggerConfig?.queue
                ? { queue: params.triggerConfig?.queue ?? options?.triggerConfig?.queue }
                : {}),
            tags,
            ...(maxAttempts !== undefined ? { maxAttempts } : {}),
            ...(maxDuration !== undefined ? { maxDuration } : {}),
            ...(options?.triggerConfig?.region || params.triggerConfig?.region
                ? { region: params.triggerConfig?.region ?? options?.triggerConfig?.region }
                : {}),
            ...(options?.triggerConfig?.lockToVersion || params.triggerConfig?.lockToVersion
                ? {
                    lockToVersion: params.triggerConfig?.lockToVersion ?? options?.triggerConfig?.lockToVersion,
                }
                : {}),
            ...(params.triggerConfig?.ttl !== undefined || options?.triggerConfig?.ttl !== undefined
                ? { ttl: params.triggerConfig?.ttl ?? options?.triggerConfig?.ttl }
                : {}),
            ...(externalDeploymentId !== undefined ? { externalDeploymentId } : {}),
            ...(idleTimeoutInSeconds !== undefined ? { idleTimeoutInSeconds } : {}),
        };
        const startBody = {
            type: "chat.agent",
            externalId: params.chatId,
            taskIdentifier: taskId,
            triggerConfig,
            metadata: params.metadata,
        };
        const baseURLOption = options?.baseURL;
        const fetchOverride = options?.fetch;
        const hasOverride = baseURLOption !== undefined || fetchOverride !== undefined;
        const created = hasOverride
            ? await callSessionsCreateWithOverride({
                chatId: params.chatId,
                body: startBody,
                baseURLOption,
                fetchOverride,
            })
            : await sessions_js_1.sessions.start(startBody);
        // Session create returns a session PAT directly when called with a
        // start token, but when the SDK call goes via the secret key we still
        // need to mint our own (the server returns a PAT regardless, but
        // re-minting here lets the customer override `tokenTTL`).
        const publicAccessToken = options?.tokenTTL !== undefined
            ? hasOverride
                ? await mintPublicTokenWithOverride({
                    chatId: params.chatId,
                    expirationTime: options.tokenTTL,
                    baseURLOption,
                    fetchOverride,
                })
                : await auth_js_1.auth.createPublicToken({
                    scopes: {
                        read: { sessions: params.chatId },
                        write: { sessions: params.chatId },
                    },
                    expirationTime: options.tokenTTL,
                })
            : created.publicAccessToken;
        return {
            publicAccessToken,
            runId: created.runId,
            sessionId: created.id,
            ...(created.pendingVersion ? { pendingVersion: true } : {}),
        };
    };
}
function resolveChatStartBaseURL(endpoint, chatId, option) {
    const fallback = v3_1.apiClientManager.baseURL ?? "https://api.trigger.dev";
    const raw = typeof option === "function" ? option({ endpoint, chatId }) : (option ?? fallback);
    return raw.replace(/\/$/, "");
}
function overrideRequestHeaders(accessToken) {
    const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "x-trigger-source": "sdk",
    };
    // Forward the preview-branch hint so override-mode requests land on the
    // same env the standard ApiClient path would have routed to. Mirrors
    // ApiClient.#getHeaders. Read from TRIGGER_PREVIEW_BRANCH /
    // VERCEL_GIT_COMMIT_REF via apiClientManager.branchName.
    if (v3_1.apiClientManager.branchName) {
        headers["x-trigger-branch"] = v3_1.apiClientManager.branchName;
    }
    return headers;
}
async function callSessionsCreateWithOverride(args) {
    const accessToken = v3_1.apiClientManager.accessToken;
    if (!accessToken) {
        throw new Error("chat.createStartSessionAction: no API access token configured. Set TRIGGER_SECRET_KEY or call apiClientManager.setGlobalAPIClientConfiguration before invoking the action.");
    }
    const ctx = { endpoint: "sessions", chatId: args.chatId };
    const url = `${resolveChatStartBaseURL("sessions", args.chatId, args.baseURLOption)}/api/v1/sessions`;
    const init = {
        method: "POST",
        headers: overrideRequestHeaders(accessToken),
        // This path bypasses `sessions.start`, so it resolves the pin itself.
        body: JSON.stringify((0, externalDeploymentId_js_1.withResolvedExternalDeploymentId)(args.body)),
    };
    const response = args.fetchOverride
        ? await args.fetchOverride(url, init, ctx)
        : await fetch(url, init);
    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`sessions.start failed: ${response.status} ${text}`);
    }
    const json = (await response.json());
    return json;
}
async function mintPublicTokenWithOverride(args) {
    const accessToken = v3_1.apiClientManager.accessToken;
    if (!accessToken) {
        throw new Error("chat.createStartSessionAction: no API access token configured for JWT mint.");
    }
    const ctx = { endpoint: "auth", chatId: args.chatId };
    const scopes = [`read:sessions:${args.chatId}`, `write:sessions:${args.chatId}`];
    const serverMint = (0, v3_1.isAdditionalApiKey)(accessToken);
    const endpoint = serverMint ? "/api/v1/auth/public-tokens" : "/api/v1/auth/jwt/claims";
    const url = `${resolveChatStartBaseURL("auth", args.chatId, args.baseURLOption)}${endpoint}`;
    const init = {
        method: "POST",
        headers: overrideRequestHeaders(accessToken),
        ...(serverMint
            ? {
                body: JSON.stringify({
                    scopes,
                    expirationTime: args.expirationTime instanceof Date
                        ? Math.floor(args.expirationTime.getTime() / 1000)
                        : args.expirationTime,
                }),
            }
            : {}),
    };
    const response = args.fetchOverride
        ? await args.fetchOverride(url, init, ctx)
        : await fetch(url, init);
    if (!response.ok) {
        // An additional API key cannot self-sign, so it must use the server mint
        // endpoint. On a server too old to expose it, explain the recovery path
        // instead of surfacing a bare 404 (mirrors auth.createServerPublicToken).
        if (serverMint && response.status === 404) {
            throw new Error("This additional API key cannot self-sign public tokens, and the server does not support public-token minting. Upgrade the server or use the root API key.");
        }
        const text = await response.text().catch(() => "");
        throw new Error(`auth.createPublicToken failed: ${response.status} ${text}`);
    }
    const responseBody = (await response.json());
    if (serverMint) {
        if (typeof responseBody.token !== "string") {
            throw new Error("auth.createPublicToken failed: server response did not include a token");
        }
        return responseBody.token;
    }
    return (0, v3_1.generateJWT)({
        secretKey: accessToken,
        payload: {
            ...responseBody,
            scopes,
        },
        expirationTime: args.expirationTime,
    });
}
/**
 * Creates a server-side helper that reads a conversation from a transcript
 * storage, for rendering history before the chat connects. Works the same
 * for every storage, the platform default included, so the browser never
 * reads a store directly and the secret key stays on the server.
 *
 * Wrap it in a Next.js server action (or any server-side handler), scope it
 * to the authenticated user through `clientData`, and pass the result to
 * `useLoadTranscript` in the browser.
 *
 * @example
 * ```ts
 * // actions.ts
 * "use server";
 * import { chat, defaultStorage } from "@trigger.dev/sdk/ai";
 *
 * export const loadTranscript = chat.createLoadTranscriptAction(defaultStorage, { limit: 50 });
 * ```
 */
function createChatLoadTranscriptAction(storage, options) {
    return async (params) => {
        if (!params.chatId) {
            throw new Error("chat.createLoadTranscriptAction: params.chatId is required.");
        }
        if (options?.apiClient) {
            const { apiClient, ...rest } = options;
            return v3_1.apiClientManager.runWithConfig(apiClient, () => createChatLoadTranscriptAction(storage, rest)(params));
        }
        const limit = params.limit ?? options?.limit;
        return storage.load({ chatId: params.chatId, clientData: params.clientData }, {
            ...(limit !== undefined ? { limit } : {}),
            ...(params.before !== undefined ? { before: params.before } : {}),
        });
    };
}
exports.chat = {
    /** Create a chat agent. See {@link chatAgent}. */
    agent: chatAgent,
    /** Create a custom agent with manual lifecycle control. See {@link chatCustomAgent}. */
    customAgent: chatCustomAgent,
    /** Create a chat task with a fixed {@link UIMessage} subtype and optional default stream options. See {@link withUIMessage}. */
    withUIMessage,
    /** Create a chat task with a fixed client data schema. See {@link withClientData}. */
    withClientData,
    /** Create a server-side helper for starting (or resuming) a Session for a chatId. See {@link createChatStartSessionAction}. */
    createStartSessionAction: createChatStartSessionAction,
    /** Returns a server-side helper that reads a conversation from a transcript storage. */
    createLoadTranscriptAction: createChatLoadTranscriptAction,
    /** Pipe a stream to the chat transport. See {@link pipeChat}. */
    pipe: pipeChat,
    /** Return from `onAction` to run a turn on the edited history. See {@link chatTurn}. */
    turn: chatTurn,
    /** Create a per-run typed local. See {@link chatLocal}. */
    local: chatLocal,
    /** Create a public access token for a chat task. See {@link createChatAccessToken}. */
    createAccessToken: createChatAccessToken,
    /** Override the turn timeout at runtime (duration string). See {@link setTurnTimeout}. */
    setTurnTimeout,
    /** Override the turn timeout at runtime (seconds). See {@link setTurnTimeoutInSeconds}. */
    setTurnTimeoutInSeconds,
    /** Override the idle timeout at runtime. See {@link setIdleTimeoutInSeconds}. */
    setIdleTimeoutInSeconds,
    /** Override toUIMessageStream() options for the current turn. See {@link setUIMessageStreamOptions}. */
    setUIMessageStreamOptions,
    /** Check if the current turn was stopped by the user. See {@link isStopped}. */
    isStopped,
    /** Request that the run exits after the current turn so the next message starts on the latest version. See {@link requestUpgrade}. */
    requestUpgrade,
    /** Hand off a custom agent Session to a fresh run. See {@link endAndContinue}. */
    endAndContinue,
    /** Exit the run after the current turn completes, without any upgrade signal. See {@link endRun}. */
    endRun,
    /** End the conversation permanently: close the session and exit the run. See {@link close}. */
    close,
    /** Clean up aborted parts from a UIMessage. See {@link cleanupAbortedParts}. */
    cleanupAbortedParts,
    /** Register background work that runs in parallel with streaming. See {@link chatDefer}. */
    defer: chatDefer,
    deferBeforeOutput: chatDeferBeforeOutput,
    /** Queue model messages for injection at the next `prepareStep` boundary. See {@link injectBackgroundContext}. */
    inject: injectBackgroundContext,
    /** Typed chat output stream for writing custom chunks or piping from subtasks. */
    stream: chatStream,
    /** Write data parts that persist to the response message. See {@link chatResponse}. */
    response: chatResponse,
    /** Pre-built input stream for receiving messages from the transport. */
    messages: messagesInput,
    /** The current chat.agent run's Session handle. See {@link SessionHandle}. */
    session: getChatSession,
    /**
     * Open a named side channel on the current chat.agent run's Session: a
     * durable, cross-run `.in`/`.out` pair addressed by `name`, separate from the
     * chat transcript. Writing its `.in` does not wake a run. Shortcut for
     * `chat.session().channel(name)`.
     */
    channel: (channel) => getChatSession().channel(channel),
    /** Create a managed stop signal wired to the stop input stream. See {@link createStopSignal}. */
    createStopSignal,
    /** Signal the frontend that the current turn is complete. See {@link chatWriteTurnComplete}. */
    writeTurnComplete: chatWriteTurnComplete,
    /** Pipe a stream and capture the response message. See {@link pipeChatAndCapture}. */
    pipeAndCapture: pipeChatAndCapture,
    /** Message accumulator class for raw task chat. See {@link ChatMessageAccumulator}. */
    MessageAccumulator: ChatMessageAccumulator,
    /** Create a chat session (async iterator). See {@link createChatSession}. */
    createSession: createChatSession,
    /**
     * Wait for a `chat.headStart` handover signal inside a `chat.customAgent`
     * loop (turn 0). See {@link waitForHandover}. For most loops prefer the
     * `chat.MessageAccumulator.consumeHandover()` convenience, which also seeds
     * `payload.headStartMessages` and applies the partial.
     */
    waitForHandover,
    /**
     * Store and retrieve a resolved prompt for the current run.
     *
     * - `chat.prompt.set(resolved)` — store a `ResolvedPrompt` or plain string
     * - `chat.prompt.set(resolved, { providerOptions })` — also attach provider
     *   options to the system block so a provider can cache it (e.g. Anthropic
     *   prompt caching). See the prompt-caching guide.
     * - `chat.prompt()` — read the stored prompt (throws if not set)
     */
    prompt: Object.assign(getChatPrompt, { set: setChatPrompt }),
    /**
     * Store and retrieve resolved agent skills for the current run.
     *
     * - `chat.skills.set([...])` — store an array of `ResolvedSkill`s
     * - `chat.skills()` — read the stored skills (returns undefined if none)
     *
     * Skills set here are automatically injected into `streamText` by
     * `chat.toStreamTextOptions()`: skill descriptions land in the system
     * prompt and `loadSkill` / `readFile` / `bash` tools are added to the
     * tool set.
     */
    skills: Object.assign(getChatSkills, { set: setChatSkills }),
    /**
     * Returns an options object ready to spread into `streamText()`.
     * Reads the stored prompt and returns `{ system, experimental_telemetry, ...config }`.
     * Returns `{}` if no prompt has been set.
     */
    toStreamTextOptions,
    /**
     * Replace the accumulated conversation messages for compaction.
     * Call from `onTurnStart` or `onTurnComplete`. Takes `UIMessage[]` and
     * converts to `ModelMessage[]` internally.
     */
    setMessages: setChatMessages,
    /**
     * Imperative API for modifying the accumulated message history.
     * Supports rollback, remove, replace, slice, and full replacement.
     * Can be called from any hook or `run()`.
     */
    history: chatHistory,
    /** Check if it's safe to compact messages (no in-flight tool calls). */
    isCompactionSafe,
    /** Returns a `prepareStep` function that handles context compaction automatically. */
    compactionStep: chatCompactionStep,
    /** Low-level compaction for use inside a custom `prepareStep`. */
    compact: chatCompact,
    /** Read the current compaction state (summary + base message count). */
    getCompactionState,
    /**
     * The friendlyId (`session_*`) of the backing Session for the current chat.agent run.
     * Useful for persisting alongside `runId` so reloads can resume the same session.
     * Throws if called outside a chat.agent `run()` or hook.
     */
    get sessionId() {
        return getChatSession().id;
    },
};
/**
 * Writes a `turn-complete` control record to the chat output stream and,
 * if we have a prior turn-complete's seq_num, appends an S2 `trim` command
 * record back to it — keeping `session.out` bounded to roughly one turn
 * at steady state.
 *
 * The control record's body is empty; `trigger-control: turn-complete`
 * plus an optional `public-access-token` ride on the headers (see
 * `docs/ai-chat/client-protocol.mdx`). SDK transports filter it from the
 * consumer chunk stream and surface it via `onControl` / `onTurnComplete`.
 *
 * Trim is opportunistic and monotonic at S2's layer. A failed trim is
 * logged and swallowed; the next turn will retry against a fresher
 * target seq_num.
 *
 * @internal
 */
async function writeTurnCompleteChunk(_chatId, publicAccessToken) {
    const session = getChatSession();
    // A handover-prepare boot claims the handover kinds so a signal arriving
    // before `waitForHandover` attaches is not drained. Released here rather than
    // only in `waitForHandover`, because a loop that never calls it would
    // otherwise hold the claim for the life of the run and leave a handover
    // record parked at the head of the channel, where it wedges
    // `chat.messages.next()`. Every surface reaches a turn boundary through this
    // function, including the managed agent, which does not call the public
    // `chat.writeTurnComplete`. By the time a turn completes the handover window
    // is over either way.
    chatInputRouter().clearRoute(CHAT_ROUTE_HANDOVER);
    // 1. Write the turn-complete control record. The ack's `lastEventId` is
    //    this record's seq_num — that's the trim target for the NEXT turn.
    //
    //    Sibling headers:
    //    - `public-access-token` (optional): refresh token surfaced to
    //      browser-side transports via `onTurnComplete`.
    //    - `session-in-event-id` (optional): the committed-consume cursor
    //      on `.in` as of this turn-complete. On next worker boot, the
    //      boot scan reads this back and seeds the `.in` subscription so
    //      already-processed user messages aren't re-delivered.
    const extraHeaders = [];
    if (publicAccessToken) {
        extraHeaders.push(["public-access-token", publicAccessToken]);
    }
    const routerCheckpoint = chatInputRouter().checkpoint();
    const inCursor = routerCheckpoint.resumeFrom;
    if (inCursor !== undefined) {
        extraHeaders.push([v3_1.SESSION_IN_EVENT_ID_HEADER, String(inCursor)]);
    }
    const consumedCursor = routerCheckpoint.appliedThrough;
    if (consumedCursor !== undefined) {
        extraHeaders.push([v3_1.SESSION_IN_CONSUMED_ID_HEADER, String(consumedCursor)]);
    }
    // A close decided before this turn ended rides out on turn-complete. Readers
    // terminate their stream on turn-complete, so a standalone record written
    // after it only reaches a reconnect — this header is what a live client sees.
    const pendingClose = locals_js_1.locals.get(chatCloseRequestedKey);
    if (pendingClose) {
        extraHeaders.push([v3_1.SESSION_CLOSED_HEADER, "true"]);
        if (pendingClose.reason) {
            extraHeaders.push([v3_1.SESSION_CLOSED_REASON_HEADER, pendingClose.reason]);
        }
    }
    const result = await session.out.writeControl(v3_1.TRIGGER_CONTROL_SUBTYPE.TURN_COMPLETE, extraHeaders);
    const T_N = result.lastEventId ? Number.parseInt(result.lastEventId, 10) : undefined;
    // 2. Trim back to the previous turn-complete, if we have one. Skipping on
    //    first-turn-ever (or first turn post-OOM without a snapshot seed) is
    //    fine — the chain catches up next turn.
    //
    // Lazily create the slot if a caller reached here without one (a plain
    // `task()` driving `chat.createSession` / `chat.writeTurnComplete`, vs.
    // chatAgent/chatCustomAgent which seed it at boot). The first call then
    // does no trim (nothing before it) and records its seq; later calls trim
    // — so `.out` is bounded for every writeTurnComplete caller, not just the
    // built-in agents.
    let slot = locals_js_1.locals.get(lastTurnCompleteSeqNumKey);
    if (!slot) {
        slot = { value: undefined };
        locals_js_1.locals.set(lastTurnCompleteSeqNumKey, slot);
    }
    const prev = slot.value;
    if (slot && prev !== undefined) {
        try {
            await session.out.trimTo(prev);
        }
        catch (err) {
            v3_1.logger.warn("chat.agent: trim failed; will retry next turn", {
                error: err instanceof Error ? err.message : String(err),
                prev,
            });
        }
    }
    // 3. Advance the slot so the next turn-complete trims back to this one.
    if (slot && T_N !== undefined && Number.isFinite(T_N)) {
        slot.value = T_N;
    }
    return result;
}
/**
 * Hand off the session to a fresh run on the latest version and emit a
 * telemetry chunk on `.out` so the transport can hide it from the
 * consumer.
 *
 * Server-side flow (in `POST /sessions/:id/end-and-continue`):
 *   1. Trigger a new run with the session's `triggerConfig`
 *   2. Atomically swap `Session.currentRunId` to the new run's id
 *      (via optimistic claim keyed on the calling run's id)
 *   3. Return the new runId
 *
 * The transport keeps its `.out` SSE open across the swap — v1's last
 * chunks land, v2's new chunks land on the same stream (S2 keys on
 * the session, not the run). The transport filters
 * `trigger:upgrade-required` for cleanliness; consumers see no gap.
 *
 * If the swap fails (no current run, no env auth, etc.) we still emit
 * the chunk and exit. The next `.in/append` will trigger a new run via
 * the probe path; it just won't be quite as seamless.
 *
 * @internal
 */
/**
 * Persists an upgrade requested after the turn has already run.
 *
 * The pre-turn sites reach {@link performEndAndContinue} through
 * {@link writeUpgradeRequiredChunk}, which is what clears (or re-points) the
 * session's stored `externalDeploymentId`. The post-turn exits had no such path,
 * so a `chat.requestUpgrade()` from `run()` or `chat.defer()` left the pin intact
 * and every continuation re-pinned to the deployment the agent asked to leave.
 *
 * No `upgrade-required` chunk is written here: the turn already produced its
 * answer, so there is nothing for a client to be told about.
 */
async function persistUpgradeHandoff() {
    const chatId = locals_js_1.locals.get(chatExternalIdKey);
    const callingRunId = locals_js_1.locals.get(chatAgentRunContextKey)?.run.id;
    if (!chatId || !callingRunId) {
        return;
    }
    try {
        await performEndAndContinue({
            reason: "upgrade",
            externalDeploymentId: locals_js_1.locals.get(chatUpgradeExternalDeploymentIdKey),
        });
    }
    catch (error) {
        v3_1.logger.warn("upgrade handoff failed; session keeps its current version pin", {
            chatId,
            callingRunId,
            error,
        });
    }
}
async function writeUpgradeRequiredChunk() {
    const chatId = locals_js_1.locals.get(chatExternalIdKey);
    const callingRunId = locals_js_1.locals.get(chatAgentRunContextKey)?.run.id;
    if (chatId && callingRunId) {
        try {
            await performEndAndContinue({
                reason: "upgrade",
                externalDeploymentId: locals_js_1.locals.get(chatUpgradeExternalDeploymentIdKey),
            });
        }
        catch (error) {
            // Non-fatal: the next `.in/append` re-triggers via the probe.
            // Swallow rather than throw so we still emit the chunk + exit.
            v3_1.logger.warn("end-and-continue failed; falling back to probe-on-append", {
                chatId,
                callingRunId,
                error,
            });
        }
    }
    const session = getChatSession();
    return session.out.writeControl(v3_1.TRIGGER_CONTROL_SUBTYPE.UPGRADE_REQUIRED);
}
/**
 * Extracts the text content of the last user message from a UIMessage array.
 * Returns undefined if no user message is found.
 * @internal
 */
function extractLastUserMessageText(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role !== "user")
            continue;
        // UIMessage uses parts array
        if (msg.parts) {
            const textParts = msg.parts
                .filter((p) => p.type === "text" && p.text)
                .map((p) => p.text);
            if (textParts.length > 0) {
                return textParts.join("\n");
            }
        }
        break;
    }
    return undefined;
}
/**
 * Strips ephemeral OpenAI Responses API `itemId` from a UIMessage's parts.
 *
 * The OpenAI Responses provider attaches `itemId` to message parts via
 * `providerMetadata.openai.itemId`. These IDs are ephemeral — sending them
 * back in a subsequent `streamText` call causes 404s because the provider
 * can't find the referenced item (especially for stopped/partial responses).
 *
 * @internal
 */
function stripProviderMetadata(message) {
    if (!message.parts)
        return message;
    return {
        ...message,
        parts: message.parts.map((part) => {
            const openai = part.providerMetadata?.openai;
            if (!openai?.itemId)
                return part;
            const { itemId, ...restOpenai } = openai;
            const { openai: _, ...restProviders } = part.providerMetadata;
            return {
                ...part,
                providerMetadata: {
                    ...restProviders,
                    ...(Object.keys(restOpenai).length > 0 ? { openai: restOpenai } : {}),
                },
            };
        }),
    };
}
//# sourceMappingURL=ai.js.map