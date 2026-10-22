import { SupervisorHttpClient } from "./http.js";
import type { PreDequeueFn, PreSkipFn, SupervisorClientCommonOptions } from "./types.js";
import type { WorkerQueueClass } from "./schemas.js";
import type { ScalingOptions } from "./consumerPool.js";
import type { WorkerEvents } from "./events.js";
import EventEmitter from "events";
import type { Registry } from "prom-client";
type SupervisorSessionOptions = SupervisorClientCommonOptions & {
    queueConsumerEnabled?: boolean;
    runNotificationsEnabled?: boolean;
    heartbeatIntervalSeconds: number;
    dequeueIntervalMs: number;
    dequeueIdleIntervalMs: number;
    preDequeue?: PreDequeueFn;
    preSkip?: PreSkipFn;
    maxRunCount?: number;
    /** Which worker-queue class this supervisor's consumers pull from. Defaults to the region queue. */
    queueClass?: WorkerQueueClass;
    sendRunDebugLogs?: boolean;
    scaling: ScalingOptions;
    metricsRegistry?: Registry;
};
export declare class SupervisorSession extends EventEmitter<WorkerEvents> {
    private opts;
    readonly httpClient: SupervisorHttpClient;
    private readonly logger;
    private readonly runNotificationsEnabled;
    private runNotificationsSocket?;
    private readonly queueConsumerEnabled;
    private readonly consumerPool;
    private readonly heartbeat;
    constructor(opts: SupervisorSessionOptions);
    private onDequeue;
    subscribeToRunNotifications(runFriendlyIds: string[]): void;
    unsubscribeFromRunNotifications(runFriendlyIds: string[]): void;
    private createRunNotificationsSocket;
    start(): Promise<void>;
    stop(): Promise<void>;
    private getHeartbeatBody;
}
export {};
