import type { InputStreamManager } from "../inputStreams/types.js";
import { InputStreamOncePromise } from "../inputStreams/types.js";
import type { InputStreamOnceOptions } from "../realtimeStreams/types.js";
type Handler = (data: unknown) => void | Promise<void>;
/**
 * In-memory implementation of `InputStreamManager` for unit tests.
 *
 * Tests push data via the driver's `.send(streamId, data)` method. Any
 * pending `.once()` waiters resolve immediately, and all `.on()` handlers
 * fire synchronously (awaited if they return a promise).
 *
 * Use this alongside {@link runInMockTaskContext} — not directly.
 */
export declare class TestInputStreamManager implements InputStreamManager {
    private handlers;
    private onceWaiters;
    private latest;
    private lastSeqNums;
    private pendingSends;
    setRunId(_runId: string, _streamsVersion?: string): void;
    on(streamId: string, handler: Handler): {
        off: () => void;
    };
    once(streamId: string, options?: InputStreamOnceOptions): InputStreamOncePromise<unknown>;
    peek(streamId: string): unknown | undefined;
    lastSeqNum(streamId: string): number | undefined;
    setLastSeqNum(streamId: string, seqNum: number): void;
    shiftBuffer(_streamId: string): boolean;
    disconnectStream(_streamId: string): void;
    clearHandlers(): void;
    reset(): void;
    disconnect(): void;
    connectTail(_runId: string, _fromSeq?: number): void;
    /**
     * Push data onto an input stream. Resolves pending `once()` waiters
     * and fires all `on()` handlers (awaiting async handlers).
     */
    __sendFromTest(streamId: string, data: unknown): Promise<void>;
    /**
     * Immediately resolve every pending `once()` waiter for a stream with a
     * timeout error. Used to simulate closed streams (e.g. `exitAfterPreloadIdle`).
     */
    __closeFromTest(streamId: string): void;
    private removeWaiter;
}
export {};
