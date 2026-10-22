import type { UIMessage, UIMessageChunk } from "ai";
import type { LocalsKey, TranscriptSnapshotV2 } from "@trigger.dev/core/v3";
import { type MockTaskContextOptions } from "@trigger.dev/core/v3/test";
import { type ChatSnapshotV1 } from "../ai.js";
/** Pre-seed locals before the agent's `run()` starts. */
type SetupLocals = (locals: {
    set<T>(key: LocalsKey<T>, value: T): void;
}) => void | Promise<void>;
/** A reference to a `chat.agent` task returned by `chat.agent({ id, ... })`. */
type ChatAgentHandle = {
    id: string;
};
/**
 * Options for `mockChatAgent`.
 */
export type MockChatAgentOptions = {
    /** The chat session id passed into every wire payload. Defaults to `"test-chat"`. */
    chatId?: string;
    /** Client-provided metadata (`clientData`) for the session. */
    clientData?: unknown;
    /** Task context overrides passed through to {@link runInMockTaskContext}. */
    taskContext?: MockTaskContextOptions;
    /**
     * Whether to start the task in preload mode. Defaults to `true` so the
     * first `sendMessage()` triggers the first turn via the preload path.
     * Set to `false` to skip preload — the first `sendMessage()` starts turn 0 directly.
     *
     * Ignored when `mode: "handover-prepare"` is set.
     */
    preload?: boolean;
    /**
     * Initial trigger the agent boots with. Defaults to `"preload"` (or
     * `"submit-message"` when `preload: false`, or `"continuation"` when
     * `continuation: true`).
     *
     * - `"preload"` — fresh chat preloaded via `transport.preload`. Fires
     *   `onPreload`, waits for the first message.
     * - `"submit-message"` — fresh chat with the first message in the boot
     *   payload (the `chat.createStartSessionAction({ basePayload: { message } })`
     *   pattern). Goes straight to turn 0.
     * - `"continuation"` — new run picking up an existing session after the
     *   prior run ended (`chat.endRun`, waitpoint timeout, `chat.requestUpgrade`).
     *   Boots with `trigger` omitted and `continuation: true` — mirrors what
     *   the server's `ensureRunForSession` / `swapSessionRun` produces in
     *   production. The SDK enters its continuation-wait branch; `onPreload`
     *   and `onChatStart` do NOT fire on this run.
     * - `"handover-prepare"` — drives the chat.handover wait branch; call
     *   `sendHandover()` / `sendHandoverSkip()` to dispatch the handover signal.
     */
    mode?: "preload" | "submit-message" | "handover-prepare" | "continuation";
    /**
     * First-turn UIMessage history shipped on the BOOT payload. Only
     * meaningful with `mode: "handover-prepare"` — mirrors the
     * `chat.headStart` route handler's `basePayload.headStartMessages`.
     */
    headStartMessages?: UIMessage[];
    /**
     * Pre-seed the snapshot the agent reads at run boot. The runtime's
     * snapshot read is replaced with one that returns this snapshot
     * (skipping the real S3 GET). Use to drive boot scenarios — fresh
     * boot with prior history, OOM-retry boot with stale snapshot, etc.
     * Pass `undefined` (the default) to start with no snapshot.
     *
     * See plan section B.3 for the boot orchestration spec.
     */
    snapshot?: ChatSnapshotV1 | TranscriptSnapshotV2;
    /**
     * Set `payload.continuation = true` on the initial wire payload. Used
     * to simulate a continuation-run boot (a new run picking up after a
     * prior run on the same session ended via `chat.endRun`, waitpoint
     * timeout, or `chat.requestUpgrade`).
     *
     * Setting this without specifying `mode` auto-selects `mode:
     * "continuation"` — the SDK boot path enters its continuation-wait
     * branch and waits silently on `session.in` for the first user
     * message. `onPreload` and `onChatStart` do NOT fire on this run.
     *
     * Defaults to `false` (fresh run).
     */
    continuation?: boolean;
    /**
     * Set `payload.previousRunId` on the initial wire payload. Forwarded
     * to `onChatStart` / `onTurnStart` and used by the boot gate as a
     * prior-state signal. Usually paired with `continuation: true`.
     */
    previousRunId?: string;
    /**
     * Callback that runs **before** the agent's `run()` is invoked, with a
     * `set` function for pre-seeding locals. Use this to inject server-side
     * dependencies (database clients, service stubs) that the agent reads
     * via `locals.get()` in its hooks.
     *
     * @example
     * ```ts
     * import { dbKey } from "./db";
     *
     * const harness = mockChatAgent(agent, {
     *   chatId: "test-1",
     *   setupLocals: (locals) => {
     *     locals.set(dbKey, testDb);
     *   },
     * });
     * ```
     */
    setupLocals?: SetupLocals;
};
/**
 * Result of a single turn, returned by driver methods like `sendMessage()`.
 */
export type MockChatAgentTurn = {
    /** UIMessageChunks emitted during this turn (excludes control chunks like turn-complete). */
    chunks: UIMessageChunk[];
    /** All raw chunks including control chunks (turn-complete, upgrade-required, etc.). */
    rawChunks: unknown[];
};
/**
 * Harness returned by `mockChatAgent`. Drives a `chat.agent` task end-to-end
 * without network or task runtime.
 */
export type MockChatAgentHarness = {
    /** The chat session id used by this harness. */
    readonly chatId: string;
    /**
     * Send a single user message (or tool-approval-responded assistant
     * message) and wait for the next turn-complete. Returns the chunks
     * produced during this turn.
     *
     * Slim wire: at most ONE message per send. The agent reconstructs prior
     * history from snapshot + session.out replay at run boot.
     */
    sendMessage(message: UIMessage): Promise<MockChatAgentTurn>;
    /**
     * Send a regenerate signal (no message body — slim wire). The agent
     * trims trailing assistant messages from its in-memory accumulator and
     * re-runs. Waits for turn-complete.
     */
    sendRegenerate(): Promise<MockChatAgentTurn>;
    /**
     * Drive the head-start path: sends `trigger: "handover-prepare"` with
     * `headStartMessages` carrying the first-turn UIMessage history. Used
     * only at the very first turn before any snapshot exists. The route
     * handler ships full UIMessage history through this path because the
     * customer's HTTP endpoint isn't subject to the `/in/append` cap.
     */
    sendHeadStart(args: {
        messages: UIMessage[];
    }): Promise<MockChatAgentTurn>;
    /** Send a custom action and wait for the next turn-complete. */
    sendAction(action: unknown): Promise<MockChatAgentTurn>;
    /**
     * Deliver a message mid-turn without waiting for it, the way the browser's
     * steering path does. With a `pendingMessages` config the agent routes it into
     * the steering queue for injection at the next step boundary; without one it
     * buffers as the next turn.
     *
     * Send it while a turn is in flight — start the turn without awaiting it, then
     * call this. Awaiting the turn first leaves nothing to steer.
     */
    sendPendingMessage(message: UIMessage): Promise<void>;
    /** Fire a stop signal. Does not wait for the turn — the task keeps running. */
    sendStop(message?: string): Promise<void>;
    /**
     * Dispatch a `handover` signal — the agent picks up partial assistant
     * messages and continues the turn. Only meaningful when the harness
     * was started with `mode: "handover-prepare"`. Waits for turn-complete.
     *
     * `isFinal: false` (default) — agent runs `streamText` which executes
     * any pending tool-calls (via the approval round) and resumes from
     * step 2.
     *
     * `isFinal: true` — agent runs lifecycle hooks but skips `streamText`.
     * The partial IS the response; `onTurnComplete` fires with it.
     */
    sendHandover(args: {
        partialAssistantMessage: unknown[];
        isFinal?: boolean;
        messageId?: string;
    }): Promise<MockChatAgentTurn>;
    /**
     * Dispatch a `handover-skip` signal — the agent exits cleanly without
     * firing turn hooks. Only meaningful when the harness was started
     * with `mode: "handover-prepare"`. Awaits the run finishing.
     */
    sendHandoverSkip(): Promise<void>;
    /**
     * Pre-seed the snapshot read for the next boot. The runtime's snapshot
     * read returns this snapshot (skipping S3). Pass `undefined` to clear —
     * the boot then sees no snapshot and falls through to replay-only.
     *
     * Effective on the next run boot only. Calling mid-turn is a no-op
     * because the snapshot read happens once at run boot.
     */
    seedSnapshot(snapshot: ChatSnapshotV1 | TranscriptSnapshotV2 | undefined): void;
    /**
     * Pre-seed `session.out` chunks for the next boot's replay. The runtime's
     * `replaySessionOutTail` returns whatever the synthetic chunks reduce
     * to. Pass `[]` to clear (boot replay returns no messages).
     *
     * Requires `__setReplaySessionOutTailImplForTests` exported from
     * `ai.ts`. The harness throws a clear error at call time if that hook
     * isn't available.
     */
    seedSessionOutTail(chunks?: UIMessageChunk[]): void;
    /**
     * Pre-seed a trailing partial assistant message for the next boot's
     * replay. The runtime's `replaySessionOutTail` returns this as the
     * `partial` field (alongside whatever `seedSessionOutTail` reduces
     * to). Use to simulate cancel-mid-stream: an assistant message whose
     * `finish` chunk never arrived. Pass `undefined` to clear.
     *
     * Effective on the next run boot only.
     */
    seedSessionOutPartial(partial: UIMessage | undefined): void;
    /**
     * Pre-seed user messages on the `session.in` tail for the next boot's
     * replay. Each message is paired with a synthetic seq_num (`i + 1`).
     * Used to simulate in-flight users the dead predecessor was supposed
     * to process. Pass `[]` to clear.
     *
     * Effective on the next run boot only.
     */
    seedSessionInTail(messages: UIMessage[]): void;
    /**
     * Append a `trigger: "close"` record to `session.in` — what the server does
     * when a session is closed from outside (dashboard, `sessions.close()`, MCP).
     * Resolves once the run has exited, so a test can assert the agent left its
     * loop instead of waiting out the idle timeout.
     */
    sendClose(): Promise<void>;
    /** Wait for the agent's run to exit (bounded, so a stuck loop fails the test). */
    waitForExit(timeoutMs?: number): Promise<void>;
    /**
     * Every `sessions.close()` the agent made during this run, in order. A
     * `chat.close()` produces exactly one entry.
     */
    getCloseCalls(): Array<{
        sessionId: string;
        reason?: string;
    }>;
    /**
     * Make the next `count` `sessions.close()` calls throw, to exercise the
     * retry path. The calls are still recorded by {@link getCloseCalls}.
     */
    failNextCloseCalls(count: number): void;
    /**
     * Deliver a user message on the live `session.in` tail at an explicit
     * seq_num, without waiting for a turn.
     *
     * `seedSessionInTail` only feeds the boot replay, so the two ways a record
     * reaches a run — the boot's own read and the tail re-reading the same
     * sequence — never coexist. Pairing them is what reproduces a record being
     * answered twice, so a seq_num already handed to `seedSessionInTail`
     * (`i + 1`) is the interesting argument.
     */
    deliverSessionInAtSeq(message: UIMessage, seqNum: number): Promise<void>;
    /**
     * The most recently written snapshot, or `undefined` if no snapshot
     * has been written yet. Updated each time `writeChatSnapshot` is
     * invoked from the run loop's snapshot-write site (plan section B.6).
     */
    getSnapshot(): TranscriptSnapshotV2 | undefined;
    /**
     * Close the chat session cleanly. Sends `trigger: "close"` and awaits the
     * task's `run()` function returning. Call this at the end of every test
     * (or use `await using`) so the background task isn't left dangling.
     */
    close(): Promise<void>;
    /** All UIMessageChunks emitted since the harness was created. */
    readonly allChunks: UIMessageChunk[];
    /** Every raw chunk (including control chunks) emitted since the harness was created. */
    readonly allRawChunks: unknown[];
};
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
export declare function mockChatAgent(agent: ChatAgentHandle, options?: MockChatAgentOptions): MockChatAgentHarness;
export {};
