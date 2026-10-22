import type { WorkerApiConnectRequestBody, WorkerApiDequeueRequestBody, WorkerApiHeartbeatRequestBody, WorkerApiRunAttemptCompleteRequestBody, WorkerApiRunAttemptStartRequestBody, WorkerApiRunHeartbeatRequestBody, WorkerApiDebugLogBody, WorkerApiSuspendRunRequestBody } from "./schemas.js";
import type { SupervisorClientCommonOptions } from "./types.js";
import { type ApiResult } from "../../zodfetch.js";
type SupervisorHttpClientOptions = SupervisorClientCommonOptions;
export declare class SupervisorHttpClient {
    private readonly apiUrl;
    private readonly workerToken;
    private readonly instanceName;
    private readonly defaultHeaders;
    private readonly sendRunDebugLogs;
    private readonly resolveResponseSchema;
    private readonly onHttpRequestComplete?;
    private readonly logger;
    constructor(opts: SupervisorHttpClientOptions);
    private request;
    connect(body: WorkerApiConnectRequestBody): Promise<ApiResult<{
        ok: true;
        workerGroup: {
            type: string;
            name: string;
        };
    }>>;
    dequeue(body: WorkerApiDequeueRequestBody): Promise<ApiResult<{
        version: "1";
        snapshot: {
            id: string;
            friendlyId: string;
            executionStatus: "DELAYED" | "EXECUTING" | "EXECUTING_WITH_WAITPOINTS" | "FINISHED" | "PENDING_CANCEL" | "PENDING_EXECUTING" | "QUEUED" | "QUEUED_EXECUTING" | "RUN_CREATED" | "SUSPENDED";
            description: string;
            createdAt: Date;
        };
        snapshotRoute?: {
            version: 1;
            residency: "mirrored" | "postgres" | "redis-primary";
            organizationId: string;
        } | undefined;
        dequeuedAt: Date;
        workerQueueLength?: number | undefined;
        image?: string | undefined;
        checkpoint?: {
            id: string;
            type: "COMPUTE" | "DOCKER" | "KUBERNETES";
            location: string;
            imageRef?: string | null | undefined;
            reason?: string | null | undefined;
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
        backgroundWorker: {
            id: string;
            friendlyId: string;
            version: string;
            runtime?: string | undefined;
        };
        deployment: {
            id?: string | undefined;
            friendlyId?: string | undefined;
            imagePlatform?: string | undefined;
        };
        run: {
            id: string;
            friendlyId: string;
            isTest: boolean;
            isReplay: boolean;
            machine: {
                name: "large-1x" | "large-2x" | "medium-1x" | "medium-2x" | "micro" | "small-1x" | "small-2x";
                cpu: number;
                memory: number;
                centsPerMs: number;
            };
            attemptNumber: number;
            masterQueue: string;
            traceContext: Record<string, unknown>;
            annotations?: {
                triggerSource: "api" | "cli" | "dashboard" | "mcp" | "schedule" | "sdk" | (string & {});
                triggerAction: "replay" | "test" | "trigger" | (string & {});
                rootTriggerSource: "api" | "cli" | "dashboard" | "mcp" | "schedule" | "sdk" | (string & {});
                rootScheduleId?: string | undefined;
                taskKind?: "AGENT" | "SCHEDULED" | "STANDARD" | (string & {}) | undefined;
                externalDeploymentId?: string | undefined;
            } | undefined;
        };
        environment: {
            id: string;
            type: "DEVELOPMENT" | "PREVIEW" | "PRODUCTION" | "STAGING";
        };
        organization: {
            id: string;
            hasPrivateLink?: boolean | undefined;
        };
        project: {
            id: string;
        };
        placementTags?: {
            key: string;
            values?: string[] | undefined;
        }[] | undefined;
    }[]>>;
    heartbeatWorker(body: WorkerApiHeartbeatRequestBody): Promise<ApiResult<{
        ok: true;
    }>>;
    heartbeatRun(runId: string, snapshotId: string, body: WorkerApiRunHeartbeatRequestBody, runnerId?: string): Promise<ApiResult<{
        ok: true;
    }>>;
    startRunAttempt(runId: string, snapshotId: string, body: WorkerApiRunAttemptStartRequestBody, runnerId?: string, environmentId?: string): Promise<ApiResult<{
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
    completeRunAttempt(runId: string, snapshotId: string, body: WorkerApiRunAttemptCompleteRequestBody, runnerId?: string, environmentId?: string): Promise<ApiResult<{
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
    getLatestSnapshot(runId: string, runnerId?: string, environmentId?: string): Promise<ApiResult<{
        execution: {
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
        };
    }>>;
    getSnapshotsSince(runId: string, snapshotId: string, runnerId?: string, environmentId?: string): Promise<ApiResult<{
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
    }>>;
    sendDebugLog(runId: string, body: WorkerApiDebugLogBody, runnerId?: string): Promise<void>;
    continueRunExecution(runId: string, snapshotId: string, runnerId?: string, environmentId?: string): Promise<ApiResult<{
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
    }>>;
    submitSuspendCompletion({ runId, snapshotId, runnerId, body, }: {
        runId: string;
        snapshotId: string;
        runnerId?: string;
        body: WorkerApiSuspendRunRequestBody;
    }): Promise<ApiResult<{
        ok: true;
    }>>;
    private runnerIdHeader;
    private environmentIdHeader;
}
export {};
