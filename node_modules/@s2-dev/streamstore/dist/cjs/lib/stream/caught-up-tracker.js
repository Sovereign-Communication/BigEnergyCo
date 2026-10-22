"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaughtUpTracker = void 0;
const error_js_1 = require("../../error.js");
function copyPosition(position) {
    return {
        seqNum: position.seqNum,
        timestamp: new Date(position.timestamp.getTime()),
    };
}
/** Error a pending {@link CaughtUpTracker.caughtUp} call rejects with on a clean end. */
function sessionClosedError() {
    return new error_js_1.S2Error({
        message: "Read session ended before catching up",
        code: "SESSION_CLOSED",
        status: 0,
        origin: "sdk",
    });
}
class Boundary {
    deliver;
    caughtUpTail;
    delivered = false;
    constructor(caughtUpTail, deliver) {
        this.deliver = deliver;
        this.caughtUpTail = copyPosition(caughtUpTail);
    }
    get tail() {
        return copyPosition(this.caughtUpTail);
    }
    markDelivered() {
        if (this.delivered) {
            return;
        }
        this.delivered = true;
        this.deliver(this.caughtUpTail);
    }
}
/**
 * Tracks whether normalized read batches have reached a reported tail and have
 * been delivered through that point.
 *
 * Transport clients call {@link observeBatch} as soon as they decode a batch
 * or heartbeat. Delivery is a separate step: the returned boundary is marked
 * only after all preceding visible records have been consumed. Pending
 * {@link caughtUp} calls survive reconnects, while terminal states settle them.
 */
class CaughtUpTracker {
    revision = 0;
    caughtUpTail;
    waiters = [];
    terminal;
    observeBatch(input) {
        if (this.terminal) {
            return undefined;
        }
        const revision = ++this.revision;
        this.caughtUpTail = undefined;
        const tail = input.tail;
        if (tail === undefined) {
            return undefined;
        }
        const reachesTail = input.recordCount === 0 ||
            (input.recordCount > 0 &&
                input.lastSeqNum !== undefined &&
                input.lastSeqNum + 1 === tail.seqNum);
        if (!reachesTail) {
            return undefined;
        }
        return new Boundary(tail, (caughtUpTail) => {
            this.markDelivered(revision, caughtUpTail);
        });
    }
    /** Mark the tracker behind and invalidate boundaries from the old connection. */
    reconnect() {
        if (this.terminal) {
            return;
        }
        this.revision++;
        this.caughtUpTail = undefined;
    }
    /**
     * End tracking and settle pending waiters.
     *
     * A clean end preserves an already caught-up state. An error clears it.
     */
    end(error) {
        if (this.terminal) {
            return;
        }
        this.revision++;
        this.terminal = { error };
        if (error) {
            this.caughtUpTail = undefined;
        }
        const waiters = this.waiters.splice(0);
        const rejection = error ?? sessionClosedError();
        for (const waiter of waiters) {
            waiter.reject(rejection);
        }
    }
    isCaughtUp() {
        return this.caughtUpTail !== undefined;
    }
    caughtUp() {
        if (this.caughtUpTail) {
            return Promise.resolve(copyPosition(this.caughtUpTail));
        }
        if (this.terminal) {
            return Promise.reject(this.terminal.error ?? sessionClosedError());
        }
        const promise = new Promise((resolve, reject) => {
            this.waiters.push({ resolve, reject });
        });
        // A caller may intentionally use only isCaughtUp(); do not report the
        // tracker's terminal settlement as an unhandled rejection in that case.
        promise.catch(() => { });
        return promise;
    }
    markDelivered(revision, tail) {
        if (this.terminal || revision !== this.revision) {
            return;
        }
        this.caughtUpTail = tail;
        const waiters = this.waiters.splice(0);
        for (const waiter of waiters) {
            waiter.resolve(copyPosition(tail));
        }
    }
}
exports.CaughtUpTracker = CaughtUpTracker;
//# sourceMappingURL=caught-up-tracker.js.map