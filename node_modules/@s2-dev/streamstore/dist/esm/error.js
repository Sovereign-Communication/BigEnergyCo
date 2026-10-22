function getErrorCode(error) {
    if (!(error instanceof Error))
        return undefined;
    const err = error;
    if (typeof err.code === "string")
        return err.code;
    if (err.cause && typeof err.cause === "object") {
        const cause = err.cause;
        if (typeof cause.code === "string") {
            return cause.code;
        }
    }
    return undefined;
}
function isConnectionError(error) {
    if (!(error instanceof Error)) {
        return false;
    }
    // Node.js: "fetch failed"
    // Chrome: "Failed to fetch"
    // Firefox: "NetworkError when attempting to fetch resource"
    // Safari: "Load failed"
    // Some browser body-stream failures: "network error"
    // Normalize: lowercase, strip trailing punctuation/whitespace
    const msg = error.message.toLowerCase().replace(/[\s.!]+$/, "");
    const knownConnectionMessages = [
        "fetch failed",
        "failed to fetch",
        "networkerror when attempting to fetch resource",
        "network error",
        "load failed",
        // undici SocketError: peer closed the connection
        "other side closed",
    ];
    if (knownConnectionMessages.includes(msg)) {
        return true;
    }
    // undici reports a response body destroyed mid-stream as
    // TypeError("terminated"). Restrict this generic message to TypeError so an
    // unrelated application Error("terminated") is not made retryable.
    if (error instanceof TypeError && msg === "terminated") {
        return true;
    }
    const code = getErrorCode(error);
    // Common connection error codes from Node.js net module
    const connectionErrorCodes = [
        "ECONNREFUSED", // Connection refused
        "ENOTFOUND", // DNS lookup failed
        "ETIMEDOUT", // Connection timeout
        "ENETUNREACH", // Network unreachable
        "EHOSTUNREACH", // Host unreachable
        "ECONNRESET", // Connection reset by peer
        "EPIPE", // Broken pipe
        "UND_ERR_SOCKET", // undici: socket closed mid-request/response
        "UND_ERR_CONNECT_TIMEOUT", // undici: connect timeout
        "UND_ERR_HEADERS_TIMEOUT", // undici: headers timeout
        "UND_ERR_BODY_TIMEOUT", // undici: body timeout
    ];
    return typeof code === "string" && connectionErrorCodes.includes(code);
}
export function s2Error(error) {
    if (error instanceof S2Error) {
        return error;
    }
    // Connection error?
    if (isConnectionError(error)) {
        const code = getErrorCode(error) ?? "NETWORK_ERROR";
        // DNS failures are typically not transient - don't retry
        if (code === "ENOTFOUND") {
            return new S2Error({
                message: `DNS resolution failed (ENOTFOUND)`,
                code,
                status: 400, // Client error - not retryable
                origin: "sdk",
            });
        }
        // Other connection errors are transient - retryable
        return new S2Error({
            message: `Connection failed: ${code}`,
            code,
            status: 502, // Bad Gateway for upstream/network issues
            origin: "sdk",
        });
    }
    // Abort error?
    if (error instanceof Error && error.name === "AbortError") {
        return new S2Error({
            message: "Request cancelled",
            status: 499, // Client Closed Request (nginx non-standard)
            origin: "sdk",
        });
    }
    // Other unknown errors
    return new S2Error({
        message: error instanceof Error ? error.message : "Unknown error",
        status: 0, // Non-HTTP/internal error sentinel
        origin: "sdk",
    });
}
export async function withS2Error(fn) {
    try {
        const result = await fn();
        // Support response-parsing mode (throwOnError=false):
        // Generated client responses have shape { data, error?, response }
        if (result &&
            typeof result === "object" &&
            Object.prototype.hasOwnProperty.call(result, "error")) {
            const err = result.error;
            if (err) {
                const status = result.response?.status ?? 500;
                const statusText = result.response?.statusText;
                // If server provided structured error with message/code, use it
                if (typeof err === "object" && "message" in err) {
                    const structured = err;
                    throw new S2Error({
                        message: typeof structured.message === "string"
                            ? structured.message
                            : (statusText ?? "Error"),
                        code: typeof structured.code === "string" ? structured.code : undefined,
                        status,
                        origin: "server",
                    });
                }
                // Fallback: synthesize from HTTP response metadata
                throw new S2Error({
                    message: statusText ?? "Request failed",
                    status,
                    origin: "server",
                });
            }
        }
        return result;
    }
    catch (error) {
        // Network and other thrown errors
        throw s2Error(error);
    }
}
/**
 * Execute a generated client call and return its `data` on success.
 * Throws S2Error when the response contains `error`, or when the
 * response has no `data` and is not a 204 No Content.
 */
export async function withS2Data(fn) {
    try {
        const res = await fn();
        if (res &&
            typeof res === "object" &&
            (Object.prototype.hasOwnProperty.call(res, "error") ||
                Object.prototype.hasOwnProperty.call(res, "data") ||
                Object.prototype.hasOwnProperty.call(res, "response"))) {
            const status = res.response?.status ?? 500;
            const statusText = res.response?.statusText;
            if (res.error) {
                const err = res.error;
                if (typeof err === "object" && "message" in err) {
                    const structured = err;
                    throw new S2Error({
                        message: typeof structured.message === "string"
                            ? structured.message
                            : (statusText ?? "Error"),
                        code: typeof structured.code === "string" ? structured.code : undefined,
                        status,
                        origin: "server",
                    });
                }
                throw new S2Error({
                    message: statusText ?? "Request failed",
                    status,
                    origin: "server",
                });
            }
            // No error
            if (typeof res.data !== "undefined")
                return res.data;
            // Treat 204 as success for void endpoints
            if (status === 204)
                return undefined;
            throw new S2Error({
                message: "Empty response",
                status,
                origin: "server",
            });
        }
        // Not a generated client response; return as-is
        return res;
    }
    catch (error) {
        throw s2Error(error);
    }
}
/**
 * Rich error type used by the SDK to surface HTTP and protocol errors.
 *
 * - `code` is the service error code when available.
 * - `status` is the HTTP status code.
 * - `data` may include structured error details (e.g. for conditional failures).
 */
export class S2Error extends Error {
    code;
    /** HTTP status code. 0 for non-HTTP/internal errors. */
    status;
    /** Optional structured error details for diagnostics. */
    data;
    /** Origin of the error: server (HTTP response) or sdk (local). */
    origin;
    constructor({ message, code, status, data, origin, }) {
        super(message);
        this.code = code;
        // Ensure status is always a number (0 for non-HTTP/internal errors)
        this.status = typeof status === "number" ? status : 0;
        this.data = data;
        this.origin = origin ?? "sdk";
        this.name = "S2Error";
    }
    /**
     * Returns true if the error guarantees that no mutation occurred.
     *
     * Certain server errors (`rate_limited`, `hot_server`) and client errors
     * (`ECONNREFUSED`) are safe to retry since they guarantee no side effects.
     */
    hasNoSideEffects() {
        if (this.origin === "server") {
            return ((this.status === 429 && this.code === "rate_limited") ||
                (this.status === 502 && this.code === "hot_server"));
        }
        if (this.origin === "sdk") {
            return this.code === "ECONNREFUSED";
        }
        return false;
    }
}
/** Helper: construct a non-retryable invariant violation error (status 0). */
export function invariantViolation(message, details) {
    return new S2Error({
        message: `Invariant violation: ${message}`,
        code: "INTERNAL_ERROR",
        status: 0,
        origin: "sdk",
        data: details,
    });
}
/** Helper: construct an internal SDK error (status 0, never retried). */
export function internalSdkError(message, details) {
    return new S2Error({
        message: `Internal SDK error: ${message}`,
        code: "INTERNAL_SDK_ERROR",
        status: 0,
        origin: "sdk",
        data: details,
    });
}
/** Helper: construct an aborted/cancelled error (499). */
export function abortedError(message = "Request cancelled") {
    return new S2Error({
        message,
        code: "ABORTED",
        status: 499,
        origin: "sdk",
    });
}
/**
 * Thrown when an append operation fails due to a sequence number mismatch.
 *
 * This occurs when you specify a `matchSeqNum` condition in your append request,
 * but the current tail sequence number of the stream doesn't match.
 *
 * The `expectedSeqNum` property contains the actual next sequence number
 * that should be used for a successful append.
 */
export class SeqNumMismatchError extends S2Error {
    /** The expected next sequence number for the stream. */
    expectedSeqNum;
    constructor({ message, code, status, expectedSeqNum, }) {
        super({
            message: `${message}\nExpected sequence number: ${expectedSeqNum}`,
            code,
            status,
            origin: "server",
        });
        this.name = "SeqNumMismatchError";
        this.expectedSeqNum = expectedSeqNum;
    }
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
export class FencingTokenMismatchError extends S2Error {
    /** The expected fencing token for the stream. */
    expectedFencingToken;
    constructor({ message, code, status, expectedFencingToken, }) {
        super({
            message: `${message}\nExpected fencing token: ${expectedFencingToken}`,
            code,
            status,
            origin: "server",
        });
        this.name = "FencingTokenMismatchError";
        this.expectedFencingToken = expectedFencingToken;
    }
}
/**
 * Thrown when a read operation fails because the requested starting point is out of range
 * (HTTP 416 Range Not Satisfiable).
 *
 * The `tail` property contains the current tail position of the stream when available.
 *
 * @see https://s2.dev/docs/api/records/read#starting-point-out-of-range
 */
export class RangeNotSatisfiableError extends S2Error {
    /** The current tail position of the stream. */
    tail;
    constructor({ code, status = 416, tail, } = {}) {
        const message = tail
            ? `Range not satisfiable: starting point is out of range (tail seqNum=${tail.seqNum}).`
            : "Range not satisfiable: starting point is out of range.";
        super({
            message,
            code,
            status,
            origin: "server",
        });
        this.name = "RangeNotSatisfiableError";
        this.tail = tail;
    }
}
/**
 * Build a generic S2Error from HTTP status and optional payload.
 * If the payload contains a structured { message, code }, those are preferred.
 */
export function makeServerError(response, payload) {
    const status = typeof response.status === "number" ? response.status : 500;
    // Pull message/code from structured payload when present
    if (payload && typeof payload === "object" && "message" in payload) {
        const structured = payload;
        return new S2Error({
            message: typeof structured.message === "string"
                ? structured.message
                : (response.statusText ?? "Error"),
            code: typeof structured.code === "string" ? structured.code : undefined,
            status,
            origin: "server",
        });
    }
    // Fallbacks
    let message = undefined;
    if (typeof payload === "string" && payload.trim().length > 0) {
        message = payload;
    }
    return new S2Error({
        message: message ?? response.statusText ?? "Request failed",
        status,
        origin: "server",
    });
}
/** Map 412 Precondition Failed append errors to rich error types. */
export function makeAppendPreconditionError(status, json) {
    if (json && typeof json === "object") {
        if ("seq_num_mismatch" in json) {
            const expected = Number(json.seq_num_mismatch);
            return new SeqNumMismatchError({
                message: "Append condition failed: sequence number mismatch",
                code: "APPEND_CONDITION_FAILED",
                status,
                expectedSeqNum: expected,
            });
        }
        if ("fencing_token_mismatch" in json) {
            const expected = String(json.fencing_token_mismatch);
            return new FencingTokenMismatchError({
                message: "Append condition failed: fencing token mismatch",
                code: "APPEND_CONDITION_FAILED",
                status,
                expectedFencingToken: expected,
            });
        }
        if ("message" in json) {
            return new S2Error({
                message: json.message ?? "Append condition failed",
                status,
                origin: "server",
            });
        }
    }
    return new S2Error({
        message: "Append condition failed",
        status,
        origin: "server",
    });
}
//# sourceMappingURL=error.js.map