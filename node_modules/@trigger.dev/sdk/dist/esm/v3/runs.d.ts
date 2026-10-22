import type { AnyRetrieveRunResult, AnyRunShape, ApiRequestOptions, CreateBulkCancelActionOptions, CreateBulkReplayActionOptions, InferRunTypes, ListBulkActionsQueryParams, ListProjectRunsQueryParams, ListRunsQueryParams, RescheduleRunRequestBody, RetrieveRunResult, RunShape, RealtimeRun, AnyRealtimeRun, RunSubscription, TaskRunShape, AnyBatchedRunHandle, AsyncIterableStream, ApiPromise, RealtimeRunSkipColumns, AbortBulkActionResponseBody, BulkActionObject, CanceledRunResponse, CreateBulkActionResponseBody, CursorPagePromise, ListRunResponseItem, ReplayRunResponse, RetrieveRunResponse } from "@trigger.dev/core/v3";
import type { AnyRunHandle, AnyTask } from "./shared.js";
export type { AnyRetrieveRunResult, AnyRunShape, RetrieveRunResult, RunShape, TaskRunShape, RealtimeRun, AnyRealtimeRun, };
export declare const runs: {
    replay: typeof replayRun;
    cancel: typeof cancelRun;
    retrieve: typeof retrieveRun;
    list: typeof listRuns;
    reschedule: typeof rescheduleRun;
    bulk: {
        cancel: typeof bulkCancelRuns;
        replay: typeof bulkReplayRuns;
        retrieve: typeof retrieveBulkAction;
        abort: typeof abortBulkAction;
        list: typeof listBulkActions;
        poll: typeof pollBulkAction;
    };
    poll: typeof poll;
    subscribeToRun: typeof subscribeToRun;
    subscribeToRunsWithTag: typeof subscribeToRunsWithTag;
    subscribeToBatch: typeof subscribeToRunsInBatch;
    fetchStream: typeof fetchStream;
};
export type BulkAction = BulkActionObject;
declare function listRuns(projectRef: string, params?: ListProjectRunsQueryParams, requestOptions?: ApiRequestOptions): CursorPagePromise<typeof ListRunResponseItem>;
declare function listRuns(params?: ListRunsQueryParams, requestOptions?: ApiRequestOptions): CursorPagePromise<typeof ListRunResponseItem>;
type RunId<TRunId> = TRunId extends AnyRunHandle | AnyBatchedRunHandle ? TRunId : TRunId extends AnyTask ? string : TRunId extends string ? TRunId : never;
declare function retrieveRun<TRunId extends AnyRunHandle | AnyBatchedRunHandle | AnyTask | string>(runId: RunId<TRunId>, requestOptions?: ApiRequestOptions): ApiPromise<RetrieveRunResult<TRunId>>;
declare function replayRun(runId: string, requestOptions?: ApiRequestOptions): ApiPromise<ReplayRunResponse>;
declare function cancelRun(runId: string, requestOptions?: ApiRequestOptions): ApiPromise<CanceledRunResponse>;
declare function bulkCancelRuns(options: CreateBulkCancelActionOptions, requestOptions?: ApiRequestOptions): ApiPromise<CreateBulkActionResponseBody>;
declare function bulkReplayRuns(options: CreateBulkReplayActionOptions, requestOptions?: ApiRequestOptions): ApiPromise<CreateBulkActionResponseBody>;
declare function retrieveBulkAction(bulkActionId: string, requestOptions?: ApiRequestOptions): ApiPromise<BulkActionObject>;
declare function abortBulkAction(bulkActionId: string, requestOptions?: ApiRequestOptions): ApiPromise<AbortBulkActionResponseBody>;
declare function listBulkActions(params?: ListBulkActionsQueryParams, requestOptions?: ApiRequestOptions): CursorPagePromise<typeof BulkActionObject>;
declare function pollBulkAction(bulkActionId: string, options?: {
    pollIntervalMs?: number;
}, requestOptions?: ApiRequestOptions): Promise<BulkActionObject>;
declare function rescheduleRun(runId: string, body: RescheduleRunRequestBody, requestOptions?: ApiRequestOptions): ApiPromise<RetrieveRunResponse>;
declare function poll<TRunId extends AnyRunHandle | AnyTask | string>(runId: RunId<TRunId>, options?: {
    pollIntervalMs?: number;
}, requestOptions?: ApiRequestOptions): Promise<{
    output?: InferRunTypes<TRunId>["output"] | undefined;
    payload?: InferRunTypes<TRunId>["payload"] | undefined;
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
    payloadPresignedUrl?: string | undefined;
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
type SubscribeToRunOptions = {
    /**
     * Whether to close the subscription when the run completes
     *
     * @default true
     *
     * Set this to false if you are making updates to the run metadata after completion through child runs
     */
    stopOnCompletion?: boolean;
    /**
     * Skip columns from the subscription.
     *
     * @default []
     *
     * @example
     * ```ts
     * runs.subscribeToRun("123", { skipColumns: ["payload", "output"] });
     * ```
     */
    skipColumns?: RealtimeRunSkipColumns;
    /**
     * An AbortSignal to cancel the subscription.
     *
     * When the signal is aborted, the underlying SSE connection is closed
     * and the async iterator completes.
     */
    signal?: AbortSignal;
};
/**
 * Subscribes to real-time updates for a specific run.
 *
 * This function allows you to receive real-time updates whenever a run changes, including:
 * - Status changes in the run lifecycle
 * - Tag additions or removals
 * - Metadata updates
 *
 * @template TRunId - The type parameter extending AnyRunHandle, AnyTask, or string
 * @param {RunId<TRunId>} runId - The ID of the run to subscribe to. Can be a string ID, RunHandle, or Task
 * @param {SubscribeToRunOptions} [options] - Optional configuration for the subscription
 * @param {boolean} [options.stopOnCompletion=true] - Whether to close the subscription when the run completes
 * @returns {RunSubscription<InferRunTypes<TRunId>>} An async iterator that yields updated run objects
 *
 * @example
 * ```ts
 * // Subscribe using a run handle
 * const handle = await tasks.trigger("my-task", { some: "data" });
 * for await (const run of runs.subscribeToRun(handle.id)) {
 *   console.log("Run updated:", run);
 * }
 *
 * // Subscribe with type safety
 * for await (const run of runs.subscribeToRun<typeof myTask>(runId)) {
 *   console.log("Payload:", run.payload.some);
 *   if (run.output) {
 *     console.log("Output:", run.output);
 *   }
 * }
 * ```
 */
declare function subscribeToRun<TRunId extends AnyRunHandle | AnyTask | string>(runId: RunId<TRunId>, options?: SubscribeToRunOptions): RunSubscription<InferRunTypes<TRunId>>;
type SubscribeToRunsFilterOptions = {
    /**
     * Filter runs by the time they were created. You must specify the duration string like "1h", "10s", "30m", etc.
     *
     * @example
     * "1h" - 1 hour ago
     * "10s" - 10 seconds ago
     * "30m" - 30 minutes ago
     * "1d" - 1 day ago
     * "1w" - 1 week ago
     *
     * The maximum duration is 1 week
     *
     * @note The timestamp will be calculated on the server side when you first subscribe to the runs.
     *
     */
    createdAt?: string;
    /**
     * Skip columns from the subscription.
     *
     * @default []
     */
    skipColumns?: RealtimeRunSkipColumns;
};
/**
 * Subscribes to real-time updates for all runs that have specific tags.
 *
 * This function allows you to monitor multiple runs simultaneously by filtering on tags.
 * You'll receive updates whenever any run with the specified tag(s) changes.
 *
 * @template TTasks - The type parameter extending AnyTask for type-safe payload and output
 * @param {string | string[]} tag - A single tag or array of tags to filter runs
 * @returns {RunSubscription<InferRunTypes<TTasks>>} An async iterator that yields updated run objects
 *
 * @example
 * ```ts
 * // Subscribe to runs with a single tag
 * for await (const run of runs.subscribeToRunsWithTag("user:1234")) {
 *   console.log("Run updated:", run);
 * }
 *
 * // Subscribe with multiple tags and type safety
 * for await (const run of runs.subscribeToRunsWithTag<typeof myTask | typeof otherTask>(["tag1", "tag2"])) {
 *   switch (run.taskIdentifier) {
 *     case "my-task":
 *       console.log("MyTask output:", run.output.foo);
 *       break;
 *     case "other-task":
 *       console.log("OtherTask output:", run.output.bar);
 *       break;
 *   }
 * }
 * ```
 */
declare function subscribeToRunsWithTag<TTasks extends AnyTask>(tag: string | string[], filters?: SubscribeToRunsFilterOptions, options?: {
    signal?: AbortSignal;
}): RunSubscription<InferRunTypes<TTasks>>;
/**
 * Subscribes to real-time updates for all runs within a specific batch.
 *
 * Use this function when you've triggered multiple runs using `batchTrigger` and want
 * to monitor all runs in that batch. You'll receive updates whenever any run in the batch changes.
 *
 * @template TTasks - The type parameter extending AnyTask for type-safe payload and output
 * @param {string} batchId - The ID of the batch to subscribe to
 * @returns {RunSubscription<InferRunTypes<TTasks>>} An async iterator that yields updated run objects
 *
 * @example
 * ```ts
 * // Subscribe to all runs in a batch
 * for await (const run of runs.subscribeToRunsInBatch("batch-123")) {
 *   console.log("Batch run updated:", run);
 * }
 *
 * // Subscribe with type safety
 * for await (const run of runs.subscribeToRunsInBatch<typeof myTask>("batch-123")) {
 *   console.log("Run payload:", run.payload);
 *   if (run.output) {
 *     console.log("Run output:", run.output);
 *   }
 * }
 * ```
 *
 * @note The run objects received will include standard fields like id, status, payload, output,
 * createdAt, updatedAt, tags, and more. See the Run object documentation for full details.
 */
declare function subscribeToRunsInBatch<TTasks extends AnyTask>(batchId: string): RunSubscription<InferRunTypes<TTasks>>;
/**
 * Fetches a stream of data from a run's stream key.
 */
declare function fetchStream<T>(runId: string, streamKey: string): Promise<AsyncIterableStream<T>>;
