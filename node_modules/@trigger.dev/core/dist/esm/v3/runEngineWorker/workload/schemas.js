import { z } from "zod/v4";
import { discriminatedUnion } from "../../utils/zod.js";
import { WorkerApiRunHeartbeatRequestBody, WorkerApiHeartbeatResponseBody, WorkerApiRunAttemptCompleteRequestBody, WorkerApiRunAttemptCompleteResponseBody, WorkerApiRunAttemptStartRequestBody, WorkerApiRunAttemptStartResponseBody, WorkerApiRunLatestSnapshotResponseBody, WorkerApiContinueRunExecutionRequestBody, WorkerApiContinueRunExecutionQueryParams, WorkerApiDebugLogBody, WorkerApiRunSnapshotsSinceResponseBody, } from "../supervisor/schemas.js";
export const WorkloadHeartbeatRequestBody = WorkerApiRunHeartbeatRequestBody;
export const WorkloadHeartbeatResponseBody = WorkerApiHeartbeatResponseBody;
export const WorkloadSuspendRunResponseBody = discriminatedUnion("ok", [
    z.object({
        ok: z.literal(true),
    }),
    z.object({
        ok: z.literal(false),
        error: z.string(),
    }),
]);
export const WorkloadContinueRunExecutionResponseBody = WorkerApiContinueRunExecutionRequestBody;
export const WorkloadContinueRunExecutionQueryParams = WorkerApiContinueRunExecutionQueryParams;
export const WorkloadRunAttemptCompleteRequestBody = WorkerApiRunAttemptCompleteRequestBody;
export const WorkloadRunAttemptCompleteResponseBody = WorkerApiRunAttemptCompleteResponseBody;
export const WorkloadRunAttemptStartRequestBody = WorkerApiRunAttemptStartRequestBody;
export const WorkloadRunAttemptStartResponseBody = WorkerApiRunAttemptStartResponseBody;
export const WorkloadRunLatestSnapshotResponseBody = WorkerApiRunLatestSnapshotResponseBody;
export const WorkloadDebugLogRequestBody = WorkerApiDebugLogBody;
export const WorkloadRunSnapshotsSinceResponseBody = WorkerApiRunSnapshotsSinceResponseBody;
//# sourceMappingURL=schemas.js.map