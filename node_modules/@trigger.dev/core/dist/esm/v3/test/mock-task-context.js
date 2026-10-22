import { inputStreams } from "../input-streams-api.js";
import { realtimeStreams } from "../realtime-streams-api.js";
import { sessionStreams } from "../session-streams-api.js";
import { localsAPI } from "../locals-api.js";
import { runMetadata } from "../run-metadata-api.js";
import { taskContext } from "../task-context-api.js";
import { lifecycleHooks } from "../lifecycle-hooks-api.js";
import { runtime } from "../runtime-api.js";
import { StandardLocalsManager } from "../locals/manager.js";
import { StandardLifecycleHooksManager } from "../lifecycleHooks/manager.js";
import { NoopRuntimeManager } from "../runtime/noopRuntimeManager.js";
import { unregisterGlobal } from "../utils/globals.js";
import { TestInputStreamManager } from "./test-input-stream-manager.js";
import { TestRealtimeStreamsManager } from "./test-realtime-streams-manager.js";
import { TestRunMetadataManager } from "./test-run-metadata-manager.js";
import { TestSessionStreamManager } from "./test-session-stream-manager.js";
function defaultTaskRunContext(overrides) {
    return {
        task: {
            id: "test-task",
            filePath: "test-task.ts",
            ...overrides?.task,
        },
        attempt: {
            number: 1,
            startedAt: new Date(),
            ...overrides?.attempt,
        },
        run: {
            id: "run_test",
            tags: [],
            isTest: false,
            isReplay: false,
            createdAt: new Date(),
            startedAt: new Date(),
            ...overrides?.run,
        },
        machine: {
            name: "micro",
            cpu: 1,
            memory: 0.5,
            centsPerMs: 0,
            ...overrides?.machine,
        },
        queue: {
            name: "test-queue",
            id: "test-queue-id",
            ...overrides?.queue,
        },
        environment: {
            id: "test-env-id",
            slug: "test-env",
            type: "DEVELOPMENT",
            ...overrides?.environment,
        },
        organization: {
            id: "test-org-id",
            slug: "test-org",
            name: "Test Org",
            ...overrides?.organization,
        },
        project: {
            id: "test-project-id",
            ref: "test-project-ref",
            slug: "test-project",
            name: "Test Project",
            ...overrides?.project,
        },
        batch: overrides?.batch,
    };
}
function defaultWorker(overrides) {
    return {
        id: "test-worker-id",
        version: "test-version",
        contentHash: "test-content-hash",
        engine: "V2",
        ...overrides,
    };
}
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
export async function runInMockTaskContext(fn, options) {
    const ctx = defaultTaskRunContext(options?.ctx);
    const worker = defaultWorker(options?.worker);
    const localsManager = new StandardLocalsManager();
    const lifecycleManager = new StandardLifecycleHooksManager();
    const runtimeManager = options?.runtimeManager ?? new NoopRuntimeManager();
    const metadataManager = new TestRunMetadataManager();
    const inputManager = new TestInputStreamManager();
    const outputManager = new TestRealtimeStreamsManager();
    const sessionStreamManager = options?.sessionStreamManager ?? new TestSessionStreamManager();
    // Unregister any previously-installed managers so `setGlobal*` wins —
    // `registerGlobal` returns false silently if an entry already exists.
    unregisterGlobal("locals");
    unregisterGlobal("lifecycle-hooks");
    unregisterGlobal("runtime");
    unregisterGlobal("run-metadata");
    unregisterGlobal("input-streams");
    unregisterGlobal("realtime-streams");
    unregisterGlobal("session-streams");
    unregisterGlobal("task-context");
    localsAPI.setGlobalLocalsManager(localsManager);
    lifecycleHooks.setGlobalLifecycleHooksManager(lifecycleManager);
    runtime.setGlobalRuntimeManager(runtimeManager);
    runMetadata.setGlobalManager(metadataManager);
    inputStreams.setGlobalManager(inputManager);
    realtimeStreams.setGlobalManager(outputManager);
    sessionStreams.setGlobalManager(sessionStreamManager);
    taskContext.setGlobalTaskContext({
        ctx,
        worker,
        isWarmStart: options?.isWarmStart ?? false,
    });
    const drivers = {
        inputs: {
            send: (streamId, data) => inputManager.__sendFromTest(streamId, data),
            close: (streamId) => inputManager.__closeFromTest(streamId),
        },
        outputs: {
            chunks: (streamId) => outputManager.__chunksFromTest(streamId),
            all: () => outputManager.__allChunksFromTest(),
            clear: (streamId) => outputManager.__clearFromTest(streamId),
            onWrite: (listener) => outputManager.onWrite(listener),
        },
        locals: {
            get: (key) => localsManager.getLocal(key),
            set: (key, value) => localsManager.setLocal(key, value),
        },
        sessions: {
            in: {
                send: (sessionId, data, io = "in", metadata) => sessionStreamManager instanceof TestSessionStreamManager
                    ? sessionStreamManager.__sendFromTest(sessionId, io, data, metadata)
                    : Promise.reject(new Error("drivers.sessions.in.send requires the default TestSessionStreamManager")),
                close: (sessionId, io = "in") => {
                    if (sessionStreamManager instanceof TestSessionStreamManager) {
                        sessionStreamManager.__closeFromTest(sessionId, io);
                    }
                },
            },
        },
        ctx,
    };
    try {
        return await fn(drivers);
    }
    finally {
        localsAPI.disable();
        lifecycleHooks.disable();
        runtime.disable();
        // taskContext.disable() only sets a flag — unregister the global so
        // `taskContext.ctx` returns undefined after the harness returns.
        unregisterGlobal("task-context");
        unregisterGlobal("input-streams");
        unregisterGlobal("realtime-streams");
        unregisterGlobal("session-streams");
        unregisterGlobal("run-metadata");
        localsManager.reset();
        inputManager.reset();
        outputManager.reset();
        if (sessionStreamManager instanceof TestSessionStreamManager) {
            sessionStreamManager.reset();
        }
        metadataManager.reset();
    }
}
//# sourceMappingURL=mock-task-context.js.map