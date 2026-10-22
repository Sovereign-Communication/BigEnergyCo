import type { SupervisorHttpClient } from "../runEngineWorker/index.js";
import type { CheckpointServiceRestoreRequestBodyInput, CheckpointServiceSuspendRequestBodyInput } from "../schemas/checkpoints.js";
import type { CheckpointType } from "../schemas/runEngine.js";
export type CheckpointClientOptions = {
    apiUrl: URL;
    workerClient: SupervisorHttpClient;
    orchestrator: CheckpointType;
};
export declare class CheckpointClient {
    private readonly opts;
    private readonly logger;
    constructor(opts: CheckpointClientOptions);
    suspendRun({ runFriendlyId, snapshotFriendlyId, body, }: {
        runFriendlyId: string;
        snapshotFriendlyId: string;
        body: Omit<CheckpointServiceSuspendRequestBodyInput, "type">;
    }): Promise<boolean>;
    restoreRun({ runFriendlyId, snapshotFriendlyId, body, }: {
        runFriendlyId: string;
        snapshotFriendlyId: string;
        body: CheckpointServiceRestoreRequestBodyInput;
    }): Promise<boolean>;
    /**
     * Ask the checkpoint service to reclaim a finished run's checkpoint storage. Best-effort: the
     * service enqueues and returns 202, so a `true` here means accepted, not deleted.
     */
    deleteCheckpoints({ runFriendlyId, body, }: {
        runFriendlyId: string;
        body: {
            orgId: string;
            envId: string;
            projectRef: string;
            deploymentVersion: string;
        };
    }): Promise<boolean>;
    cancelCheckpoints({ runFriendlyId }: {
        runFriendlyId: string;
    }): Promise<boolean>;
}
