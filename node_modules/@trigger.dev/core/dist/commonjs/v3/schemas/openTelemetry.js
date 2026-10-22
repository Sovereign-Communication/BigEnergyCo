"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpanMessagingEvent = exports.SpanEvents = exports.SpanEvent = exports.OtherSpanEvent = exports.AttemptFailedSpanEvent = exports.CancellationSpanEvent = exports.ExceptionSpanEvent = exports.ExceptionEventProperties = void 0;
exports.isExceptionSpanEvent = isExceptionSpanEvent;
exports.isCancellationSpanEvent = isCancellationSpanEvent;
exports.isAttemptFailedSpanEvent = isAttemptFailedSpanEvent;
const v4_1 = require("zod/v4");
exports.ExceptionEventProperties = v4_1.z.object({
    type: v4_1.z.string().optional(),
    message: v4_1.z.string().optional(),
    stacktrace: v4_1.z.string().optional(),
});
exports.ExceptionSpanEvent = v4_1.z.object({
    name: v4_1.z.literal("exception"),
    time: v4_1.z.coerce.date(),
    properties: v4_1.z.object({
        exception: exports.ExceptionEventProperties,
    }),
});
exports.CancellationSpanEvent = v4_1.z.object({
    name: v4_1.z.literal("cancellation"),
    time: v4_1.z.coerce.date(),
    properties: v4_1.z.object({
        reason: v4_1.z.string(),
    }),
});
exports.AttemptFailedSpanEvent = v4_1.z.object({
    name: v4_1.z.literal("attempt_failed"),
    time: v4_1.z.coerce.date(),
    properties: v4_1.z.object({
        exception: exports.ExceptionEventProperties,
        attemptNumber: v4_1.z.number(),
        runId: v4_1.z.string(),
    }),
});
exports.OtherSpanEvent = v4_1.z.object({
    name: v4_1.z.string(),
    time: v4_1.z.coerce.date(),
    properties: v4_1.z.record(v4_1.z.string(), v4_1.z.unknown()),
});
exports.SpanEvent = v4_1.z.union([
    exports.ExceptionSpanEvent,
    exports.CancellationSpanEvent,
    exports.AttemptFailedSpanEvent,
    exports.OtherSpanEvent,
]);
exports.SpanEvents = v4_1.z.array(exports.SpanEvent);
function isExceptionSpanEvent(event) {
    return event.name === "exception";
}
function isCancellationSpanEvent(event) {
    return event.name === "cancellation";
}
function isAttemptFailedSpanEvent(event) {
    return event.name === "attempt_failed";
}
exports.SpanMessagingEvent = v4_1.z.object({
    system: v4_1.z.string().optional(),
    client_id: v4_1.z.string().optional(),
    operation: v4_1.z.enum(["publish", "create", "receive", "deliver"]),
    message: v4_1.z.any(),
    destination: v4_1.z.string().optional(),
});
//# sourceMappingURL=openTelemetry.js.map