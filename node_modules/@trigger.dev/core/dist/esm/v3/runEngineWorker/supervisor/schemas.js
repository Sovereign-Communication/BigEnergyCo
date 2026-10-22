import { z } from "zod/v4";
import { discriminatedUnion } from "../../utils/zod.js";
import { TaskRunExecutionResult } from "../../schemas/common.js";
import { MachineResources, DequeuedMessage, StartRunAttemptResult, CompleteRunAttemptResult, RunExecutionData, CheckpointInput, ExecutionResult, } from "../../schemas/runEngine.js";
// Imported from the leaf, not runEngine.js: this file is loaded mid-runEngine-init via the
// schemas/index -> messages -> supervisor/schemas cycle, so a runEngine.js import would be in the TDZ.
import { SnapshotRouteWire, SnapshotRouteWireLenient } from "../../schemas/snapshotRoute.js";
export const WorkerApiHeartbeatRequestBody = z.object({
    cpu: z.object({
        used: z.number(),
        available: z.number(),
    }),
    memory: z.object({
        used: z.number(),
        available: z.number(),
    }),
    tasks: z.array(z.string()),
});
export const WorkerApiHeartbeatResponseBody = z.object({
    ok: z.literal(true),
});
export const WorkerApiSuspendRunRequestBody = discriminatedUnion("success", [
    z.object({
        success: z.literal(true),
        checkpoint: CheckpointInput,
        // See WorkerApiRunAttemptStartRequestBody.snapshotRoute — carries the route to the suspend transition.
        snapshotRoute: SnapshotRouteWireLenient.optional(),
    }),
    z.object({
        success: z.literal(false),
        error: z.string(),
    }),
]);
export const WorkerApiSuspendRunResponseBody = z.object({
    ok: z.literal(true),
});
export const WorkerApiContinueRunExecutionRequestBody = ExecutionResult;
// Query params for the continue (checkpoint-restore) request. It's a GET, so this travels on the
// URL rather than a JSON body. See WorkerApiRunAttemptStartRequestBody.snapshotRoute — carries the
// route to the resume transition. Optional for mixed-version compatibility (older workers omit it).
export const WorkerApiContinueRunExecutionQueryParams = z.object({
    snapshotRoute: SnapshotRouteWire.optional(),
});
export const WorkerApiConnectRequestBody = z.object({
    metadata: z.record(z.string(), z.any()),
});
export const WorkerApiConnectResponseBody = z.object({
    ok: z.literal(true),
    workerGroup: z.object({
        type: z.string(),
        name: z.string(),
    }),
});
export const WorkerQueueClass = z.enum(["default", "scheduled"]);
export const WorkerApiDequeueRequestBody = z.object({
    maxResources: MachineResources.optional(),
    maxRunCount: z.number().optional(),
    /**
     * Which class of worker queue this consumer pulls from. Absent or "default" =
     * the worker group's region queue. "scheduled" targets the dedicated
     * scheduled-lineage queue so a separate fleet can drain it independently. The
     * server derives the actual queue name from the token, so this only ever
     * selects between the authenticated worker's own queues.
     */
    queueClass: WorkerQueueClass.optional(),
});
export const WorkerApiDequeueResponseBody = DequeuedMessage.array();
export const WorkerApiRunHeartbeatRequestBody = z.object({
    cpu: z.number().optional(),
    memory: z.number().optional(),
});
export const WorkerApiRunHeartbeatResponseBody = z.object({
    ok: z.literal(true),
});
export const WorkerApiRunAttemptStartRequestBody = z.object({
    isWarmStart: z.boolean().optional(),
    // The run's storage route, carried back from the DequeuedMessage so this attempt honors durable
    // residency on a poll-lagging pod. LENIENT: a newer worker's unreadable route becomes absent and
    // falls back to durable residency rather than failing the request.
    snapshotRoute: SnapshotRouteWireLenient.optional(),
});
export const WorkerApiRunAttemptStartResponseBody = StartRunAttemptResult.and(z.object({
    envVars: z.record(z.string(), z.string()),
}));
export const WorkerApiRunAttemptCompleteRequestBody = z.object({
    completion: TaskRunExecutionResult,
    // See WorkerApiRunAttemptStartRequestBody.snapshotRoute — carries the route to the completion transition.
    snapshotRoute: SnapshotRouteWireLenient.optional(),
});
export const WorkerApiRunAttemptCompleteResponseBody = z.object({
    result: CompleteRunAttemptResult,
});
export const WorkerApiRunLatestSnapshotResponseBody = z.object({
    execution: RunExecutionData,
});
export const DebugLogPropertiesValue = z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string().nullish()),
    z.array(z.number().nullish()),
    z.array(z.boolean().nullish()),
]);
export const DebugLogProperties = z.record(z.string(), DebugLogPropertiesValue.optional());
export const DebugLogPropertiesInput = z.record(z.string(), z.unknown());
export const WorkerApiDebugLogBodyInput = z.object({
    time: z.coerce.date(),
    message: z.string(),
    properties: DebugLogPropertiesInput.optional(),
});
export const WorkerApiDebugLogBody = z.object({
    time: z.coerce.date(),
    message: z.string(),
    properties: DebugLogProperties.optional(),
});
export const WorkerApiSuspendCompletionResponseBody = z.object({
    success: z.boolean(),
    error: z.string().optional(),
});
export const WorkerApiRunSnapshotsSinceResponseBody = z.object({
    snapshots: z.array(RunExecutionData),
});
//# sourceMappingURL=schemas.js.map