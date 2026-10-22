export const EXTERNAL_DEPLOYMENT_ID_ENV_VAR = "TRIGGER_EXTERNAL_DEPLOYMENT_ID";
export const AUTOMATIC_SKEW_PROTECTION_ENV_VAR = "TRIGGER_AUTOMATIC_SKEW_VERSION_PROTECTION";
export const EXTERNAL_DEPLOYMENT_ID_MAX_LENGTH = 128;
export const PLATFORM_COMMIT_SHA_ENV_VARS = [
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
export function normalizeExternalDeploymentId(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    if (trimmed === "" || trimmed.length > EXTERNAL_DEPLOYMENT_ID_MAX_LENGTH) {
        return undefined;
    }
    return trimmed;
}
export function isAutomaticSkewProtectionEnabled(read) {
    const raw = read(AUTOMATIC_SKEW_PROTECTION_ENV_VAR);
    if (typeof raw !== "string") {
        return false;
    }
    const normalized = raw.trim().toLowerCase();
    return normalized === "1" || normalized === "true";
}
export function discoverPlatformCommitSha(read) {
    for (const name of PLATFORM_COMMIT_SHA_ENV_VARS) {
        const candidate = normalizeExternalDeploymentId(read(name));
        if (candidate) {
            return candidate;
        }
    }
    return undefined;
}
export function resolveExternalDeploymentId({ explicit, clientConfig, read, }) {
    const fromCall = normalizeExternalDeploymentId(explicit);
    if (fromCall)
        return fromCall;
    const fromClient = normalizeExternalDeploymentId(clientConfig);
    if (fromClient)
        return fromClient;
    const fromEnv = normalizeExternalDeploymentId(read(EXTERNAL_DEPLOYMENT_ID_ENV_VAR));
    if (fromEnv)
        return fromEnv;
    if (isAutomaticSkewProtectionEnabled(read)) {
        return discoverPlatformCommitSha(read);
    }
    return undefined;
}
//# sourceMappingURL=externalDeploymentId.js.map