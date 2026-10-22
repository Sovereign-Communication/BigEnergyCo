"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockChatAgent = mockChatAgent;
const v3_1 = require("@trigger.dev/core/v3");
const test_1 = require("@trigger.dev/core/v3/test");
const sessions_js_1 = require("../sessions.js");
const ai_js_1 = require("../ai.js");
const test_session_handle_js_1 = require("./test-session-handle.js");
const CONTROL_CHUNK_TYPES = new Set(["trigger:turn-complete", "trigger:upgrade-required"]);
function isControlChunk(chunk) {
    if (typeof chunk !== "object" || chunk === null)
        return false;
    const type = chunk.type;
    return typeof type === "string" && CONTROL_CHUNK_TYPES.has(type);
}
/**
 * Highest `session.in` seqNum any harness has produced for a session id,
 * keyed by `sessionId`. Production `session.in` is a durable S2 stream whose
 * seqNums are monotonic across the runs of a chat; a fresh in-memory manager
 * per `mockChatAgent` would otherwise restart at 0, so a continuation's
 * follow-up message would collide with the resume floor and be dropped. This
 * survives the per-run manager reset so continuation runs stay monotonic.
 */
const durableSessionInSeq = new Map();
/**
 * Create an offline test harness for a `chat.agent` task.
 *
 * The harness starts the agent's `run()` function in a mocked task context,
 * waits in preload for the first message, then exposes driver methods for
 * sending messages / actions / stop signals and awaiting turn completion.
 *
 * Users are responsible for mocking the language model themselves — use
 * `MockLanguageModelV3` and `simulateReadableStream` from `ai/test` inside
 * their agent's `run()` function (typically via DI through `clientData`).
 *
 * @example
 * ```ts
 * import { mockChatAgent } from "@trigger.dev/sdk/ai/test";
 * import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
 * import { myAgent } from "./my-agent";
 *
 * test("says hello", async () => {
 *   const harness = mockChatAgent(myAgent, { chatId: "test-1" });
 *   try {
 *     const turn = await harness.sendMessage({
 *       id: "m1",
 *       role: "user",
 *       parts: [{ type: "text", text: "hi" }],
 *     });
 *     expect(turn.chunks).toContainEqual(
 *       expect.objectContaining({ type: "text-delta", delta: "hello" })
 *     );
 *   } finally {
 *     await harness.close();
 *   }
 * });
 * ```
 */
function mockChatAgent(agent, options = {}) {
    const chatId = options.chatId ?? "test-chat";
    // The agent opens the session with `payload.sessionId ?? payload.chatId`.
    // We pass no sessionId, so it falls back to chatId.
    const sessionId = chatId;
    // `continuation: true` without an explicit mode auto-selects "continuation"
    // — the canonical shape for a continuation-run boot.
    const mode = options.mode ??
        (options.continuation === true
            ? "continuation"
            : options.preload === false
                ? "submit-message"
                : "preload");
    const clientData = options.clientData;
    const taskEntry = v3_1.resourceCatalog.getTask(agent.id);
    if (!taskEntry) {
        throw new Error(`mockChatAgent: no task registered with id "${agent.id}". ` +
            `Import "@trigger.dev/sdk/ai/test" before your agent module so tasks register correctly.`);
    }
    const runFn = taskEntry.fns.run;
    // Session .out state: chunks + listener registry. Shared between the
    // harness and the TestSessionOutputChannel installed via the open-override.
    const sessionOutState = {
        chunks: [],
        listeners: new Set(),
    };
    // Buffers that survive across harness method calls
    const allRawChunks = [];
    const allChunks = [];
    // Promise that resolves when the background task run() function returns.
    let taskFinished;
    let sendSessionInput;
    let closeSessionInput;
    let runSignal;
    // A latch that resolves every time `trigger:turn-complete` appears on the chat stream.
    // We use a shared pending promise and replace it after each completion.
    let turnCompleteResolvers = [];
    const waitForTurnComplete = () => new Promise((resolve) => {
        turnCompleteResolvers.push(resolve);
    });
    // Signal that the caller is ready to observe output
    let harnessReadyResolve;
    const harnessReady = new Promise((resolve) => {
        harnessReadyResolve = resolve;
    });
    // ── Snapshot read/write override state ───────────────────────────────
    // The runtime's snapshot read returns whatever `seededSnapshot` is at
    // boot time. The runtime's snapshot write captures into
    // `lastWrittenSnapshot` for harness consumers to assert via
    // `getSnapshot()`. Installed below alongside the session overrides;
    // cleared on close in the same finally block.
    let seededSnapshot = options.snapshot;
    let lastWrittenSnapshot;
    let seededReplayChunks = [];
    let seededReplayPartial;
    let seededSessionInMessages = [];
    const closeCalls = [];
    let failCloseCalls = 0;
    (0, ai_js_1.__resetChatInputRouterForTests)();
    (0, ai_js_1.__setReadChatSnapshotImplForTests)(() => seededSnapshot);
    (0, ai_js_1.__setWriteChatSnapshotImplForTests)((_id, snapshot) => {
        lastWrittenSnapshot = snapshot;
    });
    // Replay override: install a default that returns whatever
    // `seededReplayChunks` reduces to. `mockChatAgent` doesn't model the
    // settled-vs-partial split — seeded chunks always reduce to the
    // `settled` array with `partial: undefined`. Recovery-specific
    // tests can install their own override to seed a partial.
    // Cleared in the same `finally` block as the other test overrides.
    (0, ai_js_1.__setReplaySessionOutTailImplForTests)(async () => {
        const settled = seededReplayChunks.length === 0
            ? []
            : (await reduceChunksToMessages(seededReplayChunks));
        // For the mock harness, `partialRaw` is the same as `partial` — we
        // don't model cleanupAbortedParts separately. Recovery tests that
        // need a partialRaw distinct from partial install their own stub.
        return {
            settled,
            partial: seededReplayPartial,
            partialRaw: seededReplayPartial,
        };
    });
    (0, ai_js_1.__setReplaySessionInTailImplForTests)(async () => {
        return seededSessionInMessages.map((message, i) => ({
            message,
            metadata: clientData,
            seqNum: i + 1,
        }));
    });
    // Install the session open override so `sessions.open(id)` returns a
    // SessionHandle with an in-memory `.out` that captures writes. The
    // `.in` channel routes record subscriptions (`on`/`once`/`peek`)
    // through the `sessionStreams` global — the mock task context
    // installs a `TestSessionStreamManager` there — and stubs `wait()`
    // so the suspend path resolves cleanly on `runSignal.abort()` without
    // touching the api client.
    (0, sessions_js_1.__setSessionOpenImplForTests)((id) => (0, test_session_handle_js_1.createTestSessionHandle)(id, sessionOutState, () => runSignal?.signal));
    // Record `sessions.close()` calls instead of reaching the control plane, so
    // a test can assert the agent actually closed the row (and with what reason).
    (0, sessions_js_1.__setSessionCloseImplForTests)((sessionIdOrExternalId, body) => {
        closeCalls.push({
            sessionId: sessionIdOrExternalId,
            ...(body?.reason ? { reason: body.reason } : {}),
        });
        if (failCloseCalls > 0) {
            failCloseCalls--;
            throw new Error("mockChatAgent: sessions.close() failure injected by the test");
        }
        return {
            id: sessionIdOrExternalId,
            externalId: sessionIdOrExternalId,
            closedAt: new Date().toISOString(),
            closedReason: body?.reason ?? null,
        };
    });
    // Install the session start override so any test path that invokes
    // `sessions.start()` (typically through a server action shim like
    // `chat.createStartSessionAction`) becomes a no-op fixture instead of
    // hitting a real API. Most chat.agent tests trigger the run directly
    // via `sendPayloadAndWait` and never go through this path, but the
    // stub keeps the API safe to call from inside tested code.
    (0, sessions_js_1.__setSessionStartImplForTests)((body) => {
        if (process.env.TRIGGER_CHAT_TEST_DEBUG === "1") {
            console.log("[mockChatAgent] sessions.start override:", body);
        }
        const fakeRunId = `run_test_${body.externalId ?? "anon"}`;
        return {
            id: `session_test_${body.externalId ?? "anon"}`,
            externalId: body.externalId ?? null,
            type: body.type,
            taskIdentifier: body.taskIdentifier,
            triggerConfig: body.triggerConfig,
            currentRunId: fakeRunId,
            runId: fakeRunId,
            publicAccessToken: "tr_test_session_pat",
            tags: body.tags ?? [],
            metadata: (body.metadata ?? null),
            closedAt: null,
            closedReason: null,
            expiresAt: null,
            createdAt: new Date(0),
            updatedAt: new Date(0),
            isCached: false,
        };
    });
    taskFinished = (0, test_1.runInMockTaskContext)(async (drivers) => {
        runSignal = new AbortController();
        // For `mode: "continuation"`, omit `trigger` from the wire payload —
        // mirrors what the server's `ensureRunForSession` / `swapSessionRun`
        // produces (the continuation overrides clear `trigger` so the SDK
        // boot path falls into the continuation-wait branch instead of
        // re-firing the basePayload's stale first-run trigger). `continuation:
        // true` is set unconditionally for this mode so the boot path's
        // continuation-wait condition matches.
        const isContinuationMode = mode === "continuation";
        const initialPayload = {
            chatId,
            ...(isContinuationMode
                ? { trigger: undefined, continuation: true }
                : { trigger: mode }),
            metadata: clientData,
            ...(!isContinuationMode && options.continuation ? { continuation: true } : {}),
            ...(options.previousRunId ? { previousRunId: options.previousRunId } : {}),
            ...(options.headStartMessages ? { headStartMessages: options.headStartMessages } : {}),
        };
        const durableSeq = durableSessionInSeq.get(sessionId);
        if (durableSeq !== undefined) {
            v3_1.sessionStreams.setLastSeqNum(sessionId, "in", durableSeq);
        }
        const rawSendSessionInput = drivers.sessions.in.send;
        sendSessionInput = async (id, data, io, metadata) => {
            await rawSendSessionInput(id, data, io, metadata);
            const io2 = io ?? "in";
            if (io2 === "in") {
                const latest = v3_1.sessionStreams.lastSeqNum(id, "in");
                if (latest !== undefined) {
                    durableSessionInSeq.set(id, Math.max(durableSessionInSeq.get(id) ?? latest, latest));
                }
            }
        };
        closeSessionInput = drivers.sessions.in.close;
        // Record every chunk written to session.out, detect turn-complete.
        const listener = (chunk) => {
            allRawChunks.push(chunk);
            if (!isControlChunk(chunk)) {
                allChunks.push(chunk);
            }
            if (typeof chunk === "object" &&
                chunk !== null &&
                chunk.type === "trigger:turn-complete") {
                const resolvers = turnCompleteResolvers;
                turnCompleteResolvers = [];
                for (const resolve of resolvers)
                    resolve();
            }
        };
        sessionOutState.listeners.add(listener);
        const unsubscribe = () => sessionOutState.listeners.delete(listener);
        if (options.setupLocals) {
            await options.setupLocals({ set: drivers.locals.set });
        }
        harnessReadyResolve();
        try {
            if (process.env.TRIGGER_CHAT_TEST_DEBUG === "1") {
                console.log("[mockChatAgent] Starting runFn with payload:", initialPayload);
            }
            await runFn(initialPayload, {
                ctx: drivers.ctx,
                signal: runSignal.signal,
            });
            if (process.env.TRIGGER_CHAT_TEST_DEBUG === "1") {
                console.log("[mockChatAgent] runFn returned");
            }
        }
        catch (err) {
            if (process.env.TRIGGER_CHAT_TEST_DEBUG === "1") {
                console.log("[mockChatAgent] runFn threw:", err);
            }
            throw err;
        }
        finally {
            unsubscribe();
            // Resolve any outstanding turn-complete waiters so callers don't hang
            const resolvers = turnCompleteResolvers;
            turnCompleteResolvers = [];
            for (const resolve of resolvers)
                resolve();
        }
    }, options.taskContext)
        .catch((err) => {
        // Propagate errors to pending turn waiters instead of dropping them
        const resolvers = turnCompleteResolvers;
        turnCompleteResolvers = [];
        for (const resolve of resolvers)
            resolve();
        throw err;
    })
        .finally(() => {
        // Always clear the test overrides, even if the task threw.
        (0, sessions_js_1.__setSessionOpenImplForTests)(undefined);
        (0, sessions_js_1.__setSessionStartImplForTests)(undefined);
        (0, sessions_js_1.__setSessionCloseImplForTests)(undefined);
        (0, ai_js_1.__setReadChatSnapshotImplForTests)(undefined);
        (0, ai_js_1.__setWriteChatSnapshotImplForTests)(undefined);
        (0, ai_js_1.__setReplaySessionOutTailImplForTests)(undefined);
        (0, ai_js_1.__setReplaySessionInTailImplForTests)(undefined);
    });
    const sendPayloadAndWait = async (payload) => {
        await harnessReady;
        const before = allRawChunks.length;
        const turnComplete = waitForTurnComplete();
        await sendSessionInput(sessionId, { kind: "message", payload });
        await turnComplete;
        const rawChunks = allRawChunks.slice(before);
        const chunks = rawChunks.filter((c) => !isControlChunk(c));
        return { chunks, rawChunks };
    };
    const harness = {
        chatId,
        async sendMessage(message) {
            return sendPayloadAndWait({
                message,
                chatId,
                trigger: "submit-message",
                metadata: clientData,
            });
        },
        async sendRegenerate() {
            return sendPayloadAndWait({
                chatId,
                trigger: "regenerate-message",
                metadata: clientData,
            });
        },
        async sendHeadStart({ messages }) {
            return sendPayloadAndWait({
                headStartMessages: messages,
                chatId,
                trigger: "handover-prepare",
                metadata: clientData,
            });
        },
        async sendAction(action) {
            return sendPayloadAndWait({
                chatId,
                trigger: "action",
                action,
                metadata: clientData,
            });
        },
        async sendPendingMessage(message) {
            await harnessReady;
            const seqBefore = v3_1.sessionStreams.lastSeqNum(chatId, "in") ?? -1;
            await sendSessionInput(sessionId, {
                kind: "message",
                payload: {
                    message,
                    chatId,
                    trigger: "submit-message",
                    metadata: clientData,
                },
            });
            /**
             * Wait for the record to be observable on the channel, not merely for the
             * send call to return. A test that continues on the send alone is racing the
             * append: the message can still be in flight when the step boundary runs, so
             * the injection it was meant to trigger silently does not happen and the test
             * passes while proving nothing.
             */
            const deadline = Date.now() + 5_000;
            while ((v3_1.sessionStreams.lastSeqNum(chatId, "in") ?? -1) <= seqBefore) {
                if (Date.now() > deadline) {
                    throw new Error(`sendPendingMessage: append for ${message.id} never landed on session.in`);
                }
                await new Promise((resolve) => setTimeout(resolve, 5));
            }
        },
        async sendStop(message) {
            await harnessReady;
            await sendSessionInput(sessionId, { kind: "stop", message });
        },
        async sendHandover(args) {
            await harnessReady;
            const before = allRawChunks.length;
            const turnComplete = waitForTurnComplete();
            await sendSessionInput(sessionId, {
                kind: "handover",
                partialAssistantMessage: args.partialAssistantMessage,
                messageId: args.messageId,
                isFinal: args.isFinal ?? false,
            });
            await turnComplete;
            const rawChunks = allRawChunks.slice(before);
            const chunks = rawChunks.filter((c) => !isControlChunk(c));
            return { chunks, rawChunks };
        },
        async sendHandoverSkip() {
            await harnessReady;
            // No turn-complete on skip — the agent exits without firing hooks.
            // Send the chunk and wait for the run to finish.
            await sendSessionInput(sessionId, { kind: "handover-skip" });
            await Promise.race([
                taskFinished.catch(() => { }),
                new Promise((resolve) => setTimeout(resolve, 1000)),
            ]);
        },
        async sendClose() {
            await harnessReady;
            await sendSessionInput(sessionId, {
                kind: "message",
                payload: {
                    chatId,
                    trigger: "close",
                },
            });
            await harness.waitForExit();
        },
        async waitForExit(timeoutMs = 2000) {
            let timer;
            const timedOut = new Promise((resolve) => {
                timer = setTimeout(() => resolve("timeout"), timeoutMs);
            });
            try {
                const result = await Promise.race([taskFinished.catch(() => "done"), timedOut]);
                if (result === "timeout") {
                    throw new Error(`mockChatAgent: run did not exit within ${timeoutMs}ms`);
                }
            }
            finally {
                if (timer)
                    clearTimeout(timer);
            }
        },
        getCloseCalls() {
            return [...closeCalls];
        },
        failNextCloseCalls(count) {
            failCloseCalls = count;
        },
        seedSnapshot(snapshot) {
            seededSnapshot = snapshot;
        },
        seedSessionOutTail(chunks) {
            seededReplayChunks = chunks ?? [];
        },
        seedSessionOutPartial(partial) {
            seededReplayPartial = partial;
        },
        seedSessionInTail(messages) {
            seededSessionInMessages = messages;
            // The seeded tail occupies seqNums 1..n of the channel, so anything sent
            // live afterwards has to continue above it.
            if (messages.length > 0) {
                v3_1.sessionStreams.setLastSeqNum(sessionId, "in", messages.length);
            }
        },
        async deliverSessionInAtSeq(message, seqNum) {
            await harnessReady;
            await sendSessionInput(sessionId, { kind: "message", payload: { chatId, trigger: "submit-message", message } }, "in", { seqNum });
        },
        getSnapshot() {
            return lastWrittenSnapshot;
        },
        async close() {
            await harnessReady;
            // Send a close trigger wrapped as a `kind: "message"` ChatInputChunk.
            // The turn loop checks for this after a successful turn and exits
            // cleanly. On error-recovery paths the loop just loops back with
            // the close payload, so we also close the session input below to
            // unblock any pending once() waiters.
            try {
                await sendSessionInput(sessionId, {
                    kind: "message",
                    payload: {
                        chatId,
                        trigger: "close",
                    },
                });
            }
            catch {
                // best-effort
            }
            // Resolve any pending once() waiters on the session input with a
            // timeout error — that makes waitWithIdleTimeout return
            // `{ ok: false }` and the turn loop exits cleanly.
            closeSessionInput?.(sessionId);
            // Also abort the run signal so anything downstream (streamText,
            // deferred work) unwinds promptly.
            runSignal?.abort("close");
            // Wait for run() to return. The loop's error recovery path will
            // see !next.ok and exit. Use a bounded wait so tests never hang.
            await Promise.race([
                taskFinished.catch(() => { }),
                new Promise((resolve) => setTimeout(resolve, 1000)),
            ]);
        },
        get allChunks() {
            return allChunks.slice();
        },
        get allRawChunks() {
            return allRawChunks.slice();
        },
    };
    return harness;
}
/**
 * Reduce a synthetic UIMessageChunk[] sequence into the UIMessage[] that
 * the runtime's `replaySessionOutTail` would produce. Splits chunks at
 * `start` boundaries and feeds each segment through AI SDK's
 * `readUIMessageStream`. The trailing un-finished segment goes through
 * `cleanupAbortedParts`. Mirrors the production reducer used in
 * `ai.ts:replaySessionOutTail`.
 */
async function reduceChunksToMessages(chunks) {
    if (chunks.length === 0)
        return [];
    const aiModule = (await import("ai"));
    const readUIMessageStream = aiModule.readUIMessageStream;
    const cleanupAbortedParts = aiModule.cleanupAbortedParts;
    if (!readUIMessageStream)
        return [];
    const segments = [];
    let current;
    for (const chunk of chunks) {
        if (chunk.type === "start") {
            current = { chunks: [chunk], closed: false };
            segments.push(current);
            continue;
        }
        if (!current) {
            current = { chunks: [], closed: false };
            segments.push(current);
        }
        current.chunks.push(chunk);
        if (chunk.type === "finish") {
            current.closed = true;
            current = undefined;
        }
    }
    const out = [];
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
            for await (const snapshot of readUIMessageStream({ stream: segmentStream })) {
                last = snapshot;
            }
        }
        catch {
            // Skip malformed segment — tests can assert by inspecting what makes it through.
            continue;
        }
        if (!last)
            continue;
        if (isTrailing && cleanupAbortedParts) {
            const cleaned = cleanupAbortedParts(last);
            if (!cleaned.parts || cleaned.parts.length === 0)
                continue;
            out.push(cleaned);
        }
        else {
            out.push(last);
        }
    }
    return out;
}
//# sourceMappingURL=mock-chat-agent.js.map