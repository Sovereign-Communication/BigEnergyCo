"use strict";
/**
 * FIFO queue with O(1) amortized shift.
 * Plain arrays degrade badly at large depths since shift() memmoves the
 * backing store; this tracks a head index and compacts lazily instead.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FifoQueue = void 0;
/** Dead slots below head must exceed this before compaction is considered. */
const COMPACT_MIN_HEAD = 1024;
class FifoQueue {
    // Slots below head are dead and set to undefined so items can be GC'd
    items = [];
    head = 0;
    get length() {
        return this.items.length - this.head;
    }
    push(item) {
        this.items.push(item);
    }
    /** Remove and return the head item, or undefined if empty. */
    shift() {
        if (this.head >= this.items.length) {
            return undefined;
        }
        const item = this.items[this.head];
        this.items[this.head] = undefined;
        this.head++;
        // Compact once the dead prefix dominates; amortizes to O(1) per shift
        if (this.head >= COMPACT_MIN_HEAD && this.head * 2 >= this.items.length) {
            this.items = this.items.slice(this.head);
            this.head = 0;
        }
        return item;
    }
    /** Return the head item without removing it, or undefined if empty. */
    peek() {
        return this.items[this.head];
    }
    clear() {
        this.items = [];
        this.head = 0;
    }
    /** Remove the first item matching the predicate. Returns true if found. */
    removeFirst(predicate) {
        for (let i = this.head; i < this.items.length; i++) {
            if (predicate(this.items[i])) {
                this.items.splice(i, 1);
                return true;
            }
        }
        return false;
    }
    /** Test items with queue-relative indices (0 = head). */
    some(predicate) {
        for (let i = this.head; i < this.items.length; i++) {
            if (predicate(this.items[i], i - this.head)) {
                return true;
            }
        }
        return false;
    }
    // Hand-rolled iterator: generators are ~10x slower per element in hot scans
    [Symbol.iterator]() {
        let i = this.head;
        const items = this.items;
        const iter = {
            next: () => i < items.length
                ? { value: items[i++], done: false }
                : { value: undefined, done: true },
            [Symbol.iterator]: () => iter,
        };
        return iter;
    }
}
exports.FifoQueue = FifoQueue;
//# sourceMappingURL=queue.js.map