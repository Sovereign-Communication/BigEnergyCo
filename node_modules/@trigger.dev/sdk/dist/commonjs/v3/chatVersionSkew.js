"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePinToFollow = resolvePinToFollow;
const v3_1 = require("@trigger.dev/core/v3");
async function resolvePinToFollow(options) {
    if (options.policy === "hold") {
        return undefined;
    }
    if (options.upgradeAlreadyRequested) {
        return undefined;
    }
    if (!options.deployedExternalId) {
        return undefined;
    }
    const [error, pin] = await (0, v3_1.tryCatch)(options.readPin());
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