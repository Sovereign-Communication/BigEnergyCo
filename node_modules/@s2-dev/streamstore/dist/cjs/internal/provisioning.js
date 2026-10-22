"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.provisionResultFromResponse = provisionResultFromResponse;
exports.withS2DataAndResponse = withS2DataAndResponse;
const error_js_1 = require("../error.js");
const PROVISION_RESULT_HEADER = "s2-provision-result";
function provisionResultFromResponse(response) {
    const value = response?.headers?.get(PROVISION_RESULT_HEADER);
    if (value === "created" || value === "updated" || value === "noop") {
        return value;
    }
    return response?.status === 201 ? "created" : "updated";
}
async function withS2DataAndResponse(fn) {
    const result = (await (0, error_js_1.withS2Error)(fn));
    if (result &&
        typeof result === "object" &&
        (Object.prototype.hasOwnProperty.call(result, "data") ||
            Object.prototype.hasOwnProperty.call(result, "response") ||
            Object.prototype.hasOwnProperty.call(result, "error"))) {
        const response = result.response;
        const data = result.data;
        if (typeof data !== "undefined") {
            return { data, response };
        }
        throw new error_js_1.S2Error({
            message: "Empty response",
            status: response?.status ?? 500,
            origin: "server",
        });
    }
    return { data: result };
}
//# sourceMappingURL=provisioning.js.map