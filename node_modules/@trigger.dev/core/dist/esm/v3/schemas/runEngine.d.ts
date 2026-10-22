import { z } from "zod/v4";
import type { RuntimeEnvironmentType } from "./common.js";
import { SnapshotRouteWire } from "./snapshotRoute.js";
export declare const TriggerSource: z.ZodUnion<[z.ZodEnum<{
    api: "api";
    cli: "cli";
    dashboard: "dashboard";
    mcp: "mcp";
    schedule: "schedule";
    sdk: "sdk";
}>, z.ZodCustom<string & {}, string & {}>]>;
export type TriggerSource = z.infer<typeof TriggerSource>;
export declare const TriggerAction: z.ZodUnion<[z.ZodEnum<{
    replay: "replay";
    test: "test";
    trigger: "trigger";
}>, z.ZodCustom<string & {}, string & {}>]>;
export type TriggerAction = z.infer<typeof TriggerAction>;
export declare const TaskKind: z.ZodUnion<[z.ZodEnum<{
    AGENT: "AGENT";
    SCHEDULED: "SCHEDULED";
    STANDARD: "STANDARD";
}>, z.ZodCustom<string & {}, string & {}>]>;
export type TaskKind = z.infer<typeof TaskKind>;
export declare const RunAnnotations: z.ZodObject<{
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
}, z.core.$strip>;
export type RunAnnotations = z.infer<typeof RunAnnotations>;
export declare const TaskRunExecutionStatus: {
    RUN_CREATED: "RUN_CREATED";
    QUEUED: "QUEUED";
    QUEUED_EXECUTING: "QUEUED_EXECUTING";
    PENDING_EXECUTING: "PENDING_EXECUTING";
    EXECUTING: "EXECUTING";
    EXECUTING_WITH_WAITPOINTS: "EXECUTING_WITH_WAITPOINTS";
    SUSPENDED: "SUSPENDED";
    PENDING_CANCEL: "PENDING_CANCEL";
    FINISHED: "FINISHED";
    DELAYED: "DELAYED";
};
export type TaskRunExecutionStatus = (typeof TaskRunExecutionStatus)[keyof typeof TaskRunExecutionStatus];
export declare const TaskRunStatus: {
    DELAYED: "DELAYED";
    PENDING: "PENDING";
    PENDING_VERSION: "PENDING_VERSION";
    WAITING_FOR_DEPLOY: "WAITING_FOR_DEPLOY";
    DEQUEUED: "DEQUEUED";
    EXECUTING: "EXECUTING";
    WAITING_TO_RESUME: "WAITING_TO_RESUME";
    RETRYING_AFTER_FAILURE: "RETRYING_AFTER_FAILURE";
    PAUSED: "PAUSED";
    CANCELED: "CANCELED";
    INTERRUPTED: "INTERRUPTED";
    COMPLETED_SUCCESSFULLY: "COMPLETED_SUCCESSFULLY";
    COMPLETED_WITH_ERRORS: "COMPLETED_WITH_ERRORS";
    SYSTEM_FAILURE: "SYSTEM_FAILURE";
    CRASHED: "CRASHED";
    EXPIRED: "EXPIRED";
    TIMED_OUT: "TIMED_OUT";
};
export type TaskRunStatus = (typeof TaskRunStatus)[keyof typeof TaskRunStatus];
export declare const WaitpointType: {
    RUN: "RUN";
    DATETIME: "DATETIME";
    MANUAL: "MANUAL";
    BATCH: "BATCH";
};
export type WaitpointType = (typeof WaitpointType)[keyof typeof WaitpointType];
export declare const WaitpointStatus: z.ZodEnum<{
    COMPLETED: "COMPLETED";
    PENDING: "PENDING";
}>;
export type WaitpointStatus = z.infer<typeof WaitpointStatus>;
export type TaskEventEnvironment = {
    id: string;
    type: RuntimeEnvironmentType;
    organizationId: string;
    projectId: string;
    project: {
        externalRef: string;
    };
};
export declare const CompletedWaitpoint: z.ZodObject<{
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
}, z.core.$strip>;
export type CompletedWaitpoint = z.infer<typeof CompletedWaitpoint>;
export declare const ExecutionResult: z.ZodObject<{
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
export type ExecutionResult = z.infer<typeof ExecutionResult>;
/** The response to the Worker when starting an attempt */
export declare const StartRunAttemptResult: z.ZodIntersection<z.ZodObject<{
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
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../index.js").DeserializedJson, unknown>>>>;
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
}, z.core.$strip>>;
export type StartRunAttemptResult = z.infer<typeof StartRunAttemptResult>;
/** The response to the Worker when completing an attempt */
declare const CompleteAttemptStatus: z.ZodEnum<{
    RETRY_IMMEDIATELY: "RETRY_IMMEDIATELY";
    RETRY_QUEUED: "RETRY_QUEUED";
    RUN_FINISHED: "RUN_FINISHED";
    RUN_PENDING_CANCEL: "RUN_PENDING_CANCEL";
}>;
export type CompleteAttemptStatus = z.infer<typeof CompleteAttemptStatus>;
export declare const CompleteRunAttemptResult: z.ZodIntersection<z.ZodObject<{
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
export type CompleteRunAttemptResult = z.infer<typeof CompleteRunAttemptResult>;
export declare const CheckpointTypeEnum: {
    DOCKER: "DOCKER";
    KUBERNETES: "KUBERNETES";
    COMPUTE: "COMPUTE";
};
export type CheckpointTypeEnum = (typeof CheckpointTypeEnum)[keyof typeof CheckpointTypeEnum];
export declare const CheckpointType: z.ZodEnum<{
    COMPUTE: "COMPUTE";
    DOCKER: "DOCKER";
    KUBERNETES: "KUBERNETES";
}>;
export type CheckpointType = z.infer<typeof CheckpointType>;
export declare const CheckpointInput: z.ZodObject<{
    type: z.ZodEnum<{
        COMPUTE: "COMPUTE";
        DOCKER: "DOCKER";
        KUBERNETES: "KUBERNETES";
    }>;
    location: z.ZodString;
    imageRef: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type CheckpointInput = z.infer<typeof CheckpointInput>;
export declare const TaskRunCheckpoint: z.ZodObject<{
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
}, z.core.$strip>;
export type TaskRunCheckpoint = z.infer<typeof TaskRunCheckpoint>;
/** The response when a Worker asks for the latest execution state */
export declare const RunExecutionData: z.ZodObject<{
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
export type RunExecutionData = z.infer<typeof RunExecutionData>;
export declare const CreateCheckpointResult: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
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
    ok: z.ZodLiteral<true>;
    checkpoint: z.ZodObject<{
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
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    ok: z.ZodLiteral<false>;
    error: z.ZodString;
}, z.core.$strip>]>;
export type CreateCheckpointResult = z.infer<typeof CreateCheckpointResult>;
export declare const MachineResources: z.ZodObject<{
    cpu: z.ZodNumber;
    memory: z.ZodNumber;
}, z.core.$strip>;
export type MachineResources = z.infer<typeof MachineResources>;
export declare const DequeueMessageCheckpoint: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<{
        COMPUTE: "COMPUTE";
        DOCKER: "DOCKER";
        KUBERNETES: "KUBERNETES";
    }>;
    location: z.ZodString;
    imageRef: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type DequeueMessageCheckpoint = z.infer<typeof DequeueMessageCheckpoint>;
export declare const PlacementTag: z.ZodObject<{
    key: z.ZodString;
    values: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type PlacementTag = z.infer<typeof PlacementTag>;
/** This is sent to a Worker when a run is dequeued (a new run or continuing run) */
export { SnapshotRouteWire };
export declare const DequeuedMessage: z.ZodObject<{
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
}, z.core.$strip>;
export type DequeuedMessage = z.infer<typeof DequeuedMessage>;
