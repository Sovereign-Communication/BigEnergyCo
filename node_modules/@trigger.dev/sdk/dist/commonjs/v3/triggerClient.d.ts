import { type ApiClientConfiguration } from "@trigger.dev/core/v3";
import "@trigger.dev/core/v3/sdk-scope-storage";
import { auth } from "./auth.js";
import { batch } from "./batch.js";
import { deployments } from "./deployments.js";
import * as envvarsModule from "./envvars.js";
import * as promptsModule from "./prompts.js";
import * as queuesModule from "./queues.js";
import { runs } from "./runs.js";
import * as schedulesModule from "./schedules/index.js";
import { batchTrigger, trigger } from "./shared.js";
export type TriggerClientConfig = ApiClientConfiguration & {
    /** Inherit ambient task context (parentRunId, lockToVersion, isTest) when called from inside a task. Default `false`. */
    inheritContext?: boolean;
};
declare const tasksApi: {
    trigger: typeof trigger;
    batchTrigger: typeof batchTrigger;
};
declare const batchInstanceKeys: readonly ["trigger", "triggerByTask", "retrieve"];
declare const schedulesInstanceKeys: readonly ["activate", "create", "deactivate", "del", "list", "retrieve", "update"];
declare const promptsInstanceKeys: readonly ["createOverride", "list", "promote", "reactivateOverride", "removeOverride", "resolve", "updateOverride", "versions"];
declare const authInstanceKeys: readonly ["createPublicToken", "createTriggerPublicToken", "createBatchTriggerPublicToken"];
type TasksApi = typeof tasksApi;
type RunsApi = typeof runs;
type BatchApi = Pick<typeof batch, (typeof batchInstanceKeys)[number]>;
type DeploymentsApi = typeof deployments;
type EnvvarsApi = typeof envvarsModule;
type PromptsApi = Pick<typeof promptsModule, (typeof promptsInstanceKeys)[number]>;
type QueuesApi = typeof queuesModule;
type SchedulesApi = Pick<typeof schedulesModule, (typeof schedulesInstanceKeys)[number]>;
type AuthApi = Pick<typeof auth, (typeof authInstanceKeys)[number]>;
export declare class TriggerClient {
    readonly tasks: TasksApi;
    readonly runs: RunsApi;
    readonly batch: BatchApi;
    readonly deployments: DeploymentsApi;
    readonly envvars: EnvvarsApi;
    readonly prompts: PromptsApi;
    readonly queues: QueuesApi;
    readonly schedules: SchedulesApi;
    readonly auth: AuthApi;
    constructor(config?: TriggerClientConfig);
}
export {};
