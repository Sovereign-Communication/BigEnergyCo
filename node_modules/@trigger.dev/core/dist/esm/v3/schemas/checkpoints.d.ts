import z from "zod/v4";
export declare const CheckpointServiceSuspendRequestBody: z.ZodObject<{
    type: z.ZodEnum<{
        COMPUTE: "COMPUTE";
        DOCKER: "DOCKER";
        KUBERNETES: "KUBERNETES";
    }>;
    runId: z.ZodString;
    snapshotId: z.ZodString;
    runnerId: z.ZodString;
    projectRef: z.ZodString;
    deploymentVersion: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CheckpointServiceSuspendRequestBody = z.infer<typeof CheckpointServiceSuspendRequestBody>;
export type CheckpointServiceSuspendRequestBodyInput = z.input<typeof CheckpointServiceSuspendRequestBody>;
export declare const CheckpointServiceSuspendResponseBody: z.ZodObject<{
    ok: z.ZodLiteral<true>;
}, z.core.$strip>;
export type CheckpointServiceSuspendResponseBody = z.infer<typeof CheckpointServiceSuspendResponseBody>;
export declare const CheckpointServiceRestoreRequestBody: z.ZodObject<{
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
    checkpoint: z.ZodNonOptional<z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<{
            COMPUTE: "COMPUTE";
            DOCKER: "DOCKER";
            KUBERNETES: "KUBERNETES";
        }>;
        location: z.ZodString;
        imageRef: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
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
export type CheckpointServiceRestoreRequestBody = z.infer<typeof CheckpointServiceRestoreRequestBody>;
export type CheckpointServiceRestoreRequestBodyInput = z.input<typeof CheckpointServiceRestoreRequestBody>;
