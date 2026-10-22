import { WORKER_HEADERS } from "../consts.js";
import { createHeaders } from "../util.js";
export function getDefaultWorkerHeaders(options) {
    return createHeaders({
        Authorization: `Bearer ${options.workerToken}`,
        [WORKER_HEADERS.INSTANCE_NAME]: options.instanceName,
        [WORKER_HEADERS.DEPLOYMENT_ID]: options.deploymentId,
        [WORKER_HEADERS.MANAGED_SECRET]: options.managedWorkerSecret,
    });
}
//# sourceMappingURL=util.js.map