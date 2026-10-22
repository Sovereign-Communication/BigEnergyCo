import type { IdempotencyKeyCatalog, IdempotencyKeyOptions } from "./catalog.js";
/**
 * Maps an idempotency-key hash back to the original user-provided key and scope.
 *
 * The mapping is held for the lifetime of a single run: the worker clears it at
 * each run boundary (warm starts reuse the process), so it never accumulates
 * across runs. Within a run every registered key is retained regardless of how
 * many are created, so the key/scope metadata is never silently dropped.
 */
export declare class InMemoryIdempotencyKeyCatalog implements IdempotencyKeyCatalog {
    private cache;
    registerKeyOptions(hash: string, options: IdempotencyKeyOptions): void;
    getKeyOptions(hash: string): IdempotencyKeyOptions | undefined;
    clear(): void;
}
