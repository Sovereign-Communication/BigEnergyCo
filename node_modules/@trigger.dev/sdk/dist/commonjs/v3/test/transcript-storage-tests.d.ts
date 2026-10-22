import { type TranscriptStorage } from "../transcriptStorage.js";
type TestApi = {
    describe: (name: string, fn: () => void) => void;
    it: (name: string, fn: () => Promise<void> | void) => void;
    expect: (actual: unknown) => {
        toEqual: (expected: unknown) => void;
        toBeNull: () => void;
        toBeUndefined: () => void;
        toBe: (expected: unknown) => void;
        toHaveLength: (length: number) => void;
    };
};
export type TranscriptStorageTestOptions = {
    /**
     * The test framework's `describe`, `it` and `expect`. Defaults to the
     * globals a vitest or jest run with `globals: true` provides.
     */
    api?: TestApi;
    /**
     * A chat id the storage accepts. Each test appends a suffix so tests do
     * not see each other's rows. Defaults to `"transcript-conformance"`.
     */
    chatId?: string;
    /** The `clientData` the storage expects in every scope and context. */
    clientData?: unknown;
};
/**
 * The contract every `TranscriptStorage` has to meet, as a test suite. Point
 * it at a factory for your storage and run it under vitest or jest:
 *
 * ```ts
 * import { runTranscriptStorageTests } from "@trigger.dev/sdk/ai/test";
 * runTranscriptStorageTests(() => myTranscriptStorage(testDatabaseUrl));
 * ```
 *
 * The factory runs once per test. Return a fresh, empty storage, or one
 * whose chats are isolated by the `chatId` option.
 */
export declare function runTranscriptStorageTests<TClientData = unknown>(makeStorage: () => TranscriptStorage<TClientData> | Promise<TranscriptStorage<TClientData>>, options?: TranscriptStorageTestOptions): void;
export {};
