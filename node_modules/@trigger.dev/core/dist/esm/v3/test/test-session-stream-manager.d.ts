import { InputStreamOncePromise } from "../inputStreams/types.js";
import type { InputStreamOnceOptions } from "../realtimeStreams/types.js";
import type { SessionChannelIO, SessionStreamManager, SessionStreamRecord, SessionStreamRecordPredicate } from "../sessionStreams/types.js";
type Handler = (data: unknown) => void | boolean | Promise<void>;
type RecordHandler = (record: SessionStreamRecord) => void | boolean | Promise<void>;
/**
 * In-memory implementation of `SessionStreamManager` for unit tests. Same
 * shape as {@link TestInputStreamManager} but keyed on `(sessionId, io)`.
 *
 * Tests push data via `__sendFromTest(sessionId, io, data)` — any pending
 * `once()` waiters resolve immediately, and all `on()` handlers fire (awaited
 * if they return a promise). Records that arrive before a listener is
 * registered are buffered so the first `once()` picks them up.
 */
export declare class TestSessionStreamManager implements SessionStreamManager {
    #private;
    private handlers;
    private onceWaiters;
    private buffer;
    private seqNums;
    private dispatchedSeqNums;
    on(sessionId: string, io: SessionChannelIO, handler: Handler): {
        off: () => void;
    };
    onRecord(sessionId: string, io: SessionChannelIO, handler: RecordHandler): {
        off: () => void;
    };
    once(sessionId: string, io: SessionChannelIO, options?: InputStreamOnceOptions): InputStreamOncePromise<unknown>;
    onceRecord(sessionId: string, io: SessionChannelIO, options?: InputStreamOnceOptions): InputStreamOncePromise<SessionStreamRecord>;
    onceRecordWhere(sessionId: string, io: SessionChannelIO, predicate: SessionStreamRecordPredicate, options?: InputStreamOnceOptions): InputStreamOncePromise<SessionStreamRecord>;
    peek(sessionId: string, io: SessionChannelIO): unknown | undefined;
    peekRecord(sessionId: string, io: SessionChannelIO): SessionStreamRecord | undefined;
    lastSeqNum(sessionId: string, io: SessionChannelIO): number | undefined;
    setLastSeqNum(sessionId: string, io: SessionChannelIO, seqNum: number): void;
    consumeRecord(sessionId: string, io: SessionChannelIO, seqNum: number): void;
    lastDispatchedSeqNum(sessionId: string, io: SessionChannelIO): number | undefined;
    setLastDispatchedSeqNum(sessionId: string, io: SessionChannelIO, seqNum: number): void;
    setMinTimestamp(_sessionId: string, _io: SessionChannelIO, _minTimestamp: number | undefined): void;
    shiftBuffer(sessionId: string, io: SessionChannelIO): boolean;
    disconnectStream(_sessionId: string, _io: SessionChannelIO): void;
    clearHandlers(): void;
    reset(): void;
    disconnect(): void;
    /**
     * Push a record onto the given channel.
     *
     * Dispatch rules — same as the production manager:
     *
     * 1. **A pending `.once` waiter consumes first.** Handlers still observe
     *    a copy.
     * 2. **Otherwise handlers observe.** A handler that synchronously
     *    returns `true` consumes the record (kind-filtering facades do this
     *    for the kinds they own) — it is NOT buffered.
     * 3. **Records no one consumed are buffered** for the next `.once` call
     *    or the next consuming `on()` attach.
     *
     * Handler promises are awaited before resolving so test code can rely
     * on async handler work having settled by the time `__sendFromTest`
     * resolves. Consumption is decided on the synchronous return value,
     * exactly like production.
     */
    __sendFromTest(sessionId: string, io: SessionChannelIO, data: unknown, metadata?: {
        id?: string;
        seqNum?: number;
    }): Promise<void>;
    /**
     * Immediately resolve every pending `once()` waiter for the given channel
     * with a timeout error. Simulates a closed stream (e.g. session closed).
     */
    __closeFromTest(sessionId: string, io: SessionChannelIO): void;
    private removeWaiter;
}
export {};
