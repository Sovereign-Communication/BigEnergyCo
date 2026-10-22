import { type CompressionType } from "./framing.js";
export declare function assertCompressionSupported(type: CompressionType): Promise<void>;
/**
 * Build the `Accept-Encoding` header value advertising algorithms the client
 * can decode. Returns `undefined` when no compression is configured.
 */
export declare function acceptEncodingHeader(compression: CompressionType): Promise<string | undefined>;
export declare function compressFrameBody(body: Uint8Array, type: CompressionType): Promise<Uint8Array>;
export declare function decompressFrameBody(body: Uint8Array, type: CompressionType): Uint8Array;
//# sourceMappingURL=compression.d.ts.map