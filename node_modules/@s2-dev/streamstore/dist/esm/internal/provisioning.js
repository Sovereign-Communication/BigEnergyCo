import { S2Error, withS2Error } from "../error.js";
const PROVISION_RESULT_HEADER = "s2-provision-result";
export function provisionResultFromResponse(response) {
    const value = response?.headers?.get(PROVISION_RESULT_HEADER);
    if (value === "created" || value === "updated" || value === "noop") {
        return value;
    }
    return response?.status === 201 ? "created" : "updated";
}
export async function withS2DataAndResponse(fn) {
    const result = (await withS2Error(fn));
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
        throw new S2Error({
            message: "Empty response",
            status: response?.status ?? 500,
            origin: "server",
        });
    }
    return { data: result };
}
//# sourceMappingURL=provisioning.js.map