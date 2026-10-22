"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLATFORM_COMMIT_SHA_ENV_VARS = exports.EXTERNAL_DEPLOYMENT_ID_MAX_LENGTH = exports.AUTOMATIC_SKEW_PROTECTION_ENV_VAR = exports.EXTERNAL_DEPLOYMENT_ID_ENV_VAR = void 0;
exports.normalizeExternalDeploymentId = normalizeExternalDeploymentId;
exports.isAutomaticSkewProtectionEnabled = isAutomaticSkewProtectionEnabled;
exports.discoverPlatformCommitSha = discoverPlatformCommitSha;
exports.resolveExternalDeploymentId = resolveExternalDeploymentId;
exports.EXTERNAL_DEPLOYMENT_ID_ENV_VAR = "TRIGGER_EXTERNAL_DEPLOYMENT_ID";
exports.AUTOMATIC_SKEW_PROTECTION_ENV_VAR = "TRIGGER_AUTOMATIC_SKEW_VERSION_PROTECTION";
exports.EXTERNAL_DEPLOYMENT_ID_MAX_LENGTH = 128;
exports.PLATFORM_COMMIT_SHA_ENV_VARS = [
    "VERCEL_GIT_COMMIT_SHA",
    "RAILWAY_GIT_COMMIT_SHA",
    "RENDER_GIT_COMMIT",
    "CF_PAGES_COMMIT_SHA",
    "WORKERS_CI_COMMIT_SHA",
    "COMMIT_REF",
    "AWS_COMMIT_ID",
    "HEROKU_BUILD_COMMIT",
    "HEROKU_SLUG_COMMIT",
    "KOYEB_GIT_SHA",
    "GITHUB_SHA",
    "CI_COMMIT_SHA",
    "CIRCLE_SHA1",
    "BITBUCKET_COMMIT",
    "BUILDKITE_COMMIT",
    "BUILD_SOURCEVERSION",
    "COMMIT_SHA",
    "DRONE_COMMIT_SHA",
    "GIT_COMMIT",
    "BUILD_VCS_NUMBER",
    "TRAVIS_COMMIT",
    "COMMIT_SHA",
    "COMMIT_HASH",
    "GIT_COMMIT",
    "GIT_SHA",
    "GIT_HASH",
];
function normalizeExternalDeploymentId(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    if (trimmed === "" || trimmed.length > exports.EXTERNAL_DEPLOYMENT_ID_MAX_LENGTH) {
        return undefined;
    }
    return trimmed;
}
function isAutomaticSkewProtectionEnabled(read) {
    const raw = read(exports.AUTOMATIC_SKEW_PROTECTION_ENV_VAR);
    if (typeof raw !== "string") {
        return false;
    }
    const normalized = raw.trim().toLowerCase();
    return normalized === "1" || normalized === "true";
}
function discoverPlatformCommitSha(read) {
    for (const name of exports.PLATFORM_COMMIT_SHA_ENV_VARS) {
        const candidate = normalizeExternalDeploymentId(read(name));
        if (candidate) {
            return candidate;
        }
    }
    return undefined;
}
function resolveExternalDeploymentId({ explicit, clientConfig, read, }) {
    const fromCall = normalizeExternalDeploymentId(explicit);
    if (fromCall)
        return fromCall;
    const fromClient = normalizeExternalDeploymentId(clientConfig);
    if (fromClient)
        return fromClient;
    const fromEnv = normalizeExternalDeploymentId(read(exports.EXTERNAL_DEPLOYMENT_ID_ENV_VAR));
    if (fromEnv)
        return fromEnv;
    if (isAutomaticSkewProtectionEnabled(read)) {
        return discoverPlatformCommitSha(read);
    }
    return undefined;
}
//# sourceMappingURL=externalDeploymentId.js.map