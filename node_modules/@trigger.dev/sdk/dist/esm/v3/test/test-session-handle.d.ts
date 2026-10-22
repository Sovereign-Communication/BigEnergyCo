import { SessionHandle } from "../sessions.js";
/**
 * Per-session in-memory state collected from `.out` writes during a test.
 * Owned by the mock-chat-agent harness; updated by {@link TestSessionOutputChannel}.
 */
export type TestSessionOutState = {
    /** Every chunk written to `.out`, in order of write. */
    chunks: unknown[];
    /** Registered write listeners (fired for each chunk). */
    listeners: Set<(chunk: unknown) => void>;
};
/**
 * Construct a {@link SessionHandle} whose `.out` channel captures writes in
 * memory and whose `.in` channel routes through the `sessionStreams`
 * global for record subscriptions (`on` / `once` / `peek`) but stubs
 * `wait()` to skip the apiClient round-trip — see
 * {@link TestSessionInputChannel}.
 *
 * `getAbortSignal` lets the channel observe the harness's run signal so
 * `wait()` resolves cleanly on close. Pass a getter (not the signal
 * directly) so the channel reads it lazily — the harness creates its
 * `AbortController` after the override is installed.
 */
export declare function createTestSessionHandle(sessionId: string, state: TestSessionOutState, getAbortSignal?: () => AbortSignal | undefined): SessionHandle;
