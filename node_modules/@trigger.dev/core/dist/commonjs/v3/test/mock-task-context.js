"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runInMockTaskContext = runInMockTaskContext;
const input_streams_api_js_1 = require("../input-streams-api.js");
const realtime_streams_api_js_1 = require("../realtime-streams-api.js");
const session_streams_api_js_1 = require("../session-streams-api.js");
const locals_api_js_1 = require("../locals-api.js");
const run_metadata_api_js_1 = require("../run-metadata-api.js");
const task_context_api_js_1 = require("../task-context-api.js");
const lifecycle_hooks_api_js_1 = require("../lifecycle-hooks-api.js");
const runtime_api_js_1 = require("../runtime-api.js");
const manager_js_1 = require("../locals/manager.js");
const manager_js_2 = require("../lifecycleHooks/manager.js");
const noopRuntimeManager_js_1 = require("../runtime/noopRuntimeManager.js");
const globals_js_1 = require("../utils/globals.js");
const test_input_stream_manager_js_1 = require("./test-input-stream-manager.js");
const test_realtime_streams_manager_js_1 = require("./test-realtime-streams-manager.js");
const test_run_metadata_manager_js_1 = require("./test-run-metadata-manager.js");
const test_session_stream_manager_js_1 = require("./test-session-stream-manager.js");
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
async function runInMockTaskContext(fn, options) {
    const ctx = defaultTaskRunContext(options?.ctx);
    const worker = defaultWorker(options?.worker);
    const localsManager = new manager_js_1.StandardLocalsManager();
    const lifecycleManager = new manager_js_2.StandardLifecycleHooksManager();
    const runtimeManager = options?.runtimeManager ?? new noopRuntimeManager_js_1.NoopRuntimeManager();
    const metadataManager = new test_run_metadata_manager_js_1.TestRunMetadataManager();
    const inputManager = new test_input_stream_manager_js_1.TestInputStreamManager();
    const outputManager = new test_realtime_streams_manager_js_1.TestRealtimeStreamsManager();
    const sessionStreamManager = options?.sessionStreamManager ?? new test_session_stream_manager_js_1.TestSessionStreamManager();
    // Unregister any previously-installed managers so `setGlobal*` wins —
    // `registerGlobal` returns false silently if an entry already exists.
    (0, globals_js_1.unregisterGlobal)("locals");
    (0, globals_js_1.unregisterGlobal)("lifecycle-hooks");
    (0, globals_js_1.unregisterGlobal)("runtime");
    (0, globals_js_1.unregisterGlobal)("run-metadata");
    (0, globals_js_1.unregisterGlobal)("input-streams");
    (0, globals_js_1.unregisterGlobal)("realtime-streams");
    (0, globals_js_1.unregisterGlobal)("session-streams");
    (0, globals_js_1.unregisterGlobal)("task-context");
    locals_api_js_1.localsAPI.setGlobalLocalsManager(localsManager);
    lifecycle_hooks_api_js_1.lifecycleHooks.setGlobalLifecycleHooksManager(lifecycleManager);
    runtime_api_js_1.runtime.setGlobalRuntimeManager(runtimeManager);
    run_metadata_api_js_1.runMetadata.setGlobalManager(metadataManager);
    input_streams_api_js_1.inputStreams.setGlobalManager(inputManager);
    realtime_streams_api_js_1.realtimeStreams.setGlobalManager(outputManager);
    session_streams_api_js_1.sessionStreams.setGlobalManager(sessionStreamManager);
    task_context_api_js_1.taskContext.setGlobalTaskContext({
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
                send: (sessionId, data, io = "in", metadata) => sessionStreamManager instanceof test_session_stream_manager_js_1.TestSessionStreamManager
                    ? sessionStreamManager.__sendFromTest(sessionId, io, data, metadata)
                    : Promise.reject(new Error("drivers.sessions.in.send requires the default TestSessionStreamManager")),
                close: (sessionId, io = "in") => {
                    if (sessionStreamManager instanceof test_session_stream_manager_js_1.TestSessionStreamManager) {
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
        locals_api_js_1.localsAPI.disable();
        lifecycle_hooks_api_js_1.lifecycleHooks.disable();
        runtime_api_js_1.runtime.disable();
        // taskContext.disable() only sets a flag — unregister the global so
        // `taskContext.ctx` returns undefined after the harness returns.
        (0, globals_js_1.unregisterGlobal)("task-context");
        (0, globals_js_1.unregisterGlobal)("input-streams");
        (0, globals_js_1.unregisterGlobal)("realtime-streams");
        (0, globals_js_1.unregisterGlobal)("session-streams");
        (0, globals_js_1.unregisterGlobal)("run-metadata");
        localsManager.reset();
        inputManager.reset();
        outputManager.reset();
        if (sessionStreamManager instanceof test_session_stream_manager_js_1.TestSessionStreamManager) {
            sessionStreamManager.reset();
        }
        metadataManager.reset();
    }
}
//# sourceMappingURL=mock-task-context.js.map