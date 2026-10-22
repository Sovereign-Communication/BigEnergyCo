import { ensureReadableStream } from "@trigger.dev/core/v3";
import { SessionHandle, SessionInputChannel, SessionOutputChannel } from "../sessions.js";
/**
 * Stub for `SessionInputChannel.wait` that skips the apiClient round-trip
 * the production path makes via `createSessionStreamWaitpoint`. Without
 * this override, every test that exercises the suspend fallback (e.g.
 * the `chat.handover` idle-timeout case) throws `ApiClientMissingError`
 * because `apiClientManager.clientOrThrow()` runs in a test process that
 * has no `TRIGGER_SECRET_KEY`.
 *
 * The promise resolves with `{ ok: false, error }` when the harness
 * aborts its run signal — that mimics production semantics (suspended
 * until something happens, returns cleanly on abort) without making a
 * network call.
 */
class TestSessionInputChannel extends SessionInputChannel {
    getAbortSignal;
    constructor(sessionId, getAbortSignal) {
        super(sessionId);
        this.getAbortSignal = getAbortSignal;
    }
    /**
     * Override the one step that talks to the network. Everything built on top
     * of it (`wait`, and the chat facades' route waits) then runs its real
     * implementation against the in-memory stream manager, so the harness stubs
     * a boundary instead of reimplementing a composite.
     */
    async awaitWake() {
        const signal = this.getAbortSignal();
        if (!signal) {
            return new Promise(() => { });
        }
        if (signal.aborted) {
            return { ok: false, error: new Error("session.in.wait() aborted by test harness") };
        }
        return new Promise((resolve) => {
            signal.addEventListener("abort", () => resolve({ ok: false, error: new Error("session.in.wait() aborted by test harness") }), { once: true });
        });
    }
}
function notify(state, chunk) {
    state.chunks.push(chunk);
    for (const listener of state.listeners) {
        try {
            listener(chunk);
        }
        catch {
            // Never let a listener error break stream writes
        }
    }
}
async function drainInto(source, state) {
    const readable = ensureReadableStream(source);
    const reader = readable.getReader();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                return;
            notify(state, value);
        }
    }
    finally {
        try {
            reader.releaseLock();
        }
        catch {
            // ignore
        }
    }
}
/**
 * `.out` channel that captures writes in memory instead of piping to S2.
 * Mirrors {@link SessionOutputChannel}'s public shape — `pipe` / `writer`
 * / `append` / `read` — so the agent's existing code paths work unchanged.
 */
class TestSessionOutputChannel extends SessionOutputChannel {
    state;
    constructor(sessionId, state) {
        super(sessionId);
        this.state = state;
    }
    async append(value, _options) {
        notify(this.state, value);
    }
    pipe(value, _options) {
        const state = this.state;
        const readChunks = [];
        let pipeError;
        let resolveDone;
        const done = new Promise((resolve) => {
            resolveDone = resolve;
        });
        (async () => {
            let reader;
            try {
                const readable = ensureReadableStream(value);
                reader = readable.getReader();
                while (true) {
                    const { done: d, value: v } = await reader.read();
                    if (d)
                        break;
                    readChunks.push(v);
                    notify(state, v);
                }
            }
            catch (err) {
                // Mirror production: a source-stream error (or a throw from stream
                // setup) rejects waitUntilComplete instead of being silently
                // swallowed, so callers (e.g. chat.pipeAndCapture) can observe it.
                pipeError = err;
            }
            finally {
                try {
                    reader?.releaseLock();
                }
                catch {
                    // ignore
                }
                resolveDone();
            }
        })();
        const replayStream = new ReadableStream({
            async start(controller) {
                await done;
                for (const chunk of readChunks)
                    controller.enqueue(chunk);
                controller.close();
            },
        });
        const emptyResult = {};
        return {
            get stream() {
                return replayStream;
            },
            waitUntilComplete: async () => {
                await done;
                if (pipeError)
                    throw pipeError;
                return emptyResult;
            },
        };
    }
    writer(options) {
        let controller;
        const ongoing = [];
        const state = this.state;
        const stream = new ReadableStream({
            start(c) {
                controller = c;
            },
        });
        const safeEnqueue = (data) => {
            try {
                controller.enqueue(data);
            }
            catch {
                // Stream already closed
            }
        };
        try {
            const result = options.execute({
                write(part) {
                    safeEnqueue(part);
                    notify(state, part);
                },
                merge(streamArg) {
                    ongoing.push(drainInto(streamArg, state).catch(() => { }));
                },
            });
            if (result) {
                ongoing.push(result.catch(() => { }));
            }
        }
        catch {
            // Swallow — tests can inspect state.chunks
        }
        const done = (async () => {
            while (ongoing.length > 0) {
                await ongoing.shift();
            }
        })().finally(() => {
            try {
                controller.close();
            }
            catch {
                // Already closed
            }
        });
        const emptyResult = {};
        return {
            get stream() {
                return stream;
            },
            waitUntilComplete: async () => {
                await done;
                return emptyResult;
            },
        };
    }
    async read(_options) {
        throw new Error("TestSessionOutputChannel.read() is not supported in the mock-chat-agent harness — " +
            "inspect `harness.allChunks` / `harness.allRawChunks` instead.");
    }
    /**
     * Override the one-shot control-record path. In production this goes
     * direct to S2 with header-form records; in tests we project it back
     * into the chunk-shape the harness already understands (the listener
     * watches for `{type: "trigger:turn-complete"}` to drive turn-complete
     * latches). Returns an empty `StreamWriteResult` — tests don't observe
     * the seq_num, and trim seeding only matters in production.
     */
    async writeControl(subtype, extraHeaders) {
        const synthetic = { type: `trigger:${subtype}` };
        if (extraHeaders) {
            for (const [name, value] of extraHeaders) {
                if (name === "public-access-token") {
                    synthetic.publicAccessToken = value;
                }
                else if (name === "session-in-event-id") {
                    synthetic.sessionInEventId = value;
                }
                else if (name === "session-in-consumed-id") {
                    synthetic.sessionInConsumedId = value;
                }
                else if (name === "session-closed") {
                    synthetic.sessionClosed = value === "true";
                }
                else if (name === "session-closed-reason") {
                    synthetic.reason = value;
                }
            }
        }
        notify(this.state, synthetic);
        // Project a synthetic monotonic seq_num as the ack's `lastEventId`,
        // mirroring what S2 returns in production (there it's the control
        // record's seq_num). Using the running `.out` record count lets
        // `chat.writeTurnComplete()` surface a real resume cursor in tests.
        return { lastEventId: String(this.state.chunks.length) };
    }
    /**
     * No-op in the mock harness. Production trims keep `session.out` bounded;
     * the in-memory `state.chunks` array doesn't need trimming and tests
     * that care about trim behaviour exercise it via the real S2 code path.
     */
    async trimTo(_earliestSeqNum) {
        // Intentionally a no-op for the mock harness.
    }
}
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
export function createTestSessionHandle(sessionId, state, getAbortSignal = () => undefined) {
    return new SessionHandle(sessionId, {
        in: new TestSessionInputChannel(sessionId, getAbortSignal),
        out: new TestSessionOutputChannel(sessionId, state),
    });
}
//# sourceMappingURL=test-session-handle.js.map