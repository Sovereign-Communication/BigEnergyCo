import { type Attributes, type Context, type Span, type SpanOptions, type TimeInput, type Tracer } from "@opentelemetry/api";
import { type Logger } from "@opentelemetry/api-logs";
export type TriggerTracerConfig = {
    name: string;
    version: string;
} | {
    tracer: Tracer;
    logger: Logger;
};
export type TriggerTracerSpanEvent = {
    name: string;
    attributes?: Attributes;
    startTime?: TimeInput;
};
export type TriggerTracerSpanOptions = SpanOptions & {
    events?: TriggerTracerSpanEvent[];
};
export declare class TriggerTracer {
    private readonly _config;
    constructor(_config: TriggerTracerConfig);
    private _tracer;
    private get tracer();
    private _logger;
    private get logger();
    startActiveSpan<T>(name: string, fn: (span: Span) => Promise<T>, options?: TriggerTracerSpanOptions, ctx?: Context, signal?: AbortSignal): Promise<T>;
    startSpan(name: string, options?: SpanOptions, ctx?: Context): Span;
}
