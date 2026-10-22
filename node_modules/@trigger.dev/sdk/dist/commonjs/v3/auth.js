"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = void 0;
exports.configure = configure;
const v3_1 = require("@trigger.dev/core/v3");
require("@trigger.dev/core/v3/sdk-scope-storage");
/**
 * Register the global API client configuration. Alternatively, you can set the `TRIGGER_SECRET_KEY` and `TRIGGER_API_URL` environment variables.
 * @param options The API client configuration.
 * @param options.baseURL The base URL of the Trigger API. (default: `https://api.trigger.dev`)
 * @param options.accessToken The accessToken to authenticate with the Trigger API. (default: `process.env.TRIGGER_SECRET_KEY`) This can be found in your Trigger.dev project "API Keys" settings.
 *
 * @example
 *
 * ```typescript
 * import { configure } from "@trigger.dev/sdk/v3";
 *
 * configure({
 *  baseURL: "https://api.trigger.dev",
 *  accessToken: "tr_dev_1234567890"
 * });
 * ```
 */
function configure(options) {
    v3_1.apiClientManager.setGlobalAPIClientConfiguration(options);
}
exports.auth = {
    configure,
    createPublicToken,
    createTriggerPublicToken,
    createBatchTriggerPublicToken,
    withAuth,
    withPublicToken,
    withTriggerPublicToken,
    withBatchTriggerPublicToken,
};
// A `Date` becomes Unix seconds; duration strings and numbers pass through. A
// bare number is already Unix seconds, matching how the local signing path
// reads it, so both key types treat the option the same.
function serverExpirationTime(expirationTime) {
    return expirationTime instanceof Date
        ? Math.floor(expirationTime.getTime() / 1000)
        : expirationTime;
}
async function createServerPublicToken(apiClient, body) {
    try {
        const result = await apiClient.createPublicToken(body);
        return result.token;
    }
    catch (error) {
        if (error !== null && typeof error === "object" && "status" in error && error.status === 404) {
            throw new Error("This additional API key cannot self-sign public tokens, and the server does not support public-token minting. Upgrade the server or use the root API key.");
        }
        throw error;
    }
}
/**
 * Creates a public token using the provided options.
 *
 * @param options - Optional parameters for creating the public token.
 * @param options.scopes - An array of permission scopes to be included in the token.
 * @param options.expirationTime - The expiration time for the token.
 * @param options.realtime - Options for realtime subscriptions.
 * @param options.realtime.skipColumns - Skip columns from the subscription.
 * @returns A promise that resolves to a string representing the generated public token.
 *
 * @example
 *
 * ```typescript
 * import { auth } from "@trigger.dev/sdk/v3";
 *
 * const publicToken = await auth.createPublicToken({
 *  scopes: {
 *   read: {
 *     tags: ["file:1234"]
 *   }
 * });
 * ```
 */
async function createPublicToken(options) {
    const scopes = options?.scopes ? flattenScopes(options.scopes) : [];
    const apiClient = v3_1.apiClientManager.clientOrThrow();
    if ((0, v3_1.isAdditionalApiKey)(apiClient.accessToken)) {
        // Additional keys cannot self-sign, and the server rejects empty scope
        // lists because they cannot authorize anything. Keep the legacy root-key
        // behaviour unchanged while failing clearly for this new credential type.
        if (scopes.length === 0) {
            throw new Error("auth.createPublicToken() requires at least one scope when using an additional API key. " +
                'For example: auth.createPublicToken({ scopes: { read: { runs: ["run_1234"] } } })');
        }
        return createServerPublicToken(apiClient, {
            scopes,
            expirationTime: serverExpirationTime(options?.expirationTime),
            realtime: options?.realtime,
        });
    }
    const claims = await apiClient.generateJWTClaims();
    return await (0, v3_1.generateJWT)({
        secretKey: apiClient.accessToken,
        payload: {
            ...claims,
            scopes: options?.scopes ? scopes : undefined,
            realtime: options?.realtime,
        },
        expirationTime: options?.expirationTime,
    });
}
/**
 * Executes a function with a public token, providing temporary access permissions.
 *
 * @param options - Options for creating the public token.
 * @param fn - The asynchronous function to be executed with the public token.
 */
async function withPublicToken(options, fn) {
    const token = await createPublicToken(options);
    await withAuth({ accessToken: token }, fn);
}
/**
 * Creates a one-time use token to trigger a specific task.
 *
 * @param task - The task ID or an array of task IDs that the token should allow triggering.
 * @param options - Options for creating the one-time use token.
 * @returns A promise that resolves to a string representing the generated one-time use token.
 *
 * @example
 * Create a one-time use public token that allows triggering a specific task:
 *
 * ```ts
 * import { auth } from "@trigger.dev/sdk/v3";
 *
 * const token = await auth.createTriggerPublicToken("my-task");
 * ```
 *
 * @example You can also create a one-time use token that allows triggering multiple tasks:
 *
 * ```ts
 * import { auth } from "@trigger.dev/sdk/v3";
 *
 * const token = await auth.createTriggerPublicToken(["task1", "task2"]);
 * ```
 *
 * @example You can also create a one-time use token that allows triggering a task with a specific expiration time:
 *
 * ```ts
 * import { auth } from "@trigger.dev/sdk/v3";
 *
 * const token = await auth.createTriggerPublicToken("my-task", { expirationTime: "1h" });
 * ```
 */
async function createTriggerPublicToken(task, options) {
    const apiClient = v3_1.apiClientManager.clientOrThrow();
    const scopes = flattenScopes({
        trigger: {
            tasks: task,
        },
    });
    const oneTimeUse = typeof options?.multipleUse === "boolean" ? !options.multipleUse : true;
    if ((0, v3_1.isAdditionalApiKey)(apiClient.accessToken)) {
        return createServerPublicToken(apiClient, {
            scopes,
            expirationTime: serverExpirationTime(options?.expirationTime),
            oneTimeUse,
            realtime: options?.realtime,
        });
    }
    const claims = await apiClient.generateJWTClaims();
    return await (0, v3_1.generateJWT)({
        secretKey: apiClient.accessToken,
        payload: {
            ...claims,
            otu: oneTimeUse,
            realtime: options?.realtime,
            scopes,
        },
        expirationTime: options?.expirationTime,
    });
}
/**
 * Executes a function with a one-time use token that allows triggering a specific task.
 *
 * @param task - The task ID or an array of task IDs that the token should allow triggering.
 * @param options - Options for creating the one-time use token.
 * @param fn - The asynchronous function to be executed with the one-time use token.
 */
async function withTriggerPublicToken(task, options = {}, fn) {
    const token = await createTriggerPublicToken(task, options);
    await withAuth({ accessToken: token }, fn);
}
/**
 * Creates a one-time use token to batch trigger a specific task or tasks.
 *
 * @param task - The task ID or an array of task IDs that the token should allow triggering.
 * @param options - Options for creating the one-time use token.
 * @returns A promise that resolves to a string representing the generated one-time use token.
 *
 * @example
 *
 * ```ts
 * import { auth } from "@trigger.dev/sdk/v3";
 *
 * const token = await auth.createBatchTriggerPublicToken("my-task");
 * ```
 *
 * @example You can also create a one-time use token that allows batch triggering multiple tasks:
 *
 * ```ts
 * import { auth } from "@trigger.dev/sdk/v3";
 *
 * const token = await auth.createBatchTriggerPublicToken(["task1", "task2"]);
 * ```
 *
 * @example You can also create a one-time use token that allows batch triggering a task with a specific expiration time:
 *
 * ```ts
 * import { auth } from "@trigger.dev/sdk/v3";
 *
 * const token = await auth.createBatchTriggerPublicToken("my-task", { expirationTime: "1h" });
 * ```
 */
async function createBatchTriggerPublicToken(task, options) {
    const apiClient = v3_1.apiClientManager.clientOrThrow();
    const scopes = flattenScopes({
        batchTrigger: {
            tasks: task,
        },
    });
    const oneTimeUse = typeof options?.multipleUse === "boolean" ? !options.multipleUse : true;
    if ((0, v3_1.isAdditionalApiKey)(apiClient.accessToken)) {
        return createServerPublicToken(apiClient, {
            scopes,
            expirationTime: serverExpirationTime(options?.expirationTime),
            oneTimeUse,
            realtime: options?.realtime,
        });
    }
    const claims = await apiClient.generateJWTClaims();
    return await (0, v3_1.generateJWT)({
        secretKey: apiClient.accessToken,
        payload: {
            ...claims,
            otu: oneTimeUse,
            realtime: options?.realtime,
            scopes,
        },
        expirationTime: options?.expirationTime,
    });
}
/**
 * Executes a function with a one-time use token that allows triggering a specific task.
 *
 * @param task - The task ID or an array of task IDs that the token should allow triggering.
 * @param options - Options for creating the one-time use token.
 * @param fn - The asynchronous function to be executed with the one-time use token.
 */
async function withBatchTriggerPublicToken(task, options = {}, fn) {
    const token = await createBatchTriggerPublicToken(task, options);
    await withAuth({ accessToken: token }, fn);
}
/**
 * Executes a provided asynchronous function with a specified API client configuration.
 *
 * @template R - The type of the asynchronous function to be executed.
 * @param {ApiClientConfiguration} config - The configuration for the API client.
 * @param {R} fn - The asynchronous function to be executed.
 * @returns {Promise<ReturnType<R>>} A promise that resolves to the return type of the provided function.
 */
async function withAuth(config, fn) {
    return v3_1.apiClientManager.runWithConfig(config, fn);
}
function flattenScopes(permissions) {
    const flattenedPermissions = [];
    for (const [action, properties] of Object.entries(permissions)) {
        if (properties) {
            if (typeof properties === "boolean" && properties) {
                flattenedPermissions.push(action);
            }
            else if (typeof properties === "object") {
                for (const [property, value] of Object.entries(properties)) {
                    if (Array.isArray(value)) {
                        for (const item of value) {
                            flattenedPermissions.push(scopeWithResourceId(action, property, item));
                        }
                    }
                    else if (typeof value === "string") {
                        flattenedPermissions.push(scopeWithResourceId(action, property, value));
                    }
                    else if (typeof value === "boolean" && value) {
                        flattenedPermissions.push(`${action}:${property}`);
                    }
                }
            }
        }
    }
    return flattenedPermissions;
}
function scopeWithResourceId(action, resource, id) {
    if (!id.trim()) {
        throw new Error("Public token scope resource IDs must not be empty");
    }
    return `${action}:${resource}:${id}`;
}
//# sourceMappingURL=auth.js.map