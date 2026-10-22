"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerApiRunSnapshotsSinceResponseBody = exports.WorkerApiSuspendCompletionResponseBody = exports.WorkerApiDebugLogBody = exports.WorkerApiDebugLogBodyInput = exports.DebugLogPropertiesInput = exports.DebugLogProperties = exports.DebugLogPropertiesValue = exports.WorkerApiRunLatestSnapshotResponseBody = exports.WorkerApiRunAttemptCompleteResponseBody = exports.WorkerApiRunAttemptCompleteRequestBody = exports.WorkerApiRunAttemptStartResponseBody = exports.WorkerApiRunAttemptStartRequestBody = exports.WorkerApiRunHeartbeatResponseBody = exports.WorkerApiRunHeartbeatRequestBody = exports.WorkerApiDequeueResponseBody = exports.WorkerApiDequeueRequestBody = exports.WorkerQueueClass = exports.WorkerApiConnectResponseBody = exports.WorkerApiConnectRequestBody = exports.WorkerApiContinueRunExecutionQueryParams = exports.WorkerApiContinueRunExecutionRequestBody = exports.WorkerApiSuspendRunResponseBody = exports.WorkerApiSuspendRunRequestBody = exports.WorkerApiHeartbeatResponseBody = exports.WorkerApiHeartbeatRequestBody = void 0;
const v4_1 = require("zod/v4");
const zod_js_1 = require("../../utils/zod.js");
const common_js_1 = require("../../schemas/common.js");
const runEngine_js_1 = require("../../schemas/runEngine.js");
// Imported from the leaf, not runEngine.js: this file is loaded mid-runEngine-init via the
// schemas/index -> messages -> supervisor/schemas cycle, so a runEngine.js import would be in the TDZ.
const snapshotRoute_js_1 = require("../../schemas/snapshotRoute.js");
exports.WorkerApiHeartbeatRequestBody = v4_1.z.object({
    cpu: v4_1.z.object({
        used: v4_1.z.number(),
        available: v4_1.z.number(),
    }),
    memory: v4_1.z.object({
        used: v4_1.z.number(),
        available: v4_1.z.number(),
    }),
    tasks: v4_1.z.array(v4_1.z.string()),
});
exports.WorkerApiHeartbeatResponseBody = v4_1.z.object({
    ok: v4_1.z.literal(true),
});
exports.WorkerApiSuspendRunRequestBody = (0, zod_js_1.discriminatedUnion)("success", [
    v4_1.z.object({
        success: v4_1.z.literal(true),
        checkpoint: runEngine_js_1.CheckpointInput,
        // See WorkerApiRunAttemptStartRequestBody.snapshotRoute — carries the route to the suspend transition.
        snapshotRoute: snapshotRoute_js_1.SnapshotRouteWireLenient.optional(),
    }),
    v4_1.z.object({
        success: v4_1.z.literal(false),
        error: v4_1.z.string(),
    }),
]);
exports.WorkerApiSuspendRunResponseBody = v4_1.z.object({
    ok: v4_1.z.literal(true),
});
exports.WorkerApiContinueRunExecutionRequestBody = runEngine_js_1.ExecutionResult;
// Query params for the continue (checkpoint-restore) request. It's a GET, so this travels on the
// URL rather than a JSON body. See WorkerApiRunAttemptStartRequestBody.snapshotRoute — carries the
// route to the resume transition. Optional for mixed-version compatibility (older workers omit it).
exports.WorkerApiContinueRunExecutionQueryParams = v4_1.z.object({
    snapshotRoute: snapshotRoute_js_1.SnapshotRouteWire.optional(),
});
exports.WorkerApiConnectRequestBody = v4_1.z.object({
    metadata: v4_1.z.record(v4_1.z.string(), v4_1.z.any()),
});
exports.WorkerApiConnectResponseBody = v4_1.z.object({
    ok: v4_1.z.literal(true),
    workerGroup: v4_1.z.object({
        type: v4_1.z.string(),
        name: v4_1.z.string(),
    }),
});
exports.WorkerQueueClass = v4_1.z.enum(["default", "scheduled"]);
exports.WorkerApiDequeueRequestBody = v4_1.z.object({
    maxResources: runEngine_js_1.MachineResources.optional(),
    maxRunCount: v4_1.z.number().optional(),
    /**
     * Which class of worker queue this consumer pulls from. Absent or "default" =
     * the worker group's region queue. "scheduled" targets the dedicated
     * scheduled-lineage queue so a separate fleet can drain it independently. The
     * server derives the actual queue name from the token, so this only ever
     * selects between the authenticated worker's own queues.
     */
    queueClass: exports.WorkerQueueClass.optional(),
});
exports.WorkerApiDequeueResponseBody = runEngine_js_1.DequeuedMessage.array();
exports.WorkerApiRunHeartbeatRequestBody = v4_1.z.object({
    cpu: v4_1.z.number().optional(),
    memory: v4_1.z.number().optional(),
});
exports.WorkerApiRunHeartbeatResponseBody = v4_1.z.object({
    ok: v4_1.z.literal(true),
});
exports.WorkerApiRunAttemptStartRequestBody = v4_1.z.object({
    isWarmStart: v4_1.z.boolean().optional(),
    // The run's storage route, carried back from the DequeuedMessage so this attempt honors durable
    // residency on a poll-lagging pod. LENIENT: a newer worker's unreadable route becomes absent and
    // falls back to durable residency rather than failing the request.
    snapshotRoute: snapshotRoute_js_1.SnapshotRouteWireLenient.optional(),
});
exports.WorkerApiRunAttemptStartResponseBody = runEngine_js_1.StartRunAttemptResult.and(v4_1.z.object({
    envVars: v4_1.z.record(v4_1.z.string(), v4_1.z.string()),
}));
exports.WorkerApiRunAttemptCompleteRequestBody = v4_1.z.object({
    completion: common_js_1.TaskRunExecutionResult,
    // See WorkerApiRunAttemptStartRequestBody.snapshotRoute — carries the route to the completion transition.
    snapshotRoute: snapshotRoute_js_1.SnapshotRouteWireLenient.optional(),
});
exports.WorkerApiRunAttemptCompleteResponseBody = v4_1.z.object({
    result: runEngine_js_1.CompleteRunAttemptResult,
});
exports.WorkerApiRunLatestSnapshotResponseBody = v4_1.z.object({
    execution: runEngine_js_1.RunExecutionData,
});
exports.DebugLogPropertiesValue = v4_1.z.union([
    v4_1.z.string(),
    v4_1.z.number(),
    v4_1.z.boolean(),
    v4_1.z.array(v4_1.z.string().nullish()),
    v4_1.z.array(v4_1.z.number().nullish()),
    v4_1.z.array(v4_1.z.boolean().nullish()),
]);
exports.DebugLogProperties = v4_1.z.record(v4_1.z.string(), exports.DebugLogPropertiesValue.optional());
exports.DebugLogPropertiesInput = v4_1.z.record(v4_1.z.string(), v4_1.z.unknown());
exports.WorkerApiDebugLogBodyInput = v4_1.z.object({
    time: v4_1.z.coerce.date(),
    message: v4_1.z.string(),
    properties: exports.DebugLogPropertiesInput.optional(),
});
exports.WorkerApiDebugLogBody = v4_1.z.object({
    time: v4_1.z.coerce.date(),
    message: v4_1.z.string(),
    properties: exports.DebugLogProperties.optional(),
});
exports.WorkerApiSuspendCompletionResponseBody = v4_1.z.object({
    success: v4_1.z.boolean(),
    error: v4_1.z.string().optional(),
});
exports.WorkerApiRunSnapshotsSinceResponseBody = v4_1.z.object({
    snapshots: v4_1.z.array(runEngine_js_1.RunExecutionData),
});
//# sourceMappingURL=schemas.js.map