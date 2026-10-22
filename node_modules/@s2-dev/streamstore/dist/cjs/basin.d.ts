import type { RetryConfig, S2Compression } from "./common.js";
import type { EncryptionKeyInput } from "./lib/encryption.js";
import * as Redacted from "./lib/redacted.js";
import type { Http2Settings, SessionTransports } from "./lib/stream/types.js";
import { S2Stream } from "./stream.js";
import { S2Streams } from "./streams.js";
export declare class S2Basin {
    private readonly client;
    private readonly transportConfig;
    private readonly retryConfig?;
    readonly name: string;
    readonly streams: S2Streams;
    /**
     * Create a basin-scoped client that talks to `https://{basin}.b.s2.dev/v1`.
     *
     * Use this to work with streams inside a single basin.
     * @param name Basin name
     * @param options Configuration for the basin-scoped client
     */
    constructor(name: string, options: {
        accessToken: Redacted.Redacted;
        baseUrl: string;
        includeBasinHeader: boolean;
        retryConfig?: RetryConfig;
        compression?: S2Compression;
        http2?: Http2Settings;
    });
    /**
     * Create a stream-scoped helper bound to `this` basin.
     * @param name Stream name
     */
    stream(name: string, options?: StreamOptions): S2Stream;
}
export interface StreamOptions {
    forceTransport?: SessionTransports;
    /**
     * Client-supplied encryption key for append/read operations on this stream.
     *
     * Accepts either base64-encoded key material or raw bytes.
     */
    encryptionKey?: EncryptionKeyInput;
}
//# sourceMappingURL=basin.d.ts.map