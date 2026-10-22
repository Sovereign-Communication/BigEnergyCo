"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultWorkerHeaders = getDefaultWorkerHeaders;
const consts_js_1 = require("../consts.js");
const util_js_1 = require("../util.js");
function getDefaultWorkerHeaders(options) {
    return (0, util_js_1.createHeaders)({
        Authorization: `Bearer ${options.workerToken}`,
        [consts_js_1.WORKER_HEADERS.INSTANCE_NAME]: options.instanceName,
        [consts_js_1.WORKER_HEADERS.DEPLOYMENT_ID]: options.deploymentId,
        [consts_js_1.WORKER_HEADERS.MANAGED_SECRET]: options.managedWorkerSecret,
    });
}
//# sourceMappingURL=util.js.map