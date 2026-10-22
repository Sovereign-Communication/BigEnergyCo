export type RuntimeEnvironmentType = "PRODUCTION" | "STAGING" | "DEVELOPMENT" | "PREVIEW";
export type RunEngineVersion = "V1" | "V2";
type DecimalLike = {
    toNumber(): number;
};
export type AuthenticatedEnvironment = {
    id: string;
    slug: string;
    type: RuntimeEnvironmentType;
    apiKey: string;
    organizationId: string;
    projectId: string;
    orgMemberId: string | null;
    parentEnvironmentId: string | null;
    branchName: string | null;
    archivedAt: Date | null;
    paused: boolean;
    shortcode: string;
    maximumConcurrencyLimit: number;
    concurrencyLimitBurstFactor: number | DecimalLike;
    builtInEnvironmentVariableOverrides: unknown;
    createdAt: Date;
    updatedAt: Date;
    project: {
        id: string;
        slug: string;
        name: string;
        externalRef: string;
        engine: RunEngineVersion;
        deletedAt: Date | null;
        defaultWorkerGroupId: string | null;
        organizationId: string;
        builderProjectId: string | null;
        defaultRuntime?: string | null;
    };
    organization: {
        id: string;
        slug: string;
        title: string;
        streamBasinName: string | null;
        maximumConcurrencyLimit: number | null;
        runsEnabled: boolean;
        maximumDevQueueSize: number | null;
        maximumDeployedQueueSize: number | null;
        featureFlags: unknown;
        apiRateLimiterConfig: unknown;
        batchRateLimitConfig: unknown;
        batchQueueConcurrencyConfig: unknown;
    };
    orgMember?: {
        userId: string;
        user?: {
            id: string;
            displayName: string | null;
            name: string | null;
        };
    } | null;
    parentEnvironment?: {
        id: string;
        apiKey: string;
    } | null;
};
export {};
