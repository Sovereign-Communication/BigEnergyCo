import { z } from "zod/v4";
import type { RequireKeys } from "../types/index.js";
export * from "./scheduleWindow.js";
export declare const EnvironmentType: z.ZodEnum<{
    DEVELOPMENT: "DEVELOPMENT";
    PREVIEW: "PREVIEW";
    PRODUCTION: "PRODUCTION";
    STAGING: "STAGING";
}>;
export type EnvironmentType = z.infer<typeof EnvironmentType>;
export declare const RunEngineVersionSchema: z.ZodEnum<{
    V1: "V1";
    V2: "V2";
}>;
export declare const TaskRunExecutionMetric: z.ZodObject<{
    name: z.ZodString;
    event: z.ZodString;
    timestamp: z.ZodNumber;
    duration: z.ZodNumber;
}, z.core.$strip>;
export type TaskRunExecutionMetric = z.infer<typeof TaskRunExecutionMetric>;
export declare const TaskRunExecutionMetrics: z.ZodArray<z.ZodObject<{
    name: z.ZodString;
    event: z.ZodString;
    timestamp: z.ZodNumber;
    duration: z.ZodNumber;
}, z.core.$strip>>;
export type TaskRunExecutionMetrics = z.infer<typeof TaskRunExecutionMetrics>;
export declare const TaskRunExecutionPayload: z.ZodObject<{
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
    traceContext: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    environment: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    metrics: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        event: z.ZodString;
        timestamp: z.ZodNumber;
        duration: z.ZodNumber;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type TaskRunExecutionPayload = z.infer<typeof TaskRunExecutionPayload>;
export declare const V3ProdTaskRunExecution: z.ZodObject<{
    task: z.ZodObject<{
        id: z.ZodString;
        filePath: z.ZodString;
        exportName: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    attempt: z.ZodObject<{
        number: z.ZodNumber;
        startedAt: z.ZodCoercedDate<unknown>;
        id: z.ZodString;
        backgroundWorkerId: z.ZodString;
        backgroundWorkerTaskId: z.ZodString;
        status: z.ZodString;
    }, z.core.$strip>;
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
        context: z.ZodUnknown;
        durationMs: z.ZodNumber;
        costInCents: z.ZodNumber;
        baseCostInCents: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        traceContext: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
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
    batch: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>>;
    worker: z.ZodObject<{
        id: z.ZodString;
        contentHash: z.ZodString;
        version: z.ZodString;
        type: z.ZodOptional<z.ZodEnum<{
            V1: "V1";
            V2: "V2";
        }>>;
    }, z.core.$strip>;
    machine: z.ZodDefault<z.ZodObject<{
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
    }, z.core.$strip>>;
}, z.core.$strip>;
export type V3ProdTaskRunExecution = z.infer<typeof V3ProdTaskRunExecution>;
export declare const V3ProdTaskRunExecutionPayload: z.ZodObject<{
    execution: z.ZodObject<{
        task: z.ZodObject<{
            id: z.ZodString;
            filePath: z.ZodString;
            exportName: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        attempt: z.ZodObject<{
            number: z.ZodNumber;
            startedAt: z.ZodCoercedDate<unknown>;
            id: z.ZodString;
            backgroundWorkerId: z.ZodString;
            backgroundWorkerTaskId: z.ZodString;
            status: z.ZodString;
        }, z.core.$strip>;
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
            context: z.ZodUnknown;
            durationMs: z.ZodNumber;
            costInCents: z.ZodNumber;
            baseCostInCents: z.ZodNumber;
        }, z.core.$strip>, z.ZodObject<{
            traceContext: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
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
        batch: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
        }, z.core.$strip>>;
        worker: z.ZodObject<{
            id: z.ZodString;
            contentHash: z.ZodString;
            version: z.ZodString;
            type: z.ZodOptional<z.ZodEnum<{
                V1: "V1";
                V2: "V2";
            }>>;
        }, z.core.$strip>;
        machine: z.ZodDefault<z.ZodObject<{
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
        }, z.core.$strip>>;
    }, z.core.$strip>;
    traceContext: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    environment: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    metrics: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        event: z.ZodString;
        timestamp: z.ZodNumber;
        duration: z.ZodNumber;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type V3ProdTaskRunExecutionPayload = z.infer<typeof V3ProdTaskRunExecutionPayload>;
export declare const FixedWindowRateLimit: z.ZodObject<{
    type: z.ZodLiteral<"fixed-window">;
    limit: z.ZodNumber;
    window: z.ZodUnion<readonly [z.ZodObject<{
        seconds: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        minutes: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        hours: z.ZodNumber;
    }, z.core.$strip>]>;
}, z.core.$strip>;
export declare const SlidingWindowRateLimit: z.ZodObject<{
    type: z.ZodLiteral<"sliding-window">;
    limit: z.ZodNumber;
    window: z.ZodUnion<readonly [z.ZodObject<{
        seconds: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        minutes: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        hours: z.ZodNumber;
    }, z.core.$strip>]>;
}, z.core.$strip>;
export declare const RateLimitOptions: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
    type: z.ZodLiteral<"fixed-window">;
    limit: z.ZodNumber;
    window: z.ZodUnion<readonly [z.ZodObject<{
        seconds: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        minutes: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        hours: z.ZodNumber;
    }, z.core.$strip>]>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"sliding-window">;
    limit: z.ZodNumber;
    window: z.ZodUnion<readonly [z.ZodObject<{
        seconds: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        minutes: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        hours: z.ZodNumber;
    }, z.core.$strip>]>;
}, z.core.$strip>]>;
export type RateLimitOptions = z.infer<typeof RateLimitOptions>;
export declare const RetryOptions: z.ZodObject<{
    maxAttempts: z.ZodOptional<z.ZodNumber>;
    factor: z.ZodOptional<z.ZodNumber>;
    minTimeoutInMs: z.ZodOptional<z.ZodNumber>;
    maxTimeoutInMs: z.ZodOptional<z.ZodNumber>;
    randomize: z.ZodOptional<z.ZodBoolean>;
    outOfMemory: z.ZodOptional<z.ZodObject<{
        machine: z.ZodOptional<z.ZodEnum<{
            "large-1x": "large-1x";
            "large-2x": "large-2x";
            "medium-1x": "medium-1x";
            "medium-2x": "medium-2x";
            micro: "micro";
            "small-1x": "small-1x";
            "small-2x": "small-2x";
        }>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type RetryOptions = z.infer<typeof RetryOptions>;
export declare const QueueManifest: z.ZodObject<{
    name: z.ZodString;
    concurrencyLimit: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
export type QueueManifest = z.infer<typeof QueueManifest>;
export declare const ScheduleMetadata: z.ZodObject<{
    cron: z.ZodString;
    timezone: z.ZodString;
    environments: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        DEVELOPMENT: "DEVELOPMENT";
        PREVIEW: "PREVIEW";
        PRODUCTION: "PRODUCTION";
        STAGING: "STAGING";
    }>>>;
    window: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const TaskMetadata: z.ZodObject<{
    id: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    queue: z.ZodOptional<z.ZodObject<{
        concurrencyLimit: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    retry: z.ZodOptional<z.ZodObject<{
        maxAttempts: z.ZodOptional<z.ZodNumber>;
        factor: z.ZodOptional<z.ZodNumber>;
        minTimeoutInMs: z.ZodOptional<z.ZodNumber>;
        maxTimeoutInMs: z.ZodOptional<z.ZodNumber>;
        randomize: z.ZodOptional<z.ZodBoolean>;
        outOfMemory: z.ZodOptional<z.ZodObject<{
            machine: z.ZodOptional<z.ZodEnum<{
                "large-1x": "large-1x";
                "large-2x": "large-2x";
                "medium-1x": "medium-1x";
                "medium-2x": "medium-2x";
                micro: "micro";
                "small-1x": "small-1x";
                "small-2x": "small-2x";
            }>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    machine: z.ZodOptional<z.ZodObject<{
        cpu: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<0.25>, z.ZodLiteral<0.5>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<4>]>>;
        memory: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<0.25>, z.ZodLiteral<0.5>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<4>, z.ZodLiteral<8>]>>;
        preset: z.ZodOptional<z.ZodEnum<{
            "large-1x": "large-1x";
            "large-2x": "large-2x";
            "medium-1x": "medium-1x";
            "medium-2x": "medium-2x";
            micro: "micro";
            "small-1x": "small-1x";
            "small-2x": "small-2x";
        }>>;
    }, z.core.$strip>>;
    triggerSource: z.ZodOptional<z.ZodString>;
    agentConfig: z.ZodOptional<z.ZodObject<{
        type: z.ZodString;
    }, z.core.$strip>>;
    schedule: z.ZodOptional<z.ZodObject<{
        cron: z.ZodString;
        timezone: z.ZodString;
        environments: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            DEVELOPMENT: "DEVELOPMENT";
            PREVIEW: "PREVIEW";
            PRODUCTION: "PRODUCTION";
            STAGING: "STAGING";
        }>>>;
        window: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    maxDuration: z.ZodOptional<z.ZodNumber>;
    ttl: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    payloadSchema: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
export type TaskMetadata = z.infer<typeof TaskMetadata>;
export declare const TaskFile: z.ZodObject<{
    entry: z.ZodString;
    out: z.ZodString;
}, z.core.$strip>;
export type TaskFile = z.infer<typeof TaskFile>;
export declare const TaskFileMetadata: z.ZodObject<{
    filePath: z.ZodString;
    exportName: z.ZodOptional<z.ZodString>;
    entryPoint: z.ZodString;
}, z.core.$strip>;
export type TaskFileMetadata = z.infer<typeof TaskFileMetadata>;
export declare const TaskManifest: z.ZodObject<{
    id: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    queue: z.ZodOptional<z.ZodObject<{
        concurrencyLimit: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    retry: z.ZodOptional<z.ZodObject<{
        maxAttempts: z.ZodOptional<z.ZodNumber>;
        factor: z.ZodOptional<z.ZodNumber>;
        minTimeoutInMs: z.ZodOptional<z.ZodNumber>;
        maxTimeoutInMs: z.ZodOptional<z.ZodNumber>;
        randomize: z.ZodOptional<z.ZodBoolean>;
        outOfMemory: z.ZodOptional<z.ZodObject<{
            machine: z.ZodOptional<z.ZodEnum<{
                "large-1x": "large-1x";
                "large-2x": "large-2x";
                "medium-1x": "medium-1x";
                "medium-2x": "medium-2x";
                micro: "micro";
                "small-1x": "small-1x";
                "small-2x": "small-2x";
            }>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    machine: z.ZodOptional<z.ZodObject<{
        cpu: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<0.25>, z.ZodLiteral<0.5>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<4>]>>;
        memory: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<0.25>, z.ZodLiteral<0.5>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<4>, z.ZodLiteral<8>]>>;
        preset: z.ZodOptional<z.ZodEnum<{
            "large-1x": "large-1x";
            "large-2x": "large-2x";
            "medium-1x": "medium-1x";
            "medium-2x": "medium-2x";
            micro: "micro";
            "small-1x": "small-1x";
            "small-2x": "small-2x";
        }>>;
    }, z.core.$strip>>;
    triggerSource: z.ZodOptional<z.ZodString>;
    agentConfig: z.ZodOptional<z.ZodObject<{
        type: z.ZodString;
    }, z.core.$strip>>;
    schedule: z.ZodOptional<z.ZodObject<{
        cron: z.ZodString;
        timezone: z.ZodString;
        environments: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            DEVELOPMENT: "DEVELOPMENT";
            PREVIEW: "PREVIEW";
            PRODUCTION: "PRODUCTION";
            STAGING: "STAGING";
        }>>>;
        window: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    maxDuration: z.ZodOptional<z.ZodNumber>;
    ttl: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    payloadSchema: z.ZodOptional<z.ZodUnknown>;
    filePath: z.ZodString;
    exportName: z.ZodOptional<z.ZodString>;
    entryPoint: z.ZodString;
}, z.core.$strip>;
export type TaskManifest = z.infer<typeof TaskManifest>;
export declare const PromptMetadata: z.ZodObject<{
    id: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    variableSchema: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
export type PromptMetadata = z.infer<typeof PromptMetadata>;
export declare const PromptManifest: z.ZodObject<{
    filePath: z.ZodString;
    exportName: z.ZodOptional<z.ZodString>;
    entryPoint: z.ZodString;
    id: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    variableSchema: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
export type PromptManifest = z.infer<typeof PromptManifest>;
export declare const SkillMetadata: z.ZodObject<{
    id: z.ZodString;
    sourcePath: z.ZodString;
}, z.core.$strip>;
export type SkillMetadata = z.infer<typeof SkillMetadata>;
export declare const SkillManifest: z.ZodObject<{
    filePath: z.ZodString;
    exportName: z.ZodOptional<z.ZodString>;
    entryPoint: z.ZodString;
    id: z.ZodString;
    sourcePath: z.ZodString;
}, z.core.$strip>;
export type SkillManifest = z.infer<typeof SkillManifest>;
export declare const WebhookMetadata: z.ZodObject<{
    id: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    source: z.ZodString;
    verifierArtifact: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
        kind: z.ZodLiteral<"config">;
        config: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
            scheme: z.ZodLiteral<"hmac">;
            algorithm: z.ZodEnum<{
                sha1: "sha1";
                sha256: "sha256";
            }>;
            encoding: z.ZodEnum<{
                base64: "base64";
                hex: "hex";
            }>;
            signatureHeader: z.ZodString;
            signature: z.ZodOptional<z.ZodObject<{
                itemSeparator: z.ZodOptional<z.ZodString>;
                fieldSeparator: z.ZodOptional<z.ZodString>;
                field: z.ZodOptional<z.ZodString>;
                trim: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            timestamp: z.ZodOptional<z.ZodObject<{
                source: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    from: z.ZodLiteral<"header">;
                    name: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"signatureField">;
                    field: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"body">;
                    path: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"url">;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"constant">;
                    value: z.ZodString;
                }, z.core.$strip>]>;
                unit: z.ZodOptional<z.ZodEnum<{
                    milliseconds: "milliseconds";
                    seconds: "seconds";
                }>>;
                toleranceSeconds: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            signingString: z.ZodUnion<readonly [z.ZodLiteral<"raw">, z.ZodObject<{
                template: z.ZodString;
                vars: z.ZodOptional<z.ZodRecord<z.ZodString, import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    from: z.ZodLiteral<"header">;
                    name: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"signatureField">;
                    field: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"body">;
                    path: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"url">;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"constant">;
                    value: z.ZodString;
                }, z.core.$strip>]>>>;
            }, z.core.$strip>]>;
            secret: z.ZodOptional<z.ZodObject<{
                encoding: z.ZodOptional<z.ZodEnum<{
                    base64: "base64";
                    utf8: "utf8";
                }>>;
                stripPrefix: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            idempotencyField: z.ZodOptional<z.ZodObject<{
                from: z.ZodEnum<{
                    body: "body";
                    header: "header";
                }>;
                name: z.ZodString;
            }, z.core.$strip>>;
            formPayload: z.ZodOptional<z.ZodObject<{
                field: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            scheme: z.ZodLiteral<"shared-secret">;
            placement: z.ZodEnum<{
                basic: "basic";
                bearer: "bearer";
                body: "body";
                header: "header";
            }>;
            fieldName: z.ZodOptional<z.ZodString>;
            idempotencyField: z.ZodOptional<z.ZodObject<{
                from: z.ZodEnum<{
                    body: "body";
                    header: "header";
                }>;
                name: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            scheme: z.ZodLiteral<"url-secret">;
            placement: z.ZodEnum<{
                path: "path";
                query: "query";
            }>;
            paramName: z.ZodString;
            idempotencyField: z.ZodOptional<z.ZodObject<{
                from: z.ZodEnum<{
                    body: "body";
                    header: "header";
                }>;
                name: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            scheme: z.ZodLiteral<"asymmetric">;
            algorithm: z.ZodEnum<{
                "ecdsa-p256": "ecdsa-p256";
                ed25519: "ed25519";
                "rsa-sha256": "rsa-sha256";
            }>;
            encoding: z.ZodEnum<{
                base64: "base64";
                hex: "hex";
            }>;
            signatureHeader: z.ZodString;
            signature: z.ZodOptional<z.ZodObject<{
                itemSeparator: z.ZodOptional<z.ZodString>;
                fieldSeparator: z.ZodOptional<z.ZodString>;
                field: z.ZodOptional<z.ZodString>;
                trim: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            timestamp: z.ZodOptional<z.ZodObject<{
                source: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    from: z.ZodLiteral<"header">;
                    name: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"signatureField">;
                    field: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"body">;
                    path: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"url">;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"constant">;
                    value: z.ZodString;
                }, z.core.$strip>]>;
                unit: z.ZodOptional<z.ZodEnum<{
                    milliseconds: "milliseconds";
                    seconds: "seconds";
                }>>;
                toleranceSeconds: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            signingString: z.ZodUnion<readonly [z.ZodLiteral<"raw">, z.ZodObject<{
                template: z.ZodString;
                vars: z.ZodOptional<z.ZodRecord<z.ZodString, import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    from: z.ZodLiteral<"header">;
                    name: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"signatureField">;
                    field: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"body">;
                    path: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"url">;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"constant">;
                    value: z.ZodString;
                }, z.core.$strip>]>>>;
            }, z.core.$strip>]>;
            publicKeyEncoding: z.ZodOptional<z.ZodEnum<{
                pem: "pem";
                "raw-base64": "raw-base64";
                "raw-hex": "raw-hex";
                "spki-der-base64": "spki-der-base64";
            }>>;
            idempotencyField: z.ZodOptional<z.ZodObject<{
                from: z.ZodEnum<{
                    body: "body";
                    header: "header";
                }>;
                name: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>]>;
        handshake: z.ZodOptional<z.ZodObject<{
            matchPath: z.ZodString;
            matchValue: z.ZodString;
            respondPath: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"preset">;
        preset: z.ZodString;
        config: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
            scheme: z.ZodLiteral<"hmac">;
            algorithm: z.ZodEnum<{
                sha1: "sha1";
                sha256: "sha256";
            }>;
            encoding: z.ZodEnum<{
                base64: "base64";
                hex: "hex";
            }>;
            signatureHeader: z.ZodString;
            signature: z.ZodOptional<z.ZodObject<{
                itemSeparator: z.ZodOptional<z.ZodString>;
                fieldSeparator: z.ZodOptional<z.ZodString>;
                field: z.ZodOptional<z.ZodString>;
                trim: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            timestamp: z.ZodOptional<z.ZodObject<{
                source: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    from: z.ZodLiteral<"header">;
                    name: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"signatureField">;
                    field: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"body">;
                    path: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"url">;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"constant">;
                    value: z.ZodString;
                }, z.core.$strip>]>;
                unit: z.ZodOptional<z.ZodEnum<{
                    milliseconds: "milliseconds";
                    seconds: "seconds";
                }>>;
                toleranceSeconds: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            signingString: z.ZodUnion<readonly [z.ZodLiteral<"raw">, z.ZodObject<{
                template: z.ZodString;
                vars: z.ZodOptional<z.ZodRecord<z.ZodString, import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    from: z.ZodLiteral<"header">;
                    name: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"signatureField">;
                    field: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"body">;
                    path: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"url">;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"constant">;
                    value: z.ZodString;
                }, z.core.$strip>]>>>;
            }, z.core.$strip>]>;
            secret: z.ZodOptional<z.ZodObject<{
                encoding: z.ZodOptional<z.ZodEnum<{
                    base64: "base64";
                    utf8: "utf8";
                }>>;
                stripPrefix: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            idempotencyField: z.ZodOptional<z.ZodObject<{
                from: z.ZodEnum<{
                    body: "body";
                    header: "header";
                }>;
                name: z.ZodString;
            }, z.core.$strip>>;
            formPayload: z.ZodOptional<z.ZodObject<{
                field: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            scheme: z.ZodLiteral<"shared-secret">;
            placement: z.ZodEnum<{
                basic: "basic";
                bearer: "bearer";
                body: "body";
                header: "header";
            }>;
            fieldName: z.ZodOptional<z.ZodString>;
            idempotencyField: z.ZodOptional<z.ZodObject<{
                from: z.ZodEnum<{
                    body: "body";
                    header: "header";
                }>;
                name: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            scheme: z.ZodLiteral<"url-secret">;
            placement: z.ZodEnum<{
                path: "path";
                query: "query";
            }>;
            paramName: z.ZodString;
            idempotencyField: z.ZodOptional<z.ZodObject<{
                from: z.ZodEnum<{
                    body: "body";
                    header: "header";
                }>;
                name: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            scheme: z.ZodLiteral<"asymmetric">;
            algorithm: z.ZodEnum<{
                "ecdsa-p256": "ecdsa-p256";
                ed25519: "ed25519";
                "rsa-sha256": "rsa-sha256";
            }>;
            encoding: z.ZodEnum<{
                base64: "base64";
                hex: "hex";
            }>;
            signatureHeader: z.ZodString;
            signature: z.ZodOptional<z.ZodObject<{
                itemSeparator: z.ZodOptional<z.ZodString>;
                fieldSeparator: z.ZodOptional<z.ZodString>;
                field: z.ZodOptional<z.ZodString>;
                trim: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            timestamp: z.ZodOptional<z.ZodObject<{
                source: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    from: z.ZodLiteral<"header">;
                    name: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"signatureField">;
                    field: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"body">;
                    path: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"url">;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"constant">;
                    value: z.ZodString;
                }, z.core.$strip>]>;
                unit: z.ZodOptional<z.ZodEnum<{
                    milliseconds: "milliseconds";
                    seconds: "seconds";
                }>>;
                toleranceSeconds: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            signingString: z.ZodUnion<readonly [z.ZodLiteral<"raw">, z.ZodObject<{
                template: z.ZodString;
                vars: z.ZodOptional<z.ZodRecord<z.ZodString, import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    from: z.ZodLiteral<"header">;
                    name: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"signatureField">;
                    field: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"body">;
                    path: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"url">;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"constant">;
                    value: z.ZodString;
                }, z.core.$strip>]>>>;
            }, z.core.$strip>]>;
            publicKeyEncoding: z.ZodOptional<z.ZodEnum<{
                pem: "pem";
                "raw-base64": "raw-base64";
                "raw-hex": "raw-hex";
                "spki-der-base64": "spki-der-base64";
            }>>;
            idempotencyField: z.ZodOptional<z.ZodObject<{
                from: z.ZodEnum<{
                    body: "body";
                    header: "header";
                }>;
                name: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>]>;
        handshake: z.ZodOptional<z.ZodObject<{
            matchPath: z.ZodString;
            matchValue: z.ZodString;
            respondPath: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"bundle">;
        bundleUrl: z.ZodString;
        hash: z.ZodString;
    }, z.core.$strip>]>;
    routingTarget: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
        type: z.ZodLiteral<"task">;
        taskId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"session">;
        taskIdentifier: z.ZodString;
        keyTemplate: z.ZodString;
        deliverAs: z.ZodEnum<{
            action: "action";
            message: "message";
        }>;
        actionType: z.ZodOptional<z.ZodString>;
        connectorId: z.ZodOptional<z.ZodString>;
        triggerConfigTemplate: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        startOn: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>;
    secretProvisioning: z.ZodOptional<z.ZodEnum<{
        either: "either";
        integrator: "integrator";
        provider: "provider";
    }>>;
    filter: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type WebhookMetadata = z.infer<typeof WebhookMetadata>;
export declare const WebhookManifest: z.ZodObject<{
    filePath: z.ZodString;
    exportName: z.ZodOptional<z.ZodString>;
    entryPoint: z.ZodString;
    id: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    source: z.ZodString;
    verifierArtifact: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
        kind: z.ZodLiteral<"config">;
        config: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
            scheme: z.ZodLiteral<"hmac">;
            algorithm: z.ZodEnum<{
                sha1: "sha1";
                sha256: "sha256";
            }>;
            encoding: z.ZodEnum<{
                base64: "base64";
                hex: "hex";
            }>;
            signatureHeader: z.ZodString;
            signature: z.ZodOptional<z.ZodObject<{
                itemSeparator: z.ZodOptional<z.ZodString>;
                fieldSeparator: z.ZodOptional<z.ZodString>;
                field: z.ZodOptional<z.ZodString>;
                trim: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            timestamp: z.ZodOptional<z.ZodObject<{
                source: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    from: z.ZodLiteral<"header">;
                    name: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"signatureField">;
                    field: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"body">;
                    path: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"url">;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"constant">;
                    value: z.ZodString;
                }, z.core.$strip>]>;
                unit: z.ZodOptional<z.ZodEnum<{
                    milliseconds: "milliseconds";
                    seconds: "seconds";
                }>>;
                toleranceSeconds: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            signingString: z.ZodUnion<readonly [z.ZodLiteral<"raw">, z.ZodObject<{
                template: z.ZodString;
                vars: z.ZodOptional<z.ZodRecord<z.ZodString, import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    from: z.ZodLiteral<"header">;
                    name: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"signatureField">;
                    field: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"body">;
                    path: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"url">;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"constant">;
                    value: z.ZodString;
                }, z.core.$strip>]>>>;
            }, z.core.$strip>]>;
            secret: z.ZodOptional<z.ZodObject<{
                encoding: z.ZodOptional<z.ZodEnum<{
                    base64: "base64";
                    utf8: "utf8";
                }>>;
                stripPrefix: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            idempotencyField: z.ZodOptional<z.ZodObject<{
                from: z.ZodEnum<{
                    body: "body";
                    header: "header";
                }>;
                name: z.ZodString;
            }, z.core.$strip>>;
            formPayload: z.ZodOptional<z.ZodObject<{
                field: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            scheme: z.ZodLiteral<"shared-secret">;
            placement: z.ZodEnum<{
                basic: "basic";
                bearer: "bearer";
                body: "body";
                header: "header";
            }>;
            fieldName: z.ZodOptional<z.ZodString>;
            idempotencyField: z.ZodOptional<z.ZodObject<{
                from: z.ZodEnum<{
                    body: "body";
                    header: "header";
                }>;
                name: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            scheme: z.ZodLiteral<"url-secret">;
            placement: z.ZodEnum<{
                path: "path";
                query: "query";
            }>;
            paramName: z.ZodString;
            idempotencyField: z.ZodOptional<z.ZodObject<{
                from: z.ZodEnum<{
                    body: "body";
                    header: "header";
                }>;
                name: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            scheme: z.ZodLiteral<"asymmetric">;
            algorithm: z.ZodEnum<{
                "ecdsa-p256": "ecdsa-p256";
                ed25519: "ed25519";
                "rsa-sha256": "rsa-sha256";
            }>;
            encoding: z.ZodEnum<{
                base64: "base64";
                hex: "hex";
            }>;
            signatureHeader: z.ZodString;
            signature: z.ZodOptional<z.ZodObject<{
                itemSeparator: z.ZodOptional<z.ZodString>;
                fieldSeparator: z.ZodOptional<z.ZodString>;
                field: z.ZodOptional<z.ZodString>;
                trim: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            timestamp: z.ZodOptional<z.ZodObject<{
                source: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    from: z.ZodLiteral<"header">;
                    name: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"signatureField">;
                    field: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"body">;
                    path: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"url">;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"constant">;
                    value: z.ZodString;
                }, z.core.$strip>]>;
                unit: z.ZodOptional<z.ZodEnum<{
                    milliseconds: "milliseconds";
                    seconds: "seconds";
                }>>;
                toleranceSeconds: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            signingString: z.ZodUnion<readonly [z.ZodLiteral<"raw">, z.ZodObject<{
                template: z.ZodString;
                vars: z.ZodOptional<z.ZodRecord<z.ZodString, import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    from: z.ZodLiteral<"header">;
                    name: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"signatureField">;
                    field: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"body">;
                    path: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"url">;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"constant">;
                    value: z.ZodString;
                }, z.core.$strip>]>>>;
            }, z.core.$strip>]>;
            publicKeyEncoding: z.ZodOptional<z.ZodEnum<{
                pem: "pem";
                "raw-base64": "raw-base64";
                "raw-hex": "raw-hex";
                "spki-der-base64": "spki-der-base64";
            }>>;
            idempotencyField: z.ZodOptional<z.ZodObject<{
                from: z.ZodEnum<{
                    body: "body";
                    header: "header";
                }>;
                name: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>]>;
        handshake: z.ZodOptional<z.ZodObject<{
            matchPath: z.ZodString;
            matchValue: z.ZodString;
            respondPath: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"preset">;
        preset: z.ZodString;
        config: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
            scheme: z.ZodLiteral<"hmac">;
            algorithm: z.ZodEnum<{
                sha1: "sha1";
                sha256: "sha256";
            }>;
            encoding: z.ZodEnum<{
                base64: "base64";
                hex: "hex";
            }>;
            signatureHeader: z.ZodString;
            signature: z.ZodOptional<z.ZodObject<{
                itemSeparator: z.ZodOptional<z.ZodString>;
                fieldSeparator: z.ZodOptional<z.ZodString>;
                field: z.ZodOptional<z.ZodString>;
                trim: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            timestamp: z.ZodOptional<z.ZodObject<{
                source: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    from: z.ZodLiteral<"header">;
                    name: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"signatureField">;
                    field: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"body">;
                    path: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"url">;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"constant">;
                    value: z.ZodString;
                }, z.core.$strip>]>;
                unit: z.ZodOptional<z.ZodEnum<{
                    milliseconds: "milliseconds";
                    seconds: "seconds";
                }>>;
                toleranceSeconds: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            signingString: z.ZodUnion<readonly [z.ZodLiteral<"raw">, z.ZodObject<{
                template: z.ZodString;
                vars: z.ZodOptional<z.ZodRecord<z.ZodString, import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    from: z.ZodLiteral<"header">;
                    name: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"signatureField">;
                    field: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"body">;
                    path: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"url">;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"constant">;
                    value: z.ZodString;
                }, z.core.$strip>]>>>;
            }, z.core.$strip>]>;
            secret: z.ZodOptional<z.ZodObject<{
                encoding: z.ZodOptional<z.ZodEnum<{
                    base64: "base64";
                    utf8: "utf8";
                }>>;
                stripPrefix: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            idempotencyField: z.ZodOptional<z.ZodObject<{
                from: z.ZodEnum<{
                    body: "body";
                    header: "header";
                }>;
                name: z.ZodString;
            }, z.core.$strip>>;
            formPayload: z.ZodOptional<z.ZodObject<{
                field: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            scheme: z.ZodLiteral<"shared-secret">;
            placement: z.ZodEnum<{
                basic: "basic";
                bearer: "bearer";
                body: "body";
                header: "header";
            }>;
            fieldName: z.ZodOptional<z.ZodString>;
            idempotencyField: z.ZodOptional<z.ZodObject<{
                from: z.ZodEnum<{
                    body: "body";
                    header: "header";
                }>;
                name: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            scheme: z.ZodLiteral<"url-secret">;
            placement: z.ZodEnum<{
                path: "path";
                query: "query";
            }>;
            paramName: z.ZodString;
            idempotencyField: z.ZodOptional<z.ZodObject<{
                from: z.ZodEnum<{
                    body: "body";
                    header: "header";
                }>;
                name: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            scheme: z.ZodLiteral<"asymmetric">;
            algorithm: z.ZodEnum<{
                "ecdsa-p256": "ecdsa-p256";
                ed25519: "ed25519";
                "rsa-sha256": "rsa-sha256";
            }>;
            encoding: z.ZodEnum<{
                base64: "base64";
                hex: "hex";
            }>;
            signatureHeader: z.ZodString;
            signature: z.ZodOptional<z.ZodObject<{
                itemSeparator: z.ZodOptional<z.ZodString>;
                fieldSeparator: z.ZodOptional<z.ZodString>;
                field: z.ZodOptional<z.ZodString>;
                trim: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            timestamp: z.ZodOptional<z.ZodObject<{
                source: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    from: z.ZodLiteral<"header">;
                    name: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"signatureField">;
                    field: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"body">;
                    path: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"url">;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"constant">;
                    value: z.ZodString;
                }, z.core.$strip>]>;
                unit: z.ZodOptional<z.ZodEnum<{
                    milliseconds: "milliseconds";
                    seconds: "seconds";
                }>>;
                toleranceSeconds: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            signingString: z.ZodUnion<readonly [z.ZodLiteral<"raw">, z.ZodObject<{
                template: z.ZodString;
                vars: z.ZodOptional<z.ZodRecord<z.ZodString, import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    from: z.ZodLiteral<"header">;
                    name: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"signatureField">;
                    field: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"body">;
                    path: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"url">;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"constant">;
                    value: z.ZodString;
                }, z.core.$strip>]>>>;
            }, z.core.$strip>]>;
            publicKeyEncoding: z.ZodOptional<z.ZodEnum<{
                pem: "pem";
                "raw-base64": "raw-base64";
                "raw-hex": "raw-hex";
                "spki-der-base64": "spki-der-base64";
            }>>;
            idempotencyField: z.ZodOptional<z.ZodObject<{
                from: z.ZodEnum<{
                    body: "body";
                    header: "header";
                }>;
                name: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>]>;
        handshake: z.ZodOptional<z.ZodObject<{
            matchPath: z.ZodString;
            matchValue: z.ZodString;
            respondPath: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"bundle">;
        bundleUrl: z.ZodString;
        hash: z.ZodString;
    }, z.core.$strip>]>;
    routingTarget: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
        type: z.ZodLiteral<"task">;
        taskId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"session">;
        taskIdentifier: z.ZodString;
        keyTemplate: z.ZodString;
        deliverAs: z.ZodEnum<{
            action: "action";
            message: "message";
        }>;
        actionType: z.ZodOptional<z.ZodString>;
        connectorId: z.ZodOptional<z.ZodString>;
        triggerConfigTemplate: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        startOn: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>;
    secretProvisioning: z.ZodOptional<z.ZodEnum<{
        either: "either";
        integrator: "integrator";
        provider: "provider";
    }>>;
    filter: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type WebhookManifest = z.infer<typeof WebhookManifest>;
export declare const PostStartCauses: z.ZodEnum<{
    create: "create";
    index: "index";
    restore: "restore";
}>;
export type PostStartCauses = z.infer<typeof PostStartCauses>;
export declare const PreStopCauses: z.ZodEnum<{
    terminate: "terminate";
}>;
export type PreStopCauses = z.infer<typeof PreStopCauses>;
export declare const Config: z.ZodObject<{
    project: z.ZodString;
    triggerDirectories: z.ZodOptional<z.ZodArray<z.ZodString>>;
    triggerUrl: z.ZodOptional<z.ZodString>;
    projectDir: z.ZodOptional<z.ZodString>;
    tsconfigPath: z.ZodOptional<z.ZodString>;
    retries: z.ZodOptional<z.ZodObject<{
        enabledInDev: z.ZodDefault<z.ZodBoolean>;
        default: z.ZodOptional<z.ZodObject<{
            maxAttempts: z.ZodOptional<z.ZodNumber>;
            factor: z.ZodOptional<z.ZodNumber>;
            minTimeoutInMs: z.ZodOptional<z.ZodNumber>;
            maxTimeoutInMs: z.ZodOptional<z.ZodNumber>;
            randomize: z.ZodOptional<z.ZodBoolean>;
            outOfMemory: z.ZodOptional<z.ZodObject<{
                machine: z.ZodOptional<z.ZodEnum<{
                    "large-1x": "large-1x";
                    "large-2x": "large-2x";
                    "medium-1x": "medium-1x";
                    "medium-2x": "medium-2x";
                    micro: "micro";
                    "small-1x": "small-1x";
                    "small-2x": "small-2x";
                }>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    additionalPackages: z.ZodOptional<z.ZodArray<z.ZodString>>;
    additionalFiles: z.ZodOptional<z.ZodArray<z.ZodString>>;
    dependenciesToBundle: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodCustom<RegExp, RegExp>]>>>;
    logLevel: z.ZodOptional<z.ZodString>;
    enableConsoleLogging: z.ZodOptional<z.ZodBoolean>;
    postInstall: z.ZodOptional<z.ZodString>;
    extraCACerts: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type Config = z.infer<typeof Config>;
export type ResolvedConfig = RequireKeys<Config, "triggerDirectories" | "triggerUrl" | "projectDir" | "tsconfigPath">;
export declare const WaitReason: z.ZodEnum<{
    WAIT_FOR_BATCH: "WAIT_FOR_BATCH";
    WAIT_FOR_DURATION: "WAIT_FOR_DURATION";
    WAIT_FOR_TASK: "WAIT_FOR_TASK";
}>;
export type WaitReason = z.infer<typeof WaitReason>;
export declare const TaskRunExecutionLazyAttemptPayload: z.ZodObject<{
    runId: z.ZodString;
    attemptCount: z.ZodOptional<z.ZodNumber>;
    messageId: z.ZodString;
    isTest: z.ZodBoolean;
    isReplay: z.ZodDefault<z.ZodBoolean>;
    traceContext: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    environment: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    metrics: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        event: z.ZodString;
        timestamp: z.ZodNumber;
        duration: z.ZodNumber;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type TaskRunExecutionLazyAttemptPayload = z.infer<typeof TaskRunExecutionLazyAttemptPayload>;
export declare const ManualCheckpointMetadata: z.ZodObject<{
    attemptId: z.ZodString;
    previousRunStatus: z.ZodString;
    previousAttemptStatus: z.ZodString;
}, z.core.$strip>;
export type ManualCheckpointMetadata = z.infer<typeof ManualCheckpointMetadata>;
export declare const RunChainState: z.ZodObject<{
    concurrency: z.ZodOptional<z.ZodObject<{
        queues: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            holding: z.ZodNumber;
        }, z.core.$strip>>;
        environment: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type RunChainState = z.infer<typeof RunChainState>;
export declare const TriggerTraceContext: z.ZodObject<{
    traceparent: z.ZodOptional<z.ZodString>;
    tracestate: z.ZodOptional<z.ZodString>;
    external: z.ZodOptional<z.ZodObject<{
        traceparent: z.ZodOptional<z.ZodString>;
        tracestate: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type TriggerTraceContext = z.infer<typeof TriggerTraceContext>;
