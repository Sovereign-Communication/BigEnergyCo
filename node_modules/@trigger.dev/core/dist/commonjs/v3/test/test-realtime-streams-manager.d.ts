import type { RealtimeStreamInstance, RealtimeStreamOperationOptions, RealtimeStreamsManager } from "../realtimeStreams/types.js";
/**
 * In-memory implementation of `RealtimeStreamsManager` for unit tests.
 * Collects every chunk that tasks write via `pipe()` or `append()` into
 * per-stream buffers that tests can inspect.
 *
 * Use this alongside {@link runInMockTaskContext} — not directly.
 */
type WriteListener = (key: string, chunk: unknown) => void;
export declare class TestRealtimeStreamsManager implements RealtimeStreamsManager {
    private buffers;
    private pipeWaits;
    private writeListeners;
    pipe<T>(key: string, source: AsyncIterable<T> | ReadableStream<T>, _options?: RealtimeStreamOperationOptions): RealtimeStreamInstance<T>;
    append<TPart extends BodyInit>(key: string, part: TPart, _options?: RealtimeStreamOperationOptions): Promise<void>;
    /**
     * Register a listener fired for every chunk written to any stream.
     * Returns an unsubscribe function.
     *
     * Intended for test harnesses that need to react to writes synchronously
     * (e.g. resolving a "turn complete" latch).
     */
    onWrite(listener: WriteListener): () => void;
    private notify;
    /**
     * Return all chunks written to the given stream key in order of write.
     */
    __chunksFromTest<T = unknown>(key: string): T[];
    /**
     * Return all chunks across every stream, keyed by stream id.
     */
    __allChunksFromTest(): Record<string, unknown[]>;
    /**
     * Clear the buffer for a specific stream or all streams.
     */
    __clearFromTest(key?: string): void;
    reset(): void;
    private getBuffer;
}
export {};
