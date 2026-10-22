import type { Registry } from "prom-client";
import type { QueueConsumer, RunQueueConsumerOptions } from "./queueConsumer.js";
import type { ScalingStrategyKind } from "./scalingStrategies.js";
export type QueueConsumerFactory = (opts: RunQueueConsumerOptions) => QueueConsumer;
export type ScalingOptions = {
    strategy?: ScalingStrategyKind;
    minConsumerCount?: number;
    maxConsumerCount?: number;
    scaleUpCooldownMs?: number;
    scaleDownCooldownMs?: number;
    targetRatio?: number;
    ewmaAlpha?: number;
    batchWindowMs?: number;
    disableJitter?: boolean;
    dampingFactor?: number;
    /**
     * When this returns true, scale-up is frozen (scale-down still allowed). Used to
     * stop the pool from adding consumers to drain a queue that backpressure is
     * deliberately holding. Synchronous and hot-path-safe.
     */
    shouldPauseScaling?: () => boolean;
};
export type ConsumerPoolOptions = {
    consumer: RunQueueConsumerOptions;
    scaling: ScalingOptions;
    consumerFactory?: QueueConsumerFactory;
    metricsRegistry?: Registry;
};
type ScalingMetrics = {
    targetConsumerCount: number;
    queueLength?: number;
    smoothedQueueLength: number;
    lastScaleTime: Date;
    lastQueueLengthUpdate: Date;
};
export declare class RunQueueConsumerPool {
    private readonly consumerOptions;
    private readonly logger;
    private readonly promMetrics?;
    private readonly minConsumerCount;
    private readonly maxConsumerCount;
    private readonly scalingStrategy;
    private readonly disableJitter;
    private readonly shouldPauseScaling?;
    private consumers;
    private readonly consumerFactory;
    private isEnabled;
    private isScaling;
    private metrics;
    private readonly metricsProcessor;
    private readonly ewmaAlpha;
    private readonly scaleUpCooldownMs;
    private readonly scaleDownCooldownMs;
    private readonly batchWindowMs;
    constructor(opts: ConsumerPoolOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    /**
     * Updates the queue length metric and triggers scaling decisions
     * Uses QueueMetricsProcessor for batching and EWMA smoothing
     */
    updateQueueLength(queueLength: number): void;
    private processMetricsBatch;
    private evaluateScaling;
    private calculateTargetConsumerCount;
    private scaleToTarget;
    private addConsumers;
    private removeConsumers;
    /**
     * Get current pool metrics for monitoring
     */
    getMetrics(): Readonly<ScalingMetrics>;
    /**
     * Get current number of consumers in the pool
     */
    get size(): number;
}
export {};
