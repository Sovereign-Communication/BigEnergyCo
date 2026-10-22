import type { SessionStreamRecord } from "./types.js";
/**
 * What happens to a record when no consumer is ready for it *right now*.
 *
 * - `queue`: it waits in the route's own queue until a consumer takes it.
 * - `at-arrival`: it goes to a live handler or nowhere. A record that only
 *   means something to the turn that is live when it lands (a stop) is this.
 */
export type RouteDelivery = "queue" | "at-arrival";
/**
 * One route: which kinds it owns, whether it waits for a consumer, and whether
 * a record it never handled has to survive into the next boot.
 *
 * The two properties are independent, and that is the point. Three of the four
 * combinations are meaningful and cover everything `session.in` carries:
 *
 * | delivery | replayable | example |
 * | --- | --- | --- |
 * | `queue` | `true` | a user message: waits for a turn, and a crash must not lose it |
 * | `at-arrival` | `false` | a stop: only the live turn cares, and a replayed one would abort the wrong turn |
 * | `queue` | `false` | a handover signal: can arrive before its consumer is ready, but is meaningless to a later boot |
 *
 * The fourth is a contradiction (discard it when nobody is listening, yet
 * recover it later) and the table rejects it.
 */
export type SessionRoute = {
    /** Unique within a table. */
    name: string;
    delivery: RouteDelivery;
    /**
     * Whether a record this route never handled must be recovered by the next
     * boot. Only `true` holds the resume floor back.
     */
    replayable: boolean;
    /** Record kinds this route owns. Every kind belongs to at most one route. */
    kinds: readonly string[];
};
/**
 * The complete statement of what a channel carries and who owns each kind.
 * Intended to be a literal at the point of use, so "which kinds exist and what
 * happens to each" is answerable by reading one object.
 */
export type SessionRouteTable = {
    /** Extract a record's kind. Returning `undefined` marks it malformed. */
    kindOf: (data: unknown) => string | undefined;
    routes: readonly SessionRoute[];
};
export type RouterDropReason = 
/** No route claims this kind: nothing on this boot can consume it. */
"unroutable"
/** No usable kind on the record at all. */
 | "malformed"
/**
 * A non-replayable record inside the replay window. It was already observed
 * by a previous run, and its route has declared that a later boot has no use
 * for it.
 */
 | "replayed"
/** An `at-arrival` record with no handler attached right now. */
 | "no-handler"
/**
 * A record the boot took responsibility for over HTTP (see
 * {@link SessionChannelRouter.markRecovered}). It is dropped however late the
 * live tail re-delivers it, so a recovered message is never also answered as
 * a router turn.
 */
 | "recovered";
export type RouterDecision = 
/** Handed to a consumer that was already waiting, or to a live handler. */
{
    action: "deliver";
    route: string;
}
/** Parked in the route's queue for a future consumer. */
 | {
    action: "queue";
    route: string;
} | {
    action: "drop";
    route?: string;
    reason: RouterDropReason;
};
/**
 * The two numbers a turn boundary publishes, and that a boot reads back.
 *
 * `resumeFrom` is the floor: every record at or below it was terminally
 * handled, so a boot subscribes from just past it. `appliedThrough` is the end
 * of the replay window: the highest sequence a previous run observed. Records
 * at or below it are being re-read rather than arriving live.
 */
export type RouterCheckpoint = {
    resumeFrom?: number;
    appliedThrough?: number;
};
type RouteHandler = (record: SessionStreamRecord) => void;
/**
 * Reads one session channel and gives every record exactly one destination.
 *
 * The channel carries records for several independent consumers whose delivery
 * needs differ: a message must be delivered eventually and so can lag
 * arbitrarily far behind the newest record, while a stop only means anything to
 * the turn that is live when it lands. Tracking that with a single scalar
 * cursor is not possible — the true state is always "control applied through
 * X, message Y still owed" — so the router tracks it per route and derives the
 * published numbers from route state:
 *
 * - the resume floor is held back only by records a later boot would still have
 *   to recover, which is exactly the queued records on replayable routes;
 * - a record whose route has declared it not replayable is never re-applied
 *   after a resume, because the route said a later boot has no use for it;
 * - a record with no route is terminal by classification, so it never enters a
 *   queue and cannot park at the head of one.
 *
 * Those three properties are what previously needed a cursor-barrier
 * predicate, a drop predicate with a second published header, and a
 * discard-the-unclaimed drain respectively.
 */
export declare class SessionChannelRouter {
    #private;
    private table;
    constructor(table: SessionRouteTable, options?: {
        /** Called for every dropped record. Reporting only; never load-bearing. */
        onDrop?: (record: SessionStreamRecord, reason: RouterDropReason, route?: string) => void;
    });
    /**
     * Seed the router from a previous run's turn boundary.
     *
     * An absent `appliedThrough` falls back to the floor, which leaves anything
     * above the floor treated as live. A caller resuming a boundary that predates
     * the published replay window should resolve the window from the channel
     * instead, so it covers everything already there at boot: a missed stop is
     * recoverable, while a stop applied to the wrong turn kills a live answer.
     */
    restore(checkpoint: RouterCheckpoint): void;
    /** Where a boot should subscribe from: just past this sequence. */
    resumeFrom(): number | undefined;
    /**
     * Declare the sequences a continuation boot already read over HTTP and took
     * responsibility for dispatching itself, so the live tail's re-read of the
     * same records does not answer them a second time.
     *
     * Two effects, deliberately separate:
     *
     * - Every claimed sequence is dropped in {@link ingest} however late it
     *   arrives (`"recovered"`), so a record the boot owns never also becomes a
     *   router turn. This survives the boot settling it — the boot owns its
     *   disposition for the whole run, and the tail may re-deliver at any time.
     * - Each claimed sequence is also *owed*: it holds the resume floor exactly
     *   like a queued record would, until the boot {@link settleRecovered}s it.
     *   Suppressing the second delivery without this would let a turn boundary
     *   publish a floor past a message the boot has not answered yet, turning a
     *   duplicate into a dropped message.
     *
     * `#highestSeq` is advanced over the contiguous run of claimed sequences from
     * the current high water, so once every claim is settled the floor can move
     * past them even if the tail never re-delivers (a silent tail then degrades
     * to a duplicate, never a loss). The advance stops at the first gap so a
     * record the boot left for the router is never skipped.
     */
    markRecovered(seqNums: Iterable<number>): void;
    /**
     * Release a claimed sequence's hold on the resume floor once the boot has
     * decided its disposition (dispatched it as a turn, folded it into the seed
     * chain, or deliberately dropped it). It stays claimed, so a late tail
     * re-delivery is still dropped rather than answered again.
     */
    settleRecovered(seqNum: number): void;
    /**
     * Classify one record and act on it. The record's destination is decided
     * here, once, and never by whichever consumer happens to be waiting.
     *
     * Queued routes serve a waiting consumer before a push handler, so a handler
     * can never take a record out from under a consumer that is actively awaiting
     * one. A record handed straight to either never enters the queue, so it never
     * holds the floor back.
     */
    ingest(record: SessionStreamRecord): RouterDecision;
    /**
     * The highest sequence that can be resumed past without losing anything.
     *
     * Held back below the earliest record still queued anywhere, because those
     * are exactly the records a replay has to recover. Everything else the
     * router has seen was terminally decided, so the floor is free to sit at the
     * high water when every queue is empty.
     */
    resumeFloor(): number | undefined;
    /**
     * The high water: highest sequence observed, never held back. Published as
     * the end of the replay window so the next boot can tell a re-read
     * `at-arrival` record from one arriving live.
     */
    appliedThrough(): number | undefined;
    /** Both published numbers for a turn boundary. */
    checkpoint(): RouterCheckpoint;
    /**
     * Attach a push handler. A `queued` route with a handler attached delivers
     * straight to it instead of queueing; an `at-arrival` route discards records
     * whenever no handler is attached.
     *
     * Attaching re-offers anything already queued, so a consumer that attaches
     * after records have piled up still sees them in order.
     */
    on(name: string, handler: RouteHandler): {
        off: () => void;
    };
    /**
     * Watch a route without consuming from it.
     *
     * Notification and consumption are separate concerns: an observer is told
     * that a record arrived and the record still queues, so the resume floor
     * stays held behind it until something actually takes it. A push handler
     * registered with {@link on} is the opposite, and a record handed to one
     * counts as terminally decided.
     *
     * Only meaningful on a replayable route. On an `at-arrival` route an observer
     * would either have to count as a listener, which would stop an unconsumed
     * record being discarded, or watch records it cannot affect, so it is
     * rejected rather than given one of those two meanings.
     *
     * Records already queued are not re-offered: an observer reports arrivals
     * from the moment it attaches, so re-offering would fire twice for a record
     * that arrived before a later consumer attached.
     */
    observe(name: string, observer: RouteHandler): {
        off: () => void;
    };
    /**
     * Remove one queued record, identified by sequence.
     *
     * For a consumer that decided to take a record it had only observed. Returns
     * whether it was still queued, so a caller can tell a real take from a record
     * something else had already consumed.
     */
    take(name: string, seqNum: number): SessionStreamRecord | undefined;
    /**
     * Put a taken record back, in sequence order.
     *
     * For a consumer that claimed a record and then could not use it. Returning
     * it leaves the route as though the claim never happened, so the record is
     * delivered later and goes back to holding the resume floor. Without this a
     * failed claim-then-use is indistinguishable from a delivery, and the record
     * is lost.
     */
    untake(name: string, record: SessionStreamRecord): void;
    /** Whether an `at-arrival` route currently has anywhere to deliver. */
    hasHandler(name: string): boolean;
    /**
     * Take the next record on a route.
     *
     * `timeoutMs: 0` is a non-blocking take. Omitted means wait indefinitely.
     * Resolves `undefined` on timeout. An `at-arrival` route delivers to a
     * waiting caller when one is already parked here, which is what makes a pull
     * consumer possible on such a route without weakening the discard rule.
     */
    next(name: string, options?: {
        timeoutMs?: number;
    }): Promise<SessionStreamRecord | undefined>;
    /** Head of a route's queue without consuming it. */
    peek(name: string): SessionStreamRecord | undefined;
    /**
     * Whether a route has anything queued. Exact, because it reads that route's
     * own queue rather than the head of a buffer shared with every other kind on
     * the channel.
     */
    hasPending(name: string): boolean;
    /** Number of records queued on a route. Diagnostic use. */
    pendingCount(name: string): number;
    /**
     * Discard whatever one route has queued and wake its waiters empty.
     *
     * Closes a consumer window: a route that is not replayable has nothing owed
     * to a later boot, so once its window is over anything still queued on it is
     * dead and must not sit at the head of the queue for the rest of the run.
     */
    clearRoute(name: string): void;
    /** Drop every waiter and queue. Called between task executions. */
    reset(): void;
}
export {};
