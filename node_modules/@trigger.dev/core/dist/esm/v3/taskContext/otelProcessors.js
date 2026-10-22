import { trace } from "@opentelemetry/api";
import { ExportResultCode } from "@opentelemetry/core";
import { SemanticInternalAttributes } from "../semanticInternalAttributes.js";
import { taskContext } from "../task-context-api.js";
import { flattenAttributes } from "../utils/flattenAttributes.js";
export class TaskContextSpanProcessor {
    _innerProcessor;
    _tracer;
    constructor(version, innerProcessor) {
        this._tracer = trace.getTracer("trigger-dev-worker", version);
        this._innerProcessor = innerProcessor;
    }
    // Called when a span starts
    onStart(span, parentContext) {
        if (taskContext.ctx) {
            span.setAttributes(flattenAttributes(taskContext.attributes, SemanticInternalAttributes.METADATA));
            // Set run tags as a proper array attribute (not flattened) so it arrives
            // as an OTEL ArrayValue and can be extracted on the server side.
            if (!taskContext.isRunDisabled && taskContext.ctx.run.tags?.length) {
                span.setAttribute(SemanticInternalAttributes.RUN_TAGS, taskContext.ctx.run.tags);
            }
            // Stamp `gen_ai.conversation.id` (OTel GenAI semantic convention)
            // directly on every span so it survives the OTLP ingest's `ctx.*`
            // strip and lands in the stored attributes column without a schema
            // migration.
            if (taskContext.conversationId) {
                span.setAttribute(SemanticInternalAttributes.GEN_AI_CONVERSATION_ID, taskContext.conversationId);
            }
        }
        if (!isPartialSpan(span) && !skipPartialSpan(span)) {
            const partialSpan = createPartialSpan(this._tracer, span, parentContext);
            partialSpan.end();
        }
        this._innerProcessor.onStart(span, parentContext);
    }
    // Delegate the rest of the methods to the wrapped processor
    onEnd(span) {
        this._innerProcessor.onEnd(span);
    }
    shutdown() {
        return this._innerProcessor.shutdown();
    }
    forceFlush() {
        return this._innerProcessor.forceFlush();
    }
}
function isPartialSpan(span) {
    return span.attributes[SemanticInternalAttributes.SPAN_PARTIAL] === true;
}
function skipPartialSpan(span) {
    return span.attributes[SemanticInternalAttributes.SKIP_SPAN_PARTIAL] === true;
}
function createPartialSpan(tracer, span, parentContext) {
    const partialSpan = tracer.startSpan(span.name, {
        attributes: {
            [SemanticInternalAttributes.SPAN_PARTIAL]: true,
            [SemanticInternalAttributes.SPAN_ID]: span.spanContext().spanId,
            ...span.attributes,
        },
    }, parentContext);
    if (taskContext.ctx) {
        partialSpan.setAttributes(flattenAttributes(taskContext.attributes, SemanticInternalAttributes.METADATA));
    }
    if (span.events) {
        for (const event of span.events) {
            partialSpan.addEvent(event.name, event.attributes, event.time);
        }
    }
    return partialSpan;
}
export class TaskContextLogProcessor {
    _innerProcessor;
    constructor(innerProcessor) {
        this._innerProcessor = innerProcessor;
    }
    forceFlush() {
        return this._innerProcessor.forceFlush();
    }
    onEmit(logRecord, context) {
        // Adds in the context attributes to the log record
        if (taskContext.ctx) {
            logRecord.setAttributes(flattenAttributes(taskContext.attributes, SemanticInternalAttributes.METADATA));
        }
        this._innerProcessor.onEmit(logRecord, context);
    }
    shutdown() {
        return this._innerProcessor.shutdown();
    }
}
export class TaskContextMetricExporter {
    _innerExporter;
    selectAggregationTemporality;
    selectAggregation;
    constructor(_innerExporter) {
        this._innerExporter = _innerExporter;
        if (_innerExporter.selectAggregationTemporality) {
            this.selectAggregationTemporality =
                _innerExporter.selectAggregationTemporality.bind(_innerExporter);
        }
        if (_innerExporter.selectAggregation) {
            this.selectAggregation = _innerExporter.selectAggregation.bind(_innerExporter);
        }
    }
    export(metrics, resultCallback) {
        if (!taskContext.ctx) {
            // No task context yet — pass through without adding context attributes
            this._innerExporter.export(metrics, resultCallback);
            return;
        }
        const ctx = taskContext.ctx;
        let contextAttrs;
        if (taskContext.isRunDisabled) {
            // Between runs: keep environment/project/org/machine attrs, strip run-specific ones
            contextAttrs = {
                [SemanticInternalAttributes.ENVIRONMENT_ID]: ctx.environment.id,
                [SemanticInternalAttributes.ENVIRONMENT_TYPE]: ctx.environment.type,
                [SemanticInternalAttributes.ORGANIZATION_ID]: ctx.organization.id,
                [SemanticInternalAttributes.PROJECT_ID]: ctx.project.id,
                [SemanticInternalAttributes.MACHINE_PRESET_NAME]: ctx.machine?.name,
            };
        }
        else {
            // During a run: full context attrs
            contextAttrs = {
                [SemanticInternalAttributes.RUN_ID]: ctx.run.id,
                [SemanticInternalAttributes.TASK_SLUG]: ctx.task.id,
                [SemanticInternalAttributes.ATTEMPT_NUMBER]: ctx.attempt.number,
                [SemanticInternalAttributes.ENVIRONMENT_ID]: ctx.environment.id,
                [SemanticInternalAttributes.ORGANIZATION_ID]: ctx.organization.id,
                [SemanticInternalAttributes.PROJECT_ID]: ctx.project.id,
                [SemanticInternalAttributes.MACHINE_PRESET_NAME]: ctx.machine?.name,
                [SemanticInternalAttributes.ENVIRONMENT_TYPE]: ctx.environment.type,
            };
        }
        if (taskContext.worker) {
            contextAttrs[SemanticInternalAttributes.WORKER_ID] = taskContext.worker.id;
            contextAttrs[SemanticInternalAttributes.WORKER_VERSION] = taskContext.worker.version;
        }
        if (!taskContext.isRunDisabled && ctx.run.tags?.length) {
            contextAttrs[SemanticInternalAttributes.RUN_TAGS] = ctx.run.tags;
        }
        if (taskContext.conversationId) {
            contextAttrs[SemanticInternalAttributes.GEN_AI_CONVERSATION_ID] = taskContext.conversationId;
        }
        const modified = {
            resource: metrics.resource,
            scopeMetrics: metrics.scopeMetrics.map((scope) => ({
                ...scope,
                metrics: scope.metrics.map((metric) => ({
                    ...metric,
                    dataPoints: metric.dataPoints.map((dp) => ({
                        ...dp,
                        attributes: { ...dp.attributes, ...contextAttrs },
                    })),
                })),
            })),
        };
        this._innerExporter.export(modified, resultCallback);
    }
    forceFlush() {
        return this._innerExporter.forceFlush();
    }
    shutdown() {
        return this._innerExporter.shutdown();
    }
}
function isFiniteDataPointValue(value) {
    if (typeof value === "number") {
        return Number.isFinite(value);
    }
    if (typeof value === "object" && value !== null) {
        return ["sum", "min", "max"].every((key) => {
            const component = value[key];
            return typeof component !== "number" || Number.isFinite(component);
        });
    }
    return true;
}
function dropNonFiniteDataPoints(metrics) {
    return {
        ...metrics,
        scopeMetrics: metrics.scopeMetrics.map((scope) => ({
            ...scope,
            metrics: scope.metrics.map((metric) => ({
                ...metric,
                dataPoints: metric.dataPoints.filter((dp) => isFiniteDataPointValue(dp.value)),
            })),
        })),
    };
}
export class BufferingMetricExporter {
    _innerExporter;
    _flushIntervalMs;
    selectAggregationTemporality;
    selectAggregation;
    _buffer = [];
    _lastFlushTime = Date.now();
    constructor(_innerExporter, _flushIntervalMs) {
        this._innerExporter = _innerExporter;
        this._flushIntervalMs = _flushIntervalMs;
        if (_innerExporter.selectAggregationTemporality) {
            this.selectAggregationTemporality =
                _innerExporter.selectAggregationTemporality.bind(_innerExporter);
        }
        if (_innerExporter.selectAggregation) {
            this.selectAggregation = _innerExporter.selectAggregation.bind(_innerExporter);
        }
    }
    export(metrics, resultCallback) {
        this._buffer.push(dropNonFiniteDataPoints(metrics));
        const now = Date.now();
        if (now - this._lastFlushTime >= this._flushIntervalMs) {
            this._lastFlushTime = now;
            const merged = this._mergeBuffer();
            this._innerExporter.export(merged, resultCallback);
        }
        else {
            resultCallback({ code: ExportResultCode.SUCCESS });
        }
    }
    forceFlush() {
        if (this._buffer.length > 0) {
            this._lastFlushTime = Date.now();
            const merged = this._mergeBuffer();
            return new Promise((resolve, reject) => {
                this._innerExporter.export(merged, (result) => {
                    if (result.code === ExportResultCode.SUCCESS) {
                        resolve();
                    }
                    else {
                        reject(result.error ?? new Error("Export failed"));
                    }
                });
            }).then(() => this._innerExporter.forceFlush());
        }
        return this._innerExporter.forceFlush();
    }
    shutdown() {
        return this.forceFlush().then(() => this._innerExporter.shutdown());
    }
    _mergeBuffer() {
        const batch = this._buffer;
        this._buffer = [];
        if (batch.length === 1) {
            return batch[0];
        }
        const base = batch[0];
        // Merge all scopeMetrics by scope name, then metrics by descriptor name
        const scopeMap = new Map();
        for (const rm of batch) {
            for (const sm of rm.scopeMetrics) {
                const scopeKey = sm.scope.name;
                let scopeEntry = scopeMap.get(scopeKey);
                if (!scopeEntry) {
                    scopeEntry = { scope: sm.scope, metricsMap: new Map() };
                    scopeMap.set(scopeKey, scopeEntry);
                }
                for (const metric of sm.metrics) {
                    const metricKey = metric.descriptor.name;
                    const existing = scopeEntry.metricsMap.get(metricKey);
                    if (existing) {
                        // Append data points from this collection to the existing metric
                        scopeEntry.metricsMap.set(metricKey, {
                            ...existing,
                            dataPoints: [...existing.dataPoints, ...metric.dataPoints],
                        });
                    }
                    else {
                        scopeEntry.metricsMap.set(metricKey, {
                            ...metric,
                            dataPoints: [...metric.dataPoints],
                        });
                    }
                }
            }
        }
        return {
            resource: base.resource,
            scopeMetrics: Array.from(scopeMap.values()).map(({ scope, metricsMap }) => ({
                scope,
                metrics: Array.from(metricsMap.values()),
            })),
        };
    }
}
//# sourceMappingURL=otelProcessors.js.map