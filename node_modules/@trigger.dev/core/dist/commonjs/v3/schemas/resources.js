"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageDetailsMetadata = exports.BackgroundWorkerMetadata = exports.WebhookResource = exports.PromptResource = exports.BackgroundWorkerSourceFileMetadata = exports.TaskResource = exports.AgentConfig = void 0;
const v4_1 = require("zod/v4");
const schemas_js_1 = require("./schemas.js");
const common_js_1 = require("./common.js");
const webhookConfig_js_1 = require("./webhookConfig.js");
exports.AgentConfig = v4_1.z.object({
    type: v4_1.z.string(), // "ai-sdk-chat" initially, extensible for future agent types
});
exports.TaskResource = v4_1.z.object({
    id: v4_1.z.string(),
    description: v4_1.z.string().optional(),
    filePath: v4_1.z.string(),
    exportName: v4_1.z.string().optional(),
    queue: schemas_js_1.QueueManifest.extend({ name: v4_1.z.string().optional() }).optional(),
    retry: schemas_js_1.RetryOptions.optional(),
    machine: common_js_1.MachineConfig.optional(),
    triggerSource: v4_1.z.string().optional(),
    agentConfig: exports.AgentConfig.optional(),
    schedule: schemas_js_1.ScheduleMetadata.optional(),
    maxDuration: v4_1.z.number().optional(),
    ttl: v4_1.z.string().or(v4_1.z.number().nonnegative().int()).optional(),
    // JSONSchema type - using z.unknown() for runtime validation to accept JSONSchema7
    payloadSchema: v4_1.z.unknown().optional(),
});
exports.BackgroundWorkerSourceFileMetadata = v4_1.z.object({
    filePath: v4_1.z.string(),
    contents: v4_1.z.string(),
    contentHash: v4_1.z.string(),
    taskIds: v4_1.z.array(v4_1.z.string()),
});
exports.PromptResource = v4_1.z.object({
    id: v4_1.z.string(),
    description: v4_1.z.string().optional(),
    filePath: v4_1.z.string(),
    exportName: v4_1.z.string().optional(),
    /** The default template content */
    content: v4_1.z.string().optional(),
    /** Default model identifier */
    model: v4_1.z.string().optional(),
    /** Default model config (temperature, maxTokens, etc.) */
    config: v4_1.z.record(v4_1.z.string(), v4_1.z.unknown()).optional(),
    /** JSONSchema7 for template variables */
    variableSchema: v4_1.z.unknown().optional(),
});
exports.WebhookResource = v4_1.z.object({
    id: v4_1.z.string(),
    description: v4_1.z.string().optional(),
    filePath: v4_1.z.string(),
    exportName: v4_1.z.string().optional(),
    source: v4_1.z.string(),
    verifierArtifact: webhookConfig_js_1.WebhookVerifierArtifact,
    routingTarget: webhookConfig_js_1.WebhookRoutingTarget,
    secretProvisioning: webhookConfig_js_1.WebhookSecretProvisioning.optional(),
    filter: v4_1.z.string().optional(), // delivery filter DSL string; compiled to a FilterAst at deploy-sync
    metadata: v4_1.z.record(v4_1.z.string(), v4_1.z.unknown()).optional(),
});
exports.BackgroundWorkerMetadata = v4_1.z.object({
    packageVersion: v4_1.z.string(),
    contentHash: v4_1.z.string(),
    cliPackageVersion: v4_1.z.string().optional(),
    tasks: v4_1.z.array(exports.TaskResource),
    prompts: v4_1.z.array(exports.PromptResource).optional(),
    webhooks: v4_1.z.array(exports.WebhookResource).optional(), // NEW
    queues: v4_1.z.array(schemas_js_1.QueueManifest).optional(),
    sourceFiles: v4_1.z.array(exports.BackgroundWorkerSourceFileMetadata).optional(),
    runtime: v4_1.z.string().optional(),
    runtimeVersion: v4_1.z.string().optional(),
});
exports.ImageDetailsMetadata = v4_1.z.object({
    contentHash: v4_1.z.string(),
    imageTag: v4_1.z.string(),
});
//# sourceMappingURL=resources.js.map