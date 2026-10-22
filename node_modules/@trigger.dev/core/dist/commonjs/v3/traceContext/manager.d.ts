import type { Context } from "@opentelemetry/api";
import type { TraceContextManager } from "./types.js";
export declare class StandardTraceContextManager implements TraceContextManager {
    traceContext: Record<string, unknown>;
    getTraceContext(): Record<string, unknown>;
    reset(): void;
    getExternalTraceContext(): {
        traceId: string;
        spanId: string;
        traceFlags: number;
        tracestate: string | undefined;
    } | undefined;
    extractContext(): Context;
    withExternalTrace<T>(fn: () => T): T;
}
