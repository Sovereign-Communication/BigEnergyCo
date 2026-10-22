"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployments = void 0;
const v3_1 = require("@trigger.dev/core/v3");
exports.deployments = {
    retrieveCurrent: retrieveCurrentDeployment,
    list: listDeployments,
};
/**
 * Retrieve the currently promoted deployment for this environment.
 *
 * Use inside a task to check whether a newer version has been deployed:
 *
 * ```ts
 * import { deployments } from "@trigger.dev/sdk";
 *
 * const current = await deployments.retrieveCurrent();
 * if (current.version !== ctx.run.version) {
 *   // A newer version is promoted
 * }
 * ```
 */
function retrieveCurrentDeployment(requestOptions) {
    const apiClient = v3_1.apiClientManager.clientOrThrow();
    return apiClient.retrieveCurrentDeployment(requestOptions);
}
/**
 * List deployments for the current environment.
 */
function listDeployments(options, requestOptions) {
    const apiClient = v3_1.apiClientManager.clientOrThrow();
    if ((0, v3_1.isRequestOptions)(options)) {
        return apiClient.listDeployments(undefined, options);
    }
    return apiClient.listDeployments(options, requestOptions);
}
//# sourceMappingURL=deployments.js.map