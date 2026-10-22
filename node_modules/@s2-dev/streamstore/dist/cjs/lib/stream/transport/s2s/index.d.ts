/**
 * S2S HTTP/2 transport for Node.js
 * Uses the s2s binary protocol over HTTP/2 for efficient streaming
 *
 * This file should only be imported in Node.js environments
 */
import type { S2RequestOptions } from "../../../../common.js";
import type { AppendSession, AppendSessionOptions, ReadArgs, ReadSession, SessionTransport, TransportConfig } from "../../types.js";
export declare class S2STransport implements SessionTransport {
    private readonly transportConfig;
    private readonly compression;
    private readonly endpointOrigin;
    private attached;
    private closed;
    private closingPromise?;
    constructor(config: TransportConfig);
    makeAppendSession(stream: string, sessionOptions?: AppendSessionOptions, requestOptions?: S2RequestOptions): Promise<AppendSession>;
    makeReadSession<Format extends "string" | "bytes" = "string">(stream: string, args?: ReadArgs<Format>, options?: S2RequestOptions): Promise<ReadSession<Format>>;
    /** Open an HTTP/2 stream through the shared connection pool. */
    private openH2Stream;
    close(): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map