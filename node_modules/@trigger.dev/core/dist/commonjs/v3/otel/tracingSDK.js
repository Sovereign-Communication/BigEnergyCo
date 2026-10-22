"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalLogRecordExporterWrapper = exports.ExternalSpanExporterWrapper = exports.FallbackExternalTraceIds = exports.MAX_TRACKED_INTERNAL_TRACES = exports.TracingSDK = void 0;
const api_1 = require("@opentelemetry/api");
const api_logs_1 = require("@opentelemetry/api-logs");
const core_1 = require("@opentelemetry/core");
const exporter_logs_otlp_http_1 = require("@opentelemetry/exporter-logs-otlp-http");
const exporter_trace_otlp_http_1 = require("@opentelemetry/exporter-trace-otlp-http");
const exporter_metrics_otlp_http_1 = require("@opentelemetry/exporter-metrics-otlp-http");
const host_metrics_1 = require("@opentelemetry/host-metrics");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const resources_1 = require("@opentelemetry/resources");
const sdk_logs_1 = require("@opentelemetry/sdk-logs");
const sdk_metrics_1 = require("@opentelemetry/sdk-metrics");
const sdk_trace_base_1 = require("@opentelemetry/sdk-trace-base");
const sdk_trace_node_1 = require("@opentelemetry/sdk-trace-node");
const version_js_1 = require("../../version.js");
const limits_js_1 = require("../limits.js");
const semanticInternalAttributes_js_1 = require("../semanticInternalAttributes.js");
const task_context_api_js_1 = require("../task-context-api.js");
const otelProcessors_js_1 = require("../taskContext/otelProcessors.js");
const trace_context_api_js_1 = require("../trace-context-api.js");
const getEnv_js_1 = require("../utils/getEnv.js");
const machineId_js_1 = require("./machineId.js");
const diskIoMetrics_js_1 = require("./diskIoMetrics.js");
const filesystemMetrics_js_1 = require("./filesystemMetrics.js");
const nodejsRuntimeMetrics_js_1 = require("./nodejsRuntimeMetrics.js");
const idGenerator = new sdk_trace_base_1.RandomIdGenerator();
class TracingSDK {
    config;
    _logProvider;
    _spanExporter;
    _traceProvider;
    _meterProvider;
    _metricReaders;
    getLogger;
    getTracer;
    constructor(config) {
        this.config = config;
        setLogLevel(config.diagLogLevel ?? "none");
        const envResourceAttributesSerialized = (0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_RESOURCE_ATTRIBUTES");
        const envResourceAttributes = envResourceAttributesSerialized
            ? JSON.parse(envResourceAttributesSerialized)
            : {};
        const customEnvResourceAttributes = parseOtelResourceAttributes((0, getEnv_js_1.getEnvVar)("CUSTOM_OTEL_RESOURCE_ATTRIBUTES"));
        const commonResources = (0, resources_1.detectResources)({
            detectors: [resources_1.processDetector],
        })
            .merge((0, resources_1.resourceFromAttributes)({
            "cloud.provider": "trigger.dev",
            "service.name": (0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_SERVICE_NAME") ?? "trigger.dev",
            [semanticInternalAttributes_js_1.SemanticInternalAttributes.TRIGGER]: true,
            [semanticInternalAttributes_js_1.SemanticInternalAttributes.CLI_VERSION]: version_js_1.VERSION,
            [semanticInternalAttributes_js_1.SemanticInternalAttributes.SDK_VERSION]: version_js_1.VERSION,
            [semanticInternalAttributes_js_1.SemanticInternalAttributes.SDK_LANGUAGE]: "typescript",
            [semanticInternalAttributes_js_1.SemanticInternalAttributes.MACHINE_ID]: machineId_js_1.machineId,
        }))
            .merge((0, resources_1.resourceFromAttributes)(envResourceAttributes))
            .merge((0, resources_1.resourceFromAttributes)(customEnvResourceAttributes))
            .merge((0, resources_1.resourceFromAttributes)(task_context_api_js_1.taskContext.resourceAttributes))
            .merge(config.resource ?? (0, resources_1.resourceFromAttributes)({}));
        const spanExporter = new exporter_trace_otlp_http_1.OTLPTraceExporter({
            url: `${config.url}/v1/traces`,
            timeoutMillis: config.forceFlushTimeoutMillis,
        });
        const spanProcessors = [];
        spanProcessors.push(new otelProcessors_js_1.TaskContextSpanProcessor(version_js_1.VERSION, (0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_BATCH_PROCESSING_ENABLED") === "1"
            ? new sdk_trace_node_1.BatchSpanProcessor(spanExporter, {
                maxExportBatchSize: parseInt((0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_SPAN_MAX_EXPORT_BATCH_SIZE") ?? "64"),
                scheduledDelayMillis: parseInt((0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_SPAN_SCHEDULED_DELAY_MILLIS") ?? "200"),
                exportTimeoutMillis: parseInt((0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_SPAN_EXPORT_TIMEOUT_MILLIS") ?? "30000"),
                maxQueueSize: parseInt((0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_SPAN_MAX_QUEUE_SIZE") ?? "512"),
            })
            : new sdk_trace_node_1.SimpleSpanProcessor(spanExporter)));
        // Shared by every wrapper below so a run's spans and logs agree on the id.
        const fallbackTraceIds = new FallbackExternalTraceIds(idGenerator.generateTraceId());
        for (const exporter of config.exporters ?? []) {
            spanProcessors.push((0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_BATCH_PROCESSING_ENABLED") === "1"
                ? new sdk_trace_node_1.BatchSpanProcessor(new ExternalSpanExporterWrapper(exporter, fallbackTraceIds), {
                    maxExportBatchSize: parseInt((0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_SPAN_MAX_EXPORT_BATCH_SIZE") ?? "64"),
                    scheduledDelayMillis: parseInt((0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_SPAN_SCHEDULED_DELAY_MILLIS") ?? "200"),
                    exportTimeoutMillis: parseInt((0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_SPAN_EXPORT_TIMEOUT_MILLIS") ?? "30000"),
                    maxQueueSize: parseInt((0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_SPAN_MAX_QUEUE_SIZE") ?? "512"),
                })
                : new sdk_trace_node_1.SimpleSpanProcessor(new ExternalSpanExporterWrapper(exporter, fallbackTraceIds)));
        }
        const traceProvider = new sdk_trace_node_1.NodeTracerProvider({
            forceFlushTimeoutMillis: config.forceFlushTimeoutMillis,
            resource: commonResources,
            spanLimits: {
                attributeCountLimit: limits_js_1.OTEL_SPAN_ATTRIBUTE_COUNT_LIMIT,
                attributeValueLengthLimit: limits_js_1.OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT,
                eventCountLimit: limits_js_1.OTEL_SPAN_EVENT_COUNT_LIMIT,
                attributePerEventCountLimit: limits_js_1.OTEL_ATTRIBUTE_PER_EVENT_COUNT_LIMIT,
                linkCountLimit: limits_js_1.OTEL_LINK_COUNT_LIMIT,
                attributePerLinkCountLimit: limits_js_1.OTEL_ATTRIBUTE_PER_LINK_COUNT_LIMIT,
            },
            spanProcessors,
        });
        traceProvider.register();
        (0, instrumentation_1.registerInstrumentations)({
            instrumentations: config.instrumentations ?? [],
            tracerProvider: traceProvider,
        });
        const logExporter = new exporter_logs_otlp_http_1.OTLPLogExporter({
            url: `${config.url}/v1/logs`,
        });
        const logProcessors = [
            new otelProcessors_js_1.TaskContextLogProcessor((0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_BATCH_PROCESSING_ENABLED") === "1"
                ? new sdk_logs_1.BatchLogRecordProcessor(logExporter, {
                    maxExportBatchSize: parseInt((0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_LOG_MAX_EXPORT_BATCH_SIZE") ?? "64"),
                    scheduledDelayMillis: parseInt((0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_LOG_SCHEDULED_DELAY_MILLIS") ?? "200"),
                    exportTimeoutMillis: parseInt((0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_LOG_EXPORT_TIMEOUT_MILLIS") ?? "30000"),
                    maxQueueSize: parseInt((0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_LOG_MAX_QUEUE_SIZE") ?? "512"),
                })
                : new sdk_logs_1.SimpleLogRecordProcessor(logExporter)),
        ];
        for (const externalLogExporter of config.logExporters ?? []) {
            logProcessors.push((0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_BATCH_PROCESSING_ENABLED") === "1"
                ? new sdk_logs_1.BatchLogRecordProcessor(new ExternalLogRecordExporterWrapper(externalLogExporter, fallbackTraceIds), {
                    maxExportBatchSize: parseInt((0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_LOG_MAX_EXPORT_BATCH_SIZE") ?? "64"),
                    scheduledDelayMillis: parseInt((0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_LOG_SCHEDULED_DELAY_MILLIS") ?? "200"),
                    exportTimeoutMillis: parseInt((0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_LOG_EXPORT_TIMEOUT_MILLIS") ?? "30000"),
                    maxQueueSize: parseInt((0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_LOG_MAX_QUEUE_SIZE") ?? "512"),
                })
                : new sdk_logs_1.SimpleLogRecordProcessor(new ExternalLogRecordExporterWrapper(externalLogExporter, fallbackTraceIds)));
        }
        // To start a logger, you first need to initialize the Logger provider.
        const loggerProvider = new sdk_logs_1.LoggerProvider({
            resource: commonResources,
            logRecordLimits: {
                attributeCountLimit: limits_js_1.OTEL_LOG_ATTRIBUTE_COUNT_LIMIT,
                attributeValueLengthLimit: limits_js_1.OTEL_LOG_ATTRIBUTE_VALUE_LENGTH_LIMIT,
            },
            processors: logProcessors,
        });
        this._logProvider = loggerProvider;
        this._spanExporter = spanExporter;
        this._traceProvider = traceProvider;
        api_logs_1.logs.setGlobalLoggerProvider(loggerProvider);
        // Metrics setup
        const metricsUrl = config.metricsUrl ?? (0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_METRICS_ENDPOINT") ?? `${config.url}/v1/metrics`;
        const rawMetricExporter = new exporter_metrics_otlp_http_1.OTLPMetricExporter({
            url: metricsUrl,
            timeoutMillis: config.forceFlushTimeoutMillis,
        });
        const collectionIntervalMs = parseInt((0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_METRICS_COLLECTION_INTERVAL_MILLIS") ?? "10000");
        const exportIntervalMs = parseInt((0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_METRICS_EXPORT_INTERVAL_MILLIS") ?? "30000");
        // Chain: PeriodicReader(10s) → TaskContextMetricExporter → BufferingMetricExporter(30s) → OTLP
        const bufferingExporter = new otelProcessors_js_1.BufferingMetricExporter(rawMetricExporter, exportIntervalMs);
        const metricExporter = new otelProcessors_js_1.TaskContextMetricExporter(bufferingExporter);
        const exportTimeoutMillis = parseInt((0, getEnv_js_1.getEnvVar)("TRIGGER_OTEL_METRICS_EXPORT_TIMEOUT_MILLIS") ?? "30000");
        const metricReaders = [
            new sdk_metrics_1.PeriodicExportingMetricReader({
                exporter: metricExporter,
                exportIntervalMillis: collectionIntervalMs,
                exportTimeoutMillis: Math.min(exportTimeoutMillis, collectionIntervalMs),
            }),
            ...(config.metricExporters ?? []).map((exporter) => new sdk_metrics_1.PeriodicExportingMetricReader({
                exporter,
                exportIntervalMillis: collectionIntervalMs,
                exportTimeoutMillis: Math.min(exportTimeoutMillis, collectionIntervalMs),
            })),
            ...(config.metricReaders ?? []),
        ];
        const meterProvider = new sdk_metrics_1.MeterProvider({
            resource: commonResources,
            readers: metricReaders,
            views: (config.droppedMetrics ?? []).map((pattern) => ({
                instrumentName: pattern,
                aggregation: { type: sdk_metrics_1.AggregationType.DROP },
            })),
        });
        this._meterProvider = meterProvider;
        this._metricReaders = metricReaders;
        api_1.metrics.setGlobalMeterProvider(meterProvider);
        if (config.hostMetrics) {
            const hostMetrics = new host_metrics_1.HostMetrics({
                meterProvider,
                metricGroups: config.hostMetricGroups,
            });
            hostMetrics.start();
        }
        if (config.nodejsRuntimeMetrics) {
            (0, nodejsRuntimeMetrics_js_1.startNodejsRuntimeMetrics)(meterProvider);
        }
        if (config.filesystemMetrics) {
            (0, filesystemMetrics_js_1.startFilesystemMetrics)(meterProvider);
        }
        if (config.diskIoMetrics) {
            (0, diskIoMetrics_js_1.startDiskIoMetrics)(meterProvider);
        }
        this.getLogger = loggerProvider.getLogger.bind(loggerProvider);
        this.getTracer = traceProvider.getTracer.bind(traceProvider);
    }
    async flush() {
        await Promise.all([
            this._traceProvider.forceFlush(),
            this._logProvider.forceFlush(),
            this._flushMetricReadersSerially(),
        ]);
    }
    async _flushMetricReadersSerially() {
        await this._eachMetricReaderSerially("flush", (reader) => reader.forceFlush());
    }
    async _shutdownMetricReadersSerially() {
        await this._eachMetricReaderSerially("shut down", (reader) => reader.shutdown());
        await this._meterProvider.shutdown();
    }
    async _eachMetricReaderSerially(action, run) {
        const errors = [];
        for (const reader of this._metricReaders) {
            try {
                await run(reader);
            }
            catch (error) {
                console.error(`Failed to ${action} metric reader ${reader.constructor.name}`, error);
                errors.push(error);
            }
        }
        if (errors.length > 0) {
            throw errors[0];
        }
    }
    async shutdown() {
        await Promise.all([
            this._traceProvider.shutdown(),
            this._logProvider.shutdown(),
            this._shutdownMetricReadersSerially(),
        ]);
    }
}
exports.TracingSDK = TracingSDK;
function setLogLevel(level) {
    let diagLogLevel;
    switch (level) {
        case "none":
            diagLogLevel = api_1.DiagLogLevel.NONE;
            break;
        case "error":
            diagLogLevel = api_1.DiagLogLevel.ERROR;
            break;
        case "warn":
            diagLogLevel = api_1.DiagLogLevel.WARN;
            break;
        case "info":
            diagLogLevel = api_1.DiagLogLevel.INFO;
            break;
        case "debug":
            diagLogLevel = api_1.DiagLogLevel.DEBUG;
            break;
        case "verbose":
            diagLogLevel = api_1.DiagLogLevel.VERBOSE;
            break;
        case "all":
            diagLogLevel = api_1.DiagLogLevel.ALL;
            break;
        default:
            diagLogLevel = api_1.DiagLogLevel.NONE;
    }
    api_1.diag.setLogger(new api_1.DiagConsoleLogger(), diagLogLevel);
}
/** Only the current run and the tail of recently ended ones can still export. */
exports.MAX_TRACKED_INTERNAL_TRACES = 64;
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
class FallbackExternalTraceIds {
    seed;
    traceIdGenerator;
    byInternalTrace = new Map();
    constructor(seed, traceIdGenerator = idGenerator) {
        this.seed = seed;
        this.traceIdGenerator = traceIdGenerator;
    }
    /** False when no external trace id was configured, i.e. external export is off. */
    get enabled() {
        return !!this.seed;
    }
    forInternalTrace(internalTraceId) {
        // An empty seed means external export is disabled — leave it that way
        // rather than minting an id and switching the feature on.
        if (!this.seed) {
            return this.seed;
        }
        const known = this.byInternalTrace.get(internalTraceId);
        if (known) {
            // Re-insert so the map is ordered by last use rather than first. A run
            // that is still exporting keeps its id even if enough unrelated traces
            // appear alongside it to fill the map, which would otherwise split it
            // across two external traces.
            this.byInternalTrace.delete(internalTraceId);
            this.byInternalTrace.set(internalTraceId, known);
            return known;
        }
        // The first run reuses the id generated at construction, so the configured
        // seed is not thrown away.
        const traceId = this.byInternalTrace.size === 0 ? this.seed : this.traceIdGenerator.generateTraceId();
        this.byInternalTrace.set(internalTraceId, traceId);
        if (this.byInternalTrace.size > exports.MAX_TRACKED_INTERNAL_TRACES) {
            // Map iterates in insertion order, so this drops the least recently used.
            const stalest = this.byInternalTrace.keys().next().value;
            if (stalest !== undefined) {
                this.byInternalTrace.delete(stalest);
            }
        }
        return traceId;
    }
}
exports.FallbackExternalTraceIds = FallbackExternalTraceIds;
class ExternalSpanExporterWrapper {
    underlyingExporter;
    fallback;
    constructor(underlyingExporter, fallback) {
        this.underlyingExporter = underlyingExporter;
        this.fallback = fallback;
    }
    transformSpan(span) {
        // Read external context live, so per-run reassignment of
        // standardTraceContextManager.traceContext is honoured on warm-started
        // workers that reuse a single TracingSDK across runs.
        const externalTraceContext = trace_context_api_js_1.traceContext.getExternalTraceContext();
        const isExternallySampled = externalTraceContext
            ? isTraceFlagSampled(externalTraceContext.traceFlags)
            : this.fallback.enabled;
        if (!isExternallySampled) {
            return;
        }
        if (isSpanInternalOnly(span)) {
            return;
        }
        const externalTraceId = externalTraceContext
            ? externalTraceContext.traceId
            : this.fallback.forInternalTrace(span.spanContext().traceId);
        const isAttemptSpan = span.attributes[semanticInternalAttributes_js_1.SemanticInternalAttributes.SPAN_ATTEMPT];
        const spanContext = span.spanContext();
        let parentSpanContext = span.parentSpanContext;
        if (parentSpanContext) {
            parentSpanContext = {
                ...parentSpanContext,
                traceId: externalTraceId,
            };
        }
        if (isAttemptSpan && externalTraceContext) {
            parentSpanContext = {
                ...parentSpanContext,
                traceId: externalTraceId,
                spanId: externalTraceContext.spanId,
                traceState: externalTraceContext.tracestate
                    ? new core_1.TraceState(externalTraceContext.tracestate)
                    : undefined,
                traceFlags: externalTraceContext.traceFlags,
            };
        }
        else if (isAttemptSpan) {
            parentSpanContext = undefined;
        }
        return {
            ...span,
            spanContext: () => ({ ...spanContext, traceId: externalTraceId }),
            parentSpanContext,
        };
    }
    export(spans, resultCallback) {
        try {
            const modifiedSpans = spans.map(this.transformSpan.bind(this));
            this.underlyingExporter.export(modifiedSpans.filter(Boolean), resultCallback);
        }
        catch (e) {
            console.error(e);
        }
    }
    shutdown() {
        return this.underlyingExporter.shutdown();
    }
    forceFlush() {
        return this.underlyingExporter.forceFlush
            ? this.underlyingExporter.forceFlush()
            : Promise.resolve();
    }
}
exports.ExternalSpanExporterWrapper = ExternalSpanExporterWrapper;
class ExternalLogRecordExporterWrapper {
    underlyingExporter;
    fallback;
    constructor(underlyingExporter, fallback) {
        this.underlyingExporter = underlyingExporter;
        this.fallback = fallback;
    }
    export(logs, resultCallback) {
        const externalTraceContext = trace_context_api_js_1.traceContext.getExternalTraceContext();
        const isExternallySampled = externalTraceContext
            ? isTraceFlagSampled(externalTraceContext.traceFlags)
            : this.fallback.enabled;
        if (!isExternallySampled) {
            this.underlyingExporter.export([], resultCallback);
            return;
        }
        const modifiedLogs = logs.map((log) => this.transformLogRecord(log, externalTraceContext));
        this.underlyingExporter.export(modifiedLogs, resultCallback);
    }
    shutdown() {
        return this.underlyingExporter.shutdown();
    }
    forceFlush() {
        const underlyingExporter = this.underlyingExporter;
        return underlyingExporter.forceFlush ? underlyingExporter.forceFlush() : Promise.resolve();
    }
    transformLogRecord(logRecord, externalTraceContext) {
        // Without a spanContext there is no internal trace id to key the fallback
        // on, and nothing to rewrite.
        if (!logRecord.spanContext) {
            return logRecord;
        }
        // Capture externalTraceId for use within the proxy's scope. Use
        // externalTraceContext.traceId if available, otherwise the id belonging to
        // the run this record came from.
        const externalTraceId = externalTraceContext
            ? externalTraceContext.traceId
            : this.fallback.forInternalTrace(logRecord.spanContext.traceId);
        if (!externalTraceId) {
            return logRecord;
        }
        return new Proxy(logRecord, {
            get(target, prop, receiver) {
                if (prop === "spanContext") {
                    // Intercept access to spanContext.
                    const originalSpanContext = target.spanContext;
                    // Ensure originalSpanContext exists (it should, due to the check above, but good for safety).
                    if (originalSpanContext) {
                        return {
                            ...originalSpanContext,
                            traceId: externalTraceId, // Override traceId.
                        };
                    }
                    // Fallback if, for some reason, originalSpanContext is undefined here.
                    return undefined;
                }
                // For all other properties, defer to the original object.
                return Reflect.get(target, prop, receiver);
            },
        });
    }
}
exports.ExternalLogRecordExporterWrapper = ExternalLogRecordExporterWrapper;
function isSpanInternalOnly(span) {
    if (span.attributes[semanticInternalAttributes_js_1.SemanticInternalAttributes.SPAN_PARTIAL]) {
        // Skip partial spans
        return true;
    }
    const urlPath = span.attributes["url.path"];
    if (typeof urlPath === "string" && urlPath === "/api/v1/usage/ingest") {
        return true;
    }
    const httpUrl = span.attributes["http.url"] ?? span.attributes["url.full"];
    const url = safeParseUrl(httpUrl);
    if (!url) {
        return false;
    }
    const internalHosts = [
        "api.trigger.dev",
        "billing.trigger.dev",
        "cloud.trigger.dev",
        "engine.trigger.dev",
        "platform.trigger.dev",
    ];
    return (internalHosts.some((host) => url.hostname.includes(host)) ||
        url.pathname.includes("/api/v1/usage/ingest"));
}
function safeParseUrl(url) {
    if (typeof url !== "string") {
        return undefined;
    }
    try {
        return new URL(url);
    }
    catch (_e) {
        return undefined;
    }
}
function isTraceFlagSampled(traceFlags) {
    if (typeof traceFlags !== "number") {
        return true;
    }
    return (traceFlags & api_1.TraceFlags.SAMPLED) === api_1.TraceFlags.SAMPLED;
}
function isPrintableAscii(str) {
    // printable ASCII: 0x20 (space) .. 0x7E (~)
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code < 0x20 || code > 0x7e)
            return false;
    }
    return true;
}
function isValid(name) {
    if (!name)
        return false;
    return typeof name === "string" && name.length <= 255 && isPrintableAscii(name);
}
function isValidAndNotEmpty(name) {
    if (!name)
        return false;
    return isValid(name) && name.length > 0;
}
function parseOtelResourceAttributes(rawEnvAttributes) {
    if (!rawEnvAttributes)
        return {};
    const COMMA = ",";
    const KV = "=";
    const attributes = {};
    // use negative limit to support trailing empty attribute
    const rawAttributes = rawEnvAttributes.split(COMMA, -1);
    for (const rawAttribute of rawAttributes) {
        const keyValuePair = rawAttribute.split(KV, -1);
        if (keyValuePair.length !== 2) {
            // skip invalid pair
            continue;
        }
        let [key, value] = keyValuePair;
        key = key?.trim();
        // trim and remove surrounding double quotes
        value = value?.trim().replace(/^"|"$/g, "");
        if (!value || !key) {
            continue;
        }
        if (!isValidAndNotEmpty(key)) {
            throw new Error(`Attribute key should be a ASCII string with a length greater than 0 and not exceed 255 characters.`);
        }
        if (!isValid(value)) {
            throw new Error(`Attribute value should be a ASCII string with a length not exceed 255 characters.`);
        }
        // decode percent-encoding (deployment%20name -> deployment name)
        try {
            attributes[key] = decodeURIComponent(value);
        }
        catch (e) {
            // decodeURIComponent can throw for malformed sequences; rethrow or handle
            if (e instanceof Error) {
                throw new Error(`Failed to decode attribute value for key ${key}: ${e.message}`);
            }
            throw new Error(`Failed to decode attribute value for key ${key}`);
        }
    }
    return attributes;
}
//# sourceMappingURL=tracingSDK.js.map