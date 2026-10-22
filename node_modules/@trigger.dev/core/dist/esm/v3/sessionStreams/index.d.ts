import type { InputStreamOncePromise, SessionChannelIO, SessionStreamManager, SessionStreamRecord, SessionStreamRecordPredicate } from "./types.js";
import type { InputStreamOnceOptions } from "../realtimeStreams/types.js";
export declare class SessionStreamsAPI implements SessionStreamManager {
    #private;
    private static _instance?;
    private constructor();
    static getInstance(): SessionStreamsAPI;
    setGlobalManager(manager: SessionStreamManager): boolean;
    on(sessionId: string, io: SessionChannelIO, handler: (data: unknown) => void | boolean | Promise<void>, channel?: string): {
        off: () => void;
    };
    onRecord(sessionId: string, io: SessionChannelIO, handler: (record: SessionStreamRecord) => void | boolean | Promise<void>, channel?: string): {
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
    reconnectStream(sessionId: string, io: SessionChannelIO, channel?: string): void;
    disconnectStream(sessionId: string, io: SessionChannelIO, channel?: string): void;
    clearHandlers(): void;
    reset(): void;
    disconnect(): void;
}
