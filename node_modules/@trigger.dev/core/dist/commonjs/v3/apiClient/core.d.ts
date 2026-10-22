import type { RetryOptions } from "../schemas/index.js";
import type { Attributes, Span } from "@opentelemetry/api";
import { type ErrorEvent } from "eventsource";
import type { TriggerTracer } from "../tracer.js";
import type { AnyZodSchema, inferZodSchemaOutput } from "../types/schemas.js";
import type { CursorPageParams, CursorPageResponse, OffsetLimitPageParams, OffsetLimitPageResponse } from "./pagination.js";
import { CursorPage, OffsetLimitPage } from "./pagination.js";
export declare const defaultRetryOptions: {
    maxAttempts: number;
    factor: number;
    minTimeoutInMs: number;
    maxTimeoutInMs: number;
    randomize: false;
};
export type ZodFetchOptions<TData = any> = {
    retry?: RetryOptions;
    tracer?: TriggerTracer;
    name?: string;
    attributes?: Attributes;
    icon?: string;
    onResponseBody?: (body: TData, span: Span) => void;
    prepareData?: (data: TData, response: Response) => Promise<TData> | TData;
};
export type AnyZodFetchOptions = ZodFetchOptions<any>;
export type ApiRequestOptions = Pick<ZodFetchOptions, "retry"> & {
    additionalHeaders?: Record<string, string>;
};
export declare const isRequestOptions: (obj: unknown) => obj is ApiRequestOptions;
interface FetchCursorPageParams extends CursorPageParams {
    query?: URLSearchParams;
}
interface FetchOffsetLimitPageParams extends OffsetLimitPageParams {
    query?: URLSearchParams;
}
export declare function zodfetch<TResponseBodySchema extends AnyZodSchema>(schema: TResponseBodySchema, url: string, requestInit?: RequestInit, options?: ZodFetchOptions<inferZodSchemaOutput<TResponseBodySchema>>): ApiPromise<inferZodSchemaOutput<TResponseBodySchema>>;
export declare function zodfetchCursorPage<TItemSchema extends AnyZodSchema>(schema: TItemSchema, url: string, params: FetchCursorPageParams, requestInit?: RequestInit, options?: ZodFetchOptions): CursorPagePromise<TItemSchema>;
export declare function zodfetchOffsetLimitPage<TItemSchema extends AnyZodSchema>(schema: TItemSchema, url: string, params: FetchOffsetLimitPageParams, requestInit?: RequestInit, options?: ZodFetchOptions): OffsetLimitPagePromise<TItemSchema>;
type ZodFetchResult<T> = {
    data: T;
    response: Response;
};
/**
 * A subclass of `Promise` providing additional helper methods
 * for interacting with the SDK.
 */
export declare class ApiPromise<T> extends Promise<T> {
    private responsePromise;
    constructor(responsePromise: Promise<ZodFetchResult<T>>);
    /**
     * Gets the raw `Response` instance instead of parsing the response
     * data.
     *
     * If you want to parse the response body but still get the `Response`
     * instance, you can use {@link withResponse()}.
     */
    asResponse(): Promise<Response>;
    /**
     * Gets the parsed response data and the raw `Response` instance.
     *
     * If you just want to get the raw `Response` instance without parsing it,
     * you can use {@link asResponse()}.
     */
    withResponse(): Promise<{
        data: T;
        response: Response;
    }>;
    private parse;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}
export declare class CursorPagePromise<TItemSchema extends AnyZodSchema> extends ApiPromise<CursorPage<inferZodSchemaOutput<TItemSchema>>> implements AsyncIterable<inferZodSchemaOutput<TItemSchema>> {
    #private;
    private schema;
    private url;
    private params;
    private requestInit?;
    private options?;
    constructor(result: Promise<ZodFetchResult<CursorPageResponse<inferZodSchemaOutput<TItemSchema>>>>, schema: TItemSchema, url: string, params: FetchCursorPageParams, requestInit?: RequestInit | undefined, options?: ZodFetchOptions | undefined);
    /**
     * Allow auto-paginating iteration on an unawaited list call, eg:
     *
     *    for await (const item of client.items.list()) {
     *      console.log(item)
     *    }
     */
    [Symbol.asyncIterator](): AsyncGenerator<Awaited<inferZodSchemaOutput<TItemSchema>>, void, unknown>;
}
export declare class OffsetLimitPagePromise<TItemSchema extends AnyZodSchema> extends ApiPromise<OffsetLimitPage<inferZodSchemaOutput<TItemSchema>>> implements AsyncIterable<inferZodSchemaOutput<TItemSchema>> {
    #private;
    private schema;
    private url;
    private params;
    private requestInit?;
    private options?;
    constructor(result: Promise<ZodFetchResult<OffsetLimitPageResponse<inferZodSchemaOutput<TItemSchema>>>>, schema: TItemSchema, url: string, params: FetchOffsetLimitPageParams, requestInit?: RequestInit | undefined, options?: ZodFetchOptions | undefined);
    /**
     * Allow auto-paginating iteration on an unawaited list call, eg:
     *
     *    for await (const item of client.items.list()) {
     *      console.log(item)
     *    }
     */
    [Symbol.asyncIterator](): AsyncGenerator<Awaited<inferZodSchemaOutput<TItemSchema>>, void, unknown>;
}
export declare function isEmptyObj(obj: object | null | undefined): boolean;
export declare function hasOwn(obj: object, key: string): boolean;
export type ZodFetchSSEMessageValueSchema<TSchema extends AnyZodSchema = AnyZodSchema> = TSchema;
export interface ZodFetchSSEMessageCatalogSchema {
    [key: string]: AnyZodSchema;
}
export type ZodFetchSSEMessageHandlers<TCatalogSchema extends ZodFetchSSEMessageCatalogSchema> = Partial<{
    [K in keyof TCatalogSchema]: (payload: inferZodSchemaOutput<TCatalogSchema[K]>) => Promise<void> | void;
}>;
export type ZodFetchSSEOptions<TMessageCatalog extends ZodFetchSSEMessageCatalogSchema> = {
    url: string;
    request?: RequestInit;
    messages: TMessageCatalog;
    retry?: RetryOptions;
};
export declare class ZodFetchSSEResult<TMessageCatalog extends ZodFetchSSEMessageCatalogSchema> {
    private options;
    private _eventSource;
    constructor(options: ZodFetchSSEOptions<TMessageCatalog>);
    onConnectionError(handler: (error: ErrorEvent) => void): void;
    onMessage<T extends keyof TMessageCatalog>(type: T, handler: ZodFetchSSEMessageHandlers<TMessageCatalog>[T]): void;
    stop(): void;
}
export declare function zodfetchSSE<TMessageCatalog extends ZodFetchSSEMessageCatalogSchema>(options: ZodFetchSSEOptions<TMessageCatalog>): ZodFetchSSEResult<TMessageCatalog>;
export type ApiResult<TSuccessResult> = {
    success: true;
    data: TSuccessResult;
} | {
    success: false;
    error: string;
    /**
     * HTTP status code, when the failure originated from an API response
     * (e.g. 429 for rate limiting). Undefined for connection/transport
     * errors that never reached the server. Lets callers distinguish
     * transient failures worth retrying from fatal ones.
     */
    statusCode?: number;
    errorCode?: string | null;
};
export declare function wrapZodFetch<T extends AnyZodSchema>(schema: T, url: string, requestInit?: RequestInit, options?: ZodFetchOptions<inferZodSchemaOutput<T>>): Promise<ApiResult<inferZodSchemaOutput<T>>>;
export {};
