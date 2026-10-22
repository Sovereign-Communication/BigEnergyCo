"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.traceSessionIdle = traceSessionIdle;
exports.traceSessionWait = traceSessionWait;
const v3_1 = require("@trigger.dev/core/v3");
const api_1 = require("@opentelemetry/api");
const tracer_js_1 = require("./tracer.js");
/** The warm window uses compute; it must not be presented as a waitpoint. */
function traceSessionIdle(sessionId, idleTimeoutInSeconds, read) {
    return tracer_js_1.tracer.startActiveSpan("idle", read, {
        attributes: {
            [v3_1.SemanticInternalAttributes.STYLE_ICON]: "sessions",
            session: sessionId,
            io: "in",
            "wait.phase": "idle",
            "wait.idleTimeoutInSeconds": idleTimeoutInSeconds,
            ...(0, v3_1.accessoryAttributes)({
                items: [{ text: `up to ${idleTimeoutInSeconds}s`, variant: "normal" }],
                style: "codepath",
            }),
        },
    });
}
/** Attach the waitpoint before starting the wait, including for partial spans. */
function traceSessionWait(sessionId, waitpointId, wait) {
    return tracer_js_1.tracer.startActiveSpan("wait.forToken()", async (span) => {
        const result = await wait();
        if (!result.ok && result.error) {
            span.recordException(result.error);
            span.setStatus({ code: api_1.SpanStatusCode.ERROR });
        }
        return result;
    }, {
        attributes: {
            [v3_1.SemanticInternalAttributes.STYLE_ICON]: "wait",
            [v3_1.SemanticInternalAttributes.ENTITY_TYPE]: "waitpoint",
            [v3_1.SemanticInternalAttributes.ENTITY_ID]: waitpointId,
            session: sessionId,
            io: "in",
            "wait.phase": "suspended",
        },
    });
}
//# sourceMappingURL=sessionTracing.js.map