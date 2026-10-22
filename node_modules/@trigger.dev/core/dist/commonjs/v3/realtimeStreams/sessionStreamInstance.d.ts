import type { ApiClient } from "../apiClient/index.js";
import type { AsyncIterableStream } from "../streams/asyncIterableStream.js";
import type { AnyZodFetchOptions } from "../zodfetch.js";
import type { StreamsWriter, StreamWriteResult } from "./types.js";
export type InitializeSessionStreamResponseLike = {
    headers?: Record<string, string>;
};
export type SessionStreamInstanceOptions<T> = {
    apiClient: ApiClient;
    baseUrl: string;
    sessionId: string;
    io: "out" | "in";
    source: ReadableStream<T>;
    signal?: AbortSignal;
    requestOptions?: AnyZodFetchOptions;
    debug?: boolean;
    /**
     * Optional override for the initialize-session-stream call. Defaults to
     * `apiClient.initializeSessionStream(sessionId, io, requestOptions)`. The
     * channel passes a cached version so repeated `pipe()` / `writer()`
     * calls for the same `(sessionId, io)` share a single PUT instead of
     * hammering the server on every chunk.
     */
    initializeSession?: () => Promise<InitializeSessionStreamResponseLike>;
};
/**
 * Session-scoped parallel to {@link StreamInstance}. Calls
 * `initializeSessionStream` to fetch S2 credentials for the session's
 * channel, then pipes `source` directly to S2 via {@link StreamsWriterV2}.
 *
 * Sessions are S2-only — there's no v1 (Redis) fallback — so this
 * skips the version-detection dance `StreamInstance` does.
 */
export declare class SessionStreamInstance<T> implements StreamsWriter {
    private options;
    private streamPromise;
    constructor(options: SessionStreamInstanceOptions<T>);
    private initializeWriter;
    wait(): Promise<StreamWriteResult>;
    get stream(): AsyncIterableStream<T>;
}
