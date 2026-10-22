"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RECONNECT_BACKOFF_MAX_MS = void 0;
exports.computeReconnectDelayMs = computeReconnectDelayMs;
/**
 * Exponential backoff with full jitter for stream-tail reconnect loops.
 *
 * Shared between `SessionStreamManager` and `StandardInputStreamManager`
 * — both reconnect a long-lived SSE tail when handlers/waiters are still
 * registered, and both need to back off on persistent backend failures
 * (auth rejection, 5xx, DNS) instead of reconnecting in a tight loop.
 *
 * - Base 1s, doubles per attempt (1s, 2s, 4s, 8s, 16s, 30s, 30s, ...)
 * - Capped at 30s
 * - Plus 0–1000ms jitter to avoid thundering herd when many clients
 *   share the same failure mode
 * - Negative or non-integer attempts are clamped to 0
 *
 * Callers track the per-key attempt count and reset to 0 on every
 * successful record (any traffic flowing = healthy connection).
 */
function computeReconnectDelayMs(attempt) {
    const safeAttempt = Math.max(0, Math.floor(attempt));
    const base = Math.min(1000 * 2 ** safeAttempt, 30_000);
    return base + Math.random() * 1000;
}
/** Maximum backoff floor without jitter — exposed for tests / asserts. */
exports.RECONNECT_BACKOFF_MAX_MS = 30_000;
//# sourceMappingURL=reconnectBackoff.js.map