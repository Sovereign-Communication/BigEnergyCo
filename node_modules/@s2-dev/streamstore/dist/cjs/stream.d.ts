import type { RetryConfig, S2RequestOptions } from "./common.js";
import type { Client } from "./generated/client/types.gen.js";
import { type EncryptionKeyInput } from "./lib/encryption.js";
import type { AppendSession, ReadSession, TransportConfig } from "./lib/stream/types.js";
import type * as Types from "./types.js";
/**
 * Basin-scoped stream helper for append/read operations.
 *
 * Created via {@link S2Basin.stream}. Provides direct methods plus factories for read/append sessions.
 */
export declare class S2Stream {
    private readonly client;
    private readonly transportConfig;
    private readonly retryConfig?;
    private _transportPromise?;
    private closed;
    private closePromise?;
    readonly name: string;
    constructor(name: string, client: Client, transportConfig: TransportConfig, retryConfig?: RetryConfig);
    /**
     * Get or create the transport instance
     */
    private getTransport;
    private ensureOpen;
    private withEncryptionHeaders;
    /**
     * Return a new stream handle that sends the supplied encryption key on append/read requests.
     */
    withEncryptionKey(encryptionKey: EncryptionKeyInput): S2Stream;
    /**
     * Check the tail of the stream.
     *
     * Returns the next sequence number and timestamp to be assigned (`tail`).
     */
    checkTail(options?: S2RequestOptions): Promise<Types.TailResponse>;
    /**
     * Read records from the stream.
     *
     * - When `as: "bytes"` is provided, bodies and headers are decoded from base64 to `Uint8Array`.
     * - Supports starting position by `seq_num`, `timestamp`, or `tail_offset` and can clamp to the tail.
     * - Non-streaming reads are bounded by `count` and `bytes` (defaults 1000 and 1 MiB).
     * - When `ignoreCommandRecords` is set, command records are filtered from the single
     *   returned batch, which may then be empty. Use `readSession` to keep reading until
     *   data records are found.
     */
    read<Format extends "string" | "bytes" = "string">(input?: Types.ReadInput, options?: S2RequestOptions & {
        as?: Format;
    }): Promise<Types.ReadBatch<Format>>;
    /**
     * Append a batch of records to the stream.
     *
     * - Supports conditional appends via `fencingToken` and `matchSeqNum` in the input.
     * - Returns the acknowledged range and the stream tail after the append.
     * - A batch may contain both string and bytes records.
     *
     * Use {@link AppendInput.create} to construct a validated AppendInput.
     * For high-throughput sequential appends, use `appendSession()` instead.
     *
     * @param input The append input containing records and optional conditions
     * @param options Optional request options
     */
    append(input: Types.AppendInput, options?: S2RequestOptions): Promise<Types.AppendAck>;
    /**
     * Open a streaming read session
     *
     * Use the returned session as an async iterable or as a readable stream.
     * When `as: "bytes"` is provided, bodies and headers are decoded to `Uint8Array`.
     */
    readSession<Format extends "string" | "bytes" = "string">(input?: Types.ReadInput, options?: S2RequestOptions & {
        as?: Format;
    }): Promise<ReadSession<Format>>;
    /**
     * Create an append session that guarantees ordering of submissions.
     *
     * Use this to coordinate high-throughput, sequential appends with backpressure.
     * Records can be either string or bytes format - the format is specified in each record.
     *
     * @param sessionOptions Options that control append session behavior
     * @param requestOptions Optional request options
     */
    appendSession(sessionOptions?: Types.AppendSessionOptions, requestOptions?: S2RequestOptions): Promise<AppendSession>;
    close(): Promise<void>;
    [Symbol.asyncDispose](): Promise<void>;
}
//# sourceMappingURL=stream.d.ts.map