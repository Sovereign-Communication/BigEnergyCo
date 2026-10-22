/**
 * Shared HTTP/2 connection pool for the s2s transport.
 *
 * Connections are pooled per endpoint and HTTP/2 settings, opened lazily on
 * the first request. Each connection carries up to
 * `maxConcurrentStreamsPerConnection` concurrent streams; beyond that,
 * additional connections are opened.
 */
import type { OutgoingHttpHeaders } from "node:http";
import type { ClientHttp2Stream } from "node:http2";
import type { Http2Settings } from "../../types.js";
interface RequestStreamOptions {
    connectionTimeoutMillis?: number;
    http2?: Http2Settings;
}
export declare class Http2ConnectionPool {
    private readonly endpoints;
    private readonly maxStreamsPerConnection;
    constructor(options?: {
        maxConcurrentStreamsPerConnection?: number;
    });
    /**
     * Register as a user of an endpoint. Must be paired with a `detach` call
     * with the same settings; connections are shared by all users attached
     * with equal settings and closed on last detach.
     */
    attach(origin: string, http2?: Http2Settings): void;
    /**
     * The inverse of `attach`. When the last user detaches, all connections
     * to the endpoint are closed gracefully.
     */
    detach(origin: string, http2?: Http2Settings): Promise<void>;
    /**
     * Open a new HTTP/2 stream to the endpoint, reusing a pooled connection
     * with spare capacity or opening a new one. Requires a prior `attach`.
     */
    request(origin: string, headers: OutgoingHttpHeaders, options?: RequestStreamOptions): Promise<ClientHttp2Stream>;
    /** Number of live pooled connections to an endpoint. */
    connectionCount(origin: string, http2?: Http2Settings): number;
    private openStream;
    private startConnect;
    private connect;
    private evict;
}
/** Process-wide pool shared by all s2s transports. */
export declare const sharedConnectionPool: Http2ConnectionPool;
export {};
//# sourceMappingURL=pool.d.ts.map