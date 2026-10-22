import { withS2Data } from "./error.js";
import { createStream, deleteStream, ensureStream, getStreamConfig, listStreams, reconfigureStream, } from "./generated/index.js";
import { toCamelCase, toSnakeCase } from "./internal/case-transform.js";
import { provisionResultFromResponse, withS2DataAndResponse, } from "./internal/provisioning.js";
import { randomToken } from "./lib/base64.js";
import { filterAsync, paginate } from "./lib/paginate.js";
import { withRetries } from "./lib/retry.js";
function toDate(value) {
    if (value === null)
        return null;
    if (value === undefined)
        return undefined;
    return new Date(value);
}
function transformStreamInfo(stream) {
    return {
        ...stream,
        createdAt: toDate(stream.createdAt),
        deletedAt: toDate(stream.deletedAt),
    };
}
/** Convert SDK RetentionPolicy (ageSecs) to API RetentionPolicy (age). */
function toAPIRetentionPolicy(policy) {
    if (policy === null)
        return null;
    if (policy === undefined)
        return undefined;
    if ("ageSecs" in policy) {
        return { age: Math.floor(policy.ageSecs) };
    }
    return policy; // { infinite: ... } passes through
}
/** Convert API RetentionPolicy (age) to SDK RetentionPolicy (ageSecs). */
function toSDKRetentionPolicy(policy) {
    if (policy === null)
        return null;
    if (policy === undefined)
        return undefined;
    if ("age" in policy) {
        return { ageSecs: policy.age };
    }
    return policy; // { infinite: ... } passes through
}
/** Normalize deleteOnEmpty.minAgeSecs (floor and clamp to >= 0). */
function toAPIDeleteOnEmpty(deleteOnEmpty) {
    if (!deleteOnEmpty)
        return deleteOnEmpty;
    return {
        ...deleteOnEmpty,
        minAgeSecs: deleteOnEmpty.minAgeSecs === undefined
            ? undefined
            : Math.max(0, Math.floor(deleteOnEmpty.minAgeSecs)),
    };
}
/** Convert SDK StreamConfig to API format (handles retentionPolicy.ageSecs → age). */
function toAPIStreamConfig(config) {
    if (config === null || config === undefined)
        return config;
    return {
        ...config,
        deleteOnEmpty: toAPIDeleteOnEmpty(config.deleteOnEmpty),
        retentionPolicy: toAPIRetentionPolicy(config.retentionPolicy),
    };
}
/** Convert API StreamConfig to SDK format (handles retentionPolicy.age → ageSecs). */
function toSDKStreamConfig(config) {
    return {
        ...config,
        retentionPolicy: toSDKRetentionPolicy(config?.retentionPolicy),
    };
}
/**
 * Basin-scoped helper for listing and configuring streams.
 *
 * Access via {@link S2Basin.streams}. Methods inherit the basin's retry configuration.
 */
export class S2Streams {
    client;
    retryConfig;
    constructor(client, retryConfig) {
        this.client = client;
        this.retryConfig = retryConfig;
    }
    /**
     * List streams in the basin.
     *
     * @param args.prefix Return streams whose names start with the given prefix
     * @param args.startAfter Name to start after (for pagination)
     * @param args.limit Max results (up to 1000)
     */
    async list(args, options) {
        const response = await withRetries(this.retryConfig, async () => {
            return await withS2Data(() => listStreams({
                client: this.client,
                query: toSnakeCase(args),
                ...options,
            }));
        });
        const camelCased = toCamelCase(response);
        return {
            ...camelCased,
            streams: camelCased.streams.map(transformStreamInfo),
        };
    }
    /**
     * List all streams in the basin with automatic pagination.
     * Returns a lazy async iterable that fetches pages as needed.
     *
     * @param args - Optional options: `prefix` to filter by name prefix, `limit` for max results per page, `includeDeleted` to include streams pending deletion
     *
     * @example
     * ```ts
     * for await (const stream of basin.streams.listAll({ prefix: "events-" })) {
     *   console.log(stream.name);
     * }
     * ```
     */
    listAll(args, options) {
        const { includeDeleted, ...listArgs } = args ?? {};
        const allItems = paginate((a) => this.list(a, options).then((r) => ({
            items: r.streams,
            hasMore: r.hasMore,
        })), listArgs, (stream) => stream.name);
        if (includeDeleted) {
            return allItems;
        }
        return filterAsync(allItems, (s) => !s.deletedAt);
    }
    /**
     * Create a stream.
     *
     * @param args.stream Stream name (1-512 bytes, unique within the basin)
     * @param args.config Stream configuration (retentionPolicy, storageClass, timestamping, deleteOnEmpty)
     */
    async create(args, options) {
        const requestToken = randomToken();
        // Convert SDK config to API format (ageSecs → age)
        const apiArgs = {
            ...args,
            config: toAPIStreamConfig(args.config),
        };
        const response = await withRetries(this.retryConfig, async () => {
            return await withS2Data(() => createStream({
                client: this.client,
                body: toSnakeCase(apiArgs),
                headers: { "s2-request-token": requestToken },
                ...options,
            }));
        });
        return transformStreamInfo(toCamelCase(response));
    }
    /**
     * Get stream configuration.
     *
     * @param args.stream Stream name
     */
    async getConfig(args, options) {
        const response = await withRetries(this.retryConfig, async () => {
            return await withS2Data(() => getStreamConfig({
                client: this.client,
                path: args,
                ...options,
            }));
        });
        // Convert API format to SDK (age → ageSecs)
        return toSDKStreamConfig(toCamelCase(response));
    }
    /**
     * Delete a stream.
     *
     * @param args.stream Stream name
     */
    async delete(args, options) {
        await withRetries(this.retryConfig, async () => {
            return await withS2Data(() => deleteStream({
                client: this.client,
                path: args,
                ...options,
            }));
        });
    }
    /**
     * Ensure a stream.
     *
     * Creates the stream if it doesn't exist, or ensures its config exactly matches the provided
     * configuration after basin defaults and global defaults are applied. Uses HTTP PUT semantics
     * and is always idempotent.
     *
     * Returns `result: "created"` with the stream info if the stream was newly created,
     * `result: "updated"` if its config changed, or `result: "noop"` if no write was needed.
     */
    async ensure(args, options) {
        const body = args.config === undefined
            ? undefined
            : toSnakeCase(toAPIStreamConfig(args.config));
        const response = await withRetries(this.retryConfig, async () => {
            return await withS2DataAndResponse(() => ensureStream({
                client: this.client,
                path: { stream: args.stream },
                body,
                ...options,
            }));
        });
        const stream = toCamelCase(response.data);
        return {
            result: provisionResultFromResponse(response.response),
            stream: transformStreamInfo(stream),
        };
    }
    /**
     * Reconfigure a stream.
     *
     * @param args Configuration for the stream to reconfigure (including stream name and fields to change)
     */
    async reconfigure(args, options) {
        // Convert SDK config to API format (ageSecs → age)
        const { stream, ...reconfigArgs } = args;
        const apiArgs = {
            ...reconfigArgs,
            deleteOnEmpty: toAPIDeleteOnEmpty(reconfigArgs.deleteOnEmpty),
            retentionPolicy: toAPIRetentionPolicy(args.retentionPolicy),
        };
        const response = await withRetries(this.retryConfig, async () => {
            return await withS2Data(() => reconfigureStream({
                client: this.client,
                path: { stream },
                body: toSnakeCase(apiArgs),
                ...options,
            }));
        });
        // Convert API format to SDK (age → ageSecs)
        const camelCased = toCamelCase(response);
        return toSDKStreamConfig(camelCased);
    }
}
//# sourceMappingURL=streams.js.map