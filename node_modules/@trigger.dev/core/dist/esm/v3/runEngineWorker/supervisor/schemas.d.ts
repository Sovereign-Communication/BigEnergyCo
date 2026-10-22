import { z } from "zod/v4";
export declare const WorkerApiHeartbeatRequestBody: z.ZodObject<{
    cpu: z.ZodObject<{
        used: z.ZodNumber;
        available: z.ZodNumber;
    }, z.core.$strip>;
    memory: z.ZodObject<{
        used: z.ZodNumber;
        available: z.ZodNumber;
    }, z.core.$strip>;
    tasks: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type WorkerApiHeartbeatRequestBody = z.infer<typeof WorkerApiHeartbeatRequestBody>;
export declare const WorkerApiHeartbeatResponseBody: z.ZodObject<{
    ok: z.ZodLiteral<true>;
}, z.core.$strip>;
export type WorkerApiHeartbeatResponseBody = z.infer<typeof WorkerApiHeartbeatResponseBody>;
export declare const WorkerApiSuspendRunRequestBody: import("../../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
    success: z.ZodLiteral<true>;
    checkpoint: z.ZodObject<{
        type: z.ZodEnum<{
            COMPUTE: "COMPUTE";
            DOCKER: "DOCKER";
            KUBERNETES: "KUBERNETES";
        }>;
        location: z.ZodString;
        imageRef: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>;
    snapshotRoute: z.ZodOptional<z.ZodPipe<z.ZodUnknown, z.ZodTransform<{
        version: 1;
        residency: "mirrored" | "postgres" | "redis-primary";
        organizationId: string;
    } | undefined, unknown>>>;
}, z.core.$strip>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, z.core.$strip>]>;
export type WorkerApiSuspendRunRequestBody = z.infer<typeof WorkerApiSuspendRunRequestBody>;
export declare const WorkerApiSuspendRunResponseBody: z.ZodObject<{
    ok: z.ZodLiteral<true>;
}, z.core.$strip>;
export type WorkerApiSuspendRunResponseBody = z.infer<typeof WorkerApiSuspendRunResponseBody>;
export declare const WorkerApiContinueRunExecutionRequestBody: z.ZodObject<{
    snapshot: z.ZodObject<{
        id: z.ZodString;
        friendlyId: z.ZodString;
        executionStatus: z.ZodEnum<{
            DELAYED: "DELAYED";
            EXECUTING: "EXECUTING";
            EXECUTING_WITH_WAITPOINTS: "EXECUTING_WITH_WAITPOINTS";
            FINISHED: "FINISHED";
            PENDING_CANCEL: "PENDING_CANCEL";
            PENDING_EXECUTING: "PENDING_EXECUTING";
            QUEUED: "QUEUED";
            QUEUED_EXECUTING: "QUEUED_EXECUTING";
            RUN_CREATED: "RUN_CREATED";
            SUSPENDED: "SUSPENDED";
        }>;
        description: z.ZodString;
        createdAt: z.ZodCoercedDate<unknown>;
    }, z.core.$strip>;
    run: z.ZodObject<{
        id: z.ZodString;
        friendlyId: z.ZodString;
        status: z.ZodEnum<{
            CANCELED: "CANCELED";
            COMPLETED_SUCCESSFULLY: "COMPLETED_SUCCESSFULLY";
            COMPLETED_WITH_ERRORS: "COMPLETED_WITH_ERRORS";
            CRASHED: "CRASHED";
            DELAYED: "DELAYED";
            DEQUEUED: "DEQUEUED";
            EXECUTING: "EXECUTING";
            EXPIRED: "EXPIRED";
            INTERRUPTED: "INTERRUPTED";
            PAUSED: "PAUSED";
            PENDING: "PENDING";
            PENDING_VERSION: "PENDING_VERSION";
            RETRYING_AFTER_FAILURE: "RETRYING_AFTER_FAILURE";
            SYSTEM_FAILURE: "SYSTEM_FAILURE";
            TIMED_OUT: "TIMED_OUT";
            WAITING_FOR_DEPLOY: "WAITING_FOR_DEPLOY";
            WAITING_TO_RESUME: "WAITING_TO_RESUME";
        }>;
        attemptNumber: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        taskEventStore: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type WorkerApiContinueRunExecutionRequestBody = z.infer<typeof WorkerApiContinueRunExecutionRequestBody>;
export declare const WorkerApiContinueRunExecutionQueryParams: z.ZodObject<{
    snapshotRoute: z.ZodOptional<z.ZodObject<{
        version: z.ZodLiteral<1>;
        residency: z.ZodEnum<{
            mirrored: "mirrored";
            postgres: "postgres";
            "redis-primary": "redis-primary";
        }>;
        organizationId: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type WorkerApiContinueRunExecutionQueryParams = z.infer<typeof WorkerApiContinueRunExecutionQueryParams>;
export declare const WorkerApiConnectRequestBody: z.ZodObject<{
    metadata: z.ZodRecord<z.ZodString, z.ZodAny>;
}, z.core.$strip>;
export type WorkerApiConnectRequestBody = z.infer<typeof WorkerApiConnectRequestBody>;
export declare const WorkerApiConnectResponseBody: z.ZodObject<{
    ok: z.ZodLiteral<true>;
    workerGroup: z.ZodObject<{
        type: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export type WorkerApiConnectResponseBody = z.infer<typeof WorkerApiConnectResponseBody>;
export declare const WorkerQueueClass: z.ZodEnum<{
    default: "default";
    scheduled: "scheduled";
}>;
export type WorkerQueueClass = z.infer<typeof WorkerQueueClass>;
export declare const WorkerApiDequeueRequestBody: z.ZodObject<{
    maxResources: z.ZodOptional<z.ZodObject<{
        cpu: z.ZodNumber;
        memory: z.ZodNumber;
    }, z.core.$strip>>;
    maxRunCount: z.ZodOptional<z.ZodNumber>;
    queueClass: z.ZodOptional<z.ZodEnum<{
        default: "default";
        scheduled: "scheduled";
    }>>;
}, z.core.$strip>;
export type WorkerApiDequeueRequestBody = z.infer<typeof WorkerApiDequeueRequestBody>;
export declare const WorkerApiDequeueResponseBody: z.ZodArray<z.ZodObject<{
    version: z.ZodLiteral<"1">;
    snapshot: z.ZodObject<{
        id: z.ZodString;
        friendlyId: z.ZodString;
        executionStatus: z.ZodEnum<{
            DELAYED: "DELAYED";
            EXECUTING: "EXECUTING";
            EXECUTING_WITH_WAITPOINTS: "EXECUTING_WITH_WAITPOINTS";
            FINISHED: "FINISHED";
            PENDING_CANCEL: "PENDING_CANCEL";
            PENDING_EXECUTING: "PENDING_EXECUTING";
            QUEUED: "QUEUED";
            QUEUED_EXECUTING: "QUEUED_EXECUTING";
            RUN_CREATED: "RUN_CREATED";
            SUSPENDED: "SUSPENDED";
        }>;
        description: z.ZodString;
        createdAt: z.ZodCoercedDate<unknown>;
    }, z.core.$strip>;
    snapshotRoute: z.ZodOptional<z.ZodObject<{
        version: z.ZodLiteral<1>;
        residency: z.ZodEnum<{
            mirrored: "mirrored";
            postgres: "postgres";
            "redis-primary": "redis-primary";
        }>;
        organizationId: z.ZodString;
    }, z.core.$strip>>;
    dequeuedAt: z.ZodCoercedDate<unknown>;
    workerQueueLength: z.ZodOptional<z.ZodNumber>;
    image: z.ZodOptional<z.ZodString>;
    checkpoint: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<{
            COMPUTE: "COMPUTE";
            DOCKER: "DOCKER";
            KUBERNETES: "KUBERNETES";
        }>;
        location: z.ZodString;
        imageRef: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
    completedWaitpoints: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        index: z.ZodOptional<z.ZodNumber>;
        friendlyId: z.ZodString;
        type: z.ZodEnum<{
            BATCH: "BATCH";
            DATETIME: "DATETIME";
            MANUAL: "MANUAL";
            RUN: "RUN";
        }>;
        completedAt: z.ZodCoercedDate<unknown>;
        idempotencyKey: z.ZodOptional<z.ZodString>;
        completedByTaskRun: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            friendlyId: z.ZodString;
            batch: z.ZodOptional<z.ZodObject<{
                id: z.ZodString;
                friendlyId: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        completedAfter: z.ZodOptional<z.ZodCoercedDate<unknown>>;
        completedByBatch: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            friendlyId: z.ZodString;
        }, z.core.$strip>>;
        output: z.ZodOptional<z.ZodString>;
        outputType: z.ZodOptional<z.ZodString>;
        outputIsError: z.ZodBoolean;
    }, z.core.$strip>>;
    backgroundWorker: z.ZodObject<{
        id: z.ZodString;
        friendlyId: z.ZodString;
        version: z.ZodString;
        runtime: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    deployment: z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        friendlyId: z.ZodOptional<z.ZodString>;
        imagePlatform: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    run: z.ZodObject<{
        id: z.ZodString;
        friendlyId: z.ZodString;
        isTest: z.ZodBoolean;
        isReplay: z.ZodDefault<z.ZodBoolean>;
        machine: z.ZodObject<{
            name: z.ZodEnum<{
                "large-1x": "large-1x";
                "large-2x": "large-2x";
                "medium-1x": "medium-1x";
                "medium-2x": "medium-2x";
                micro: "micro";
                "small-1x": "small-1x";
                "small-2x": "small-2x";
            }>;
            cpu: z.ZodNumber;
            memory: z.ZodNumber;
            centsPerMs: z.ZodNumber;
        }, z.core.$strip>;
        attemptNumber: z.ZodNumber;
        masterQueue: z.ZodString;
        traceContext: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        annotations: z.ZodOptional<z.ZodObject<{
            triggerSource: z.ZodUnion<[z.ZodEnum<{
                api: "api";
                cli: "cli";
                dashboard: "dashboard";
                mcp: "mcp";
                schedule: "schedule";
                sdk: "sdk";
            }>, z.ZodCustom<string & {}, string & {}>]>;
            triggerAction: z.ZodUnion<[z.ZodEnum<{
                replay: "replay";
                test: "test";
                trigger: "trigger";
            }>, z.ZodCustom<string & {}, string & {}>]>;
            rootTriggerSource: z.ZodUnion<[z.ZodEnum<{
                api: "api";
                cli: "cli";
                dashboard: "dashboard";
                mcp: "mcp";
                schedule: "schedule";
                sdk: "sdk";
            }>, z.ZodCustom<string & {}, string & {}>]>;
            rootScheduleId: z.ZodOptional<z.ZodString>;
            taskKind: z.ZodOptional<z.ZodUnion<[z.ZodEnum<{
                AGENT: "AGENT";
                SCHEDULED: "SCHEDULED";
                STANDARD: "STANDARD";
            }>, z.ZodCustom<string & {}, string & {}>]>>;
            externalDeploymentId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    environment: z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<{
            DEVELOPMENT: "DEVELOPMENT";
            PREVIEW: "PREVIEW";
            PRODUCTION: "PRODUCTION";
            STAGING: "STAGING";
        }>;
    }, z.core.$strip>;
    organization: z.ZodObject<{
        id: z.ZodString;
        hasPrivateLink: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>;
    project: z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>;
    placementTags: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        values: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>;
}, z.core.$strip>>;
export type WorkerApiDequeueResponseBody = z.infer<typeof WorkerApiDequeueResponseBody>;
export declare const WorkerApiRunHeartbeatRequestBody: z.ZodObject<{
    cpu: z.ZodOptional<z.ZodNumber>;
    memory: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type WorkerApiRunHeartbeatRequestBody = z.infer<typeof WorkerApiRunHeartbeatRequestBody>;
export declare const WorkerApiRunHeartbeatResponseBody: z.ZodObject<{
    ok: z.ZodLiteral<true>;
}, z.core.$strip>;
export type WorkerApiRunHeartbeatResponseBody = z.infer<typeof WorkerApiRunHeartbeatResponseBody>;
export declare const WorkerApiRunAttemptStartRequestBody: z.ZodObject<{
    isWarmStart: z.ZodOptional<z.ZodBoolean>;
    snapshotRoute: z.ZodOptional<z.ZodPipe<z.ZodUnknown, z.ZodTransform<{
        version: 1;
        residency: "mirrored" | "postgres" | "redis-primary";
        organizationId: string;
    } | undefined, unknown>>>;
}, z.core.$strip>;
export type WorkerApiRunAttemptStartRequestBody = z.infer<typeof WorkerApiRunAttemptStartRequestBody>;
export declare const WorkerApiRunAttemptStartResponseBody: z.ZodIntersection<z.ZodIntersection<z.ZodObject<{
    snapshot: z.ZodObject<{
        id: z.ZodString;
        friendlyId: z.ZodString;
        executionStatus: z.ZodEnum<{
            DELAYED: "DELAYED";
            EXECUTING: "EXECUTING";
            EXECUTING_WITH_WAITPOINTS: "EXECUTING_WITH_WAITPOINTS";
            FINISHED: "FINISHED";
            PENDING_CANCEL: "PENDING_CANCEL";
            PENDING_EXECUTING: "PENDING_EXECUTING";
            QUEUED: "QUEUED";
            QUEUED_EXECUTING: "QUEUED_EXECUTING";
            RUN_CREATED: "RUN_CREATED";
            SUSPENDED: "SUSPENDED";
        }>;
        description: z.ZodString;
        createdAt: z.ZodCoercedDate<unknown>;
    }, z.core.$strip>;
    run: z.ZodObject<{
        id: z.ZodString;
        friendlyId: z.ZodString;
        status: z.ZodEnum<{
            CANCELED: "CANCELED";
            COMPLETED_SUCCESSFULLY: "COMPLETED_SUCCESSFULLY";
            COMPLETED_WITH_ERRORS: "COMPLETED_WITH_ERRORS";
            CRASHED: "CRASHED";
            DELAYED: "DELAYED";
            DEQUEUED: "DEQUEUED";
            EXECUTING: "EXECUTING";
            EXPIRED: "EXPIRED";
            INTERRUPTED: "INTERRUPTED";
            PAUSED: "PAUSED";
            PENDING: "PENDING";
            PENDING_VERSION: "PENDING_VERSION";
            RETRYING_AFTER_FAILURE: "RETRYING_AFTER_FAILURE";
            SYSTEM_FAILURE: "SYSTEM_FAILURE";
            TIMED_OUT: "TIMED_OUT";
            WAITING_FOR_DEPLOY: "WAITING_FOR_DEPLOY";
            WAITING_TO_RESUME: "WAITING_TO_RESUME";
        }>;
        attemptNumber: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        taskEventStore: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    execution: z.ZodObject<{
        task: z.ZodObject<{
            id: z.ZodString;
            filePath: z.ZodString;
        }, z.core.$loose>;
        queue: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
        }, z.core.$strip>;
        environment: z.ZodObject<{
            id: z.ZodString;
            slug: z.ZodString;
            type: z.ZodEnum<{
                DEVELOPMENT: "DEVELOPMENT";
                PREVIEW: "PREVIEW";
                PRODUCTION: "PRODUCTION";
                STAGING: "STAGING";
            }>;
            branchName: z.ZodOptional<z.ZodString>;
            git: z.ZodOptional<z.ZodObject<{
                provider: z.ZodOptional<z.ZodString>;
                source: z.ZodOptional<z.ZodEnum<{
                    github_actions: "github_actions";
                    local: "local";
                    trigger_github_app: "trigger_github_app";
                }>>;
                ghUsername: z.ZodOptional<z.ZodString>;
                ghUserAvatarUrl: z.ZodOptional<z.ZodString>;
                commitAuthorName: z.ZodOptional<z.ZodString>;
                commitMessage: z.ZodOptional<z.ZodString>;
                commitRef: z.ZodOptional<z.ZodString>;
                commitSha: z.ZodOptional<z.ZodString>;
                dirty: z.ZodOptional<z.ZodBoolean>;
                remoteUrl: z.ZodOptional<z.ZodString>;
                pullRequestNumber: z.ZodOptional<z.ZodNumber>;
                pullRequestTitle: z.ZodOptional<z.ZodString>;
                pullRequestState: z.ZodOptional<z.ZodEnum<{
                    closed: "closed";
                    merged: "merged";
                    open: "open";
                }>>;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        organization: z.ZodObject<{
            id: z.ZodString;
            slug: z.ZodString;
            name: z.ZodString;
        }, z.core.$strip>;
        project: z.ZodObject<{
            id: z.ZodString;
            ref: z.ZodString;
            slug: z.ZodString;
            name: z.ZodString;
        }, z.core.$strip>;
        machine: z.ZodObject<{
            name: z.ZodEnum<{
                "large-1x": "large-1x";
                "large-2x": "large-2x";
                "medium-1x": "medium-1x";
                "medium-2x": "medium-2x";
                micro: "micro";
                "small-1x": "small-1x";
                "small-2x": "small-2x";
            }>;
            cpu: z.ZodNumber;
            memory: z.ZodNumber;
            centsPerMs: z.ZodNumber;
        }, z.core.$strip>;
        batch: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
        }, z.core.$strip>>;
        deployment: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            shortCode: z.ZodString;
            version: z.ZodString;
            runtime: z.ZodString;
            runtimeVersion: z.ZodString;
            git: z.ZodOptional<z.ZodObject<{
                provider: z.ZodOptional<z.ZodString>;
                source: z.ZodOptional<z.ZodEnum<{
                    github_actions: "github_actions";
                    local: "local";
                    trigger_github_app: "trigger_github_app";
                }>>;
                ghUsername: z.ZodOptional<z.ZodString>;
                ghUserAvatarUrl: z.ZodOptional<z.ZodString>;
                commitAuthorName: z.ZodOptional<z.ZodString>;
                commitMessage: z.ZodOptional<z.ZodString>;
                commitRef: z.ZodOptional<z.ZodString>;
                commitSha: z.ZodOptional<z.ZodString>;
                dirty: z.ZodOptional<z.ZodBoolean>;
                remoteUrl: z.ZodOptional<z.ZodString>;
                pullRequestNumber: z.ZodOptional<z.ZodNumber>;
                pullRequestTitle: z.ZodOptional<z.ZodString>;
                pullRequestState: z.ZodOptional<z.ZodEnum<{
                    closed: "closed";
                    merged: "merged";
                    open: "open";
                }>>;
            }, z.core.$strip>>;
            externalId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        attempt: z.ZodObject<{
            number: z.ZodNumber;
            startedAt: z.ZodCoercedDate<unknown>;
        }, z.core.$loose>;
        run: z.ZodIntersection<z.ZodObject<{
            id: z.ZodString;
            payload: z.ZodString;
            payloadType: z.ZodString;
            tags: z.ZodArray<z.ZodString>;
            isTest: z.ZodDefault<z.ZodBoolean>;
            isReplay: z.ZodDefault<z.ZodBoolean>;
            createdAt: z.ZodCoercedDate<unknown>;
            startedAt: z.ZodDefault<z.ZodCoercedDate<unknown>>;
            idempotencyKey: z.ZodOptional<z.ZodString>;
            idempotencyKeyScope: z.ZodOptional<z.ZodEnum<{
                attempt: "attempt";
                global: "global";
                run: "run";
            }>>;
            maxAttempts: z.ZodOptional<z.ZodNumber>;
            version: z.ZodOptional<z.ZodString>;
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../../index.js").DeserializedJson, unknown>>>>;
            maxDuration: z.ZodOptional<z.ZodNumber>;
            priority: z.ZodOptional<z.ZodNumber>;
            baseCostInCents: z.ZodOptional<z.ZodNumber>;
            parentTaskRunId: z.ZodOptional<z.ZodString>;
            rootTaskRunId: z.ZodOptional<z.ZodString>;
            durationMs: z.ZodOptional<z.ZodNumber>;
            costInCents: z.ZodOptional<z.ZodNumber>;
            region: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>, z.ZodObject<{
            traceContext: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            realtimeStreamsVersion: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>>, z.ZodObject<{
    envVars: z.ZodRecord<z.ZodString, z.ZodString>;
}, z.core.$strip>>;
export type WorkerApiRunAttemptStartResponseBody = z.infer<typeof WorkerApiRunAttemptStartResponseBody>;
export declare const WorkerApiRunAttemptCompleteRequestBody: z.ZodObject<{
    completion: import("../../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
        ok: z.ZodLiteral<true>;
        id: z.ZodString;
        output: z.ZodOptional<z.ZodString>;
        outputType: z.ZodString;
        usage: z.ZodOptional<z.ZodObject<{
            durationMs: z.ZodNumber;
        }, z.core.$strip>>;
        taskIdentifier: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodObject<{
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../../index.js").DeserializedJson, unknown>>>>;
            operations: z.ZodOptional<z.ZodArray<import("../../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                type: z.ZodLiteral<"update">;
                value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"set">;
                key: z.ZodString;
                value: z.ZodType<import("../../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../../index.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"delete">;
                key: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"append">;
                key: z.ZodString;
                value: z.ZodType<import("../../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../../index.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"remove">;
                key: z.ZodString;
                value: z.ZodType<import("../../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../../index.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"increment">;
                key: z.ZodString;
                value: z.ZodNumber;
            }, z.core.$strip>]>>>;
            parentOperations: z.ZodOptional<z.ZodArray<import("../../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                type: z.ZodLiteral<"update">;
                value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"set">;
                key: z.ZodString;
                value: z.ZodType<import("../../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../../index.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"delete">;
                key: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"append">;
                key: z.ZodString;
                value: z.ZodType<import("../../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../../index.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"remove">;
                key: z.ZodString;
                value: z.ZodType<import("../../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../../index.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"increment">;
                key: z.ZodString;
                value: z.ZodNumber;
            }, z.core.$strip>]>>>;
            rootOperations: z.ZodOptional<z.ZodArray<import("../../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                type: z.ZodLiteral<"update">;
                value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"set">;
                key: z.ZodString;
                value: z.ZodType<import("../../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../../index.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"delete">;
                key: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"append">;
                key: z.ZodString;
                value: z.ZodType<import("../../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../../index.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"remove">;
                key: z.ZodString;
                value: z.ZodType<import("../../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../../index.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"increment">;
                key: z.ZodString;
                value: z.ZodNumber;
            }, z.core.$strip>]>>>;
        }, z.core.$strip>>;
        flushedMetadata: z.ZodOptional<z.ZodObject<{
            data: z.ZodOptional<z.ZodString>;
            dataType: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        ok: z.ZodLiteral<false>;
        id: z.ZodString;
        error: import("../../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
            type: z.ZodLiteral<"BUILT_IN_ERROR">;
            name: z.ZodString;
            message: z.ZodString;
            stackTrace: z.ZodString;
            causes: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodOptional<z.ZodString>;
                message: z.ZodString;
                stackTrace: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"CUSTOM_ERROR">;
            raw: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"STRING_ERROR">;
            raw: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"INTERNAL_ERROR">;
            code: z.ZodEnum<{
                BATCH_ITEM_COULD_NOT_TRIGGER: "BATCH_ITEM_COULD_NOT_TRIGGER";
                CONFIGURED_INCORRECTLY: "CONFIGURED_INCORRECTLY";
                COULD_NOT_FIND_EXECUTOR: "COULD_NOT_FIND_EXECUTOR";
                COULD_NOT_FIND_TASK: "COULD_NOT_FIND_TASK";
                COULD_NOT_IMPORT_TASK: "COULD_NOT_IMPORT_TASK";
                DISK_SPACE_EXCEEDED: "DISK_SPACE_EXCEEDED";
                GRACEFUL_EXIT_TIMEOUT: "GRACEFUL_EXIT_TIMEOUT";
                HANDLE_ERROR_ERROR: "HANDLE_ERROR_ERROR";
                MAX_DURATION_EXCEEDED: "MAX_DURATION_EXCEEDED";
                OUTDATED_SDK_VERSION: "OUTDATED_SDK_VERSION";
                PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE";
                POD_EVICTED: "POD_EVICTED";
                POD_UNKNOWN_ERROR: "POD_UNKNOWN_ERROR";
                RECURSIVE_WAIT_DEADLOCK: "RECURSIVE_WAIT_DEADLOCK";
                TASK_ALREADY_RUNNING: "TASK_ALREADY_RUNNING";
                TASK_DEQUEUED_INVALID_STATE: "TASK_DEQUEUED_INVALID_STATE";
                TASK_DEQUEUED_QUEUE_NOT_FOUND: "TASK_DEQUEUED_QUEUE_NOT_FOUND";
                TASK_DID_CONCURRENT_WAIT: "TASK_DID_CONCURRENT_WAIT";
                TASK_EXECUTION_ABORTED: "TASK_EXECUTION_ABORTED";
                TASK_EXECUTION_FAILED: "TASK_EXECUTION_FAILED";
                TASK_HAS_N0_EXECUTION_SNAPSHOT: "TASK_HAS_N0_EXECUTION_SNAPSHOT";
                TASK_INPUT_ERROR: "TASK_INPUT_ERROR";
                TASK_MIDDLEWARE_ERROR: "TASK_MIDDLEWARE_ERROR";
                TASK_OUTPUT_ERROR: "TASK_OUTPUT_ERROR";
                TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE: "TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE";
                TASK_PROCESS_MAYBE_OOM_KILLED: "TASK_PROCESS_MAYBE_OOM_KILLED";
                TASK_PROCESS_OOM_KILLED: "TASK_PROCESS_OOM_KILLED";
                TASK_PROCESS_SIGKILL_TIMEOUT: "TASK_PROCESS_SIGKILL_TIMEOUT";
                TASK_PROCESS_SIGSEGV: "TASK_PROCESS_SIGSEGV";
                TASK_PROCESS_SIGTERM: "TASK_PROCESS_SIGTERM";
                TASK_RUN_CANCELLED: "TASK_RUN_CANCELLED";
                TASK_RUN_CRASHED: "TASK_RUN_CRASHED";
                TASK_RUN_DEQUEUED_MAX_RETRIES: "TASK_RUN_DEQUEUED_MAX_RETRIES";
                TASK_RUN_HEARTBEAT_TIMEOUT: "TASK_RUN_HEARTBEAT_TIMEOUT";
                TASK_RUN_STALLED_EXECUTING: "TASK_RUN_STALLED_EXECUTING";
                TASK_RUN_STALLED_EXECUTING_WITH_WAITPOINTS: "TASK_RUN_STALLED_EXECUTING_WITH_WAITPOINTS";
                TASK_RUN_UNCAUGHT_EXCEPTION: "TASK_RUN_UNCAUGHT_EXCEPTION";
                UNSPECIFIED_ERROR: "UNSPECIFIED_ERROR";
            }>;
            message: z.ZodOptional<z.ZodString>;
            stackTrace: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        retry: z.ZodOptional<z.ZodObject<{
            timestamp: z.ZodNumber;
            delay: z.ZodNumber;
            error: z.ZodOptional<z.ZodUnknown>;
        }, z.core.$strip>>;
        skippedRetrying: z.ZodOptional<z.ZodBoolean>;
        usage: z.ZodOptional<z.ZodObject<{
            durationMs: z.ZodNumber;
        }, z.core.$strip>>;
        taskIdentifier: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodObject<{
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../../index.js").DeserializedJson, unknown>>>>;
            operations: z.ZodOptional<z.ZodArray<import("../../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                type: z.ZodLiteral<"update">;
                value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"set">;
                key: z.ZodString;
                value: z.ZodType<import("../../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../../index.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"delete">;
                key: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"append">;
                key: z.ZodString;
                value: z.ZodType<import("../../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../../index.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"remove">;
                key: z.ZodString;
                value: z.ZodType<import("../../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../../index.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"increment">;
                key: z.ZodString;
                value: z.ZodNumber;
            }, z.core.$strip>]>>>;
            parentOperations: z.ZodOptional<z.ZodArray<import("../../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                type: z.ZodLiteral<"update">;
                value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"set">;
                key: z.ZodString;
                value: z.ZodType<import("../../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../../index.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"delete">;
                key: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"append">;
                key: z.ZodString;
                value: z.ZodType<import("../../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../../index.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"remove">;
                key: z.ZodString;
                value: z.ZodType<import("../../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../../index.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"increment">;
                key: z.ZodString;
                value: z.ZodNumber;
            }, z.core.$strip>]>>>;
            rootOperations: z.ZodOptional<z.ZodArray<import("../../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                type: z.ZodLiteral<"update">;
                value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"set">;
                key: z.ZodString;
                value: z.ZodType<import("../../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../../index.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"delete">;
                key: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"append">;
                key: z.ZodString;
                value: z.ZodType<import("../../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../../index.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"remove">;
                key: z.ZodString;
                value: z.ZodType<import("../../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../../index.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"increment">;
                key: z.ZodString;
                value: z.ZodNumber;
            }, z.core.$strip>]>>>;
        }, z.core.$strip>>;
        flushedMetadata: z.ZodOptional<z.ZodObject<{
            data: z.ZodOptional<z.ZodString>;
            dataType: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>]>;
    snapshotRoute: z.ZodOptional<z.ZodPipe<z.ZodUnknown, z.ZodTransform<{
        version: 1;
        residency: "mirrored" | "postgres" | "redis-primary";
        organizationId: string;
    } | undefined, unknown>>>;
}, z.core.$strip>;
export type WorkerApiRunAttemptCompleteRequestBody = z.infer<typeof WorkerApiRunAttemptCompleteRequestBody>;
export declare const WorkerApiRunAttemptCompleteResponseBody: z.ZodObject<{
    result: z.ZodIntersection<z.ZodObject<{
        attemptStatus: z.ZodEnum<{
            RETRY_IMMEDIATELY: "RETRY_IMMEDIATELY";
            RETRY_QUEUED: "RETRY_QUEUED";
            RUN_FINISHED: "RUN_FINISHED";
            RUN_PENDING_CANCEL: "RUN_PENDING_CANCEL";
        }>;
    }, z.core.$strip>, z.ZodObject<{
        snapshot: z.ZodObject<{
            id: z.ZodString;
            friendlyId: z.ZodString;
            executionStatus: z.ZodEnum<{
                DELAYED: "DELAYED";
                EXECUTING: "EXECUTING";
                EXECUTING_WITH_WAITPOINTS: "EXECUTING_WITH_WAITPOINTS";
                FINISHED: "FINISHED";
                PENDING_CANCEL: "PENDING_CANCEL";
                PENDING_EXECUTING: "PENDING_EXECUTING";
                QUEUED: "QUEUED";
                QUEUED_EXECUTING: "QUEUED_EXECUTING";
                RUN_CREATED: "RUN_CREATED";
                SUSPENDED: "SUSPENDED";
            }>;
            description: z.ZodString;
            createdAt: z.ZodCoercedDate<unknown>;
        }, z.core.$strip>;
        run: z.ZodObject<{
            id: z.ZodString;
            friendlyId: z.ZodString;
            status: z.ZodEnum<{
                CANCELED: "CANCELED";
                COMPLETED_SUCCESSFULLY: "COMPLETED_SUCCESSFULLY";
                COMPLETED_WITH_ERRORS: "COMPLETED_WITH_ERRORS";
                CRASHED: "CRASHED";
                DELAYED: "DELAYED";
                DEQUEUED: "DEQUEUED";
                EXECUTING: "EXECUTING";
                EXPIRED: "EXPIRED";
                INTERRUPTED: "INTERRUPTED";
                PAUSED: "PAUSED";
                PENDING: "PENDING";
                PENDING_VERSION: "PENDING_VERSION";
                RETRYING_AFTER_FAILURE: "RETRYING_AFTER_FAILURE";
                SYSTEM_FAILURE: "SYSTEM_FAILURE";
                TIMED_OUT: "TIMED_OUT";
                WAITING_FOR_DEPLOY: "WAITING_FOR_DEPLOY";
                WAITING_TO_RESUME: "WAITING_TO_RESUME";
            }>;
            attemptNumber: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            taskEventStore: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type WorkerApiRunAttemptCompleteResponseBody = z.infer<typeof WorkerApiRunAttemptCompleteResponseBody>;
export declare const WorkerApiRunLatestSnapshotResponseBody: z.ZodObject<{
    execution: z.ZodObject<{
        version: z.ZodLiteral<"1">;
        snapshot: z.ZodObject<{
            id: z.ZodString;
            friendlyId: z.ZodString;
            executionStatus: z.ZodEnum<{
                DELAYED: "DELAYED";
                EXECUTING: "EXECUTING";
                EXECUTING_WITH_WAITPOINTS: "EXECUTING_WITH_WAITPOINTS";
                FINISHED: "FINISHED";
                PENDING_CANCEL: "PENDING_CANCEL";
                PENDING_EXECUTING: "PENDING_EXECUTING";
                QUEUED: "QUEUED";
                QUEUED_EXECUTING: "QUEUED_EXECUTING";
                RUN_CREATED: "RUN_CREATED";
                SUSPENDED: "SUSPENDED";
            }>;
            description: z.ZodString;
            createdAt: z.ZodCoercedDate<unknown>;
        }, z.core.$strip>;
        run: z.ZodObject<{
            id: z.ZodString;
            friendlyId: z.ZodString;
            status: z.ZodEnum<{
                CANCELED: "CANCELED";
                COMPLETED_SUCCESSFULLY: "COMPLETED_SUCCESSFULLY";
                COMPLETED_WITH_ERRORS: "COMPLETED_WITH_ERRORS";
                CRASHED: "CRASHED";
                DELAYED: "DELAYED";
                DEQUEUED: "DEQUEUED";
                EXECUTING: "EXECUTING";
                EXPIRED: "EXPIRED";
                INTERRUPTED: "INTERRUPTED";
                PAUSED: "PAUSED";
                PENDING: "PENDING";
                PENDING_VERSION: "PENDING_VERSION";
                RETRYING_AFTER_FAILURE: "RETRYING_AFTER_FAILURE";
                SYSTEM_FAILURE: "SYSTEM_FAILURE";
                TIMED_OUT: "TIMED_OUT";
                WAITING_FOR_DEPLOY: "WAITING_FOR_DEPLOY";
                WAITING_TO_RESUME: "WAITING_TO_RESUME";
            }>;
            attemptNumber: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            taskEventStore: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        batch: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            friendlyId: z.ZodString;
        }, z.core.$strip>>;
        checkpoint: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<{
                COMPUTE: "COMPUTE";
                DOCKER: "DOCKER";
                KUBERNETES: "KUBERNETES";
            }>;
            location: z.ZodString;
            imageRef: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            id: z.ZodString;
            friendlyId: z.ZodString;
        }, z.core.$strip>>;
        completedWaitpoints: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            index: z.ZodOptional<z.ZodNumber>;
            friendlyId: z.ZodString;
            type: z.ZodEnum<{
                BATCH: "BATCH";
                DATETIME: "DATETIME";
                MANUAL: "MANUAL";
                RUN: "RUN";
            }>;
            completedAt: z.ZodCoercedDate<unknown>;
            idempotencyKey: z.ZodOptional<z.ZodString>;
            completedByTaskRun: z.ZodOptional<z.ZodObject<{
                id: z.ZodString;
                friendlyId: z.ZodString;
                batch: z.ZodOptional<z.ZodObject<{
                    id: z.ZodString;
                    friendlyId: z.ZodString;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            completedAfter: z.ZodOptional<z.ZodCoercedDate<unknown>>;
            completedByBatch: z.ZodOptional<z.ZodObject<{
                id: z.ZodString;
                friendlyId: z.ZodString;
            }, z.core.$strip>>;
            output: z.ZodOptional<z.ZodString>;
            outputType: z.ZodOptional<z.ZodString>;
            outputIsError: z.ZodBoolean;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type WorkerApiRunLatestSnapshotResponseBody = z.infer<typeof WorkerApiRunLatestSnapshotResponseBody>;
export declare const DebugLogPropertiesValue: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodOptional<z.ZodNullable<z.ZodString>>>, z.ZodArray<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>, z.ZodArray<z.ZodOptional<z.ZodNullable<z.ZodBoolean>>>]>;
export declare const DebugLogProperties: z.ZodRecord<z.ZodString, z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodOptional<z.ZodNullable<z.ZodString>>>, z.ZodArray<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>, z.ZodArray<z.ZodOptional<z.ZodNullable<z.ZodBoolean>>>]>>>;
export type DebugLogProperties = z.infer<typeof DebugLogProperties>;
export declare const DebugLogPropertiesInput: z.ZodRecord<z.ZodString, z.ZodUnknown>;
export type DebugLogPropertiesInput = z.infer<typeof DebugLogPropertiesInput>;
export declare const WorkerApiDebugLogBodyInput: z.ZodObject<{
    time: z.ZodCoercedDate<unknown>;
    message: z.ZodString;
    properties: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type WorkerApiDebugLogBodyInput = z.infer<typeof WorkerApiDebugLogBodyInput>;
export declare const WorkerApiDebugLogBody: z.ZodObject<{
    time: z.ZodCoercedDate<unknown>;
    message: z.ZodString;
    properties: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodOptional<z.ZodNullable<z.ZodString>>>, z.ZodArray<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>, z.ZodArray<z.ZodOptional<z.ZodNullable<z.ZodBoolean>>>]>>>>;
}, z.core.$strip>;
export type WorkerApiDebugLogBody = z.infer<typeof WorkerApiDebugLogBody>;
export declare const WorkerApiSuspendCompletionResponseBody: z.ZodObject<{
    success: z.ZodBoolean;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type WorkerApiSuspendCompletionResponseBody = z.infer<typeof WorkerApiSuspendCompletionResponseBody>;
export declare const WorkerApiRunSnapshotsSinceResponseBody: z.ZodObject<{
    snapshots: z.ZodArray<z.ZodObject<{
        version: z.ZodLiteral<"1">;
        snapshot: z.ZodObject<{
            id: z.ZodString;
            friendlyId: z.ZodString;
            executionStatus: z.ZodEnum<{
                DELAYED: "DELAYED";
                EXECUTING: "EXECUTING";
                EXECUTING_WITH_WAITPOINTS: "EXECUTING_WITH_WAITPOINTS";
                FINISHED: "FINISHED";
                PENDING_CANCEL: "PENDING_CANCEL";
                PENDING_EXECUTING: "PENDING_EXECUTING";
                QUEUED: "QUEUED";
                QUEUED_EXECUTING: "QUEUED_EXECUTING";
                RUN_CREATED: "RUN_CREATED";
                SUSPENDED: "SUSPENDED";
            }>;
            description: z.ZodString;
            createdAt: z.ZodCoercedDate<unknown>;
        }, z.core.$strip>;
        run: z.ZodObject<{
            id: z.ZodString;
            friendlyId: z.ZodString;
            status: z.ZodEnum<{
                CANCELED: "CANCELED";
                COMPLETED_SUCCESSFULLY: "COMPLETED_SUCCESSFULLY";
                COMPLETED_WITH_ERRORS: "COMPLETED_WITH_ERRORS";
                CRASHED: "CRASHED";
                DELAYED: "DELAYED";
                DEQUEUED: "DEQUEUED";
                EXECUTING: "EXECUTING";
                EXPIRED: "EXPIRED";
                INTERRUPTED: "INTERRUPTED";
                PAUSED: "PAUSED";
                PENDING: "PENDING";
                PENDING_VERSION: "PENDING_VERSION";
                RETRYING_AFTER_FAILURE: "RETRYING_AFTER_FAILURE";
                SYSTEM_FAILURE: "SYSTEM_FAILURE";
                TIMED_OUT: "TIMED_OUT";
                WAITING_FOR_DEPLOY: "WAITING_FOR_DEPLOY";
                WAITING_TO_RESUME: "WAITING_TO_RESUME";
            }>;
            attemptNumber: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            taskEventStore: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        batch: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            friendlyId: z.ZodString;
        }, z.core.$strip>>;
        checkpoint: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<{
                COMPUTE: "COMPUTE";
                DOCKER: "DOCKER";
                KUBERNETES: "KUBERNETES";
            }>;
            location: z.ZodString;
            imageRef: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            id: z.ZodString;
            friendlyId: z.ZodString;
        }, z.core.$strip>>;
        completedWaitpoints: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            index: z.ZodOptional<z.ZodNumber>;
            friendlyId: z.ZodString;
            type: z.ZodEnum<{
                BATCH: "BATCH";
                DATETIME: "DATETIME";
                MANUAL: "MANUAL";
                RUN: "RUN";
            }>;
            completedAt: z.ZodCoercedDate<unknown>;
            idempotencyKey: z.ZodOptional<z.ZodString>;
            completedByTaskRun: z.ZodOptional<z.ZodObject<{
                id: z.ZodString;
                friendlyId: z.ZodString;
                batch: z.ZodOptional<z.ZodObject<{
                    id: z.ZodString;
                    friendlyId: z.ZodString;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            completedAfter: z.ZodOptional<z.ZodCoercedDate<unknown>>;
            completedByBatch: z.ZodOptional<z.ZodObject<{
                id: z.ZodString;
                friendlyId: z.ZodString;
            }, z.core.$strip>>;
            output: z.ZodOptional<z.ZodString>;
            outputType: z.ZodOptional<z.ZodString>;
            outputIsError: z.ZodBoolean;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type WorkerApiRunSnapshotsSinceResponseBody = z.infer<typeof WorkerApiRunSnapshotsSinceResponseBody>;
