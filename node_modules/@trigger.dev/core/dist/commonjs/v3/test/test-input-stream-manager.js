"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestInputStreamManager = void 0;
const types_js_1 = require("../inputStreams/types.js");
/**
 * In-memory implementation of `InputStreamManager` for unit tests.
 *
 * Tests push data via the driver's `.send(streamId, data)` method. Any
 * pending `.once()` waiters resolve immediately, and all `.on()` handlers
 * fire synchronously (awaited if they return a promise).
 *
 * Use this alongside {@link runInMockTaskContext} — not directly.
 */
class TestInputStreamManager {
    handlers = new Map();
    onceWaiters = new Map();
    latest = new Map();
    lastSeqNums = new Map();
    // Buffered sends that arrived before a `.once()` waiter was registered.
    // `.once()` semantically means "wait for NEXT value" but tests often
    // send data before the task has had a chance to reach the wait point.
    // Buffering closes that race so the waiter picks up the pending send.
    pendingSends = new Map();
    setRunId(_runId, _streamsVersion) {
        // No-op — the test driver tracks nothing about runs
    }
    on(streamId, handler) {
        if (!this.handlers.has(streamId)) {
            this.handlers.set(streamId, new Set());
        }
        this.handlers.get(streamId).add(handler);
        return {
            off: () => {
                this.handlers.get(streamId)?.delete(handler);
            },
        };
    }
    once(streamId, options) {
        return new types_js_1.InputStreamOncePromise((resolve) => {
            if (options?.signal?.aborted) {
                resolve({
                    ok: false,
                    error: new types_js_1.InputStreamTimeoutError(streamId, options.timeoutMs ?? 0),
                });
                return;
            }
            // Pick up any buffered send that arrived before this waiter.
            const buffered = this.pendingSends.get(streamId);
            if (buffered && buffered.length > 0) {
                const next = buffered.shift();
                if (buffered.length === 0)
                    this.pendingSends.delete(streamId);
                resolve({ ok: true, output: next });
                return;
            }
            const waiter = {
                resolve,
                signal: options?.signal,
            };
            if (options?.timeoutMs !== undefined) {
                waiter.timer = setTimeout(() => {
                    this.removeWaiter(streamId, waiter);
                    resolve({
                        ok: false,
                        error: new types_js_1.InputStreamTimeoutError(streamId, options.timeoutMs),
                    });
                }, options.timeoutMs);
            }
            if (options?.signal) {
                const abortHandler = () => {
                    this.removeWaiter(streamId, waiter);
                    if (waiter.timer)
                        clearTimeout(waiter.timer);
                    resolve({
                        ok: false,
                        error: new types_js_1.InputStreamTimeoutError(streamId, options.timeoutMs ?? 0),
                    });
                };
                waiter.abortHandler = abortHandler;
                options.signal.addEventListener("abort", abortHandler, { once: true });
            }
            if (!this.onceWaiters.has(streamId)) {
                this.onceWaiters.set(streamId, []);
            }
            this.onceWaiters.get(streamId).push(waiter);
        });
    }
    peek(streamId) {
        return this.latest.get(streamId);
    }
    lastSeqNum(streamId) {
        return this.lastSeqNums.get(streamId);
    }
    setLastSeqNum(streamId, seqNum) {
        this.lastSeqNums.set(streamId, seqNum);
    }
    shiftBuffer(_streamId) {
        return false;
    }
    disconnectStream(_streamId) { }
    clearHandlers() {
        this.handlers.clear();
    }
    reset() {
        // Cancel any pending waiters to avoid dangling promises leaking between tests
        for (const waiters of this.onceWaiters.values()) {
            for (const w of waiters) {
                if (w.timer)
                    clearTimeout(w.timer);
                if (w.signal && w.abortHandler) {
                    w.signal.removeEventListener("abort", w.abortHandler);
                }
            }
        }
        this.onceWaiters.clear();
        this.handlers.clear();
        this.latest.clear();
        this.lastSeqNums.clear();
        this.pendingSends.clear();
    }
    disconnect() {
        this.reset();
    }
    connectTail(_runId, _fromSeq) { }
    // ── Test driver API (not part of InputStreamManager interface) ──────────
    /**
     * Push data onto an input stream. Resolves pending `once()` waiters
     * and fires all `on()` handlers (awaiting async handlers).
     */
    async __sendFromTest(streamId, data) {
        this.latest.set(streamId, data);
        const waiters = this.onceWaiters.get(streamId);
        const handlers = this.handlers.get(streamId);
        const hasWaiters = waiters && waiters.length > 0;
        const hasHandlers = handlers && handlers.size > 0;
        // If nothing is listening yet, buffer so the next `.once()` call picks it up.
        if (!hasWaiters && !hasHandlers) {
            if (!this.pendingSends.has(streamId)) {
                this.pendingSends.set(streamId, []);
            }
            this.pendingSends.get(streamId).push(data);
            return;
        }
        if (hasWaiters) {
            // Drain every pending once() waiter — this mirrors the real manager's
            // behavior where the stream tail delivers the same record to all listeners.
            const pending = waiters.splice(0);
            for (const w of pending) {
                if (w.timer)
                    clearTimeout(w.timer);
                if (w.signal && w.abortHandler) {
                    w.signal.removeEventListener("abort", w.abortHandler);
                }
                w.resolve({ ok: true, output: data });
            }
        }
        if (hasHandlers) {
            await Promise.all(Array.from(handlers).map((h) => Promise.resolve().then(() => h(data))));
        }
    }
    /**
     * Immediately resolve every pending `once()` waiter for a stream with a
     * timeout error. Used to simulate closed streams (e.g. `exitAfterPreloadIdle`).
     */
    __closeFromTest(streamId) {
        const waiters = this.onceWaiters.get(streamId);
        if (!waiters)
            return;
        const pending = waiters.splice(0);
        for (const w of pending) {
            if (w.timer)
                clearTimeout(w.timer);
            if (w.signal && w.abortHandler) {
                w.signal.removeEventListener("abort", w.abortHandler);
            }
            w.resolve({
                ok: false,
                error: new types_js_1.InputStreamTimeoutError(streamId, 0),
            });
        }
    }
    removeWaiter(streamId, waiter) {
        const waiters = this.onceWaiters.get(streamId);
        if (!waiters)
            return;
        const idx = waiters.indexOf(waiter);
        if (idx >= 0)
            waiters.splice(idx, 1);
    }
}
exports.TestInputStreamManager = TestInputStreamManager;
//# sourceMappingURL=test-input-stream-manager.js.map