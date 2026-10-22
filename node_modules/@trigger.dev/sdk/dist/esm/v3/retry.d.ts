import type { Attributes } from "@opentelemetry/api";
import type { FetchRetryOptions, RetryOptions } from "@trigger.dev/core/v3";
export type { RetryOptions };
declare function onThrow<T>(fn: (options: {
    attempt: number;
    maxAttempts: number;
}) => Promise<T>, options: RetryOptions): Promise<T>;
interface RetryFetchRequestInit extends RequestInit {
    retry?: FetchRetryOptions;
    timeoutInMs?: number;
}
declare function retryFetch(input: RequestInfo | URL, init?: RetryFetchRequestInit | undefined): Promise<Response>;
export declare const createAttributesFromHeaders: (headers: Headers) => Attributes;
export declare const createFetchAttributes: (input: RequestInfo | URL, init?: RetryFetchRequestInit | undefined) => Attributes;
export declare const createFetchResponseAttributes: (response: Response) => Attributes;
export declare const retry: {
    onThrow: typeof onThrow;
    fetch: typeof retryFetch;
};
