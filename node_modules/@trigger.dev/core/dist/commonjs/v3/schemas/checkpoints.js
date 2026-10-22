"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckpointServiceRestoreRequestBody = exports.CheckpointServiceSuspendResponseBody = exports.CheckpointServiceSuspendRequestBody = void 0;
const runEngine_js_1 = require("./runEngine.js");
const v4_1 = __importDefault(require("zod/v4"));
const _CallbackUrl = v4_1.default
    .string()
    .url()
    .transform((url) => new URL(url));
exports.CheckpointServiceSuspendRequestBody = v4_1.default.object({
    type: runEngine_js_1.CheckpointType,
    runId: v4_1.default.string(),
    snapshotId: v4_1.default.string(),
    runnerId: v4_1.default.string(),
    projectRef: v4_1.default.string(),
    deploymentVersion: v4_1.default.string(),
    reason: v4_1.default.string().optional(),
});
exports.CheckpointServiceSuspendResponseBody = v4_1.default.object({
    ok: v4_1.default.literal(true),
});
exports.CheckpointServiceRestoreRequestBody = runEngine_js_1.DequeuedMessage.required({ checkpoint: true });
//# sourceMappingURL=checkpoints.js.map