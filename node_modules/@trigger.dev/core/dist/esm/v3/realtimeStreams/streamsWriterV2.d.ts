import { ChatChunkTooLargeError } from "../errors.js";
import type { StreamsWriter, StreamWriteResult } from "./types.js";
export type StreamsWriterV2Options<T = any> = {
    basin: string;
    stream: string;
    accessToken: string;
    endpoint?: string;
    source: ReadableStream<T>;
    signal?: AbortSignal;
    flushIntervalMs?: number;
    maxRetries?: number;
    debug?: boolean;
    maxInflightBytes?: number;
};
/**
 * StreamsWriterV2 writes metadata stream data directly to S2 (https://s2.dev).
 *
 * Features:
 * - Direct streaming: Uses S2's appendSession for efficient streaming
 * - Automatic batching: Uses BatchTransform to batch records
 * - No manual buffering: S2 handles buffering internally
 * - Debug logging: Enable with debug: true to see detailed operation logs
 *
 * Example usage:
 * ```typescript
 * const stream = new StreamsWriterV2({
 *   basin: "my-basin",
 *   stream: "my-stream",
 *   accessToken: "s2-token-here",
 *   source: myAsyncIterable,
 *   flushIntervalMs: 200, // Optional: batch linger duration in ms
 *   debug: true, // Optional: enable debug logging
 * });
 *
 * // Wait for streaming to complete
 * await stream.wait();
 *
 * // Or consume the stream
 * for await (const value of stream) {
 *   console.log(value);
 * }
 * ```
 */
export declare class StreamsWriterV2<T = any> implements StreamsWriter {
    private options;
    private s2Client;
    private serverStream;
    private consumerStream;
    private streamPromise;
    private readonly flushIntervalMs;
    private readonly debug;
    private readonly maxInflightBytes;
    private aborted;
    private sessionWritable;
    private lastSeqNum;
    constructor(options: StreamsWriterV2Options<T>);
    private handleAbort;
    private initializeServerStream;
    wait(): Promise<StreamWriteResult>;
    [Symbol.asyncIterator](): AsyncIterableIterator<T>;
    private log;
    private logError;
}
/**
 * Encode a chunk as a JSON record body for S2, enforcing the per-record
 * size cap. Exported so the size/discriminant logic can be unit-tested
 * directly without spinning up an S2 client or mocking `@s2-dev/streamstore`.
 *
 * Returns `{ ok: true, body }` when the encoded chunk fits within
 * `RECORD_BODY_MAX_BYTES`, or `{ ok: false, error }` carrying a
 * `ChatChunkTooLargeError` annotated with the chunk's discriminant
 * (`type` or `kind`, whichever is present) so the surfaced error is
 * useful — "tool-output-available chunk too large" beats a bare
 * "chunk too large" by a lot.
 */
export declare function encodeChunkOrError(chunk: unknown): {
    ok: true;
    body: string;
} | {
    ok: false;
    error: ChatChunkTooLargeError;
};
