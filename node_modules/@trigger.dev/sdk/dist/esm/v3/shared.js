import { SpanKind } from "@opentelemetry/api";
import { accessoryAttributes, apiClientManager, ApiError, conditionallyExportPacket, conditionallyImportPacket, convertToolParametersToSchema, createErrorFromCauses, createErrorTaskError, defaultRetryOptions, flattenIdempotencyKey, generateFriendlyId, getIdempotencyKeyOptions, getSchemaParseFn, lifecycleHooks, makeIdempotencyKey, packetRequiresOffloading, parsePacket, RateLimitError, resourceCatalog, runtime, SemanticInternalAttributes, stringifyIO, SubtaskUnwrapError, taskContext, TaskRunPromise, } from "@trigger.dev/core/v3";
import { resolveTriggerExternalDeploymentId, scopedEnvVar } from "./externalDeploymentId.js";
import { tracer } from "./tracer.js";
export { SubtaskUnwrapError, TaskRunPromise };
export function queue(options) {
    resourceCatalog.registerQueueMetadata(options);
    // @ts-expect-error
    options[Symbol.for("trigger.dev/queue")] = true;
    return options;
}
export function createTask(params) {
    const task = {
        id: params.id,
        description: params.description,
        jsonSchema: params.jsonSchema,
        trigger: async (payload, options) => {
            return await trigger_internal("trigger()", params.id, payload, undefined, {
                queue: params.queue?.name,
                ...options,
            });
        },
        batchTrigger: async (items, options) => {
            return await batchTrigger_internal("batchTrigger()", params.id, items, options, undefined, undefined, params.queue?.name);
        },
        triggerAndWait: (payload, options, requestOptions) => {
            return new TaskRunPromise((resolve, reject) => {
                triggerAndWait_internal("triggerAndWait()", params.id, payload, undefined, {
                    queue: params.queue?.name,
                    ...options,
                }, requestOptions)
                    .then((result) => {
                    resolve(result);
                })
                    .catch((error) => {
                    reject(error);
                });
            }, params.id);
        },
        triggerAndSubscribe: (payload, options) => {
            return new TaskRunPromise((resolve, reject) => {
                triggerAndSubscribe_internal("triggerAndSubscribe()", params.id, payload, undefined, {
                    queue: params.queue?.name,
                    ...options,
                })
                    .then((result) => {
                    resolve(result);
                })
                    .catch((error) => {
                    reject(error);
                });
            }, params.id);
        },
        batchTriggerAndWait: async (items, options) => {
            return await batchTriggerAndWait_internal("batchTriggerAndWait()", params.id, items, undefined, options, undefined, params.queue?.name);
        },
    };
    registerTaskLifecycleHooks(params.id, params);
    resourceCatalog.registerTaskMetadata({
        id: params.id,
        description: params.description,
        queue: params.queue,
        retry: params.retry ? { ...defaultRetryOptions, ...params.retry } : undefined,
        machine: typeof params.machine === "string" ? { preset: params.machine } : params.machine,
        triggerSource: params.triggerSource,
        agentConfig: params.agentConfig,
        maxDuration: params.maxDuration,
        ttl: params.ttl,
        payloadSchema: params.jsonSchema,
        fns: {
            run: params.run,
        },
    });
    const queue = params.queue;
    if (queue && typeof queue.name === "string") {
        resourceCatalog.registerQueueMetadata({
            name: queue.name,
            concurrencyLimit: queue.concurrencyLimit,
        });
    }
    // @ts-expect-error
    task[Symbol.for("trigger.dev/task")] = true;
    return task;
}
/**
 * @deprecated Use `schemaTask` plus AI SDK `tool()` with `execute: ai.toolExecute(task)` instead.
 */
export function createToolTask(params) {
    const task = createSchemaTask({
        ...params,
        schema: convertToolParametersToSchema(params.parameters),
    });
    return {
        ...task,
        tool: {
            parameters: params.parameters,
            description: params.description,
            execute: async (args) => {
                return task.triggerAndWait(args).unwrap();
            },
        },
    };
}
export function createSchemaTask(params) {
    const parsePayload = params.schema
        ? getSchemaParseFn(params.schema)
        : undefined;
    const task = {
        id: params.id,
        description: params.description,
        schema: params.schema,
        trigger: async (payload, options, requestOptions) => {
            return await trigger_internal("trigger()", params.id, payload, parsePayload, {
                queue: params.queue?.name,
                ...options,
            }, requestOptions);
        },
        batchTrigger: async (items, options, requestOptions) => {
            return await batchTrigger_internal("batchTrigger()", params.id, items, options, parsePayload, requestOptions, params.queue?.name);
        },
        triggerAndWait: (payload, options) => {
            return new TaskRunPromise((resolve, reject) => {
                triggerAndWait_internal("triggerAndWait()", params.id, payload, parsePayload, {
                    queue: params.queue?.name,
                    ...options,
                })
                    .then((result) => {
                    resolve(result);
                })
                    .catch((error) => {
                    reject(error);
                });
            }, params.id);
        },
        triggerAndSubscribe: (payload, options) => {
            return new TaskRunPromise((resolve, reject) => {
                triggerAndSubscribe_internal("triggerAndSubscribe()", params.id, payload, parsePayload, {
                    queue: params.queue?.name,
                    ...options,
                })
                    .then((result) => {
                    resolve(result);
                })
                    .catch((error) => {
                    reject(error);
                });
            }, params.id);
        },
        batchTriggerAndWait: async (items, options) => {
            return await batchTriggerAndWait_internal("batchTriggerAndWait()", params.id, items, parsePayload, options, undefined, params.queue?.name);
        },
    };
    registerTaskLifecycleHooks(params.id, params);
    resourceCatalog.registerTaskMetadata({
        id: params.id,
        description: params.description,
        queue: params.queue,
        retry: params.retry ? { ...defaultRetryOptions, ...params.retry } : undefined,
        machine: typeof params.machine === "string" ? { preset: params.machine } : params.machine,
        triggerSource: params.triggerSource,
        agentConfig: params.agentConfig,
        maxDuration: params.maxDuration,
        ttl: params.ttl,
        fns: {
            run: params.run,
            parsePayload,
        },
        schema: params.schema,
    });
    const queue = params.queue;
    if (queue && typeof queue.name === "string") {
        resourceCatalog.registerQueueMetadata({
            name: queue.name,
            concurrencyLimit: queue.concurrencyLimit,
        });
    }
    // @ts-expect-error
    task[Symbol.for("trigger.dev/task")] = true;
    return task;
}
/**
 * Trigger a task by its identifier with the given payload. Returns a typesafe `RunHandle`.
 *
 * @example
 *
 * ```ts
 * import { tasks, runs } from "@trigger.dev/sdk/v3";
 * import type { myTask } from "./myTasks"; // Import just the type of the task
 *
 * const handle = await tasks.trigger<typeof myTask>("my-task", { foo: "bar" }); // The id and payload are fully typesafe
 * const run = await runs.retrieve(handle);
 * console.log(run.output) // The output is also fully typed
 * ```
 *
 * @returns {RunHandle} An object with the `id` of the run. Can be used to retrieve the completed run output in a typesafe manner.
 */
export async function trigger(id, payload, options, requestOptions) {
    return await trigger_internal("tasks.trigger()", id, payload, undefined, options, requestOptions);
}
/**
 * Trigger a task with the given payload, and wait for the result. Returns the result of the task run
 * @param id - The id of the task to trigger
 * @param payload
 * @param options - Options for the task run
 * @returns TaskRunResult
 * @example
 * ```ts
 * import { tasks } from "@trigger.dev/sdk/v3";
 * const result = await tasks.triggerAndWait("my-task", { foo: "bar" });
 *
 * if (result.ok) {
 *  console.log(result.output);
 * } else {
 *  console.error(result.error);
 * }
 * ```
 */
export function triggerAndWait(id, payload, options, requestOptions) {
    return new TaskRunPromise((resolve, reject) => {
        triggerAndWait_internal("tasks.triggerAndWait()", id, payload, undefined, options, requestOptions)
            .then((result) => {
            resolve(result);
        })
            .catch((error) => {
            reject(error);
        });
    }, id);
}
/**
 * Trigger a task and subscribe to its updates via realtime. Unlike `triggerAndWait`,
 * this does NOT suspend the parent run — the parent stays alive and subscribes to updates.
 * This enables parallel execution and proper abort signal handling.
 *
 * @param id - The id of the task to trigger
 * @param payload
 * @param options - Options for the task run, including an optional `signal` to cancel the subscription and child run
 * @returns TaskRunPromise
 * @example
 * ```ts
 * import { tasks } from "@trigger.dev/sdk/v3";
 * const result = await tasks.triggerAndSubscribe("my-task", { foo: "bar" });
 *
 * if (result.ok) {
 *   console.log(result.output);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export function triggerAndSubscribe(id, payload, options, requestOptions) {
    return new TaskRunPromise((resolve, reject) => {
        triggerAndSubscribe_internal("tasks.triggerAndSubscribe()", id, payload, undefined, options, requestOptions)
            .then((result) => {
            resolve(result);
        })
            .catch((error) => {
            reject(error);
        });
    }, id);
}
/**
 * Batch trigger multiple task runs with the given payloads, and wait for the results. Returns the results of the task runs.
 * @param id - The id of the task to trigger
 * @param items
 * @returns BatchResult
 * @example
 *
 * ```ts
 * import { tasks } from "@trigger.dev/sdk/v3";
 *
 * const result = await tasks.batchTriggerAndWait("my-task", [
 *  { payload: { foo: "bar" } },
 *  { payload: { foo: "baz" } },
 * ]);
 *
 * for (const run of result.runs) {
 *  if (run.ok) {
 *    console.log(run.output);
 *  } else {
 *    console.error(run.error);
 *  }
 * }
 * ```
 */
export async function batchTriggerAndWait(id, items, options, requestOptions) {
    return await batchTriggerAndWait_internal("tasks.batchTriggerAndWait()", id, items, undefined, options, requestOptions);
}
export async function batchTrigger(id, items, options, requestOptions) {
    return await batchTrigger_internal("tasks.batchTrigger()", id, items, options, undefined, requestOptions);
}
// Implementation
export async function batchTriggerById(...args) {
    const [items, options, requestOptions] = args;
    const apiClient = apiClientManager.clientOrThrow(requestOptions?.clientConfig);
    // Check if items is an array or a stream
    if (Array.isArray(items)) {
        // Array path: existing logic
        const ndJsonItems = await Promise.all(items.map(async (item, index) => {
            const taskMetadata = resourceCatalog.getTask(item.id);
            const parsedPayload = taskMetadata?.fns.parsePayload
                ? await taskMetadata?.fns.parsePayload(item.payload)
                : item.payload;
            const payloadPacket = await stringifyIO(parsedPayload);
            const batchItemIdempotencyKey = await makeIdempotencyKey(flattenIdempotencyKey([options?.idempotencyKey, `${index}`]));
            return {
                index,
                task: item.id,
                payload: payloadPacket.data,
                options: {
                    queue: item.options?.queue ? { name: item.options.queue } : undefined,
                    concurrencyKey: item.options?.concurrencyKey,
                    test: taskContext.ctx?.run.isTest,
                    payloadType: payloadPacket.dataType,
                    delay: item.options?.delay,
                    ttl: item.options?.ttl,
                    tags: item.options?.tags,
                    maxAttempts: item.options?.maxAttempts,
                    metadata: item.options?.metadata,
                    maxDuration: item.options?.maxDuration,
                    idempotencyKey: (await makeIdempotencyKey(item.options?.idempotencyKey)) ?? batchItemIdempotencyKey,
                    idempotencyKeyTTL: item.options?.idempotencyKeyTTL ?? options?.idempotencyKeyTTL,
                    machine: item.options?.machine,
                    priority: item.options?.priority,
                    region: item.options?.region,
                    lockToVersion: item.options?.version ?? scopedEnvVar("TRIGGER_VERSION"),
                    externalDeploymentId: resolveTriggerExternalDeploymentId(item.options?.externalDeploymentId),
                    debounce: item.options?.debounce,
                },
            };
        }));
        // Execute 2-phase batch
        const response = await tracer.startActiveSpan("batch.trigger()", async (span) => {
            const result = await executeBatchTwoPhase(apiClient, ndJsonItems, {
                parentRunId: taskContext.ctx?.run.id,
                idempotencyKey: await makeIdempotencyKey(options?.idempotencyKey),
                spanParentAsLink: true, // Fire-and-forget: child runs get separate trace IDs
            }, requestOptions);
            span.setAttribute("batchId", result.id);
            span.setAttribute("runCount", result.runCount);
            return result;
        }, {
            kind: SpanKind.PRODUCER,
            attributes: {
                [SemanticInternalAttributes.STYLE_ICON]: "trigger",
            },
        });
        const handle = {
            batchId: response.id,
            runCount: response.runCount,
            publicAccessToken: response.publicAccessToken,
        };
        return handle;
    }
    else {
        // Stream path: convert to AsyncIterable and transform
        const asyncItems = normalizeToAsyncIterable(items);
        const transformedItems = transformBatchItemsStream(asyncItems, options);
        // Execute streaming 2-phase batch
        const response = await tracer.startActiveSpan("batch.trigger()", async (span) => {
            const result = await executeBatchTwoPhaseStreaming(apiClient, transformedItems, {
                parentRunId: taskContext.ctx?.run.id,
                idempotencyKey: await makeIdempotencyKey(options?.idempotencyKey),
                spanParentAsLink: true, // Fire-and-forget: child runs get separate trace IDs
            }, requestOptions);
            span.setAttribute("batchId", result.id);
            span.setAttribute("runCount", result.runCount);
            return result;
        }, {
            kind: SpanKind.PRODUCER,
            attributes: {
                [SemanticInternalAttributes.STYLE_ICON]: "trigger",
            },
        });
        const handle = {
            batchId: response.id,
            runCount: response.runCount,
            publicAccessToken: response.publicAccessToken,
        };
        return handle;
    }
}
// Implementation
export async function batchTriggerByIdAndWait(...args) {
    const [items, options, requestOptions] = args;
    const ctx = taskContext.ctx;
    if (!ctx) {
        throw new Error("batchTriggerAndWait can only be used from inside a task.run()");
    }
    const apiClient = apiClientManager.clientOrThrow(requestOptions?.clientConfig);
    // Check if items is an array or a stream
    if (Array.isArray(items)) {
        // Array path: existing logic
        const ndJsonItems = await Promise.all(items.map(async (item, index) => {
            const taskMetadata = resourceCatalog.getTask(item.id);
            const parsedPayload = taskMetadata?.fns.parsePayload
                ? await taskMetadata?.fns.parsePayload(item.payload)
                : item.payload;
            const payloadPacket = await stringifyIO(parsedPayload);
            const batchItemIdempotencyKey = await makeIdempotencyKey(flattenIdempotencyKey([options?.idempotencyKey, `${index}`]));
            return {
                index,
                task: item.id,
                payload: payloadPacket.data,
                options: {
                    lockToVersion: taskContext.worker?.version,
                    queue: item.options?.queue ? { name: item.options.queue } : undefined,
                    concurrencyKey: item.options?.concurrencyKey,
                    test: taskContext.ctx?.run.isTest,
                    payloadType: payloadPacket.dataType,
                    delay: item.options?.delay,
                    ttl: item.options?.ttl,
                    tags: item.options?.tags,
                    maxAttempts: item.options?.maxAttempts,
                    metadata: item.options?.metadata,
                    maxDuration: item.options?.maxDuration,
                    idempotencyKey: (await makeIdempotencyKey(item.options?.idempotencyKey)) ?? batchItemIdempotencyKey,
                    idempotencyKeyTTL: item.options?.idempotencyKeyTTL ?? options?.idempotencyKeyTTL,
                    machine: item.options?.machine,
                    priority: item.options?.priority,
                    region: item.options?.region,
                    debounce: item.options?.debounce,
                },
            };
        }));
        return await tracer.startActiveSpan("batch.triggerAndWait()", async (span) => {
            // Execute 2-phase batch
            const response = await executeBatchTwoPhase(apiClient, ndJsonItems, {
                parentRunId: ctx.run.id,
                resumeParentOnCompletion: true,
                idempotencyKey: await makeIdempotencyKey(options?.idempotencyKey),
                spanParentAsLink: false, // Waiting: child runs share parent's trace ID
            }, requestOptions);
            span.setAttribute("batchId", response.id);
            span.setAttribute("runCount", response.runCount);
            const result = await runtime.waitForBatch({
                id: response.id,
                runCount: response.runCount,
                ctx,
            });
            const runs = await handleBatchTaskRunExecutionResultV2(result.items, response.taskIdentifiers);
            return {
                id: result.id,
                runs,
            };
        }, {
            kind: SpanKind.PRODUCER,
            attributes: {
                [SemanticInternalAttributes.STYLE_ICON]: "trigger",
            },
        });
    }
    else {
        // Stream path: convert to AsyncIterable and transform
        const asyncItems = normalizeToAsyncIterable(items);
        const transformedItems = transformBatchItemsStreamForWait(asyncItems, options);
        return await tracer.startActiveSpan("batch.triggerAndWait()", async (span) => {
            // Execute streaming 2-phase batch
            const response = await executeBatchTwoPhaseStreaming(apiClient, transformedItems, {
                parentRunId: ctx.run.id,
                resumeParentOnCompletion: true,
                idempotencyKey: await makeIdempotencyKey(options?.idempotencyKey),
                spanParentAsLink: false, // Waiting: child runs share parent's trace ID
            }, requestOptions);
            span.setAttribute("batchId", response.id);
            span.setAttribute("runCount", response.runCount);
            const result = await runtime.waitForBatch({
                id: response.id,
                runCount: response.runCount,
                ctx,
            });
            const runs = await handleBatchTaskRunExecutionResultV2(result.items, response.taskIdentifiers);
            return {
                id: result.id,
                runs,
            };
        }, {
            kind: SpanKind.PRODUCER,
            attributes: {
                [SemanticInternalAttributes.STYLE_ICON]: "trigger",
            },
        });
    }
}
// Implementation
export async function batchTriggerTasks(...args) {
    const [items, options, requestOptions] = args;
    const apiClient = apiClientManager.clientOrThrow(requestOptions?.clientConfig);
    // Check if items is an array or a stream
    if (Array.isArray(items)) {
        // Array path: existing logic
        const ndJsonItems = await Promise.all(items.map(async (item, index) => {
            const taskMetadata = resourceCatalog.getTask(item.task.id);
            const parsedPayload = taskMetadata?.fns.parsePayload
                ? await taskMetadata?.fns.parsePayload(item.payload)
                : item.payload;
            const payloadPacket = await stringifyIO(parsedPayload);
            const batchItemIdempotencyKey = await makeIdempotencyKey(flattenIdempotencyKey([options?.idempotencyKey, `${index}`]));
            return {
                index,
                task: item.task.id,
                payload: payloadPacket.data,
                options: {
                    queue: item.options?.queue ? { name: item.options.queue } : undefined,
                    concurrencyKey: item.options?.concurrencyKey,
                    test: taskContext.ctx?.run.isTest,
                    payloadType: payloadPacket.dataType,
                    delay: item.options?.delay,
                    ttl: item.options?.ttl,
                    tags: item.options?.tags,
                    maxAttempts: item.options?.maxAttempts,
                    metadata: item.options?.metadata,
                    maxDuration: item.options?.maxDuration,
                    idempotencyKey: (await makeIdempotencyKey(item.options?.idempotencyKey)) ?? batchItemIdempotencyKey,
                    idempotencyKeyTTL: item.options?.idempotencyKeyTTL ?? options?.idempotencyKeyTTL,
                    machine: item.options?.machine,
                    priority: item.options?.priority,
                    region: item.options?.region,
                    lockToVersion: item.options?.version ?? scopedEnvVar("TRIGGER_VERSION"),
                    externalDeploymentId: resolveTriggerExternalDeploymentId(item.options?.externalDeploymentId),
                    debounce: item.options?.debounce,
                },
            };
        }));
        // Execute 2-phase batch
        const response = await tracer.startActiveSpan("batch.triggerByTask()", async (span) => {
            const result = await executeBatchTwoPhase(apiClient, ndJsonItems, {
                parentRunId: taskContext.ctx?.run.id,
                idempotencyKey: await makeIdempotencyKey(options?.idempotencyKey),
                spanParentAsLink: true, // Fire-and-forget: child runs get separate trace IDs
            }, requestOptions);
            span.setAttribute("batchId", result.id);
            span.setAttribute("runCount", result.runCount);
            return result;
        }, {
            kind: SpanKind.PRODUCER,
            attributes: {
                [SemanticInternalAttributes.STYLE_ICON]: "trigger",
            },
        });
        const handle = {
            batchId: response.id,
            runCount: response.runCount,
            publicAccessToken: response.publicAccessToken,
        };
        return handle;
    }
    else {
        // Stream path: convert to AsyncIterable and transform
        const streamItems = items;
        const asyncItems = normalizeToAsyncIterable(streamItems);
        const transformedItems = transformBatchByTaskItemsStream(asyncItems, options);
        // Execute streaming 2-phase batch
        const response = await tracer.startActiveSpan("batch.triggerByTask()", async (span) => {
            const result = await executeBatchTwoPhaseStreaming(apiClient, transformedItems, {
                parentRunId: taskContext.ctx?.run.id,
                idempotencyKey: await makeIdempotencyKey(options?.idempotencyKey),
                spanParentAsLink: true, // Fire-and-forget: child runs get separate trace IDs
            }, requestOptions);
            span.setAttribute("batchId", result.id);
            span.setAttribute("runCount", result.runCount);
            return result;
        }, {
            kind: SpanKind.PRODUCER,
            attributes: {
                [SemanticInternalAttributes.STYLE_ICON]: "trigger",
            },
        });
        const handle = {
            batchId: response.id,
            runCount: response.runCount,
            publicAccessToken: response.publicAccessToken,
        };
        return handle;
    }
}
// Implementation
export async function batchTriggerAndWaitTasks(...args) {
    const [items, options, requestOptions] = args;
    const ctx = taskContext.ctx;
    if (!ctx) {
        throw new Error("batchTriggerAndWait can only be used from inside a task.run()");
    }
    const apiClient = apiClientManager.clientOrThrow(requestOptions?.clientConfig);
    // Check if items is an array or a stream
    if (Array.isArray(items)) {
        // Array path: existing logic
        const ndJsonItems = await Promise.all(items.map(async (item, index) => {
            const taskMetadata = resourceCatalog.getTask(item.task.id);
            const parsedPayload = taskMetadata?.fns.parsePayload
                ? await taskMetadata?.fns.parsePayload(item.payload)
                : item.payload;
            const payloadPacket = await stringifyIO(parsedPayload);
            const batchItemIdempotencyKey = await makeIdempotencyKey(flattenIdempotencyKey([options?.idempotencyKey, `${index}`]));
            return {
                index,
                task: item.task.id,
                payload: payloadPacket.data,
                options: {
                    lockToVersion: taskContext.worker?.version,
                    queue: item.options?.queue ? { name: item.options.queue } : undefined,
                    concurrencyKey: item.options?.concurrencyKey,
                    test: taskContext.ctx?.run.isTest,
                    payloadType: payloadPacket.dataType,
                    delay: item.options?.delay,
                    ttl: item.options?.ttl,
                    tags: item.options?.tags,
                    maxAttempts: item.options?.maxAttempts,
                    metadata: item.options?.metadata,
                    maxDuration: item.options?.maxDuration,
                    idempotencyKey: (await makeIdempotencyKey(item.options?.idempotencyKey)) ?? batchItemIdempotencyKey,
                    idempotencyKeyTTL: item.options?.idempotencyKeyTTL ?? options?.idempotencyKeyTTL,
                    machine: item.options?.machine,
                    priority: item.options?.priority,
                    region: item.options?.region,
                    debounce: item.options?.debounce,
                },
            };
        }));
        return await tracer.startActiveSpan("batch.triggerByTaskAndWait()", async (span) => {
            // Execute 2-phase batch
            const response = await executeBatchTwoPhase(apiClient, ndJsonItems, {
                parentRunId: ctx.run.id,
                resumeParentOnCompletion: true,
                idempotencyKey: await makeIdempotencyKey(options?.idempotencyKey),
                spanParentAsLink: false, // Waiting: child runs share parent's trace ID
            }, requestOptions);
            span.setAttribute("batchId", response.id);
            span.setAttribute("runCount", response.runCount);
            const result = await runtime.waitForBatch({
                id: response.id,
                runCount: response.runCount,
                ctx,
            });
            const runs = await handleBatchTaskRunExecutionResultV2(result.items, response.taskIdentifiers);
            return {
                id: result.id,
                runs,
            };
        }, {
            kind: SpanKind.PRODUCER,
            attributes: {
                [SemanticInternalAttributes.STYLE_ICON]: "trigger",
            },
        });
    }
    else {
        // Stream path: convert to AsyncIterable and transform
        const streamItems = items;
        const asyncItems = normalizeToAsyncIterable(streamItems);
        const transformedItems = transformBatchByTaskItemsStreamForWait(asyncItems, options);
        return await tracer.startActiveSpan("batch.triggerByTaskAndWait()", async (span) => {
            // Execute streaming 2-phase batch
            const response = await executeBatchTwoPhaseStreaming(apiClient, transformedItems, {
                parentRunId: ctx.run.id,
                resumeParentOnCompletion: true,
                idempotencyKey: await makeIdempotencyKey(options?.idempotencyKey),
                spanParentAsLink: false, // Waiting: child runs share parent's trace ID
            }, requestOptions);
            span.setAttribute("batchId", response.id);
            span.setAttribute("runCount", response.runCount);
            const result = await runtime.waitForBatch({
                id: response.id,
                runCount: response.runCount,
                ctx,
            });
            const runs = await handleBatchTaskRunExecutionResultV2(result.items, response.taskIdentifiers);
            return {
                id: result.id,
                runs,
            };
        }, {
            kind: SpanKind.PRODUCER,
            attributes: {
                [SemanticInternalAttributes.STYLE_ICON]: "trigger",
            },
        });
    }
}
export function uniqueBatchTaskIdentifiers(items) {
    return Array.from(new Set(items.map((item) => item.task))).sort();
}
/**
 * Helper function that executes a 2-phase batch trigger:
 * 1. Creates the batch record with expected run count
 * 2. Streams items as NDJSON to the server
 *
 * @param apiClient - The API client instance
 * @param items - Array of batch items
 * @param options - Batch options including trace context settings
 * @param options.spanParentAsLink - If true, child runs will have separate trace IDs with a link to parent.
 *                                   Use true for batchTrigger (fire-and-forget), false for batchTriggerAndWait.
 * @param requestOptions - Optional request options
 * @internal
 */
async function executeBatchTwoPhase(apiClient, items, options, requestOptions) {
    // Offload any oversized per-item payloads to object storage before streaming, so a batch
    // of large items keeps the request body small — the same treatment single triggers get.
    // Both the array and streaming batch paths funnel through here, so this is the one place
    // batch offloading needs to happen. Wrap failures so a presign/upload error carries the
    // same batch context (phase, itemCount, rate-limit info) as the create/stream phases.
    try {
        items = await offloadBatchItemPayloads(items, apiClient);
    }
    catch (error) {
        throw new BatchTriggerError(`Failed to offload payloads for batch with ${items.length} items`, {
            cause: error,
            phase: "offload",
            itemCount: items.length,
        });
    }
    let batch;
    try {
        // Phase 1: Create batch
        batch = await apiClient.createBatch({
            runCount: items.length,
            taskIdentifiers: uniqueBatchTaskIdentifiers(items),
            parentRunId: options.parentRunId,
            resumeParentOnCompletion: options.resumeParentOnCompletion,
            idempotencyKey: options.idempotencyKey,
            idempotencyKeyOptions: options.idempotencyKeyOptions,
        }, { spanParentAsLink: options.spanParentAsLink }, requestOptions);
    }
    catch (error) {
        // Wrap with context about which phase failed
        throw new BatchTriggerError(`Failed to create batch with ${items.length} items`, {
            cause: error,
            phase: "create",
            itemCount: items.length,
        });
    }
    // If the batch was cached (idempotent replay), skip streaming items
    if (!batch.isCached) {
        try {
            // Phase 2: Stream items
            await apiClient.streamBatchItems(batch.id, items, requestOptions);
        }
        catch (error) {
            // Wrap with context about which phase failed and include batch ID
            throw new BatchTriggerError(`Failed to stream items for batch ${batch.id} (${items.length} items)`, { cause: error, phase: "stream", batchId: batch.id, itemCount: items.length });
        }
    }
    return {
        id: batch.id,
        runCount: batch.runCount,
        publicAccessToken: batch.publicAccessToken,
        taskIdentifiers: items.map((item) => item.task),
    };
}
/**
 * Offload any oversized per-item payloads in a batch to object storage, mirroring the
 * single-trigger offload path. Small payloads pass through untouched. Every returned item
 * carries `options.payloadSize` (the pre-offload serialized byte size) so the pipeline can
 * reason about payload size without downloading an "application/store" reference.
 *
 * Uploads run with bounded concurrency so a batch of large items doesn't fire an unbounded
 * number of simultaneous presigned PUTs.
 *
 * @internal Exported for testing.
 */
export async function offloadBatchItemPayloads(items, apiClient, concurrency = 10) {
    if (items.length === 0) {
        return items;
    }
    const results = new Array(items.length);
    let cursor = 0;
    async function worker() {
        while (cursor < items.length) {
            const index = cursor++;
            results[index] = await offloadBatchItemPayload(items[index], apiClient);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
    return results;
}
async function offloadBatchItemPayload(item, apiClient) {
    // The batch builders serialize each payload to a string via stringifyIO before we get
    // here; anything else has no inline body to offload or measure.
    if (typeof item.payload !== "string" || item.payload.length === 0) {
        return item;
    }
    const dataType = item.options?.payloadType ?? "application/json";
    // Already an object-store reference — the caller pre-offloaded it, nothing to do.
    if (dataType === "application/store") {
        return item;
    }
    const packet = { data: item.payload, dataType };
    // Measure before offload so the size reflects the real payload, not the small reference
    // we may replace it with.
    const { size: payloadSize } = packetRequiresOffloading(packet);
    const exported = await conditionallyExportPacket(packet, createTriggerPayloadPathPrefix(), undefined, apiClient);
    return {
        ...item,
        payload: exported.data,
        options: {
            ...item.options,
            payloadType: exported.dataType,
            payloadSize,
        },
    };
}
/**
 * Error thrown when batch trigger operations fail.
 * Includes context about which phase failed and the batch details.
 *
 * When the underlying error is a rate limit (429), additional properties are exposed:
 * - `isRateLimited`: true
 * - `retryAfterMs`: milliseconds until the rate limit resets
 */
export class BatchTriggerError extends Error {
    phase;
    batchId;
    itemCount;
    /** True if the error was caused by rate limiting (HTTP 429) */
    isRateLimited;
    /** Milliseconds until the rate limit resets. Only set when `isRateLimited` is true. */
    retryAfterMs;
    /** The underlying API error, if the cause was an ApiError */
    apiError;
    /** The underlying cause of the error */
    cause;
    constructor(message, options) {
        // Build enhanced message that includes the cause's message
        const fullMessage = buildBatchErrorMessage(message, options.cause);
        super(fullMessage, { cause: options.cause });
        this.name = "BatchTriggerError";
        this.cause = options.cause;
        this.phase = options.phase;
        this.batchId = options.batchId;
        this.itemCount = options.itemCount;
        // Extract rate limit info from cause
        if (options.cause instanceof RateLimitError) {
            this.isRateLimited = true;
            this.retryAfterMs = options.cause.millisecondsUntilReset;
            this.apiError = options.cause;
        }
        else if (options.cause instanceof ApiError) {
            this.isRateLimited = options.cause.status === 429;
            this.apiError = options.cause;
        }
        else {
            this.isRateLimited = false;
        }
    }
}
/**
 * Build an enhanced error message that includes context from the cause.
 */
function buildBatchErrorMessage(baseMessage, cause) {
    if (!cause) {
        return baseMessage;
    }
    // Handle RateLimitError specifically for better messaging
    if (cause instanceof RateLimitError) {
        const retryMs = cause.millisecondsUntilReset;
        if (retryMs !== undefined) {
            const retrySeconds = Math.ceil(retryMs / 1000);
            return `${baseMessage}: Rate limit exceeded - retry after ${retrySeconds}s`;
        }
        return `${baseMessage}: Rate limit exceeded`;
    }
    // Handle other ApiErrors
    if (cause instanceof ApiError) {
        return `${baseMessage}: ${cause.message}`;
    }
    // Handle generic errors
    if (cause instanceof Error) {
        return `${baseMessage}: ${cause.message}`;
    }
    return baseMessage;
}
/**
 * Execute a streaming 2-phase batch trigger where items are streamed from an AsyncIterable.
 * Unlike executeBatchTwoPhase, this doesn't know the count upfront.
 *
 * @param apiClient - The API client instance
 * @param items - AsyncIterable of batch items
 * @param options - Batch options including trace context settings
 * @param options.spanParentAsLink - If true, child runs will have separate trace IDs with a link to parent.
 *                                   Use true for batchTrigger (fire-and-forget), false for batchTriggerAndWait.
 * @param requestOptions - Optional request options
 * @internal
 */
async function executeBatchTwoPhaseStreaming(apiClient, items, options, requestOptions) {
    // For streaming, we need to buffer items to get the count first
    // This is because createBatch requires runCount upfront
    // In the future, we could add a streaming-first endpoint that doesn't require this
    const itemsArray = [];
    for await (const item of items) {
        itemsArray.push(item);
    }
    // Now we can use the regular 2-phase approach
    return executeBatchTwoPhase(apiClient, itemsArray, options, requestOptions);
}
/**
 * Type guard to check if a value is a ReadableStream
 */
function isReadableStream(value) {
    return (value != null &&
        typeof value === "object" &&
        "getReader" in value &&
        typeof value.getReader === "function");
}
/**
 * Convert a ReadableStream to an AsyncIterable.
 * Properly cancels the stream when the consumer terminates early.
 *
 * @internal Exported for testing purposes
 */
export async function* readableStreamToAsyncIterable(stream) {
    const reader = stream.getReader();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            yield value;
        }
    }
    finally {
        try {
            await reader.cancel();
        }
        catch {
            // Ignore errors - stream might already be errored or closed
        }
        reader.releaseLock();
    }
}
/**
 * Normalize stream input to AsyncIterable
 */
function normalizeToAsyncIterable(input) {
    if (isReadableStream(input)) {
        return readableStreamToAsyncIterable(input);
    }
    return input;
}
/**
 * Transform a stream of BatchByIdItem to BatchItemNDJSON format.
 * Handles payload serialization and idempotency key generation.
 *
 * @internal
 */
async function* transformBatchItemsStream(items, options) {
    let index = 0;
    for await (const item of items) {
        const taskMetadata = resourceCatalog.getTask(item.id);
        const parsedPayload = taskMetadata?.fns.parsePayload
            ? await taskMetadata?.fns.parsePayload(item.payload)
            : item.payload;
        const payloadPacket = await stringifyIO(parsedPayload);
        const batchItemIdempotencyKey = await makeIdempotencyKey(flattenIdempotencyKey([options?.idempotencyKey, `${index}`]));
        yield {
            index: index++,
            task: item.id,
            payload: payloadPacket.data,
            options: {
                queue: item.options?.queue ? { name: item.options.queue } : undefined,
                concurrencyKey: item.options?.concurrencyKey,
                test: taskContext.ctx?.run.isTest,
                payloadType: payloadPacket.dataType,
                delay: item.options?.delay,
                ttl: item.options?.ttl,
                tags: item.options?.tags,
                maxAttempts: item.options?.maxAttempts,
                metadata: item.options?.metadata,
                maxDuration: item.options?.maxDuration,
                idempotencyKey: (await makeIdempotencyKey(item.options?.idempotencyKey)) ?? batchItemIdempotencyKey,
                idempotencyKeyTTL: item.options?.idempotencyKeyTTL ?? options?.idempotencyKeyTTL,
                machine: item.options?.machine,
                priority: item.options?.priority,
                region: item.options?.region,
                lockToVersion: item.options?.version ?? scopedEnvVar("TRIGGER_VERSION"),
                externalDeploymentId: resolveTriggerExternalDeploymentId(item.options?.externalDeploymentId),
                debounce: item.options?.debounce,
            },
        };
    }
}
/**
 * Transform a stream of BatchByIdAndWaitItem to BatchItemNDJSON format for triggerAndWait.
 * Uses the current worker version for lockToVersion.
 *
 * @internal
 */
async function* transformBatchItemsStreamForWait(items, options) {
    let index = 0;
    for await (const item of items) {
        const taskMetadata = resourceCatalog.getTask(item.id);
        const parsedPayload = taskMetadata?.fns.parsePayload
            ? await taskMetadata?.fns.parsePayload(item.payload)
            : item.payload;
        const payloadPacket = await stringifyIO(parsedPayload);
        const batchItemIdempotencyKey = await makeIdempotencyKey(flattenIdempotencyKey([options?.idempotencyKey, `${index}`]));
        yield {
            index: index++,
            task: item.id,
            payload: payloadPacket.data,
            options: {
                lockToVersion: taskContext.worker?.version,
                queue: item.options?.queue ? { name: item.options.queue } : undefined,
                concurrencyKey: item.options?.concurrencyKey,
                test: taskContext.ctx?.run.isTest,
                payloadType: payloadPacket.dataType,
                delay: item.options?.delay,
                ttl: item.options?.ttl,
                tags: item.options?.tags,
                maxAttempts: item.options?.maxAttempts,
                metadata: item.options?.metadata,
                maxDuration: item.options?.maxDuration,
                idempotencyKey: (await makeIdempotencyKey(item.options?.idempotencyKey)) ?? batchItemIdempotencyKey,
                idempotencyKeyTTL: item.options?.idempotencyKeyTTL ?? options?.idempotencyKeyTTL,
                machine: item.options?.machine,
                priority: item.options?.priority,
                region: item.options?.region,
                debounce: item.options?.debounce,
            },
        };
    }
}
/**
 * Transform a stream of BatchByTaskItem to BatchItemNDJSON format.
 *
 * @internal
 */
async function* transformBatchByTaskItemsStream(items, options) {
    let index = 0;
    for await (const item of items) {
        const taskMetadata = resourceCatalog.getTask(item.task.id);
        const parsedPayload = taskMetadata?.fns.parsePayload
            ? await taskMetadata?.fns.parsePayload(item.payload)
            : item.payload;
        const payloadPacket = await stringifyIO(parsedPayload);
        const batchItemIdempotencyKey = await makeIdempotencyKey(flattenIdempotencyKey([options?.idempotencyKey, `${index}`]));
        yield {
            index: index++,
            task: item.task.id,
            payload: payloadPacket.data,
            options: {
                queue: item.options?.queue ? { name: item.options.queue } : undefined,
                concurrencyKey: item.options?.concurrencyKey,
                test: taskContext.ctx?.run.isTest,
                payloadType: payloadPacket.dataType,
                delay: item.options?.delay,
                ttl: item.options?.ttl,
                tags: item.options?.tags,
                maxAttempts: item.options?.maxAttempts,
                metadata: item.options?.metadata,
                maxDuration: item.options?.maxDuration,
                idempotencyKey: (await makeIdempotencyKey(item.options?.idempotencyKey)) ?? batchItemIdempotencyKey,
                idempotencyKeyTTL: item.options?.idempotencyKeyTTL ?? options?.idempotencyKeyTTL,
                machine: item.options?.machine,
                priority: item.options?.priority,
                region: item.options?.region,
                lockToVersion: item.options?.version ?? scopedEnvVar("TRIGGER_VERSION"),
                externalDeploymentId: resolveTriggerExternalDeploymentId(item.options?.externalDeploymentId),
                debounce: item.options?.debounce,
            },
        };
    }
}
/**
 * Transform a stream of BatchByTaskAndWaitItem to BatchItemNDJSON format for triggerAndWait.
 *
 * @internal
 */
async function* transformBatchByTaskItemsStreamForWait(items, options) {
    let index = 0;
    for await (const item of items) {
        const taskMetadata = resourceCatalog.getTask(item.task.id);
        const parsedPayload = taskMetadata?.fns.parsePayload
            ? await taskMetadata?.fns.parsePayload(item.payload)
            : item.payload;
        const payloadPacket = await stringifyIO(parsedPayload);
        const batchItemIdempotencyKey = await makeIdempotencyKey(flattenIdempotencyKey([options?.idempotencyKey, `${index}`]));
        yield {
            index: index++,
            task: item.task.id,
            payload: payloadPacket.data,
            options: {
                lockToVersion: taskContext.worker?.version,
                queue: item.options?.queue ? { name: item.options.queue } : undefined,
                concurrencyKey: item.options?.concurrencyKey,
                test: taskContext.ctx?.run.isTest,
                payloadType: payloadPacket.dataType,
                delay: item.options?.delay,
                ttl: item.options?.ttl,
                tags: item.options?.tags,
                maxAttempts: item.options?.maxAttempts,
                metadata: item.options?.metadata,
                maxDuration: item.options?.maxDuration,
                idempotencyKey: (await makeIdempotencyKey(item.options?.idempotencyKey)) ?? batchItemIdempotencyKey,
                idempotencyKeyTTL: item.options?.idempotencyKeyTTL ?? options?.idempotencyKeyTTL,
                machine: item.options?.machine,
                priority: item.options?.priority,
                region: item.options?.region,
                debounce: item.options?.debounce,
            },
        };
    }
}
/**
 * Transform a stream of BatchItem (single task type) to BatchItemNDJSON format.
 *
 * @internal
 */
async function* transformSingleTaskBatchItemsStream(taskIdentifier, items, parsePayload, options, queue) {
    let index = 0;
    for await (const item of items) {
        const parsedPayload = parsePayload ? await parsePayload(item.payload) : item.payload;
        const payloadPacket = await stringifyIO(parsedPayload);
        const batchItemIdempotencyKey = await makeIdempotencyKey(flattenIdempotencyKey([options?.idempotencyKey, `${index}`]));
        yield {
            index: index++,
            task: taskIdentifier,
            payload: payloadPacket.data,
            options: {
                queue: item.options?.queue
                    ? { name: item.options.queue }
                    : queue
                        ? { name: queue }
                        : undefined,
                concurrencyKey: item.options?.concurrencyKey,
                test: taskContext.ctx?.run.isTest,
                payloadType: payloadPacket.dataType,
                delay: item.options?.delay,
                ttl: item.options?.ttl,
                tags: item.options?.tags,
                maxAttempts: item.options?.maxAttempts,
                metadata: item.options?.metadata,
                maxDuration: item.options?.maxDuration,
                idempotencyKey: (await makeIdempotencyKey(item.options?.idempotencyKey)) ?? batchItemIdempotencyKey,
                idempotencyKeyTTL: item.options?.idempotencyKeyTTL ?? options?.idempotencyKeyTTL,
                machine: item.options?.machine,
                priority: item.options?.priority,
                region: item.options?.region,
                lockToVersion: item.options?.version ?? scopedEnvVar("TRIGGER_VERSION"),
                externalDeploymentId: resolveTriggerExternalDeploymentId(item.options?.externalDeploymentId),
                debounce: item.options?.debounce,
            },
        };
    }
}
/**
 * Transform a stream of BatchTriggerAndWaitItem (single task type) to BatchItemNDJSON format.
 *
 * @internal
 */
async function* transformSingleTaskBatchItemsStreamForWait(taskIdentifier, items, parsePayload, options, queue) {
    let index = 0;
    for await (const item of items) {
        const parsedPayload = parsePayload ? await parsePayload(item.payload) : item.payload;
        const payloadPacket = await stringifyIO(parsedPayload);
        const batchItemIdempotencyKey = await makeIdempotencyKey(flattenIdempotencyKey([options?.idempotencyKey, `${index}`]));
        // Process item-specific idempotency key and extract options
        const itemIdempotencyKey = await makeIdempotencyKey(item.options?.idempotencyKey);
        const finalIdempotencyKey = itemIdempotencyKey ?? batchItemIdempotencyKey;
        const idempotencyKeyOptions = itemIdempotencyKey
            ? getIdempotencyKeyOptions(itemIdempotencyKey)
            : undefined;
        yield {
            index: index++,
            task: taskIdentifier,
            payload: payloadPacket.data,
            options: {
                lockToVersion: taskContext.worker?.version,
                queue: item.options?.queue
                    ? { name: item.options.queue }
                    : queue
                        ? { name: queue }
                        : undefined,
                concurrencyKey: item.options?.concurrencyKey,
                test: taskContext.ctx?.run.isTest,
                payloadType: payloadPacket.dataType,
                delay: item.options?.delay,
                ttl: item.options?.ttl,
                tags: item.options?.tags,
                maxAttempts: item.options?.maxAttempts,
                metadata: item.options?.metadata,
                maxDuration: item.options?.maxDuration,
                idempotencyKey: finalIdempotencyKey?.toString(),
                idempotencyKeyTTL: item.options?.idempotencyKeyTTL ?? options?.idempotencyKeyTTL,
                idempotencyKeyOptions,
                machine: item.options?.machine,
                priority: item.options?.priority,
                region: item.options?.region,
                debounce: item.options?.debounce,
            },
        };
    }
}
async function trigger_internal(name, id, payload, parsePayload, options, requestOptions) {
    const apiClient = apiClientManager.clientOrThrow(requestOptions?.clientConfig);
    const parsedPayload = parsePayload ? await parsePayload(payload) : payload;
    const { packet: triggerPayloadPacket, payloadSize } = await prepareTriggerPayload(parsedPayload, apiClient);
    // Process idempotency key and extract options for storage
    const processedIdempotencyKey = await makeIdempotencyKey(options?.idempotencyKey);
    const idempotencyKeyOptions = processedIdempotencyKey
        ? getIdempotencyKeyOptions(processedIdempotencyKey)
        : undefined;
    const handle = await apiClient.triggerTask(id, {
        payload: triggerPayloadPacket.data,
        options: {
            queue: options?.queue ? { name: options.queue } : undefined,
            concurrencyKey: options?.concurrencyKey,
            test: taskContext.ctx?.run.isTest,
            payloadType: triggerPayloadPacket.dataType,
            payloadSize,
            idempotencyKey: processedIdempotencyKey?.toString(),
            idempotencyKeyTTL: options?.idempotencyKeyTTL,
            idempotencyKeyOptions,
            delay: options?.delay,
            ttl: options?.ttl,
            tags: options?.tags,
            maxAttempts: options?.maxAttempts,
            metadata: options?.metadata,
            maxDuration: options?.maxDuration,
            parentRunId: taskContext.ctx?.run.id,
            machine: options?.machine,
            priority: options?.priority,
            region: options?.region,
            lockToVersion: options?.version ?? scopedEnvVar("TRIGGER_VERSION"),
            externalDeploymentId: resolveTriggerExternalDeploymentId(options?.externalDeploymentId),
            debounce: options?.debounce,
        },
    }, {
        spanParentAsLink: true,
    }, {
        name,
        tracer,
        icon: "trigger",
        onResponseBody: (body, span) => {
            if (body && typeof body === "object" && !Array.isArray(body)) {
                if ("id" in body && typeof body.id === "string") {
                    span.setAttribute("runId", body.id);
                }
            }
        },
        ...requestOptions,
    });
    return handle;
}
async function batchTrigger_internal(name, taskIdentifier, items, options, parsePayload, requestOptions, queue) {
    const apiClient = apiClientManager.clientOrThrow(requestOptions?.clientConfig);
    const ctx = taskContext.ctx;
    // Check if items is an array or a stream
    if (Array.isArray(items)) {
        // Prepare items as BatchItemNDJSON
        const ndJsonItems = await Promise.all(items.map(async (item, index) => {
            const parsedPayload = parsePayload ? await parsePayload(item.payload) : item.payload;
            const payloadPacket = await stringifyIO(parsedPayload);
            const batchItemIdempotencyKey = await makeIdempotencyKey(flattenIdempotencyKey([options?.idempotencyKey, `${index}`]));
            // Process item-specific idempotency key and extract options
            const itemIdempotencyKey = await makeIdempotencyKey(item.options?.idempotencyKey);
            const finalIdempotencyKey = itemIdempotencyKey ?? batchItemIdempotencyKey;
            const idempotencyKeyOptions = itemIdempotencyKey
                ? getIdempotencyKeyOptions(itemIdempotencyKey)
                : undefined;
            return {
                index,
                task: taskIdentifier,
                payload: payloadPacket.data,
                options: {
                    queue: item.options?.queue
                        ? { name: item.options.queue }
                        : queue
                            ? { name: queue }
                            : undefined,
                    concurrencyKey: item.options?.concurrencyKey,
                    test: taskContext.ctx?.run.isTest,
                    payloadType: payloadPacket.dataType,
                    delay: item.options?.delay,
                    ttl: item.options?.ttl,
                    tags: item.options?.tags,
                    maxAttempts: item.options?.maxAttempts,
                    metadata: item.options?.metadata,
                    maxDuration: item.options?.maxDuration,
                    idempotencyKey: finalIdempotencyKey?.toString(),
                    idempotencyKeyTTL: item.options?.idempotencyKeyTTL ?? options?.idempotencyKeyTTL,
                    idempotencyKeyOptions,
                    machine: item.options?.machine,
                    priority: item.options?.priority,
                    region: item.options?.region,
                    lockToVersion: item.options?.version ?? scopedEnvVar("TRIGGER_VERSION"),
                    externalDeploymentId: resolveTriggerExternalDeploymentId(item.options?.externalDeploymentId),
                    debounce: item.options?.debounce,
                },
            };
        }));
        // Execute 2-phase batch
        // Process batch-level idempotency key
        const batchIdempotencyKey = await makeIdempotencyKey(options?.idempotencyKey);
        const batchIdempotencyKeyOptions = batchIdempotencyKey
            ? getIdempotencyKeyOptions(batchIdempotencyKey)
            : undefined;
        const response = await tracer.startActiveSpan(name, async (span) => {
            const result = await executeBatchTwoPhase(apiClient, ndJsonItems, {
                parentRunId: ctx?.run.id,
                idempotencyKey: batchIdempotencyKey?.toString(),
                idempotencyKeyOptions: batchIdempotencyKeyOptions,
                spanParentAsLink: true, // Fire-and-forget: child runs get separate trace IDs
            }, requestOptions);
            span.setAttribute("batchId", result.id);
            span.setAttribute("runCount", result.runCount);
            return result;
        }, {
            kind: SpanKind.PRODUCER,
            attributes: {
                [SemanticInternalAttributes.STYLE_ICON]: "trigger",
                ...accessoryAttributes({
                    items: [
                        {
                            text: taskIdentifier,
                            variant: "normal",
                        },
                    ],
                    style: "codepath",
                }),
            },
        });
        const handle = {
            batchId: response.id,
            runCount: response.runCount,
            publicAccessToken: response.publicAccessToken,
        };
        return handle;
    }
    else {
        // Stream path: convert to AsyncIterable and transform
        const asyncItems = normalizeToAsyncIterable(items);
        const transformedItems = transformSingleTaskBatchItemsStream(taskIdentifier, asyncItems, parsePayload, options, queue);
        // Execute streaming 2-phase batch
        // Process batch-level idempotency key
        const streamBatchIdempotencyKey = await makeIdempotencyKey(options?.idempotencyKey);
        const streamBatchIdempotencyKeyOptions = streamBatchIdempotencyKey
            ? getIdempotencyKeyOptions(streamBatchIdempotencyKey)
            : undefined;
        const response = await tracer.startActiveSpan(name, async (span) => {
            const result = await executeBatchTwoPhaseStreaming(apiClient, transformedItems, {
                parentRunId: ctx?.run.id,
                idempotencyKey: streamBatchIdempotencyKey?.toString(),
                idempotencyKeyOptions: streamBatchIdempotencyKeyOptions,
                spanParentAsLink: true, // Fire-and-forget: child runs get separate trace IDs
            }, requestOptions);
            span.setAttribute("batchId", result.id);
            span.setAttribute("runCount", result.runCount);
            return result;
        }, {
            kind: SpanKind.PRODUCER,
            attributes: {
                [SemanticInternalAttributes.STYLE_ICON]: "trigger",
                ...accessoryAttributes({
                    items: [
                        {
                            text: taskIdentifier,
                            variant: "normal",
                        },
                    ],
                    style: "codepath",
                }),
            },
        });
        const handle = {
            batchId: response.id,
            runCount: response.runCount,
            publicAccessToken: response.publicAccessToken,
        };
        return handle;
    }
}
async function triggerAndWait_internal(name, id, payload, parsePayload, options, requestOptions) {
    const ctx = taskContext.ctx;
    if (!ctx) {
        throw new Error("triggerAndWait can only be used from inside a task.run()");
    }
    const apiClient = apiClientManager.clientOrThrow(requestOptions?.clientConfig);
    const parsedPayload = parsePayload ? await parsePayload(payload) : payload;
    const { packet: triggerPayloadPacket, payloadSize } = await prepareTriggerPayload(parsedPayload, apiClient);
    // Process idempotency key and extract options for storage
    const processedIdempotencyKey = await makeIdempotencyKey(options?.idempotencyKey);
    const idempotencyKeyOptions = processedIdempotencyKey
        ? getIdempotencyKeyOptions(processedIdempotencyKey)
        : undefined;
    return await tracer.startActiveSpan(name, async (span) => {
        const response = await apiClient.triggerTask(id, {
            payload: triggerPayloadPacket.data,
            options: {
                lockToVersion: taskContext.worker?.version, // Lock to current version because we're waiting for it to finish
                queue: options?.queue ? { name: options.queue } : undefined,
                concurrencyKey: options?.concurrencyKey,
                test: taskContext.ctx?.run.isTest,
                payloadType: triggerPayloadPacket.dataType,
                payloadSize,
                delay: options?.delay,
                ttl: options?.ttl,
                tags: options?.tags,
                maxAttempts: options?.maxAttempts,
                metadata: options?.metadata,
                maxDuration: options?.maxDuration,
                resumeParentOnCompletion: true,
                parentRunId: ctx.run.id,
                idempotencyKey: processedIdempotencyKey?.toString(),
                idempotencyKeyTTL: options?.idempotencyKeyTTL,
                idempotencyKeyOptions,
                machine: options?.machine,
                priority: options?.priority,
                region: options?.region,
                debounce: options?.debounce,
            },
        }, {}, requestOptions);
        span.setAttribute("runId", response.id);
        const result = await runtime.waitForTask({
            id: response.id,
            ctx,
        });
        return await handleTaskRunExecutionResult(result, id);
    }, {
        kind: SpanKind.PRODUCER,
        attributes: {
            [SemanticInternalAttributes.STYLE_ICON]: "trigger",
            ...accessoryAttributes({
                items: [
                    {
                        text: id,
                        variant: "normal",
                    },
                ],
                style: "codepath",
            }),
        },
    });
}
async function triggerAndSubscribe_internal(name, id, payload, parsePayload, options, requestOptions) {
    const ctx = taskContext.ctx;
    if (!ctx) {
        throw new Error("triggerAndSubscribe can only be used from inside a task.run()");
    }
    const apiClient = apiClientManager.clientOrThrow(requestOptions?.clientConfig);
    const parsedPayload = parsePayload ? await parsePayload(payload) : payload;
    const { packet: triggerPayloadPacket, payloadSize } = await prepareTriggerPayload(parsedPayload, apiClient);
    const processedIdempotencyKey = await makeIdempotencyKey(options?.idempotencyKey);
    const idempotencyKeyOptions = processedIdempotencyKey
        ? getIdempotencyKeyOptions(processedIdempotencyKey)
        : undefined;
    return await tracer.startActiveSpan(name, async (span) => {
        const response = await apiClient.triggerTask(id, {
            payload: triggerPayloadPacket.data,
            options: {
                lockToVersion: taskContext.worker?.version,
                queue: options?.queue ? { name: options.queue } : undefined,
                concurrencyKey: options?.concurrencyKey,
                test: taskContext.ctx?.run.isTest,
                payloadType: triggerPayloadPacket.dataType,
                payloadSize,
                delay: options?.delay,
                ttl: options?.ttl,
                tags: options?.tags,
                maxAttempts: options?.maxAttempts,
                metadata: options?.metadata,
                maxDuration: options?.maxDuration,
                parentRunId: ctx.run.id,
                // NOTE: no resumeParentOnCompletion — parent stays alive and subscribes
                idempotencyKey: processedIdempotencyKey?.toString(),
                idempotencyKeyTTL: options?.idempotencyKeyTTL,
                idempotencyKeyOptions,
                machine: options?.machine,
                priority: options?.priority,
                region: options?.region,
                debounce: options?.debounce,
            },
        }, {}, requestOptions);
        // Set attributes after trigger so the dashboard can link to the child run
        span.setAttribute("messaging.message.id", response.id);
        span.setAttribute("runId", response.id);
        span.setAttribute(SemanticInternalAttributes.ENTITY_TYPE, "run");
        span.setAttribute(SemanticInternalAttributes.ENTITY_ID, response.id);
        // Optionally cancel the child run when the abort signal fires (default: true)
        const cancelOnAbort = options?.cancelOnAbort !== false;
        let onAbort;
        if (options?.signal && cancelOnAbort) {
            if (options.signal.aborted) {
                await apiClient.cancelRun(response.id).catch(() => { });
                throw new DOMException("Aborted", "AbortError");
            }
            onAbort = () => {
                apiClient.cancelRun(response.id).catch(() => { });
            };
            // `{ once: true }` auto-removes the listener on abort, but if the
            // run completes normally the listener stays attached and pins
            // `apiClient` + `response.id` until the signal is GC'd. Long-lived
            // signals shared across many calls accumulate dead listeners; the
            // `finally` below removes the listener on every exit path.
            options.signal.addEventListener("abort", onAbort, { once: true });
        }
        try {
            for await (const run of apiClient.subscribeToRun(response.id, {
                closeOnComplete: true,
                signal: options?.signal,
                skipColumns: ["payload"],
            })) {
                if (run.isSuccess) {
                    // run.output from subscribeToRun is already deserialized
                    return {
                        ok: true,
                        id: response.id,
                        taskIdentifier: id,
                        output: run.output,
                    };
                }
                if (run.isFailed || run.isCancelled) {
                    // Note: this intentionally diverges from `triggerAndWait`'s
                    // error shape. `triggerAndWait` receives a full `TaskRunError`
                    // (with `type` discriminator: BUILT_IN_ERROR, CUSTOM_ERROR,
                    // INTERNAL_ERROR, STRING_ERROR) via the completion message and
                    // passes it through `createErrorTaskError` to preserve the
                    // discriminator. `subscribeToRun` only surfaces a
                    // `SerializedError` (`{ name, message, stackTrace, causes }`)
                    // because `createJsonErrorObject` strips the discriminator before
                    // the record hits the realtime stream. We can't reconstruct the
                    // discriminator here without lossy guessing — callers that
                    // need exact error-type matching should use `triggerAndWait`
                    // instead; subscribers get message, name and the cause chain.
                    const cause = run.error?.causes?.length
                        ? createErrorFromCauses(run.error.causes)
                        : undefined;
                    const error = new Error(run.error?.message ?? `Task ${id} failed (${run.status})`, cause ? { cause } : undefined);
                    if (run.error?.name)
                        error.name = run.error.name;
                    return {
                        ok: false,
                        id: response.id,
                        taskIdentifier: id,
                        error,
                    };
                }
            }
            throw new Error(`Task ${id}: subscription ended without completion`);
        }
        finally {
            if (onAbort && options?.signal) {
                options.signal.removeEventListener("abort", onAbort);
            }
        }
    }, {
        kind: SpanKind.PRODUCER,
        attributes: {
            [SemanticInternalAttributes.STYLE_ICON]: "trigger",
            ...accessoryAttributes({
                items: [
                    {
                        text: id,
                        variant: "normal",
                    },
                ],
                style: "codepath",
            }),
        },
    });
}
async function batchTriggerAndWait_internal(name, id, items, parsePayload, options, requestOptions, queue) {
    const ctx = taskContext.ctx;
    if (!ctx) {
        throw new Error("batchTriggerAndWait can only be used from inside a task.run()");
    }
    const apiClient = apiClientManager.clientOrThrow(requestOptions?.clientConfig);
    // Check if items is an array or a stream
    if (Array.isArray(items)) {
        // Prepare items as BatchItemNDJSON
        const ndJsonItems = await Promise.all(items.map(async (item, index) => {
            const parsedPayload = parsePayload ? await parsePayload(item.payload) : item.payload;
            const payloadPacket = await stringifyIO(parsedPayload);
            const batchItemIdempotencyKey = await makeIdempotencyKey(flattenIdempotencyKey([options?.idempotencyKey, `${index}`]));
            // Process item-specific idempotency key and extract options
            const itemIdempotencyKey = await makeIdempotencyKey(item.options?.idempotencyKey);
            const finalIdempotencyKey = itemIdempotencyKey ?? batchItemIdempotencyKey;
            const idempotencyKeyOptions = itemIdempotencyKey
                ? getIdempotencyKeyOptions(itemIdempotencyKey)
                : undefined;
            return {
                index,
                task: id,
                payload: payloadPacket.data,
                options: {
                    lockToVersion: taskContext.worker?.version,
                    queue: item.options?.queue
                        ? { name: item.options.queue }
                        : queue
                            ? { name: queue }
                            : undefined,
                    concurrencyKey: item.options?.concurrencyKey,
                    test: taskContext.ctx?.run.isTest,
                    payloadType: payloadPacket.dataType,
                    delay: item.options?.delay,
                    ttl: item.options?.ttl,
                    tags: item.options?.tags,
                    maxAttempts: item.options?.maxAttempts,
                    metadata: item.options?.metadata,
                    maxDuration: item.options?.maxDuration,
                    idempotencyKey: finalIdempotencyKey?.toString(),
                    idempotencyKeyTTL: item.options?.idempotencyKeyTTL ?? options?.idempotencyKeyTTL,
                    idempotencyKeyOptions,
                    machine: item.options?.machine,
                    priority: item.options?.priority,
                    region: item.options?.region,
                    debounce: item.options?.debounce,
                },
            };
        }));
        // Process batch-level idempotency key
        const batchIdempotencyKey = await makeIdempotencyKey(options?.idempotencyKey);
        const batchIdempotencyKeyOptions = batchIdempotencyKey
            ? getIdempotencyKeyOptions(batchIdempotencyKey)
            : undefined;
        return await tracer.startActiveSpan(name, async (span) => {
            // Execute 2-phase batch
            const response = await executeBatchTwoPhase(apiClient, ndJsonItems, {
                parentRunId: ctx.run.id,
                resumeParentOnCompletion: true,
                idempotencyKey: batchIdempotencyKey?.toString(),
                idempotencyKeyOptions: batchIdempotencyKeyOptions,
                spanParentAsLink: false, // Waiting: child runs share parent's trace ID
            }, requestOptions);
            span.setAttribute("batchId", response.id);
            span.setAttribute("runCount", response.runCount);
            const result = await runtime.waitForBatch({
                id: response.id,
                runCount: response.runCount,
                ctx,
            });
            const runs = await handleBatchTaskRunExecutionResult(result.items, id);
            return {
                id: result.id,
                runs,
            };
        }, {
            kind: SpanKind.PRODUCER,
            attributes: {
                [SemanticInternalAttributes.STYLE_ICON]: "trigger",
                ...accessoryAttributes({
                    items: [
                        {
                            text: id,
                            variant: "normal",
                        },
                    ],
                    style: "codepath",
                }),
            },
        });
    }
    else {
        // Stream path: convert to AsyncIterable and transform
        const asyncItems = normalizeToAsyncIterable(items);
        const transformedItems = transformSingleTaskBatchItemsStreamForWait(id, asyncItems, parsePayload, options, queue);
        // Process batch-level idempotency key for streaming path
        const streamBatchIdempotencyKey = await makeIdempotencyKey(options?.idempotencyKey);
        const streamBatchIdempotencyKeyOptions = streamBatchIdempotencyKey
            ? getIdempotencyKeyOptions(streamBatchIdempotencyKey)
            : undefined;
        return await tracer.startActiveSpan(name, async (span) => {
            // Execute streaming 2-phase batch
            const response = await executeBatchTwoPhaseStreaming(apiClient, transformedItems, {
                parentRunId: ctx.run.id,
                resumeParentOnCompletion: true,
                idempotencyKey: streamBatchIdempotencyKey?.toString(),
                idempotencyKeyOptions: streamBatchIdempotencyKeyOptions,
                spanParentAsLink: false, // Waiting: child runs share parent's trace ID
            }, requestOptions);
            span.setAttribute("batchId", response.id);
            span.setAttribute("runCount", response.runCount);
            const result = await runtime.waitForBatch({
                id: response.id,
                runCount: response.runCount,
                ctx,
            });
            const runs = await handleBatchTaskRunExecutionResult(result.items, id);
            return {
                id: result.id,
                runs,
            };
        }, {
            kind: SpanKind.PRODUCER,
            attributes: {
                [SemanticInternalAttributes.STYLE_ICON]: "trigger",
                ...accessoryAttributes({
                    items: [
                        {
                            text: id,
                            variant: "normal",
                        },
                    ],
                    style: "codepath",
                }),
            },
        });
    }
}
async function handleBatchTaskRunExecutionResult(items, taskIdentifier) {
    const someObjectStoreOutputs = items.some((item) => item.ok && item.outputType === "application/store");
    if (!someObjectStoreOutputs) {
        const results = await Promise.all(items.map(async (item) => {
            return await handleTaskRunExecutionResult(item, taskIdentifier);
        }));
        return results;
    }
    return await tracer.startActiveSpan("store.downloadPayloads", async (span) => {
        const results = await Promise.all(items.map(async (item) => {
            return await handleTaskRunExecutionResult(item, taskIdentifier);
        }));
        return results;
    }, {
        kind: SpanKind.INTERNAL,
        [SemanticInternalAttributes.STYLE_ICON]: "cloud-download",
    });
}
async function handleBatchTaskRunExecutionResultV2(items, taskIdentifiers) {
    const someObjectStoreOutputs = items.some((item) => item.ok && item.outputType === "application/store");
    if (!someObjectStoreOutputs) {
        const results = await Promise.all(items.map(async (item, index) => {
            return await handleTaskRunExecutionResult(item, item.taskIdentifier ?? taskIdentifiers?.[index] ?? "unknown");
        }));
        return results;
    }
    return await tracer.startActiveSpan("store.downloadPayloads", async (span) => {
        const results = await Promise.all(items.map(async (item, index) => {
            return await handleTaskRunExecutionResult(item, item.taskIdentifier ?? taskIdentifiers?.[index] ?? "unknown");
        }));
        return results;
    }, {
        kind: SpanKind.INTERNAL,
        [SemanticInternalAttributes.STYLE_ICON]: "cloud-download",
    });
}
async function handleTaskRunExecutionResult(execution, taskIdentifier) {
    if (execution.ok) {
        const outputPacket = { data: execution.output, dataType: execution.outputType };
        const importedPacket = await conditionallyImportPacket(outputPacket, tracer);
        return {
            ok: true,
            id: execution.id,
            taskIdentifier: (execution.taskIdentifier ?? taskIdentifier),
            output: await parsePacket(importedPacket),
        };
    }
    else {
        return {
            ok: false,
            id: execution.id,
            taskIdentifier: (execution.taskIdentifier ?? taskIdentifier),
            error: createErrorTaskError(execution.error),
        };
    }
}
function registerTaskLifecycleHooks(taskId, params) {
    if (params.init) {
        lifecycleHooks.registerTaskInitHook(taskId, {
            fn: params.init,
        });
    }
    if (params.onStart) {
        lifecycleHooks.registerTaskStartHook(taskId, {
            fn: params.onStart,
        });
    }
    if (params.onStartAttempt) {
        lifecycleHooks.registerTaskStartAttemptHook(taskId, {
            fn: params.onStartAttempt,
        });
    }
    if (params.onFailure) {
        lifecycleHooks.registerTaskFailureHook(taskId, {
            fn: params.onFailure,
        });
    }
    if (params.onSuccess) {
        lifecycleHooks.registerTaskSuccessHook(taskId, {
            fn: params.onSuccess,
        });
    }
    if (params.onComplete) {
        lifecycleHooks.registerTaskCompleteHook(taskId, {
            fn: params.onComplete,
        });
    }
    if (params.onWait) {
        lifecycleHooks.registerTaskWaitHook(taskId, {
            fn: params.onWait,
        });
    }
    if (params.onResume) {
        lifecycleHooks.registerTaskResumeHook(taskId, {
            fn: params.onResume,
        });
    }
    if (params.catchError) {
        // We don't need to use an adapter here because catchError is the new version of handleError
        lifecycleHooks.registerTaskCatchErrorHook(taskId, {
            fn: params.catchError,
        });
    }
    if (params.handleError) {
        lifecycleHooks.registerTaskCatchErrorHook(taskId, {
            fn: params.handleError,
        });
    }
    if (params.middleware) {
        lifecycleHooks.registerTaskMiddlewareHook(taskId, {
            fn: params.middleware,
        });
    }
    if (params.cleanup) {
        lifecycleHooks.registerTaskCleanupHook(taskId, {
            fn: params.cleanup,
        });
    }
    if (params.onCancel) {
        lifecycleHooks.registerTaskCancelHook(taskId, {
            fn: params.onCancel,
        });
    }
}
async function prepareTriggerPayload(payload, apiClient) {
    const payloadPacket = await stringifyIO(payload);
    // Measure the serialized size before any offload, so it reflects the real payload
    // size rather than the small "application/store" reference we may send instead.
    const { size: payloadSize } = packetRequiresOffloading(payloadPacket);
    const packet = await conditionallyExportPacket(payloadPacket, createTriggerPayloadPathPrefix(), undefined, apiClient);
    return { packet, payloadSize };
}
/**
 * Build the object-storage path prefix for an offloaded trigger payload.
 *
 * Every segment is generated here, so nothing caller-controlled reaches the key.
 * The id's alphabet is lowercase alphanumeric, which no layer between here and the
 * object store rewrites, so the path the SDK asks for is the path that gets stored.
 */
function createTriggerPayloadPathPrefix() {
    return `trigger/${generateFriendlyId("packet")}/payload`;
}
//# sourceMappingURL=shared.js.map