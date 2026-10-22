import { tryCatch } from "@trigger.dev/core/v3";
export async function resolvePinToFollow(options) {
    if (options.policy === "hold") {
        return undefined;
    }
    if (options.upgradeAlreadyRequested) {
        return undefined;
    }
    if (!options.deployedExternalId) {
        return undefined;
    }
    const [error, pin] = await tryCatch(options.readPin());
    if (error || !pin) {
        return undefined;
    }
    if (!pin.externalDeploymentId) {
        return undefined;
    }
    if (pin.lockToVersion) {
        return undefined;
    }
    if (pin.externalDeploymentId === options.deployedExternalId) {
        return undefined;
    }
    return pin.externalDeploymentId;
}
//# sourceMappingURL=chatVersionSkew.js.map