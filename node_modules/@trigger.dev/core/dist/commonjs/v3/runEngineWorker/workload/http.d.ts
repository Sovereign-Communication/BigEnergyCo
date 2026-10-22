import type { WorkloadHeartbeatRequestBody, WorkloadRunAttemptCompleteRequestBody, WorkloadRunAttemptStartRequestBody, WorkloadDebugLogRequestBody } from "./schemas.js";
import type { WorkloadClientCommonOptions } from "./types.js";
import type { SnapshotRouteWire } from "../../schemas/runEngine.js";
type WorkloadHttpClientOptions = WorkloadClientCommonOptions;
export declare class WorkloadHttpClient {
    private opts;
    private apiUrl;
    private runnerId;
    constructor(opts: WorkloadHttpClientOptions);
    updateApiUrl(apiUrl: string): void;
    updateRunnerId(runnerId: string): void;
    defaultHeaders(): Record<string, string>;
    private isConnectionError;
    private withConnectionErrorDetection;
    heartbeatRun(runId: string, snapshotId: string, body?: WorkloadHeartbeatRequestBody): Promise<{
        success: true;
        data: {
            ok: true;
        };
    } | {
        success: false;
        error: string;
        isConnectionError?: boolean;
    }>;
    suspendRun(runId: string, snapshotId: string): Promise<import("../../zodfetch.js").ApiResult<{
        ok: true;
    } | {
        ok: false;
        error: string;
    }>>;
    continueRunExecution(runId: string, snapshotId: string, snapshotRoute?: SnapshotRouteWire): Promise<{
        success: true;
        data: {
            snapshot: {
                id: string;
                friendlyId: string;
                executionStatus: "DELAYED" | "EXECUTING" | "EXECUTING_WITH_WAITPOINTS" | "FINISHED" | "PENDING_CANCEL" | "PENDING_EXECUTING" | "QUEUED" | "QUEUED_EXECUTING" | "RUN_CREATED" | "SUSPENDED";
                description: string;
                createdAt: Date;
            };
            run: {
                id: string;
                friendlyId: string;
                status: "CANCELED" | "COMPLETED_SUCCESSFULLY" | "COMPLETED_WITH_ERRORS" | "CRASHED" | "DELAYED" | "DEQUEUED" | "EXECUTING" | "EXPIRED" | "INTERRUPTED" | "PAUSED" | "PENDING" | "PENDING_VERSION" | "RETRYING_AFTER_FAILURE" | "SYSTEM_FAILURE" | "TIMED_OUT" | "WAITING_FOR_DEPLOY" | "WAITING_TO_RESUME";
                attemptNumber?: number | null | undefined;
                taskEventStore?: string | undefined;
            };
        };
    } | {
        success: false;
        error: string;
        isConnectionError?: boolean;
    }>;
    startRunAttempt(runId: string, snapshotId: string, body: WorkloadRunAttemptStartRequestBody): Promise<import("../../zodfetch.js").ApiResult<{
        snapshot: {
            id: string;
            friendlyId: string;
            executionStatus: "DELAYED" | "EXECUTING" | "EXECUTING_WITH_WAITPOINTS" | "FINISHED" | "PENDING_CANCEL" | "PENDING_EXECUTING" | "QUEUED" | "QUEUED_EXECUTING" | "RUN_CREATED" | "SUSPENDED";
            description: string;
            createdAt: Date;
        };
        run: {
            id: string;
            friendlyId: string;
            status: "CANCELED" | "COMPLETED_SUCCESSFULLY" | "COMPLETED_WITH_ERRORS" | "CRASHED" | "DELAYED" | "DEQUEUED" | "EXECUTING" | "EXPIRED" | "INTERRUPTED" | "PAUSED" | "PENDING" | "PENDING_VERSION" | "RETRYING_AFTER_FAILURE" | "SYSTEM_FAILURE" | "TIMED_OUT" | "WAITING_FOR_DEPLOY" | "WAITING_TO_RESUME";
            attemptNumber?: number | null | undefined;
            taskEventStore?: string | undefined;
        };
    } & {
        execution: {
            task: {
                [x: string]: unknown;
                id: string;
                filePath: string;
            };
            queue: {
                id: string;
                name: string;
            };
            environment: {
                id: string;
                slug: string;
                type: "DEVELOPMENT" | "PREVIEW" | "PRODUCTION" | "STAGING";
                branchName?: string | undefined;
                git?: {
                    provider?: string | undefined;
                    source?: "github_actions" | "local" | "trigger_github_app" | undefined;
                    ghUsername?: string | undefined;
                    ghUserAvatarUrl?: string | undefined;
                    commitAuthorName?: string | undefined;
                    commitMessage?: string | undefined;
                    commitRef?: string | undefined;
                    commitSha?: string | undefined;
                    dirty?: boolean | undefined;
                    remoteUrl?: string | undefined;
                    pullRequestNumber?: number | undefined;
                    pullRequestTitle?: string | undefined;
                    pullRequestState?: "closed" | "merged" | "open" | undefined;
                } | undefined;
            };
            organization: {
                id: string;
                slug: string;
                name: string;
            };
            project: {
                id: string;
                ref: string;
                slug: string;
                name: string;
            };
            machine: {
                name: "large-1x" | "large-2x" | "medium-1x" | "medium-2x" | "micro" | "small-1x" | "small-2x";
                cpu: number;
                memory: number;
                centsPerMs: number;
            };
            batch?: {
                id: string;
            } | undefined;
            deployment?: {
                id: string;
                shortCode: string;
                version: string;
                runtime: string;
                runtimeVersion: string;
                git?: {
                    provider?: string | undefined;
                    source?: "github_actions" | "local" | "trigger_github_app" | undefined;
                    ghUsername?: string | undefined;
                    ghUserAvatarUrl?: string | undefined;
                    commitAuthorName?: string | undefined;
                    commitMessage?: string | undefined;
                    commitRef?: string | undefined;
                    commitSha?: string | undefined;
                    dirty?: boolean | undefined;
                    remoteUrl?: string | undefined;
                    pullRequestNumber?: number | undefined;
                    pullRequestTitle?: string | undefined;
                    pullRequestState?: "closed" | "merged" | "open" | undefined;
                } | undefined;
                externalId?: string | undefined;
            } | undefined;
            attempt: {
                [x: string]: unknown;
                number: number;
                startedAt: Date;
            };
            run: {
                id: string;
                payload: string;
                payloadType: string;
                tags: string[];
                isTest: boolean;
                isReplay: boolean;
                createdAt: Date;
                startedAt: Date;
                idempotencyKey?: string | undefined;
                idempotencyKeyScope?: "attempt" | "global" | "run" | undefined;
                maxAttempts?: number | undefined;
                version?: string | undefined;
                metadata?: Record<string, import("../../../index.js").DeserializedJson> | undefined;
                maxDuration?: number | undefined;
                priority?: number | undefined;
                baseCostInCents?: number | undefined;
                parentTaskRunId?: string | undefined;
                rootTaskRunId?: string | undefined;
                durationMs?: number | undefined;
                costInCents?: number | undefined;
                region?: string | undefined;
            } & {
                traceContext?: Record<string, unknown> | undefined;
                realtimeStreamsVersion?: string | undefined;
            };
        };
    } & {
        envVars: Record<string, string>;
    }>>;
    completeRunAttempt(runId: string, snapshotId: string, body: WorkloadRunAttemptCompleteRequestBody): Promise<import("../../zodfetch.js").ApiResult<{
        result: {
            attemptStatus: "RETRY_IMMEDIATELY" | "RETRY_QUEUED" | "RUN_FINISHED" | "RUN_PENDING_CANCEL";
        } & {
            snapshot: {
                id: string;
                friendlyId: string;
                executionStatus: "DELAYED" | "EXECUTING" | "EXECUTING_WITH_WAITPOINTS" | "FINISHED" | "PENDING_CANCEL" | "PENDING_EXECUTING" | "QUEUED" | "QUEUED_EXECUTING" | "RUN_CREATED" | "SUSPENDED";
                description: string;
                createdAt: Date;
            };
            run: {
                id: string;
                friendlyId: string;
                status: "CANCELED" | "COMPLETED_SUCCESSFULLY" | "COMPLETED_WITH_ERRORS" | "CRASHED" | "DELAYED" | "DEQUEUED" | "EXECUTING" | "EXPIRED" | "INTERRUPTED" | "PAUSED" | "PENDING" | "PENDING_VERSION" | "RETRYING_AFTER_FAILURE" | "SYSTEM_FAILURE" | "TIMED_OUT" | "WAITING_FOR_DEPLOY" | "WAITING_TO_RESUME";
                attemptNumber?: number | null | undefined;
                taskEventStore?: string | undefined;
            };
        };
    }>>;
    getSnapshotsSince(runId: string, snapshotId: string): Promise<{
        success: true;
        data: {
            snapshots: {
                version: "1";
                snapshot: {
                    id: string;
                    friendlyId: string;
                    executionStatus: "DELAYED" | "EXECUTING" | "EXECUTING_WITH_WAITPOINTS" | "FINISHED" | "PENDING_CANCEL" | "PENDING_EXECUTING" | "QUEUED" | "QUEUED_EXECUTING" | "RUN_CREATED" | "SUSPENDED";
                    description: string;
                    createdAt: Date;
                };
                run: {
                    id: string;
                    friendlyId: string;
                    status: "CANCELED" | "COMPLETED_SUCCESSFULLY" | "COMPLETED_WITH_ERRORS" | "CRASHED" | "DELAYED" | "DEQUEUED" | "EXECUTING" | "EXPIRED" | "INTERRUPTED" | "PAUSED" | "PENDING" | "PENDING_VERSION" | "RETRYING_AFTER_FAILURE" | "SYSTEM_FAILURE" | "TIMED_OUT" | "WAITING_FOR_DEPLOY" | "WAITING_TO_RESUME";
                    attemptNumber?: number | null | undefined;
                    taskEventStore?: string | undefined;
                };
                batch?: {
                    id: string;
                    friendlyId: string;
                } | undefined;
                checkpoint?: {
                    type: "COMPUTE" | "DOCKER" | "KUBERNETES";
                    location: string;
                    imageRef?: string | null | undefined;
                    reason?: string | null | undefined;
                    id: string;
                    friendlyId: string;
                } | undefined;
                completedWaitpoints: {
                    id: string;
                    index?: number | undefined;
                    friendlyId: string;
                    type: "BATCH" | "DATETIME" | "MANUAL" | "RUN";
                    completedAt: Date;
                    idempotencyKey?: string | undefined;
                    completedByTaskRun?: {
                        id: string;
                        friendlyId: string;
                        batch?: {
                            id: string;
                            friendlyId: string;
                        } | undefined;
                    } | undefined;
                    completedAfter?: Date | undefined;
                    completedByBatch?: {
                        id: string;
                        friendlyId: string;
                    } | undefined;
                    output?: string | undefined;
                    outputType?: string | undefined;
                    outputIsError: boolean;
                }[];
            }[];
        };
    } | {
        success: false;
        error: string;
        isConnectionError?: boolean;
    }>;
    sendDebugLog(runId: string, body: WorkloadDebugLogRequestBody): Promise<void>;
}
export {};
