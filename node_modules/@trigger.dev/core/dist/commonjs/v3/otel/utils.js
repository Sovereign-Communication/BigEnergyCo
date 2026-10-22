"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordSpanException = recordSpanException;
exports.carrierFromContext = carrierFromContext;
const api_1 = require("@opentelemetry/api");
const errors_js_1 = require("../errors.js");
const MAX_GENERIC_LENGTH = 5_000;
function truncateGeneric(value) {
    return value.length > MAX_GENERIC_LENGTH
        ? value.slice(0, MAX_GENERIC_LENGTH) + "...[truncated]"
        : value;
}
function serializeFallback(error) {
    // JSON.stringify can throw (circular refs, BigInt) or return undefined
    // (symbol, undefined, function). Fall back to String() in both cases so we
    // never mask the original error being recorded.
    try {
        const json = JSON.stringify(error);
        if (json != null)
            return json;
    }
    catch {
        // fall through
    }
    try {
        return String(error);
    }
    catch {
        return "[unserializable error]";
    }
}
function recordSpanException(span, error) {
    if (error instanceof Error) {
        span.recordException(sanitizeSpanError(error));
    }
    else if (typeof error === "string") {
        span.recordException(truncateGeneric(error.replace(/\0/g, "")));
    }
    else {
        span.recordException(truncateGeneric(serializeFallback(error).replace(/\0/g, "")));
    }
    span.setStatus({ code: api_1.SpanStatusCode.ERROR });
}
function sanitizeSpanError(error) {
    const sanitizedError = new Error((0, errors_js_1.truncateMessage)(error.message.replace(/\0/g, "")));
    sanitizedError.name = error.name.replace(/\0/g, "");
    sanitizedError.stack = (0, errors_js_1.truncateStack)(error.stack?.replace(/\0/g, "")) || undefined;
    return sanitizedError;
}
function carrierFromContext() {
    const carrier = {};
    api_1.propagation.inject(api_1.context.active(), carrier);
    return carrier;
}
//# sourceMappingURL=utils.js.map