/**
 * In-memory implementation of `RunMetadataManager` for unit tests.
 *
 * Just stores metadata in a Map — no API calls, no queue. Good enough
 * for tests that read/write metadata via `runMetadata.getKey()` /
 * `runMetadata.set()`, including the IDLE_TIMEOUT and TURN_TIMEOUT
 * checks inside `chat.agent()`.
 */
export class TestRunMetadataManager {
    store = {};
    enterWithMetadata(metadata) {
        this.store = { ...metadata };
    }
    current() {
        return { ...this.store };
    }
    getKey(key) {
        return this.store[key];
    }
    set(key, value) {
        this.store[key] = value;
        return this;
    }
    del(key) {
        delete this.store[key];
        return this;
    }
    append(key, value) {
        const existing = this.store[key];
        if (Array.isArray(existing)) {
            existing.push(value);
        }
        else {
            this.store[key] = [value];
        }
        return this;
    }
    remove(key, value) {
        const existing = this.store[key];
        if (Array.isArray(existing)) {
            this.store[key] = existing.filter((v) => v !== value);
        }
        return this;
    }
    increment(key, value) {
        const existing = this.store[key];
        const current = typeof existing === "number" ? existing : 0;
        this.store[key] = current + value;
        return this;
    }
    decrement(key, value) {
        return this.increment(key, -value);
    }
    update(metadata) {
        this.store = { ...metadata };
        return this;
    }
    async flush() { }
    async refresh() { }
    async stream(_key, value) {
        return value;
    }
    async fetchStream(_key) {
        // Return an empty async iterable — tests can override if needed
        const empty = {
            [Symbol.asyncIterator]: () => ({
                next: () => Promise.resolve({ done: true, value: undefined }),
            }),
        };
        return empty;
    }
    get parent() {
        return this;
    }
    get root() {
        return this;
    }
    reset() {
        this.store = {};
    }
}
//# sourceMappingURL=test-run-metadata-manager.js.map