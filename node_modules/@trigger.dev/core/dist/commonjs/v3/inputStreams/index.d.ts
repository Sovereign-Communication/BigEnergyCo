import type { InputStreamManager, InputStreamOncePromise } from "./types.js";
import type { InputStreamOnceOptions } from "../realtimeStreams/types.js";
export declare class InputStreamsAPI implements InputStreamManager {
    #private;
    private static _instance?;
    private constructor();
    static getInstance(): InputStreamsAPI;
    setGlobalManager(manager: InputStreamManager): boolean;
    setRunId(runId: string, streamsVersion?: string): void;
    on(streamId: string, handler: (data: unknown) => void | Promise<void>): {
        off: () => void;
    };
    once(streamId: string, options?: InputStreamOnceOptions): InputStreamOncePromise<unknown>;
    peek(streamId: string): unknown | undefined;
    lastSeqNum(streamId: string): number | undefined;
    setLastSeqNum(streamId: string, seqNum: number): void;
    shiftBuffer(streamId: string): boolean;
    disconnectStream(streamId: string): void;
    clearHandlers(): void;
    reset(): void;
    disconnect(): void;
    connectTail(runId: string, fromSeq?: number): void;
}
