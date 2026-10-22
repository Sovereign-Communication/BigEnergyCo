import type { RetryConfig, S2RequestOptions } from "./common.js";
import type { Client } from "./generated/client/types.gen.js";
import type * as Types from "./types.js";
/**
 * Account-scoped helper for listing locations and managing the default location.
 *
 * Retrieve this via {@link S2.locations}.
 */
export declare class S2Locations {
    private readonly client;
    private readonly retryConfig;
    constructor(client: Client, retryConfig: RetryConfig);
    /**
     * List available locations.
     */
    list(options?: S2RequestOptions): Promise<Types.ListLocationsResponse>;
    /**
     * Get the default location used when creating basins without an explicit location.
     */
    getDefault(options?: S2RequestOptions): Promise<Types.GetDefaultLocationResponse>;
    /**
     * Set the default location used when creating basins without an explicit location.
     *
     * @param args.location Location name
     */
    setDefault(args: Types.SetDefaultLocationInput, options?: S2RequestOptions): Promise<Types.SetDefaultLocationResponse>;
}
//# sourceMappingURL=locations.d.ts.map