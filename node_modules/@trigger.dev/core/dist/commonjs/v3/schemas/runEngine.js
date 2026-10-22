"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DequeuedMessage = exports.SnapshotRouteWire = exports.PlacementTag = exports.DequeueMessageCheckpoint = exports.MachineResources = exports.CreateCheckpointResult = exports.RunExecutionData = exports.TaskRunCheckpoint = exports.CheckpointInput = exports.CheckpointType = exports.CheckpointTypeEnum = exports.CompleteRunAttemptResult = exports.StartRunAttemptResult = exports.ExecutionResult = exports.CompletedWaitpoint = exports.WaitpointStatus = exports.WaitpointType = exports.TaskRunStatus = exports.TaskRunExecutionStatus = exports.RunAnnotations = exports.TaskKind = exports.TriggerAction = exports.TriggerSource = void 0;
const v4_1 = require("zod/v4");
const zod_js_1 = require("../utils/zod.js");
const common_js_1 = require("./common.js");
const schemas_js_1 = require("./schemas.js");
const snapshotRoute_js_1 = require("./snapshotRoute.js");
Object.defineProperty(exports, "SnapshotRouteWire", { enumerable: true, get: function () { return snapshotRoute_js_1.SnapshotRouteWire; } });
const anyString = v4_1.z.custom((v) => typeof v === "string");
exports.TriggerSource = v4_1.z
    .enum(["sdk", "api", "dashboard", "cli", "mcp", "schedule"])
    .or(anyString);
exports.TriggerAction = v4_1.z.enum(["trigger", "replay", "test"]).or(anyString);
exports.TaskKind = v4_1.z.enum(["STANDARD", "SCHEDULED", "AGENT"]).or(anyString);
exports.RunAnnotations = v4_1.z.object({
    triggerSource: exports.TriggerSource,
    triggerAction: exports.TriggerAction,
    rootTriggerSource: exports.TriggerSource,
    rootScheduleId: v4_1.z.string().optional(),
    taskKind: exports.TaskKind.optional(),
    externalDeploymentId: v4_1.z.string().optional(),
});
exports.TaskRunExecutionStatus = {
    RUN_CREATED: "RUN_CREATED",
    QUEUED: "QUEUED",
    QUEUED_EXECUTING: "QUEUED_EXECUTING",
    PENDING_EXECUTING: "PENDING_EXECUTING",
    EXECUTING: "EXECUTING",
    EXECUTING_WITH_WAITPOINTS: "EXECUTING_WITH_WAITPOINTS",
    SUSPENDED: "SUSPENDED",
    PENDING_CANCEL: "PENDING_CANCEL",
    FINISHED: "FINISHED",
    DELAYED: "DELAYED",
};
exports.TaskRunStatus = {
    DELAYED: "DELAYED",
    PENDING: "PENDING",
    PENDING_VERSION: "PENDING_VERSION",
    WAITING_FOR_DEPLOY: "WAITING_FOR_DEPLOY",
    DEQUEUED: "DEQUEUED",
    EXECUTING: "EXECUTING",
    WAITING_TO_RESUME: "WAITING_TO_RESUME",
    RETRYING_AFTER_FAILURE: "RETRYING_AFTER_FAILURE",
    PAUSED: "PAUSED",
    CANCELED: "CANCELED",
    INTERRUPTED: "INTERRUPTED",
    COMPLETED_SUCCESSFULLY: "COMPLETED_SUCCESSFULLY",
    COMPLETED_WITH_ERRORS: "COMPLETED_WITH_ERRORS",
    SYSTEM_FAILURE: "SYSTEM_FAILURE",
    CRASHED: "CRASHED",
    EXPIRED: "EXPIRED",
    TIMED_OUT: "TIMED_OUT",
};
exports.WaitpointType = {
    RUN: "RUN",
    DATETIME: "DATETIME",
    MANUAL: "MANUAL",
    BATCH: "BATCH",
};
const WaitpointStatusValues = {
    PENDING: "PENDING",
    COMPLETED: "COMPLETED",
};
exports.WaitpointStatus = v4_1.z.enum(Object.values(WaitpointStatusValues));
exports.CompletedWaitpoint = v4_1.z.object({
    id: v4_1.z.string(),
    index: v4_1.z.number().optional(),
    friendlyId: v4_1.z.string(),
    type: v4_1.z.enum(Object.values(exports.WaitpointType)),
    completedAt: v4_1.z.coerce.date(),
    idempotencyKey: v4_1.z.string().optional(),
    /** For type === "RUN" */
    completedByTaskRun: v4_1.z
        .object({
        id: v4_1.z.string(),
        friendlyId: v4_1.z.string(),
        /** If the run has an associated batch */
        batch: v4_1.z
            .object({
            id: v4_1.z.string(),
            friendlyId: v4_1.z.string(),
        })
            .optional(),
    })
        .optional(),
    /** For type === "DATETIME" */
    completedAfter: v4_1.z.coerce.date().optional(),
    /** For type === "BATCH" */
    completedByBatch: v4_1.z
        .object({
        id: v4_1.z.string(),
        friendlyId: v4_1.z.string(),
    })
        .optional(),
    output: v4_1.z.string().optional(),
    outputType: v4_1.z.string().optional(),
    outputIsError: v4_1.z.boolean(),
});
const ExecutionSnapshot = v4_1.z.object({
    id: v4_1.z.string(),
    friendlyId: v4_1.z.string(),
    executionStatus: v4_1.z.enum(Object.values(exports.TaskRunExecutionStatus)),
    description: v4_1.z.string(),
    createdAt: v4_1.z.coerce.date(),
});
const BaseRunMetadata = v4_1.z.object({
    id: v4_1.z.string(),
    friendlyId: v4_1.z.string(),
    status: v4_1.z.enum(Object.values(exports.TaskRunStatus)),
    attemptNumber: v4_1.z.number().nullish(),
    taskEventStore: v4_1.z.string().optional(),
});
exports.ExecutionResult = v4_1.z.object({
    snapshot: ExecutionSnapshot,
    run: BaseRunMetadata,
});
/** The response to the Worker when starting an attempt */
exports.StartRunAttemptResult = exports.ExecutionResult.and(v4_1.z.object({
    execution: common_js_1.TaskRunExecution,
}));
/** The response to the Worker when completing an attempt */
const CompleteAttemptStatus = v4_1.z.enum([
    "RUN_FINISHED",
    "RUN_PENDING_CANCEL",
    "RETRY_QUEUED",
    "RETRY_IMMEDIATELY",
]);
exports.CompleteRunAttemptResult = v4_1.z
    .object({
    attemptStatus: CompleteAttemptStatus,
})
    .and(exports.ExecutionResult);
exports.CheckpointTypeEnum = {
    DOCKER: "DOCKER",
    KUBERNETES: "KUBERNETES",
    COMPUTE: "COMPUTE",
};
exports.CheckpointType = v4_1.z.enum(Object.values(exports.CheckpointTypeEnum));
exports.CheckpointInput = v4_1.z.object({
    type: exports.CheckpointType,
    location: v4_1.z.string(),
    imageRef: v4_1.z.string().nullish(),
    reason: v4_1.z.string().nullish(),
});
exports.TaskRunCheckpoint = exports.CheckpointInput.merge(v4_1.z.object({
    id: v4_1.z.string(),
    friendlyId: v4_1.z.string(),
}));
/** The response when a Worker asks for the latest execution state */
exports.RunExecutionData = v4_1.z.object({
    version: v4_1.z.literal("1"),
    snapshot: ExecutionSnapshot,
    run: BaseRunMetadata,
    batch: v4_1.z
        .object({
        id: v4_1.z.string(),
        friendlyId: v4_1.z.string(),
    })
        .optional(),
    checkpoint: exports.TaskRunCheckpoint.optional(),
    completedWaitpoints: v4_1.z.array(exports.CompletedWaitpoint),
});
exports.CreateCheckpointResult = (0, zod_js_1.discriminatedUnion)("ok", [
    v4_1.z
        .object({
        ok: v4_1.z.literal(true),
        checkpoint: exports.TaskRunCheckpoint,
    })
        .merge(exports.ExecutionResult),
    v4_1.z.object({
        ok: v4_1.z.literal(false),
        error: v4_1.z.string(),
    }),
]);
exports.MachineResources = v4_1.z.object({
    cpu: v4_1.z.number(),
    memory: v4_1.z.number(),
});
exports.DequeueMessageCheckpoint = v4_1.z.object({
    id: v4_1.z.string(),
    type: exports.CheckpointType,
    location: v4_1.z.string(),
    imageRef: v4_1.z.string().nullish(),
    reason: v4_1.z.string().nullish(),
});
exports.PlacementTag = v4_1.z.object({
    key: v4_1.z.string(),
    values: v4_1.z.array(v4_1.z.string()).optional(),
});
exports.DequeuedMessage = v4_1.z.object({
    version: v4_1.z.literal("1"),
    snapshot: ExecutionSnapshot,
    // Absent for a never-enrolled (postgres) run and for messages produced before this field existed.
    snapshotRoute: snapshotRoute_js_1.SnapshotRouteWire.optional(),
    dequeuedAt: v4_1.z.coerce.date(),
    workerQueueLength: v4_1.z.number().optional(),
    image: v4_1.z.string().optional(),
    checkpoint: exports.DequeueMessageCheckpoint.optional(),
    completedWaitpoints: v4_1.z.array(exports.CompletedWaitpoint),
    backgroundWorker: v4_1.z.object({
        id: v4_1.z.string(),
        friendlyId: v4_1.z.string(),
        version: v4_1.z.string(),
        // Canonical runtime identifier (e.g. "node", "node-22", "node-24", "bun")
        runtime: v4_1.z.string().optional(),
    }),
    deployment: v4_1.z.object({
        id: v4_1.z.string().optional(),
        friendlyId: v4_1.z.string().optional(),
        imagePlatform: v4_1.z.string().optional(),
    }),
    run: v4_1.z.object({
        id: v4_1.z.string(),
        friendlyId: v4_1.z.string(),
        isTest: v4_1.z.boolean(),
        isReplay: v4_1.z.boolean().default(false),
        machine: common_js_1.MachinePreset,
        attemptNumber: v4_1.z.number(),
        masterQueue: v4_1.z.string(),
        traceContext: v4_1.z.record(v4_1.z.string(), v4_1.z.unknown()),
        annotations: exports.RunAnnotations.optional(),
    }),
    environment: v4_1.z.object({
        id: v4_1.z.string(),
        type: schemas_js_1.EnvironmentType,
    }),
    organization: v4_1.z.object({
        id: v4_1.z.string(),
        hasPrivateLink: v4_1.z.boolean().optional(),
    }),
    project: v4_1.z.object({
        id: v4_1.z.string(),
    }),
    placementTags: v4_1.z.array(exports.PlacementTag).optional(),
});
//# sourceMappingURL=runEngine.js.map