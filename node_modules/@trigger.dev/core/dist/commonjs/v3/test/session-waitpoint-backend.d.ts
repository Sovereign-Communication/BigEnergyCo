import { ApiClient } from "../apiClient/index.js";
import { NoopRuntimeManager } from "../runtime/noopRuntimeManager.js";
import type { CreateSessionStreamWaitpointRequestBody, CreateSessionStreamWaitpointResponseBody } from "../schemas/api.js";
import type { WaitpointTokenResult } from "../schemas/common.js";
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
export declare class SessionWaitpointBackend {
    private readonly apiClient;
    private readonly pending;
    private disabled;
    constructor(apiClient: ApiClient);
    register(body: CreateSessionStreamWaitpointRequestBody): CreateSessionStreamWaitpointResponseBody;
    wait(waitpointFriendlyId: string): Promise<WaitpointTokenResult>;
    disable(): void;
    /**
     * Opens an independent tail on the session channel starting after the
     * caller's last-seen seq and resolves with the next record. For `.in` the
     * tail yields the raw appended JSON string (already `JSON.stringify(chunk)`),
     * which {@link wait} passes straight to the packet parser so it round-trips
     * to the same object `session.in.once()` returns.
     */
    private readNextRecord;
}
/**
 * A {@link NoopRuntimeManager} whose `waitForWaitpoint` resolves in place from a
 * {@link SessionWaitpointBackend} instead of hanging. Install it as the `runtime`
 * global via `runInMockTaskContext({ runtimeManager })`.
 */
export declare class TestRuntimeManager extends NoopRuntimeManager {
    private readonly backend;
    constructor(backend: SessionWaitpointBackend);
    waitForWaitpoint(params: {
        waitpointFriendlyId: string;
        finishDate?: Date;
    }): Promise<WaitpointTokenResult>;
}
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
export declare function installSessionWaitpointBackend(apiClient: ApiClient): {
    backend: SessionWaitpointBackend;
    runtimeManager: TestRuntimeManager;
    restore: () => void;
};
