"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.S2Locations = void 0;
const error_js_1 = require("./error.js");
const index_js_1 = require("./generated/index.js");
const case_transform_js_1 = require("./internal/case-transform.js");
const retry_js_1 = require("./lib/retry.js");
function transformLocationInfo(location) {
    return (0, case_transform_js_1.toCamelCase)(location);
}
/**
 * Account-scoped helper for listing locations and managing the default location.
 *
 * Retrieve this via {@link S2.locations}.
 */
class S2Locations {
    client;
    retryConfig;
    constructor(client, retryConfig) {
        this.client = client;
        this.retryConfig = retryConfig;
    }
    /**
     * List available locations.
     */
    async list(options) {
        const response = await (0, retry_js_1.withRetries)(this.retryConfig, async () => {
            return await (0, error_js_1.withS2Data)(() => (0, index_js_1.listLocations)({
                client: this.client,
                ...options,
            }));
        });
        return response.map(transformLocationInfo);
    }
    /**
     * Get the default location used when creating basins without an explicit location.
     */
    async getDefault(options) {
        const response = await (0, retry_js_1.withRetries)(this.retryConfig, async () => {
            return await (0, error_js_1.withS2Data)(() => (0, index_js_1.getDefaultLocation)({
                client: this.client,
                ...options,
            }));
        });
        return transformLocationInfo(response);
    }
    /**
     * Set the default location used when creating basins without an explicit location.
     *
     * @param args.location Location name
     */
    async setDefault(args, options) {
        const response = await (0, retry_js_1.withRetries)(this.retryConfig, async () => {
            return await (0, error_js_1.withS2Data)(() => (0, index_js_1.setDefaultLocation)({
                client: this.client,
                body: args.location,
                ...options,
            }));
        });
        return transformLocationInfo(response);
    }
}
exports.S2Locations = S2Locations;
//# sourceMappingURL=locations.js.map