export declare const EXTERNAL_DEPLOYMENT_ID_ENV_VAR = "TRIGGER_EXTERNAL_DEPLOYMENT_ID";
export declare const AUTOMATIC_SKEW_PROTECTION_ENV_VAR = "TRIGGER_AUTOMATIC_SKEW_VERSION_PROTECTION";
export declare const EXTERNAL_DEPLOYMENT_ID_MAX_LENGTH = 128;
export type EnvVarReader = (name: string) => string | undefined;
export declare const PLATFORM_COMMIT_SHA_ENV_VARS: readonly ["VERCEL_GIT_COMMIT_SHA", "RAILWAY_GIT_COMMIT_SHA", "RENDER_GIT_COMMIT", "CF_PAGES_COMMIT_SHA", "WORKERS_CI_COMMIT_SHA", "COMMIT_REF", "AWS_COMMIT_ID", "HEROKU_BUILD_COMMIT", "HEROKU_SLUG_COMMIT", "KOYEB_GIT_SHA", "GITHUB_SHA", "CI_COMMIT_SHA", "CIRCLE_SHA1", "BITBUCKET_COMMIT", "BUILDKITE_COMMIT", "BUILD_SOURCEVERSION", "COMMIT_SHA", "DRONE_COMMIT_SHA", "GIT_COMMIT", "BUILD_VCS_NUMBER", "TRAVIS_COMMIT", "COMMIT_SHA", "COMMIT_HASH", "GIT_COMMIT", "GIT_SHA", "GIT_HASH"];
export declare function normalizeExternalDeploymentId(value: string | undefined): string | undefined;
export declare function isAutomaticSkewProtectionEnabled(read: EnvVarReader): boolean;
export declare function discoverPlatformCommitSha(read: EnvVarReader): string | undefined;
export type ResolveExternalDeploymentIdOptions = {
    explicit?: string;
    clientConfig?: string;
    read: EnvVarReader;
};
export declare function resolveExternalDeploymentId({ explicit, clientConfig, read, }: ResolveExternalDeploymentIdOptions): string | undefined;
