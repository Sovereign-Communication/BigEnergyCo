import type { ApiClient } from "../apiClient/index.js";
import type { AsyncIterableStream } from "../streams/asyncIterableStream.js";
import type { AnyZodFetchOptions } from "../zodfetch.js";
import type { StreamsWriter, StreamWriteResult } from "./types.js";
export type CreateStreamResponseLike = {
    version: string;
    headers?: Record<string, string>;
};
export type StreamInstanceOptions<T> = {
    apiClient: ApiClient;
    baseUrl: string;
    runId: string;
    key: string;
    source: ReadableStream<T>;
    signal?: AbortSignal;
    requestOptions?: AnyZodFetchOptions;
    target?: "self" | "parent" | "root" | string;
    debug?: boolean;
    /**
     * Optional override for the create-stream call. Defaults to
     * `apiClient.createStream(runId, "self", key, requestOptions)`. The
     * manager passes a cached version so repeated `pipe()` calls for the
     * same `(runId, key)` share a single PUT instead of hammering the
     * server on every chunk.
     */
    createStream?: () => Promise<CreateStreamResponseLike>;
};
export declare class StreamInstance<T> implements StreamsWriter {
    private options;
    private streamPromise;
    constructor(options: StreamInstanceOptions<T>);
    private initializeWriter;
    wait(): Promise<StreamWriteResult>;
    get stream(): AsyncIterableStream<T>;
}
