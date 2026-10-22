"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaxDurationExceededError = exports.ChatChunkTooLargeError = exports.GracefulExitTimeoutError = exports.SigKillTimeoutProcessError = exports.CancelledProcessError = exports.SuspendedProcessError = exports.CleanupProcessError = exports.UnexpectedExitError = exports.DuplicateTaskIdsError = exports.TaskIndexingImportError = exports.TaskMetadataParseError = exports.UncaughtExceptionError = exports.CompleteTaskWithOutput = exports.TaskPayloadParsedError = exports.OutOfMemoryError = exports.AbortTaskRunError = exports.InternalError = void 0;
exports.isInternalError = isInternalError;
exports.isManualOutOfMemoryError = isManualOutOfMemoryError;
exports.isOOMRunError = isOOMRunError;
exports.isCompleteTaskWithOutput = isCompleteTaskWithOutput;
exports.truncateStack = truncateStack;
exports.truncateMessage = truncateMessage;
exports.createErrorFromCauses = createErrorFromCauses;
exports.formatErrorCauses = formatErrorCauses;
exports.parseError = parseError;
exports.createErrorTaskError = createErrorTaskError;
exports.createJsonErrorObject = createJsonErrorObject;
exports.sanitizeError = sanitizeError;
exports.shouldRetryError = shouldRetryError;
exports.shouldLookupRetrySettings = shouldLookupRetrySettings;
exports.correctErrorStackTrace = correctErrorStackTrace;
exports.groupTaskMetadataIssuesByTask = groupTaskMetadataIssuesByTask;
exports.isChatChunkTooLargeError = isChatChunkTooLargeError;
exports.taskRunErrorEnhancer = taskRunErrorEnhancer;
exports.exceptionEventEnhancer = exceptionEventEnhancer;
exports.internalErrorFromUnexpectedExit = internalErrorFromUnexpectedExit;
exports.serializeIndexingError = serializeIndexingError;
exports.prepareDeploymentError = prepareDeploymentError;
exports.createTaskMetadataFailedErrorStack = createTaskMetadataFailedErrorStack;
exports.taskRunErrorToString = taskRunErrorToString;
const build_js_1 = require("./schemas/build.js");
const common_js_1 = require("./schemas/common.js");
const messages_js_1 = require("./schemas/messages.js");
const links_js_1 = require("./links.js");
const utils_js_1 = require("../utils.js");
/**
 * If you throw this, it will get converted into an INTERNAL_ERROR
 */
class InternalError extends Error {
    code;
    skipRetrying;
    constructor({ code, message, showStackTrace = true, skipRetrying = false, }) {
        super(`${code}: ${message ?? "No message"}`);
        this.name = "TriggerInternalError";
        this.code = code;
        this.message = message ?? "InternalError";
        if (!showStackTrace) {
            this.stack = undefined;
        }
        this.skipRetrying = skipRetrying;
    }
}
exports.InternalError = InternalError;
function isInternalError(error) {
    return error instanceof Error && error.name === "TriggerInternalError";
}
class AbortTaskRunError extends Error {
    constructor(message) {
        super(message);
        this.name = "AbortTaskRunError";
    }
}
exports.AbortTaskRunError = AbortTaskRunError;
const MANUAL_OOM_KILL_ERROR_MESSAGE = "MANUAL_OOM_KILL_ERROR";
/**
 * This causes an Out Of Memory error on the run (if it's uncaught).
 * This can be useful if you use a native package that detects it's run out of memory but doesn't kill Node.js
 */
class OutOfMemoryError extends Error {
    constructor() {
        super(MANUAL_OOM_KILL_ERROR_MESSAGE);
        this.name = "OutOfMemoryError";
    }
}
exports.OutOfMemoryError = OutOfMemoryError;
function isManualOutOfMemoryError(error) {
    if (error.type === "BUILT_IN_ERROR") {
        if (error.message && error.message === MANUAL_OOM_KILL_ERROR_MESSAGE) {
            return true;
        }
    }
    return false;
}
function isOOMRunError(error) {
    if (error.type === "INTERNAL_ERROR") {
        if (error.code === "TASK_PROCESS_OOM_KILLED" ||
            error.code === "TASK_PROCESS_MAYBE_OOM_KILLED") {
            return true;
        }
        // For the purposes of retrying on a larger machine, we're going to treat this is an OOM error.
        // This is what they look like if we're executing using k8s. They then get corrected later, but it's too late.
        // {"code": "TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE", "type": "INTERNAL_ERROR", "message": "Process exited with code -1 after signal SIGKILL."}
        if (error.code === "TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE" &&
            error.message &&
            error.message.includes("-1")) {
            if (error.message.includes("SIGKILL")) {
                return true;
            }
            if (error.message.includes("SIGABRT") && error.stackTrace) {
                const oomIndicators = [
                    "JavaScript heap out of memory",
                    "Reached heap limit",
                    "FATAL ERROR: Reached heap limit Allocation failed",
                ];
                if (oomIndicators.some((indicator) => error.stackTrace.includes(indicator))) {
                    return true;
                }
            }
        }
    }
    if (error.type === "BUILT_IN_ERROR") {
        // ffmpeg also does weird stuff
        // { "name": "Error", "type": "BUILT_IN_ERROR", "message": "ffmpeg was killed with signal SIGKILL" }
        if (error.message && error.message.includes("ffmpeg was killed with signal SIGKILL")) {
            return true;
        }
    }
    // Special `OutOfMemoryError` for doing a manual OOM kill.
    // Useful if a native library does an OOM but doesn't actually crash the run and you want to manually
    if (isManualOutOfMemoryError(error)) {
        return true;
    }
    return false;
}
class TaskPayloadParsedError extends Error {
    cause;
    constructor(cause) {
        const causeMessage = cause instanceof Error ? cause.message : String(cause);
        super("Parsing payload with schema failed: " + causeMessage);
        this.name = "TaskPayloadParsedError";
        this.cause = cause;
    }
}
exports.TaskPayloadParsedError = TaskPayloadParsedError;
class CompleteTaskWithOutput extends Error {
    output;
    constructor(output) {
        super("Complete task with output");
        this.name = "CompleteTaskWithOutput";
        this.output = output;
    }
}
exports.CompleteTaskWithOutput = CompleteTaskWithOutput;
function isCompleteTaskWithOutput(error) {
    return error instanceof Error && error.name === "CompleteTaskWithOutput";
}
const MAX_STACK_FRAMES = 50;
const KEEP_TOP_FRAMES = 5;
const MAX_STACK_LINE_LENGTH = 1024;
const MAX_MESSAGE_LENGTH = 1_000;
const MAX_ERROR_CAUSES = 5;
/** Causes are supplementary, and there can be MAX_ERROR_CAUSES of them, so they get a
 *  much tighter frame budget than the error that was actually thrown. */
const MAX_CAUSE_STACK_FRAMES = 10;
/** An error name is a class name in practice, so anything longer is junk that
 *  would otherwise ride along untruncated, once per cause. */
const MAX_ERROR_NAME_LENGTH = 256;
function truncateName(name) {
    if (!name)
        return undefined;
    return name.length > MAX_ERROR_NAME_LENGTH ? name.slice(0, MAX_ERROR_NAME_LENGTH) : name;
}
/** Truncate a stack trace to at most MAX_STACK_FRAMES frames, keeping
 *  the top (closest to throw) and bottom (entry points) frames.
 *  Individual lines (including message lines) are capped at MAX_STACK_LINE_LENGTH
 *  to prevent OOM from huge error messages embedded in the stack. */
function truncateStack(stack, maxFrames = MAX_STACK_FRAMES) {
    if (!stack)
        return "";
    const lines = stack.split("\n");
    // First line(s) before the first frame are the error message
    const messageLines = [];
    const frameLines = [];
    for (const line of lines) {
        const safe = line.length > MAX_STACK_LINE_LENGTH
            ? line.slice(0, MAX_STACK_LINE_LENGTH) + "...[truncated]"
            : line;
        if (frameLines.length === 0 && !line.trimStart().startsWith("at ")) {
            messageLines.push(safe);
        }
        else {
            frameLines.push(safe);
        }
    }
    if (frameLines.length <= maxFrames) {
        return [...messageLines, ...frameLines].join("\n");
    }
    const keepTop = Math.min(KEEP_TOP_FRAMES, maxFrames);
    const keepBottom = maxFrames - keepTop;
    const omitted = frameLines.length - maxFrames;
    return [
        ...messageLines,
        ...frameLines.slice(0, keepTop),
        `    ... ${omitted} frames omitted ...`,
        ...(keepBottom > 0 ? frameLines.slice(-keepBottom) : []),
    ].join("\n");
}
function truncateMessage(message) {
    if (!message)
        return "";
    return message.length > MAX_MESSAGE_LENGTH
        ? message.slice(0, MAX_MESSAGE_LENGTH) + "...[truncated]"
        : message;
}
/** Serialize one `cause` value. A cause is arbitrary user data, so every step here
 *  can throw: `instanceof` and property reads run Proxy traps, and JSON.stringify
 *  and String both throw on some values. Losing a cause is acceptable; throwing
 *  would lose the whole error report. Returns undefined for a cause that carries
 *  nothing worth rendering. */
function serializeErrorCause(cause) {
    try {
        if (cause instanceof Error) {
            const name = truncateName(cause.name);
            const message = truncateMessage(cause.message);
            const stackTrace = truncateStack(cause.stack, MAX_CAUSE_STACK_FRAMES) || undefined;
            return name || message || stackTrace ? { name, message, stackTrace } : undefined;
        }
        if (typeof cause === "string") {
            return cause ? { message: truncateMessage(cause) } : undefined;
        }
        try {
            const json = JSON.stringify(cause);
            if (json !== undefined) {
                return { message: truncateMessage(json) };
            }
        }
        catch (_e) {
            /** fall through to the coercion attempt */
        }
        return { message: truncateMessage(String(cause)) };
    }
    catch (_e) {
        return { message: `[unserializable ${typeof cause} cause]` };
    }
}
/** Reading `.cause` runs `instanceof` and a property get, either of which can throw
 *  on a hostile or revoked Proxy. Stop the walk instead of aborting the report. */
function readErrorCause(value) {
    try {
        return value instanceof Error ? value.cause : undefined;
    }
    catch (_e) {
        return undefined;
    }
}
/** Flatten an error's `cause` chain, outermost first. Bounded by MAX_ERROR_CAUSES
 *  and guarded against cycles, since a cause chain is attacker- (or accident-) shaped. */
function extractErrorCauses(error) {
    const causes = [];
    const seen = new Set([error]);
    let current = readErrorCause(error);
    /** Every link visited counts against the cap, including ones that serialize to
     *  nothing, so a chain of empty causes cannot extend the walk. */
    for (let i = 0; i < MAX_ERROR_CAUSES && current !== undefined && current !== null; i++) {
        if (typeof current === "object") {
            if (seen.has(current)) {
                break;
            }
            seen.add(current);
        }
        const cause = serializeErrorCause(current);
        if (cause) {
            causes.push(cause);
        }
        current = readErrorCause(current);
    }
    return causes.length > 0 ? causes : undefined;
}
/** Rebuild a native `cause` chain from the flattened form, innermost first. */
function createErrorFromCauses(causes) {
    let current;
    for (let i = causes.length - 1; i >= 0; i--) {
        const cause = causes[i];
        const error = new Error(cause.message, current ? { cause: current } : undefined);
        if (cause.name) {
            error.name = cause.name;
        }
        error.stack = cause.stackTrace || [cause.name, cause.message].filter(Boolean).join(": ");
        current = error;
    }
    return current;
}
/** Render a flattened cause chain the way Node prints one. `stackTrace` opts into the
 *  full frames; without it each cause is a single "Caused by:" line. */
function formatErrorCauses(causes, options) {
    if (!causes || causes.length === 0) {
        return "";
    }
    return causes
        .map((cause) => {
        if (options?.stackTrace && cause.stackTrace) {
            return `\n\nCaused by: ${cause.stackTrace}`;
        }
        const label = [cause.name, cause.message].filter(Boolean).join(": ");
        return label ? `\nCaused by: ${label}` : "";
    })
        .join("");
}
function parseError(error) {
    if (isInternalError(error)) {
        return {
            type: "INTERNAL_ERROR",
            code: error.code,
            message: truncateMessage(error.message),
            stackTrace: truncateStack(error.stack),
        };
    }
    if (error instanceof Error) {
        const causes = extractErrorCauses(error);
        return {
            type: "BUILT_IN_ERROR",
            name: error.name,
            message: truncateMessage(error.message),
            stackTrace: truncateStack(error.stack),
            ...(causes ? { causes } : {}),
        };
    }
    if (typeof error === "string") {
        return {
            type: "STRING_ERROR",
            raw: error,
        };
    }
    try {
        return {
            type: "CUSTOM_ERROR",
            raw: JSON.stringify(error),
        };
    }
    catch (_e) {
        return {
            type: "CUSTOM_ERROR",
            raw: String(error),
        };
    }
}
function createErrorTaskError(error) {
    switch (error.type) {
        case "BUILT_IN_ERROR": {
            const cause = error.causes?.length ? createErrorFromCauses(error.causes) : undefined;
            const e = new Error(error.message, cause ? { cause } : undefined);
            e.name = error.name;
            e.stack = error.stackTrace;
            return e;
        }
        case "STRING_ERROR": {
            return error.raw;
        }
        case "CUSTOM_ERROR": {
            return JSON.parse(error.raw);
        }
        case "INTERNAL_ERROR": {
            const e = new Error(error.message ?? `Internal error (${error.code})`);
            e.name = error.code;
            e.stack = error.stackTrace;
            return e;
        }
    }
}
function createJsonErrorObject(error) {
    const enhancedError = taskRunErrorEnhancer(error);
    switch (enhancedError.type) {
        case "BUILT_IN_ERROR": {
            return {
                name: enhancedError.name,
                message: enhancedError.message,
                stackTrace: enhancedError.stackTrace,
                ...(enhancedError.causes?.length ? { causes: enhancedError.causes } : {}),
            };
        }
        case "STRING_ERROR": {
            return {
                message: enhancedError.raw,
            };
        }
        case "CUSTOM_ERROR": {
            return {
                message: enhancedError.raw,
            };
        }
        case "INTERNAL_ERROR": {
            return {
                message: `trigger.dev internal error (${enhancedError.code})`,
            };
        }
    }
}
function sanitizeErrorCauses(causes) {
    if (!causes || causes.length === 0) {
        return undefined;
    }
    return causes.slice(0, MAX_ERROR_CAUSES).map((cause) => ({
        name: truncateName(cause.name?.replace(/\0/g, "")),
        message: truncateMessage(cause.message?.replace(/\0/g, "")),
        stackTrace: cause.stackTrace
            ? truncateStack(cause.stackTrace.replace(/\0/g, ""), MAX_CAUSE_STACK_FRAMES) || undefined
            : undefined,
    }));
}
// Removes null characters and truncates oversized fields to prevent OOM
function sanitizeError(error) {
    switch (error.type) {
        case "BUILT_IN_ERROR": {
            const causes = sanitizeErrorCauses(error.causes);
            return {
                type: "BUILT_IN_ERROR",
                message: truncateMessage(error.message?.replace(/\0/g, "")),
                name: error.name?.replace(/\0/g, ""),
                stackTrace: truncateStack(error.stackTrace?.replace(/\0/g, "")),
                ...(causes ? { causes } : {}),
            };
        }
        case "STRING_ERROR": {
            return {
                type: "STRING_ERROR",
                raw: truncateMessage(error.raw.replace(/\0/g, "")),
            };
        }
        case "CUSTOM_ERROR": {
            // CUSTOM_ERROR.raw holds JSON.stringify(error) which is later parsed by
            // JSON.parse in createErrorTaskError. Naive truncation would cut mid-token
            // and produce invalid JSON — wrap the preview in a valid JSON envelope.
            const clean = error.raw.replace(/\0/g, "");
            const safeRaw = clean.length > MAX_MESSAGE_LENGTH
                ? JSON.stringify({ truncated: true, preview: clean.slice(0, MAX_MESSAGE_LENGTH) })
                : clean;
            return {
                type: "CUSTOM_ERROR",
                raw: safeRaw,
            };
        }
        case "INTERNAL_ERROR": {
            // message and stackTrace are optional for INTERNAL_ERROR — preserve
            // `undefined` so the `error.message ?? "Internal error (CODE)"` fallback
            // in createErrorTaskError still kicks in (empty string is not nullish).
            return {
                type: "INTERNAL_ERROR",
                code: error.code,
                message: error.message != null ? truncateMessage(error.message.replace(/\0/g, "")) : undefined,
                stackTrace: error.stackTrace != null ? truncateStack(error.stackTrace.replace(/\0/g, "")) : undefined,
            };
        }
    }
}
function shouldRetryError(error) {
    switch (error.type) {
        case "INTERNAL_ERROR": {
            switch (error.code) {
                case "COULD_NOT_FIND_EXECUTOR":
                case "COULD_NOT_FIND_TASK":
                case "COULD_NOT_IMPORT_TASK":
                case "CONFIGURED_INCORRECTLY":
                case "TASK_ALREADY_RUNNING":
                case "TASK_PROCESS_SIGKILL_TIMEOUT":
                case "TASK_PROCESS_OOM_KILLED":
                case "TASK_PROCESS_MAYBE_OOM_KILLED":
                case "TASK_RUN_CANCELLED":
                case "MAX_DURATION_EXCEEDED":
                case "DISK_SPACE_EXCEEDED":
                case "OUTDATED_SDK_VERSION":
                case "TASK_RUN_HEARTBEAT_TIMEOUT":
                case "TASK_DID_CONCURRENT_WAIT":
                case "RECURSIVE_WAIT_DEADLOCK":
                // run engine errors
                case "TASK_DEQUEUED_INVALID_STATE":
                case "TASK_DEQUEUED_QUEUE_NOT_FOUND":
                case "TASK_HAS_N0_EXECUTION_SNAPSHOT":
                case "TASK_RUN_DEQUEUED_MAX_RETRIES":
                case "BATCH_ITEM_COULD_NOT_TRIGGER":
                case "PAYLOAD_TOO_LARGE":
                case "UNSPECIFIED_ERROR":
                    return false;
                //new heartbeat error
                //todo
                case "TASK_RUN_STALLED_EXECUTING":
                case "TASK_RUN_STALLED_EXECUTING_WITH_WAITPOINTS":
                case "GRACEFUL_EXIT_TIMEOUT":
                case "HANDLE_ERROR_ERROR":
                case "TASK_INPUT_ERROR":
                case "TASK_OUTPUT_ERROR":
                case "TASK_MIDDLEWARE_ERROR":
                case "POD_EVICTED":
                case "POD_UNKNOWN_ERROR":
                case "TASK_EXECUTION_ABORTED":
                case "TASK_EXECUTION_FAILED":
                case "TASK_RUN_CRASHED":
                case "TASK_RUN_UNCAUGHT_EXCEPTION":
                case "TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE":
                case "TASK_PROCESS_SIGTERM":
                case "TASK_PROCESS_SIGSEGV":
                    return true;
                default:
                    (0, utils_js_1.assertExhaustive)(error.code);
            }
        }
        case "STRING_ERROR": {
            return true;
        }
        case "BUILT_IN_ERROR": {
            return true;
        }
        case "CUSTOM_ERROR": {
            return true;
        }
        default: {
            (0, utils_js_1.assertExhaustive)(error);
        }
    }
}
function shouldLookupRetrySettings(error) {
    switch (error.type) {
        case "INTERNAL_ERROR": {
            switch (error.code) {
                case "TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE":
                case "TASK_PROCESS_SIGTERM":
                case "TASK_PROCESS_SIGSEGV":
                case "TASK_RUN_UNCAUGHT_EXCEPTION":
                case "TASK_MIDDLEWARE_ERROR":
                    return true;
                default:
                    return false;
            }
        }
        case "STRING_ERROR": {
            return false;
        }
        case "BUILT_IN_ERROR": {
            return false;
        }
        case "CUSTOM_ERROR": {
            return false;
        }
        default: {
            (0, utils_js_1.assertExhaustive)(error);
        }
    }
}
function correctErrorStackTrace(stackTrace, projectDir, options) {
    const [errorLine, ...traceLines] = stackTrace.split("\n");
    return [
        options?.removeFirstLine ? undefined : errorLine,
        ...traceLines.map((line) => correctStackTraceLine(line, projectDir, options?.isDev)),
    ]
        .filter(Boolean)
        .join("\n");
}
const LINES_TO_IGNORE = [
    /ConsoleInterceptor/,
    /TriggerTracer/,
    /TaskExecutor/,
    /EXECUTE_TASK_RUN/,
    /@trigger.dev\/core/,
    /packages\/core\/src\/v3/,
    /safeJsonProcess/,
    /__entryPoint.ts/,
    /ZodIpc/,
    /startActiveSpan/,
    /processTicksAndRejections/,
];
function correctStackTraceLine(line, projectDir, isDev) {
    if (LINES_TO_IGNORE.some((regex) => regex.test(line))) {
        return;
    }
    // Check to see if the path is inside the project directory
    if (isDev && projectDir && !line.includes(projectDir)) {
        return;
    }
    return line.trim();
}
function groupTaskMetadataIssuesByTask(tasks, issues) {
    return issues.reduce((acc, issue) => {
        if (issue.path.length === 0) {
            return acc;
        }
        const taskIndex = issue.path[2];
        if (typeof taskIndex !== "number") {
            return acc;
        }
        const task = tasks[taskIndex];
        if (!task) {
            return acc;
        }
        const restOfPath = issue.path.slice(3);
        const taskId = task.id;
        const taskName = task.exportName;
        const filePath = task.filePath;
        const key = taskIndex;
        const existing = acc[key] ?? {
            id: taskId,
            exportName: taskName,
            filePath,
            issues: [],
        };
        existing.issues.push({
            message: issue.message,
            path: restOfPath.length === 0 ? undefined : restOfPath.join("."),
        });
        return {
            ...acc,
            [key]: existing,
        };
    }, {});
}
class UncaughtExceptionError extends Error {
    originalError;
    origin;
    constructor(originalError, origin) {
        super(`Uncaught exception: ${originalError.message}`);
        this.originalError = originalError;
        this.origin = origin;
        this.name = "UncaughtExceptionError";
    }
}
exports.UncaughtExceptionError = UncaughtExceptionError;
class TaskMetadataParseError extends Error {
    zodIssues;
    tasks;
    constructor(zodIssues, tasks) {
        super(`Failed to parse task metadata`);
        this.zodIssues = zodIssues;
        this.tasks = tasks;
        this.name = "TaskMetadataParseError";
    }
}
exports.TaskMetadataParseError = TaskMetadataParseError;
class TaskIndexingImportError extends Error {
    importErrors;
    manifest;
    constructor(importErrors, manifest) {
        super(`Failed to import some task files`);
        this.importErrors = importErrors;
        this.manifest = manifest;
        this.name = "TaskIndexingImportError";
    }
}
exports.TaskIndexingImportError = TaskIndexingImportError;
function formatDuplicateTaskIds(collisions) {
    const lines = collisions.map(({ id, filePaths }) => {
        const distinct = Array.from(new Set(filePaths));
        if (distinct.length === 1) {
            return `  - "${id}" found more than once in ${distinct[0]}`;
        }
        const last = distinct[distinct.length - 1];
        const head = distinct.slice(0, -1).join(", ");
        return `  - "${id}" found in ${head} and ${last}`;
    });
    return [
        "Duplicate task ids detected:",
        "",
        ...lines,
        "",
        "Task ids must be unique across your project (including scheduled tasks). Please rename one of them.",
    ].join("\n");
}
class DuplicateTaskIdsError extends Error {
    collisions;
    constructor(collisions) {
        super(formatDuplicateTaskIds(collisions));
        this.collisions = collisions;
        this.name = "DuplicateTaskIdsError";
    }
}
exports.DuplicateTaskIdsError = DuplicateTaskIdsError;
class UnexpectedExitError extends Error {
    code;
    signal;
    stderr;
    constructor(code, signal, stderr) {
        super(`Unexpected exit with code ${code} after signal ${signal}`);
        this.code = code;
        this.signal = signal;
        this.stderr = stderr;
        this.name = "UnexpectedExitError";
    }
}
exports.UnexpectedExitError = UnexpectedExitError;
class CleanupProcessError extends Error {
    constructor() {
        super("Cancelled");
        this.name = "CleanupProcessError";
    }
}
exports.CleanupProcessError = CleanupProcessError;
class SuspendedProcessError extends Error {
    constructor() {
        super("Suspended");
        this.name = "SuspendedProcessError";
    }
}
exports.SuspendedProcessError = SuspendedProcessError;
class CancelledProcessError extends Error {
    constructor() {
        super("Cancelled");
        this.name = "CancelledProcessError";
    }
}
exports.CancelledProcessError = CancelledProcessError;
class SigKillTimeoutProcessError extends Error {
    constructor() {
        super("Process kill timeout");
        this.name = "SigKillTimeoutProcessError";
    }
}
exports.SigKillTimeoutProcessError = SigKillTimeoutProcessError;
class GracefulExitTimeoutError extends Error {
    constructor() {
        super("Graceful exit timeout");
        this.name = "GracefulExitTimeoutError";
    }
}
exports.GracefulExitTimeoutError = GracefulExitTimeoutError;
class ChatChunkTooLargeError extends Error {
    chunkSize;
    maxSize;
    chunkType;
    constructor(chunkSize, maxSize, chunkType) {
        super(`chat.agent chunk${chunkType ? ` of type "${chunkType}"` : ""} is ${chunkSize} bytes, ` +
            `over the realtime stream's per-record cap of ${maxSize} bytes. ` +
            `For oversized payloads (e.g. large tool outputs), write the value to your own store and ` +
            `emit only an id/url through the chat stream — see https://trigger.dev/docs/ai-chat/patterns/large-payloads.`);
        this.chunkSize = chunkSize;
        this.maxSize = maxSize;
        this.chunkType = chunkType;
        this.name = "ChatChunkTooLargeError";
    }
}
exports.ChatChunkTooLargeError = ChatChunkTooLargeError;
function isChatChunkTooLargeError(error) {
    return error instanceof Error && error.name === "ChatChunkTooLargeError";
}
class MaxDurationExceededError extends Error {
    maxDurationInSeconds;
    elapsedTimeInSeconds;
    constructor(maxDurationInSeconds, elapsedTimeInSeconds) {
        super(`Run exceeded maximum compute time (maxDuration) of ${maxDurationInSeconds} seconds`);
        this.maxDurationInSeconds = maxDurationInSeconds;
        this.elapsedTimeInSeconds = elapsedTimeInSeconds;
        this.name = "MaxDurationExceededError";
    }
}
exports.MaxDurationExceededError = MaxDurationExceededError;
const prettyInternalErrors = {
    TASK_PROCESS_OOM_KILLED: {
        message: "Your run was terminated due to exceeding the machine's memory limit. Try increasing the machine preset in your task options or replay using a larger machine.",
        link: {
            name: "Machines",
            href: links_js_1.links.docs.machines.home,
        },
    },
    TASK_PROCESS_MAYBE_OOM_KILLED: {
        message: "Your run was terminated due to exceeding the machine's memory limit. Try increasing the machine preset in your task options or replay using a larger machine.",
        link: {
            name: "Machines",
            href: links_js_1.links.docs.machines.home,
        },
    },
    TASK_PROCESS_SIGSEGV: {
        message: "Your task crashed with a segmentation fault (SIGSEGV). Most likely there's a bug in a package or binary you're using. If this keeps happening and you're unsure why, please get in touch.",
        link: {
            name: "Contact us",
            href: links_js_1.links.site.contact,
            magic: "CONTACT_FORM",
        },
    },
    TASK_PROCESS_SIGTERM: {
        message: "Your task exited after receiving SIGTERM but we don't know why. If this keeps happening, please get in touch so we can investigate.",
        link: {
            name: "Contact us",
            href: links_js_1.links.site.contact,
            magic: "CONTACT_FORM",
        },
    },
    OUTDATED_SDK_VERSION: {
        message: "Your task is using an outdated version of the SDK. Please upgrade to the latest version.",
        link: {
            name: "Beta upgrade guide",
            href: links_js_1.links.docs.upgrade.beta,
        },
    },
    TASK_DID_CONCURRENT_WAIT: {
        message: "Parallel waits are not supported, e.g. using Promise.all() around our wait functions.",
        link: {
            name: "Read the docs for solutions",
            href: links_js_1.links.docs.troubleshooting.concurrentWaits,
        },
    },
    RECURSIVE_WAIT_DEADLOCK: {
        message: "This run will never execute because it was triggered recursively and the task has no remaining concurrency available.",
        link: {
            name: "See docs for help",
            href: links_js_1.links.docs.concurrency.recursiveDeadlock,
        },
    },
    TASK_RUN_STALLED_EXECUTING: {
        link: {
            name: "Read our troubleshooting guide",
            href: links_js_1.links.docs.troubleshooting.stalledExecution,
        },
    },
    // Link only — we deliberately do NOT set `message`, so the original
    // error message (e.g. "read ECONNRESET") is preserved in the dashboard.
    // Common cause: an EventEmitter (node-redis, pg, etc.) emitted "error"
    // with no listener attached, which Node escalates to uncaughtException.
    // The docs page explains how to attach .on("error") listeners and how
    // unhandled rejections route through the same path.
    TASK_RUN_UNCAUGHT_EXCEPTION: {
        link: {
            name: "Read our troubleshooting guide",
            href: links_js_1.links.docs.troubleshooting.uncaughtException,
        },
    },
};
const getPrettyTaskRunError = (code) => {
    return {
        type: "INTERNAL_ERROR",
        code,
        ...prettyInternalErrors[code],
    };
};
const getPrettyExceptionEvent = (code) => {
    return {
        type: code,
        ...prettyInternalErrors[code],
    };
};
const findSignalInMessage = (message, truncateLength = 100) => {
    if (!message) {
        return;
    }
    const trunc = truncateLength ? message.slice(0, truncateLength) : message;
    if (trunc.includes("SIGTERM")) {
        return "SIGTERM";
    }
    else if (trunc.includes("SIGSEGV")) {
        return "SIGSEGV";
    }
    else if (trunc.includes("SIGKILL")) {
        return "SIGKILL";
    }
    else if (trunc.includes("SIGABRT")) {
        return "SIGABRT";
    }
    else {
        return;
    }
};
function taskRunErrorEnhancer(error) {
    switch (error.type) {
        case "BUILT_IN_ERROR": {
            if (error.name === "UnexpectedExitError") {
                if (error.message.startsWith("Unexpected exit with code -1")) {
                    const signal = findSignalInMessage(error.stackTrace);
                    switch (signal) {
                        case "SIGTERM":
                            return {
                                ...getPrettyTaskRunError("TASK_PROCESS_SIGTERM"),
                            };
                        case "SIGSEGV":
                            return {
                                ...getPrettyTaskRunError("TASK_PROCESS_SIGSEGV"),
                            };
                        case "SIGKILL":
                            return {
                                ...getPrettyTaskRunError("TASK_PROCESS_MAYBE_OOM_KILLED"),
                            };
                        case "SIGABRT":
                            return {
                                ...getPrettyTaskRunError("TASK_PROCESS_MAYBE_OOM_KILLED"),
                            };
                        default:
                            return {
                                ...getPrettyTaskRunError("TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE"),
                                message: error.message,
                                stackTrace: error.stackTrace,
                            };
                    }
                }
            }
            if (error.name === "Error") {
                if (error.message === "ffmpeg was killed with signal SIGKILL") {
                    return {
                        ...getPrettyTaskRunError("TASK_PROCESS_OOM_KILLED"),
                    };
                }
            }
            if (isManualOutOfMemoryError(error)) {
                return {
                    ...getPrettyTaskRunError("TASK_PROCESS_OOM_KILLED"),
                };
            }
            if (error.name === "TriggerApiError") {
                if (error.message.startsWith("Deadlock detected:")) {
                    return {
                        type: "BUILT_IN_ERROR",
                        name: "Concurrency Deadlock Error",
                        message: error.message,
                        stackTrace: "",
                        ...(error.causes?.length ? { causes: error.causes } : {}),
                        link: {
                            name: "Read the docs",
                            href: links_js_1.links.docs.concurrency.deadlock,
                        },
                    };
                }
            }
            break;
        }
        case "STRING_ERROR": {
            break;
        }
        case "CUSTOM_ERROR": {
            break;
        }
        case "INTERNAL_ERROR": {
            if (error.code === common_js_1.TaskRunErrorCodes.TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE) {
                const signal = findSignalInMessage(error.message);
                switch (signal) {
                    case "SIGTERM":
                        return {
                            ...getPrettyTaskRunError("TASK_PROCESS_SIGTERM"),
                        };
                    case "SIGSEGV":
                        return {
                            ...getPrettyTaskRunError("TASK_PROCESS_SIGSEGV"),
                        };
                    case "SIGKILL":
                        return {
                            ...getPrettyTaskRunError("TASK_PROCESS_MAYBE_OOM_KILLED"),
                        };
                    case "SIGABRT":
                        return {
                            ...getPrettyTaskRunError("TASK_PROCESS_MAYBE_OOM_KILLED"),
                        };
                    default: {
                        return {
                            ...getPrettyTaskRunError("TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE"),
                            message: error.message,
                            stackTrace: error.stackTrace,
                        };
                    }
                }
            }
            return {
                ...error,
                ...getPrettyTaskRunError(error.code),
            };
        }
    }
    return error;
}
function exceptionEventEnhancer(exception) {
    switch (exception.type) {
        case "UnexpectedExitError": {
            if (exception.message?.startsWith("Unexpected exit with code -1")) {
                return {
                    ...exception,
                    ...prettyInternalErrors.TASK_PROCESS_MAYBE_OOM_KILLED,
                };
            }
            break;
        }
        case "Internal error": {
            if (exception.message?.startsWith(common_js_1.TaskRunErrorCodes.TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE)) {
                const signal = findSignalInMessage(exception.message);
                switch (signal) {
                    case "SIGTERM":
                        return {
                            ...exception,
                            ...getPrettyExceptionEvent("TASK_PROCESS_SIGTERM"),
                        };
                    case "SIGSEGV":
                        return {
                            ...exception,
                            ...getPrettyExceptionEvent("TASK_PROCESS_SIGSEGV"),
                        };
                    case "SIGKILL":
                        return {
                            ...exception,
                            ...getPrettyExceptionEvent("TASK_PROCESS_MAYBE_OOM_KILLED"),
                        };
                    case "SIGABRT":
                        return {
                            ...exception,
                            ...getPrettyExceptionEvent("TASK_PROCESS_MAYBE_OOM_KILLED"),
                        };
                    default:
                        return exception;
                }
            }
            else if (exception.message?.includes(common_js_1.TaskRunErrorCodes.RECURSIVE_WAIT_DEADLOCK)) {
                return {
                    ...exception,
                    ...prettyInternalErrors.RECURSIVE_WAIT_DEADLOCK,
                };
            }
            break;
        }
        case "Error": {
            if (exception.message === "ffmpeg was killed with signal SIGKILL") {
                return {
                    ...exception,
                    ...prettyInternalErrors.TASK_PROCESS_OOM_KILLED,
                };
            }
            break;
        }
        case common_js_1.TaskRunErrorCodes.TASK_PROCESS_MAYBE_OOM_KILLED:
        case common_js_1.TaskRunErrorCodes.TASK_PROCESS_OOM_KILLED:
        case common_js_1.TaskRunErrorCodes.TASK_PROCESS_SIGTERM: {
            return {
                ...exception,
                ...getPrettyExceptionEvent(exception.type),
            };
        }
    }
    return exception;
}
function internalErrorFromUnexpectedExit(error, dockerMode = true) {
    const internalError = {
        type: "INTERNAL_ERROR",
        code: common_js_1.TaskRunErrorCodes.TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE,
        message: `Process exited with code ${error.code} after signal ${error.signal}.`,
        stackTrace: error.stderr,
    };
    if (error.code === 137) {
        if (dockerMode) {
            return {
                ...internalError,
                code: common_js_1.TaskRunErrorCodes.TASK_PROCESS_OOM_KILLED,
            };
        }
        else {
            // Note: containerState reason and message could be checked to clarify the error, maybe the task monitor should be allowed to override these
            return {
                ...internalError,
                code: common_js_1.TaskRunErrorCodes.TASK_PROCESS_MAYBE_OOM_KILLED,
            };
        }
    }
    if (error.stderr?.includes("OOMErrorHandler")) {
        return {
            ...internalError,
            code: common_js_1.TaskRunErrorCodes.TASK_PROCESS_OOM_KILLED,
        };
    }
    if (error.signal === "SIGTERM") {
        return {
            ...internalError,
            code: common_js_1.TaskRunErrorCodes.TASK_PROCESS_SIGTERM,
        };
    }
    return {
        ...internalError,
        code: common_js_1.TaskRunErrorCodes.TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE,
    };
}
function serializeIndexingError(error, stderr) {
    if (error instanceof TaskMetadataParseError) {
        return {
            name: "TaskMetadataParseError",
            message: "There was an error parsing the task metadata",
            stack: JSON.stringify({ zodIssues: error.zodIssues, tasks: error.tasks }),
            stderr,
        };
    }
    else if (error instanceof TaskIndexingImportError) {
        return {
            name: "TaskIndexingImportError",
            message: "There was an error importing task files",
            stack: JSON.stringify(error.importErrors),
            stderr,
        };
    }
    else if (error instanceof UncaughtExceptionError) {
        const originalError = error.originalError;
        return {
            name: originalError.name,
            message: originalError.message,
            stack: originalError.stack,
            stderr,
        };
    }
    else if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
            stderr,
        };
    }
    return {
        name: "UnknownError",
        message: String(error),
        stderr,
    };
}
function prepareDeploymentError(errorData) {
    if (!errorData) {
        return;
    }
    if (errorData.name === "TaskMetadataParseError") {
        const errorJson = tryJsonParse(errorData.stack);
        if (errorJson) {
            const parsedError = messages_js_1.TaskMetadataFailedToParseData.safeParse(errorJson);
            if (parsedError.success) {
                return {
                    name: errorData.name,
                    message: errorData.message,
                    stack: createTaskMetadataFailedErrorStack(parsedError.data),
                    stderr: errorData.stderr,
                };
            }
            else {
                return {
                    name: errorData.name,
                    message: errorData.message,
                    stderr: errorData.stderr,
                };
            }
        }
        else {
            return {
                name: errorData.name,
                message: errorData.message,
                stderr: errorData.stderr,
            };
        }
    }
    else if (errorData.name === "TaskIndexingImportError") {
        const errorJson = tryJsonParse(errorData.stack);
        if (errorJson) {
            const parsedError = build_js_1.ImportTaskFileErrors.safeParse(errorJson);
            if (parsedError.success) {
                return {
                    name: errorData.name,
                    message: errorData.message,
                    stack: parsedError.data
                        .map((error) => {
                        return `x ${error.message} in ${error.file}`;
                    })
                        .join("\n"),
                    stderr: errorData.stderr,
                };
            }
            else {
                return {
                    name: errorData.name,
                    message: errorData.message,
                    stderr: errorData.stderr,
                };
            }
        }
        else {
            return {
                name: errorData.name,
                message: errorData.message,
                stderr: errorData.stderr,
            };
        }
    }
    return {
        name: errorData.name,
        message: errorData.message,
        stack: errorData.stack,
        stderr: errorData.stderr,
    };
}
function createTaskMetadataFailedErrorStack(data) {
    const stack = [];
    const groupedIssues = groupTaskMetadataIssuesByTask(data.tasks, data.zodIssues);
    for (const key in groupedIssues) {
        if (!Object.hasOwn(groupedIssues, key))
            continue;
        const taskWithIssues = groupedIssues[key];
        if (!taskWithIssues) {
            continue;
        }
        stack.push("\n");
        stack.push(`  ❯ ${taskWithIssues.exportName} in ${taskWithIssues.filePath}`);
        for (const issue of taskWithIssues.issues) {
            if (issue.path) {
                stack.push(`    x ${issue.path} ${issue.message}`);
            }
            else {
                stack.push(`    x ${issue.message}`);
            }
        }
    }
    return stack.join("\n");
}
function tryJsonParse(data) {
    if (!data) {
        return;
    }
    try {
        return JSON.parse(data);
    }
    catch {
        return;
    }
}
function taskRunErrorToString(error) {
    switch (error.type) {
        case "INTERNAL_ERROR": {
            return `Internal error [${error.code}]${error.message ? `: ${error.message}` : ""}`;
        }
        case "BUILT_IN_ERROR": {
            return `${error.name}: ${error.message}${formatErrorCauses(error.causes)}`;
        }
        case "STRING_ERROR": {
            return error.raw;
        }
        case "CUSTOM_ERROR": {
            return error.raw;
        }
    }
}
//# sourceMappingURL=errors.js.map