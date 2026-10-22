"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TriggerClient = void 0;
const v3_1 = require("@trigger.dev/core/v3");
require("@trigger.dev/core/v3/sdk-scope-storage");
const auth_js_1 = require("./auth.js");
const batch_js_1 = require("./batch.js");
const deployments_js_1 = require("./deployments.js");
const envvarsModule = __importStar(require("./envvars.js"));
const promptsModule = __importStar(require("./prompts.js"));
const queuesModule = __importStar(require("./queues.js"));
const runs_js_1 = require("./runs.js");
const schedulesModule = __importStar(require("./schedules/index.js"));
const shared_js_1 = require("./shared.js");
const tasksApi = { trigger: shared_js_1.trigger, batchTrigger: shared_js_1.batchTrigger };
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
class TriggerClient {
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
            apiClientConfig: v3_1.apiClientManager.resolveApiClientConfig(partial),
            inheritContext: inheritContext ?? false,
        };
        this.tasks = bindToScope(tasksApi, scope);
        this.runs = bindToScope(runs_js_1.runs, scope);
        this.batch = bindToScope(batch_js_1.batch, scope, batchInstanceKeys);
        this.deployments = bindToScope(deployments_js_1.deployments, scope);
        this.envvars = bindToScope(envvarsModule, scope);
        this.prompts = bindToScope(promptsModule, scope, promptsInstanceKeys);
        this.queues = bindToScope(queuesModule, scope);
        this.schedules = bindToScope(schedulesModule, scope, schedulesInstanceKeys);
        this.auth = bindToScope(auth_js_1.auth, scope, authInstanceKeys);
    }
}
exports.TriggerClient = TriggerClient;
function bindToScope(api, scope, keys) {
    const targetKeys = (keys ?? Object.keys(api));
    const bound = {};
    for (const key of targetKeys) {
        const value = api[key];
        bound[key] =
            typeof value === "function"
                ? (...args) => v3_1.sdkScope.withScope(scope, () => value(...args))
                : value;
    }
    return bound;
}
//# sourceMappingURL=triggerClient.js.map