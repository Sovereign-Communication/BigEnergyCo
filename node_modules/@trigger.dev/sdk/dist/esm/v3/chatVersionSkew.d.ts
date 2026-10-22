export type ChatVersionSkewPolicy = "follow" | "hold";
export type SessionVersionPin = {
    externalDeploymentId?: string | null;
    lockToVersion?: string;
};
export type ResolvePinToFollowOptions = {
    policy: ChatVersionSkewPolicy | undefined;
    deployedExternalId: string | undefined;
    upgradeAlreadyRequested: boolean;
    readPin: () => Promise<SessionVersionPin | undefined>;
};
export declare function resolvePinToFollow(options: ResolvePinToFollowOptions): Promise<string | undefined>;
