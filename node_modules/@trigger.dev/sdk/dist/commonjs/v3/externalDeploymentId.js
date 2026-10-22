"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scopedEnvVar = scopedEnvVar;
exports.resolveTriggerExternalDeploymentId = resolveTriggerExternalDeploymentId;
exports.withResolvedExternalDeploymentId = withResolvedExternalDeploymentId;
const v3_1 = require("@trigger.dev/core/v3");
/** Reads an env var unless the scope opted out of ambient context (`inheritContext: false`). */
function scopedEnvVar(name) {
    const scope = v3_1.sdkScope.getStore();
    if (scope && !scope.inheritContext)
        return undefined;
    return (0, v3_1.getEnvVar)(name);
}
/**
 * Precedence: an explicit value, the client config, `TRIGGER_EXTERNAL_DEPLOYMENT_ID`, then
 * platform/CI commit vars when automatic skew protection is on. `null` is an explicit opt-out.
 */
function resolveTriggerExternalDeploymentId(explicit) {
    if (explicit === null)
        return undefined;
    return (0, v3_1.resolveExternalDeploymentId)({
        explicit,
        clientConfig: v3_1.apiClientManager.externalDeploymentId,
        read: scopedEnvVar,
    });
}
/**
 * Fill in `triggerConfig.externalDeploymentId` on an outgoing session-create body, at each point
 * one leaves the SDK. Discovery has to happen here rather than server-side: the commit SHA lives
 * in the calling application's runtime, so the caller's build is what selects the agent version.
 */
function withResolvedExternalDeploymentId(body) {
    const resolved = resolveTriggerExternalDeploymentId(body.triggerConfig.externalDeploymentId);
    const { externalDeploymentId: _omit, ...rest } = body.triggerConfig;
    return {
        ...body,
        triggerConfig: {
            ...rest,
            ...(resolved ? { externalDeploymentId: resolved } : {}),
        },
    };
}
//# sourceMappingURL=externalDeploymentId.js.map