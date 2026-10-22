import type { SupervisorHttpClient } from "./http.js";
import type { WorkerApiDequeueResponseBody, WorkerQueueClass } from "./schemas.js";
import type { PreDequeueFn, PreSkipFn } from "./types.js";
import type { ConsumerPoolMetrics } from "./consumerPoolMetrics.js";
export interface QueueConsumer {
    start(): void;
    stop(): void;
}
export type RunQueueConsumerOptions = {
    client: SupervisorHttpClient;
    intervalMs: number;
    idleIntervalMs: number;
    preDequeue?: PreDequeueFn;
    preSkip?: PreSkipFn;
    maxRunCount?: number;
    /** Which worker-queue class this consumer pulls from. Defaults to the worker's region queue. */
    queueClass?: WorkerQueueClass;
    onDequeue: (messages: WorkerApiDequeueResponseBody, timing?: {
        dequeueResponseMs: number;
        pollingIntervalMs: number;
    }) => Promise<void>;
    /** Optional shared pool metrics. When provided, dequeue API latency is recorded as a histogram. */
    metrics?: ConsumerPoolMetrics;
};
export declare class RunQueueConsumer implements QueueConsumer {
    private readonly client;
    private readonly preDequeue?;
    private readonly preSkip?;
    private readonly maxRunCount?;
    private readonly queueClass?;
    private readonly onDequeue;
    private readonly metrics?;
    private readonly logger;
    private intervalMs;
    private idleIntervalMs;
    private isEnabled;
    private lastScheduledIntervalMs;
    constructor(opts: RunQueueConsumerOptions);
    start(): void;
    stop(): void;
    private dequeue;
    private scheduleNextDequeue;
}
