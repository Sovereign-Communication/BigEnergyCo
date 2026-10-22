import { apiClientManager, sdkScope, } from "@trigger.dev/core/v3";
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
const tasksApi = { trigger, batchTrigger };
const batchInstanceKeys = ["trigger", "triggerByTask", "retrieve"];
const schedulesInstanceKeys = [
    "activate",
    "create",
    "deactivate",
    "del",
    "list",
    "retrieve",
    "update",
];
const promptsInstanceKeys = [
    "createOverride",
    "list",
    "promote",
    "reactivateOverride",
    "removeOverride",
    "resolve",
    "updateOverride",
    "versions",
];
const authInstanceKeys = [
    "createPublicToken",
    "createTriggerPublicToken",
    "createBatchTriggerPublicToken",
];
export class TriggerClient {
    tasks;
    runs;
    batch;
    deployments;
    envvars;
    prompts;
    queues;
    schedules;
    auth;
    constructor(config = {}) {
        const { inheritContext, ...partial } = config;
        const scope = {
            apiClientConfig: apiClientManager.resolveApiClientConfig(partial),
            inheritContext: inheritContext ?? false,
        };
        this.tasks = bindToScope(tasksApi, scope);
        this.runs = bindToScope(runs, scope);
        this.batch = bindToScope(batch, scope, batchInstanceKeys);
        this.deployments = bindToScope(deployments, scope);
        this.envvars = bindToScope(envvarsModule, scope);
        this.prompts = bindToScope(promptsModule, scope, promptsInstanceKeys);
        this.queues = bindToScope(queuesModule, scope);
        this.schedules = bindToScope(schedulesModule, scope, schedulesInstanceKeys);
        this.auth = bindToScope(auth, scope, authInstanceKeys);
    }
}
function bindToScope(api, scope, keys) {
    const targetKeys = (keys ?? Object.keys(api));
    const bound = {};
    for (const key of targetKeys) {
        const value = api[key];
        bound[key] =
            typeof value === "function"
                ? (...args) => sdkScope.withScope(scope, () => value(...args))
                : value;
    }
    return bound;
}
//# sourceMappingURL=triggerClient.js.map