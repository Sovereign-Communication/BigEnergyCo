import type { ApiClient } from "../apiClient/index.js";
import type { RealtimeStreamInstance, RealtimeStreamOperationOptions, RealtimeStreamsManager } from "./types.js";
export declare class StandardRealtimeStreamsManager implements RealtimeStreamsManager {
    private apiClient;
    private baseUrl;
    private debug;
    constructor(apiClient: ApiClient, baseUrl: string, debug?: boolean);
    private activeStreams;
    private createStreamCache;
    reset(): void;
    private getCachedCreateStream;
    /**
     * Reactive invalidation: a writer's `wait()` rejecting can mean the
     * cached S2 credentials have gone stale (expired token, revoked
     * access, basin retired), so evict the cached `createStream` response
     * for `(runId, key)` and let the next `pipe()` re-PUT to mint fresh
     * credentials. Compare by identity so a fresh promise installed by a
     * concurrent caller isn't accidentally cleared.
     */
    private evictCreateStreamIfStale;
    pipe<T>(key: string, source: AsyncIterable<T> | ReadableStream<T>, options?: RealtimeStreamOperationOptions): RealtimeStreamInstance<T>;
    append<TPart extends BodyInit>(key: string, part: TPart, options?: RealtimeStreamOperationOptions): Promise<void>;
    hasActiveStreams(): boolean;
    waitForAllStreams(timeout?: number): Promise<void>;
}
