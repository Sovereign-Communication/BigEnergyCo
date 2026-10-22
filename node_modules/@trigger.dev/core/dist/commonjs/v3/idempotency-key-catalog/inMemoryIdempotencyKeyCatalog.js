"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryIdempotencyKeyCatalog = void 0;
/**
 * Maps an idempotency-key hash back to the original user-provided key and scope.
 *
 * The mapping is held for the lifetime of a single run: the worker clears it at
 * each run boundary (warm starts reuse the process), so it never accumulates
 * across runs. Within a run every registered key is retained regardless of how
 * many are created, so the key/scope metadata is never silently dropped.
 */
class InMemoryIdempotencyKeyCatalog {
    cache = new Map();
    registerKeyOptions(hash, options) {
        this.cache.set(hash, options);
    }
    getKeyOptions(hash) {
        return this.cache.get(hash);
    }
    clear() {
        this.cache.clear();
    }
}
exports.InMemoryIdempotencyKeyCatalog = InMemoryIdempotencyKeyCatalog;
//# sourceMappingURL=inMemoryIdempotencyKeyCatalog.js.map