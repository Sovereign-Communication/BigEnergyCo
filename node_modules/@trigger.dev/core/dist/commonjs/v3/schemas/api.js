"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpsertBranchResponseBody = exports.UpsertBranchRequestBody = exports.DeploymentTriggeredVia = exports.ExternalBuildData = exports.CancelDeploymentRequestBody = exports.ProgressDeploymentRequestBody = exports.GetDeploymentArtifactUrlResponseBody = exports.BuildServerMetadata = exports.FinalizeDeploymentRequestBody = exports.StartDeploymentIndexingResponseBody = exports.StartDeploymentIndexingRequestBody = exports.GetEnvironmentVariablesResponseBody = exports.RescheduleRunRequestBody = exports.AddTagsRequestBody = exports.GetBatchResponseBody = exports.BatchTriggerTaskResponse = exports.StreamBatchItemsResponse = exports.BatchItemNDJSON = exports.CreateBatchResponse = exports.CreateBatchRequestBody = exports.BatchTriggerTaskV3Response = exports.BatchTriggerTaskV3RequestBody = exports.BatchTriggerTaskV2Response = exports.BatchTriggerTaskV2RequestBody = exports.BatchTriggerTaskItem = exports.BatchTriggerTaskRequestBody = exports.TriggerTaskResponse = exports.TriggerTaskRequestBody = exports.IdempotencyKeyOptionsSchema = exports.RunTags = exports.CreateBackgroundWorkerResponse = exports.BackgroundWorkerWarning = exports.CreateBackgroundWorkerRequestBody = exports.GetJWTResponse = exports.GetJWTRequestBody = exports.GetWorkerByTagResponse = exports.GetWorkerTaskResponse = exports.GetProjectEnvironmentsResponseBody = exports.ProjectEnvironment = exports.GetProjectEnvResponse = exports.CreateProjectRequestBody = exports.CreateOrgResponseBody = exports.CreateOrgRequestBody = exports.GetOrgsResponseBody = exports.GetProjectRuntimesResponseBody = exports.NODE_RUNTIME_UPDATE_MAJOR = exports.GetProjectsResponseBody = exports.GetProjectResponseBody = exports.WhoAmIResponseSchema = exports.RunEngineVersion = void 0;
exports.ListRunResponseItem = exports.RetrieveRunResponse = exports.RelatedRunDetails = exports.TriggerFunction = exports.RunScheduleDetails = exports.RunEnvironmentDetails = exports.AttemptStatus = exports.RunStatus = exports.TimezonesResult = exports.ListScheduleOptions = exports.ListSchedulesResult = exports.DeletedScheduleObject = exports.ScheduleObject = exports.ScheduleGenerator = exports.UpdateScheduleOptions = exports.CreateScheduleOptions = exports.ScheduledTaskPayload = exports.ScheduleType = exports.ResetIdempotencyKeyResponse = exports.CanceledRunResponse = exports.ReplayRunResponse = exports.DevDisconnectResponseBody = exports.DevDisconnectRequestBody = exports.DevDequeueResponseBody = exports.DevDequeueRequestBody = exports.DevConfigResponseBody = exports.WorkersCreateResponseBody = exports.WorkersCreateRequestBody = exports.WorkersListResponseBody = exports.SessionTranscriptResponseBody = exports.CreateUploadPayloadUrlResponseBody = exports.DeploymentEventFromString = exports.DeploymentEvent = exports.DeploymentFinalizedEvent = exports.DeploymentLogEvent = exports.GetLatestDeploymentResponseBody = exports.GetDeploymentBuildEnvVarsResponseBody = exports.GetDeploymentResponseBody = exports.PromoteDeploymentResponseBody = exports.FailDeploymentResponseBody = exports.FailDeploymentRequestBody = exports.DeploymentErrorData = exports.GenerateRegistryCredentialsResponseBody = exports.RemoteBuildProviderStatusResponseBody = exports.GetDeploySettingsResponseBody = exports.DeployBuildPath = exports.InitializeDeploymentRequestBody = exports.InitializeDeploymentResponseBody = exports.CreateArtifactResponseBody = exports.CreateArtifactRequestBody = void 0;
exports.ListSessionsResponseBody = exports.ListedSessionItem = exports.ListSessionsOptions = exports.ListSessionsQueryParams = exports.SessionStatus = exports.CloseSessionRequestBody = exports.UpdateSessionRequestBody = exports.EndAndContinueSessionResponseBody = exports.EndAndContinueSessionRequestBody = exports.RetrieveSessionResponseBody = exports.CreatedSessionResponseBody = exports.SessionItem = exports.CreateSessionRequestBody = exports.SessionTriggerConfig = exports.CompleteWaitpointTokenRequestBody = exports.WaitpointRetrieveTokenResponse = exports.WaitpointListTokenItem = exports.WaitpointTokenItem = exports.WaitpointTokenStatus = exports.waitpointTokenStatuses = exports.CreateSessionStreamWaitpointResponseBody = exports.CreateSessionStreamWaitpointRequestBody = exports.CreateInputStreamWaitpointResponseBody = exports.CreateInputStreamWaitpointRequestBody = exports.CreateWaitpointTokenResponseBody = exports.CreateWaitpointTokenRequestBody = exports.TimePeriod = exports.SubscribeRealtimeStreamChunkRawShape = exports.RetrieveBatchV2Response = exports.RetrieveBatchResponse = exports.BatchStatus = exports.SubscribeRunRawShape = exports.UpdateMetadataResponseBody = exports.UpdateMetadataRequestBody = exports.EnvironmentVariableWithSecret = exports.EnvironmentVariables = exports.EnvironmentVariable = exports.EnvironmentVariableValue = exports.EnvironmentVariableResponseBody = exports.ImportEnvironmentVariablesRequestBody = exports.UpdateEnvironmentVariableRequestBody = exports.CreateEnvironmentVariableRequestBody = exports.ListBulkActionsResponseBody = exports.AbortBulkActionResponseBody = exports.CreateBulkActionResponseBody = exports.BulkActionObject = exports.BulkActionType = exports.BulkActionStatus = exports.CreateBulkActionRequestBody = exports.ListRunResponse = void 0;
exports.PromptOverrideCreatedResponseBody = exports.PromptOkResponseBody = exports.ReactivatePromptOverrideRequestBody = exports.UpdatePromptOverrideRequestBody = exports.CreatePromptOverrideRequestBody = exports.PromotePromptVersionRequestBody = exports.ListPromptVersionsResponseBody = exports.ListPromptsResponseBody = exports.ResolvePromptResponseBody = exports.ResolvePromptRequestBody = exports.ReadSessionStreamRecordsResponseBody = exports.SendInputStreamResponseBody = exports.AppendToStreamResponseBody = exports.CreateStreamResponseBody = exports.RetrieveSpanDetailResponseBody = exports.RetrieveRunTraceResponseBody = exports.RetrieveRunTraceSpan = exports.RetrieveRunTraceSpanSchema = exports.ApiBranchListResponseBody = exports.RetrieveCurrentDeploymentResponseBody = exports.ApiDeploymentListResponseItem = exports.ApiDeploymentListSearchParams = exports.ApiDeploymentListOptions = exports.ApiDeploymentListParams = exports.WaitForDurationResponseBody = exports.WaitForDurationRequestBody = exports.WaitForWaitpointTokenResponseBody = exports.CompleteWaitpointTokenResponseBody = void 0;
exports.nodeMajor = nodeMajor;
exports.needsNodeRuntimeUpdate = needsNodeRuntimeUpdate;
exports.isWaitpointOutputTimeout = isWaitpointOutputTimeout;
exports.timeoutError = timeoutError;
const v4_1 = require("zod/v4");
const zod_js_1 = require("../utils/zod.js");
const json_js_1 = require("../../schemas/json.js");
const externalDeploymentId_js_1 = require("../externalDeploymentId.js");
const common_js_1 = require("./common.js");
const resources_js_1 = require("./resources.js");
const runEngine_js_1 = require("./runEngine.js");
const queues_js_1 = require("./queues.js");
const schemas_js_1 = require("./schemas.js");
const build_js_1 = require("./build.js");
exports.RunEngineVersion = v4_1.z.union([v4_1.z.literal("V1"), v4_1.z.literal("V2")]);
exports.WhoAmIResponseSchema = v4_1.z.object({
    userId: v4_1.z.string(),
    email: v4_1.z.string().email(),
    dashboardUrl: v4_1.z.string(),
    project: v4_1.z
        .object({
        name: v4_1.z.string(),
        url: v4_1.z.string(),
        orgTitle: v4_1.z.string(),
    })
        .optional(),
});
exports.GetProjectResponseBody = v4_1.z.object({
    id: v4_1.z.string(),
    externalRef: v4_1.z
        .string()
        .describe("The external reference for the project, also known as the project ref, a unique identifier starting with proj_"),
    name: v4_1.z.string(),
    slug: v4_1.z.string(),
    createdAt: v4_1.z.coerce.date(),
    // Worker-group name of the project's default region, or null when unset
    // (the project falls back to the global platform default). Optional so a
    // newer client still parses responses from an older server that omits it.
    defaultRegion: v4_1.z.string().nullable().optional(),
    defaultRuntime: build_js_1.BuildRuntime.nullable().optional(),
    organization: v4_1.z.object({
        id: v4_1.z.string(),
        title: v4_1.z.string(),
        slug: v4_1.z.string(),
        createdAt: v4_1.z.coerce.date(),
    }),
});
exports.GetProjectsResponseBody = v4_1.z.array(exports.GetProjectResponseBody);
/** The Node.js major version currently targeted by the runtime update report. */
exports.NODE_RUNTIME_UPDATE_MAJOR = 21;
/**
 * Returns the observed Node.js major version for a deployment.
 *
 * `runtime: "node"` is an alias whose underlying Node.js version has changed over time, so the
 * recorded runtimeVersion is deliberately the source of truth here.
 */
function nodeMajor(runtime, runtimeVersion) {
    if (!runtime?.startsWith("node"))
        return undefined;
    const match = runtimeVersion?.match(/^(\d+)(?:\.\d+){1,2}(?:[-+].*)?$/);
    return match ? Number(match[1]) : undefined;
}
function needsNodeRuntimeUpdate(runtime, runtimeVersion) {
    if (runtime && !runtime.startsWith("node"))
        return false;
    const versionMatch = runtimeVersion?.match(/^(\d+)(?:\.\d+){1,2}(?:[-+].*)?$/);
    if (versionMatch)
        return Number(versionMatch[1]) === exports.NODE_RUNTIME_UPDATE_MAJOR;
    if (runtimeVersion)
        return false;
    if (!runtime || runtime === "node")
        return true;
    const configuredMajorMatch = runtime.match(/^node-(\d+)$/);
    return configuredMajorMatch
        ? Number(configuredMajorMatch[1]) === exports.NODE_RUNTIME_UPDATE_MAJOR
        : false;
}
exports.GetProjectRuntimesResponseBody = v4_1.z.array(v4_1.z.object({
    organization: v4_1.z.object({
        title: v4_1.z.string(),
        slug: v4_1.z.string(),
    }),
    project: v4_1.z.object({
        name: v4_1.z.string(),
        slug: v4_1.z.string(),
        externalRef: v4_1.z.string(),
    }),
    environment: v4_1.z.object({
        slug: v4_1.z.string(),
    }),
    deployment: v4_1.z
        .object({
        runtime: v4_1.z.string().nullable(),
        runtimeVersion: v4_1.z.string().nullable(),
        nodeMajor: v4_1.z.number().int().positive().nullable(),
        deployedAt: v4_1.z.coerce.date().nullable(),
        shortCode: v4_1.z.string(),
    })
        .nullable(),
}));
exports.GetOrgsResponseBody = v4_1.z.array(v4_1.z.object({
    id: v4_1.z.string(),
    title: v4_1.z.string(),
    slug: v4_1.z.string(),
    createdAt: v4_1.z.coerce.date(),
}));
exports.CreateOrgRequestBody = v4_1.z.object({
    title: v4_1.z.string().trim().min(3).max(50),
    companySize: v4_1.z.string().optional(),
    companyUrl: v4_1.z.string().optional(),
});
exports.CreateOrgResponseBody = v4_1.z.object({
    id: v4_1.z.string(),
    title: v4_1.z.string(),
    slug: v4_1.z.string(),
    createdAt: v4_1.z.coerce.date(),
});
exports.CreateProjectRequestBody = v4_1.z.object({
    name: v4_1.z
        .string()
        .trim()
        .min(1, "Name is required")
        .max(255, "Name must be less than 255 characters"),
});
exports.GetProjectEnvResponse = v4_1.z.object({
    apiKey: v4_1.z.string(),
    name: v4_1.z.string(),
    apiUrl: v4_1.z.string(),
    projectId: v4_1.z.string(),
    defaultRuntime: build_js_1.BuildRuntime.nullable().optional(),
});
exports.ProjectEnvironment = v4_1.z.object({
    id: v4_1.z.string(),
    /// The slug used as the environment identifier in env var endpoints (e.g. "dev", "stg", "prod", "preview")
    slug: v4_1.z.string(),
    type: v4_1.z.enum(["DEVELOPMENT", "STAGING", "PREVIEW", "PRODUCTION"]),
    /// Whether this is the branchable parent (preview); individual branches are not returned
    isBranchableEnvironment: v4_1.z.boolean(),
    branchName: v4_1.z.string().nullable(),
    paused: v4_1.z.boolean(),
});
exports.GetProjectEnvironmentsResponseBody = v4_1.z.array(exports.ProjectEnvironment);
// Zod schema for the response body type
exports.GetWorkerTaskResponse = v4_1.z.object({
    id: v4_1.z.string(),
    slug: v4_1.z.string(),
    filePath: v4_1.z.string(),
    triggerSource: v4_1.z.string(),
    createdAt: v4_1.z.coerce.date(),
    payloadSchema: v4_1.z.any().nullish(),
    queueConfig: v4_1.z.any().nullish(),
});
exports.GetWorkerByTagResponse = v4_1.z.object({
    worker: v4_1.z.object({
        id: v4_1.z.string(),
        version: v4_1.z.string(),
        engine: v4_1.z.string().nullish(),
        sdkVersion: v4_1.z.string().nullish(),
        cliVersion: v4_1.z.string().nullish(),
        tasks: v4_1.z.array(exports.GetWorkerTaskResponse),
    }),
    urls: v4_1.z.object({
        runs: v4_1.z.string(),
    }),
});
exports.GetJWTRequestBody = v4_1.z.object({
    claims: v4_1.z
        .object({
        scopes: v4_1.z.array(v4_1.z.string()).default([]),
    })
        .optional(),
    expirationTime: v4_1.z.union([v4_1.z.number(), v4_1.z.string()]).optional(),
});
exports.GetJWTResponse = v4_1.z.object({
    token: v4_1.z.string(),
    // The environment the exchange resolved, so a caller that named a slug learns the id.
    environmentId: v4_1.z.string().optional(),
});
exports.CreateBackgroundWorkerRequestBody = v4_1.z.object({
    localOnly: v4_1.z.boolean(),
    metadata: resources_js_1.BackgroundWorkerMetadata,
    engine: exports.RunEngineVersion.optional(),
    supportsLazyAttempts: v4_1.z.boolean().optional(),
    buildPlatform: v4_1.z.string().optional(),
    targetPlatform: v4_1.z.string().optional(),
});
exports.BackgroundWorkerWarning = v4_1.z.object({
    code: v4_1.z.enum(["schedule_default_window", "schedule_minimum_window"]),
    message: v4_1.z.string(),
});
exports.CreateBackgroundWorkerResponse = v4_1.z.object({
    id: v4_1.z.string(),
    version: v4_1.z.string(),
    contentHash: v4_1.z.string(),
    warnings: v4_1.z.array(exports.BackgroundWorkerWarning).optional(),
});
//an array of 1, 2, or 3 strings
const RunTag = v4_1.z.string().max(128, "Tags must be less than 128 characters");
exports.RunTags = v4_1.z.union([RunTag, RunTag.array()]);
/** Stores the original user-provided idempotency key and scope */
exports.IdempotencyKeyOptionsSchema = v4_1.z.object({
    key: v4_1.z.string(),
    scope: v4_1.z.enum(["run", "attempt", "global"]),
});
// Coerces user-supplied concurrencyKey values to string. The downstream Prisma
// column is String?, so passing a number (a common foot-gun when callers do
// `concurrencyKey: payload.userId`) used to fail at `prisma.taskRun.create`
// with PrismaClientValidationError. Accept the intent and stringify here.
const ConcurrencyKeySchema = v4_1.z.union([v4_1.z.string(), v4_1.z.number()]).transform((value) => String(value));
const ExternalDeploymentId = v4_1.z.preprocess((value) => {
    // `null` is the opt-out sentinel callers write; treat it as absent, not a validation error.
    if (value === null) {
        return undefined;
    }
    if (typeof value !== "string") {
        return value;
    }
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
}, v4_1.z.string().max(externalDeploymentId_js_1.EXTERNAL_DEPLOYMENT_ID_MAX_LENGTH, `externalId must be at most ${externalDeploymentId_js_1.EXTERNAL_DEPLOYMENT_ID_MAX_LENGTH} characters`).optional());
exports.TriggerTaskRequestBody = v4_1.z
    .object({
    payload: v4_1.z.any().optional(),
    context: v4_1.z.any().optional(),
    options: v4_1.z
        .object({
        /** @deprecated engine v1 only */
        dependentAttempt: v4_1.z.string().optional(),
        /** @deprecated engine v1 only */
        parentAttempt: v4_1.z.string().optional(),
        /** @deprecated engine v1 only */
        dependentBatch: v4_1.z.string().optional(),
        /**
         * If triggered in a batch, this is the BatchTaskRun id
         */
        parentBatch: v4_1.z.string().optional(),
        /**
         * RunEngine v2
         * If triggered inside another run, the parentRunId is the friendly ID of the parent run.
         */
        parentRunId: v4_1.z.string().optional(),
        /**
         * RunEngine v2
         * Should be `true` if `triggerAndWait` or `batchTriggerAndWait`
         */
        resumeParentOnCompletion: v4_1.z.boolean().optional(),
        /**
         * Locks the version to the passed value.
         * Automatically set when using `triggerAndWait` or `batchTriggerAndWait`
         */
        lockToVersion: v4_1.z.string().optional(),
        /**
         * The external deployment id the calling application belongs to — a commit SHA, a
         * CI run id, a release tag. Independent of `lockToVersion`: the SDK reports every
         * pinning signal it can see and the server decides which one governs, so a trigger
         * carrying both sends both. Resolution is environment-scoped, and an id naming a
         * deployment that has not landed yet parks the run rather than failing it.
         */
        externalDeploymentId: ExternalDeploymentId,
        queue: v4_1.z
            .object({
            name: v4_1.z.string(),
            // @deprecated, this is now specified on the queue
            concurrencyLimit: v4_1.z.number().int().optional(),
        })
            .optional(),
        concurrencyKey: ConcurrencyKeySchema.optional(),
        delay: v4_1.z.string().or(v4_1.z.coerce.date()).optional(),
        idempotencyKey: v4_1.z
            .string()
            // Caps user-supplied keys before they reach the unique idempotency index
            // on the underlying table — values past this fail at the database layer
            // rather than returning a clean 400.
            .max(2048, "idempotencyKey must be 2048 characters or less")
            .optional(),
        idempotencyKeyTTL: v4_1.z.string().optional(),
        /** The original user-provided idempotency key and scope */
        idempotencyKeyOptions: exports.IdempotencyKeyOptionsSchema.optional(),
        machine: common_js_1.MachinePresetName.optional(),
        maxAttempts: v4_1.z.number().int().optional(),
        maxDuration: v4_1.z.number().optional(),
        metadata: v4_1.z.any().optional(),
        metadataType: v4_1.z.string().optional(),
        payloadType: v4_1.z.string().optional(),
        /**
         * Byte size of the (pre-offload) serialized payload, measured by the caller
         * before any object-store offload. Lets the pipeline know how large a payload
         * is without downloading an "application/store" reference.
         */
        payloadSize: v4_1.z.number().int().nonnegative().optional(),
        tags: exports.RunTags.optional(),
        test: v4_1.z.boolean().optional(),
        ttl: v4_1.z.string().or(v4_1.z.number().nonnegative().int()).optional(),
        priority: v4_1.z.number().optional(),
        bulkActionId: v4_1.z.string().optional(),
        region: v4_1.z.string().optional(),
        debounce: v4_1.z
            .object({
            key: v4_1.z.string().max(512),
            delay: v4_1.z.string(),
            mode: v4_1.z.enum(["leading", "trailing"]).optional(),
            maxDelay: v4_1.z.string().optional(),
        })
            .optional(),
    })
        .optional(),
})
    .superRefine((value, ctx) => {
    if (value.options?.payloadType !== "application/store") {
        return;
    }
    if (typeof value.payload !== "string" || value.payload.length === 0) {
        ctx.addIssue({
            code: v4_1.z.ZodIssueCode.custom,
            message: "payload must be a non-empty string when options.payloadType is application/store",
            path: ["payload"],
        });
    }
});
exports.TriggerTaskResponse = v4_1.z.object({
    id: v4_1.z.string(),
    isCached: v4_1.z.boolean().optional(),
});
exports.BatchTriggerTaskRequestBody = v4_1.z.object({
    items: exports.TriggerTaskRequestBody.array(),
    dependentAttempt: v4_1.z.string().optional(),
});
exports.BatchTriggerTaskItem = v4_1.z.object({
    task: v4_1.z.string(),
    payload: v4_1.z.any().optional(),
    context: v4_1.z.any().optional(),
    options: v4_1.z
        .object({
        concurrencyKey: ConcurrencyKeySchema.optional(),
        delay: v4_1.z.string().or(v4_1.z.coerce.date()).optional(),
        idempotencyKey: v4_1.z
            .string()
            // Caps user-supplied keys before they reach the unique idempotency index
            // on the underlying table — values past this fail at the database layer
            // rather than returning a clean 400.
            .max(2048, "idempotencyKey must be 2048 characters or less")
            .optional(),
        idempotencyKeyTTL: v4_1.z.string().optional(),
        /** The original user-provided idempotency key and scope */
        idempotencyKeyOptions: exports.IdempotencyKeyOptionsSchema.optional(),
        lockToVersion: v4_1.z.string().optional(),
        /** See `TriggerTaskRequestBody.options.externalDeploymentId`. */
        externalDeploymentId: ExternalDeploymentId,
        machine: common_js_1.MachinePresetName.optional(),
        maxAttempts: v4_1.z.number().int().optional(),
        maxDuration: v4_1.z.number().optional(),
        metadata: v4_1.z.any().optional(),
        metadataType: v4_1.z.string().optional(),
        parentAttempt: v4_1.z.string().optional(),
        payloadType: v4_1.z.string().optional(),
        /** Byte size of the (pre-offload) serialized payload for this item. */
        payloadSize: v4_1.z.number().int().nonnegative().optional(),
        queue: v4_1.z
            .object({
            name: v4_1.z.string(),
        })
            .optional(),
        tags: exports.RunTags.optional(),
        test: v4_1.z.boolean().optional(),
        ttl: v4_1.z.string().or(v4_1.z.number().nonnegative().int()).optional(),
        priority: v4_1.z.number().optional(),
        region: v4_1.z.string().optional(),
        debounce: v4_1.z
            .object({
            key: v4_1.z.string().max(512),
            delay: v4_1.z.string(),
            mode: v4_1.z.enum(["leading", "trailing"]).optional(),
            maxDelay: v4_1.z.string().optional(),
        })
            .optional(),
    })
        .optional(),
});
exports.BatchTriggerTaskV2RequestBody = v4_1.z.object({
    items: exports.BatchTriggerTaskItem.array(),
    /** @deprecated engine v1 only */
    dependentAttempt: v4_1.z.string().optional(),
    /**
     * RunEngine v2
     * If triggered inside another run, the parentRunId is the friendly ID of the parent run.
     */
    parentRunId: v4_1.z.string().optional(),
    /**
     * RunEngine v2
     * Should be `true` if `triggerAndWait` or `batchTriggerAndWait`
     */
    resumeParentOnCompletion: v4_1.z.boolean().optional(),
});
exports.BatchTriggerTaskV2Response = v4_1.z.object({
    id: v4_1.z.string(),
    isCached: v4_1.z.boolean(),
    idempotencyKey: v4_1.z.string().optional(),
    runs: v4_1.z.array(v4_1.z.object({
        id: v4_1.z.string(),
        taskIdentifier: v4_1.z.string(),
        isCached: v4_1.z.boolean(),
        idempotencyKey: v4_1.z.string().optional(),
    })),
});
exports.BatchTriggerTaskV3RequestBody = v4_1.z.object({
    items: exports.BatchTriggerTaskItem.array(),
    /**
     * RunEngine v2
     * If triggered inside another run, the parentRunId is the friendly ID of the parent run.
     */
    parentRunId: v4_1.z.string().optional(),
    /**
     * RunEngine v2
     * Should be `true` if `triggerAndWait` or `batchTriggerAndWait`
     */
    resumeParentOnCompletion: v4_1.z.boolean().optional(),
});
exports.BatchTriggerTaskV3Response = v4_1.z.object({
    id: v4_1.z.string(),
    runCount: v4_1.z.number(),
});
// ============================================================================
// 2-Phase Batch API (v3) - Streaming NDJSON Support
// ============================================================================
/**
 * Phase 1: Create batch request body
 * Creates the batch record and optionally blocks parent run for batchTriggerAndWait
 */
exports.CreateBatchRequestBody = v4_1.z.object({
    /** Expected number of items in the batch */
    runCount: v4_1.z.number().int().positive(),
    /** Distinct task identifiers expected in the item stream */
    taskIdentifiers: v4_1.z.array(v4_1.z.string().min(1)).min(1).optional(),
    /** Parent run ID for batchTriggerAndWait (friendly ID) */
    parentRunId: v4_1.z.string().optional(),
    /** Whether to resume parent on completion (true for batchTriggerAndWait) */
    resumeParentOnCompletion: v4_1.z.boolean().optional(),
    /** Idempotency key for the batch */
    idempotencyKey: v4_1.z
        .string()
        // Caps user-supplied keys before they reach the unique idempotency index
        // on the underlying table — values past this fail at the database layer
        // rather than returning a clean 400.
        .max(2048, "idempotencyKey must be 2048 characters or less")
        .optional(),
    /** The original user-provided idempotency key and scope */
    idempotencyKeyOptions: exports.IdempotencyKeyOptionsSchema.optional(),
});
/**
 * Phase 1: Create batch response
 */
exports.CreateBatchResponse = v4_1.z.object({
    /** The batch ID (friendly ID) */
    id: v4_1.z.string(),
    /** The expected run count */
    runCount: v4_1.z.number(),
    /** Whether this response came from a cached/idempotent batch */
    isCached: v4_1.z.boolean(),
    /** The idempotency key if provided */
    idempotencyKey: v4_1.z.string().optional(),
});
/**
 * Phase 2: Individual item in the NDJSON stream
 * Each line in the NDJSON body should match this schema.
 *
 * `options` reuses the strict shape from BatchTriggerTaskItem so that the
 * Phase-2 streaming path validates option fields identically to the V2/V3
 * batch trigger endpoints — historically this used z.record(z.string(), z.unknown()) and
 * let invalid values (e.g. numeric concurrencyKey) reach Prisma.
 */
exports.BatchItemNDJSON = v4_1.z.object({
    /** Zero-based index of this item (used for idempotency and ordering) */
    index: v4_1.z.number().int().nonnegative(),
    /** The task identifier to trigger */
    task: v4_1.z.string(),
    /** The payload for this task run */
    payload: v4_1.z.unknown().optional(),
    /** Options for this specific item */
    options: exports.BatchTriggerTaskItem.shape.options,
});
/**
 * Phase 2: Stream items response
 * Returned after the NDJSON stream completes
 */
exports.StreamBatchItemsResponse = v4_1.z.object({
    /** The batch ID */
    id: v4_1.z.string(),
    /** Number of items successfully accepted */
    itemsAccepted: v4_1.z.number(),
    /** Number of items that were deduplicated (already enqueued) */
    itemsDeduplicated: v4_1.z.number(),
    /** Whether the batch was sealed and is ready for processing.
     * If false, the batch needs more items before processing can start.
     * Clients should check this field and retry with missing items if needed. */
    sealed: v4_1.z.boolean(),
    /** Total items currently enqueued (only present when sealed=false to help with retries) */
    enqueuedCount: v4_1.z.number().optional(),
    /** Expected total item count (only present when sealed=false to help with retries) */
    expectedCount: v4_1.z.number().optional(),
});
exports.BatchTriggerTaskResponse = v4_1.z.object({
    batchId: v4_1.z.string(),
    runs: v4_1.z.string().array(),
});
exports.GetBatchResponseBody = v4_1.z.object({
    id: v4_1.z.string(),
    items: v4_1.z.array(v4_1.z.object({
        id: v4_1.z.string(),
        taskRunId: v4_1.z.string(),
        status: v4_1.z.enum(["PENDING", "CANCELED", "COMPLETED", "FAILED"]),
    })),
});
exports.AddTagsRequestBody = v4_1.z.object({
    tags: exports.RunTags,
});
exports.RescheduleRunRequestBody = v4_1.z.object({
    delay: v4_1.z.string().or(v4_1.z.coerce.date()),
});
exports.GetEnvironmentVariablesResponseBody = v4_1.z.object({
    variables: v4_1.z.record(v4_1.z.string(), v4_1.z.string()),
});
exports.StartDeploymentIndexingRequestBody = v4_1.z.object({
    imageReference: v4_1.z.string(),
    selfHosted: v4_1.z.boolean().optional(),
});
exports.StartDeploymentIndexingResponseBody = v4_1.z.object({
    id: v4_1.z.string(),
    contentHash: v4_1.z.string(),
});
exports.FinalizeDeploymentRequestBody = v4_1.z.object({
    skipPromotion: v4_1.z.boolean().optional(),
    imageDigest: v4_1.z.string().optional(),
    skipPushToRegistry: v4_1.z.boolean().optional(),
});
exports.BuildServerMetadata = v4_1.z.object({
    buildId: v4_1.z.string().optional(),
    isNativeBuild: v4_1.z.boolean().optional(),
    artifactKey: v4_1.z.string().optional(),
    skipPromotion: v4_1.z.boolean().optional(),
    configFilePath: v4_1.z.string().optional(),
    skipEnqueue: v4_1.z.boolean().optional(),
    fromBundle: v4_1.z.boolean().optional(),
});
exports.GetDeploymentArtifactUrlResponseBody = v4_1.z.object({
    url: v4_1.z.string().url(),
    expiresAt: v4_1.z.string().datetime(),
});
exports.ProgressDeploymentRequestBody = v4_1.z.object({
    contentHash: v4_1.z.string().optional(),
    gitMeta: common_js_1.GitMeta.optional(),
    runtime: v4_1.z.string().optional(),
    buildServerMetadata: exports.BuildServerMetadata.optional(),
});
exports.CancelDeploymentRequestBody = v4_1.z.object({
    reason: v4_1.z.string().max(200, "Reason must be less than 200 characters").optional(),
});
exports.ExternalBuildData = v4_1.z.object({
    buildId: v4_1.z.string(),
    buildToken: v4_1.z.string(),
    projectId: v4_1.z.string(),
});
const anyString = v4_1.z.custom((v) => typeof v === "string");
exports.DeploymentTriggeredVia = v4_1.z
    .enum([
    "cli:manual",
    "cli:ci_other",
    "cli:github_actions",
    "cli:gitlab_ci",
    "cli:circleci",
    "cli:jenkins",
    "cli:azure_pipelines",
    "cli:bitbucket_pipelines",
    "cli:travis_ci",
    "cli:buildkite",
    "git_integration:github",
    "dashboard",
])
    .or(anyString);
// TriggerSource, TriggerAction, and RunAnnotations are defined in runEngine.ts
// They are re-exported through the schemas barrel (index.ts)
exports.UpsertBranchRequestBody = v4_1.z.object({
    git: common_js_1.GitMeta.optional(),
    env: v4_1.z.enum(["preview", "development"]),
    branch: v4_1.z.string(),
});
exports.UpsertBranchResponseBody = v4_1.z.object({
    id: v4_1.z.string(),
    autoArchivedBranches: v4_1.z
        .array(v4_1.z.object({
        id: v4_1.z.string(),
        branchName: v4_1.z.string(),
    }))
        .optional(),
});
exports.CreateArtifactRequestBody = v4_1.z.object({
    type: v4_1.z.enum(["deployment_context", "deployment_bundle"]).default("deployment_context"),
    contentType: v4_1.z.string().default("application/gzip"),
    contentLength: v4_1.z.number().optional(),
});
exports.CreateArtifactResponseBody = v4_1.z.object({
    artifactKey: v4_1.z.string(),
    uploadUrl: v4_1.z.string(),
    uploadFields: v4_1.z.record(v4_1.z.string(), v4_1.z.string()),
    expiresAt: v4_1.z.string().datetime(),
});
exports.InitializeDeploymentResponseBody = v4_1.z.object({
    id: v4_1.z.string(),
    contentHash: v4_1.z.string(),
    shortCode: v4_1.z.string(),
    version: v4_1.z.string(),
    imageTag: v4_1.z.string(),
    imagePlatform: v4_1.z.string(),
    externalId: v4_1.z.string().optional(),
    outcome: v4_1.z.enum(["created", "existing"]).optional(),
    isPromoted: v4_1.z.boolean().optional(),
    externalBuildData: exports.ExternalBuildData.optional().nullable(),
    canceledDeployments: v4_1.z.array(v4_1.z.object({ version: v4_1.z.string(), shortCode: v4_1.z.string() })).optional(),
    eventStream: v4_1.z
        .object({
        s2: v4_1.z.object({
            basin: v4_1.z.string(),
            stream: v4_1.z.string(),
            accessToken: v4_1.z.string(),
        }),
    })
        .optional(),
});
const InitializeDeploymentRequestBodyBase = v4_1.z.object({
    contentHash: v4_1.z.string(),
    userId: v4_1.z.string().optional(),
    /** @deprecated This is now determined by the webapp. This is only used to warn users with old CLI versions. */
    selfHosted: v4_1.z.boolean().optional(),
    gitMeta: common_js_1.GitMeta.optional(),
    type: v4_1.z.enum(["MANAGED", "UNMANAGED", "V1"]).optional(),
    runtime: v4_1.z.string().optional(),
    initialStatus: v4_1.z.enum(["PENDING", "BUILDING"]).optional(),
    isLocalBuild: v4_1.z.boolean().optional(),
    triggeredVia: exports.DeploymentTriggeredVia.optional(),
    buildId: v4_1.z.string().optional(),
    externalId: ExternalDeploymentId,
    force: v4_1.z.boolean().optional(),
});
const InitializeDeploymentRequestBodyFull = InitializeDeploymentRequestBodyBase.extend({
    isNativeBuild: v4_1.z.boolean().default(false),
    skipPromotion: v4_1.z.boolean().optional(),
    artifactKey: v4_1.z.string().optional(),
    configFilePath: v4_1.z.string().optional(),
    skipEnqueue: v4_1.z.boolean().optional().default(false),
    // The artifact is a pre-built bundle; the build server only runs the container build
    fromBundle: v4_1.z.boolean().optional(),
    // Build-time env var values for fromBundle deploys, stored encrypted on the deployment
    buildEnvVars: v4_1.z.record(v4_1.z.string(), v4_1.z.string()).optional(),
}).superRefine((data, ctx) => {
    if (data.force && !data.externalId) {
        ctx.addIssue({
            code: v4_1.z.ZodIssueCode.custom,
            path: ["force"],
            message: "force requires externalId",
        });
    }
});
exports.InitializeDeploymentRequestBody = InitializeDeploymentRequestBodyFull.transform((data) => {
    if (data.isNativeBuild) {
        return { ...data, isNativeBuild: true };
    }
    const { skipPromotion, artifactKey, configFilePath, skipEnqueue, fromBundle, buildEnvVars, ...rest } = data;
    return { ...rest, isNativeBuild: false };
});
exports.DeployBuildPath = v4_1.z.enum(["depot", "native", "native_local_bundle"]);
exports.GetDeploySettingsResponseBody = v4_1.z.object({
    build_path: exports.DeployBuildPath,
});
exports.RemoteBuildProviderStatusResponseBody = v4_1.z.object({
    status: v4_1.z.enum(["operational", "degraded", "unknown"]),
    message: v4_1.z.string(),
});
exports.GenerateRegistryCredentialsResponseBody = v4_1.z.object({
    username: v4_1.z.string(),
    password: v4_1.z.string(),
    expiresAt: v4_1.z.string(),
    repositoryUri: v4_1.z.string(),
});
exports.DeploymentErrorData = v4_1.z.object({
    name: v4_1.z.string(),
    message: v4_1.z.string(),
    stack: v4_1.z.string().optional(),
    stderr: v4_1.z.string().optional(),
});
exports.FailDeploymentRequestBody = v4_1.z.object({
    error: exports.DeploymentErrorData,
});
exports.FailDeploymentResponseBody = v4_1.z.object({
    id: v4_1.z.string(),
});
exports.PromoteDeploymentResponseBody = v4_1.z.object({
    id: v4_1.z.string(),
    version: v4_1.z.string(),
    shortCode: v4_1.z.string(),
});
exports.GetDeploymentResponseBody = v4_1.z.object({
    id: v4_1.z.string(),
    status: v4_1.z.enum([
        "PENDING",
        "INSTALLING",
        "BUILDING",
        "DEPLOYING",
        "DEPLOYED",
        "FAILED",
        "CANCELED",
        "TIMED_OUT",
    ]),
    contentHash: v4_1.z.string(),
    shortCode: v4_1.z.string(),
    version: v4_1.z.string(),
    imageReference: v4_1.z.string().nullish(),
    imagePlatform: v4_1.z.string(),
    commitSHA: v4_1.z.string().nullish(),
    /**
     * The `--external-id` this deployment was deployed under, used by version skew
     * protection to pin runs. Distinct from `commitSHA`, which is git metadata.
     *
     * `optional`, not `nullish`, to stay assignable to the CLI's narrower
     * `InitializeDeploymentResponseBody` shape, which this is spread into on the
     * attach-to-existing-deployment path (`cli-v3/src/commands/deploy.ts:1156`).
     */
    externalId: v4_1.z.string().optional(),
    externalBuildData: exports.ExternalBuildData.optional().nullable(),
    errorData: exports.DeploymentErrorData.nullish(),
    canceledReason: v4_1.z.string().nullish(),
    worker: v4_1.z
        .object({
        id: v4_1.z.string(),
        version: v4_1.z.string(),
        tasks: v4_1.z.array(v4_1.z.object({
            id: v4_1.z.string(),
            slug: v4_1.z.string(),
            filePath: v4_1.z.string(),
            exportName: v4_1.z.string().optional(),
        })),
    })
        .optional(),
    integrationDeployments: v4_1.z
        .array(v4_1.z.object({
        id: v4_1.z.string(),
        integrationName: v4_1.z.string(),
        integrationDeploymentId: v4_1.z.string(),
        commitSHA: v4_1.z.string(),
        createdAt: v4_1.z.coerce.date(),
    }))
        .nullish(),
});
// Secret material, deliberately kept off GetDeploymentResponseBody
exports.GetDeploymentBuildEnvVarsResponseBody = v4_1.z.object({
    variables: v4_1.z.record(v4_1.z.string(), v4_1.z.string()),
});
exports.GetLatestDeploymentResponseBody = exports.GetDeploymentResponseBody.omit({
    worker: true,
});
exports.DeploymentLogEvent = v4_1.z.object({
    type: v4_1.z.literal("log"),
    data: v4_1.z.object({
        level: v4_1.z.enum(["debug", "info", "warn", "error"]).optional().default("info"),
        message: v4_1.z.string(),
    }),
});
exports.DeploymentFinalizedEvent = v4_1.z.object({
    type: v4_1.z.literal("finalized"),
    data: v4_1.z.object({
        result: v4_1.z.enum(["succeeded", "failed", "timed_out", "canceled"]).or(anyString),
        message: v4_1.z.string().optional(),
    }),
});
exports.DeploymentEvent = (0, zod_js_1.discriminatedUnion)("type", [
    exports.DeploymentLogEvent,
    exports.DeploymentFinalizedEvent,
]);
exports.DeploymentEventFromString = v4_1.z
    .string()
    .transform((s, ctx) => {
    try {
        return JSON.parse(s);
    }
    catch {
        ctx.addIssue({ code: v4_1.z.ZodIssueCode.custom, message: "Invalid JSON" });
        return v4_1.z.NEVER;
    }
})
    .pipe(exports.DeploymentEvent);
exports.CreateUploadPayloadUrlResponseBody = v4_1.z.object({
    presignedUrl: v4_1.z.string(),
    /** Present on `/api/v2/packets` PUT (upload handshake); omitted on v1 GET download presign. */
    storagePath: v4_1.z.string().optional(),
});
/** One page of a `chat.agent` session transcript, from `GET /api/v1/sessions/{id}/transcript`. */
exports.SessionTranscriptResponseBody = v4_1.z.object({
    messages: v4_1.z.array(v4_1.z.unknown()),
    cursors: v4_1.z
        .object({
        lastOutEventId: v4_1.z.string().optional(),
        lastInEventId: v4_1.z.string().optional(),
    })
        .optional(),
    nextCursor: v4_1.z.string().optional(),
});
exports.WorkersListResponseBody = v4_1.z
    .object({
    type: v4_1.z.string(),
    name: v4_1.z.string(),
    description: v4_1.z.string().nullish(),
    latestVersion: v4_1.z.string().nullish(),
    lastHeartbeatAt: v4_1.z.string().nullish(),
    isDefault: v4_1.z.boolean(),
    updatedAt: v4_1.z.coerce.date(),
})
    .array();
exports.WorkersCreateRequestBody = v4_1.z.object({
    name: v4_1.z.string().optional(),
    description: v4_1.z.string().optional(),
});
exports.WorkersCreateResponseBody = v4_1.z.object({
    workerGroup: v4_1.z.object({
        name: v4_1.z.string(),
        description: v4_1.z.string().nullish(),
    }),
    token: v4_1.z.object({
        plaintext: v4_1.z.string(),
    }),
});
exports.DevConfigResponseBody = v4_1.z.object({
    environmentId: v4_1.z.string(),
    dequeueIntervalWithRun: v4_1.z.number(),
    dequeueIntervalWithoutRun: v4_1.z.number(),
    maxConcurrentRuns: v4_1.z.number(),
    engineUrl: v4_1.z.string(),
});
exports.DevDequeueRequestBody = v4_1.z.object({
    currentWorker: v4_1.z.string(),
    oldWorkers: v4_1.z.string().array(),
    maxResources: runEngine_js_1.MachineResources.optional(),
});
exports.DevDequeueResponseBody = v4_1.z.object({
    dequeuedMessages: runEngine_js_1.DequeuedMessage.array(),
});
exports.DevDisconnectRequestBody = v4_1.z.object({
    runFriendlyIds: v4_1.z.string().array(),
});
exports.DevDisconnectResponseBody = v4_1.z.object({
    cancelled: v4_1.z.number(),
    bulkActionId: v4_1.z.string().optional(),
});
exports.ReplayRunResponse = v4_1.z.object({
    id: v4_1.z.string(),
});
exports.CanceledRunResponse = v4_1.z.object({
    id: v4_1.z.string(),
});
exports.ResetIdempotencyKeyResponse = v4_1.z.object({
    id: v4_1.z.string(),
});
exports.ScheduleType = v4_1.z.union([v4_1.z.literal("DECLARATIVE"), v4_1.z.literal("IMPERATIVE")]);
exports.ScheduledTaskPayload = v4_1.z.object({
    /** The schedule id associated with this run (you can have many schedules for the same task).
      You can use this to remove the schedule, update it, etc */
    scheduleId: v4_1.z.string(),
    /** The type of schedule – `"DECLARATIVE"` or `"IMPERATIVE"`.
     *
     * **DECLARATIVE** – defined inline on your `schedules.task` using the `cron` property. They can only be created, updated or deleted by modifying the `cron` property on your task.
     *
     * **IMPERATIVE** – created using the `schedules.create` functions or in the dashboard.
     */
    type: exports.ScheduleType,
    /** When the task was scheduled to run.
     * Note this will be slightly different from `new Date()` because it takes a few ms to run the task.
     *
     * This date is UTC. To output it as a string with a timezone you would do this:
     * ```ts
     * const formatted = payload.timestamp.toLocaleString("en-US", {
          timeZone: payload.timezone,
      });
      ```  */
    timestamp: v4_1.z.date(),
    /** When the task was last run (it has been).
      This can be undefined if it's never been run. This date is UTC. */
    lastTimestamp: v4_1.z.date().optional(),
    /** You can optionally provide an external id when creating the schedule.
      Usually you would use a userId or some other unique identifier.
      This defaults to undefined if you didn't provide one. */
    externalId: v4_1.z.string().optional(),
    /** The IANA timezone the schedule is set to. The default is UTC.
     * You can see the full list of supported timezones here: https://cloud.trigger.dev/timezones
     */
    timezone: v4_1.z.string(),
    /** The next 5 dates this task is scheduled to run */
    upcoming: v4_1.z.array(v4_1.z.date()),
});
exports.CreateScheduleOptions = v4_1.z.object({
    /** The id of the task you want to attach to. */
    task: v4_1.z.string(),
    /**  The schedule in CRON format.
     *
     * ```txt
  *    *    *    *    *    *
  ┬    ┬    ┬    ┬    ┬
  │    │    │    │    |
  │    │    │    │    └ day of week (0 - 7, 1L - 7L) (0 or 7 is Sun)
  │    │    │    └───── month (1 - 12)
  │    │    └────────── day of month (1 - 31, L)
  │    └─────────────── hour (0 - 23)
  └──────────────────── minute (0 - 59)
     * ```
  
  "L" means the last. In the "day of week" field, 1L means the last Monday of the month. In the day of month field, L means the last day of the month.
  
     */
    cron: v4_1.z.string(),
    /** You can only create one schedule with this key. If you use it twice, the second call will update the schedule.
     *
     * This is required to prevent you from creating duplicate schedules. */
    deduplicationKey: v4_1.z.string(),
    /** Optionally, you can specify your own IDs (like a user ID) and then use it inside the run function of your task.
     *
     * This allows you to have per-user CRON tasks.
     */
    externalId: v4_1.z.string().optional(),
    /** Optionally, you can specify a timezone in the IANA format. If unset it will use UTC.
     * If specified then the CRON will be evaluated in that timezone and will respect daylight savings.
     *
     * If you set the CRON to `0 0 * * *` and the timezone to `America/New_York` then the task will run at midnight in New York time, no matter whether it's daylight savings or not.
     *
     * You can see the full list of supported timezones here: https://cloud.trigger.dev/timezones
     *
     * @example "America/New_York", "Europe/London", "Asia/Tokyo", "Africa/Cairo"
     *
     */
    timezone: v4_1.z.string().optional(),
    /** Optionally delay each occurrence by a stable amount within this window.
     * Absolute windows use whole minutes or hours up to 24 hours and are capped at the next
     * nominal interval. Percentages are relative to each nominal interval.
     *
     * @example "30m", "2h", "24h", "30%", "100%"
     */
    window: schemas_js_1.ScheduleWindow.optional(),
});
exports.UpdateScheduleOptions = exports.CreateScheduleOptions.omit({ deduplicationKey: true });
exports.ScheduleGenerator = v4_1.z.object({
    type: v4_1.z.literal("CRON"),
    expression: v4_1.z.string(),
    description: v4_1.z.string(),
});
exports.ScheduleObject = v4_1.z.object({
    id: v4_1.z.string(),
    type: exports.ScheduleType,
    task: v4_1.z.string(),
    active: v4_1.z.boolean(),
    deduplicationKey: v4_1.z.string().nullish(),
    externalId: v4_1.z.string().nullish(),
    generator: exports.ScheduleGenerator,
    timezone: v4_1.z.string(),
    window: schemas_js_1.ScheduleWindow.optional(),
    /** The next nominal CRON time. */
    nextRun: v4_1.z.coerce.date().nullish(),
    /** The stable assigned time for the next nominal CRON time. */
    nextRunEffectiveAt: v4_1.z.coerce.date().nullish(),
    /**
     * Present when a non-overridable plan policy applies a minimum window to this schedule (e.g.
     * a free-plan schedule's 60-minute minimum). The configured `window` is returned separately
     * and unchanged; this describes the floor applied on top of it.
     */
    appliedSchedulePolicy: v4_1.z
        .object({
        minimumWindowSeconds: v4_1.z.number(),
        reason: v4_1.z.literal("free_schedule"),
    })
        .optional(),
    environments: v4_1.z.array(v4_1.z.object({
        id: v4_1.z.string(),
        type: v4_1.z.string(),
        userName: v4_1.z.string().nullish(),
    })),
});
exports.DeletedScheduleObject = v4_1.z.object({
    id: v4_1.z.string(),
});
exports.ListSchedulesResult = v4_1.z.object({
    data: v4_1.z.array(exports.ScheduleObject),
    pagination: v4_1.z.object({
        currentPage: v4_1.z.number(),
        totalPages: v4_1.z.number(),
        count: v4_1.z.number(),
    }),
});
exports.ListScheduleOptions = v4_1.z.object({
    page: v4_1.z.number().optional(),
    perPage: v4_1.z.number().optional(),
});
exports.TimezonesResult = v4_1.z.object({
    timezones: v4_1.z.array(v4_1.z.string()),
});
exports.RunStatus = v4_1.z.enum([
    /// Task is waiting for a version update because it cannot execute without additional information (task, queue, etc.)
    "PENDING_VERSION",
    /// Task is waiting to be executed by a worker
    "QUEUED",
    /// Task is waiting to be executed by a worker
    "DEQUEUED",
    /// Task is currently being executed by a worker
    "EXECUTING",
    /// Task has been paused by the system, and will be resumed by the system
    "WAITING",
    /// Task has been completed successfully
    "COMPLETED",
    /// Task has been canceled by the user
    "CANCELED",
    /// Task has been completed with errors
    "FAILED",
    /// Task has crashed and won't be retried, most likely the worker ran out of resources, e.g. memory or storage
    "CRASHED",
    /// Task has failed to complete, due to an error in the system
    "SYSTEM_FAILURE",
    /// Task has been scheduled to run at a specific time
    "DELAYED",
    /// Task has expired and won't be executed
    "EXPIRED",
    /// Task has reached it's maxDuration and has been stopped
    "TIMED_OUT",
]);
exports.AttemptStatus = v4_1.z.enum([
    "PENDING",
    "EXECUTING",
    "PAUSED",
    "COMPLETED",
    "FAILED",
    "CANCELED",
]);
exports.RunEnvironmentDetails = v4_1.z.object({
    id: v4_1.z.string(),
    name: v4_1.z.string(),
    user: v4_1.z.string().optional(),
});
exports.RunScheduleDetails = v4_1.z.object({
    id: v4_1.z.string(),
    externalId: v4_1.z.string().optional(),
    deduplicationKey: v4_1.z.string().optional(),
    generator: exports.ScheduleGenerator,
});
exports.TriggerFunction = v4_1.z.enum([
    "triggerAndWait",
    "trigger",
    "batchTriggerAndWait",
    "batchTrigger",
]);
const CommonRunFields = {
    id: v4_1.z.string(),
    status: exports.RunStatus,
    taskIdentifier: v4_1.z.string(),
    idempotencyKey: v4_1.z.string().optional(),
    version: v4_1.z.string().optional(),
    isQueued: v4_1.z.boolean(),
    isExecuting: v4_1.z.boolean(),
    isWaiting: v4_1.z.boolean(),
    isCompleted: v4_1.z.boolean(),
    isSuccess: v4_1.z.boolean(),
    isFailed: v4_1.z.boolean(),
    isCancelled: v4_1.z.boolean(),
    isTest: v4_1.z.boolean(),
    createdAt: v4_1.z.coerce.date(),
    updatedAt: v4_1.z.coerce.date(),
    startedAt: v4_1.z.coerce.date().optional(),
    finishedAt: v4_1.z.coerce.date().optional(),
    delayedUntil: v4_1.z.coerce.date().optional(),
    ttl: v4_1.z.string().optional(),
    expiredAt: v4_1.z.coerce.date().optional(),
    tags: v4_1.z.string().array(),
    costInCents: v4_1.z.number(),
    baseCostInCents: v4_1.z.number(),
    durationMs: v4_1.z.number(),
    metadata: v4_1.z.record(v4_1.z.string(), v4_1.z.any()).optional(),
    taskKind: v4_1.z.string().optional(),
    region: v4_1.z.string().optional(),
};
const RetrieveRunCommandFields = {
    ...CommonRunFields,
    depth: v4_1.z.number(),
    triggerFunction: v4_1.z.enum(["triggerAndWait", "trigger", "batchTriggerAndWait", "batchTrigger"]),
    batchId: v4_1.z.string().optional(),
};
exports.RelatedRunDetails = v4_1.z.object(RetrieveRunCommandFields);
exports.RetrieveRunResponse = v4_1.z.object({
    ...RetrieveRunCommandFields,
    payload: v4_1.z.any().optional(),
    payloadPresignedUrl: v4_1.z.string().optional(),
    output: v4_1.z.any().optional(),
    outputPresignedUrl: v4_1.z.string().optional(),
    error: common_js_1.SerializedError.optional(),
    schedule: exports.RunScheduleDetails.optional(),
    relatedRuns: v4_1.z.object({
        root: exports.RelatedRunDetails.optional(),
        parent: exports.RelatedRunDetails.optional(),
        children: v4_1.z.array(exports.RelatedRunDetails).optional(),
    }),
    attemptCount: v4_1.z.number().default(0),
});
exports.ListRunResponseItem = v4_1.z.object({
    ...CommonRunFields,
    env: exports.RunEnvironmentDetails,
});
exports.ListRunResponse = v4_1.z.object({
    data: v4_1.z.array(exports.ListRunResponseItem),
    pagination: v4_1.z.object({
        next: v4_1.z.string().optional(),
        previous: v4_1.z.string().optional(),
    }),
});
const StringOrStringArray = v4_1.z.union([v4_1.z.string(), v4_1.z.array(v4_1.z.string())]);
const MachineOrMachineArray = v4_1.z.union([common_js_1.MachinePresetName, v4_1.z.array(common_js_1.MachinePresetName)]);
const QueueOrQueueArray = v4_1.z.union([queues_js_1.QueueTypeName, v4_1.z.array(queues_js_1.QueueTypeName)]);
const DateOrNumber = v4_1.z.union([v4_1.z.coerce.date(), v4_1.z.number()]);
const BulkActionFilterRequestBody = v4_1.z
    .object({
    status: v4_1.z.union([exports.RunStatus, v4_1.z.array(exports.RunStatus)]).optional(),
    taskIdentifier: StringOrStringArray.optional(),
    version: StringOrStringArray.optional(),
    from: DateOrNumber.optional(),
    to: DateOrNumber.optional(),
    period: v4_1.z.string().optional(),
    bulkAction: v4_1.z.string().optional(),
    tag: StringOrStringArray.optional(),
    schedule: v4_1.z.string().optional(),
    isTest: v4_1.z.boolean().optional(),
    batch: v4_1.z.string().optional(),
    queue: QueueOrQueueArray.optional(),
    machine: MachineOrMachineArray.optional(),
    region: StringOrStringArray.optional(),
})
    .refine((filter) => Object.values(filter).some(isNonEmptyBulkActionFilterValue), {
    message: "At least one filter must be provided",
});
/** Recursively checks for at least one non-undefined, non-empty value. */
function isNonEmptyBulkActionFilterValue(value) {
    if (value === undefined) {
        return false;
    }
    if (Array.isArray(value)) {
        return value.some(isNonEmptyBulkActionFilterValue);
    }
    if (typeof value === "string") {
        return value.trim().length > 0;
    }
    return true;
}
const BulkActionSelectionRequestBody = {
    filter: BulkActionFilterRequestBody.optional(),
    runIds: v4_1.z.array(v4_1.z.string()).min(1).optional(),
    name: v4_1.z.string().max(255, "Name must be less than 255 characters").optional(),
};
exports.CreateBulkActionRequestBody = (0, zod_js_1.discriminatedUnion)("action", [
    v4_1.z.object({
        action: v4_1.z.literal("cancel"),
        targetRegion: v4_1.z.never().optional(),
        ...BulkActionSelectionRequestBody,
    }),
    v4_1.z.object({
        action: v4_1.z.literal("replay"),
        targetRegion: v4_1.z.string().optional(),
        ...BulkActionSelectionRequestBody,
    }),
]).refine((body) => (body.filter ? 1 : 0) + (body.runIds ? 1 : 0) === 1, {
    message: "Exactly one of filter or runIds must be provided",
});
exports.BulkActionStatus = v4_1.z.enum(["PENDING", "COMPLETED", "ABORTED"]);
exports.BulkActionType = v4_1.z.enum(["CANCEL", "REPLAY"]);
exports.BulkActionObject = v4_1.z.object({
    id: v4_1.z.string(),
    name: v4_1.z.string().optional(),
    type: exports.BulkActionType,
    status: exports.BulkActionStatus,
    counts: v4_1.z.object({
        total: v4_1.z.number(),
        success: v4_1.z.number(),
        failure: v4_1.z.number(),
    }),
    createdAt: v4_1.z.coerce.date(),
    completedAt: v4_1.z.coerce.date().optional(),
});
exports.CreateBulkActionResponseBody = v4_1.z.object({
    id: v4_1.z.string(),
});
exports.AbortBulkActionResponseBody = v4_1.z.object({
    id: v4_1.z.string(),
});
exports.ListBulkActionsResponseBody = v4_1.z.object({
    data: v4_1.z.array(exports.BulkActionObject),
    pagination: v4_1.z.object({
        next: v4_1.z.string().optional(),
        previous: v4_1.z.string().optional(),
    }),
});
exports.CreateEnvironmentVariableRequestBody = v4_1.z.object({
    name: v4_1.z.string(),
    value: v4_1.z.string(),
    // When omitted, the variable defaults to non-secret (the DB default is false).
    isSecret: v4_1.z.boolean().optional(),
});
exports.UpdateEnvironmentVariableRequestBody = v4_1.z.object({
    value: v4_1.z.string(),
});
exports.ImportEnvironmentVariablesRequestBody = v4_1.z.object({
    variables: v4_1.z.record(v4_1.z.string(), v4_1.z.string()),
    parentVariables: v4_1.z.record(v4_1.z.string(), v4_1.z.string()).optional(),
    override: v4_1.z.boolean().optional(),
    // When omitted, variables default to non-secret (the DB default is false).
    isSecret: v4_1.z.boolean().optional(),
    source: (0, zod_js_1.discriminatedUnion)("type", [
        v4_1.z.object({ type: v4_1.z.literal("user"), userId: v4_1.z.string() }),
        v4_1.z.object({ type: v4_1.z.literal("integration"), integration: v4_1.z.string() }),
    ]).optional(),
});
exports.EnvironmentVariableResponseBody = v4_1.z.object({
    success: v4_1.z.boolean(),
});
exports.EnvironmentVariableValue = v4_1.z.object({
    value: v4_1.z.string(),
});
exports.EnvironmentVariable = v4_1.z.object({
    name: v4_1.z.string(),
    value: v4_1.z.string(),
});
exports.EnvironmentVariables = v4_1.z.array(exports.EnvironmentVariable);
exports.EnvironmentVariableWithSecret = v4_1.z.object({
    /** The name of the env var, e.g. `DATABASE_URL` */
    name: v4_1.z.string(),
    /** The value of the env var. If it's a secret, this will be a redacted value, not the real value.  */
    value: v4_1.z.string(),
    /**
     * Whether the env var is a secret or not.
     * When you create env vars you can mark them as secrets.
     *
     * You can't view the value of a secret env var after setting it initially.
     * For a secret env var, the value will be redacted.
     */
    isSecret: v4_1.z.boolean(),
});
exports.UpdateMetadataRequestBody = common_js_1.FlushedRunMetadata;
exports.UpdateMetadataResponseBody = v4_1.z.object({
    metadata: v4_1.z.record(v4_1.z.string(), json_js_1.DeserializedJsonSchema),
});
const RawShapeDate = v4_1.z
    .string()
    .transform((val) => `${val}Z`)
    .pipe(v4_1.z.coerce.date());
const RawOptionalShapeDate = v4_1.z
    .string()
    .nullish()
    .transform((val) => (val ? new Date(`${val}Z`) : val));
exports.SubscribeRunRawShape = v4_1.z.object({
    id: v4_1.z.string(),
    taskIdentifier: v4_1.z.string(),
    friendlyId: v4_1.z.string(),
    status: v4_1.z.string(),
    createdAt: RawShapeDate,
    updatedAt: RawShapeDate,
    startedAt: RawOptionalShapeDate,
    delayUntil: RawOptionalShapeDate,
    queuedAt: RawOptionalShapeDate,
    expiredAt: RawOptionalShapeDate,
    completedAt: RawOptionalShapeDate,
    idempotencyKey: v4_1.z.string().nullish(),
    number: v4_1.z.number().default(0),
    isTest: v4_1.z.boolean().default(false),
    usageDurationMs: v4_1.z.number().default(0),
    costInCents: v4_1.z.number().default(0),
    baseCostInCents: v4_1.z.number().default(0),
    ttl: v4_1.z.string().nullish(),
    payload: v4_1.z.string().nullish(),
    payloadType: v4_1.z.string().nullish(),
    metadata: v4_1.z.string().nullish(),
    metadataType: v4_1.z.string().nullish(),
    output: v4_1.z.string().nullish(),
    outputType: v4_1.z.string().nullish(),
    runTags: v4_1.z.array(v4_1.z.string()).nullish().default([]),
    error: common_js_1.TaskRunError.nullish(),
    realtimeStreams: v4_1.z.array(v4_1.z.string()).nullish().default([]),
});
exports.BatchStatus = v4_1.z.enum([
    "PENDING",
    "PROCESSING",
    "COMPLETED",
    "PARTIAL_FAILED",
    "ABORTED",
]);
exports.RetrieveBatchResponse = v4_1.z.object({
    id: v4_1.z.string(),
    status: exports.BatchStatus,
    idempotencyKey: v4_1.z.string().optional(),
    createdAt: v4_1.z.coerce.date(),
    updatedAt: v4_1.z.coerce.date(),
    runCount: v4_1.z.number(),
    runs: v4_1.z.array(v4_1.z.string()),
});
exports.RetrieveBatchV2Response = v4_1.z.object({
    id: v4_1.z.string(),
    status: exports.BatchStatus,
    idempotencyKey: v4_1.z.string().optional(),
    createdAt: v4_1.z.coerce.date(),
    updatedAt: v4_1.z.coerce.date(),
    runCount: v4_1.z.number(),
    runs: v4_1.z.array(v4_1.z.string()),
    processing: v4_1.z.object({
        completedAt: v4_1.z.coerce.date().optional(),
        errors: v4_1.z.array(v4_1.z.object({
            index: v4_1.z.number(),
            taskIdentifier: v4_1.z.string(),
            error: v4_1.z.string(),
            errorCode: v4_1.z.string().optional(),
        })),
    }),
});
exports.SubscribeRealtimeStreamChunkRawShape = v4_1.z.object({
    id: v4_1.z.string(),
    runId: v4_1.z.string(),
    sequence: v4_1.z.number(),
    key: v4_1.z.string(),
    value: v4_1.z.string(),
    createdAt: v4_1.z.coerce.date(),
});
exports.TimePeriod = v4_1.z.string().or(v4_1.z.coerce.date());
exports.CreateWaitpointTokenRequestBody = v4_1.z.object({
    /**
     * An optional idempotency key for the waitpoint.
     * If you use the same key twice (and the key hasn't expired), you will get the original waitpoint back.
     *
     * Note: This waitpoint may already be complete, in which case when you wait for it, it will immediately continue.
     */
    idempotencyKey: v4_1.z
        .string()
        // Caps user-supplied keys before they reach the unique idempotency index
        // on the underlying table — values past this fail at the database layer
        // rather than returning a clean 400.
        .max(2048, "idempotencyKey must be 2048 characters or less")
        .optional(),
    /**
     * When set, this means the passed in idempotency key will expire after this time.
     * This means after that time if you pass the same idempotency key again, you will get a new waitpoint.
     */
    idempotencyKeyTTL: v4_1.z.string().optional(),
    /** The resume token will timeout after this time.
     * If you are waiting for the token in a run, the token will return a result where `ok` is false.
     *
     * You can pass a `Date` object, or a string in this format: "30s", "1m", "2h", "3d", "4w".
     */
    timeout: exports.TimePeriod.optional(),
    /**
     * Tags to attach to the waitpoint. Tags can be used to filter waitpoints in the dashboard.
     *
     * You can set up to 10 tags per waitpoint, they must be less than 128 characters each.
     *
     * We recommend prefixing tags with a namespace using an underscore or colon, like `user_1234567` or `org:9876543`.
     *
     * @example
     *
     * ```ts
     * await wait.createToken({ tags: ["user:1234567", "org:9876543"] });
     * ```
     */
    tags: exports.RunTags.optional(),
});
exports.CreateWaitpointTokenResponseBody = v4_1.z.object({
    id: v4_1.z.string(),
    isCached: v4_1.z.boolean(),
    url: v4_1.z.string(),
});
exports.CreateInputStreamWaitpointRequestBody = v4_1.z.object({
    streamId: v4_1.z.string(),
    timeout: v4_1.z.string().optional(),
    idempotencyKey: v4_1.z
        .string()
        // Caps user-supplied keys before they reach the unique idempotency index
        // on the underlying table — values past this fail at the database layer
        // rather than returning a clean 400.
        .max(2048, "idempotencyKey must be 2048 characters or less")
        .optional(),
    idempotencyKeyTTL: v4_1.z.string().optional(),
    tags: v4_1.z.union([v4_1.z.string(), v4_1.z.array(v4_1.z.string())]).optional(),
    /**
     * The last S2 sequence number the client has seen on this input stream.
     * Used to check for data that arrived before .wait() was called.
     * If undefined, the server checks from the beginning of the stream.
     */
    lastSeqNum: v4_1.z.number().optional(),
});
exports.CreateInputStreamWaitpointResponseBody = v4_1.z.object({
    waitpointId: v4_1.z.string(),
    isCached: v4_1.z.boolean(),
});
/**
 * Create a run-scoped waitpoint that completes when the next record lands on
 * a Session channel (`.in` or `.out`). Mirrors `CreateInputStreamWaitpointRequestBody`
 * but keyed by `{sessionId, io}` instead of `{runId, streamId}`. The run is
 * still the thing being suspended — Session only supplies the trigger source.
 */
exports.CreateSessionStreamWaitpointRequestBody = v4_1.z.object({
    /** Session friendlyId (`session_*`) or user-supplied externalId. */
    session: v4_1.z.string(),
    io: v4_1.z.enum(["out", "in"]),
    timeout: v4_1.z.string().optional(),
    idempotencyKey: v4_1.z
        .string()
        // Caps user-supplied keys before they reach the unique idempotency index
        // on the underlying table — values past this fail at the database layer
        // rather than returning a clean 400.
        .max(2048, "idempotencyKey must be 2048 characters or less")
        .optional(),
    idempotencyKeyTTL: v4_1.z.string().optional(),
    tags: v4_1.z.union([v4_1.z.string(), v4_1.z.array(v4_1.z.string())]).optional(),
    /**
     * Last S2 sequence number the client has seen on this session channel.
     * Used to catch data that arrived before `.wait()` was called.
     */
    lastSeqNum: v4_1.z.number().optional(),
});
exports.CreateSessionStreamWaitpointResponseBody = v4_1.z.object({
    waitpointId: v4_1.z.string(),
    isCached: v4_1.z.boolean(),
});
exports.waitpointTokenStatuses = ["WAITING", "COMPLETED", "TIMED_OUT"];
exports.WaitpointTokenStatus = v4_1.z.enum(exports.waitpointTokenStatuses);
exports.WaitpointTokenItem = v4_1.z.object({
    id: v4_1.z.string(),
    /** If you make a POST request to this URL, it will complete the waitpoint. */
    url: v4_1.z.string(),
    status: exports.WaitpointTokenStatus,
    completedAt: v4_1.z.coerce.date().optional(),
    completedAfter: v4_1.z.coerce.date().optional(),
    timeoutAt: v4_1.z.coerce.date().optional(),
    idempotencyKey: v4_1.z.string().optional(),
    idempotencyKeyExpiresAt: v4_1.z.coerce.date().optional(),
    tags: v4_1.z.array(v4_1.z.string()),
    createdAt: v4_1.z.coerce.date(),
});
exports.WaitpointListTokenItem = exports.WaitpointTokenItem.omit({
    completedAfter: true,
});
exports.WaitpointRetrieveTokenResponse = exports.WaitpointListTokenItem.and(v4_1.z.object({
    output: v4_1.z.string().optional(),
    outputType: v4_1.z.string().optional(),
    outputIsError: v4_1.z.boolean().optional(),
}));
exports.CompleteWaitpointTokenRequestBody = v4_1.z.object({
    data: v4_1.z.any().nullish(),
});
/**
 * Trigger config persisted on a Session. Drives every run the session
 * schedules — `basePayload` is the customer's wire payload (for
 * chat.agent: `{ chatId, ...clientData }`), runtime fields like
 * `trigger: "preload" | "trigger"` are merged on top per-call by the
 * server's trigger machinery.
 */
exports.SessionTriggerConfig = v4_1.z.object({
    basePayload: v4_1.z.record(v4_1.z.string(), v4_1.z.unknown()),
    machine: common_js_1.MachinePresetName.optional(),
    queue: v4_1.z.string().max(128).optional(),
    tags: v4_1.z.array(v4_1.z.string().max(128)).max(10).optional(),
    maxAttempts: v4_1.z.number().int().positive().max(10).optional(),
    /** Per-run wall-clock cap (seconds). Forwarded to `TaskRunOptions.maxDuration`. */
    maxDuration: v4_1.z.number().int().positive().optional(),
    /** Pin every run to a specific worker version. Forwarded to `TaskRunOptions.lockToVersion`. */
    lockToVersion: v4_1.z.string().optional(),
    /**
     * Pin every run the session schedules to the deployment carrying this id, refreshed by each
     * `sessions.start`. Independent of `lockToVersion`, which wins.
     */
    externalDeploymentId: ExternalDeploymentId,
    /** Region to schedule runs in. Forwarded to `TaskRunOptions.region`. */
    region: v4_1.z.string().optional(),
    /** Convenience field surfaced to chat.agent via the wire payload. */
    idleTimeoutInSeconds: v4_1.z.number().int().positive().max(3600).optional(),
    /** How long a run may sit undequeued before it expires. Forwarded to `TaskRunOptions.ttl`. */
    ttl: v4_1.z.string().or(v4_1.z.number().nonnegative().int()).optional(),
});
/**
 * Request body for `POST /api/v1/sessions`. Creates a Session and
 * triggers its first run. Sessions are task-bound: `taskIdentifier` and
 * `triggerConfig` are required, and re-runs scheduled by the server
 * (after run termination, after `end-and-continue`) reuse the same
 * config.
 */
exports.CreateSessionRequestBody = v4_1.z.object({
    /** Plain string discriminator — e.g. `"chat.agent"`. Not validated against an enum on the server. */
    type: v4_1.z.string().min(1).max(64),
    /** User-supplied idempotency key. Unique per environment. Empty strings are rejected. */
    externalId: v4_1.z
        .string()
        .trim()
        .min(1)
        .max(256)
        .refine((v) => !v.startsWith("session_"), {
        message: "externalId cannot start with 'session_' (reserved prefix for internal friendlyIds)",
    })
        .optional(),
    /** Task this session triggers runs against. Required. */
    taskIdentifier: v4_1.z.string().min(1).max(128),
    /** Trigger config used for every run scheduled by this session. */
    triggerConfig: exports.SessionTriggerConfig,
    /** Up to 10 tags for dashboard filtering. */
    tags: v4_1.z.array(v4_1.z.string().max(128)).max(10).optional(),
    /** Arbitrary JSON metadata. */
    metadata: v4_1.z.record(v4_1.z.string(), v4_1.z.unknown()).optional(),
    /** Absolute expiry timestamp for retention. */
    expiresAt: v4_1.z.coerce.date().optional(),
});
exports.SessionItem = v4_1.z.object({
    id: v4_1.z.string(),
    externalId: v4_1.z.string().nullable(),
    type: v4_1.z.string(),
    taskIdentifier: v4_1.z.string(),
    /**
     * Optional on the wire because some surfaces (the list endpoint backed
     * by ClickHouse, list-page rendering) don't carry triggerConfig.
     * Always populated on `POST /sessions` and `GET /sessions/:id`.
     */
    triggerConfig: exports.SessionTriggerConfig.optional(),
    /**
     * Friendly id of the live run for this session, if any. Optional on
     * the wire — list surfaces may not include it. Routes that emit
     * `SessionItem` are responsible for resolving the friendly form
     * from the underlying cuid before returning.
     */
    currentRunId: v4_1.z.string().nullable().optional(),
    tags: v4_1.z.array(v4_1.z.string()),
    metadata: v4_1.z.record(v4_1.z.string(), v4_1.z.unknown()).nullable(),
    closedAt: v4_1.z.coerce.date().nullable(),
    closedReason: v4_1.z.string().nullable(),
    expiresAt: v4_1.z.coerce.date().nullable(),
    createdAt: v4_1.z.coerce.date(),
    updatedAt: v4_1.z.coerce.date(),
});
exports.CreatedSessionResponseBody = exports.SessionItem.extend({
    /** Friendly id of the first run triggered alongside session create. */
    runId: v4_1.z.string(),
    /** Session-scoped public access token: `read:sessions:{ext} + write:sessions:{ext}`. */
    publicAccessToken: v4_1.z.string(),
    /** True if the session existed already (idempotent upsert), false if newly created. */
    isCached: v4_1.z.boolean(),
    /**
     * The session's live run is parked waiting for a deployment carrying its external deployment
     * id. Messages sent meanwhile are durable. Optional, so older servers read as `false`.
     */
    pendingVersion: v4_1.z.boolean().optional(),
});
exports.RetrieveSessionResponseBody = exports.SessionItem;
/**
 * Body for `POST /api/v1/sessions/:session/end-and-continue`. Used by the
 * running agent to request a clean handoff to a fresh run on the latest
 * deployed version (typical use case: `chat.requestUpgrade`). The
 * server triggers a new run, atomically swaps `currentRunId`, and the
 * caller exits.
 */
exports.EndAndContinueSessionRequestBody = v4_1.z.object({
    /** The friendlyId of the run requesting the handoff. */
    callingRunId: v4_1.z.string(),
    /** Free-form label for the SessionRun audit row. e.g. `"upgrade"`. */
    reason: v4_1.z.string().max(64),
    /**
     * Re-pin the session to this id instead of clearing the pin. Only read when `reason` is
     * `"upgrade"`. `lockToVersion` is never cleared.
     */
    externalDeploymentId: ExternalDeploymentId,
});
exports.EndAndContinueSessionResponseBody = v4_1.z.object({
    /** friendlyId of the run that has taken over the session. */
    runId: v4_1.z.string(),
    /**
     * False when the swap was preempted (a different run was already
     * running by the time we tried to claim). The caller should treat
     * this as "someone else moved on" — exit cleanly without expecting
     * to drive the next run.
     */
    swapped: v4_1.z.boolean(),
    /**
     * The run that took over is parked waiting for its deployment. Surface this so a
     * handoff onto a version that has not landed reads as a deploy in progress rather
     * than a chat that went quiet.
     */
    pendingVersion: v4_1.z.boolean().optional(),
});
exports.UpdateSessionRequestBody = v4_1.z.object({
    tags: v4_1.z.array(v4_1.z.string().max(128)).max(10).optional(),
    metadata: v4_1.z.record(v4_1.z.string(), v4_1.z.unknown()).nullable().optional(),
    // Null explicitly clears the externalId; non-null values must be non-empty.
    externalId: v4_1.z
        .union([
        v4_1.z.literal(null),
        v4_1.z
            .string()
            .trim()
            .min(1)
            .max(256)
            .refine((v) => !v.startsWith("session_"), {
            message: "externalId cannot start with 'session_' (reserved prefix for internal friendlyIds)",
        }),
    ])
        .optional(),
});
exports.CloseSessionRequestBody = v4_1.z.object({
    reason: v4_1.z.string().max(256).optional(),
    /**
     * The friendlyId of the run requesting the close, when the close comes
     * from inside the session's own run (`chat.close()`). That run is already
     * exiting, so the server skips appending the wake-up close record to `.in`
     * for it. Omitted for an external close (dashboard, `sessions.close()`, MCP).
     */
    callingRunId: v4_1.z.string().optional(),
});
exports.SessionStatus = v4_1.z.enum(["ACTIVE", "CLOSED", "EXPIRED"]);
/**
 * Server-side validation schema for `GET /api/v1/sessions`. Follows the same
 * cursor-pagination convention as runs/waitpoints (`page[size]`,
 * `page[after]`, `page[before]`) and uses the `filter[*]` prefix for
 * narrowing fields — both produced automatically by `zodfetchCursorPage`
 * and the matching client-side search-query helper.
 */
exports.ListSessionsQueryParams = v4_1.z
    .object({
    "page[size]": v4_1.z.coerce.number().int().min(1).max(100).default(20),
    "page[after]": v4_1.z.string().optional(),
    "page[before]": v4_1.z.string().optional(),
    "filter[type]": v4_1.z.union([v4_1.z.string(), v4_1.z.array(v4_1.z.string())]).optional(),
    "filter[tags]": v4_1.z.union([v4_1.z.string(), v4_1.z.array(v4_1.z.string())]).optional(),
    "filter[taskIdentifier]": v4_1.z.union([v4_1.z.string(), v4_1.z.array(v4_1.z.string())]).optional(),
    "filter[externalId]": v4_1.z.string().optional(),
    "filter[status]": v4_1.z.union([exports.SessionStatus, v4_1.z.array(exports.SessionStatus)]).optional(),
    "filter[createdAt][period]": v4_1.z.string().optional(),
    "filter[createdAt][from]": v4_1.z.coerce.number().int().optional(),
    "filter[createdAt][to]": v4_1.z.coerce.number().int().optional(),
})
    .refine((value) => !(value["page[after]"] && value["page[before]"]), {
    message: "Cannot pass both page[after] and page[before] on the same request",
    path: ["page[before]"],
});
/**
 * Client-facing list options — flattened shape that
 * {@link ApiClient.listSessions} converts into the `filter[*]` / `page[*]`
 * query string before sending.
 */
exports.ListSessionsOptions = v4_1.z.object({
    limit: v4_1.z.number().int().min(1).max(100).optional(),
    after: v4_1.z.string().optional(),
    before: v4_1.z.string().optional(),
    type: v4_1.z.union([v4_1.z.string(), v4_1.z.array(v4_1.z.string())]).optional(),
    tag: v4_1.z.union([v4_1.z.string(), v4_1.z.array(v4_1.z.string())]).optional(),
    taskIdentifier: v4_1.z.union([v4_1.z.string(), v4_1.z.array(v4_1.z.string())]).optional(),
    externalId: v4_1.z.string().optional(),
    status: v4_1.z.union([exports.SessionStatus, v4_1.z.array(exports.SessionStatus)]).optional(),
    period: v4_1.z.string().optional(),
    from: v4_1.z.union([v4_1.z.number(), v4_1.z.date()]).optional(),
    to: v4_1.z.union([v4_1.z.number(), v4_1.z.date()]).optional(),
});
exports.ListedSessionItem = exports.SessionItem;
exports.ListSessionsResponseBody = v4_1.z.object({
    data: v4_1.z.array(exports.ListedSessionItem),
    pagination: v4_1.z.object({
        next: v4_1.z.string().optional(),
        previous: v4_1.z.string().optional(),
    }),
});
exports.CompleteWaitpointTokenResponseBody = v4_1.z.object({
    success: v4_1.z.literal(true),
});
exports.WaitForWaitpointTokenResponseBody = v4_1.z.object({
    success: v4_1.z.boolean(),
});
exports.WaitForDurationRequestBody = v4_1.z.object({
    /**
     * An optional idempotency key for the waitpoint.
     * If you use the same key twice (and the key hasn't expired), you will get the original waitpoint back.
     *
     * Note: This waitpoint may already be complete, in which case when you wait for it, it will immediately continue.
     */
    idempotencyKey: v4_1.z
        .string()
        // Caps user-supplied keys before they reach the unique idempotency index
        // on the underlying table — values past this fail at the database layer
        // rather than returning a clean 400.
        .max(2048, "idempotencyKey must be 2048 characters or less")
        .optional(),
    /**
     * When set, this means the passed in idempotency key will expire after this time.
     * This means after that time if you pass the same idempotency key again, you will get a new waitpoint.
     */
    idempotencyKeyTTL: v4_1.z.string().optional(),
    /**
     * The date that the waitpoint will complete.
     */
    date: v4_1.z.coerce.date(),
});
exports.WaitForDurationResponseBody = v4_1.z.object({
    /**
        If you pass an idempotencyKey, you may actually not need to wait.
        Use this date to determine when to continue.
    */
    waitUntil: v4_1.z.coerce.date(),
    waitpoint: v4_1.z.object({
        id: v4_1.z.string(),
    }),
});
const WAITPOINT_TIMEOUT_ERROR_CODE = "TRIGGER_WAITPOINT_TIMEOUT";
function isWaitpointOutputTimeout(output) {
    try {
        const json = JSON.parse(output);
        return json.code === WAITPOINT_TIMEOUT_ERROR_CODE;
    }
    catch (_e) {
        return false;
    }
}
function timeoutError(timeout) {
    return {
        code: WAITPOINT_TIMEOUT_ERROR_CODE,
        message: `Waitpoint timed out at ${timeout.toISOString()}`,
    };
}
const ApiDeploymentCommonShape = {
    from: v4_1.z.string().describe("The date to start the search from, in ISO 8601 format").optional(),
    to: v4_1.z.string().describe("The date to end the search, in ISO 8601 format").optional(),
    period: v4_1.z.string().describe("The period to search within (e.g. 1d, 7d, 3h, etc.)").optional(),
    status: v4_1.z
        .enum(["PENDING", "BUILDING", "DEPLOYING", "DEPLOYED", "FAILED", "CANCELED", "TIMED_OUT"])
        .describe("Filter deployments that are in this status")
        .optional(),
};
const ApiDeploymentListPaginationCursor = v4_1.z
    .string()
    .describe("The deployment ID to start the search from, to get the next page")
    .optional();
const ApiDeploymentListPaginationLimit = v4_1.z.coerce
    .number()
    .describe("The number of deployments to return, defaults to 20 (max 100)")
    .min(1, "Limit must be at least 1")
    .max(100, "Limit must be less than 100")
    .optional();
exports.ApiDeploymentListParams = {
    ...ApiDeploymentCommonShape,
    cursor: ApiDeploymentListPaginationCursor,
    limit: ApiDeploymentListPaginationLimit,
};
exports.ApiDeploymentListOptions = v4_1.z.object(exports.ApiDeploymentListParams);
exports.ApiDeploymentListSearchParams = v4_1.z.object({
    ...ApiDeploymentCommonShape,
    "page[after]": ApiDeploymentListPaginationCursor,
    "page[size]": ApiDeploymentListPaginationLimit,
});
exports.ApiDeploymentListResponseItem = v4_1.z.object({
    id: v4_1.z.string(),
    createdAt: v4_1.z.coerce.date(),
    shortCode: v4_1.z.string(),
    version: v4_1.z.string(),
    runtime: v4_1.z.string().nullable(),
    runtimeVersion: v4_1.z.string().nullable(),
    status: v4_1.z.enum([
        "PENDING",
        "BUILDING",
        "DEPLOYING",
        "DEPLOYED",
        "FAILED",
        "CANCELED",
        "TIMED_OUT",
    ]),
    deployedAt: v4_1.z.coerce.date().optional(),
    git: v4_1.z.record(v4_1.z.string(), v4_1.z.any()).optional(),
    error: exports.DeploymentErrorData.optional(),
    /**
     * The `--external-id` this deployment was deployed under, used by version skew
     * protection to pin runs. Nullish on deployments created without one, and on
     * servers older than this field.
     */
    externalId: v4_1.z.string().nullish(),
});
exports.RetrieveCurrentDeploymentResponseBody = exports.ApiDeploymentListResponseItem;
exports.ApiBranchListResponseBody = v4_1.z.object({
    branches: v4_1.z.array(v4_1.z.object({
        id: v4_1.z.string(),
        name: v4_1.z.string(),
        createdAt: v4_1.z.coerce.date(),
        updatedAt: v4_1.z.coerce.date(),
        git: v4_1.z.record(v4_1.z.string(), v4_1.z.any()).optional(),
        isPaused: v4_1.z.boolean(),
    })),
});
exports.RetrieveRunTraceSpanSchema = v4_1.z.object({
    id: v4_1.z.string(),
    parentId: v4_1.z.string().optional(),
    runId: v4_1.z.string(),
    data: v4_1.z.object({
        message: v4_1.z.string(),
        taskSlug: v4_1.z.string().optional(),
        taskPath: v4_1.z.string().optional(),
        events: v4_1.z.array(v4_1.z.any()).optional(),
        startTime: v4_1.z.coerce.date(),
        duration: v4_1.z.number(),
        isError: v4_1.z.boolean(),
        isPartial: v4_1.z.boolean(),
        isCancelled: v4_1.z.boolean(),
        level: v4_1.z.string(),
        workerVersion: v4_1.z.string().optional(),
        queueName: v4_1.z.string().optional(),
        machinePreset: v4_1.z.string().optional(),
        properties: v4_1.z.record(v4_1.z.string(), v4_1.z.any()).optional(),
        output: v4_1.z.unknown().optional(),
    }),
});
exports.RetrieveRunTraceSpan = exports.RetrieveRunTraceSpanSchema.extend({
    children: v4_1.z.lazy(() => exports.RetrieveRunTraceSpan.array()),
});
exports.RetrieveRunTraceResponseBody = v4_1.z.object({
    trace: v4_1.z.object({
        traceId: v4_1.z.string(),
        rootSpan: exports.RetrieveRunTraceSpan,
    }),
});
exports.RetrieveSpanDetailResponseBody = v4_1.z.object({
    spanId: v4_1.z.string(),
    parentId: v4_1.z.string().nullable(),
    runId: v4_1.z.string(),
    message: v4_1.z.string(),
    isError: v4_1.z.boolean(),
    isPartial: v4_1.z.boolean(),
    isCancelled: v4_1.z.boolean(),
    level: v4_1.z.string(),
    startTime: v4_1.z.coerce.date(),
    durationMs: v4_1.z.number(),
    properties: v4_1.z.record(v4_1.z.string(), v4_1.z.any()).optional(),
    events: v4_1.z.array(v4_1.z.any()).optional(),
    entityType: v4_1.z.string().optional(),
    ai: v4_1.z
        .object({
        model: v4_1.z.string(),
        provider: v4_1.z.string(),
        operationName: v4_1.z.string(),
        inputTokens: v4_1.z.number(),
        outputTokens: v4_1.z.number(),
        totalTokens: v4_1.z.number(),
        cachedTokens: v4_1.z.number().optional(),
        reasoningTokens: v4_1.z.number().optional(),
        inputCost: v4_1.z.number().optional(),
        outputCost: v4_1.z.number().optional(),
        totalCost: v4_1.z.number().optional(),
        cachedCost: v4_1.z.number().optional(),
        cacheCreationCost: v4_1.z.number().optional(),
        tokensPerSecond: v4_1.z.number().optional(),
        msToFirstChunk: v4_1.z.number().optional(),
        durationMs: v4_1.z.number(),
        finishReason: v4_1.z.string().optional(),
        responseText: v4_1.z.string().optional(),
    })
        .optional(),
    triggeredRuns: v4_1.z
        .array(v4_1.z.object({
        runId: v4_1.z.string(),
        taskIdentifier: v4_1.z.string(),
        status: v4_1.z.string(),
        createdAt: v4_1.z.coerce.date(),
    }))
        .optional(),
});
exports.CreateStreamResponseBody = v4_1.z.object({
    version: v4_1.z.string(),
});
exports.AppendToStreamResponseBody = v4_1.z.object({
    ok: v4_1.z.boolean(),
    message: v4_1.z.string().optional(),
});
exports.SendInputStreamResponseBody = v4_1.z.object({
    ok: v4_1.z.boolean(),
});
/**
 * Response body for `GET /realtime/v1/sessions/:id/:io/records`. A non-SSE,
 * `wait=0` drain of a session channel — used at run boot for snapshot
 * replay where the SSE long-poll tax (~1s on empty streams) was the
 * dominant cost.
 *
 * `data` is the parsed chunk body (the SDK writer puts the chunk object
 * directly into the S2 record envelope; the route unwraps the envelope
 * and forwards the inner object as-is). Callers use it directly — no
 * additional JSON.parse step. Schema is `z.unknown()` because chunk
 * shape varies by `chunk.type` (the AI SDK's `UIMessageChunk`
 * discriminated union plus Trigger control records); consumers
 * already runtime-check on the discriminator and tolerate malformed
 * records by skipping them.
 */
exports.ReadSessionStreamRecordsResponseBody = v4_1.z.object({
    records: v4_1.z.array(v4_1.z.object({
        data: v4_1.z.unknown(),
        id: v4_1.z.string(),
        seqNum: v4_1.z.number(),
        // S2 record headers — present on Trigger control records (e.g.
        // `trigger-control: turn-complete` plus sibling headers). The
        // server has always serialized them; older schemas stripped them
        // client-side, so treat as optional.
        headers: v4_1.z.array(v4_1.z.tuple([v4_1.z.string(), v4_1.z.string()])).optional(),
    })),
});
exports.ResolvePromptRequestBody = v4_1.z.object({
    variables: v4_1.z.record(v4_1.z.string(), v4_1.z.unknown()).default({}),
    label: v4_1.z.string().optional(),
    version: v4_1.z.number().optional(),
});
exports.ResolvePromptResponseBody = v4_1.z.object({
    data: v4_1.z.object({
        promptId: v4_1.z.string(),
        slug: v4_1.z.string(),
        version: v4_1.z.number(),
        labels: v4_1.z.array(v4_1.z.string()),
        template: v4_1.z.string().optional(),
        text: v4_1.z.string().optional(),
        model: v4_1.z.string().optional().nullable(),
        config: v4_1.z.record(v4_1.z.string(), v4_1.z.unknown()).optional().nullable(),
    }),
});
exports.ListPromptsResponseBody = v4_1.z.object({
    data: v4_1.z.array(v4_1.z.object({
        slug: v4_1.z.string(),
        friendlyId: v4_1.z.string(),
        description: v4_1.z.string().nullable(),
        tags: v4_1.z.array(v4_1.z.string()),
        defaultModel: v4_1.z.string().nullable(),
        currentVersion: v4_1.z.number().nullable(),
        hasOverride: v4_1.z.boolean(),
        updatedAt: v4_1.z.string(),
    })),
});
exports.ListPromptVersionsResponseBody = v4_1.z.object({
    data: v4_1.z.array(v4_1.z.object({
        id: v4_1.z.string(),
        version: v4_1.z.number(),
        labels: v4_1.z.array(v4_1.z.string()),
        source: v4_1.z.string(),
        model: v4_1.z.string().nullable(),
        textContent: v4_1.z.string().nullable(),
        commitMessage: v4_1.z.string().nullable(),
        contentHash: v4_1.z.string(),
        createdAt: v4_1.z.string(),
    })),
});
exports.PromotePromptVersionRequestBody = v4_1.z.object({
    version: v4_1.z.number().int().positive(),
});
exports.CreatePromptOverrideRequestBody = v4_1.z.object({
    textContent: v4_1.z.string(),
    model: v4_1.z.string().optional(),
    commitMessage: v4_1.z.string().optional(),
    source: v4_1.z.string().optional(),
});
exports.UpdatePromptOverrideRequestBody = v4_1.z.object({
    textContent: v4_1.z.string().optional(),
    model: v4_1.z.string().optional(),
    commitMessage: v4_1.z.string().optional(),
});
exports.ReactivatePromptOverrideRequestBody = v4_1.z.object({
    version: v4_1.z.number().int().positive(),
});
exports.PromptOkResponseBody = v4_1.z.object({ ok: v4_1.z.boolean() });
exports.PromptOverrideCreatedResponseBody = v4_1.z.object({
    ok: v4_1.z.boolean(),
    version: v4_1.z.number(),
});
//# sourceMappingURL=api.js.map