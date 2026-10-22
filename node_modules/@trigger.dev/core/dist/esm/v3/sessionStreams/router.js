/**
 * One route's live state: its queue of records nobody has taken yet, the
 * consumers waiting for the next one, and any attached push handlers.
 *
 * An `at-arrival` route never fills `queue`; a route that is not `replayable`
 * fills it but is skipped when the floor is computed.
 */
class RouteState {
    route;
    queue = [];
    waiters = [];
    handlers = new Set();
    observers = new Set();
    constructor(route) {
        this.route = route;
    }
    /**
     * Lowest sequence a *later boot* would still have to recover. A route that
     * is not replayable never holds anything back, however much it has queued.
     */
    earliestUnrecovered() {
        if (!this.route.replayable)
            return undefined;
        return this.queue.length > 0 ? this.queue[0].seqNum : undefined;
    }
}
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
export class SessionChannelRouter {
    table;
    #routes = new Map();
    #kindToRoute = new Map();
    #highestSeq;
    #resumeFrom;
    #appliedThrough;
    #claimed = new Set();
    #owed = new Set();
    #onDrop;
    constructor(table, options) {
        this.table = table;
        for (const route of table.routes) {
            if (this.#routes.has(route.name)) {
                throw new Error(`Duplicate route name "${route.name}" in session route table`);
            }
            if (route.delivery === "at-arrival" && route.replayable) {
                throw new Error(`Route "${route.name}" is at-arrival and replayable, which cannot both hold: a record discarded because nobody was listening cannot also be recovered later`);
            }
            this.#routes.set(route.name, new RouteState(route));
            for (const kind of route.kinds) {
                const existing = this.#kindToRoute.get(kind);
                if (existing) {
                    throw new Error(`Kind "${kind}" is claimed by both "${existing}" and "${route.name}" in session route table`);
                }
                this.#kindToRoute.set(kind, route.name);
            }
        }
        this.#onDrop = options?.onDrop;
    }
    /**
     * Seed the router from a previous run's turn boundary.
     *
     * An absent `appliedThrough` falls back to the floor, which leaves anything
     * above the floor treated as live. A caller resuming a boundary that predates
     * the published replay window should resolve the window from the channel
     * instead, so it covers everything already there at boot: a missed stop is
     * recoverable, while a stop applied to the wrong turn kills a live answer.
     */
    restore(checkpoint) {
        this.#resumeFrom = checkpoint.resumeFrom;
        this.#appliedThrough = checkpoint.appliedThrough ?? checkpoint.resumeFrom;
        if (this.#resumeFrom !== undefined) {
            this.#highestSeq = this.#resumeFrom;
        }
    }
    /** Where a boot should subscribe from: just past this sequence. */
    resumeFrom() {
        return this.#resumeFrom;
    }
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
    markRecovered(seqNums) {
        const nums = [...seqNums].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
        if (nums.length === 0)
            return;
        for (const n of nums) {
            this.#claimed.add(n);
            this.#owed.add(n);
        }
        let base = this.#highestSeq ?? nums[0] - 1;
        while (this.#claimed.has(base + 1))
            base++;
        if (this.#highestSeq === undefined || base > this.#highestSeq) {
            this.#highestSeq = base;
        }
        const maxClaimed = nums[nums.length - 1];
        if (this.#appliedThrough === undefined || maxClaimed > this.#appliedThrough) {
            this.#appliedThrough = maxClaimed;
        }
    }
    /**
     * Release a claimed sequence's hold on the resume floor once the boot has
     * decided its disposition (dispatched it as a turn, folded it into the seed
     * chain, or deliberately dropped it). It stays claimed, so a late tail
     * re-delivery is still dropped rather than answered again.
     */
    settleRecovered(seqNum) {
        this.#owed.delete(seqNum);
    }
    /**
     * Classify one record and act on it. The record's destination is decided
     * here, once, and never by whichever consumer happens to be waiting.
     *
     * Queued routes serve a waiting consumer before a push handler, so a handler
     * can never take a record out from under a consumer that is actively awaiting
     * one. A record handed straight to either never enters the queue, so it never
     * holds the floor back.
     */
    ingest(record) {
        if (Number.isFinite(record.seqNum)) {
            if (this.#highestSeq === undefined || record.seqNum > this.#highestSeq) {
                this.#highestSeq = record.seqNum;
            }
        }
        if (this.#claimed.has(record.seqNum)) {
            return this.#drop(record, "recovered");
        }
        const kind = this.#kindOf(record.data);
        if (kind === undefined) {
            return this.#drop(record, "malformed");
        }
        const routeName = this.#kindToRoute.get(kind);
        const state = routeName ? this.#routes.get(routeName) : undefined;
        if (!state || !routeName) {
            return this.#drop(record, "unroutable");
        }
        if (!state.route.replayable &&
            this.#appliedThrough !== undefined &&
            record.seqNum <= this.#appliedThrough) {
            return this.#drop(record, "replayed", routeName);
        }
        if (state.route.delivery === "at-arrival" &&
            state.handlers.size === 0 &&
            state.waiters.length === 0) {
            return this.#drop(record, "no-handler", routeName);
        }
        for (const observer of state.observers) {
            try {
                observer(record);
            }
            catch {
                void 0;
            }
        }
        const waiter = state.waiters.shift();
        if (waiter) {
            if (waiter.timer)
                clearTimeout(waiter.timer);
            waiter.resolve(record);
            return { action: "deliver", route: routeName };
        }
        if (state.handlers.size > 0) {
            this.#invokeHandlers(state, record);
            return { action: "deliver", route: routeName };
        }
        state.queue.push(record);
        return { action: "queue", route: routeName };
    }
    #kindOf(data) {
        try {
            const kind = this.table.kindOf(data);
            return typeof kind === "string" && kind.length > 0 ? kind : undefined;
        }
        catch {
            return undefined;
        }
    }
    #drop(record, reason, route) {
        try {
            this.#onDrop?.(record, reason, route);
        }
        catch {
            void 0;
        }
        return { action: "drop", route, reason };
    }
    #invokeHandlers(state, record) {
        for (const handler of state.handlers) {
            try {
                handler(record);
            }
            catch {
                void 0;
            }
        }
    }
    /**
     * The highest sequence that can be resumed past without losing anything.
     *
     * Held back below the earliest record still queued anywhere, because those
     * are exactly the records a replay has to recover. Everything else the
     * router has seen was terminally decided, so the floor is free to sit at the
     * high water when every queue is empty.
     */
    resumeFloor() {
        if (this.#highestSeq === undefined)
            return undefined;
        let earliestPending = Infinity;
        for (const state of this.#routes.values()) {
            const pending = state.earliestUnrecovered();
            if (pending !== undefined)
                earliestPending = Math.min(earliestPending, pending);
        }
        for (const owed of this.#owed) {
            if (owed < earliestPending)
                earliestPending = owed;
        }
        if (earliestPending === Infinity)
            return this.#highestSeq;
        const floor = Math.min(this.#highestSeq, earliestPending - 1);
        return floor >= 0 ? floor : undefined;
    }
    /**
     * The high water: highest sequence observed, never held back. Published as
     * the end of the replay window so the next boot can tell a re-read
     * `at-arrival` record from one arriving live.
     */
    appliedThrough() {
        return this.#highestSeq;
    }
    /** Both published numbers for a turn boundary. */
    checkpoint() {
        return { resumeFrom: this.resumeFloor(), appliedThrough: this.appliedThrough() };
    }
    #stateOrThrow(name) {
        const state = this.#routes.get(name);
        if (!state)
            throw new Error(`Unknown session route "${name}"`);
        return state;
    }
    /**
     * Attach a push handler. A `queued` route with a handler attached delivers
     * straight to it instead of queueing; an `at-arrival` route discards records
     * whenever no handler is attached.
     *
     * Attaching re-offers anything already queued, so a consumer that attaches
     * after records have piled up still sees them in order.
     */
    on(name, handler) {
        const state = this.#stateOrThrow(name);
        state.handlers.add(handler);
        if (state.queue.length > 0) {
            const pending = state.queue.splice(0, state.queue.length);
            for (const record of pending) {
                try {
                    handler(record);
                }
                catch {
                    void 0;
                }
            }
        }
        return {
            off: () => {
                state.handlers.delete(handler);
            },
        };
    }
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
    observe(name, observer) {
        const state = this.#stateOrThrow(name);
        if (state.route.delivery === "at-arrival") {
            throw new Error(`Route "${name}" is at-arrival, which cannot be observed: an observer must not decide whether a record is discarded, and cannot be offered one that already was`);
        }
        state.observers.add(observer);
        return {
            off: () => {
                state.observers.delete(observer);
            },
        };
    }
    /**
     * Remove one queued record, identified by sequence.
     *
     * For a consumer that decided to take a record it had only observed. Returns
     * whether it was still queued, so a caller can tell a real take from a record
     * something else had already consumed.
     */
    take(name, seqNum) {
        const state = this.#stateOrThrow(name);
        const index = state.queue.findIndex((record) => record.seqNum === seqNum);
        if (index === -1)
            return undefined;
        return state.queue.splice(index, 1)[0];
    }
    /**
     * Put a taken record back, in sequence order.
     *
     * For a consumer that claimed a record and then could not use it. Returning
     * it leaves the route as though the claim never happened, so the record is
     * delivered later and goes back to holding the resume floor. Without this a
     * failed claim-then-use is indistinguishable from a delivery, and the record
     * is lost.
     */
    untake(name, record) {
        const state = this.#stateOrThrow(name);
        if (state.queue.some((queued) => queued.seqNum === record.seqNum))
            return;
        const at = state.queue.findIndex((queued) => queued.seqNum > record.seqNum);
        if (at === -1)
            state.queue.push(record);
        else
            state.queue.splice(at, 0, record);
    }
    /** Whether an `at-arrival` route currently has anywhere to deliver. */
    hasHandler(name) {
        return this.#stateOrThrow(name).handlers.size > 0;
    }
    /**
     * Take the next record on a route.
     *
     * `timeoutMs: 0` is a non-blocking take. Omitted means wait indefinitely.
     * Resolves `undefined` on timeout. An `at-arrival` route delivers to a
     * waiting caller when one is already parked here, which is what makes a pull
     * consumer possible on such a route without weakening the discard rule.
     */
    next(name, options) {
        const state = this.#stateOrThrow(name);
        const queued = state.queue.shift();
        if (queued)
            return Promise.resolve(queued);
        if (options?.timeoutMs === 0)
            return Promise.resolve(undefined);
        return new Promise((resolve) => {
            const waiter = { resolve };
            if (options?.timeoutMs !== undefined) {
                waiter.timer = setTimeout(() => {
                    const index = state.waiters.indexOf(waiter);
                    if (index !== -1)
                        state.waiters.splice(index, 1);
                    resolve(undefined);
                }, options.timeoutMs);
            }
            state.waiters.push(waiter);
        });
    }
    /** Head of a route's queue without consuming it. */
    peek(name) {
        return this.#stateOrThrow(name).queue[0];
    }
    /**
     * Whether a route has anything queued. Exact, because it reads that route's
     * own queue rather than the head of a buffer shared with every other kind on
     * the channel.
     */
    hasPending(name) {
        return this.#stateOrThrow(name).queue.length > 0;
    }
    /** Number of records queued on a route. Diagnostic use. */
    pendingCount(name) {
        return this.#stateOrThrow(name).queue.length;
    }
    /**
     * Discard whatever one route has queued and wake its waiters empty.
     *
     * Closes a consumer window: a route that is not replayable has nothing owed
     * to a later boot, so once its window is over anything still queued on it is
     * dead and must not sit at the head of the queue for the rest of the run.
     */
    clearRoute(name) {
        const state = this.#stateOrThrow(name);
        if (state.route.replayable) {
            throw new Error(`Route "${name}" is replayable, so its queue cannot be cleared: anything queued on it is still owed to a later boot, and discarding it would lose records the resume floor is holding back`);
        }
        state.queue.length = 0;
        for (const waiter of state.waiters) {
            if (waiter.timer)
                clearTimeout(waiter.timer);
            waiter.resolve(undefined);
        }
        state.waiters.length = 0;
    }
    /** Drop every waiter and queue. Called between task executions. */
    reset() {
        for (const state of this.#routes.values()) {
            state.queue.length = 0;
            state.handlers.clear();
            state.observers.clear();
            for (const waiter of state.waiters) {
                if (waiter.timer)
                    clearTimeout(waiter.timer);
                waiter.resolve(undefined);
            }
            state.waiters.length = 0;
        }
        this.#highestSeq = undefined;
        this.#resumeFrom = undefined;
        this.#appliedThrough = undefined;
        this.#claimed.clear();
        this.#owed.clear();
    }
}
//# sourceMappingURL=router.js.map