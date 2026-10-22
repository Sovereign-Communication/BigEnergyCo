/**
 * FIFO queue with O(1) amortized shift.
 * Plain arrays degrade badly at large depths since shift() memmoves the
 * backing store; this tracks a head index and compacts lazily instead.
 */
export declare class FifoQueue<T> implements Iterable<T> {
    private items;
    private head;
    get length(): number;
    push(item: T): void;
    /** Remove and return the head item, or undefined if empty. */
    shift(): T | undefined;
    /** Return the head item without removing it, or undefined if empty. */
    peek(): T | undefined;
    clear(): void;
    /** Remove the first item matching the predicate. Returns true if found. */
    removeFirst(predicate: (item: T) => boolean): boolean;
    /** Test items with queue-relative indices (0 = head). */
    some(predicate: (item: T, index: number) => boolean): boolean;
    [Symbol.iterator](): IterableIterator<T>;
}
//# sourceMappingURL=queue.d.ts.map