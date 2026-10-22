import type { InputStreamOnceOptions } from "../realtimeStreams/types.js";
import { InputStreamOncePromise } from "../inputStreams/types.js";
import type { SessionChannelIO, SessionStreamManager, SessionStreamRecord, SessionStreamRecordPredicate } from "./types.js";
export declare class NoopSessionStreamManager implements SessionStreamManager {
    on(_sessionId: string, _io: SessionChannelIO, _handler: (data: unknown) => void | boolean | Promise<void>): {
        off: () => void;
    };
    onRecord(_sessionId: string, _io: SessionChannelIO, _handler: (record: SessionStreamRecord) => void | boolean | Promise<void>): {
        off: () => void;
    };
    once(_sessionId: string, _io: SessionChannelIO, _options?: InputStreamOnceOptions): InputStreamOncePromise<unknown>;
    onceRecord(_sessionId: string, _io: SessionChannelIO, _options?: InputStreamOnceOptions): InputStreamOncePromise<SessionStreamRecord>;
    onceRecordWhere(_sessionId: string, _io: SessionChannelIO, _predicate: SessionStreamRecordPredicate, _options?: InputStreamOnceOptions): InputStreamOncePromise<SessionStreamRecord>;
    peek(_sessionId: string, _io: SessionChannelIO): unknown | undefined;
    peekRecord(_sessionId: string, _io: SessionChannelIO): SessionStreamRecord | undefined;
    lastSeqNum(_sessionId: string, _io: SessionChannelIO): number | undefined;
    setLastSeqNum(_sessionId: string, _io: SessionChannelIO, _seqNum: number): void;
    consumeRecord(_sessionId: string, _io: SessionChannelIO, _seqNum: number): void;
    lastDispatchedSeqNum(_sessionId: string, _io: SessionChannelIO): number | undefined;
    setLastDispatchedSeqNum(_sessionId: string, _io: SessionChannelIO, _seqNum: number): void;
    setMinTimestamp(_sessionId: string, _io: SessionChannelIO, _minTimestamp: number | undefined): void;
    shiftBuffer(_sessionId: string, _io: SessionChannelIO): boolean;
    disconnectStream(_sessionId: string, _io: SessionChannelIO): void;
    reconnectStream(_sessionId: string, _io: SessionChannelIO): void;
    clearHandlers(): void;
    reset(): void;
    disconnect(): void;
}
