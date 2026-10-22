import { S2Error } from "../../error.js";
import type { StreamPosition } from "../../types.js";
/**
 * A caught-up point observed in the input stream but not necessarily delivered
 * to the consumer yet.
 */
export interface CaughtUpBoundary {
    /** The tail reported for this caught-up point. */
    readonly tail: StreamPosition;
    /**
     * Mark every visible record preceding this boundary as delivered.
     *
     * Repeated calls and calls made stale by a newer batch, reconnect, or
     * terminal state are no-ops.
     */
    markDelivered(): void;
}
/** A normalized decoded batch or heartbeat observed by a read client. */
export interface CaughtUpBatch {
    /** Number of records before any client-side filtering. */
    readonly recordCount: number;
    /** Sequence number of the final unfiltered record, when present. */
    readonly lastSeqNum?: number;
    /** Tail reported with the batch or heartbeat, when present. */
    readonly tail?: StreamPosition;
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
export declare class CaughtUpTracker {
    private revision;
    private caughtUpTail;
    private waiters;
    private terminal;
    observeBatch(input: CaughtUpBatch): CaughtUpBoundary | undefined;
    /** Mark the tracker behind and invalidate boundaries from the old connection. */
    reconnect(): void;
    /**
     * End tracking and settle pending waiters.
     *
     * A clean end preserves an already caught-up state. An error clears it.
     */
    end(error?: S2Error): void;
    isCaughtUp(): boolean;
    caughtUp(): Promise<StreamPosition>;
    private markDelivered;
}
//# sourceMappingURL=caught-up-tracker.d.ts.map