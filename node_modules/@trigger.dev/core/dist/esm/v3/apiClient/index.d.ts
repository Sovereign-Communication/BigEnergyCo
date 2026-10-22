import { z } from "zod/v4";
import type { ApiClientConfiguration } from "../apiClientManager-api.js";
import { type AddTagsRequestBody, type ApiDeploymentListOptions, type BatchItemNDJSON, type BatchTriggerTaskV3RequestBody, type CloseSessionRequestBody, type CompleteWaitpointTokenRequestBody, type CreateBatchRequestBody, type CreateEnvironmentVariableRequestBody, type CreateInputStreamWaitpointRequestBody, type CreatePromptOverrideRequestBody, type CreateScheduleOptions, type CreateSessionRequestBody, type CreateSessionStreamWaitpointRequestBody, type CreateWaitpointTokenRequestBody, type EndAndContinueSessionRequestBody, type ListQueueOptions, type ListScheduleOptions, type ListSessionsOptions, type PromotePromptVersionRequestBody, type ReactivatePromptOverrideRequestBody, type RescheduleRunRequestBody, type ResolvePromptRequestBody, type RetrieveQueueParam, type TriggerTaskRequestBody, type UpdateEnvironmentVariableRequestBody, type UpdateMetadataRequestBody, type UpdatePromptOverrideRequestBody, type UpdateScheduleOptions, type UpdateSessionRequestBody, type WaitForDurationRequestBody, BulkActionObject, BatchTaskRunExecutionResult, CreateBatchResponse, CreateWaitpointTokenResponseBody, ListDashboardsResponseBody, ListRunResponseItem, ListedSessionItem, QueryExecuteResponseBody, QuerySchemaResponseBody, type ReportViewModel, StreamBatchItemsResponse, TaskRunExecutionResult, WaitpointTokenItem } from "../schemas/index.js";
import { type ControlEvent } from "../sessionStreams/wireProtocol.js";
import type { AsyncIterableStream } from "../streams/asyncIterableStream.js";
import type { AnyRunTypes, TriggerJwtOptions } from "../types/tasks.js";
import type { Prettify } from "../types/utils.js";
import { type AnyZodFetchOptions, type ApiPromise, type ApiRequestOptions, type CursorPagePromise, type ZodFetchOptions, isRequestOptions } from "./core.js";
import { type RefreshAccessTokenFn } from "./refreshAccessToken.js";
import { type AnyRealtimeRun, type AnyRunShape, type RealtimeRun, type RealtimeRunSkipColumns, type RunShape, type RunStreamCallback, type RunSubscription, type TaskRunShape, SSEStreamSubscription, type SSEStreamPart, STREAM_START_HEADER } from "./runStream.js";
import type { CreateBulkActionOptions, CreateEnvironmentVariableParams, ImportEnvironmentVariablesParams, ListBulkActionsQueryParams, ListProjectRunsQueryParams, ListRunsQueryParams, ListWaitpointTokensQueryParams, SubscribeToRunsQueryParams, UpdateEnvironmentVariableParams } from "./types.js";
export type CreateWaitpointTokenResponse = Prettify<CreateWaitpointTokenResponseBody & {
    publicAccessToken: string;
}>;
export type CreateBatchApiResponse = Prettify<CreateBatchResponse & {
    publicAccessToken: string;
}>;
export type { CreateBulkActionOptions, CreateEnvironmentVariableParams, ImportEnvironmentVariablesParams, RealtimeRunSkipColumns, ListBulkActionsQueryParams, SubscribeToRunsQueryParams, UpdateEnvironmentVariableParams, };
export type ClientTriggerOptions = {
    spanParentAsLink?: boolean;
};
export type ClientBatchTriggerOptions = ClientTriggerOptions & {
    processingStrategy?: "parallel" | "sequential";
};
export type TriggerRequestOptions = ZodFetchOptions & {
    publicAccessToken?: TriggerJwtOptions;
};
export type TriggerApiRequestOptions = ApiRequestOptions & {
    publicAccessToken?: TriggerJwtOptions;
    clientConfig?: ApiClientConfiguration;
};
export type ApiClientFutureFlags = {
    v2RealtimeStreams?: boolean;
};
export { SSEStreamSubscription, STREAM_START_HEADER, isRequestOptions };
export type { AnyRealtimeRun, AnyRunShape, ApiRequestOptions, ControlEvent, RealtimeRun, RunShape, RunStreamCallback, RunSubscription, SSEStreamPart, TaskRunShape, };
export * from "./getBranch.js";
export { encodeTaskIdForPath } from "./encodeTaskIdForPath.js";
export type CreatePublicTokenRequestBody = {
    scopes: string[];
    expirationTime?: string | number;
    oneTimeUse?: boolean;
    realtime?: {
        skipColumns?: string[];
    };
};
/**
 * Trigger.dev v3 API client
 */
export declare class ApiClient {
    #private;
    readonly baseUrl: string;
    readonly accessToken: string;
    readonly previewBranch?: string;
    readonly futureFlags: ApiClientFutureFlags;
    private readonly additionalHeaders?;
    private readonly defaultRequestOptions;
    private readonly refreshAccessToken?;
    constructor(baseUrl: string, accessToken: string, previewBranch?: string, requestOptions?: ApiRequestOptions, futureFlags?: ApiClientFutureFlags, refreshAccessToken?: RefreshAccessTokenFn);
    get fetchClient(): typeof fetch;
    getHeaders(): Record<string, string>;
    getRunResult(runId: string, requestOptions?: ZodFetchOptions): Promise<TaskRunExecutionResult | undefined>;
    getBatchResults(batchId: string, requestOptions?: ZodFetchOptions): Promise<BatchTaskRunExecutionResult | undefined>;
    triggerTask(taskId: string, body: TriggerTaskRequestBody, clientOptions?: ClientTriggerOptions, requestOptions?: TriggerRequestOptions): Promise<{
        id: string;
        isCached?: boolean | undefined;
        publicAccessToken: string;
    }>;
    batchTriggerV3(body: BatchTriggerTaskV3RequestBody, clientOptions?: ClientBatchTriggerOptions, requestOptions?: TriggerRequestOptions): Promise<{
        id: string;
        runCount: number;
        publicAccessToken: string;
    }>;
    /**
     * Phase 1 of 2-phase batch API: Create a batch
     *
     * Creates a new batch and returns its ID. For batchTriggerAndWait,
     * the parent run is blocked immediately on batch creation.
     *
     * @param body - The batch creation parameters
     * @param clientOptions - Options for trace context handling
     * @param clientOptions.spanParentAsLink - If true, child runs will have separate trace IDs with a link to parent
     * @param requestOptions - Optional request options
     * @returns The created batch with ID and metadata
     */
    createBatch(body: CreateBatchRequestBody, clientOptions?: ClientTriggerOptions, requestOptions?: TriggerRequestOptions): Promise<{
        id: string;
        runCount: number;
        isCached: boolean;
        idempotencyKey?: string | undefined;
        publicAccessToken: string;
    }>;
    /**
     * Phase 2 of 2-phase batch API: Stream batch items
     *
     * Streams batch items as NDJSON to the server. Each item is enqueued
     * as it arrives. The batch is automatically sealed when the stream completes.
     *
     * Includes automatic retry with exponential backoff. Since items are deduplicated
     * by index on the server, retrying the entire stream is safe.
     *
     * Uses ReadableStream.tee() for retry capability without buffering all items
     * upfront - only items consumed before a failure are buffered for retry.
     *
     * @param batchId - The batch ID from createBatch
     * @param items - Array or async iterable of batch items
     * @param requestOptions - Optional request options
     * @returns Summary of items accepted and deduplicated
     */
    streamBatchItems(batchId: string, items: BatchItemNDJSON[] | AsyncIterable<BatchItemNDJSON>, requestOptions?: ApiRequestOptions): Promise<StreamBatchItemsResponse>;
    createUploadPayloadUrl(filename: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        presignedUrl: string;
        storagePath?: string | undefined;
    }>;
    getPayloadUrl(filename: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        presignedUrl: string;
        storagePath?: string | undefined;
    }>;
    /**
     * Presigned GET URL for a run's stored payload or output, authorized against the run.
     * Falls back to the legacy packet route on servers that predate this endpoint.
     */
    getRunPacketUrl(runId: string, field: "payload" | "output", path: string, requestOptions?: ZodFetchOptions): Promise<{
        presignedUrl: string;
        storagePath?: string | undefined;
    }>;
    /** Presigned PUT URL for a `chat.agent` session snapshot. */
    createChatSnapshotUploadUrl(sessionId: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        presignedUrl: string;
        storagePath?: string | undefined;
    }>;
    /** Presigned GET URL for a `chat.agent` session snapshot. */
    getChatSnapshotUrl(sessionId: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        presignedUrl: string;
        storagePath?: string | undefined;
    }>;
    /**
     * One page of a `chat.agent` session's persisted transcript, most recent
     * messages first when `limit` is set. Secret key only.
     */
    getSessionTranscript(sessionId: string, options?: {
        limit?: number;
        before?: string;
    }, requestOptions?: ZodFetchOptions): ApiPromise<{
        messages: unknown[];
        cursors?: {
            lastOutEventId?: string | undefined;
            lastInEventId?: string | undefined;
        } | undefined;
        nextCursor?: string | undefined;
    }>;
    retrieveRun(runId: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
        status: "CANCELED" | "COMPLETED" | "CRASHED" | "DELAYED" | "DEQUEUED" | "EXECUTING" | "EXPIRED" | "FAILED" | "PENDING_VERSION" | "QUEUED" | "SYSTEM_FAILURE" | "TIMED_OUT" | "WAITING";
        taskIdentifier: string;
        idempotencyKey?: string | undefined;
        version?: string | undefined;
        isQueued: boolean;
        isExecuting: boolean;
        isWaiting: boolean;
        isCompleted: boolean;
        isSuccess: boolean;
        isFailed: boolean;
        isCancelled: boolean;
        isTest: boolean;
        createdAt: Date;
        updatedAt: Date;
        startedAt?: Date | undefined;
        finishedAt?: Date | undefined;
        delayedUntil?: Date | undefined;
        ttl?: string | undefined;
        expiredAt?: Date | undefined;
        tags: string[];
        costInCents: number;
        baseCostInCents: number;
        durationMs: number;
        metadata?: Record<string, any> | undefined;
        taskKind?: string | undefined;
        region?: string | undefined;
        depth: number;
        triggerFunction: "batchTrigger" | "batchTriggerAndWait" | "trigger" | "triggerAndWait";
        batchId?: string | undefined;
        payload?: any;
        payloadPresignedUrl?: string | undefined;
        output?: any;
        outputPresignedUrl?: string | undefined;
        error?: {
            message: string;
            name?: string | undefined;
            stackTrace?: string | undefined;
            causes?: {
                name?: string | undefined;
                message: string;
                stackTrace?: string | undefined;
            }[] | undefined;
        } | undefined;
        schedule?: {
            id: string;
            externalId?: string | undefined;
            deduplicationKey?: string | undefined;
            generator: {
                type: "CRON";
                expression: string;
                description: string;
            };
        } | undefined;
        relatedRuns: {
            root?: {
                id: string;
                status: "CANCELED" | "COMPLETED" | "CRASHED" | "DELAYED" | "DEQUEUED" | "EXECUTING" | "EXPIRED" | "FAILED" | "PENDING_VERSION" | "QUEUED" | "SYSTEM_FAILURE" | "TIMED_OUT" | "WAITING";
                taskIdentifier: string;
                idempotencyKey?: string | undefined;
                version?: string | undefined;
                isQueued: boolean;
                isExecuting: boolean;
                isWaiting: boolean;
                isCompleted: boolean;
                isSuccess: boolean;
                isFailed: boolean;
                isCancelled: boolean;
                isTest: boolean;
                createdAt: Date;
                updatedAt: Date;
                startedAt?: Date | undefined;
                finishedAt?: Date | undefined;
                delayedUntil?: Date | undefined;
                ttl?: string | undefined;
                expiredAt?: Date | undefined;
                tags: string[];
                costInCents: number;
                baseCostInCents: number;
                durationMs: number;
                metadata?: Record<string, any> | undefined;
                taskKind?: string | undefined;
                region?: string | undefined;
                depth: number;
                triggerFunction: "batchTrigger" | "batchTriggerAndWait" | "trigger" | "triggerAndWait";
                batchId?: string | undefined;
            } | undefined;
            parent?: {
                id: string;
                status: "CANCELED" | "COMPLETED" | "CRASHED" | "DELAYED" | "DEQUEUED" | "EXECUTING" | "EXPIRED" | "FAILED" | "PENDING_VERSION" | "QUEUED" | "SYSTEM_FAILURE" | "TIMED_OUT" | "WAITING";
                taskIdentifier: string;
                idempotencyKey?: string | undefined;
                version?: string | undefined;
                isQueued: boolean;
                isExecuting: boolean;
                isWaiting: boolean;
                isCompleted: boolean;
                isSuccess: boolean;
                isFailed: boolean;
                isCancelled: boolean;
                isTest: boolean;
                createdAt: Date;
                updatedAt: Date;
                startedAt?: Date | undefined;
                finishedAt?: Date | undefined;
                delayedUntil?: Date | undefined;
                ttl?: string | undefined;
                expiredAt?: Date | undefined;
                tags: string[];
                costInCents: number;
                baseCostInCents: number;
                durationMs: number;
                metadata?: Record<string, any> | undefined;
                taskKind?: string | undefined;
                region?: string | undefined;
                depth: number;
                triggerFunction: "batchTrigger" | "batchTriggerAndWait" | "trigger" | "triggerAndWait";
                batchId?: string | undefined;
            } | undefined;
            children?: {
                id: string;
                status: "CANCELED" | "COMPLETED" | "CRASHED" | "DELAYED" | "DEQUEUED" | "EXECUTING" | "EXPIRED" | "FAILED" | "PENDING_VERSION" | "QUEUED" | "SYSTEM_FAILURE" | "TIMED_OUT" | "WAITING";
                taskIdentifier: string;
                idempotencyKey?: string | undefined;
                version?: string | undefined;
                isQueued: boolean;
                isExecuting: boolean;
                isWaiting: boolean;
                isCompleted: boolean;
                isSuccess: boolean;
                isFailed: boolean;
                isCancelled: boolean;
                isTest: boolean;
                createdAt: Date;
                updatedAt: Date;
                startedAt?: Date | undefined;
                finishedAt?: Date | undefined;
                delayedUntil?: Date | undefined;
                ttl?: string | undefined;
                expiredAt?: Date | undefined;
                tags: string[];
                costInCents: number;
                baseCostInCents: number;
                durationMs: number;
                metadata?: Record<string, any> | undefined;
                taskKind?: string | undefined;
                region?: string | undefined;
                depth: number;
                triggerFunction: "batchTrigger" | "batchTriggerAndWait" | "trigger" | "triggerAndWait";
                batchId?: string | undefined;
            }[] | undefined;
        };
        attemptCount: number;
    }>;
    retrieveRunTrace(runId: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        trace: {
            traceId: string;
            rootSpan: import("../schemas/api.js").RetrieveRunTraceSpan;
        };
    }>;
    retrieveSpan(runId: string, spanId: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        spanId: string;
        parentId: string | null;
        runId: string;
        message: string;
        isError: boolean;
        isPartial: boolean;
        isCancelled: boolean;
        level: string;
        startTime: Date;
        durationMs: number;
        properties?: Record<string, any> | undefined;
        events?: any[] | undefined;
        entityType?: string | undefined;
        ai?: {
            model: string;
            provider: string;
            operationName: string;
            inputTokens: number;
            outputTokens: number;
            totalTokens: number;
            cachedTokens?: number | undefined;
            reasoningTokens?: number | undefined;
            inputCost?: number | undefined;
            outputCost?: number | undefined;
            totalCost?: number | undefined;
            cachedCost?: number | undefined;
            cacheCreationCost?: number | undefined;
            tokensPerSecond?: number | undefined;
            msToFirstChunk?: number | undefined;
            durationMs: number;
            finishReason?: string | undefined;
            responseText?: string | undefined;
        } | undefined;
        triggeredRuns?: {
            runId: string;
            taskIdentifier: string;
            status: string;
            createdAt: Date;
        }[] | undefined;
    }>;
    listRuns(query?: ListRunsQueryParams, requestOptions?: ZodFetchOptions): CursorPagePromise<typeof ListRunResponseItem>;
    listProjectRuns(projectRef: string, query?: ListProjectRunsQueryParams, requestOptions?: ZodFetchOptions): CursorPagePromise<typeof ListRunResponseItem>;
    replayRun(runId: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
    }>;
    cancelRun(runId: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
    }>;
    createBulkAction(options: CreateBulkActionOptions, requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
    }>;
    listBulkActions(query?: ListBulkActionsQueryParams, requestOptions?: ZodFetchOptions): CursorPagePromise<typeof BulkActionObject>;
    retrieveBulkAction(bulkActionId: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
        name?: string | undefined;
        type: "CANCEL" | "REPLAY";
        status: "ABORTED" | "COMPLETED" | "PENDING";
        counts: {
            total: number;
            success: number;
            failure: number;
        };
        createdAt: Date;
        completedAt?: Date | undefined;
    }>;
    abortBulkAction(bulkActionId: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
    }>;
    resetIdempotencyKey(taskIdentifier: string, idempotencyKey: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
    }>;
    rescheduleRun(runId: string, body: RescheduleRunRequestBody, requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
        status: "CANCELED" | "COMPLETED" | "CRASHED" | "DELAYED" | "DEQUEUED" | "EXECUTING" | "EXPIRED" | "FAILED" | "PENDING_VERSION" | "QUEUED" | "SYSTEM_FAILURE" | "TIMED_OUT" | "WAITING";
        taskIdentifier: string;
        idempotencyKey?: string | undefined;
        version?: string | undefined;
        isQueued: boolean;
        isExecuting: boolean;
        isWaiting: boolean;
        isCompleted: boolean;
        isSuccess: boolean;
        isFailed: boolean;
        isCancelled: boolean;
        isTest: boolean;
        createdAt: Date;
        updatedAt: Date;
        startedAt?: Date | undefined;
        finishedAt?: Date | undefined;
        delayedUntil?: Date | undefined;
        ttl?: string | undefined;
        expiredAt?: Date | undefined;
        tags: string[];
        costInCents: number;
        baseCostInCents: number;
        durationMs: number;
        metadata?: Record<string, any> | undefined;
        taskKind?: string | undefined;
        region?: string | undefined;
        depth: number;
        triggerFunction: "batchTrigger" | "batchTriggerAndWait" | "trigger" | "triggerAndWait";
        batchId?: string | undefined;
        payload?: any;
        payloadPresignedUrl?: string | undefined;
        output?: any;
        outputPresignedUrl?: string | undefined;
        error?: {
            message: string;
            name?: string | undefined;
            stackTrace?: string | undefined;
            causes?: {
                name?: string | undefined;
                message: string;
                stackTrace?: string | undefined;
            }[] | undefined;
        } | undefined;
        schedule?: {
            id: string;
            externalId?: string | undefined;
            deduplicationKey?: string | undefined;
            generator: {
                type: "CRON";
                expression: string;
                description: string;
            };
        } | undefined;
        relatedRuns: {
            root?: {
                id: string;
                status: "CANCELED" | "COMPLETED" | "CRASHED" | "DELAYED" | "DEQUEUED" | "EXECUTING" | "EXPIRED" | "FAILED" | "PENDING_VERSION" | "QUEUED" | "SYSTEM_FAILURE" | "TIMED_OUT" | "WAITING";
                taskIdentifier: string;
                idempotencyKey?: string | undefined;
                version?: string | undefined;
                isQueued: boolean;
                isExecuting: boolean;
                isWaiting: boolean;
                isCompleted: boolean;
                isSuccess: boolean;
                isFailed: boolean;
                isCancelled: boolean;
                isTest: boolean;
                createdAt: Date;
                updatedAt: Date;
                startedAt?: Date | undefined;
                finishedAt?: Date | undefined;
                delayedUntil?: Date | undefined;
                ttl?: string | undefined;
                expiredAt?: Date | undefined;
                tags: string[];
                costInCents: number;
                baseCostInCents: number;
                durationMs: number;
                metadata?: Record<string, any> | undefined;
                taskKind?: string | undefined;
                region?: string | undefined;
                depth: number;
                triggerFunction: "batchTrigger" | "batchTriggerAndWait" | "trigger" | "triggerAndWait";
                batchId?: string | undefined;
            } | undefined;
            parent?: {
                id: string;
                status: "CANCELED" | "COMPLETED" | "CRASHED" | "DELAYED" | "DEQUEUED" | "EXECUTING" | "EXPIRED" | "FAILED" | "PENDING_VERSION" | "QUEUED" | "SYSTEM_FAILURE" | "TIMED_OUT" | "WAITING";
                taskIdentifier: string;
                idempotencyKey?: string | undefined;
                version?: string | undefined;
                isQueued: boolean;
                isExecuting: boolean;
                isWaiting: boolean;
                isCompleted: boolean;
                isSuccess: boolean;
                isFailed: boolean;
                isCancelled: boolean;
                isTest: boolean;
                createdAt: Date;
                updatedAt: Date;
                startedAt?: Date | undefined;
                finishedAt?: Date | undefined;
                delayedUntil?: Date | undefined;
                ttl?: string | undefined;
                expiredAt?: Date | undefined;
                tags: string[];
                costInCents: number;
                baseCostInCents: number;
                durationMs: number;
                metadata?: Record<string, any> | undefined;
                taskKind?: string | undefined;
                region?: string | undefined;
                depth: number;
                triggerFunction: "batchTrigger" | "batchTriggerAndWait" | "trigger" | "triggerAndWait";
                batchId?: string | undefined;
            } | undefined;
            children?: {
                id: string;
                status: "CANCELED" | "COMPLETED" | "CRASHED" | "DELAYED" | "DEQUEUED" | "EXECUTING" | "EXPIRED" | "FAILED" | "PENDING_VERSION" | "QUEUED" | "SYSTEM_FAILURE" | "TIMED_OUT" | "WAITING";
                taskIdentifier: string;
                idempotencyKey?: string | undefined;
                version?: string | undefined;
                isQueued: boolean;
                isExecuting: boolean;
                isWaiting: boolean;
                isCompleted: boolean;
                isSuccess: boolean;
                isFailed: boolean;
                isCancelled: boolean;
                isTest: boolean;
                createdAt: Date;
                updatedAt: Date;
                startedAt?: Date | undefined;
                finishedAt?: Date | undefined;
                delayedUntil?: Date | undefined;
                ttl?: string | undefined;
                expiredAt?: Date | undefined;
                tags: string[];
                costInCents: number;
                baseCostInCents: number;
                durationMs: number;
                metadata?: Record<string, any> | undefined;
                taskKind?: string | undefined;
                region?: string | undefined;
                depth: number;
                triggerFunction: "batchTrigger" | "batchTriggerAndWait" | "trigger" | "triggerAndWait";
                batchId?: string | undefined;
            }[] | undefined;
        };
        attemptCount: number;
    }>;
    listRunEvents(runId: string, requestOptions?: ZodFetchOptions): ApiPromise<any>;
    addTags(runId: string, body: AddTagsRequestBody, requestOptions?: ZodFetchOptions): ApiPromise<{
        message: string;
    }>;
    createSchedule(options: CreateScheduleOptions, requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
        type: "DECLARATIVE" | "IMPERATIVE";
        task: string;
        active: boolean;
        deduplicationKey?: string | null | undefined;
        externalId?: string | null | undefined;
        generator: {
            type: "CRON";
            expression: string;
            description: string;
        };
        timezone: string;
        window?: string | undefined;
        nextRun?: Date | null | undefined;
        nextRunEffectiveAt?: Date | null | undefined;
        appliedSchedulePolicy?: {
            minimumWindowSeconds: number;
            reason: "free_schedule";
        } | undefined;
        environments: {
            id: string;
            type: string;
            userName?: string | null | undefined;
        }[];
    }>;
    listSchedules(options?: ListScheduleOptions, requestOptions?: ZodFetchOptions): import("./core.js").OffsetLimitPagePromise<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodUnion<readonly [z.ZodLiteral<"DECLARATIVE">, z.ZodLiteral<"IMPERATIVE">]>;
        task: z.ZodString;
        active: z.ZodBoolean;
        deduplicationKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        externalId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        generator: z.ZodObject<{
            type: z.ZodLiteral<"CRON">;
            expression: z.ZodString;
            description: z.ZodString;
        }, z.core.$strip>;
        timezone: z.ZodString;
        window: z.ZodOptional<z.ZodString>;
        nextRun: z.ZodOptional<z.ZodNullable<z.ZodCoercedDate<unknown>>>;
        nextRunEffectiveAt: z.ZodOptional<z.ZodNullable<z.ZodCoercedDate<unknown>>>;
        appliedSchedulePolicy: z.ZodOptional<z.ZodObject<{
            minimumWindowSeconds: z.ZodNumber;
            reason: z.ZodLiteral<"free_schedule">;
        }, z.core.$strip>>;
        environments: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            type: z.ZodString;
            userName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    retrieveSchedule(scheduleId: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
        type: "DECLARATIVE" | "IMPERATIVE";
        task: string;
        active: boolean;
        deduplicationKey?: string | null | undefined;
        externalId?: string | null | undefined;
        generator: {
            type: "CRON";
            expression: string;
            description: string;
        };
        timezone: string;
        window?: string | undefined;
        nextRun?: Date | null | undefined;
        nextRunEffectiveAt?: Date | null | undefined;
        appliedSchedulePolicy?: {
            minimumWindowSeconds: number;
            reason: "free_schedule";
        } | undefined;
        environments: {
            id: string;
            type: string;
            userName?: string | null | undefined;
        }[];
    }>;
    updateSchedule(scheduleId: string, options: UpdateScheduleOptions, requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
        type: "DECLARATIVE" | "IMPERATIVE";
        task: string;
        active: boolean;
        deduplicationKey?: string | null | undefined;
        externalId?: string | null | undefined;
        generator: {
            type: "CRON";
            expression: string;
            description: string;
        };
        timezone: string;
        window?: string | undefined;
        nextRun?: Date | null | undefined;
        nextRunEffectiveAt?: Date | null | undefined;
        appliedSchedulePolicy?: {
            minimumWindowSeconds: number;
            reason: "free_schedule";
        } | undefined;
        environments: {
            id: string;
            type: string;
            userName?: string | null | undefined;
        }[];
    }>;
    deactivateSchedule(scheduleId: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
        type: "DECLARATIVE" | "IMPERATIVE";
        task: string;
        active: boolean;
        deduplicationKey?: string | null | undefined;
        externalId?: string | null | undefined;
        generator: {
            type: "CRON";
            expression: string;
            description: string;
        };
        timezone: string;
        window?: string | undefined;
        nextRun?: Date | null | undefined;
        nextRunEffectiveAt?: Date | null | undefined;
        appliedSchedulePolicy?: {
            minimumWindowSeconds: number;
            reason: "free_schedule";
        } | undefined;
        environments: {
            id: string;
            type: string;
            userName?: string | null | undefined;
        }[];
    }>;
    activateSchedule(scheduleId: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
        type: "DECLARATIVE" | "IMPERATIVE";
        task: string;
        active: boolean;
        deduplicationKey?: string | null | undefined;
        externalId?: string | null | undefined;
        generator: {
            type: "CRON";
            expression: string;
            description: string;
        };
        timezone: string;
        window?: string | undefined;
        nextRun?: Date | null | undefined;
        nextRunEffectiveAt?: Date | null | undefined;
        appliedSchedulePolicy?: {
            minimumWindowSeconds: number;
            reason: "free_schedule";
        } | undefined;
        environments: {
            id: string;
            type: string;
            userName?: string | null | undefined;
        }[];
    }>;
    deleteSchedule(scheduleId: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
    }>;
    listEnvVars(projectRef: string, slug: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        name: string;
        value: string;
        isSecret: boolean;
    }[]>;
    importEnvVars(projectRef: string, slug: string, body: ImportEnvironmentVariablesParams, requestOptions?: ZodFetchOptions): ApiPromise<{
        success: boolean;
    }>;
    retrieveEnvVar(projectRef: string, slug: string, key: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        name: string;
        value: string;
        isSecret: boolean;
    }>;
    createEnvVar(projectRef: string, slug: string, body: CreateEnvironmentVariableRequestBody, requestOptions?: ZodFetchOptions): ApiPromise<{
        success: boolean;
    }>;
    updateEnvVar(projectRef: string, slug: string, key: string, body: UpdateEnvironmentVariableRequestBody, requestOptions?: ZodFetchOptions): ApiPromise<{
        success: boolean;
    }>;
    deleteEnvVar(projectRef: string, slug: string, key: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        success: boolean;
    }>;
    updateRunMetadata(runId: string, body: UpdateMetadataRequestBody, requestOptions?: ZodFetchOptions): ApiPromise<{
        metadata: Record<string, import("../../index.js").DeserializedJson>;
    }>;
    getRunMetadata(runId: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        metadata: Record<string, import("../../index.js").DeserializedJson>;
    }>;
    createWaitpointToken(options: CreateWaitpointTokenRequestBody, requestOptions?: ZodFetchOptions): ApiPromise<CreateWaitpointTokenResponse>;
    listWaitpointTokens(params?: ListWaitpointTokensQueryParams, requestOptions?: ZodFetchOptions): CursorPagePromise<typeof WaitpointTokenItem>;
    retrieveWaitpointToken(friendlyId: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
        url: string;
        status: "COMPLETED" | "TIMED_OUT" | "WAITING";
        completedAt?: Date | undefined;
        timeoutAt?: Date | undefined;
        idempotencyKey?: string | undefined;
        idempotencyKeyExpiresAt?: Date | undefined;
        tags: string[];
        createdAt: Date;
    } & {
        output?: string | undefined;
        outputType?: string | undefined;
        outputIsError?: boolean | undefined;
    }>;
    completeWaitpointToken(friendlyId: string, options: CompleteWaitpointTokenRequestBody, requestOptions?: ZodFetchOptions): ApiPromise<{
        success: true;
    }>;
    waitForWaitpointToken({ runFriendlyId, waitpointFriendlyId, }: {
        runFriendlyId: string;
        waitpointFriendlyId: string;
    }, requestOptions?: ZodFetchOptions): ApiPromise<{
        success: boolean;
    }>;
    createSession(body: CreateSessionRequestBody, requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
        externalId: string | null;
        type: string;
        taskIdentifier: string;
        triggerConfig?: {
            basePayload: Record<string, unknown>;
            machine?: "large-1x" | "large-2x" | "medium-1x" | "medium-2x" | "micro" | "small-1x" | "small-2x" | undefined;
            queue?: string | undefined;
            tags?: string[] | undefined;
            maxAttempts?: number | undefined;
            maxDuration?: number | undefined;
            lockToVersion?: string | undefined;
            externalDeploymentId?: string | undefined;
            region?: string | undefined;
            idleTimeoutInSeconds?: number | undefined;
            ttl?: string | number | undefined;
        } | undefined;
        currentRunId?: string | null | undefined;
        tags: string[];
        metadata: Record<string, unknown> | null;
        closedAt: Date | null;
        closedReason: string | null;
        expiresAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        runId: string;
        publicAccessToken: string;
        isCached: boolean;
        pendingVersion?: boolean | undefined;
    }>;
    retrieveSession(sessionIdOrExternalId: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
        externalId: string | null;
        type: string;
        taskIdentifier: string;
        triggerConfig?: {
            basePayload: Record<string, unknown>;
            machine?: "large-1x" | "large-2x" | "medium-1x" | "medium-2x" | "micro" | "small-1x" | "small-2x" | undefined;
            queue?: string | undefined;
            tags?: string[] | undefined;
            maxAttempts?: number | undefined;
            maxDuration?: number | undefined;
            lockToVersion?: string | undefined;
            externalDeploymentId?: string | undefined;
            region?: string | undefined;
            idleTimeoutInSeconds?: number | undefined;
            ttl?: string | number | undefined;
        } | undefined;
        currentRunId?: string | null | undefined;
        tags: string[];
        metadata: Record<string, unknown> | null;
        closedAt: Date | null;
        closedReason: string | null;
        expiresAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    updateSession(sessionIdOrExternalId: string, body: UpdateSessionRequestBody, requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
        externalId: string | null;
        type: string;
        taskIdentifier: string;
        triggerConfig?: {
            basePayload: Record<string, unknown>;
            machine?: "large-1x" | "large-2x" | "medium-1x" | "medium-2x" | "micro" | "small-1x" | "small-2x" | undefined;
            queue?: string | undefined;
            tags?: string[] | undefined;
            maxAttempts?: number | undefined;
            maxDuration?: number | undefined;
            lockToVersion?: string | undefined;
            externalDeploymentId?: string | undefined;
            region?: string | undefined;
            idleTimeoutInSeconds?: number | undefined;
            ttl?: string | number | undefined;
        } | undefined;
        currentRunId?: string | null | undefined;
        tags: string[];
        metadata: Record<string, unknown> | null;
        closedAt: Date | null;
        closedReason: string | null;
        expiresAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    closeSession(sessionIdOrExternalId: string, body?: CloseSessionRequestBody, requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
        externalId: string | null;
        type: string;
        taskIdentifier: string;
        triggerConfig?: {
            basePayload: Record<string, unknown>;
            machine?: "large-1x" | "large-2x" | "medium-1x" | "medium-2x" | "micro" | "small-1x" | "small-2x" | undefined;
            queue?: string | undefined;
            tags?: string[] | undefined;
            maxAttempts?: number | undefined;
            maxDuration?: number | undefined;
            lockToVersion?: string | undefined;
            externalDeploymentId?: string | undefined;
            region?: string | undefined;
            idleTimeoutInSeconds?: number | undefined;
            ttl?: string | number | undefined;
        } | undefined;
        currentRunId?: string | null | undefined;
        tags: string[];
        metadata: Record<string, unknown> | null;
        closedAt: Date | null;
        closedReason: string | null;
        expiresAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    endAndContinueSession(sessionIdOrExternalId: string, body: EndAndContinueSessionRequestBody, requestOptions?: ZodFetchOptions): ApiPromise<{
        runId: string;
        swapped: boolean;
        pendingVersion?: boolean | undefined;
    }>;
    listSessions(options?: ListSessionsOptions, requestOptions?: ZodFetchOptions): CursorPagePromise<typeof ListedSessionItem>;
    initializeSessionStream(sessionIdOrExternalId: string, io: "out" | "in", requestOptions?: ZodFetchOptions, channel?: string): Promise<{
        version: string;
        headers: {
            [k: string]: string;
        };
    }>;
    appendToSessionStream<TBody extends BodyInit>(sessionIdOrExternalId: string, io: "out" | "in", part: TBody, requestOptions?: ZodFetchOptions, channel?: string): Promise<{
        ok: boolean;
        message?: string | undefined;
    }>;
    /**
     * Non-SSE drain of a Session channel's tail. Returns whatever records
     * exist after `afterEventId` (or from the head of the stream) and closes
     * — `wait=0` semantics, no long-poll. Used by `replaySessionOutTail` at
     * run boot, where the SSE long-poll's ~1s tax on empty streams is the
     * dominant cost on every fresh chat.
     *
     * `afterEventId` is the same cursor format as the SSE Last-Event-ID
     * (the S2 sequence number, stringified) — pass `lastOutEventId` from a
     * persisted snapshot to resume.
     */
    readSessionStreamRecords(sessionIdOrExternalId: string, io: "out" | "in", options?: {
        afterEventId?: string;
        baseUrl?: string;
        channel?: string;
    }): Promise<{
        records: {
            data: unknown;
            id: string;
            seqNum: number;
            headers?: [string, string][] | undefined;
        }[];
    }>;
    /**
     * Subscribe to SSE records on a Session channel. Reuses the same
     * {@link SSEStreamSubscription} plumbing as `readStream` for run-scoped
     * realtime streams — auto-retry, Last-Event-ID resume, abort-on-cancel.
     */
    subscribeToSessionStream<T = unknown>(sessionIdOrExternalId: string, io: "out" | "in", options?: {
        signal?: AbortSignal;
        baseUrl?: string;
        /**
         * A named side channel on the session. When omitted, the session's
         * reserved default channel (`session.in` / `session.out`) is used.
         */
        channel?: string;
        timeoutInSeconds?: number;
        onComplete?: () => void;
        onError?: (error: Error) => void;
        lastEventId?: string;
        /**
         * Where a fresh subscription (no `lastEventId`) starts reading. `"latest"`
         * starts at the current tail (only records after connect); `"beginning"`
         * (default) replays history.
         */
        from?: "beginning" | "latest";
        onPart?: (part: SSEStreamPart<T>) => void;
        /**
         * Fires when a `trigger-control` record arrives on the stream (e.g.
         * `turn-complete`, `upgrade-required`). The control record is never
         * enqueued into the consumer stream — handle the event here.
         */
        onControl?: (event: ControlEvent) => void;
    }): Promise<AsyncIterableStream<T>>;
    waitForDuration(runId: string, body: WaitForDurationRequestBody, requestOptions?: ZodFetchOptions): Promise<{
        waitUntil: Date;
        waitpoint: {
            id: string;
        };
    }>;
    listQueues(options?: ListQueueOptions, requestOptions?: ZodFetchOptions): import("./core.js").OffsetLimitPagePromise<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<{
            custom: "custom";
            task: "task";
        }>;
        running: z.ZodNumber;
        queued: z.ZodNumber;
        paused: z.ZodBoolean;
        concurrencyLimit: z.ZodNullable<z.ZodNumber>;
        concurrency: z.ZodOptional<z.ZodObject<{
            current: z.ZodNullable<z.ZodNumber>;
            base: z.ZodNullable<z.ZodNumber>;
            override: z.ZodNullable<z.ZodNumber>;
            overriddenAt: z.ZodNullable<z.ZodCoercedDate<unknown>>;
            overriddenBy: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    retrieveQueue(queue: RetrieveQueueParam, requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
        name: string;
        type: "custom" | "task";
        running: number;
        queued: number;
        paused: boolean;
        concurrencyLimit: number | null;
        concurrency?: {
            current: number | null;
            base: number | null;
            override: number | null;
            overriddenAt: Date | null;
            overriddenBy: string | null;
        } | undefined;
    }>;
    pauseQueue(queue: RetrieveQueueParam, action: "pause" | "resume", requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
        name: string;
        type: "custom" | "task";
        running: number;
        queued: number;
        paused: boolean;
        concurrencyLimit: number | null;
        concurrency?: {
            current: number | null;
            base: number | null;
            override: number | null;
            overriddenAt: Date | null;
            overriddenBy: string | null;
        } | undefined;
    }>;
    overrideQueueConcurrencyLimit(queue: RetrieveQueueParam, concurrencyLimit: number, requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
        name: string;
        type: "custom" | "task";
        running: number;
        queued: number;
        paused: boolean;
        concurrencyLimit: number | null;
        concurrency?: {
            current: number | null;
            base: number | null;
            override: number | null;
            overriddenAt: Date | null;
            overriddenBy: string | null;
        } | undefined;
    }>;
    resetQueueConcurrencyLimit(queue: RetrieveQueueParam, requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
        name: string;
        type: "custom" | "task";
        running: number;
        queued: number;
        paused: boolean;
        concurrencyLimit: number | null;
        concurrency?: {
            current: number | null;
            base: number | null;
            override: number | null;
            overriddenAt: Date | null;
            overriddenBy: string | null;
        } | undefined;
    }>;
    subscribeToRun<TRunTypes extends AnyRunTypes>(runId: string, options?: {
        signal?: AbortSignal;
        closeOnComplete?: boolean;
        onFetchError?: (error: Error) => void;
        skipColumns?: string[];
    }): RunSubscription<TRunTypes>;
    subscribeToRunsWithTag<TRunTypes extends AnyRunTypes>(tag: string | string[], filters?: {
        createdAt?: string;
        skipColumns?: string[];
    }, options?: {
        signal?: AbortSignal;
        onFetchError?: (error: Error) => void;
    }): RunSubscription<TRunTypes>;
    subscribeToBatch<TRunTypes extends AnyRunTypes>(batchId: string, options?: {
        signal?: AbortSignal;
        onFetchError?: (error: Error) => void;
        skipColumns?: string[];
    }): RunSubscription<TRunTypes>;
    listDeployments(options?: ApiDeploymentListOptions, requestOptions?: ZodFetchOptions): CursorPagePromise<z.ZodObject<{
        id: z.ZodString;
        createdAt: z.ZodCoercedDate<unknown>;
        shortCode: z.ZodString;
        version: z.ZodString;
        runtime: z.ZodNullable<z.ZodString>;
        runtimeVersion: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            BUILDING: "BUILDING";
            CANCELED: "CANCELED";
            DEPLOYED: "DEPLOYED";
            DEPLOYING: "DEPLOYING";
            FAILED: "FAILED";
            PENDING: "PENDING";
            TIMED_OUT: "TIMED_OUT";
        }>;
        deployedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
        git: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        error: z.ZodOptional<z.ZodObject<{
            name: z.ZodString;
            message: z.ZodString;
            stack: z.ZodOptional<z.ZodString>;
            stderr: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        externalId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
    retrieveCurrentDeployment(requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
        createdAt: Date;
        shortCode: string;
        version: string;
        runtime: string | null;
        runtimeVersion: string | null;
        status: "BUILDING" | "CANCELED" | "DEPLOYED" | "DEPLOYING" | "FAILED" | "PENDING" | "TIMED_OUT";
        deployedAt?: Date | undefined;
        git?: Record<string, any> | undefined;
        error?: {
            name: string;
            message: string;
            stack?: string | undefined;
            stderr?: string | undefined;
        } | undefined;
        externalId?: string | null | undefined;
    }>;
    fetchStream<T>(runId: string, streamKey: string, options?: {
        signal?: AbortSignal;
        baseUrl?: string;
        timeoutInSeconds?: number;
        onComplete?: () => void;
        onError?: (error: Error) => void;
        lastEventId?: string;
        /**
         * Where a fresh subscription (no `lastEventId`) starts reading. `"latest"`
         * starts at the current tail (only records after connect); `"beginning"`
         * (default) replays history.
         */
        from?: "beginning" | "latest";
        /** Called for each SSE event with the full event metadata (id, timestamp). */
        onPart?: (part: SSEStreamPart<T>) => void;
    }): Promise<AsyncIterableStream<T>>;
    createStream(runId: string, target: string, streamId: string, requestOptions?: ZodFetchOptions): Promise<{
        version: string;
        headers: {
            [k: string]: string;
        };
    }>;
    appendToStream<TBody extends BodyInit>(runId: string, target: string, streamId: string, part: TBody, requestOptions?: ZodFetchOptions): Promise<{
        ok: boolean;
        message?: string | undefined;
    }>;
    sendInputStream(runId: string, streamId: string, data: unknown, requestOptions?: ZodFetchOptions): Promise<{
        ok: boolean;
    }>;
    createInputStreamWaitpoint(runFriendlyId: string, body: CreateInputStreamWaitpointRequestBody, requestOptions?: ZodFetchOptions): Promise<{
        waitpointId: string;
        isCached: boolean;
    }>;
    createSessionStreamWaitpoint(runFriendlyId: string, body: CreateSessionStreamWaitpointRequestBody, requestOptions?: ZodFetchOptions): Promise<{
        waitpointId: string;
        isCached: boolean;
    }>;
    generateJWTClaims(requestOptions?: ZodFetchOptions): Promise<Record<string, any>>;
    createPublicToken(body: CreatePublicTokenRequestBody, requestOptions?: ZodFetchOptions): Promise<{
        token: string;
    }>;
    retrieveBatch(batchId: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        id: string;
        status: "ABORTED" | "COMPLETED" | "PARTIAL_FAILED" | "PENDING" | "PROCESSING";
        idempotencyKey?: string | undefined;
        createdAt: Date;
        updatedAt: Date;
        runCount: number;
        runs: string[];
        processing: {
            completedAt?: Date | undefined;
            errors: {
                index: number;
                taskIdentifier: string;
                error: string;
                errorCode?: string | undefined;
            }[];
        };
    }>;
    executeQuery(query: string, options?: {
        scope?: "environment" | "project" | "organization";
        period?: string;
        from?: string;
        to?: string;
        format?: "json" | "csv";
    }, requestOptions?: ZodFetchOptions): Promise<QueryExecuteResponseBody>;
    getQuerySchema(requestOptions?: ZodFetchOptions): Promise<QuerySchemaResponseBody>;
    listDashboards(requestOptions?: ZodFetchOptions): Promise<ListDashboardsResponseBody>;
    /**
     * `format: "json"` returns a `ReportViewModel`; "markdown" (default) and "ansi" return a rendered
     * string. `period` is a shorthand like "1h" or "7d", capped at 90d. Seconds are not accepted.
     */
    getReport(key: string, options: {
        period?: string;
        format: "json";
    }): Promise<ReportViewModel>;
    getReport(key: string, options?: {
        period?: string;
        format?: "markdown" | "ansi";
    }): Promise<string>;
    resolvePrompt(slug: string, body: ResolvePromptRequestBody, requestOptions?: ZodFetchOptions): ApiPromise<{
        data: {
            promptId: string;
            slug: string;
            version: number;
            labels: string[];
            template?: string | undefined;
            text?: string | undefined;
            model?: string | null | undefined;
            config?: Record<string, unknown> | null | undefined;
        };
    }>;
    listPrompts(requestOptions?: ZodFetchOptions): ApiPromise<{
        data: {
            slug: string;
            friendlyId: string;
            description: string | null;
            tags: string[];
            defaultModel: string | null;
            currentVersion: number | null;
            hasOverride: boolean;
            updatedAt: string;
        }[];
    }>;
    listPromptVersions(slug: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        data: {
            id: string;
            version: number;
            labels: string[];
            source: string;
            model: string | null;
            textContent: string | null;
            commitMessage: string | null;
            contentHash: string;
            createdAt: string;
        }[];
    }>;
    promotePromptVersion(slug: string, body: PromotePromptVersionRequestBody, requestOptions?: ZodFetchOptions): ApiPromise<{
        ok: boolean;
    }>;
    createPromptOverride(slug: string, body: CreatePromptOverrideRequestBody, requestOptions?: ZodFetchOptions): ApiPromise<{
        ok: boolean;
        version: number;
    }>;
    updatePromptOverride(slug: string, body: UpdatePromptOverrideRequestBody, requestOptions?: ZodFetchOptions): ApiPromise<{
        ok: boolean;
    }>;
    removePromptOverride(slug: string, requestOptions?: ZodFetchOptions): ApiPromise<{
        ok: boolean;
    }>;
    reactivatePromptOverride(slug: string, body: ReactivatePromptOverrideRequestBody, requestOptions?: ZodFetchOptions): ApiPromise<{
        ok: boolean;
    }>;
}
export declare function mergeRequestOptions(defaultOptions: AnyZodFetchOptions, options?: ApiRequestOptions): AnyZodFetchOptions;
