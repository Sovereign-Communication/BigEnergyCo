"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerToExecutorMessageCatalog = exports.ExecutorToWorkerMessageCatalog = exports.indexerToWorkerMessages = exports.TaskMetadataFailedToParseData = exports.UncaughtExceptionMessage = exports.ServerBackgroundWorker = void 0;
const v4_1 = require("zod/v4");
const build_js_1 = require("./build.js");
const common_js_1 = require("./common.js");
const schemas_js_1 = require("./schemas.js");
const runEngine_js_1 = require("./runEngine.js");
const schemas_js_2 = require("../runEngineWorker/supervisor/schemas.js");
exports.ServerBackgroundWorker = v4_1.z.object({
    id: v4_1.z.string(),
    version: v4_1.z.string(),
    contentHash: v4_1.z.string(),
    engine: schemas_js_1.RunEngineVersionSchema.optional(),
});
exports.UncaughtExceptionMessage = v4_1.z.object({
    version: v4_1.z.literal("v1").default("v1"),
    error: v4_1.z.object({
        name: v4_1.z.string(),
        message: v4_1.z.string(),
        stack: v4_1.z.string().optional(),
    }),
    origin: v4_1.z.enum(["uncaughtException", "unhandledRejection"]),
});
exports.TaskMetadataFailedToParseData = v4_1.z.object({
    version: v4_1.z.literal("v1").default("v1"),
    tasks: v4_1.z.unknown(),
    zodIssues: v4_1.z.custom((v) => {
        return Array.isArray(v) && v.every((issue) => typeof issue === "object" && "message" in issue);
    }),
});
exports.indexerToWorkerMessages = {
    INDEX_COMPLETE: v4_1.z.object({
        version: v4_1.z.literal("v1").default("v1"),
        manifest: build_js_1.WorkerManifest,
        importErrors: build_js_1.ImportTaskFileErrors,
    }),
    TASKS_FAILED_TO_PARSE: exports.TaskMetadataFailedToParseData,
    TASKS_FAILED_TO_INDEX: v4_1.z.object({
        version: v4_1.z.literal("v1").default("v1"),
        collisions: v4_1.z.array(v4_1.z.object({ id: v4_1.z.string(), filePaths: v4_1.z.array(v4_1.z.string()) })),
    }),
    UNCAUGHT_EXCEPTION: exports.UncaughtExceptionMessage,
};
exports.ExecutorToWorkerMessageCatalog = {
    TASK_RUN_COMPLETED: {
        message: v4_1.z.object({
            version: v4_1.z.literal("v1").default("v1"),
            execution: common_js_1.TaskRunExecution,
            result: common_js_1.TaskRunExecutionResult,
        }),
    },
    TASK_HEARTBEAT: {
        message: v4_1.z.object({
            version: v4_1.z.literal("v1").default("v1"),
            id: v4_1.z.string(),
        }),
    },
    UNCAUGHT_EXCEPTION: {
        message: exports.UncaughtExceptionMessage,
    },
    SEND_DEBUG_LOG: {
        message: v4_1.z.object({
            version: v4_1.z.literal("v1").default("v1"),
            message: v4_1.z.string(),
            properties: schemas_js_2.DebugLogPropertiesInput.optional(),
        }),
    },
    SET_SUSPENDABLE: {
        message: v4_1.z.object({
            version: v4_1.z.literal("v1").default("v1"),
            suspendable: v4_1.z.boolean(),
        }),
    },
    MAX_DURATION_EXCEEDED: {
        message: v4_1.z.object({
            version: v4_1.z.literal("v1").default("v1"),
            maxDurationInSeconds: v4_1.z.number(),
            elapsedTimeInSeconds: v4_1.z.number(),
        }),
    },
};
exports.WorkerToExecutorMessageCatalog = {
    EXECUTE_TASK_RUN: {
        message: v4_1.z.object({
            version: v4_1.z.literal("v1").default("v1"),
            execution: common_js_1.TaskRunExecution,
            traceContext: v4_1.z.record(v4_1.z.string(), v4_1.z.unknown()),
            metadata: exports.ServerBackgroundWorker,
            metrics: schemas_js_1.TaskRunExecutionMetrics.optional(),
            env: v4_1.z.record(v4_1.z.string(), v4_1.z.string()).optional(),
            isWarmStart: v4_1.z.boolean().optional(),
        }),
    },
    FLUSH: {
        message: v4_1.z.object({
            timeoutInMs: v4_1.z.number(),
            disableContext: v4_1.z.boolean().optional(),
        }),
        callback: v4_1.z.void(),
    },
    CANCEL: {
        message: v4_1.z.object({
            timeoutInMs: v4_1.z.number(),
        }),
        callback: v4_1.z.void(),
    },
    RESOLVE_WAITPOINT: {
        message: v4_1.z.object({
            version: v4_1.z.literal("v1").default("v1"),
            waitpoint: runEngine_js_1.CompletedWaitpoint,
        }),
    },
};
//# sourceMappingURL=messages.js.map