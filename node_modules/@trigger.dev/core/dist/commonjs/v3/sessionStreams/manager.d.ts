import type { ApiClient } from "../apiClient/index.js";
import { InputStreamOncePromise } from "../inputStreams/types.js";
import type { InputStreamOnceOptions } from "../realtimeStreams/types.js";
import type { SessionChannelIO, SessionStreamManager, SessionStreamRecord, SessionStreamRecordPredicate } from "./types.js";
type SessionStreamHandler = (data: unknown) => void | boolean | Promise<void>;
/**
 * A handler that sees the whole record rather than just its payload. Consumers
 * that route by sequence number need the metadata, the same reason
 * `onceRecord` exists alongside `once`.
 */
type SessionStreamRecordHandler = (record: SessionStreamRecord) => void | boolean | Promise<void>;
/**
 * Session-scoped parallel to {@link StandardInputStreamManager}. Keeps the
 * same buffer / once-waiter / tail lifecycle, but keyed on
 * `(sessionId, io)` and subscribing via
 * {@link ApiClient.subscribeToSessionStream} instead of the run input
 * stream SSE.
 */
export declare class StandardSessionStreamManager implements SessionStreamManager {
    #private;
    private apiClient;
    private baseUrl;
    private debug;
    private handlers;
    private onceWaiters;
    private buffer;
    private tails;
    private minTimestamps;
    private explicitlyDisconnected;
    private seqNums;
    private unconsumedSeqNums;
    private lastDispatchedSeqNums;
    private reconnectAttempts;
    constructor(apiClient: ApiClient, baseUrl: string, debug?: boolean);
    on(sessionId: string, io: SessionChannelIO, handler: SessionStreamHandler, channel?: string): {
        off: () => void;
    };
    /**
     * Register a handler that receives the full record, including its sequence
     * number. Same consume semantics as {@link on}: returning `true` consumes.
     */
    onRecord(sessionId: string, io: SessionChannelIO, handler: SessionStreamRecordHandler, channel?: string): {
        off: () => void;
    };
    once(sessionId: string, io: SessionChannelIO, options?: InputStreamOnceOptions, channel?: string): InputStreamOncePromise<unknown>;
    onceRecord(sessionId: string, io: SessionChannelIO, options?: InputStreamOnceOptions, channel?: string): InputStreamOncePromise<SessionStreamRecord>;
    onceRecordWhere(sessionId: string, io: SessionChannelIO, predicate: SessionStreamRecordPredicate, options?: InputStreamOnceOptions, channel?: string): InputStreamOncePromise<SessionStreamRecord>;
    peek(sessionId: string, io: SessionChannelIO, channel?: string): unknown | undefined;
    peekRecord(sessionId: string, io: SessionChannelIO, channel?: string): SessionStreamRecord | undefined;
    lastSeqNum(sessionId: string, io: SessionChannelIO, channel?: string): number | undefined;
    setLastSeqNum(sessionId: string, io: SessionChannelIO, seqNum: number, channel?: string): void;
    consumeRecord(sessionId: string, io: SessionChannelIO, seqNum: number, channel?: string): void;
    lastDispatchedSeqNum(sessionId: string, io: SessionChannelIO, channel?: string): number | undefined;
    setLastDispatchedSeqNum(sessionId: string, io: SessionChannelIO, seqNum: number, channel?: string): void;
    setMinTimestamp(sessionId: string, io: SessionChannelIO, minTimestamp: number | undefined, channel?: string): void;
    shiftBuffer(sessionId: string, io: SessionChannelIO, channel?: string): boolean;
    disconnectStream(sessionId: string, io: SessionChannelIO, channel?: string): void;
    /**
     * Re-open a channel that `disconnectStream` closed, without registering a
     * new consumer. A single long-lived reader (the session channel router) has
     * to be able to bring its own tail back after a suspend, and re-attaching
     * its handler just to clear the suppression flag would replay the buffer at
     * it.
     */
    reconnectStream(sessionId: string, io: SessionChannelIO, channel?: string): void;
    clearHandlers(): void;
    /**
     * Tear down all active tails. Does NOT clear handlers or `onceWaiters`,
     * so any registered listener will trigger an auto-reconnect (with
     * backoff) the moment it sees no live tail — by design, so a transient
     * network blip recovers without the caller re-subscribing. Use
     * `reset()` if you want a full clean state with no resurrection, or
     * `disconnectStream(sessionId, io)` for a single channel that should
     * stay down until a fresh `on()` / `once()` attaches.
     */
    disconnect(): void;
    reset(): void;
}
export {};
