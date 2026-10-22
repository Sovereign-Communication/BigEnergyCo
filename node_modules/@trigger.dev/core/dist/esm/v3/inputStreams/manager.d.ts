import type { ApiClient } from "../apiClient/index.js";
import type { InputStreamManager } from "./types.js";
import { InputStreamOncePromise } from "./types.js";
import type { InputStreamOnceOptions } from "../realtimeStreams/types.js";
type InputStreamHandler = (data: unknown) => void | Promise<void>;
export declare class StandardInputStreamManager implements InputStreamManager {
    #private;
    private apiClient;
    private baseUrl;
    private debug;
    private handlers;
    private onceWaiters;
    private buffer;
    private tails;
    private seqNums;
    private currentRunId;
    private streamsVersion;
    private reconnectAttempts;
    private explicitlyDisconnected;
    constructor(apiClient: ApiClient, baseUrl: string, debug?: boolean);
    lastSeqNum(streamId: string): number | undefined;
    setLastSeqNum(streamId: string, seqNum: number): void;
    shiftBuffer(streamId: string): boolean;
    setRunId(runId: string, streamsVersion?: string): void;
    on(streamId: string, handler: InputStreamHandler): {
        off: () => void;
    };
    once(streamId: string, options?: InputStreamOnceOptions): InputStreamOncePromise<unknown>;
    peek(streamId: string): unknown | undefined;
    clearHandlers(): void;
    disconnectStream(streamId: string): void;
    connectTail(runId: string, _fromSeq?: number): void;
    /**
     * Tear down all active tails. Does NOT clear handlers or `onceWaiters`,
     * so any registered listener will trigger an auto-reconnect (with
     * backoff) the moment it sees no live tail — by design, so a transient
     * network blip recovers without the caller re-subscribing. Use
     * `reset()` if you want a full clean state with no resurrection, or
     * `disconnectStream(streamId)` for a single stream that should stay
     * down until a fresh `on()` / `once()` attaches.
     */
    disconnect(): void;
    reset(): void;
}
export {};
