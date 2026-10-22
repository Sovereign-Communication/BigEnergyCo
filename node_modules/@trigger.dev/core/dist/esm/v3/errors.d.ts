import type { z } from "zod/v4";
import type { DeploymentErrorData } from "./schemas/api.js";
import type { WorkerManifest } from "./schemas/build.js";
import { ImportTaskFileErrors } from "./schemas/build.js";
import type { SerializedError, TaskRunError, TaskRunErrorCause, TaskRunInternalError } from "./schemas/common.js";
import { TaskRunErrorCodes } from "./schemas/common.js";
import { TaskMetadataFailedToParseData } from "./schemas/messages.js";
import type { ExceptionEventProperties } from "./schemas/openTelemetry.js";
import type { ZodIssueLike } from "./types/schemas.js";
/**
 * If you throw this, it will get converted into an INTERNAL_ERROR
 */
export declare class InternalError extends Error {
    readonly code: TaskRunErrorCodes;
    readonly skipRetrying: boolean;
    constructor({ code, message, showStackTrace, skipRetrying, }: {
        code: TaskRunErrorCodes;
        message?: string;
        showStackTrace?: boolean;
        skipRetrying?: boolean;
    });
}
export declare function isInternalError(error: unknown): error is InternalError;
export declare class AbortTaskRunError extends Error {
    constructor(message: string);
}
/**
 * This causes an Out Of Memory error on the run (if it's uncaught).
 * This can be useful if you use a native package that detects it's run out of memory but doesn't kill Node.js
 */
export declare class OutOfMemoryError extends Error {
    constructor();
}
export declare function isManualOutOfMemoryError(error: TaskRunError): boolean;
export declare function isOOMRunError(error: TaskRunError): boolean;
export declare class TaskPayloadParsedError extends Error {
    readonly cause: unknown;
    constructor(cause: unknown);
}
export declare class CompleteTaskWithOutput extends Error {
    readonly output: unknown;
    constructor(output?: unknown);
}
export declare function isCompleteTaskWithOutput(error: unknown): error is CompleteTaskWithOutput;
/** Truncate a stack trace to at most MAX_STACK_FRAMES frames, keeping
 *  the top (closest to throw) and bottom (entry points) frames.
 *  Individual lines (including message lines) are capped at MAX_STACK_LINE_LENGTH
 *  to prevent OOM from huge error messages embedded in the stack. */
export declare function truncateStack(stack: string | undefined, maxFrames?: number): string;
export declare function truncateMessage(message: string | undefined): string;
/** Rebuild a native `cause` chain from the flattened form, innermost first. */
export declare function createErrorFromCauses(causes: TaskRunErrorCause[]): Error | undefined;
/** Render a flattened cause chain the way Node prints one. `stackTrace` opts into the
 *  full frames; without it each cause is a single "Caused by:" line. */
export declare function formatErrorCauses(causes: TaskRunErrorCause[] | undefined, options?: {
    stackTrace?: boolean;
}): string;
export declare function parseError(error: unknown): TaskRunError;
export declare function createErrorTaskError(error: TaskRunError): any;
export declare function createJsonErrorObject(error: TaskRunError): SerializedError;
export declare function sanitizeError(error: TaskRunError): TaskRunError;
export declare function shouldRetryError(error: TaskRunError): boolean;
export declare function shouldLookupRetrySettings(error: TaskRunError): boolean;
export declare function correctErrorStackTrace(stackTrace: string, projectDir?: string, options?: {
    removeFirstLine?: boolean;
    isDev?: boolean;
}): string;
export declare function groupTaskMetadataIssuesByTask(tasks: any, issues: ReadonlyArray<ZodIssueLike>): {
    [x: number]: {
        id: any;
        exportName: any;
        filePath: any;
        issues: Array<{
            message: string;
            path?: string;
        }>;
    } | {
        id: any;
        exportName: string;
        filePath: string;
        issues: Array<{
            message: string;
            path?: string;
        }>;
    };
};
export declare class UncaughtExceptionError extends Error {
    readonly originalError: {
        name: string;
        message: string;
        stack?: string;
    };
    readonly origin: "uncaughtException" | "unhandledRejection";
    constructor(originalError: {
        name: string;
        message: string;
        stack?: string;
    }, origin: "uncaughtException" | "unhandledRejection");
}
export declare class TaskMetadataParseError extends Error {
    readonly zodIssues: ReadonlyArray<ZodIssueLike>;
    readonly tasks: any;
    constructor(zodIssues: ReadonlyArray<ZodIssueLike>, tasks: any);
}
export declare class TaskIndexingImportError extends Error {
    readonly importErrors: ImportTaskFileErrors;
    readonly manifest: WorkerManifest;
    constructor(importErrors: ImportTaskFileErrors, manifest: WorkerManifest);
}
export type TaskIdCollision = {
    id: string;
    filePaths: string[];
};
export declare class DuplicateTaskIdsError extends Error {
    readonly collisions: TaskIdCollision[];
    constructor(collisions: TaskIdCollision[]);
}
export declare class UnexpectedExitError extends Error {
    code: number;
    signal: NodeJS.Signals | null;
    stderr: string | undefined;
    constructor(code: number, signal: NodeJS.Signals | null, stderr: string | undefined);
}
export declare class CleanupProcessError extends Error {
    constructor();
}
export declare class SuspendedProcessError extends Error {
    constructor();
}
export declare class CancelledProcessError extends Error {
    constructor();
}
export declare class SigKillTimeoutProcessError extends Error {
    constructor();
}
export declare class GracefulExitTimeoutError extends Error {
    constructor();
}
export declare class ChatChunkTooLargeError extends Error {
    readonly chunkSize: number;
    readonly maxSize: number;
    readonly chunkType?: string | undefined;
    constructor(chunkSize: number, maxSize: number, chunkType?: string | undefined);
}
export declare function isChatChunkTooLargeError(error: unknown): error is ChatChunkTooLargeError;
export declare class MaxDurationExceededError extends Error {
    readonly maxDurationInSeconds: number;
    readonly elapsedTimeInSeconds: number;
    constructor(maxDurationInSeconds: number, elapsedTimeInSeconds: number);
}
type ErrorLink = {
    name: string;
    href: string;
    magic?: "CONTACT_FORM";
};
type EnhanceError<T extends TaskRunError | ExceptionEventProperties> = T & {
    link?: ErrorLink;
};
export declare function taskRunErrorEnhancer(error: TaskRunError): EnhanceError<TaskRunError>;
export declare function exceptionEventEnhancer(exception: ExceptionEventProperties): EnhanceError<ExceptionEventProperties>;
export declare function internalErrorFromUnexpectedExit(error: UnexpectedExitError, dockerMode?: boolean): TaskRunInternalError;
export declare function serializeIndexingError(error: unknown, stderr?: string): DeploymentErrorData;
export declare function prepareDeploymentError(errorData: DeploymentErrorData): DeploymentErrorData | undefined;
export declare function createTaskMetadataFailedErrorStack(data: z.infer<typeof TaskMetadataFailedToParseData>): string;
export declare function taskRunErrorToString(error: TaskRunError): string;
export {};
