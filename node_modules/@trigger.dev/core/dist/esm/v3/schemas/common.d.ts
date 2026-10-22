import { z } from "zod/v4";
export type Enum<T extends string> = {
    [K in T]: K;
};
/**
 * Prototype-pollution guard for run metadata operation keys. JSON paths are applied via
 * JSONHeroPath, so dangerous path segments must be rejected. Literal keys are assigned directly,
 * where only __proto__ can change the target object's prototype.
 */
export declare function isSafeMetadataKey(key: string): boolean;
export declare const RunMetadataUpdateOperation: z.ZodObject<{
    type: z.ZodLiteral<"update">;
    value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>;
export type RunMetadataUpdateOperation = z.infer<typeof RunMetadataUpdateOperation>;
export declare const RunMetadataSetKeyOperation: z.ZodObject<{
    type: z.ZodLiteral<"set">;
    key: z.ZodString;
    value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
}, z.core.$strip>;
export type RunMetadataSetKeyOperation = z.infer<typeof RunMetadataSetKeyOperation>;
export declare const RunMetadataDeleteKeyOperation: z.ZodObject<{
    type: z.ZodLiteral<"delete">;
    key: z.ZodString;
}, z.core.$strip>;
export type RunMetadataDeleteKeyOperation = z.infer<typeof RunMetadataDeleteKeyOperation>;
export declare const RunMetadataAppendKeyOperation: z.ZodObject<{
    type: z.ZodLiteral<"append">;
    key: z.ZodString;
    value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
}, z.core.$strip>;
export type RunMetadataAppendKeyOperation = z.infer<typeof RunMetadataAppendKeyOperation>;
export declare const RunMetadataRemoveFromKeyOperation: z.ZodObject<{
    type: z.ZodLiteral<"remove">;
    key: z.ZodString;
    value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
}, z.core.$strip>;
export type RunMetadataRemoveFromKeyOperation = z.infer<typeof RunMetadataRemoveFromKeyOperation>;
export declare const RunMetadataIncrementKeyOperation: z.ZodObject<{
    type: z.ZodLiteral<"increment">;
    key: z.ZodString;
    value: z.ZodNumber;
}, z.core.$strip>;
export type RunMetadataIncrementKeyOperation = z.infer<typeof RunMetadataIncrementKeyOperation>;
export declare const RunMetadataChangeOperation: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
    type: z.ZodLiteral<"update">;
    value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"set">;
    key: z.ZodString;
    value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"delete">;
    key: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"append">;
    key: z.ZodString;
    value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"remove">;
    key: z.ZodString;
    value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"increment">;
    key: z.ZodString;
    value: z.ZodNumber;
}, z.core.$strip>]>;
export type RunMetadataChangeOperation = z.infer<typeof RunMetadataChangeOperation>;
export declare const FlushedRunMetadata: z.ZodObject<{
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>>>;
    operations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
        type: z.ZodLiteral<"update">;
        value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"set">;
        key: z.ZodString;
        value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"delete">;
        key: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"append">;
        key: z.ZodString;
        value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"remove">;
        key: z.ZodString;
        value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"increment">;
        key: z.ZodString;
        value: z.ZodNumber;
    }, z.core.$strip>]>>>;
    parentOperations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
        type: z.ZodLiteral<"update">;
        value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"set">;
        key: z.ZodString;
        value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"delete">;
        key: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"append">;
        key: z.ZodString;
        value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"remove">;
        key: z.ZodString;
        value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"increment">;
        key: z.ZodString;
        value: z.ZodNumber;
    }, z.core.$strip>]>>>;
    rootOperations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
        type: z.ZodLiteral<"update">;
        value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"set">;
        key: z.ZodString;
        value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"delete">;
        key: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"append">;
        key: z.ZodString;
        value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"remove">;
        key: z.ZodString;
        value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"increment">;
        key: z.ZodString;
        value: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$strip>;
export type FlushedRunMetadata = z.infer<typeof FlushedRunMetadata>;
export declare const MachineCpu: z.ZodUnion<readonly [z.ZodLiteral<0.25>, z.ZodLiteral<0.5>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<4>]>;
export type MachineCpu = z.infer<typeof MachineCpu>;
export declare const MachineMemory: z.ZodUnion<readonly [z.ZodLiteral<0.25>, z.ZodLiteral<0.5>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<4>, z.ZodLiteral<8>]>;
export type MachineMemory = z.infer<typeof MachineMemory>;
export declare const MachinePresetName: z.ZodEnum<{
    "large-1x": "large-1x";
    "large-2x": "large-2x";
    "medium-1x": "medium-1x";
    "medium-2x": "medium-2x";
    micro: "micro";
    "small-1x": "small-1x";
    "small-2x": "small-2x";
}>;
export type MachinePresetName = z.infer<typeof MachinePresetName>;
export declare const MachineConfig: z.ZodObject<{
    cpu: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<0.25>, z.ZodLiteral<0.5>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<4>]>>;
    memory: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<0.25>, z.ZodLiteral<0.5>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<4>, z.ZodLiteral<8>]>>;
    preset: z.ZodOptional<z.ZodEnum<{
        "large-1x": "large-1x";
        "large-2x": "large-2x";
        "medium-1x": "medium-1x";
        "medium-2x": "medium-2x";
        micro: "micro";
        "small-1x": "small-1x";
        "small-2x": "small-2x";
    }>>;
}, z.core.$strip>;
export type MachineConfig = z.infer<typeof MachineConfig>;
export declare const MachinePreset: z.ZodObject<{
    name: z.ZodEnum<{
        "large-1x": "large-1x";
        "large-2x": "large-2x";
        "medium-1x": "medium-1x";
        "medium-2x": "medium-2x";
        micro: "micro";
        "small-1x": "small-1x";
        "small-2x": "small-2x";
    }>;
    cpu: z.ZodNumber;
    memory: z.ZodNumber;
    centsPerMs: z.ZodNumber;
}, z.core.$strip>;
export type MachinePreset = z.infer<typeof MachinePreset>;
export type MachinePresetResources = Pick<MachinePreset, "memory" | "cpu">;
/**
 * One link in a thrown error's `cause` chain, flattened outermost-first.
 * A cause is not necessarily an Error, so only `message` is guaranteed.
 */
export declare const TaskRunErrorCause: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    message: z.ZodString;
    stackTrace: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type TaskRunErrorCause = z.infer<typeof TaskRunErrorCause>;
export declare const TaskRunBuiltInError: z.ZodObject<{
    type: z.ZodLiteral<"BUILT_IN_ERROR">;
    name: z.ZodString;
    message: z.ZodString;
    stackTrace: z.ZodString;
    causes: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        message: z.ZodString;
        stackTrace: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type TaskRunBuiltInError = z.infer<typeof TaskRunBuiltInError>;
export declare const TaskRunCustomErrorObject: z.ZodObject<{
    type: z.ZodLiteral<"CUSTOM_ERROR">;
    raw: z.ZodString;
}, z.core.$strip>;
export type TaskRunCustomErrorObject = z.infer<typeof TaskRunCustomErrorObject>;
export declare const TaskRunStringError: z.ZodObject<{
    type: z.ZodLiteral<"STRING_ERROR">;
    raw: z.ZodString;
}, z.core.$strip>;
export type TaskRunStringError = z.infer<typeof TaskRunStringError>;
export declare const TaskRunInternalError: z.ZodObject<{
    type: z.ZodLiteral<"INTERNAL_ERROR">;
    code: z.ZodEnum<{
        BATCH_ITEM_COULD_NOT_TRIGGER: "BATCH_ITEM_COULD_NOT_TRIGGER";
        CONFIGURED_INCORRECTLY: "CONFIGURED_INCORRECTLY";
        COULD_NOT_FIND_EXECUTOR: "COULD_NOT_FIND_EXECUTOR";
        COULD_NOT_FIND_TASK: "COULD_NOT_FIND_TASK";
        COULD_NOT_IMPORT_TASK: "COULD_NOT_IMPORT_TASK";
        DISK_SPACE_EXCEEDED: "DISK_SPACE_EXCEEDED";
        GRACEFUL_EXIT_TIMEOUT: "GRACEFUL_EXIT_TIMEOUT";
        HANDLE_ERROR_ERROR: "HANDLE_ERROR_ERROR";
        MAX_DURATION_EXCEEDED: "MAX_DURATION_EXCEEDED";
        OUTDATED_SDK_VERSION: "OUTDATED_SDK_VERSION";
        PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE";
        POD_EVICTED: "POD_EVICTED";
        POD_UNKNOWN_ERROR: "POD_UNKNOWN_ERROR";
        RECURSIVE_WAIT_DEADLOCK: "RECURSIVE_WAIT_DEADLOCK";
        TASK_ALREADY_RUNNING: "TASK_ALREADY_RUNNING";
        TASK_DEQUEUED_INVALID_STATE: "TASK_DEQUEUED_INVALID_STATE";
        TASK_DEQUEUED_QUEUE_NOT_FOUND: "TASK_DEQUEUED_QUEUE_NOT_FOUND";
        TASK_DID_CONCURRENT_WAIT: "TASK_DID_CONCURRENT_WAIT";
        TASK_EXECUTION_ABORTED: "TASK_EXECUTION_ABORTED";
        TASK_EXECUTION_FAILED: "TASK_EXECUTION_FAILED";
        TASK_HAS_N0_EXECUTION_SNAPSHOT: "TASK_HAS_N0_EXECUTION_SNAPSHOT";
        TASK_INPUT_ERROR: "TASK_INPUT_ERROR";
        TASK_MIDDLEWARE_ERROR: "TASK_MIDDLEWARE_ERROR";
        TASK_OUTPUT_ERROR: "TASK_OUTPUT_ERROR";
        TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE: "TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE";
        TASK_PROCESS_MAYBE_OOM_KILLED: "TASK_PROCESS_MAYBE_OOM_KILLED";
        TASK_PROCESS_OOM_KILLED: "TASK_PROCESS_OOM_KILLED";
        TASK_PROCESS_SIGKILL_TIMEOUT: "TASK_PROCESS_SIGKILL_TIMEOUT";
        TASK_PROCESS_SIGSEGV: "TASK_PROCESS_SIGSEGV";
        TASK_PROCESS_SIGTERM: "TASK_PROCESS_SIGTERM";
        TASK_RUN_CANCELLED: "TASK_RUN_CANCELLED";
        TASK_RUN_CRASHED: "TASK_RUN_CRASHED";
        TASK_RUN_DEQUEUED_MAX_RETRIES: "TASK_RUN_DEQUEUED_MAX_RETRIES";
        TASK_RUN_HEARTBEAT_TIMEOUT: "TASK_RUN_HEARTBEAT_TIMEOUT";
        TASK_RUN_STALLED_EXECUTING: "TASK_RUN_STALLED_EXECUTING";
        TASK_RUN_STALLED_EXECUTING_WITH_WAITPOINTS: "TASK_RUN_STALLED_EXECUTING_WITH_WAITPOINTS";
        TASK_RUN_UNCAUGHT_EXCEPTION: "TASK_RUN_UNCAUGHT_EXCEPTION";
        UNSPECIFIED_ERROR: "UNSPECIFIED_ERROR";
    }>;
    message: z.ZodOptional<z.ZodString>;
    stackTrace: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type TaskRunInternalError = z.infer<typeof TaskRunInternalError>;
export declare const TaskRunErrorCodes: {
    BATCH_ITEM_COULD_NOT_TRIGGER: "BATCH_ITEM_COULD_NOT_TRIGGER";
    CONFIGURED_INCORRECTLY: "CONFIGURED_INCORRECTLY";
    COULD_NOT_FIND_EXECUTOR: "COULD_NOT_FIND_EXECUTOR";
    COULD_NOT_FIND_TASK: "COULD_NOT_FIND_TASK";
    COULD_NOT_IMPORT_TASK: "COULD_NOT_IMPORT_TASK";
    DISK_SPACE_EXCEEDED: "DISK_SPACE_EXCEEDED";
    GRACEFUL_EXIT_TIMEOUT: "GRACEFUL_EXIT_TIMEOUT";
    HANDLE_ERROR_ERROR: "HANDLE_ERROR_ERROR";
    MAX_DURATION_EXCEEDED: "MAX_DURATION_EXCEEDED";
    OUTDATED_SDK_VERSION: "OUTDATED_SDK_VERSION";
    PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE";
    POD_EVICTED: "POD_EVICTED";
    POD_UNKNOWN_ERROR: "POD_UNKNOWN_ERROR";
    RECURSIVE_WAIT_DEADLOCK: "RECURSIVE_WAIT_DEADLOCK";
    TASK_ALREADY_RUNNING: "TASK_ALREADY_RUNNING";
    TASK_DEQUEUED_INVALID_STATE: "TASK_DEQUEUED_INVALID_STATE";
    TASK_DEQUEUED_QUEUE_NOT_FOUND: "TASK_DEQUEUED_QUEUE_NOT_FOUND";
    TASK_DID_CONCURRENT_WAIT: "TASK_DID_CONCURRENT_WAIT";
    TASK_EXECUTION_ABORTED: "TASK_EXECUTION_ABORTED";
    TASK_EXECUTION_FAILED: "TASK_EXECUTION_FAILED";
    TASK_HAS_N0_EXECUTION_SNAPSHOT: "TASK_HAS_N0_EXECUTION_SNAPSHOT";
    TASK_INPUT_ERROR: "TASK_INPUT_ERROR";
    TASK_MIDDLEWARE_ERROR: "TASK_MIDDLEWARE_ERROR";
    TASK_OUTPUT_ERROR: "TASK_OUTPUT_ERROR";
    TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE: "TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE";
    TASK_PROCESS_MAYBE_OOM_KILLED: "TASK_PROCESS_MAYBE_OOM_KILLED";
    TASK_PROCESS_OOM_KILLED: "TASK_PROCESS_OOM_KILLED";
    TASK_PROCESS_SIGKILL_TIMEOUT: "TASK_PROCESS_SIGKILL_TIMEOUT";
    TASK_PROCESS_SIGSEGV: "TASK_PROCESS_SIGSEGV";
    TASK_PROCESS_SIGTERM: "TASK_PROCESS_SIGTERM";
    TASK_RUN_CANCELLED: "TASK_RUN_CANCELLED";
    TASK_RUN_CRASHED: "TASK_RUN_CRASHED";
    TASK_RUN_DEQUEUED_MAX_RETRIES: "TASK_RUN_DEQUEUED_MAX_RETRIES";
    TASK_RUN_HEARTBEAT_TIMEOUT: "TASK_RUN_HEARTBEAT_TIMEOUT";
    TASK_RUN_STALLED_EXECUTING: "TASK_RUN_STALLED_EXECUTING";
    TASK_RUN_STALLED_EXECUTING_WITH_WAITPOINTS: "TASK_RUN_STALLED_EXECUTING_WITH_WAITPOINTS";
    TASK_RUN_UNCAUGHT_EXCEPTION: "TASK_RUN_UNCAUGHT_EXCEPTION";
    UNSPECIFIED_ERROR: "UNSPECIFIED_ERROR";
};
export type TaskRunErrorCodes = TaskRunInternalError["code"];
export declare const TaskRunError: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
    type: z.ZodLiteral<"BUILT_IN_ERROR">;
    name: z.ZodString;
    message: z.ZodString;
    stackTrace: z.ZodString;
    causes: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        message: z.ZodString;
        stackTrace: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"CUSTOM_ERROR">;
    raw: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"STRING_ERROR">;
    raw: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"INTERNAL_ERROR">;
    code: z.ZodEnum<{
        BATCH_ITEM_COULD_NOT_TRIGGER: "BATCH_ITEM_COULD_NOT_TRIGGER";
        CONFIGURED_INCORRECTLY: "CONFIGURED_INCORRECTLY";
        COULD_NOT_FIND_EXECUTOR: "COULD_NOT_FIND_EXECUTOR";
        COULD_NOT_FIND_TASK: "COULD_NOT_FIND_TASK";
        COULD_NOT_IMPORT_TASK: "COULD_NOT_IMPORT_TASK";
        DISK_SPACE_EXCEEDED: "DISK_SPACE_EXCEEDED";
        GRACEFUL_EXIT_TIMEOUT: "GRACEFUL_EXIT_TIMEOUT";
        HANDLE_ERROR_ERROR: "HANDLE_ERROR_ERROR";
        MAX_DURATION_EXCEEDED: "MAX_DURATION_EXCEEDED";
        OUTDATED_SDK_VERSION: "OUTDATED_SDK_VERSION";
        PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE";
        POD_EVICTED: "POD_EVICTED";
        POD_UNKNOWN_ERROR: "POD_UNKNOWN_ERROR";
        RECURSIVE_WAIT_DEADLOCK: "RECURSIVE_WAIT_DEADLOCK";
        TASK_ALREADY_RUNNING: "TASK_ALREADY_RUNNING";
        TASK_DEQUEUED_INVALID_STATE: "TASK_DEQUEUED_INVALID_STATE";
        TASK_DEQUEUED_QUEUE_NOT_FOUND: "TASK_DEQUEUED_QUEUE_NOT_FOUND";
        TASK_DID_CONCURRENT_WAIT: "TASK_DID_CONCURRENT_WAIT";
        TASK_EXECUTION_ABORTED: "TASK_EXECUTION_ABORTED";
        TASK_EXECUTION_FAILED: "TASK_EXECUTION_FAILED";
        TASK_HAS_N0_EXECUTION_SNAPSHOT: "TASK_HAS_N0_EXECUTION_SNAPSHOT";
        TASK_INPUT_ERROR: "TASK_INPUT_ERROR";
        TASK_MIDDLEWARE_ERROR: "TASK_MIDDLEWARE_ERROR";
        TASK_OUTPUT_ERROR: "TASK_OUTPUT_ERROR";
        TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE: "TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE";
        TASK_PROCESS_MAYBE_OOM_KILLED: "TASK_PROCESS_MAYBE_OOM_KILLED";
        TASK_PROCESS_OOM_KILLED: "TASK_PROCESS_OOM_KILLED";
        TASK_PROCESS_SIGKILL_TIMEOUT: "TASK_PROCESS_SIGKILL_TIMEOUT";
        TASK_PROCESS_SIGSEGV: "TASK_PROCESS_SIGSEGV";
        TASK_PROCESS_SIGTERM: "TASK_PROCESS_SIGTERM";
        TASK_RUN_CANCELLED: "TASK_RUN_CANCELLED";
        TASK_RUN_CRASHED: "TASK_RUN_CRASHED";
        TASK_RUN_DEQUEUED_MAX_RETRIES: "TASK_RUN_DEQUEUED_MAX_RETRIES";
        TASK_RUN_HEARTBEAT_TIMEOUT: "TASK_RUN_HEARTBEAT_TIMEOUT";
        TASK_RUN_STALLED_EXECUTING: "TASK_RUN_STALLED_EXECUTING";
        TASK_RUN_STALLED_EXECUTING_WITH_WAITPOINTS: "TASK_RUN_STALLED_EXECUTING_WITH_WAITPOINTS";
        TASK_RUN_UNCAUGHT_EXCEPTION: "TASK_RUN_UNCAUGHT_EXCEPTION";
        UNSPECIFIED_ERROR: "UNSPECIFIED_ERROR";
    }>;
    message: z.ZodOptional<z.ZodString>;
    stackTrace: z.ZodOptional<z.ZodString>;
}, z.core.$strip>]>;
export type TaskRunError = z.infer<typeof TaskRunError>;
export declare const TaskRun: z.ZodObject<{
    id: z.ZodString;
    payload: z.ZodString;
    payloadType: z.ZodString;
    tags: z.ZodArray<z.ZodString>;
    isTest: z.ZodDefault<z.ZodBoolean>;
    isReplay: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodCoercedDate<unknown>;
    startedAt: z.ZodDefault<z.ZodCoercedDate<unknown>>;
    idempotencyKey: z.ZodOptional<z.ZodString>;
    idempotencyKeyScope: z.ZodOptional<z.ZodEnum<{
        attempt: "attempt";
        global: "global";
        run: "run";
    }>>;
    maxAttempts: z.ZodOptional<z.ZodNumber>;
    version: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>>>;
    maxDuration: z.ZodOptional<z.ZodNumber>;
    priority: z.ZodOptional<z.ZodNumber>;
    baseCostInCents: z.ZodOptional<z.ZodNumber>;
    parentTaskRunId: z.ZodOptional<z.ZodString>;
    rootTaskRunId: z.ZodOptional<z.ZodString>;
    durationMs: z.ZodOptional<z.ZodNumber>;
    costInCents: z.ZodOptional<z.ZodNumber>;
    region: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type TaskRun = z.infer<typeof TaskRun>;
export declare const GitMeta: z.ZodObject<{
    provider: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<z.ZodEnum<{
        github_actions: "github_actions";
        local: "local";
        trigger_github_app: "trigger_github_app";
    }>>;
    ghUsername: z.ZodOptional<z.ZodString>;
    ghUserAvatarUrl: z.ZodOptional<z.ZodString>;
    commitAuthorName: z.ZodOptional<z.ZodString>;
    commitMessage: z.ZodOptional<z.ZodString>;
    commitRef: z.ZodOptional<z.ZodString>;
    commitSha: z.ZodOptional<z.ZodString>;
    dirty: z.ZodOptional<z.ZodBoolean>;
    remoteUrl: z.ZodOptional<z.ZodString>;
    pullRequestNumber: z.ZodOptional<z.ZodNumber>;
    pullRequestTitle: z.ZodOptional<z.ZodString>;
    pullRequestState: z.ZodOptional<z.ZodEnum<{
        closed: "closed";
        merged: "merged";
        open: "open";
    }>>;
}, z.core.$strip>;
export type GitMeta = z.infer<typeof GitMeta>;
export declare const TaskRunExecutionTask: z.ZodObject<{
    id: z.ZodString;
    filePath: z.ZodString;
}, z.core.$strip>;
export type TaskRunExecutionTask = z.infer<typeof TaskRunExecutionTask>;
export declare const TaskRunExecutionAttempt: z.ZodObject<{
    number: z.ZodNumber;
    startedAt: z.ZodCoercedDate<unknown>;
}, z.core.$strip>;
export type TaskRunExecutionAttempt = z.infer<typeof TaskRunExecutionAttempt>;
export declare const TaskRunExecutionEnvironment: z.ZodObject<{
    id: z.ZodString;
    slug: z.ZodString;
    type: z.ZodEnum<{
        DEVELOPMENT: "DEVELOPMENT";
        PREVIEW: "PREVIEW";
        PRODUCTION: "PRODUCTION";
        STAGING: "STAGING";
    }>;
    branchName: z.ZodOptional<z.ZodString>;
    git: z.ZodOptional<z.ZodObject<{
        provider: z.ZodOptional<z.ZodString>;
        source: z.ZodOptional<z.ZodEnum<{
            github_actions: "github_actions";
            local: "local";
            trigger_github_app: "trigger_github_app";
        }>>;
        ghUsername: z.ZodOptional<z.ZodString>;
        ghUserAvatarUrl: z.ZodOptional<z.ZodString>;
        commitAuthorName: z.ZodOptional<z.ZodString>;
        commitMessage: z.ZodOptional<z.ZodString>;
        commitRef: z.ZodOptional<z.ZodString>;
        commitSha: z.ZodOptional<z.ZodString>;
        dirty: z.ZodOptional<z.ZodBoolean>;
        remoteUrl: z.ZodOptional<z.ZodString>;
        pullRequestNumber: z.ZodOptional<z.ZodNumber>;
        pullRequestTitle: z.ZodOptional<z.ZodString>;
        pullRequestState: z.ZodOptional<z.ZodEnum<{
            closed: "closed";
            merged: "merged";
            open: "open";
        }>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type TaskRunExecutionEnvironment = z.infer<typeof TaskRunExecutionEnvironment>;
export declare const TaskRunExecutionOrganization: z.ZodObject<{
    id: z.ZodString;
    slug: z.ZodString;
    name: z.ZodString;
}, z.core.$strip>;
export type TaskRunExecutionOrganization = z.infer<typeof TaskRunExecutionOrganization>;
export declare const TaskRunExecutionProject: z.ZodObject<{
    id: z.ZodString;
    ref: z.ZodString;
    slug: z.ZodString;
    name: z.ZodString;
}, z.core.$strip>;
export type TaskRunExecutionProject = z.infer<typeof TaskRunExecutionProject>;
export declare const TaskRunExecutionQueue: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
}, z.core.$strip>;
export type TaskRunExecutionQueue = z.infer<typeof TaskRunExecutionQueue>;
export declare const TaskRunExecutionBatch: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export declare const TaskRunExecutionDeployment: z.ZodObject<{
    id: z.ZodString;
    shortCode: z.ZodString;
    version: z.ZodString;
    runtime: z.ZodString;
    runtimeVersion: z.ZodString;
    git: z.ZodOptional<z.ZodObject<{
        provider: z.ZodOptional<z.ZodString>;
        source: z.ZodOptional<z.ZodEnum<{
            github_actions: "github_actions";
            local: "local";
            trigger_github_app: "trigger_github_app";
        }>>;
        ghUsername: z.ZodOptional<z.ZodString>;
        ghUserAvatarUrl: z.ZodOptional<z.ZodString>;
        commitAuthorName: z.ZodOptional<z.ZodString>;
        commitMessage: z.ZodOptional<z.ZodString>;
        commitRef: z.ZodOptional<z.ZodString>;
        commitSha: z.ZodOptional<z.ZodString>;
        dirty: z.ZodOptional<z.ZodBoolean>;
        remoteUrl: z.ZodOptional<z.ZodString>;
        pullRequestNumber: z.ZodOptional<z.ZodNumber>;
        pullRequestTitle: z.ZodOptional<z.ZodString>;
        pullRequestState: z.ZodOptional<z.ZodEnum<{
            closed: "closed";
            merged: "merged";
            open: "open";
        }>>;
    }, z.core.$strip>>;
    externalId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type TaskRunExecutionDeployment = z.infer<typeof TaskRunExecutionDeployment>;
export declare const StaticTaskRunExecution: z.ZodObject<{
    task: z.ZodObject<{
        id: z.ZodString;
        filePath: z.ZodString;
    }, z.core.$loose>;
    queue: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
    environment: z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        type: z.ZodEnum<{
            DEVELOPMENT: "DEVELOPMENT";
            PREVIEW: "PREVIEW";
            PRODUCTION: "PRODUCTION";
            STAGING: "STAGING";
        }>;
        branchName: z.ZodOptional<z.ZodString>;
        git: z.ZodOptional<z.ZodObject<{
            provider: z.ZodOptional<z.ZodString>;
            source: z.ZodOptional<z.ZodEnum<{
                github_actions: "github_actions";
                local: "local";
                trigger_github_app: "trigger_github_app";
            }>>;
            ghUsername: z.ZodOptional<z.ZodString>;
            ghUserAvatarUrl: z.ZodOptional<z.ZodString>;
            commitAuthorName: z.ZodOptional<z.ZodString>;
            commitMessage: z.ZodOptional<z.ZodString>;
            commitRef: z.ZodOptional<z.ZodString>;
            commitSha: z.ZodOptional<z.ZodString>;
            dirty: z.ZodOptional<z.ZodBoolean>;
            remoteUrl: z.ZodOptional<z.ZodString>;
            pullRequestNumber: z.ZodOptional<z.ZodNumber>;
            pullRequestTitle: z.ZodOptional<z.ZodString>;
            pullRequestState: z.ZodOptional<z.ZodEnum<{
                closed: "closed";
                merged: "merged";
                open: "open";
            }>>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    organization: z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
    project: z.ZodObject<{
        id: z.ZodString;
        ref: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
    machine: z.ZodObject<{
        name: z.ZodEnum<{
            "large-1x": "large-1x";
            "large-2x": "large-2x";
            "medium-1x": "medium-1x";
            "medium-2x": "medium-2x";
            micro: "micro";
            "small-1x": "small-1x";
            "small-2x": "small-2x";
        }>;
        cpu: z.ZodNumber;
        memory: z.ZodNumber;
        centsPerMs: z.ZodNumber;
    }, z.core.$strip>;
    batch: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>>;
    deployment: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        shortCode: z.ZodString;
        version: z.ZodString;
        runtime: z.ZodString;
        runtimeVersion: z.ZodString;
        git: z.ZodOptional<z.ZodObject<{
            provider: z.ZodOptional<z.ZodString>;
            source: z.ZodOptional<z.ZodEnum<{
                github_actions: "github_actions";
                local: "local";
                trigger_github_app: "trigger_github_app";
            }>>;
            ghUsername: z.ZodOptional<z.ZodString>;
            ghUserAvatarUrl: z.ZodOptional<z.ZodString>;
            commitAuthorName: z.ZodOptional<z.ZodString>;
            commitMessage: z.ZodOptional<z.ZodString>;
            commitRef: z.ZodOptional<z.ZodString>;
            commitSha: z.ZodOptional<z.ZodString>;
            dirty: z.ZodOptional<z.ZodBoolean>;
            remoteUrl: z.ZodOptional<z.ZodString>;
            pullRequestNumber: z.ZodOptional<z.ZodNumber>;
            pullRequestTitle: z.ZodOptional<z.ZodString>;
            pullRequestState: z.ZodOptional<z.ZodEnum<{
                closed: "closed";
                merged: "merged";
                open: "open";
            }>>;
        }, z.core.$strip>>;
        externalId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type StaticTaskRunExecution = z.infer<typeof StaticTaskRunExecution>;
export declare const TaskRunExecution: z.ZodObject<{
    task: z.ZodObject<{
        id: z.ZodString;
        filePath: z.ZodString;
    }, z.core.$loose>;
    queue: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
    environment: z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        type: z.ZodEnum<{
            DEVELOPMENT: "DEVELOPMENT";
            PREVIEW: "PREVIEW";
            PRODUCTION: "PRODUCTION";
            STAGING: "STAGING";
        }>;
        branchName: z.ZodOptional<z.ZodString>;
        git: z.ZodOptional<z.ZodObject<{
            provider: z.ZodOptional<z.ZodString>;
            source: z.ZodOptional<z.ZodEnum<{
                github_actions: "github_actions";
                local: "local";
                trigger_github_app: "trigger_github_app";
            }>>;
            ghUsername: z.ZodOptional<z.ZodString>;
            ghUserAvatarUrl: z.ZodOptional<z.ZodString>;
            commitAuthorName: z.ZodOptional<z.ZodString>;
            commitMessage: z.ZodOptional<z.ZodString>;
            commitRef: z.ZodOptional<z.ZodString>;
            commitSha: z.ZodOptional<z.ZodString>;
            dirty: z.ZodOptional<z.ZodBoolean>;
            remoteUrl: z.ZodOptional<z.ZodString>;
            pullRequestNumber: z.ZodOptional<z.ZodNumber>;
            pullRequestTitle: z.ZodOptional<z.ZodString>;
            pullRequestState: z.ZodOptional<z.ZodEnum<{
                closed: "closed";
                merged: "merged";
                open: "open";
            }>>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    organization: z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
    project: z.ZodObject<{
        id: z.ZodString;
        ref: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
    machine: z.ZodObject<{
        name: z.ZodEnum<{
            "large-1x": "large-1x";
            "large-2x": "large-2x";
            "medium-1x": "medium-1x";
            "medium-2x": "medium-2x";
            micro: "micro";
            "small-1x": "small-1x";
            "small-2x": "small-2x";
        }>;
        cpu: z.ZodNumber;
        memory: z.ZodNumber;
        centsPerMs: z.ZodNumber;
    }, z.core.$strip>;
    batch: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>>;
    deployment: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        shortCode: z.ZodString;
        version: z.ZodString;
        runtime: z.ZodString;
        runtimeVersion: z.ZodString;
        git: z.ZodOptional<z.ZodObject<{
            provider: z.ZodOptional<z.ZodString>;
            source: z.ZodOptional<z.ZodEnum<{
                github_actions: "github_actions";
                local: "local";
                trigger_github_app: "trigger_github_app";
            }>>;
            ghUsername: z.ZodOptional<z.ZodString>;
            ghUserAvatarUrl: z.ZodOptional<z.ZodString>;
            commitAuthorName: z.ZodOptional<z.ZodString>;
            commitMessage: z.ZodOptional<z.ZodString>;
            commitRef: z.ZodOptional<z.ZodString>;
            commitSha: z.ZodOptional<z.ZodString>;
            dirty: z.ZodOptional<z.ZodBoolean>;
            remoteUrl: z.ZodOptional<z.ZodString>;
            pullRequestNumber: z.ZodOptional<z.ZodNumber>;
            pullRequestTitle: z.ZodOptional<z.ZodString>;
            pullRequestState: z.ZodOptional<z.ZodEnum<{
                closed: "closed";
                merged: "merged";
                open: "open";
            }>>;
        }, z.core.$strip>>;
        externalId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    attempt: z.ZodObject<{
        number: z.ZodNumber;
        startedAt: z.ZodCoercedDate<unknown>;
    }, z.core.$loose>;
    run: z.ZodIntersection<z.ZodObject<{
        id: z.ZodString;
        payload: z.ZodString;
        payloadType: z.ZodString;
        tags: z.ZodArray<z.ZodString>;
        isTest: z.ZodDefault<z.ZodBoolean>;
        isReplay: z.ZodDefault<z.ZodBoolean>;
        createdAt: z.ZodCoercedDate<unknown>;
        startedAt: z.ZodDefault<z.ZodCoercedDate<unknown>>;
        idempotencyKey: z.ZodOptional<z.ZodString>;
        idempotencyKeyScope: z.ZodOptional<z.ZodEnum<{
            attempt: "attempt";
            global: "global";
            run: "run";
        }>>;
        maxAttempts: z.ZodOptional<z.ZodNumber>;
        version: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>>>;
        maxDuration: z.ZodOptional<z.ZodNumber>;
        priority: z.ZodOptional<z.ZodNumber>;
        baseCostInCents: z.ZodOptional<z.ZodNumber>;
        parentTaskRunId: z.ZodOptional<z.ZodString>;
        rootTaskRunId: z.ZodOptional<z.ZodString>;
        durationMs: z.ZodOptional<z.ZodNumber>;
        costInCents: z.ZodOptional<z.ZodNumber>;
        region: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        traceContext: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        realtimeStreamsVersion: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type TaskRunExecution = z.infer<typeof TaskRunExecution>;
export declare const V3TaskRunExecutionTask: z.ZodObject<{
    id: z.ZodString;
    filePath: z.ZodString;
    exportName: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type V3TaskRunExecutionTask = z.infer<typeof V3TaskRunExecutionTask>;
export declare const V3TaskRunExecutionAttempt: z.ZodObject<{
    number: z.ZodNumber;
    startedAt: z.ZodCoercedDate<unknown>;
    id: z.ZodString;
    backgroundWorkerId: z.ZodString;
    backgroundWorkerTaskId: z.ZodString;
    status: z.ZodString;
}, z.core.$strip>;
export type V3TaskRunExecutionAttempt = z.infer<typeof V3TaskRunExecutionAttempt>;
export declare const V3TaskRun: z.ZodObject<{
    id: z.ZodString;
    payload: z.ZodString;
    payloadType: z.ZodString;
    tags: z.ZodArray<z.ZodString>;
    isTest: z.ZodDefault<z.ZodBoolean>;
    isReplay: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodCoercedDate<unknown>;
    startedAt: z.ZodDefault<z.ZodCoercedDate<unknown>>;
    idempotencyKey: z.ZodOptional<z.ZodString>;
    idempotencyKeyScope: z.ZodOptional<z.ZodEnum<{
        attempt: "attempt";
        global: "global";
        run: "run";
    }>>;
    maxAttempts: z.ZodOptional<z.ZodNumber>;
    version: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>>>;
    maxDuration: z.ZodOptional<z.ZodNumber>;
    context: z.ZodUnknown;
    durationMs: z.ZodNumber;
    costInCents: z.ZodNumber;
    baseCostInCents: z.ZodNumber;
}, z.core.$strip>;
export type V3TaskRun = z.infer<typeof V3TaskRun>;
export declare const V3TaskRunExecution: z.ZodObject<{
    task: z.ZodObject<{
        id: z.ZodString;
        filePath: z.ZodString;
        exportName: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    attempt: z.ZodObject<{
        number: z.ZodNumber;
        startedAt: z.ZodCoercedDate<unknown>;
        id: z.ZodString;
        backgroundWorkerId: z.ZodString;
        backgroundWorkerTaskId: z.ZodString;
        status: z.ZodString;
    }, z.core.$strip>;
    run: z.ZodIntersection<z.ZodObject<{
        id: z.ZodString;
        payload: z.ZodString;
        payloadType: z.ZodString;
        tags: z.ZodArray<z.ZodString>;
        isTest: z.ZodDefault<z.ZodBoolean>;
        isReplay: z.ZodDefault<z.ZodBoolean>;
        createdAt: z.ZodCoercedDate<unknown>;
        startedAt: z.ZodDefault<z.ZodCoercedDate<unknown>>;
        idempotencyKey: z.ZodOptional<z.ZodString>;
        idempotencyKeyScope: z.ZodOptional<z.ZodEnum<{
            attempt: "attempt";
            global: "global";
            run: "run";
        }>>;
        maxAttempts: z.ZodOptional<z.ZodNumber>;
        version: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>>>;
        maxDuration: z.ZodOptional<z.ZodNumber>;
        context: z.ZodUnknown;
        durationMs: z.ZodNumber;
        costInCents: z.ZodNumber;
        baseCostInCents: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        traceContext: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
    queue: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
    environment: z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        type: z.ZodEnum<{
            DEVELOPMENT: "DEVELOPMENT";
            PREVIEW: "PREVIEW";
            PRODUCTION: "PRODUCTION";
            STAGING: "STAGING";
        }>;
        branchName: z.ZodOptional<z.ZodString>;
        git: z.ZodOptional<z.ZodObject<{
            provider: z.ZodOptional<z.ZodString>;
            source: z.ZodOptional<z.ZodEnum<{
                github_actions: "github_actions";
                local: "local";
                trigger_github_app: "trigger_github_app";
            }>>;
            ghUsername: z.ZodOptional<z.ZodString>;
            ghUserAvatarUrl: z.ZodOptional<z.ZodString>;
            commitAuthorName: z.ZodOptional<z.ZodString>;
            commitMessage: z.ZodOptional<z.ZodString>;
            commitRef: z.ZodOptional<z.ZodString>;
            commitSha: z.ZodOptional<z.ZodString>;
            dirty: z.ZodOptional<z.ZodBoolean>;
            remoteUrl: z.ZodOptional<z.ZodString>;
            pullRequestNumber: z.ZodOptional<z.ZodNumber>;
            pullRequestTitle: z.ZodOptional<z.ZodString>;
            pullRequestState: z.ZodOptional<z.ZodEnum<{
                closed: "closed";
                merged: "merged";
                open: "open";
            }>>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    organization: z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
    project: z.ZodObject<{
        id: z.ZodString;
        ref: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
    machine: z.ZodObject<{
        name: z.ZodEnum<{
            "large-1x": "large-1x";
            "large-2x": "large-2x";
            "medium-1x": "medium-1x";
            "medium-2x": "medium-2x";
            micro: "micro";
            "small-1x": "small-1x";
            "small-2x": "small-2x";
        }>;
        cpu: z.ZodNumber;
        memory: z.ZodNumber;
        centsPerMs: z.ZodNumber;
    }, z.core.$strip>;
    batch: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type V3TaskRunExecution = z.infer<typeof V3TaskRunExecution>;
export declare const TaskRunContext: z.ZodObject<{
    task: z.ZodObject<{
        id: z.ZodString;
        filePath: z.ZodString;
    }, z.core.$loose>;
    queue: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
    environment: z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        type: z.ZodEnum<{
            DEVELOPMENT: "DEVELOPMENT";
            PREVIEW: "PREVIEW";
            PRODUCTION: "PRODUCTION";
            STAGING: "STAGING";
        }>;
        branchName: z.ZodOptional<z.ZodString>;
        git: z.ZodOptional<z.ZodObject<{
            provider: z.ZodOptional<z.ZodString>;
            source: z.ZodOptional<z.ZodEnum<{
                github_actions: "github_actions";
                local: "local";
                trigger_github_app: "trigger_github_app";
            }>>;
            ghUsername: z.ZodOptional<z.ZodString>;
            ghUserAvatarUrl: z.ZodOptional<z.ZodString>;
            commitAuthorName: z.ZodOptional<z.ZodString>;
            commitMessage: z.ZodOptional<z.ZodString>;
            commitRef: z.ZodOptional<z.ZodString>;
            commitSha: z.ZodOptional<z.ZodString>;
            dirty: z.ZodOptional<z.ZodBoolean>;
            remoteUrl: z.ZodOptional<z.ZodString>;
            pullRequestNumber: z.ZodOptional<z.ZodNumber>;
            pullRequestTitle: z.ZodOptional<z.ZodString>;
            pullRequestState: z.ZodOptional<z.ZodEnum<{
                closed: "closed";
                merged: "merged";
                open: "open";
            }>>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    organization: z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
    project: z.ZodObject<{
        id: z.ZodString;
        ref: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
    machine: z.ZodObject<{
        name: z.ZodEnum<{
            "large-1x": "large-1x";
            "large-2x": "large-2x";
            "medium-1x": "medium-1x";
            "medium-2x": "medium-2x";
            micro: "micro";
            "small-1x": "small-1x";
            "small-2x": "small-2x";
        }>;
        cpu: z.ZodNumber;
        memory: z.ZodNumber;
        centsPerMs: z.ZodNumber;
    }, z.core.$strip>;
    batch: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>>;
    deployment: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        shortCode: z.ZodString;
        version: z.ZodString;
        runtime: z.ZodString;
        runtimeVersion: z.ZodString;
        git: z.ZodOptional<z.ZodObject<{
            provider: z.ZodOptional<z.ZodString>;
            source: z.ZodOptional<z.ZodEnum<{
                github_actions: "github_actions";
                local: "local";
                trigger_github_app: "trigger_github_app";
            }>>;
            ghUsername: z.ZodOptional<z.ZodString>;
            ghUserAvatarUrl: z.ZodOptional<z.ZodString>;
            commitAuthorName: z.ZodOptional<z.ZodString>;
            commitMessage: z.ZodOptional<z.ZodString>;
            commitRef: z.ZodOptional<z.ZodString>;
            commitSha: z.ZodOptional<z.ZodString>;
            dirty: z.ZodOptional<z.ZodBoolean>;
            remoteUrl: z.ZodOptional<z.ZodString>;
            pullRequestNumber: z.ZodOptional<z.ZodNumber>;
            pullRequestTitle: z.ZodOptional<z.ZodString>;
            pullRequestState: z.ZodOptional<z.ZodEnum<{
                closed: "closed";
                merged: "merged";
                open: "open";
            }>>;
        }, z.core.$strip>>;
        externalId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    attempt: z.ZodObject<{
        number: z.ZodNumber;
        startedAt: z.ZodCoercedDate<unknown>;
    }, z.core.$strip>;
    run: z.ZodObject<{
        id: z.ZodString;
        tags: z.ZodArray<z.ZodString>;
        isTest: z.ZodDefault<z.ZodBoolean>;
        isReplay: z.ZodDefault<z.ZodBoolean>;
        createdAt: z.ZodCoercedDate<unknown>;
        startedAt: z.ZodDefault<z.ZodCoercedDate<unknown>>;
        idempotencyKey: z.ZodOptional<z.ZodString>;
        idempotencyKeyScope: z.ZodOptional<z.ZodEnum<{
            attempt: "attempt";
            global: "global";
            run: "run";
        }>>;
        maxAttempts: z.ZodOptional<z.ZodNumber>;
        version: z.ZodOptional<z.ZodString>;
        maxDuration: z.ZodOptional<z.ZodNumber>;
        priority: z.ZodOptional<z.ZodNumber>;
        baseCostInCents: z.ZodOptional<z.ZodNumber>;
        parentTaskRunId: z.ZodOptional<z.ZodString>;
        rootTaskRunId: z.ZodOptional<z.ZodString>;
        region: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type TaskRunContext = z.infer<typeof TaskRunContext>;
export declare const V3TaskRunExecutionEnvironment: z.ZodObject<{
    id: z.ZodString;
    slug: z.ZodString;
    type: z.ZodEnum<{
        DEVELOPMENT: "DEVELOPMENT";
        PREVIEW: "PREVIEW";
        PRODUCTION: "PRODUCTION";
        STAGING: "STAGING";
    }>;
}, z.core.$strip>;
export type V3TaskRunExecutionEnvironment = z.infer<typeof V3TaskRunExecutionEnvironment>;
export declare const V3TaskRunContext: z.ZodObject<{
    attempt: z.ZodObject<{
        number: z.ZodNumber;
        startedAt: z.ZodCoercedDate<unknown>;
        id: z.ZodString;
        status: z.ZodString;
    }, z.core.$strip>;
    run: z.ZodObject<{
        id: z.ZodString;
        tags: z.ZodArray<z.ZodString>;
        isTest: z.ZodDefault<z.ZodBoolean>;
        isReplay: z.ZodDefault<z.ZodBoolean>;
        createdAt: z.ZodCoercedDate<unknown>;
        startedAt: z.ZodDefault<z.ZodCoercedDate<unknown>>;
        idempotencyKey: z.ZodOptional<z.ZodString>;
        idempotencyKeyScope: z.ZodOptional<z.ZodEnum<{
            attempt: "attempt";
            global: "global";
            run: "run";
        }>>;
        maxAttempts: z.ZodOptional<z.ZodNumber>;
        version: z.ZodOptional<z.ZodString>;
        maxDuration: z.ZodOptional<z.ZodNumber>;
        context: z.ZodUnknown;
        durationMs: z.ZodNumber;
        costInCents: z.ZodNumber;
        baseCostInCents: z.ZodNumber;
    }, z.core.$strip>;
    task: z.ZodObject<{
        id: z.ZodString;
        filePath: z.ZodString;
        exportName: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    queue: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
    environment: z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        type: z.ZodEnum<{
            DEVELOPMENT: "DEVELOPMENT";
            PREVIEW: "PREVIEW";
            PRODUCTION: "PRODUCTION";
            STAGING: "STAGING";
        }>;
    }, z.core.$strip>;
    organization: z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
    project: z.ZodObject<{
        id: z.ZodString;
        ref: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
    batch: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>>;
    machine: z.ZodOptional<z.ZodObject<{
        name: z.ZodEnum<{
            "large-1x": "large-1x";
            "large-2x": "large-2x";
            "medium-1x": "medium-1x";
            "medium-2x": "medium-2x";
            micro: "micro";
            "small-1x": "small-1x";
            "small-2x": "small-2x";
        }>;
        cpu: z.ZodNumber;
        memory: z.ZodNumber;
        centsPerMs: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type V3TaskRunContext = z.infer<typeof V3TaskRunContext>;
export declare const TaskRunExecutionRetry: z.ZodObject<{
    timestamp: z.ZodNumber;
    delay: z.ZodNumber;
    error: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
export type TaskRunExecutionRetry = z.infer<typeof TaskRunExecutionRetry>;
export declare const TaskRunExecutionUsage: z.ZodObject<{
    durationMs: z.ZodNumber;
}, z.core.$strip>;
export type TaskRunExecutionUsage = z.infer<typeof TaskRunExecutionUsage>;
export declare const TaskRunFailedExecutionResult: z.ZodObject<{
    ok: z.ZodLiteral<false>;
    id: z.ZodString;
    error: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
        type: z.ZodLiteral<"BUILT_IN_ERROR">;
        name: z.ZodString;
        message: z.ZodString;
        stackTrace: z.ZodString;
        causes: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodOptional<z.ZodString>;
            message: z.ZodString;
            stackTrace: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"CUSTOM_ERROR">;
        raw: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"STRING_ERROR">;
        raw: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"INTERNAL_ERROR">;
        code: z.ZodEnum<{
            BATCH_ITEM_COULD_NOT_TRIGGER: "BATCH_ITEM_COULD_NOT_TRIGGER";
            CONFIGURED_INCORRECTLY: "CONFIGURED_INCORRECTLY";
            COULD_NOT_FIND_EXECUTOR: "COULD_NOT_FIND_EXECUTOR";
            COULD_NOT_FIND_TASK: "COULD_NOT_FIND_TASK";
            COULD_NOT_IMPORT_TASK: "COULD_NOT_IMPORT_TASK";
            DISK_SPACE_EXCEEDED: "DISK_SPACE_EXCEEDED";
            GRACEFUL_EXIT_TIMEOUT: "GRACEFUL_EXIT_TIMEOUT";
            HANDLE_ERROR_ERROR: "HANDLE_ERROR_ERROR";
            MAX_DURATION_EXCEEDED: "MAX_DURATION_EXCEEDED";
            OUTDATED_SDK_VERSION: "OUTDATED_SDK_VERSION";
            PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE";
            POD_EVICTED: "POD_EVICTED";
            POD_UNKNOWN_ERROR: "POD_UNKNOWN_ERROR";
            RECURSIVE_WAIT_DEADLOCK: "RECURSIVE_WAIT_DEADLOCK";
            TASK_ALREADY_RUNNING: "TASK_ALREADY_RUNNING";
            TASK_DEQUEUED_INVALID_STATE: "TASK_DEQUEUED_INVALID_STATE";
            TASK_DEQUEUED_QUEUE_NOT_FOUND: "TASK_DEQUEUED_QUEUE_NOT_FOUND";
            TASK_DID_CONCURRENT_WAIT: "TASK_DID_CONCURRENT_WAIT";
            TASK_EXECUTION_ABORTED: "TASK_EXECUTION_ABORTED";
            TASK_EXECUTION_FAILED: "TASK_EXECUTION_FAILED";
            TASK_HAS_N0_EXECUTION_SNAPSHOT: "TASK_HAS_N0_EXECUTION_SNAPSHOT";
            TASK_INPUT_ERROR: "TASK_INPUT_ERROR";
            TASK_MIDDLEWARE_ERROR: "TASK_MIDDLEWARE_ERROR";
            TASK_OUTPUT_ERROR: "TASK_OUTPUT_ERROR";
            TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE: "TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE";
            TASK_PROCESS_MAYBE_OOM_KILLED: "TASK_PROCESS_MAYBE_OOM_KILLED";
            TASK_PROCESS_OOM_KILLED: "TASK_PROCESS_OOM_KILLED";
            TASK_PROCESS_SIGKILL_TIMEOUT: "TASK_PROCESS_SIGKILL_TIMEOUT";
            TASK_PROCESS_SIGSEGV: "TASK_PROCESS_SIGSEGV";
            TASK_PROCESS_SIGTERM: "TASK_PROCESS_SIGTERM";
            TASK_RUN_CANCELLED: "TASK_RUN_CANCELLED";
            TASK_RUN_CRASHED: "TASK_RUN_CRASHED";
            TASK_RUN_DEQUEUED_MAX_RETRIES: "TASK_RUN_DEQUEUED_MAX_RETRIES";
            TASK_RUN_HEARTBEAT_TIMEOUT: "TASK_RUN_HEARTBEAT_TIMEOUT";
            TASK_RUN_STALLED_EXECUTING: "TASK_RUN_STALLED_EXECUTING";
            TASK_RUN_STALLED_EXECUTING_WITH_WAITPOINTS: "TASK_RUN_STALLED_EXECUTING_WITH_WAITPOINTS";
            TASK_RUN_UNCAUGHT_EXCEPTION: "TASK_RUN_UNCAUGHT_EXCEPTION";
            UNSPECIFIED_ERROR: "UNSPECIFIED_ERROR";
        }>;
        message: z.ZodOptional<z.ZodString>;
        stackTrace: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>;
    retry: z.ZodOptional<z.ZodObject<{
        timestamp: z.ZodNumber;
        delay: z.ZodNumber;
        error: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>>;
    skippedRetrying: z.ZodOptional<z.ZodBoolean>;
    usage: z.ZodOptional<z.ZodObject<{
        durationMs: z.ZodNumber;
    }, z.core.$strip>>;
    taskIdentifier: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodObject<{
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>>>;
        operations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
            type: z.ZodLiteral<"update">;
            value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"set">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"delete">;
            key: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"append">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"remove">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"increment">;
            key: z.ZodString;
            value: z.ZodNumber;
        }, z.core.$strip>]>>>;
        parentOperations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
            type: z.ZodLiteral<"update">;
            value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"set">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"delete">;
            key: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"append">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"remove">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"increment">;
            key: z.ZodString;
            value: z.ZodNumber;
        }, z.core.$strip>]>>>;
        rootOperations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
            type: z.ZodLiteral<"update">;
            value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"set">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"delete">;
            key: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"append">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"remove">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"increment">;
            key: z.ZodString;
            value: z.ZodNumber;
        }, z.core.$strip>]>>>;
    }, z.core.$strip>>;
    flushedMetadata: z.ZodOptional<z.ZodObject<{
        data: z.ZodOptional<z.ZodString>;
        dataType: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type TaskRunFailedExecutionResult = z.infer<typeof TaskRunFailedExecutionResult>;
export declare const TaskRunSuccessfulExecutionResult: z.ZodObject<{
    ok: z.ZodLiteral<true>;
    id: z.ZodString;
    output: z.ZodOptional<z.ZodString>;
    outputType: z.ZodString;
    usage: z.ZodOptional<z.ZodObject<{
        durationMs: z.ZodNumber;
    }, z.core.$strip>>;
    taskIdentifier: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodObject<{
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>>>;
        operations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
            type: z.ZodLiteral<"update">;
            value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"set">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"delete">;
            key: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"append">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"remove">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"increment">;
            key: z.ZodString;
            value: z.ZodNumber;
        }, z.core.$strip>]>>>;
        parentOperations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
            type: z.ZodLiteral<"update">;
            value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"set">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"delete">;
            key: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"append">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"remove">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"increment">;
            key: z.ZodString;
            value: z.ZodNumber;
        }, z.core.$strip>]>>>;
        rootOperations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
            type: z.ZodLiteral<"update">;
            value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"set">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"delete">;
            key: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"append">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"remove">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"increment">;
            key: z.ZodString;
            value: z.ZodNumber;
        }, z.core.$strip>]>>>;
    }, z.core.$strip>>;
    flushedMetadata: z.ZodOptional<z.ZodObject<{
        data: z.ZodOptional<z.ZodString>;
        dataType: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type TaskRunSuccessfulExecutionResult = z.infer<typeof TaskRunSuccessfulExecutionResult>;
export declare const TaskRunExecutionResult: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
    ok: z.ZodLiteral<true>;
    id: z.ZodString;
    output: z.ZodOptional<z.ZodString>;
    outputType: z.ZodString;
    usage: z.ZodOptional<z.ZodObject<{
        durationMs: z.ZodNumber;
    }, z.core.$strip>>;
    taskIdentifier: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodObject<{
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>>>;
        operations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
            type: z.ZodLiteral<"update">;
            value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"set">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"delete">;
            key: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"append">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"remove">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"increment">;
            key: z.ZodString;
            value: z.ZodNumber;
        }, z.core.$strip>]>>>;
        parentOperations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
            type: z.ZodLiteral<"update">;
            value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"set">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"delete">;
            key: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"append">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"remove">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"increment">;
            key: z.ZodString;
            value: z.ZodNumber;
        }, z.core.$strip>]>>>;
        rootOperations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
            type: z.ZodLiteral<"update">;
            value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"set">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"delete">;
            key: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"append">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"remove">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"increment">;
            key: z.ZodString;
            value: z.ZodNumber;
        }, z.core.$strip>]>>>;
    }, z.core.$strip>>;
    flushedMetadata: z.ZodOptional<z.ZodObject<{
        data: z.ZodOptional<z.ZodString>;
        dataType: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    ok: z.ZodLiteral<false>;
    id: z.ZodString;
    error: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
        type: z.ZodLiteral<"BUILT_IN_ERROR">;
        name: z.ZodString;
        message: z.ZodString;
        stackTrace: z.ZodString;
        causes: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodOptional<z.ZodString>;
            message: z.ZodString;
            stackTrace: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"CUSTOM_ERROR">;
        raw: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"STRING_ERROR">;
        raw: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"INTERNAL_ERROR">;
        code: z.ZodEnum<{
            BATCH_ITEM_COULD_NOT_TRIGGER: "BATCH_ITEM_COULD_NOT_TRIGGER";
            CONFIGURED_INCORRECTLY: "CONFIGURED_INCORRECTLY";
            COULD_NOT_FIND_EXECUTOR: "COULD_NOT_FIND_EXECUTOR";
            COULD_NOT_FIND_TASK: "COULD_NOT_FIND_TASK";
            COULD_NOT_IMPORT_TASK: "COULD_NOT_IMPORT_TASK";
            DISK_SPACE_EXCEEDED: "DISK_SPACE_EXCEEDED";
            GRACEFUL_EXIT_TIMEOUT: "GRACEFUL_EXIT_TIMEOUT";
            HANDLE_ERROR_ERROR: "HANDLE_ERROR_ERROR";
            MAX_DURATION_EXCEEDED: "MAX_DURATION_EXCEEDED";
            OUTDATED_SDK_VERSION: "OUTDATED_SDK_VERSION";
            PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE";
            POD_EVICTED: "POD_EVICTED";
            POD_UNKNOWN_ERROR: "POD_UNKNOWN_ERROR";
            RECURSIVE_WAIT_DEADLOCK: "RECURSIVE_WAIT_DEADLOCK";
            TASK_ALREADY_RUNNING: "TASK_ALREADY_RUNNING";
            TASK_DEQUEUED_INVALID_STATE: "TASK_DEQUEUED_INVALID_STATE";
            TASK_DEQUEUED_QUEUE_NOT_FOUND: "TASK_DEQUEUED_QUEUE_NOT_FOUND";
            TASK_DID_CONCURRENT_WAIT: "TASK_DID_CONCURRENT_WAIT";
            TASK_EXECUTION_ABORTED: "TASK_EXECUTION_ABORTED";
            TASK_EXECUTION_FAILED: "TASK_EXECUTION_FAILED";
            TASK_HAS_N0_EXECUTION_SNAPSHOT: "TASK_HAS_N0_EXECUTION_SNAPSHOT";
            TASK_INPUT_ERROR: "TASK_INPUT_ERROR";
            TASK_MIDDLEWARE_ERROR: "TASK_MIDDLEWARE_ERROR";
            TASK_OUTPUT_ERROR: "TASK_OUTPUT_ERROR";
            TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE: "TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE";
            TASK_PROCESS_MAYBE_OOM_KILLED: "TASK_PROCESS_MAYBE_OOM_KILLED";
            TASK_PROCESS_OOM_KILLED: "TASK_PROCESS_OOM_KILLED";
            TASK_PROCESS_SIGKILL_TIMEOUT: "TASK_PROCESS_SIGKILL_TIMEOUT";
            TASK_PROCESS_SIGSEGV: "TASK_PROCESS_SIGSEGV";
            TASK_PROCESS_SIGTERM: "TASK_PROCESS_SIGTERM";
            TASK_RUN_CANCELLED: "TASK_RUN_CANCELLED";
            TASK_RUN_CRASHED: "TASK_RUN_CRASHED";
            TASK_RUN_DEQUEUED_MAX_RETRIES: "TASK_RUN_DEQUEUED_MAX_RETRIES";
            TASK_RUN_HEARTBEAT_TIMEOUT: "TASK_RUN_HEARTBEAT_TIMEOUT";
            TASK_RUN_STALLED_EXECUTING: "TASK_RUN_STALLED_EXECUTING";
            TASK_RUN_STALLED_EXECUTING_WITH_WAITPOINTS: "TASK_RUN_STALLED_EXECUTING_WITH_WAITPOINTS";
            TASK_RUN_UNCAUGHT_EXCEPTION: "TASK_RUN_UNCAUGHT_EXCEPTION";
            UNSPECIFIED_ERROR: "UNSPECIFIED_ERROR";
        }>;
        message: z.ZodOptional<z.ZodString>;
        stackTrace: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>;
    retry: z.ZodOptional<z.ZodObject<{
        timestamp: z.ZodNumber;
        delay: z.ZodNumber;
        error: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>>;
    skippedRetrying: z.ZodOptional<z.ZodBoolean>;
    usage: z.ZodOptional<z.ZodObject<{
        durationMs: z.ZodNumber;
    }, z.core.$strip>>;
    taskIdentifier: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodObject<{
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>>>;
        operations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
            type: z.ZodLiteral<"update">;
            value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"set">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"delete">;
            key: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"append">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"remove">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"increment">;
            key: z.ZodString;
            value: z.ZodNumber;
        }, z.core.$strip>]>>>;
        parentOperations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
            type: z.ZodLiteral<"update">;
            value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"set">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"delete">;
            key: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"append">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"remove">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"increment">;
            key: z.ZodString;
            value: z.ZodNumber;
        }, z.core.$strip>]>>>;
        rootOperations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
            type: z.ZodLiteral<"update">;
            value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"set">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"delete">;
            key: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"append">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"remove">;
            key: z.ZodString;
            value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"increment">;
            key: z.ZodString;
            value: z.ZodNumber;
        }, z.core.$strip>]>>>;
    }, z.core.$strip>>;
    flushedMetadata: z.ZodOptional<z.ZodObject<{
        data: z.ZodOptional<z.ZodString>;
        dataType: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>]>;
export type TaskRunExecutionResult = z.infer<typeof TaskRunExecutionResult>;
export declare const BatchTaskRunExecutionResult: z.ZodObject<{
    id: z.ZodString;
    items: z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
        ok: z.ZodLiteral<true>;
        id: z.ZodString;
        output: z.ZodOptional<z.ZodString>;
        outputType: z.ZodString;
        usage: z.ZodOptional<z.ZodObject<{
            durationMs: z.ZodNumber;
        }, z.core.$strip>>;
        taskIdentifier: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodObject<{
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>>>;
            operations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                type: z.ZodLiteral<"update">;
                value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"set">;
                key: z.ZodString;
                value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"delete">;
                key: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"append">;
                key: z.ZodString;
                value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"remove">;
                key: z.ZodString;
                value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"increment">;
                key: z.ZodString;
                value: z.ZodNumber;
            }, z.core.$strip>]>>>;
            parentOperations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                type: z.ZodLiteral<"update">;
                value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"set">;
                key: z.ZodString;
                value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"delete">;
                key: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"append">;
                key: z.ZodString;
                value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"remove">;
                key: z.ZodString;
                value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"increment">;
                key: z.ZodString;
                value: z.ZodNumber;
            }, z.core.$strip>]>>>;
            rootOperations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                type: z.ZodLiteral<"update">;
                value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"set">;
                key: z.ZodString;
                value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"delete">;
                key: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"append">;
                key: z.ZodString;
                value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"remove">;
                key: z.ZodString;
                value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"increment">;
                key: z.ZodString;
                value: z.ZodNumber;
            }, z.core.$strip>]>>>;
        }, z.core.$strip>>;
        flushedMetadata: z.ZodOptional<z.ZodObject<{
            data: z.ZodOptional<z.ZodString>;
            dataType: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        ok: z.ZodLiteral<false>;
        id: z.ZodString;
        error: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
            type: z.ZodLiteral<"BUILT_IN_ERROR">;
            name: z.ZodString;
            message: z.ZodString;
            stackTrace: z.ZodString;
            causes: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodOptional<z.ZodString>;
                message: z.ZodString;
                stackTrace: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"CUSTOM_ERROR">;
            raw: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"STRING_ERROR">;
            raw: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"INTERNAL_ERROR">;
            code: z.ZodEnum<{
                BATCH_ITEM_COULD_NOT_TRIGGER: "BATCH_ITEM_COULD_NOT_TRIGGER";
                CONFIGURED_INCORRECTLY: "CONFIGURED_INCORRECTLY";
                COULD_NOT_FIND_EXECUTOR: "COULD_NOT_FIND_EXECUTOR";
                COULD_NOT_FIND_TASK: "COULD_NOT_FIND_TASK";
                COULD_NOT_IMPORT_TASK: "COULD_NOT_IMPORT_TASK";
                DISK_SPACE_EXCEEDED: "DISK_SPACE_EXCEEDED";
                GRACEFUL_EXIT_TIMEOUT: "GRACEFUL_EXIT_TIMEOUT";
                HANDLE_ERROR_ERROR: "HANDLE_ERROR_ERROR";
                MAX_DURATION_EXCEEDED: "MAX_DURATION_EXCEEDED";
                OUTDATED_SDK_VERSION: "OUTDATED_SDK_VERSION";
                PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE";
                POD_EVICTED: "POD_EVICTED";
                POD_UNKNOWN_ERROR: "POD_UNKNOWN_ERROR";
                RECURSIVE_WAIT_DEADLOCK: "RECURSIVE_WAIT_DEADLOCK";
                TASK_ALREADY_RUNNING: "TASK_ALREADY_RUNNING";
                TASK_DEQUEUED_INVALID_STATE: "TASK_DEQUEUED_INVALID_STATE";
                TASK_DEQUEUED_QUEUE_NOT_FOUND: "TASK_DEQUEUED_QUEUE_NOT_FOUND";
                TASK_DID_CONCURRENT_WAIT: "TASK_DID_CONCURRENT_WAIT";
                TASK_EXECUTION_ABORTED: "TASK_EXECUTION_ABORTED";
                TASK_EXECUTION_FAILED: "TASK_EXECUTION_FAILED";
                TASK_HAS_N0_EXECUTION_SNAPSHOT: "TASK_HAS_N0_EXECUTION_SNAPSHOT";
                TASK_INPUT_ERROR: "TASK_INPUT_ERROR";
                TASK_MIDDLEWARE_ERROR: "TASK_MIDDLEWARE_ERROR";
                TASK_OUTPUT_ERROR: "TASK_OUTPUT_ERROR";
                TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE: "TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE";
                TASK_PROCESS_MAYBE_OOM_KILLED: "TASK_PROCESS_MAYBE_OOM_KILLED";
                TASK_PROCESS_OOM_KILLED: "TASK_PROCESS_OOM_KILLED";
                TASK_PROCESS_SIGKILL_TIMEOUT: "TASK_PROCESS_SIGKILL_TIMEOUT";
                TASK_PROCESS_SIGSEGV: "TASK_PROCESS_SIGSEGV";
                TASK_PROCESS_SIGTERM: "TASK_PROCESS_SIGTERM";
                TASK_RUN_CANCELLED: "TASK_RUN_CANCELLED";
                TASK_RUN_CRASHED: "TASK_RUN_CRASHED";
                TASK_RUN_DEQUEUED_MAX_RETRIES: "TASK_RUN_DEQUEUED_MAX_RETRIES";
                TASK_RUN_HEARTBEAT_TIMEOUT: "TASK_RUN_HEARTBEAT_TIMEOUT";
                TASK_RUN_STALLED_EXECUTING: "TASK_RUN_STALLED_EXECUTING";
                TASK_RUN_STALLED_EXECUTING_WITH_WAITPOINTS: "TASK_RUN_STALLED_EXECUTING_WITH_WAITPOINTS";
                TASK_RUN_UNCAUGHT_EXCEPTION: "TASK_RUN_UNCAUGHT_EXCEPTION";
                UNSPECIFIED_ERROR: "UNSPECIFIED_ERROR";
            }>;
            message: z.ZodOptional<z.ZodString>;
            stackTrace: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        retry: z.ZodOptional<z.ZodObject<{
            timestamp: z.ZodNumber;
            delay: z.ZodNumber;
            error: z.ZodOptional<z.ZodUnknown>;
        }, z.core.$strip>>;
        skippedRetrying: z.ZodOptional<z.ZodBoolean>;
        usage: z.ZodOptional<z.ZodObject<{
            durationMs: z.ZodNumber;
        }, z.core.$strip>>;
        taskIdentifier: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodObject<{
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>>>;
            operations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                type: z.ZodLiteral<"update">;
                value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"set">;
                key: z.ZodString;
                value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"delete">;
                key: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"append">;
                key: z.ZodString;
                value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"remove">;
                key: z.ZodString;
                value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"increment">;
                key: z.ZodString;
                value: z.ZodNumber;
            }, z.core.$strip>]>>>;
            parentOperations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                type: z.ZodLiteral<"update">;
                value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"set">;
                key: z.ZodString;
                value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"delete">;
                key: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"append">;
                key: z.ZodString;
                value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"remove">;
                key: z.ZodString;
                value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"increment">;
                key: z.ZodString;
                value: z.ZodNumber;
            }, z.core.$strip>]>>>;
            rootOperations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                type: z.ZodLiteral<"update">;
                value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"set">;
                key: z.ZodString;
                value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"delete">;
                key: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"append">;
                key: z.ZodString;
                value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"remove">;
                key: z.ZodString;
                value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
            }, z.core.$strip>, z.ZodObject<{
                type: z.ZodLiteral<"increment">;
                key: z.ZodString;
                value: z.ZodNumber;
            }, z.core.$strip>]>>>;
        }, z.core.$strip>>;
        flushedMetadata: z.ZodOptional<z.ZodObject<{
            data: z.ZodOptional<z.ZodString>;
            dataType: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>]>>;
}, z.core.$strip>;
export type BatchTaskRunExecutionResult = z.infer<typeof BatchTaskRunExecutionResult>;
export declare const WaitpointTokenResult: z.ZodObject<{
    ok: z.ZodBoolean;
    output: z.ZodOptional<z.ZodString>;
    outputType: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type WaitpointTokenResult = z.infer<typeof WaitpointTokenResult>;
export type WaitpointTokenTypedResult<T> = {
    ok: true;
    output: T;
} | {
    ok: false;
    error: Error;
};
export declare const SerializedError: z.ZodObject<{
    message: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    stackTrace: z.ZodOptional<z.ZodString>;
    causes: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        message: z.ZodString;
        stackTrace: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type SerializedError = z.infer<typeof SerializedError>;
export declare const RuntimeEnvironmentType: {
    PRODUCTION: "PRODUCTION";
    STAGING: "STAGING";
    DEVELOPMENT: "DEVELOPMENT";
    PREVIEW: "PREVIEW";
};
export type RuntimeEnvironmentType = (typeof RuntimeEnvironmentType)[keyof typeof RuntimeEnvironmentType];
export declare const RuntimeEnvironmentTypeSchema: z.ZodEnum<{
    DEVELOPMENT: "DEVELOPMENT";
    PREVIEW: "PREVIEW";
    PRODUCTION: "PRODUCTION";
    STAGING: "STAGING";
}>;
