export declare function assertExhaustive(x: never): never;
/**
 * Lowercases, collapses each run of characters outside [\p{L}\p{N}_./:@+-] to a single space,
 * and strips spaces adjacent to ":". Single-pass; the equivalent two-regex form is ~4x slower
 * on multi-KB inputs and this runs in the ingest hot path.
 */
export declare function normalizeSearchText(value: string): string;
export declare function tryCatch<T, E = Error>(promise: Promise<T> | undefined): Promise<[null, T] | [E, null]>;
export type Deferred<T> = {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: any) => void;
};
export declare function promiseWithResolvers<T>(): Deferred<T>;
