"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareDeploymentVersions = compareDeploymentVersions;
function compareDeploymentVersions(versionA, versionB) {
    const [dateA = "", numberA] = versionA.split(".");
    const [dateB = "", numberB] = versionB.split(".");
    if (dateA < dateB) {
        return -1;
    }
    if (dateA > dateB) {
        return 1;
    }
    const numA = Number(numberA);
    const numB = Number(numberB);
    if (numA < numB) {
        return -1;
    }
    if (numA > numB) {
        return 1;
    }
    return 0;
}
//# sourceMappingURL=deploymentVersions.js.map