import type { RuntimeManager } from "../runtime/manager.js";
import type { ServerBackgroundWorker, TaskRunContext } from "../schemas/index.js";
import type { LocalsKey } from "../locals/types.js";
import type { SessionChannelIO, SessionStreamManager } from "../sessionStreams/types.js";
/**
 * Shallow-partial overrides applied on top of the default mock
 * `TaskRunContext`. Each sub-object is a partial of its real shape —
 * unset fields get sensible defaults.
 */
type MockTaskRunContextOverrides = {
    task?: Partial<TaskRunContext["task"]>;
    attempt?: Partial<TaskRunContext["attempt"]>;
    run?: Partial<TaskRunContext["run"]>;
    machine?: Partial<TaskRunContext["machine"]>;
    queue?: Partial<TaskRunContext["queue"]>;
    environment?: Partial<TaskRunContext["environment"]>;
    organization?: Partial<TaskRunContext["organization"]>;
    project?: Partial<TaskRunContext["project"]>;
    batch?: TaskRunContext["batch"];
};
/**
 * Options for overriding parts of the mock task context.
 */
export type MockTaskContextOptions = {
    /** Overrides applied on top of the default mock `TaskRunContext`. */
    ctx?: MockTaskRunContextOverrides;
    /** Overrides applied on top of the default `ServerBackgroundWorker`. */
    worker?: Partial<ServerBackgroundWorker>;
    /** Whether this is a warm start. */
    isWarmStart?: boolean;
    /**
     * Session-streams manager installed as the `session-streams` global. Defaults
     * to an in-memory {@link TestSessionStreamManager}. Pass a real
     * `StandardSessionStreamManager` (with an ApiClient pointed at a running
     * webapp) to drive the task's `.in`/`.out` against real streams.
     */
    sessionStreamManager?: SessionStreamManager;
    /**
     * Runtime manager installed as the `runtime` global. Defaults to a
     * {@link NoopRuntimeManager}. Pass a `TestRuntimeManager` (wired to a
     * {@link SessionWaitpointBackend}) to make `session.in.wait()` suspend and
     * resume in place against real streams, without the run-engine.
     */
    runtimeManager?: RuntimeManager;
};
/**
 * Drivers passed to the function running inside `runInMockTaskContext`.
 */
export type MockTaskContextDrivers = {
    /** Push data into input streams — simulates realtime input from outside the task. */
    inputs: {
        /**
         * Send `data` to the named input stream. Resolves when all `.on()`
         * handlers have run.
         */
        send(streamId: string, data: unknown): Promise<void>;
        /** Resolve any pending `.once()` waiters with a timeout error. */
        close(streamId: string): void;
    };
    /** Inspect chunks written to output (realtime) streams. */
    outputs: {
        /** All chunks for a given stream, in the order they were written. */
        chunks<T = unknown>(streamId: string): T[];
        /** All chunks across every stream, keyed by stream id. */
        all(): Record<string, unknown[]>;
        /** Clear chunks for one stream, or all streams if no id is provided. */
        clear(streamId?: string): void;
        /**
         * Register a listener fired for every chunk written to any stream.
         * Returns an unsubscribe function.
         */
        onWrite(listener: (streamId: string, chunk: unknown) => void): () => void;
    };
    /** Read or seed locals for the run. */
    locals: {
        /** Read a local set by either the task or `set()` below. */
        get<T>(key: LocalsKey<T>): T | undefined;
        /**
         * Pre-seed a local before the task runs. Use this for dependency
         * injection — e.g. supply a test database client that the agent's
         * hooks read via `locals.get()` instead of constructing the prod one.
         */
        set<T>(key: LocalsKey<T>, value: T): void;
    };
    /**
     * Session-scoped channel drivers. The `.in` side is backed by a
     * {@link TestSessionStreamManager} installed as the `sessionStreams`
     * global — so the task's `session.in.on/once/peek/waitWithIdleTimeout`
     * calls receive records sent through this driver.
     */
    sessions: {
        in: {
            /**
             * Send a record onto `session.in` for the given session. Resolves
             * pending `once()` waiters and fires all `on()` handlers.
             */
            send(sessionId: string, data: unknown, io?: SessionChannelIO, metadata?: {
                id?: string;
                seqNum?: number;
            }): Promise<void>;
            /** Close pending `once()` waiters with a timeout error. */
            close(sessionId: string, io?: SessionChannelIO): void;
        };
    };
    /** The mock `TaskRunContext` assembled from defaults + user overrides. */
    ctx: TaskRunContext;
};
/**
 * Run a function inside a fully mocked task runtime context.
 *
 * Installs in-memory test managers for `locals`, `inputStreams`,
 * `realtimeStreams`, `lifecycleHooks`, and `runtime`, sets a mock
 * `TaskContext`, and tears everything down when the function returns.
 *
 * Inside the function, any code that reads from `locals`, `inputStreams`,
 * `realtimeStreams`, or `taskContext.ctx` will see the mock context —
 * so you can directly invoke the internal `run` function of any task
 * (including `chat.agent`) without hitting the Trigger.dev runtime.
 *
 * @example
 * ```ts
 * import { runInMockTaskContext } from "@trigger.dev/core/v3/test";
 *
 * await runInMockTaskContext(
 *   async ({ inputs, outputs, ctx }) => {
 *     // Fire an input stream from the "outside"
 *     setTimeout(() => {
 *       inputs.send("chat-messages", { messages: [], chatId: "c1" });
 *     }, 0);
 *
 *     // Run task code that reads from inputStreams.once(...)
 *     await myTask.fns.run(payload, { ctx, signal: new AbortController().signal });
 *
 *     // Inspect chunks written to the output stream
 *     expect(outputs.chunks("chat")).toContainEqual({ type: "text-delta", delta: "hi" });
 *   },
 *   { ctx: { run: { id: "run_abc" } } }
 * );
 * ```
 */
export declare function runInMockTaskContext<T>(fn: (drivers: MockTaskContextDrivers) => T | Promise<T>, options?: MockTaskContextOptions): Promise<T>;
export {};
