"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeEnvironmentTypeSchema = exports.RuntimeEnvironmentType = exports.SerializedError = exports.WaitpointTokenResult = exports.BatchTaskRunExecutionResult = exports.TaskRunExecutionResult = exports.TaskRunSuccessfulExecutionResult = exports.TaskRunFailedExecutionResult = exports.TaskRunExecutionUsage = exports.TaskRunExecutionRetry = exports.V3TaskRunContext = exports.V3TaskRunExecutionEnvironment = exports.TaskRunContext = exports.V3TaskRunExecution = exports.V3TaskRun = exports.V3TaskRunExecutionAttempt = exports.V3TaskRunExecutionTask = exports.TaskRunExecution = exports.StaticTaskRunExecution = exports.TaskRunExecutionDeployment = exports.TaskRunExecutionBatch = exports.TaskRunExecutionQueue = exports.TaskRunExecutionProject = exports.TaskRunExecutionOrganization = exports.TaskRunExecutionEnvironment = exports.TaskRunExecutionAttempt = exports.TaskRunExecutionTask = exports.GitMeta = exports.TaskRun = exports.TaskRunError = exports.TaskRunErrorCodes = exports.TaskRunInternalError = exports.TaskRunStringError = exports.TaskRunCustomErrorObject = exports.TaskRunBuiltInError = exports.TaskRunErrorCause = exports.MachinePreset = exports.MachineConfig = exports.MachinePresetName = exports.MachineMemory = exports.MachineCpu = exports.FlushedRunMetadata = exports.RunMetadataChangeOperation = exports.RunMetadataIncrementKeyOperation = exports.RunMetadataRemoveFromKeyOperation = exports.RunMetadataAppendKeyOperation = exports.RunMetadataDeleteKeyOperation = exports.RunMetadataSetKeyOperation = exports.RunMetadataUpdateOperation = void 0;
exports.isSafeMetadataKey = isSafeMetadataKey;
const v4_1 = require("zod/v4");
const zod_js_1 = require("../utils/zod.js");
const json_js_1 = require("../../schemas/json.js");
const DANGEROUS_METADATA_KEY_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);
/**
 * Prototype-pollution guard for run metadata operation keys. JSON paths are applied via
 * JSONHeroPath, so dangerous path segments must be rejected. Literal keys are assigned directly,
 * where only __proto__ can change the target object's prototype.
 */
function isSafeMetadataKey(key) {
    if (!key.startsWith("$.")) {
        return key !== "__proto__";
    }
    return !key.split(/[.[\]'"]+/).some((segment) => DANGEROUS_METADATA_KEY_SEGMENTS.has(segment));
}
const MetadataOperationKey = v4_1.z.string().refine(isSafeMetadataKey, {
    message: "Metadata key may not reference __proto__, constructor, or prototype",
});
exports.RunMetadataUpdateOperation = v4_1.z.object({
    type: v4_1.z.literal("update"),
    value: v4_1.z.record(v4_1.z.string(), v4_1.z.unknown()),
});
exports.RunMetadataSetKeyOperation = v4_1.z.object({
    type: v4_1.z.literal("set"),
    key: MetadataOperationKey,
    value: json_js_1.DeserializedJsonSchema,
});
exports.RunMetadataDeleteKeyOperation = v4_1.z.object({
    type: v4_1.z.literal("delete"),
    key: MetadataOperationKey,
});
exports.RunMetadataAppendKeyOperation = v4_1.z.object({
    type: v4_1.z.literal("append"),
    key: MetadataOperationKey,
    value: json_js_1.DeserializedJsonSchema,
});
exports.RunMetadataRemoveFromKeyOperation = v4_1.z.object({
    type: v4_1.z.literal("remove"),
    key: MetadataOperationKey,
    value: json_js_1.DeserializedJsonSchema,
});
exports.RunMetadataIncrementKeyOperation = v4_1.z.object({
    type: v4_1.z.literal("increment"),
    key: MetadataOperationKey,
    value: v4_1.z.number(),
});
exports.RunMetadataChangeOperation = (0, zod_js_1.discriminatedUnion)("type", [
    exports.RunMetadataUpdateOperation,
    exports.RunMetadataSetKeyOperation,
    exports.RunMetadataDeleteKeyOperation,
    exports.RunMetadataAppendKeyOperation,
    exports.RunMetadataRemoveFromKeyOperation,
    exports.RunMetadataIncrementKeyOperation,
]);
exports.FlushedRunMetadata = v4_1.z.object({
    metadata: v4_1.z.record(v4_1.z.string(), json_js_1.DeserializedJsonSchema).optional(),
    operations: v4_1.z.array(exports.RunMetadataChangeOperation).optional(),
    parentOperations: v4_1.z.array(exports.RunMetadataChangeOperation).optional(),
    rootOperations: v4_1.z.array(exports.RunMetadataChangeOperation).optional(),
});
// Defaults to 0.5
exports.MachineCpu = v4_1.z.union([
    v4_1.z.literal(0.25),
    v4_1.z.literal(0.5),
    v4_1.z.literal(1),
    v4_1.z.literal(2),
    v4_1.z.literal(4),
]);
// Defaults to 1
exports.MachineMemory = v4_1.z.union([
    v4_1.z.literal(0.25),
    v4_1.z.literal(0.5),
    v4_1.z.literal(1),
    v4_1.z.literal(2),
    v4_1.z.literal(4),
    v4_1.z.literal(8),
]);
// Default is small-1x
exports.MachinePresetName = v4_1.z.enum([
    "micro",
    "small-1x",
    "small-2x",
    "medium-1x",
    "medium-2x",
    "large-1x",
    "large-2x",
]);
exports.MachineConfig = v4_1.z.object({
    cpu: exports.MachineCpu.optional(),
    memory: exports.MachineMemory.optional(),
    preset: exports.MachinePresetName.optional(),
});
exports.MachinePreset = v4_1.z.object({
    name: exports.MachinePresetName,
    /** unit: vCPU */
    cpu: v4_1.z.number(),
    /** unit: GB */
    memory: v4_1.z.number(),
    centsPerMs: v4_1.z.number(),
});
/**
 * One link in a thrown error's `cause` chain, flattened outermost-first.
 * A cause is not necessarily an Error, so only `message` is guaranteed.
 */
exports.TaskRunErrorCause = v4_1.z.object({
    name: v4_1.z.string().optional(),
    message: v4_1.z.string(),
    stackTrace: v4_1.z.string().optional(),
});
exports.TaskRunBuiltInError = v4_1.z.object({
    type: v4_1.z.literal("BUILT_IN_ERROR"),
    name: v4_1.z.string(),
    message: v4_1.z.string(),
    stackTrace: v4_1.z.string(),
    causes: v4_1.z.array(exports.TaskRunErrorCause).optional(),
});
exports.TaskRunCustomErrorObject = v4_1.z.object({
    type: v4_1.z.literal("CUSTOM_ERROR"),
    raw: v4_1.z.string(),
});
exports.TaskRunStringError = v4_1.z.object({
    type: v4_1.z.literal("STRING_ERROR"),
    raw: v4_1.z.string(),
});
exports.TaskRunInternalError = v4_1.z.object({
    type: v4_1.z.literal("INTERNAL_ERROR"),
    code: v4_1.z.enum([
        "COULD_NOT_FIND_EXECUTOR",
        "COULD_NOT_FIND_TASK",
        "COULD_NOT_IMPORT_TASK",
        "CONFIGURED_INCORRECTLY",
        "TASK_ALREADY_RUNNING",
        "TASK_EXECUTION_FAILED",
        "TASK_EXECUTION_ABORTED",
        "TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE",
        "TASK_PROCESS_SIGKILL_TIMEOUT",
        "TASK_PROCESS_SIGSEGV",
        "TASK_PROCESS_SIGTERM",
        "TASK_PROCESS_OOM_KILLED",
        "TASK_PROCESS_MAYBE_OOM_KILLED",
        "TASK_RUN_CANCELLED",
        "TASK_INPUT_ERROR",
        "TASK_OUTPUT_ERROR",
        "TASK_MIDDLEWARE_ERROR",
        "HANDLE_ERROR_ERROR",
        "GRACEFUL_EXIT_TIMEOUT",
        "TASK_RUN_HEARTBEAT_TIMEOUT",
        "TASK_RUN_CRASHED",
        "TASK_RUN_UNCAUGHT_EXCEPTION",
        "MAX_DURATION_EXCEEDED",
        "DISK_SPACE_EXCEEDED",
        "POD_EVICTED",
        "POD_UNKNOWN_ERROR",
        "TASK_HAS_N0_EXECUTION_SNAPSHOT",
        "TASK_DEQUEUED_INVALID_STATE",
        "TASK_DEQUEUED_QUEUE_NOT_FOUND",
        "TASK_RUN_DEQUEUED_MAX_RETRIES",
        "TASK_RUN_STALLED_EXECUTING",
        "TASK_RUN_STALLED_EXECUTING_WITH_WAITPOINTS",
        "OUTDATED_SDK_VERSION",
        "TASK_DID_CONCURRENT_WAIT",
        "RECURSIVE_WAIT_DEADLOCK",
        "BATCH_ITEM_COULD_NOT_TRIGGER",
        "PAYLOAD_TOO_LARGE",
        "UNSPECIFIED_ERROR",
    ]),
    message: v4_1.z.string().optional(),
    stackTrace: v4_1.z.string().optional(),
});
exports.TaskRunErrorCodes = exports.TaskRunInternalError.shape.code.enum;
exports.TaskRunError = (0, zod_js_1.discriminatedUnion)("type", [
    exports.TaskRunBuiltInError,
    exports.TaskRunCustomErrorObject,
    exports.TaskRunStringError,
    exports.TaskRunInternalError,
]);
exports.TaskRun = v4_1.z.object({
    id: v4_1.z.string(),
    payload: v4_1.z.string(),
    payloadType: v4_1.z.string(),
    tags: v4_1.z.array(v4_1.z.string()),
    isTest: v4_1.z.boolean().default(false),
    isReplay: v4_1.z.boolean().default(false),
    createdAt: v4_1.z.coerce.date(),
    startedAt: v4_1.z.coerce.date().default(() => new Date()),
    /** The user-provided idempotency key (not the hash) */
    idempotencyKey: v4_1.z.string().optional(),
    /** The scope of the idempotency key */
    idempotencyKeyScope: v4_1.z.enum(["run", "attempt", "global"]).optional(),
    maxAttempts: v4_1.z.number().optional(),
    version: v4_1.z.string().optional(),
    metadata: v4_1.z.record(v4_1.z.string(), json_js_1.DeserializedJsonSchema).optional(),
    maxDuration: v4_1.z.number().optional(),
    /** The priority of the run. Wih a value of 10 it will be dequeued before runs that were triggered 9 seconds before it (assuming they had no priority set).  */
    priority: v4_1.z.number().optional(),
    baseCostInCents: v4_1.z.number().optional(),
    parentTaskRunId: v4_1.z.string().optional(),
    rootTaskRunId: v4_1.z.string().optional(),
    // These are only used during execution, not in run.ctx
    durationMs: v4_1.z.number().optional(),
    costInCents: v4_1.z.number().optional(),
    region: v4_1.z.string().optional(),
});
// newly added fields need to be optional for backwards compatibility
exports.GitMeta = v4_1.z.object({
    provider: v4_1.z.string().optional(),
    source: v4_1.z.enum(["trigger_github_app", "github_actions", "local"]).optional(),
    ghUsername: v4_1.z.string().optional(),
    ghUserAvatarUrl: v4_1.z.string().optional(),
    commitAuthorName: v4_1.z.string().optional(),
    commitMessage: v4_1.z.string().optional(),
    commitRef: v4_1.z.string().optional(),
    commitSha: v4_1.z.string().optional(),
    dirty: v4_1.z.boolean().optional(),
    remoteUrl: v4_1.z.string().optional(),
    pullRequestNumber: v4_1.z.number().optional(),
    pullRequestTitle: v4_1.z.string().optional(),
    pullRequestState: v4_1.z.enum(["open", "closed", "merged"]).optional(),
});
exports.TaskRunExecutionTask = v4_1.z.object({
    id: v4_1.z.string(),
    filePath: v4_1.z.string(),
});
exports.TaskRunExecutionAttempt = v4_1.z.object({
    number: v4_1.z.number(),
    startedAt: v4_1.z.coerce.date(),
});
exports.TaskRunExecutionEnvironment = v4_1.z.object({
    id: v4_1.z.string(),
    slug: v4_1.z.string(),
    type: v4_1.z.enum(["PRODUCTION", "STAGING", "DEVELOPMENT", "PREVIEW"]),
    branchName: v4_1.z.string().optional(),
    git: exports.GitMeta.optional(),
});
exports.TaskRunExecutionOrganization = v4_1.z.object({
    id: v4_1.z.string(),
    slug: v4_1.z.string(),
    name: v4_1.z.string(),
});
exports.TaskRunExecutionProject = v4_1.z.object({
    id: v4_1.z.string(),
    ref: v4_1.z.string(),
    slug: v4_1.z.string(),
    name: v4_1.z.string(),
});
exports.TaskRunExecutionQueue = v4_1.z.object({
    id: v4_1.z.string(),
    name: v4_1.z.string(),
});
exports.TaskRunExecutionBatch = v4_1.z.object({
    id: v4_1.z.string(),
});
exports.TaskRunExecutionDeployment = v4_1.z.object({
    id: v4_1.z.string(),
    shortCode: v4_1.z.string(),
    version: v4_1.z.string(),
    runtime: v4_1.z.string(),
    runtimeVersion: v4_1.z.string(),
    git: exports.GitMeta.optional(),
    /**
     * The `--external-id` this deployment was deployed under. Lets a run tell whether
     * it is the deployment a version-skew pin currently names, which a version alone
     * cannot answer.
     */
    externalId: v4_1.z.string().optional(),
});
const StaticTaskRunExecutionShape = {
    // Passthrough needed for backwards compatibility
    task: exports.TaskRunExecutionTask.passthrough(),
    queue: exports.TaskRunExecutionQueue,
    environment: exports.TaskRunExecutionEnvironment,
    organization: exports.TaskRunExecutionOrganization,
    project: exports.TaskRunExecutionProject,
    machine: exports.MachinePreset,
    batch: exports.TaskRunExecutionBatch.optional(),
    deployment: exports.TaskRunExecutionDeployment.optional(),
};
exports.StaticTaskRunExecution = v4_1.z.object(StaticTaskRunExecutionShape);
exports.TaskRunExecution = v4_1.z.object({
    // Passthrough needed for backwards compatibility
    attempt: exports.TaskRunExecutionAttempt.passthrough(),
    run: exports.TaskRun.and(v4_1.z.object({
        traceContext: v4_1.z.record(v4_1.z.string(), v4_1.z.unknown()).optional(),
        realtimeStreamsVersion: v4_1.z.string().optional(),
    })),
    ...StaticTaskRunExecutionShape,
});
exports.V3TaskRunExecutionTask = v4_1.z.object({
    id: v4_1.z.string(),
    filePath: v4_1.z.string(),
    exportName: v4_1.z.string().optional(),
});
exports.V3TaskRunExecutionAttempt = v4_1.z.object({
    number: v4_1.z.number(),
    startedAt: v4_1.z.coerce.date(),
    id: v4_1.z.string(),
    backgroundWorkerId: v4_1.z.string(),
    backgroundWorkerTaskId: v4_1.z.string(),
    status: v4_1.z.string(),
});
exports.V3TaskRun = v4_1.z.object({
    id: v4_1.z.string(),
    payload: v4_1.z.string(),
    payloadType: v4_1.z.string(),
    tags: v4_1.z.array(v4_1.z.string()),
    isTest: v4_1.z.boolean().default(false),
    isReplay: v4_1.z.boolean().default(false),
    createdAt: v4_1.z.coerce.date(),
    startedAt: v4_1.z.coerce.date().default(() => new Date()),
    /** The user-provided idempotency key (not the hash) */
    idempotencyKey: v4_1.z.string().optional(),
    /** The scope of the idempotency key */
    idempotencyKeyScope: v4_1.z.enum(["run", "attempt", "global"]).optional(),
    maxAttempts: v4_1.z.number().optional(),
    version: v4_1.z.string().optional(),
    metadata: v4_1.z.record(v4_1.z.string(), json_js_1.DeserializedJsonSchema).optional(),
    maxDuration: v4_1.z.number().optional(),
    context: v4_1.z.unknown(),
    durationMs: v4_1.z.number(),
    costInCents: v4_1.z.number(),
    baseCostInCents: v4_1.z.number(),
});
exports.V3TaskRunExecution = v4_1.z.object({
    task: exports.V3TaskRunExecutionTask,
    attempt: exports.V3TaskRunExecutionAttempt,
    run: exports.V3TaskRun.and(v4_1.z.object({
        traceContext: v4_1.z.record(v4_1.z.string(), v4_1.z.unknown()).optional(),
    })),
    queue: exports.TaskRunExecutionQueue,
    environment: exports.TaskRunExecutionEnvironment,
    organization: exports.TaskRunExecutionOrganization,
    project: exports.TaskRunExecutionProject,
    machine: exports.MachinePreset,
    batch: exports.TaskRunExecutionBatch.optional(),
});
exports.TaskRunContext = v4_1.z.object({
    attempt: exports.TaskRunExecutionAttempt,
    run: exports.TaskRun.omit({
        payload: true,
        payloadType: true,
        metadata: true,
        durationMs: true,
        costInCents: true,
    }),
    ...StaticTaskRunExecutionShape,
});
exports.V3TaskRunExecutionEnvironment = v4_1.z.object({
    id: v4_1.z.string(),
    slug: v4_1.z.string(),
    type: v4_1.z.enum(["PRODUCTION", "STAGING", "DEVELOPMENT", "PREVIEW"]),
});
exports.V3TaskRunContext = v4_1.z.object({
    attempt: exports.V3TaskRunExecutionAttempt.omit({
        backgroundWorkerId: true,
        backgroundWorkerTaskId: true,
    }),
    run: exports.V3TaskRun.omit({
        payload: true,
        payloadType: true,
        metadata: true,
    }),
    task: exports.V3TaskRunExecutionTask,
    queue: exports.TaskRunExecutionQueue,
    environment: exports.V3TaskRunExecutionEnvironment,
    organization: exports.TaskRunExecutionOrganization,
    project: exports.TaskRunExecutionProject,
    batch: exports.TaskRunExecutionBatch.optional(),
    machine: exports.MachinePreset.optional(),
});
exports.TaskRunExecutionRetry = v4_1.z.object({
    timestamp: v4_1.z.number(),
    /** Retry delay in milliseconds */
    delay: v4_1.z.number(),
    error: v4_1.z.unknown().optional(),
});
exports.TaskRunExecutionUsage = v4_1.z.object({
    durationMs: v4_1.z.number(),
});
exports.TaskRunFailedExecutionResult = v4_1.z.object({
    ok: v4_1.z.literal(false),
    id: v4_1.z.string(),
    error: exports.TaskRunError,
    retry: exports.TaskRunExecutionRetry.optional(),
    skippedRetrying: v4_1.z.boolean().optional(),
    usage: exports.TaskRunExecutionUsage.optional(),
    // Optional for now for backwards compatibility
    taskIdentifier: v4_1.z.string().optional(),
    // This is deprecated, use flushedMetadata instead
    metadata: exports.FlushedRunMetadata.optional(),
    // This is the new way to flush metadata
    flushedMetadata: v4_1.z
        .object({
        data: v4_1.z.string().optional(),
        dataType: v4_1.z.string(),
    })
        .optional(),
});
exports.TaskRunSuccessfulExecutionResult = v4_1.z.object({
    ok: v4_1.z.literal(true),
    id: v4_1.z.string(),
    output: v4_1.z.string().optional(),
    outputType: v4_1.z.string(),
    usage: exports.TaskRunExecutionUsage.optional(),
    // Optional for now for backwards compatibility
    taskIdentifier: v4_1.z.string().optional(),
    // This is deprecated, use flushedMetadata instead
    metadata: exports.FlushedRunMetadata.optional(),
    // This is the new way to flush metadata
    flushedMetadata: v4_1.z
        .object({
        data: v4_1.z.string().optional(),
        dataType: v4_1.z.string(),
    })
        .optional(),
});
exports.TaskRunExecutionResult = (0, zod_js_1.discriminatedUnion)("ok", [
    exports.TaskRunSuccessfulExecutionResult,
    exports.TaskRunFailedExecutionResult,
]);
exports.BatchTaskRunExecutionResult = v4_1.z.object({
    id: v4_1.z.string(),
    items: exports.TaskRunExecutionResult.array(),
});
exports.WaitpointTokenResult = v4_1.z.object({
    ok: v4_1.z.boolean(),
    output: v4_1.z.string().optional(),
    outputType: v4_1.z.string().optional(),
});
exports.SerializedError = v4_1.z.object({
    message: v4_1.z.string(),
    name: v4_1.z.string().optional(),
    stackTrace: v4_1.z.string().optional(),
    causes: v4_1.z.array(exports.TaskRunErrorCause).optional(),
});
exports.RuntimeEnvironmentType = {
    PRODUCTION: "PRODUCTION",
    STAGING: "STAGING",
    DEVELOPMENT: "DEVELOPMENT",
    PREVIEW: "PREVIEW",
};
exports.RuntimeEnvironmentTypeSchema = v4_1.z.enum(Object.values(exports.RuntimeEnvironmentType));
//# sourceMappingURL=common.js.map