import type { StreamPosition } from "./types.js";
export declare function s2Error(error: any): S2Error;
export declare function withS2Error<T>(fn: () => Promise<T>): Promise<T>;
/**
 * Execute a generated client call and return its `data` on success.
 * Throws S2Error when the response contains `error`, or when the
 * response has no `data` and is not a 204 No Content.
 */
export declare function withS2Data<T>(fn: () => Promise<{
    data?: T;
    error?: unknown;
    response?: {
        status?: number;
        statusText?: string;
    };
} | T>): Promise<T>;
/**
 * Rich error type used by the SDK to surface HTTP and protocol errors.
 *
 * - `code` is the service error code when available.
 * - `status` is the HTTP status code.
 * - `data` may include structured error details (e.g. for conditional failures).
 */
export declare class S2Error extends Error {
    readonly code?: string;
    /** HTTP status code. 0 for non-HTTP/internal errors. */
    readonly status: number;
    /** Optional structured error details for diagnostics. */
    readonly data?: unknown;
    /** Origin of the error: server (HTTP response) or sdk (local). */
    readonly origin: "server" | "sdk";
    constructor({ message, code, status, data, origin, }: {
        message: string;
        code?: string;
        status?: number;
        data?: unknown;
        origin?: "server" | "sdk";
    });
    /**
     * Returns true if the error guarantees that no mutation occurred.
     *
     * Certain server errors (`rate_limited`, `hot_server`) and client errors
     * (`ECONNREFUSED`) are safe to retry since they guarantee no side effects.
     */
    hasNoSideEffects(): boolean;
}
/** Helper: construct a non-retryable invariant violation error (status 0). */
export declare function invariantViolation(message: string, details?: unknown): S2Error;
/** Helper: construct an internal SDK error (status 0, never retried). */
export declare function internalSdkError(message: string, details?: unknown): S2Error;
/** Helper: construct an aborted/cancelled error (499). */
export declare function abortedError(message?: string): S2Error;
/**
 * Thrown when an append operation fails due to a sequence number mismatch.
 *
 * This occurs when you specify a `matchSeqNum` condition in your append request,
 * but the current tail sequence number of the stream doesn't match.
 *
 * The `expectedSeqNum` property contains the actual next sequence number
 * that should be used for a successful append.
 */
export declare class SeqNumMismatchError extends S2Error {
    /** The expected next sequence number for the stream. */
    readonly expectedSeqNum: number;
    constructor({ message, code, status, expectedSeqNum, }: {
        message: string;
        code?: string;
        status?: number;
        expectedSeqNum: number;
    });
}
/**
 * Thrown when an append operation fails due to a fencing token mismatch.
 *
 * This occurs when you specify a `fencingToken` condition in your append request,
 * but the current fencing token of the stream doesn't match.
 *
 * The `expectedFencingToken` property contains the actual fencing token
 * that should be used for a successful append.
 */
export declare class FencingTokenMismatchError extends S2Error {
    /** The expected fencing token for the stream. */
    readonly expectedFencingToken: string;
    constructor({ message, code, status, expectedFencingToken, }: {
        message: string;
        code?: string;
        status?: number;
        expectedFencingToken: string;
    });
}
/**
 * Thrown when a read operation fails because the requested starting point is out of range
 * (HTTP 416 Range Not Satisfiable).
 *
 * The `tail` property contains the current tail position of the stream when available.
 *
 * @see https://s2.dev/docs/api/records/read#starting-point-out-of-range
 */
export declare class RangeNotSatisfiableError extends S2Error {
    /** The current tail position of the stream. */
    readonly tail?: StreamPosition;
    constructor({ code, status, tail, }?: {
        code?: string;
        status?: number;
        tail?: StreamPosition;
    });
}
/**
 * Build a generic S2Error from HTTP status and optional payload.
 * If the payload contains a structured { message, code }, those are preferred.
 */
export declare function makeServerError(response: {
    status?: number;
    statusText?: string;
}, payload?: unknown): S2Error;
/** Map 412 Precondition Failed append errors to rich error types. */
export declare function makeAppendPreconditionError(status: number, json: any): S2Error;
//# sourceMappingURL=error.d.ts.map