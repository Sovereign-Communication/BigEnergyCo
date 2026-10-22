"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkloadRunSnapshotsSinceResponseBody = exports.WorkloadDebugLogRequestBody = exports.WorkloadRunLatestSnapshotResponseBody = exports.WorkloadRunAttemptStartResponseBody = exports.WorkloadRunAttemptStartRequestBody = exports.WorkloadRunAttemptCompleteResponseBody = exports.WorkloadRunAttemptCompleteRequestBody = exports.WorkloadContinueRunExecutionQueryParams = exports.WorkloadContinueRunExecutionResponseBody = exports.WorkloadSuspendRunResponseBody = exports.WorkloadHeartbeatResponseBody = exports.WorkloadHeartbeatRequestBody = void 0;
const v4_1 = require("zod/v4");
const zod_js_1 = require("../../utils/zod.js");
const schemas_js_1 = require("../supervisor/schemas.js");
exports.WorkloadHeartbeatRequestBody = schemas_js_1.WorkerApiRunHeartbeatRequestBody;
exports.WorkloadHeartbeatResponseBody = schemas_js_1.WorkerApiHeartbeatResponseBody;
exports.WorkloadSuspendRunResponseBody = (0, zod_js_1.discriminatedUnion)("ok", [
    v4_1.z.object({
        ok: v4_1.z.literal(true),
    }),
    v4_1.z.object({
        ok: v4_1.z.literal(false),
        error: v4_1.z.string(),
    }),
]);
exports.WorkloadContinueRunExecutionResponseBody = schemas_js_1.WorkerApiContinueRunExecutionRequestBody;
exports.WorkloadContinueRunExecutionQueryParams = schemas_js_1.WorkerApiContinueRunExecutionQueryParams;
exports.WorkloadRunAttemptCompleteRequestBody = schemas_js_1.WorkerApiRunAttemptCompleteRequestBody;
exports.WorkloadRunAttemptCompleteResponseBody = schemas_js_1.WorkerApiRunAttemptCompleteResponseBody;
exports.WorkloadRunAttemptStartRequestBody = schemas_js_1.WorkerApiRunAttemptStartRequestBody;
exports.WorkloadRunAttemptStartResponseBody = schemas_js_1.WorkerApiRunAttemptStartResponseBody;
exports.WorkloadRunLatestSnapshotResponseBody = schemas_js_1.WorkerApiRunLatestSnapshotResponseBody;
exports.WorkloadDebugLogRequestBody = schemas_js_1.WorkerApiDebugLogBody;
exports.WorkloadRunSnapshotsSinceResponseBody = schemas_js_1.WorkerApiRunSnapshotsSinceResponseBody;
//# sourceMappingURL=schemas.js.map