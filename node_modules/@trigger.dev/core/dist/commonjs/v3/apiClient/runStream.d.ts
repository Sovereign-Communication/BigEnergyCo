import type { DeserializedJson } from "../../schemas/json.js";
import type { RunStatus } from "../schemas/api.js";
import { SubscribeRunRawShape } from "../schemas/api.js";
import type { SerializedError } from "../schemas/common.js";
import type { AsyncIterableStream } from "../streams/asyncIterableStream.js";
import type { AnyRunTypes, AnyTask, InferRunTypes } from "../types/tasks.js";
import type { ApiClient } from "./index.js";
/**
 * Request header carrying the start position for a fresh realtime-stream
 * subscription. Value `"latest"` asks the server to start at the current tail
 * (only records appended after connect). Only sent when there is no
 * `Last-Event-ID`. Read by the realtime streams route on the server.
 */
export declare const STREAM_START_HEADER = "X-Trigger-Stream-Start";
export type RunShape<TRunTypes extends AnyRunTypes> = TRunTypes extends AnyRunTypes ? {
    id: string;
    taskIdentifier: TRunTypes["taskIdentifier"];
    payload: TRunTypes["payload"];
    output?: TRunTypes["output"];
    createdAt: Date;
    updatedAt: Date;
    status: RunStatus;
    durationMs: number;
    costInCents: number;
    baseCostInCents: number;
    tags: string[];
    idempotencyKey?: string;
    expiredAt?: Date;
    ttl?: string;
    finishedAt?: Date;
    startedAt?: Date;
    delayedUntil?: Date;
    queuedAt?: Date;
    metadata?: Record<string, DeserializedJson>;
    error?: SerializedError;
    isTest: boolean;
    isQueued: boolean;
    isExecuting: boolean;
    isWaiting: boolean;
    isCompleted: boolean;
    isFailed: boolean;
    isSuccess: boolean;
    isCancelled: boolean;
    realtimeStreams: string[];
} : never;
export type AnyRunShape = RunShape<AnyRunTypes>;
export type TaskRunShape<TTask extends AnyTask> = RunShape<InferRunTypes<TTask>>;
export type RealtimeRun<TTask extends AnyTask> = TaskRunShape<TTask>;
export type AnyRealtimeRun = RealtimeRun<AnyTask>;
export type RealtimeRunSkipColumns = Array<"startedAt" | "delayUntil" | "queuedAt" | "expiredAt" | "completedAt" | "number" | "isTest" | "usageDurationMs" | "costInCents" | "baseCostInCents" | "ttl" | "payload" | "payloadType" | "metadata" | "output" | "outputType" | "runTags" | "error">;
export type RunStreamCallback<TRunTypes extends AnyRunTypes> = (run: RunShape<TRunTypes>) => void | Promise<void>;
export type RunShapeStreamOptions = {
    headers?: Record<string, string>;
    resolveHeaders?: () => Promise<Record<string, string>>;
    fetchClient?: typeof fetch;
    closeOnComplete?: boolean;
    signal?: AbortSignal;
    client?: ApiClient;
    onFetchError?: (e: Error) => void;
};
type StreamPartResult<TRun, TStreams extends Record<string, any>> = {
    [K in keyof TStreams]: {
        type: K;
        chunk: TStreams[K];
        run: TRun;
    };
}[keyof TStreams];
export type RunWithStreamsResult<TRun, TStreams extends Record<string, any>> = {
    type: "run";
    run: TRun;
} | StreamPartResult<TRun, TStreams>;
export declare function runShapeStream<TRunTypes extends AnyRunTypes>(url: string, options?: RunShapeStreamOptions): RunSubscription<TRunTypes>;
export interface StreamSubscription {
    subscribe(): Promise<ReadableStream<SSEStreamPart<unknown>>>;
}
export type CreateStreamSubscriptionOptions = {
    baseUrl?: string;
    onComplete?: () => void;
    onError?: (error: Error) => void;
    timeoutInSeconds?: number;
    lastEventId?: string;
    /**
     * Where a fresh subscription (no `lastEventId`) starts reading from.
     *
     * - `"beginning"` (default): replay the full stream history, then live-tail.
     * - `"latest"`: skip history and start at the current tail — the subscriber
     *   sees only records appended after it connects (a last-value / live view).
     *
     * Ignored once `lastEventId` is set: a reconnect always resumes from the last
     * seen record, so `"latest"` only governs the very first connect.
     */
    from?: "beginning" | "latest";
};
export interface StreamSubscriptionFactory {
    createSubscription(runId: string, streamKey: string, options?: CreateStreamSubscriptionOptions): StreamSubscription;
}
export type SSEStreamPart<TChunk = unknown> = {
    /** Stable logical record id from the S2 data envelope (`X-Part-Id` on append). */
    recordId?: string;
    /** S2 sequence number in decimal-string form. */
    id: string;
    chunk: TChunk;
    timestamp: number;
    /**
     * S2 record headers, when the underlying transport is the v2 batch shape
     * (Session streams). Undefined for v1 streams. Empty array when the record
     * had no headers. Trigger control records carry a `trigger-control` named
     * header (see `trigger-control` records on `session.out`) and may reach
     * this struct. S2 command records (trim/fence) are identified by an
     * empty-name first header and are filtered out before enqueue.
     */
    headers?: Array<[string, string]>;
};
export declare class SSEStreamSubscription implements StreamSubscription {
    private url;
    private options;
    private lastEventId;
    private from;
    private retryCount;
    private maxRetries;
    private retryDelayMs;
    private maxRetryDelayMs;
    private retryJitter;
    private fetchTimeoutMs;
    private stallTimeoutMs;
    private nonRetryableStatuses;
    private retryNowController;
    private internalAbort;
    private cancelledByConsumer;
    private completeNotified;
    /** Headers for the next attempt. Replaced by `resolveHeaders` after an auth failure. */
    private currentHeaders;
    /** A refresh has already been tried on this connection; a second auth failure is terminal. */
    private authRefreshed;
    /** Headers were just refreshed for the auth error now unwinding; retry once instead of failing. */
    private retryAfterAuthRefresh;
    /**
     * True when the most recent response carried `X-Session-Settled: true` —
     * the server has no more records coming, so a clean end of the body is
     * terminal rather than the end of a long-poll window.
     */
    sessionSettled: boolean;
    constructor(url: string, options: {
        headers?: Record<string, string>;
        signal?: AbortSignal;
        onComplete?: () => void;
        onError?: (error: Error) => void;
        timeoutInSeconds?: number;
        lastEventId?: string;
        from?: "beginning" | "latest";
        maxRetries?: number;
        retryDelayMs?: number;
        maxRetryDelayMs?: number;
        retryJitter?: number;
        fetchTimeoutMs?: number;
        stallTimeoutMs?: number;
        nonRetryableStatuses?: readonly number[];
        fetchClient?: typeof fetch;
        resolveHeaders?: () => Promise<Record<string, string>>;
    });
    /**
     * Wake an in-flight retry backoff and reconnect immediately.
     *
     * No-op if no retry is currently waiting (i.e. we're already
     * connected and reading). Use this for cheap "hint" wakeups like
     * the `online` event or a short-hidden visibility return —
     * `forceReconnect()` is the heavier hammer.
     */
    retryNow(): void;
    /**
     * Drop the current connection (or wake a pending backoff) and
     * reconnect.
     *
     * Use when the existing TCP socket is suspected dead but the reader
     * hasn't noticed yet — common after a mobile tab background-kill or
     * a Safari bfcache restore. Aborts the in-flight fetch / read so
     * the catch path takes us through `retryConnection` and re-fetches
     * with `Last-Event-ID`.
     */
    forceReconnect(): void;
    /** Fire `onComplete` at most once, even if both the drain and cancel paths reach it. */
    private notifyComplete;
    /**
     * The transport pumps decoded records into an internal stream; the returned
     * stream drains it on demand.
     */
    subscribe(): Promise<ReadableStream<SSEStreamPart>>;
    private connectStream;
    /**
     * Re-resolve the headers after a 401/403 so the retry carries a fresh token.
     * At most once per live connection: if the refreshed token is rejected too,
     * the auth error stays terminal. A refresher that can't mint leaves the
     * rejected token in place so the auth error stays terminal too. Returns true
     * when a retry should follow.
     */
    private refreshHeadersForAuthError;
    private retryConnection;
}
export declare class SSEStreamSubscriptionFactory implements StreamSubscriptionFactory {
    private baseUrl;
    private options;
    constructor(baseUrl: string, options: {
        headers?: Record<string, string>;
        signal?: AbortSignal;
        resolveHeaders?: () => Promise<Record<string, string>>;
    });
    createSubscription(runId: string, streamKey: string, options?: CreateStreamSubscriptionOptions): StreamSubscription;
}
export type RunSubscriptionOptions = RunShapeStreamOptions & {
    runShapeStream: ReadableStream<SubscribeRunRawShape>;
    stopRunShapeStream: () => void;
    streamFactory: StreamSubscriptionFactory;
    abortController: AbortController;
};
export declare class RunSubscription<TRunTypes extends AnyRunTypes> {
    private options;
    private stream;
    private packetCache;
    private _closeOnComplete;
    private _isRunComplete;
    constructor(options: RunSubscriptionOptions);
    unsubscribe(): void;
    [Symbol.asyncIterator](): AsyncIterator<RunShape<TRunTypes>>;
    getReader(): ReadableStreamDefaultReader<RunShape<TRunTypes>>;
    withStreams<TStreams extends Record<string, any>>(): AsyncIterableStream<RunWithStreamsResult<RunShape<TRunTypes>, TStreams>>;
    private transformRunShape;
}
export {};
