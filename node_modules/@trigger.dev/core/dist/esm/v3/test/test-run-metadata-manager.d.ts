import type { DeserializedJson } from "../../schemas/json.js";
import type { AsyncIterableStream } from "../streams/asyncIterableStream.js";
import type { RunMetadataManager, RunMetadataUpdater } from "../runMetadata/types.js";
/**
 * In-memory implementation of `RunMetadataManager` for unit tests.
 *
 * Just stores metadata in a Map — no API calls, no queue. Good enough
 * for tests that read/write metadata via `runMetadata.getKey()` /
 * `runMetadata.set()`, including the IDLE_TIMEOUT and TURN_TIMEOUT
 * checks inside `chat.agent()`.
 */
export declare class TestRunMetadataManager implements RunMetadataManager {
    private store;
    enterWithMetadata(metadata: Record<string, DeserializedJson>): void;
    current(): Record<string, DeserializedJson> | undefined;
    getKey(key: string): DeserializedJson | undefined;
    set(key: string, value: DeserializedJson): this;
    del(key: string): this;
    append(key: string, value: DeserializedJson): this;
    remove(key: string, value: DeserializedJson): this;
    increment(key: string, value: number): this;
    decrement(key: string, value: number): this;
    update(metadata: Record<string, DeserializedJson>): this;
    flush(): Promise<void>;
    refresh(): Promise<void>;
    stream<T>(_key: string, value: AsyncIterable<T> | ReadableStream<T>): Promise<AsyncIterable<T>>;
    fetchStream<T>(_key: string): Promise<AsyncIterableStream<T>>;
    get parent(): RunMetadataUpdater;
    get root(): RunMetadataUpdater;
    reset(): void;
}
