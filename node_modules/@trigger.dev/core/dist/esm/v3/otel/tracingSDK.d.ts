import type { TracerProvider } from "@opentelemetry/api";
import { type Instrumentation } from "@opentelemetry/instrumentation";
import type { Resource } from "@opentelemetry/resources";
import type { LogRecordExporter, ReadableLogRecord } from "@opentelemetry/sdk-logs";
import { LoggerProvider } from "@opentelemetry/sdk-logs";
import { type MetricReader, type PushMetricExporter } from "@opentelemetry/sdk-metrics";
import { RandomIdGenerator } from "@opentelemetry/sdk-trace-base";
import type { SpanExporter } from "@opentelemetry/sdk-trace-node";
export type TracingDiagnosticLogLevel = "none" | "error" | "warn" | "info" | "debug" | "verbose" | "all";
export type TracingSDKConfig = {
    url: string;
    metricsUrl?: string;
    forceFlushTimeoutMillis?: number;
    instrumentations?: Instrumentation[];
    exporters?: SpanExporter[];
    logExporters?: LogRecordExporter[];
    metricExporters?: PushMetricExporter[];
    metricReaders?: MetricReader[];
    diagLogLevel?: TracingDiagnosticLogLevel;
    resource?: Resource;
    hostMetrics?: boolean;
    /** Limit host metrics collection to specific groups (e.g. ["process.cpu", "process.memory"]) */
    hostMetricGroups?: string[];
    /** Enable Node.js runtime metrics (event loop utilization, heap usage, etc.) */
    nodejsRuntimeMetrics?: boolean;
    /** Enable filesystem metrics (Linux only, reads /proc/mounts + fs.statfs) */
    filesystemMetrics?: boolean;
    /** Enable disk I/O metrics (Linux only, reads /proc/diskstats) */
    diskIoMetrics?: boolean;
    /** Metric instrument name patterns to drop (supports wildcards, e.g. "system.cpu.*") */
    droppedMetrics?: string[];
};
export declare class TracingSDK {
    private readonly config;
    private readonly _logProvider;
    private readonly _spanExporter;
    private readonly _traceProvider;
    private readonly _meterProvider;
    private readonly _metricReaders;
    readonly getLogger: LoggerProvider["getLogger"];
    readonly getTracer: TracerProvider["getTracer"];
    constructor(config: TracingSDKConfig);
    flush(): Promise<void>;
    private _flushMetricReadersSerially;
    private _shutdownMetricReadersSerially;
    private _eachMetricReaderSerially;
    shutdown(): Promise<void>;
}
/** Only the current run and the tail of recently ended ones can still export. */
export declare const MAX_TRACKED_INTERNAL_TRACES = 64;
/**
 * External trace ids for runs that carry no external trace context — with
 * `processKeepAlive` the `TracingSDK` outlives the run, so an id captured at
 * construction merges every run on the process into one trace.
 *
 * A record's id comes from its own internal trace id rather than from whatever
 * run is current when the exporter is called. Batch processors drain
 * asynchronously, so a run's records are routinely exported after the next run
 * has started, and reading ambient state then would stamp them with the wrong
 * run's id. It also makes a run's spans and logs agree without coordinating.
 *
 * Granularity therefore follows the internal trace, not the run: a run tree
 * shares one internal trace, so a parent and the runs it triggers land on one
 * external trace together, which is the grouping you want.
 */
export declare class FallbackExternalTraceIds {
    private seed;
    private traceIdGenerator;
    private readonly byInternalTrace;
    constructor(seed: string, traceIdGenerator?: Pick<RandomIdGenerator, "generateTraceId">);
    /** False when no external trace id was configured, i.e. external export is off. */
    get enabled(): boolean;
    forInternalTrace(internalTraceId: string): string;
}
export declare class ExternalSpanExporterWrapper {
    private underlyingExporter;
    private fallback;
    constructor(underlyingExporter: SpanExporter, fallback: FallbackExternalTraceIds);
    private transformSpan;
    export(spans: any[], resultCallback: (result: any) => void): void;
    shutdown(): Promise<void>;
    forceFlush?(): Promise<void>;
}
export declare class ExternalLogRecordExporterWrapper {
    private underlyingExporter;
    private fallback;
    constructor(underlyingExporter: LogRecordExporter, fallback: FallbackExternalTraceIds);
    export(logs: any[], resultCallback: (result: any) => void): void;
    shutdown(): Promise<void>;
    forceFlush(): Promise<void>;
    transformLogRecord(logRecord: ReadableLogRecord, externalTraceContext: {
        traceId: string;
        spanId: string;
        tracestate?: string;
        traceFlags: number;
    } | undefined): ReadableLogRecord;
}
