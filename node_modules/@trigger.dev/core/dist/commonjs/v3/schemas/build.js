"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportTaskFileErrors = exports.ImportError = exports.WorkerManifestMessage = exports.WorkerManifest = exports.IndexMessage = exports.BuildManifest = exports.BuildRuntime = exports.ConfigRuntime = exports.BuildTarget = exports.BuildExternal = void 0;
const v4_1 = require("zod/v4");
const config_js_1 = require("./config.js");
const schemas_js_1 = require("./schemas.js");
exports.BuildExternal = v4_1.z.object({
    name: v4_1.z.string(),
    version: v4_1.z.string(),
});
exports.BuildTarget = v4_1.z.enum(["dev", "deploy", "unmanaged"]);
exports.ConfigRuntime = v4_1.z.enum([
    "node",
    "node-22",
    "node-24",
    "node-26",
    // Deprecated aliases, kept for backwards compatibility. Use "node-24"/"node-26" instead.
    "experimental-node-24",
    "experimental-node-26",
    "bun",
]);
exports.BuildRuntime = v4_1.z.enum(["node", "node-22", "node-24", "node-26", "bun"]);
exports.BuildManifest = v4_1.z.object({
    target: exports.BuildTarget,
    packageVersion: v4_1.z.string(),
    cliPackageVersion: v4_1.z.string(),
    contentHash: v4_1.z.string(),
    runtime: exports.BuildRuntime,
    environment: v4_1.z.string(),
    branch: v4_1.z.string().optional(),
    config: config_js_1.ConfigManifest,
    files: v4_1.z.array(schemas_js_1.TaskFile),
    sources: v4_1.z.record(v4_1.z.string(), v4_1.z.object({
        contents: v4_1.z.string(),
        contentHash: v4_1.z.string(),
    })),
    outputPath: v4_1.z.string(),
    runWorkerEntryPoint: v4_1.z.string(), // Dev & Deploy has a runWorkerEntryPoint
    runControllerEntryPoint: v4_1.z.string().optional(), // Only deploy has a runControllerEntryPoint
    indexWorkerEntryPoint: v4_1.z.string(), // Dev & Deploy has a indexWorkerEntryPoint
    indexControllerEntryPoint: v4_1.z.string().optional(), // Only deploy has a indexControllerEntryPoint
    loaderEntryPoint: v4_1.z.string().optional(),
    initEntryPoint: v4_1.z.string().optional(), // Optional init.ts entry point
    configPath: v4_1.z.string(),
    externals: exports.BuildExternal.array().optional(),
    build: v4_1.z.object({
        env: v4_1.z.record(v4_1.z.string(), v4_1.z.string()).optional(),
        commands: v4_1.z.array(v4_1.z.string()).optional(),
    }),
    customConditions: v4_1.z.array(v4_1.z.string()).optional(),
    deploy: v4_1.z.object({
        env: v4_1.z.record(v4_1.z.string(), v4_1.z.string()).optional(),
        sync: v4_1.z
            .object({
            env: v4_1.z.record(v4_1.z.string(), v4_1.z.string()).optional(),
            parentEnv: v4_1.z.record(v4_1.z.string(), v4_1.z.string()).optional(),
            secretEnv: v4_1.z.record(v4_1.z.string(), v4_1.z.string()).optional(),
            secretParentEnv: v4_1.z.record(v4_1.z.string(), v4_1.z.string()).optional(),
        })
            .optional(),
    }),
    image: v4_1.z
        .object({
        pkgs: v4_1.z.array(v4_1.z.string()).optional(),
        instructions: v4_1.z.array(v4_1.z.string()).optional(),
    })
        .optional(),
    otelImportHook: v4_1.z
        .object({
        include: v4_1.z.array(v4_1.z.string()).optional(),
        exclude: v4_1.z.array(v4_1.z.string()).optional(),
    })
        .optional(),
    /** Maps output file paths to their content hashes for deduplication during dev */
    outputHashes: v4_1.z.record(v4_1.z.string(), v4_1.z.string()).optional(),
    /** Skills discovered and bundled into `.trigger/skills/{id}/` under `outputPath`. */
    skills: schemas_js_1.SkillManifest.array().optional(),
});
exports.IndexMessage = v4_1.z.object({
    type: v4_1.z.literal("index"),
    data: v4_1.z.object({
        build: exports.BuildManifest,
    }),
});
exports.WorkerManifest = v4_1.z.object({
    configPath: v4_1.z.string(),
    tasks: schemas_js_1.TaskManifest.array(),
    prompts: schemas_js_1.PromptManifest.array().optional(),
    skills: schemas_js_1.SkillManifest.array().optional(),
    webhooks: schemas_js_1.WebhookManifest.array().optional(), // NEW
    unclaimedSessionWebhooks: v4_1.z.array(v4_1.z.string()).optional(), // session.webhook descriptors no agent listed
    queues: schemas_js_1.QueueManifest.array().optional(),
    workerEntryPoint: v4_1.z.string(),
    controllerEntryPoint: v4_1.z.string().optional(),
    loaderEntryPoint: v4_1.z.string().optional(),
    initEntryPoint: v4_1.z.string().optional(), // Optional init.ts entry point
    runtime: exports.BuildRuntime,
    runtimeVersion: v4_1.z.string().optional(),
    customConditions: v4_1.z.array(v4_1.z.string()).optional(),
    timings: v4_1.z.record(v4_1.z.string(), v4_1.z.number()).optional(),
    processKeepAlive: v4_1.z
        .object({
        enabled: v4_1.z.boolean(),
        maxExecutionsPerProcess: v4_1.z.number().int().positive().optional(),
    })
        .optional(),
    otelImportHook: v4_1.z
        .object({
        include: v4_1.z.array(v4_1.z.string()).optional(),
        exclude: v4_1.z.array(v4_1.z.string()).optional(),
    })
        .optional(),
});
exports.WorkerManifestMessage = v4_1.z.object({
    type: v4_1.z.literal("worker-manifest"),
    data: v4_1.z.object({
        manifest: exports.WorkerManifest,
    }),
});
exports.ImportError = v4_1.z.object({
    message: v4_1.z.string(),
    file: v4_1.z.string(),
    stack: v4_1.z.string().optional(),
    name: v4_1.z.string().optional(),
});
exports.ImportTaskFileErrors = v4_1.z.array(exports.ImportError);
//# sourceMappingURL=build.js.map