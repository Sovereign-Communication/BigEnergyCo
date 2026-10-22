import { z } from "zod/v4";
import { EventFilter } from "./eventFilter.js";
import type { Prettify } from "../types/index.js";
export declare const FetchRetryHeadersStrategy: z.ZodObject<{
    strategy: z.ZodLiteral<"headers">;
    limitHeader: z.ZodString;
    remainingHeader: z.ZodString;
    resetHeader: z.ZodString;
    bodyFilter: z.ZodOptional<z.ZodType<EventFilter, unknown, z.core.$ZodTypeInternals<EventFilter, unknown>>>;
    resetFormat: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        iso_8601: "iso_8601";
        iso_8601_duration_openai_variant: "iso_8601_duration_openai_variant";
        unix_timestamp: "unix_timestamp";
        unix_timestamp_in_ms: "unix_timestamp_in_ms";
    }>>>;
}, z.core.$strip>;
export type FetchRetryHeadersStrategy = z.infer<typeof FetchRetryHeadersStrategy>;
export declare const FetchRetryBackoffStrategy: z.ZodObject<{
    maxAttempts: z.ZodOptional<z.ZodNumber>;
    factor: z.ZodOptional<z.ZodNumber>;
    minTimeoutInMs: z.ZodOptional<z.ZodNumber>;
    maxTimeoutInMs: z.ZodOptional<z.ZodNumber>;
    randomize: z.ZodOptional<z.ZodBoolean>;
    outOfMemory: z.ZodOptional<z.ZodObject<{
        machine: z.ZodOptional<z.ZodEnum<{
            "large-1x": "large-1x";
            "large-2x": "large-2x";
            "medium-1x": "medium-1x";
            "medium-2x": "medium-2x";
            micro: "micro";
            "small-1x": "small-1x";
            "small-2x": "small-2x";
        }>>;
    }, z.core.$strip>>;
    strategy: z.ZodLiteral<"backoff">;
    bodyFilter: z.ZodOptional<z.ZodType<EventFilter, unknown, z.core.$ZodTypeInternals<EventFilter, unknown>>>;
}, z.core.$strip>;
/** The `backoff` strategy retries the request with an exponential backoff. */
export type FetchRetryBackoffStrategy = z.infer<typeof FetchRetryBackoffStrategy>;
export declare const FetchRetryStrategy: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
    strategy: z.ZodLiteral<"headers">;
    limitHeader: z.ZodString;
    remainingHeader: z.ZodString;
    resetHeader: z.ZodString;
    bodyFilter: z.ZodOptional<z.ZodType<EventFilter, unknown, z.core.$ZodTypeInternals<EventFilter, unknown>>>;
    resetFormat: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        iso_8601: "iso_8601";
        iso_8601_duration_openai_variant: "iso_8601_duration_openai_variant";
        unix_timestamp: "unix_timestamp";
        unix_timestamp_in_ms: "unix_timestamp_in_ms";
    }>>>;
}, z.core.$strip>, z.ZodObject<{
    maxAttempts: z.ZodOptional<z.ZodNumber>;
    factor: z.ZodOptional<z.ZodNumber>;
    minTimeoutInMs: z.ZodOptional<z.ZodNumber>;
    maxTimeoutInMs: z.ZodOptional<z.ZodNumber>;
    randomize: z.ZodOptional<z.ZodBoolean>;
    outOfMemory: z.ZodOptional<z.ZodObject<{
        machine: z.ZodOptional<z.ZodEnum<{
            "large-1x": "large-1x";
            "large-2x": "large-2x";
            "medium-1x": "medium-1x";
            "medium-2x": "medium-2x";
            micro: "micro";
            "small-1x": "small-1x";
            "small-2x": "small-2x";
        }>>;
    }, z.core.$strip>>;
    strategy: z.ZodLiteral<"backoff">;
    bodyFilter: z.ZodOptional<z.ZodType<EventFilter, unknown, z.core.$ZodTypeInternals<EventFilter, unknown>>>;
}, z.core.$strip>]>;
export type FetchRetryStrategy = z.infer<typeof FetchRetryStrategy>;
export declare const FetchRetryByStatusOptions: z.ZodRecord<z.ZodString, import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
    strategy: z.ZodLiteral<"headers">;
    limitHeader: z.ZodString;
    remainingHeader: z.ZodString;
    resetHeader: z.ZodString;
    bodyFilter: z.ZodOptional<z.ZodType<EventFilter, unknown, z.core.$ZodTypeInternals<EventFilter, unknown>>>;
    resetFormat: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        iso_8601: "iso_8601";
        iso_8601_duration_openai_variant: "iso_8601_duration_openai_variant";
        unix_timestamp: "unix_timestamp";
        unix_timestamp_in_ms: "unix_timestamp_in_ms";
    }>>>;
}, z.core.$strip>, z.ZodObject<{
    maxAttempts: z.ZodOptional<z.ZodNumber>;
    factor: z.ZodOptional<z.ZodNumber>;
    minTimeoutInMs: z.ZodOptional<z.ZodNumber>;
    maxTimeoutInMs: z.ZodOptional<z.ZodNumber>;
    randomize: z.ZodOptional<z.ZodBoolean>;
    outOfMemory: z.ZodOptional<z.ZodObject<{
        machine: z.ZodOptional<z.ZodEnum<{
            "large-1x": "large-1x";
            "large-2x": "large-2x";
            "medium-1x": "medium-1x";
            "medium-2x": "medium-2x";
            micro: "micro";
            "small-1x": "small-1x";
            "small-2x": "small-2x";
        }>>;
    }, z.core.$strip>>;
    strategy: z.ZodLiteral<"backoff">;
    bodyFilter: z.ZodOptional<z.ZodType<EventFilter, unknown, z.core.$ZodTypeInternals<EventFilter, unknown>>>;
}, z.core.$strip>]>>;
/** An object where the key is a status code pattern and the value is a retrying strategy. Supported patterns are:
  - Specific status codes: 429
  - Ranges: 500-599
  - Wildcards: 2xx, 3xx, 4xx, 5xx
  */
export type FetchRetryByStatusOptions = Prettify<z.infer<typeof FetchRetryByStatusOptions>>;
export declare const FetchTimeoutOptions: z.ZodObject<{
    durationInMs: z.ZodOptional<z.ZodNumber>;
    retry: z.ZodOptional<z.ZodObject<{
        maxAttempts: z.ZodOptional<z.ZodNumber>;
        factor: z.ZodOptional<z.ZodNumber>;
        minTimeoutInMs: z.ZodOptional<z.ZodNumber>;
        maxTimeoutInMs: z.ZodOptional<z.ZodNumber>;
        randomize: z.ZodOptional<z.ZodBoolean>;
        outOfMemory: z.ZodOptional<z.ZodObject<{
            machine: z.ZodOptional<z.ZodEnum<{
                "large-1x": "large-1x";
                "large-2x": "large-2x";
                "medium-1x": "medium-1x";
                "medium-2x": "medium-2x";
                micro: "micro";
                "small-1x": "small-1x";
                "small-2x": "small-2x";
            }>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type FetchTimeoutOptions = z.infer<typeof FetchTimeoutOptions>;
export declare const FetchRetryOptions: z.ZodObject<{
    byStatus: z.ZodOptional<z.ZodRecord<z.ZodString, import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
        strategy: z.ZodLiteral<"headers">;
        limitHeader: z.ZodString;
        remainingHeader: z.ZodString;
        resetHeader: z.ZodString;
        bodyFilter: z.ZodOptional<z.ZodType<EventFilter, unknown, z.core.$ZodTypeInternals<EventFilter, unknown>>>;
        resetFormat: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
            iso_8601: "iso_8601";
            iso_8601_duration_openai_variant: "iso_8601_duration_openai_variant";
            unix_timestamp: "unix_timestamp";
            unix_timestamp_in_ms: "unix_timestamp_in_ms";
        }>>>;
    }, z.core.$strip>, z.ZodObject<{
        maxAttempts: z.ZodOptional<z.ZodNumber>;
        factor: z.ZodOptional<z.ZodNumber>;
        minTimeoutInMs: z.ZodOptional<z.ZodNumber>;
        maxTimeoutInMs: z.ZodOptional<z.ZodNumber>;
        randomize: z.ZodOptional<z.ZodBoolean>;
        outOfMemory: z.ZodOptional<z.ZodObject<{
            machine: z.ZodOptional<z.ZodEnum<{
                "large-1x": "large-1x";
                "large-2x": "large-2x";
                "medium-1x": "medium-1x";
                "medium-2x": "medium-2x";
                micro: "micro";
                "small-1x": "small-1x";
                "small-2x": "small-2x";
            }>>;
        }, z.core.$strip>>;
        strategy: z.ZodLiteral<"backoff">;
        bodyFilter: z.ZodOptional<z.ZodType<EventFilter, unknown, z.core.$ZodTypeInternals<EventFilter, unknown>>>;
    }, z.core.$strip>]>>>;
    timeout: z.ZodOptional<z.ZodObject<{
        maxAttempts: z.ZodOptional<z.ZodNumber>;
        factor: z.ZodOptional<z.ZodNumber>;
        minTimeoutInMs: z.ZodOptional<z.ZodNumber>;
        maxTimeoutInMs: z.ZodOptional<z.ZodNumber>;
        randomize: z.ZodOptional<z.ZodBoolean>;
        outOfMemory: z.ZodOptional<z.ZodObject<{
            machine: z.ZodOptional<z.ZodEnum<{
                "large-1x": "large-1x";
                "large-2x": "large-2x";
                "medium-1x": "medium-1x";
                "medium-2x": "medium-2x";
                micro: "micro";
                "small-1x": "small-1x";
                "small-2x": "small-2x";
            }>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    connectionError: z.ZodOptional<z.ZodObject<{
        maxAttempts: z.ZodOptional<z.ZodNumber>;
        factor: z.ZodOptional<z.ZodNumber>;
        minTimeoutInMs: z.ZodOptional<z.ZodNumber>;
        maxTimeoutInMs: z.ZodOptional<z.ZodNumber>;
        randomize: z.ZodOptional<z.ZodBoolean>;
        outOfMemory: z.ZodOptional<z.ZodObject<{
            machine: z.ZodOptional<z.ZodEnum<{
                "large-1x": "large-1x";
                "large-2x": "large-2x";
                "medium-1x": "medium-1x";
                "medium-2x": "medium-2x";
                micro: "micro";
                "small-1x": "small-1x";
                "small-2x": "small-2x";
            }>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type FetchRetryOptions = Prettify<z.infer<typeof FetchRetryOptions>>;
