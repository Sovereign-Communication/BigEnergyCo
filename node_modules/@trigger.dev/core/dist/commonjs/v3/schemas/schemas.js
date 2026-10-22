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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TriggerTraceContext = exports.RunChainState = exports.ManualCheckpointMetadata = exports.TaskRunExecutionLazyAttemptPayload = exports.WaitReason = exports.Config = exports.PreStopCauses = exports.PostStartCauses = exports.WebhookManifest = exports.WebhookMetadata = exports.SkillManifest = exports.SkillMetadata = exports.PromptManifest = exports.PromptMetadata = exports.TaskManifest = exports.TaskFileMetadata = exports.TaskFile = exports.TaskMetadata = exports.ScheduleMetadata = exports.QueueManifest = exports.RetryOptions = exports.RateLimitOptions = exports.SlidingWindowRateLimit = exports.FixedWindowRateLimit = exports.V3ProdTaskRunExecutionPayload = exports.V3ProdTaskRunExecution = exports.TaskRunExecutionPayload = exports.TaskRunExecutionMetrics = exports.TaskRunExecutionMetric = exports.RunEngineVersionSchema = exports.EnvironmentType = void 0;
const v4_1 = require("zod/v4");
const zod_js_1 = require("../utils/zod.js");
const webhookConfig_js_1 = require("./webhookConfig.js");
const common_js_1 = require("./common.js");
const scheduleWindow_js_1 = require("./scheduleWindow.js");
__exportStar(require("./scheduleWindow.js"), exports);
/*
    WARNING: Never import anything from ./messages here. If it's needed in both, put it here instead.
*/
exports.EnvironmentType = v4_1.z.enum(["PRODUCTION", "STAGING", "DEVELOPMENT", "PREVIEW"]);
exports.RunEngineVersionSchema = v4_1.z.enum(["V1", "V2"]);
exports.TaskRunExecutionMetric = v4_1.z.object({
    name: v4_1.z.string(),
    event: v4_1.z.string(),
    timestamp: v4_1.z.number(),
    duration: v4_1.z.number(),
});
exports.TaskRunExecutionMetrics = v4_1.z.array(exports.TaskRunExecutionMetric);
exports.TaskRunExecutionPayload = v4_1.z.object({
    execution: common_js_1.TaskRunExecution,
    traceContext: v4_1.z.record(v4_1.z.string(), v4_1.z.unknown()),
    environment: v4_1.z.record(v4_1.z.string(), v4_1.z.string()).optional(),
    metrics: exports.TaskRunExecutionMetrics.optional(),
});
// **IMPORTANT NOTE**: If you change this schema, make sure it is backwards compatible with the previous version as this also used when a worker signals to the coordinator that a TaskRun is complete.
// Strategies for not breaking backwards compatibility:
// 1. Add new fields as optional
// 2. If a field is required, add a default value
exports.V3ProdTaskRunExecution = common_js_1.V3TaskRunExecution.extend({
    worker: v4_1.z.object({
        id: v4_1.z.string(),
        contentHash: v4_1.z.string(),
        version: v4_1.z.string(),
        type: exports.RunEngineVersionSchema.optional(),
    }),
    machine: common_js_1.MachinePreset.default({ name: "small-1x", cpu: 1, memory: 1, centsPerMs: 0 }),
});
exports.V3ProdTaskRunExecutionPayload = v4_1.z.object({
    execution: exports.V3ProdTaskRunExecution,
    traceContext: v4_1.z.record(v4_1.z.string(), v4_1.z.unknown()),
    environment: v4_1.z.record(v4_1.z.string(), v4_1.z.string()).optional(),
    metrics: exports.TaskRunExecutionMetrics.optional(),
});
exports.FixedWindowRateLimit = v4_1.z.object({
    type: v4_1.z.literal("fixed-window"),
    limit: v4_1.z.number(),
    window: v4_1.z.union([
        v4_1.z.object({
            seconds: v4_1.z.number(),
        }),
        v4_1.z.object({
            minutes: v4_1.z.number(),
        }),
        v4_1.z.object({
            hours: v4_1.z.number(),
        }),
    ]),
});
exports.SlidingWindowRateLimit = v4_1.z.object({
    type: v4_1.z.literal("sliding-window"),
    limit: v4_1.z.number(),
    window: v4_1.z.union([
        v4_1.z.object({
            seconds: v4_1.z.number(),
        }),
        v4_1.z.object({
            minutes: v4_1.z.number(),
        }),
        v4_1.z.object({
            hours: v4_1.z.number(),
        }),
    ]),
});
exports.RateLimitOptions = (0, zod_js_1.discriminatedUnion)("type", [
    exports.FixedWindowRateLimit,
    exports.SlidingWindowRateLimit,
]);
exports.RetryOptions = v4_1.z.object({
    /** The number of attempts before giving up */
    maxAttempts: v4_1.z.number().int().optional(),
    /** The exponential factor to use when calculating the next retry time.
     *
     * Each subsequent retry will be calculated as `previousTimeout * factor`
     */
    factor: v4_1.z.number().optional(),
    /** The minimum time to wait before retrying */
    minTimeoutInMs: v4_1.z.number().int().optional(),
    /** The maximum time to wait before retrying */
    maxTimeoutInMs: v4_1.z.number().int().optional(),
    /** Randomize the timeout between retries.
     *
     * This can be useful to prevent the thundering herd problem where all retries happen at the same time.
     */
    randomize: v4_1.z.boolean().optional(),
    /** If a run fails with an Out Of Memory (OOM) error and you have this set, it will retry with the machine you specify.
     * Note: it will not default to this [machine](https://trigger.dev/docs/machines) for new runs, only for failures caused by OOM errors.
     * So if you frequently have attempts failing with OOM errors, you should set the [default machine](https://trigger.dev/docs/machines) to be higher.
     */
    outOfMemory: v4_1.z
        .object({
        machine: common_js_1.MachinePresetName.optional(),
    })
        .optional(),
});
exports.QueueManifest = v4_1.z.object({
    /** You can define a shared queue and then pass the name in to your task.
     *
     * @example
     *
     * ```ts
     * const myQueue = queue({
        name: "my-queue",
        concurrencyLimit: 1,
      });
  
      export const task1 = task({
        id: "task-1",
        queue: {
          name: "my-queue",
        },
        run: async (payload: { message: string }) => {
          // ...
        },
      });
  
      export const task2 = task({
        id: "task-2",
        queue: {
          name: "my-queue",
        },
        run: async (payload: { message: string }) => {
          // ...
        },
      });
     * ```
     */
    name: v4_1.z.string(),
    /** An optional property that specifies the maximum number of concurrent run executions.
     *
     * If this property is omitted, the task can potentially use up the full concurrency of an environment */
    concurrencyLimit: v4_1.z.number().int().min(0).max(100000).optional().nullable(),
});
exports.ScheduleMetadata = v4_1.z.object({
    cron: v4_1.z.string(),
    timezone: v4_1.z.string(),
    environments: v4_1.z.array(exports.EnvironmentType).optional(),
    window: scheduleWindow_js_1.ScheduleWindow.optional(),
});
const AgentConfig = v4_1.z.object({
    type: v4_1.z.string(),
});
const taskMetadata = {
    id: v4_1.z.string(),
    description: v4_1.z.string().optional(),
    queue: exports.QueueManifest.extend({ name: v4_1.z.string().optional() }).optional(),
    retry: exports.RetryOptions.optional(),
    machine: common_js_1.MachineConfig.optional(),
    triggerSource: v4_1.z.string().optional(),
    agentConfig: AgentConfig.optional(),
    schedule: exports.ScheduleMetadata.optional(),
    maxDuration: v4_1.z.number().optional(),
    ttl: v4_1.z.string().or(v4_1.z.number().nonnegative().int()).optional(),
    payloadSchema: v4_1.z.unknown().optional(),
};
exports.TaskMetadata = v4_1.z.object(taskMetadata);
exports.TaskFile = v4_1.z.object({
    entry: v4_1.z.string(),
    out: v4_1.z.string(),
});
const taskFileMetadata = {
    filePath: v4_1.z.string(),
    exportName: v4_1.z.string().optional(),
    entryPoint: v4_1.z.string(),
};
exports.TaskFileMetadata = v4_1.z.object(taskFileMetadata);
exports.TaskManifest = v4_1.z.object({
    ...taskMetadata,
    ...taskFileMetadata,
});
const promptMetadata = {
    id: v4_1.z.string(),
    description: v4_1.z.string().optional(),
    content: v4_1.z.string().optional(),
    model: v4_1.z.string().optional(),
    config: v4_1.z.record(v4_1.z.string(), v4_1.z.unknown()).optional(),
    variableSchema: v4_1.z.unknown().optional(),
};
exports.PromptMetadata = v4_1.z.object(promptMetadata);
exports.PromptManifest = v4_1.z.object({
    ...promptMetadata,
    ...taskFileMetadata,
});
// ── Skills ────────────────────────────────────────────────────────────────
//
// A skill is a developer-authored folder (SKILL.md + scripts/references/assets)
// bundled into the deploy image. SkillMetadata is registered at module load
// by `ai.defineSkill({ id, path })`; the CLI's built-in bundler picks it up
// during deploy and copies the folder into the deploy image.
const skillMetadata = {
    id: v4_1.z.string(),
    /** Path to the skill's source folder, relative to the project root. */
    sourcePath: v4_1.z.string(),
};
exports.SkillMetadata = v4_1.z.object(skillMetadata);
exports.SkillManifest = v4_1.z.object({
    ...skillMetadata,
    ...taskFileMetadata,
});
// ── Webhooks ────────────────────────────────────────────────────────────────
const webhookMetadata = {
    id: v4_1.z.string(),
    description: v4_1.z.string().optional(),
    source: v4_1.z.string(),
    verifierArtifact: webhookConfig_js_1.WebhookVerifierArtifact,
    routingTarget: webhookConfig_js_1.WebhookRoutingTarget,
    secretProvisioning: webhookConfig_js_1.WebhookSecretProvisioning.optional(),
    filter: v4_1.z.string().optional(), // delivery filter DSL string; compiled to a FilterAst at deploy-sync
    metadata: v4_1.z.record(v4_1.z.string(), v4_1.z.unknown()).optional(),
};
exports.WebhookMetadata = v4_1.z.object(webhookMetadata);
exports.WebhookManifest = v4_1.z.object({
    ...webhookMetadata,
    ...taskFileMetadata, // filePath, exportName?, entryPoint
});
exports.PostStartCauses = v4_1.z.enum(["index", "create", "restore"]);
exports.PreStopCauses = v4_1.z.enum(["terminate"]);
const RegexSchema = v4_1.z.custom((val) => {
    try {
        // Check to see if val is a regex
        return typeof val.test === "function";
    }
    catch {
        return false;
    }
});
exports.Config = v4_1.z.object({
    project: v4_1.z.string(),
    triggerDirectories: v4_1.z.string().array().optional(),
    triggerUrl: v4_1.z.string().optional(),
    projectDir: v4_1.z.string().optional(),
    tsconfigPath: v4_1.z.string().optional(),
    retries: v4_1.z
        .object({
        enabledInDev: v4_1.z.boolean().default(true),
        default: exports.RetryOptions.optional(),
    })
        .optional(),
    additionalPackages: v4_1.z.string().array().optional(),
    additionalFiles: v4_1.z.string().array().optional(),
    dependenciesToBundle: v4_1.z.array(v4_1.z.union([v4_1.z.string(), RegexSchema])).optional(),
    logLevel: v4_1.z.string().optional(),
    enableConsoleLogging: v4_1.z.boolean().optional(),
    postInstall: v4_1.z.string().optional(),
    extraCACerts: v4_1.z.string().optional(),
});
exports.WaitReason = v4_1.z.enum(["WAIT_FOR_DURATION", "WAIT_FOR_TASK", "WAIT_FOR_BATCH"]);
exports.TaskRunExecutionLazyAttemptPayload = v4_1.z.object({
    runId: v4_1.z.string(),
    attemptCount: v4_1.z.number().optional(),
    messageId: v4_1.z.string(),
    isTest: v4_1.z.boolean(),
    isReplay: v4_1.z.boolean().default(false),
    traceContext: v4_1.z.record(v4_1.z.string(), v4_1.z.unknown()),
    environment: v4_1.z.record(v4_1.z.string(), v4_1.z.string()).optional(),
    metrics: exports.TaskRunExecutionMetrics.optional(),
});
exports.ManualCheckpointMetadata = v4_1.z.object({
    /** NOT a friendly ID */
    attemptId: v4_1.z.string(),
    previousRunStatus: v4_1.z.string(),
    previousAttemptStatus: v4_1.z.string(),
});
exports.RunChainState = v4_1.z.object({
    concurrency: v4_1.z
        .object({
        queues: v4_1.z.array(v4_1.z.object({ id: v4_1.z.string(), name: v4_1.z.string(), holding: v4_1.z.number() })),
        environment: v4_1.z.number().optional(),
    })
        .optional(),
});
exports.TriggerTraceContext = v4_1.z.object({
    traceparent: v4_1.z.string().optional(),
    tracestate: v4_1.z.string().optional(),
    external: v4_1.z
        .object({
        traceparent: v4_1.z.string().optional(),
        tracestate: v4_1.z.string().optional(),
    })
        .optional(),
});
//# sourceMappingURL=schemas.js.map