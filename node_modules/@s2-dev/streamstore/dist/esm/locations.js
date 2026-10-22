import { withS2Data } from "./error.js";
import { getDefaultLocation, listLocations, setDefaultLocation, } from "./generated/index.js";
import { toCamelCase } from "./internal/case-transform.js";
import { withRetries } from "./lib/retry.js";
function transformLocationInfo(location) {
    return toCamelCase(location);
}
/**
 * Account-scoped helper for listing locations and managing the default location.
 *
 * Retrieve this via {@link S2.locations}.
 */
export class S2Locations {
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
        const response = await withRetries(this.retryConfig, async () => {
            return await withS2Data(() => listLocations({
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
        const response = await withRetries(this.retryConfig, async () => {
            return await withS2Data(() => getDefaultLocation({
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
        const response = await withRetries(this.retryConfig, async () => {
            return await withS2Data(() => setDefaultLocation({
                client: this.client,
                body: args.location,
                ...options,
            }));
        });
        return transformLocationInfo(response);
    }
}
//# sourceMappingURL=locations.js.map