import { SimpleStructuredLogger } from "../../utils/structuredLogger.js";
export class RunQueueConsumer {
    client;
    preDequeue;
    preSkip;
    maxRunCount;
    queueClass;
    onDequeue;
    metrics;
    logger = new SimpleStructuredLogger("queue-consumer");
    intervalMs;
    idleIntervalMs;
    isEnabled;
    lastScheduledIntervalMs;
    constructor(opts) {
        this.isEnabled = false;
        this.intervalMs = opts.intervalMs;
        this.idleIntervalMs = opts.idleIntervalMs;
        this.preDequeue = opts.preDequeue;
        this.preSkip = opts.preSkip;
        this.maxRunCount = opts.maxRunCount;
        this.queueClass = opts.queueClass;
        this.lastScheduledIntervalMs = opts.idleIntervalMs;
        this.onDequeue = opts.onDequeue;
        this.client = opts.client;
        this.metrics = opts.metrics;
    }
    start() {
        if (this.isEnabled) {
            return;
        }
        this.isEnabled = true;
        this.dequeue();
    }
    stop() {
        if (!this.isEnabled) {
            return;
        }
        this.isEnabled = false;
    }
    async dequeue() {
        this.logger.verbose("dequeue()", {
            enabled: this.isEnabled,
            intervalMs: this.intervalMs,
            idleIntervalMs: this.idleIntervalMs,
            maxRunCount: this.maxRunCount,
            preDequeue: !!this.preDequeue,
            preSkip: !!this.preSkip,
        });
        if (!this.isEnabled) {
            this.logger.warn("dequeue() - not enabled");
            return;
        }
        let preDequeueResult;
        if (this.preDequeue) {
            this.logger.verbose("preDequeue()");
            try {
                preDequeueResult = await this.preDequeue();
            }
            catch (preDequeueError) {
                this.logger.error("preDequeue error", { error: preDequeueError });
            }
        }
        this.logger.verbose("preDequeueResult", { preDequeueResult });
        if (preDequeueResult?.skipDequeue ||
            preDequeueResult?.maxResources?.cpu === 0 ||
            preDequeueResult?.maxResources?.memory === 0) {
            this.logger.debug("skipping dequeue", { preDequeueResult });
            if (this.preSkip) {
                this.logger.debug("preSkip()");
                try {
                    await this.preSkip();
                }
                catch (preSkipError) {
                    this.logger.error("preSkip error", { error: preSkipError });
                }
            }
            this.scheduleNextDequeue(this.idleIntervalMs);
            return;
        }
        let nextIntervalMs = this.idleIntervalMs;
        const dequeueStart = performance.now();
        try {
            const response = await this.client.dequeue({
                maxResources: preDequeueResult?.maxResources,
                maxRunCount: this.maxRunCount,
                queueClass: this.queueClass,
            });
            const dequeueDurationSeconds = (performance.now() - dequeueStart) / 1000;
            const dequeueResponseMs = Math.round(dequeueDurationSeconds * 1000);
            if (!response.success) {
                this.metrics?.observeDequeueLatency(dequeueDurationSeconds, "error");
                this.logger.error("Failed to dequeue", { error: response.error });
            }
            else {
                this.metrics?.observeDequeueLatency(dequeueDurationSeconds, response.data.length > 0 ? "success" : "empty");
                try {
                    await this.onDequeue(response.data, {
                        dequeueResponseMs,
                        pollingIntervalMs: this.lastScheduledIntervalMs,
                    });
                    if (response.data.length > 0) {
                        nextIntervalMs = this.intervalMs;
                    }
                }
                catch (handlerError) {
                    this.logger.error("onDequeue error", { error: handlerError });
                }
            }
        }
        catch (clientError) {
            // wrapZodFetch traps all errors into { success: false }, so this branch is
            // unreachable with the real client today. Record defensively so a future
            // client that throws can't silently lose error samples.
            this.metrics?.observeDequeueLatency((performance.now() - dequeueStart) / 1000, "error");
            this.logger.error("client.dequeue error", { error: clientError });
        }
        this.scheduleNextDequeue(nextIntervalMs);
    }
    scheduleNextDequeue(delayMs) {
        if (delayMs === this.idleIntervalMs && this.idleIntervalMs !== this.intervalMs) {
            this.logger.verbose("scheduled dequeue with idle interval", { delayMs });
        }
        this.lastScheduledIntervalMs = delayMs;
        setTimeout(this.dequeue.bind(this), delayMs);
    }
}
//# sourceMappingURL=queueConsumer.js.map