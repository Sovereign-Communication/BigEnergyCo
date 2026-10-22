import { accessoryAttributes, SemanticInternalAttributes } from "@trigger.dev/core/v3";
import { SpanStatusCode } from "@opentelemetry/api";
import { tracer } from "./tracer.js";
/** The warm window uses compute; it must not be presented as a waitpoint. */
export function traceSessionIdle(sessionId, idleTimeoutInSeconds, read) {
    return tracer.startActiveSpan("idle", read, {
        attributes: {
            [SemanticInternalAttributes.STYLE_ICON]: "sessions",
            session: sessionId,
            io: "in",
            "wait.phase": "idle",
            "wait.idleTimeoutInSeconds": idleTimeoutInSeconds,
            ...accessoryAttributes({
                items: [{ text: `up to ${idleTimeoutInSeconds}s`, variant: "normal" }],
                style: "codepath",
            }),
        },
    });
}
/** Attach the waitpoint before starting the wait, including for partial spans. */
export function traceSessionWait(sessionId, waitpointId, wait) {
    return tracer.startActiveSpan("wait.forToken()", async (span) => {
        const result = await wait();
        if (!result.ok && result.error) {
            span.recordException(result.error);
            span.setStatus({ code: SpanStatusCode.ERROR });
        }
        return result;
    }, {
        attributes: {
            [SemanticInternalAttributes.STYLE_ICON]: "wait",
            [SemanticInternalAttributes.ENTITY_TYPE]: "waitpoint",
            [SemanticInternalAttributes.ENTITY_ID]: waitpointId,
            session: sessionId,
            io: "in",
            "wait.phase": "suspended",
        },
    });
}
//# sourceMappingURL=sessionTracing.js.map