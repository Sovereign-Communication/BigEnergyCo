"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestRuntimeManager = exports.SessionWaitpointBackend = void 0;
exports.installSessionWaitpointBackend = installSessionWaitpointBackend;
const index_js_1 = require("../apiClient/index.js");
const friendlyId_js_1 = require("../isomorphic/friendlyId.js");
const noopRuntimeManager_js_1 = require("../runtime/noopRuntimeManager.js");
const TIMED_OUT = Symbol("session-waitpoint-timeout");
function parseTimeoutMs(timeout) {
    if (!timeout) {
        return undefined;
    }
    const match = /^(\d+)(ms|s|m|h)$/.exec(timeout.trim());
    if (!match) {
        return undefined;
    }
    const value = Number(match[1]);
    switch (match[2]) {
        case "ms":
            return value;
        case "s":
            return value * 1_000;
        case "m":
            return value * 60_000;
        default:
            return value * 3_600_000;
    }
}
/**
 * In-process stand-in for the run-engine's session-stream waitpoint machinery.
 *
 * `session.in.wait()` suspends a run on a waitpoint; in production the run-engine
 * completes that waitpoint (and the supervisor resumes the run) when the next
 * `.in` record arrives. This backend reproduces the task-observable half in one
 * process: `register()` mints a waitpoint id when the SDK creates the waitpoint,
 * and `wait()` opens its own short-lived tail on the session channel and resolves
 * with the next record. That record is handed back through `TestRuntimeManager`
 * exactly as the real runtime hands back a completed waitpoint's output, so the
 * same `run()` invocation continues in place (the faithful dev / deployed
 * task-observable semantics: same promise, same record, no re-invocation).
 *
 * It deliberately does not model server-side waitpoint bookkeeping, process
 * checkpoint/restore, or client-vs-server timeout, none of which are visible to
 * task code on the resume path.
 */
class SessionWaitpointBackend {
    apiClient;
    pending = new Map();
    disabled = false;
    constructor(apiClient) {
        this.apiClient = apiClient;
    }
    register(body) {
        const waitpointId = friendlyId_js_1.WaitpointId.generate().friendlyId;
        this.pending.set(waitpointId, {
            session: body.session,
            io: body.io,
            lastSeqNum: body.lastSeqNum,
            timeout: body.timeout,
            abort: new AbortController(),
        });
        return { waitpointId, isCached: false };
    }
    async wait(waitpointFriendlyId) {
        if (this.disabled) {
            return {
                ok: false,
                output: JSON.stringify({ message: "Session waitpoint backend disabled" }),
                outputType: "application/json",
            };
        }
        const pending = this.pending.get(waitpointFriendlyId);
        if (!pending) {
            return { ok: true };
        }
        const timeoutMs = parseTimeoutMs(pending.timeout);
        let timer;
        try {
            const recordPromise = this.readNextRecord(pending);
            const result = timeoutMs === undefined
                ? await recordPromise
                : await Promise.race([
                    recordPromise,
                    new Promise((resolve) => {
                        timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
                    }),
                ]);
            if (result === TIMED_OUT) {
                pending.abort.abort();
                return {
                    ok: false,
                    output: JSON.stringify({ message: "Timed out" }),
                    outputType: "application/json",
                };
            }
            // The waitpoint is a wake signal only. Production appends the record to
            // the channel before draining any waitpoint, so the SDK re-attaches and
            // reads it back from the channel with its real sequence. Returning the
            // record here would let a test pass on output the SDK no longer reads.
            void result;
            return { ok: true };
        }
        catch {
            return {
                ok: false,
                output: JSON.stringify({ message: "Session stream wait ended before a record arrived" }),
                outputType: "application/json",
            };
        }
        finally {
            if (timer) {
                clearTimeout(timer);
            }
            this.pending.delete(waitpointFriendlyId);
        }
    }
    disable() {
        this.disabled = true;
        for (const pending of this.pending.values()) {
            pending.abort.abort();
        }
        this.pending.clear();
    }
    /**
     * Opens an independent tail on the session channel starting after the
     * caller's last-seen seq and resolves with the next record. For `.in` the
     * tail yields the raw appended JSON string (already `JSON.stringify(chunk)`),
     * which {@link wait} passes straight to the packet parser so it round-trips
     * to the same object `session.in.once()` returns.
     */
    async readNextRecord(pending) {
        const lastEventId = pending.lastSeqNum !== undefined && pending.lastSeqNum >= 0
            ? String(pending.lastSeqNum)
            : undefined;
        let deliveredSeqNum;
        const stream = await this.apiClient.subscribeToSessionStream(pending.session, pending.io, {
            lastEventId,
            signal: pending.abort.signal,
            timeoutInSeconds: 120,
            onPart: (part) => {
                const seqNum = Number.parseInt(part.id, 10);
                if (Number.isFinite(seqNum)) {
                    deliveredSeqNum = seqNum;
                }
            },
        });
        const reader = stream.getReader();
        try {
            const { value, done } = await reader.read();
            if (done) {
                throw new Error("session stream closed");
            }
            if (deliveredSeqNum === undefined) {
                throw new Error("session stream record is missing its sequence number");
            }
            return { data: value, seqNum: deliveredSeqNum };
        }
        finally {
            await reader.cancel().catch(() => { });
            pending.abort.abort();
        }
    }
}
exports.SessionWaitpointBackend = SessionWaitpointBackend;
/**
 * A {@link NoopRuntimeManager} whose `waitForWaitpoint` resolves in place from a
 * {@link SessionWaitpointBackend} instead of hanging. Install it as the `runtime`
 * global via `runInMockTaskContext({ runtimeManager })`.
 */
class TestRuntimeManager extends noopRuntimeManager_js_1.NoopRuntimeManager {
    backend;
    constructor(backend) {
        super();
        this.backend = backend;
    }
    waitForWaitpoint(params) {
        return this.backend.wait(params.waitpointFriendlyId);
    }
}
exports.TestRuntimeManager = TestRuntimeManager;
let activeBackend;
let patchDepth = 0;
let originalCreate;
let originalWait;
/**
 * Route the two waitpoint apiClient calls through an in-process backend for the
 * duration of a harness run, and hand back a {@link TestRuntimeManager} to
 * install as the `runtime` global.
 *
 * `apiClientManager.clientOrThrow()` builds a fresh `ApiClient` per call, so
 * there is no instance to swap; the two methods are patched on the prototype
 * (ref-counted, restored by `restore()`). `createSessionStreamWaitpoint`
 * registers a pending wait and returns a real-shaped `{ waitpointId, isCached }`;
 * `waitForWaitpointToken` returns `{ success: true }` exactly like the real route,
 * which only creates the block edge and returns synchronously.
 */
function installSessionWaitpointBackend(apiClient) {
    const backend = new SessionWaitpointBackend(apiClient);
    const previousBackend = activeBackend;
    activeBackend = backend;
    if (patchDepth === 0) {
        originalCreate = index_js_1.ApiClient.prototype.createSessionStreamWaitpoint;
        originalWait = index_js_1.ApiClient.prototype.waitForWaitpointToken;
        index_js_1.ApiClient.prototype.createSessionStreamWaitpoint = function (runFriendlyId, body) {
            if (activeBackend) {
                return Promise.resolve(activeBackend.register(body));
            }
            return originalCreate.call(this, runFriendlyId, body);
        };
        index_js_1.ApiClient.prototype.waitForWaitpointToken = function () {
            if (activeBackend) {
                return Promise.resolve({ success: true });
            }
            // eslint-disable-next-line prefer-rest-params
            return originalWait.apply(this, arguments);
        };
    }
    patchDepth += 1;
    let restored = false;
    return {
        backend,
        runtimeManager: new TestRuntimeManager(backend),
        restore() {
            if (restored) {
                return;
            }
            restored = true;
            backend.disable();
            if (activeBackend === backend) {
                activeBackend = previousBackend;
            }
            patchDepth -= 1;
            if (patchDepth === 0 && originalCreate && originalWait) {
                index_js_1.ApiClient.prototype.createSessionStreamWaitpoint = originalCreate;
                index_js_1.ApiClient.prototype.waitForWaitpointToken = originalWait;
                originalCreate = undefined;
                originalWait = undefined;
            }
        },
    };
}
//# sourceMappingURL=session-waitpoint-backend.js.map