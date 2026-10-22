import type { InputStreamManager } from "./types.js";
import { InputStreamOncePromise } from "./types.js";
import type { InputStreamOnceOptions } from "../realtimeStreams/types.js";
export declare class NoopInputStreamManager implements InputStreamManager {
    setRunId(_runId: string, _streamsVersion?: string): void;
    on(_streamId: string, _handler: (data: unknown) => void | Promise<void>): {
        off: () => void;
    };
    once(_streamId: string, _options?: InputStreamOnceOptions): InputStreamOncePromise<unknown>;
    peek(_streamId: string): unknown | undefined;
    lastSeqNum(_streamId: string): number | undefined;
    setLastSeqNum(_streamId: string, _seqNum: number): void;
    shiftBuffer(_streamId: string): boolean;
    disconnectStream(_streamId: string): void;
    clearHandlers(): void;
    reset(): void;
    disconnect(): void;
    connectTail(_runId: string, _fromSeq?: number): void;
}
