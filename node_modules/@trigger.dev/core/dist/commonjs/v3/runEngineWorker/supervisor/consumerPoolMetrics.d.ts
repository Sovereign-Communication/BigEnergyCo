import { Counter, Gauge, Histogram, Registry } from "prom-client";
export interface ConsumerPoolMetricsOptions {
    register?: Registry;
    prefix?: string;
}
/**
 * Outcome of a single dequeue API round-trip, used as a low-cardinality label
 * on the dequeue latency histogram.
 * - `success`: the call returned at least one run
 * - `empty`: the call succeeded but returned no runs (the common idle case)
 * - `error`: the call failed (unsuccessful response, network error, or timeout)
 */
export type DequeueOutcome = "success" | "empty" | "error";
export declare class ConsumerPoolMetrics {
    private readonly register;
    private readonly prefix;
    readonly consumerCount: Gauge;
    readonly queueLength: Gauge;
    readonly smoothedQueueLength: Gauge;
    readonly targetConsumerCount: Gauge;
    readonly scalingStrategy: Gauge;
    readonly scalingOperationsTotal: Counter;
    readonly consumersAddedTotal: Counter;
    readonly consumersRemovedTotal: Counter;
    readonly scalingCooldownsApplied: Counter;
    readonly queueLengthUpdatesTotal: Counter;
    readonly batchesProcessedTotal: Counter;
    readonly dequeueDurationSeconds: Histogram;
    constructor(opts?: ConsumerPoolMetricsOptions);
    /**
     * Update all gauge metrics with current state
     */
    updateState(state: {
        consumerCount: number;
        queueLength?: number;
        smoothedQueueLength: number;
        targetConsumerCount: number;
        strategy: string;
    }): void;
    /**
     * Record a scaling operation
     */
    recordScalingOperation(direction: "up" | "down" | "none", strategy: string, count: number): void;
    /**
     * Record that scaling was prevented by cooldown
     */
    recordCooldownApplied(direction: "up" | "down"): void;
    /**
     * Record a queue length update
     */
    recordQueueLengthUpdate(): void;
    /**
     * Record the client-side latency of a single dequeue API round-trip.
     * @param seconds Wall-clock duration of the dequeue call, in seconds.
     * @param outcome Whether the call returned runs, was empty, or errored.
     */
    observeDequeueLatency(seconds: number, outcome: DequeueOutcome): void;
}
