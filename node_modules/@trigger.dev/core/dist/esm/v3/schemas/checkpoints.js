import { CheckpointType, DequeuedMessage } from "./runEngine.js";
import z from "zod/v4";
const _CallbackUrl = z
    .string()
    .url()
    .transform((url) => new URL(url));
export const CheckpointServiceSuspendRequestBody = z.object({
    type: CheckpointType,
    runId: z.string(),
    snapshotId: z.string(),
    runnerId: z.string(),
    projectRef: z.string(),
    deploymentVersion: z.string(),
    reason: z.string().optional(),
});
export const CheckpointServiceSuspendResponseBody = z.object({
    ok: z.literal(true),
});
export const CheckpointServiceRestoreRequestBody = DequeuedMessage.required({ checkpoint: true });
//# sourceMappingURL=checkpoints.js.map