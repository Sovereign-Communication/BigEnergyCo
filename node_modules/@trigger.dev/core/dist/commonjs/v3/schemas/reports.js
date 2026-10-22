"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportViewModelSchema = exports.ReportLinkSchema = exports.ReportSummaryStatementSchema = exports.ReportFindingSchema = exports.ReportObservationSchema = exports.ReportExclusionSchema = exports.ReportFooterEntrySchema = exports.ReportRecommendationSchema = exports.ReportMetricSchema = exports.ReportMetricSeriesSchema = exports.ReportDeltaSchema = exports.ReportLinkKeySchema = exports.ReportReasonCodeSchema = exports.ReportUnitSchema = exports.ReportSeveritySchema = exports.ReportFormatSchema = exports.ReportPeriodSchema = void 0;
const v4_1 = require("zod/v4");
// Shared contract for `GET /api/v1/reports/:key`: the period grammar and the `format=json` body.
// The view model is semantic, not a UI tree: reasons are codes the renderer resolves to prose.
const PERIOD_UNIT_MS = { m: 6e4, h: 36e5, d: 864e5, w: 6048e5 };
const MAX_PERIOD_MS = 90 * 864e5; // 90d
/** A positive integer plus `m`, `h`, `d` or `w`, capped at 90d. Reports bucket by whole minutes. */
exports.ReportPeriodSchema = v4_1.z
    .string()
    .regex(/^[1-9]\d*[mhdw]$/, "period must be a shorthand like '30m', '1h' or '7d' — minutes (m), hours (h), days (d) or weeks (w); seconds are not supported")
    .refine(
// The regex guarantees the last char is a known unit; `?? 0` just satisfies the type checker.
(p) => Number(p.slice(0, -1)) * (PERIOD_UNIT_MS[p.slice(-1)] ?? 0) <= MAX_PERIOD_MS, "period is too large (max 90d)");
/** The response encodings the endpoint can render. `json` returns a `ReportViewModel`. */
exports.ReportFormatSchema = v4_1.z.enum(["markdown", "json", "ansi"]);
exports.ReportSeveritySchema = v4_1.z.enum(["ok", "warn", "crit"]);
exports.ReportUnitSchema = v4_1.z.enum(["ms", "count", "ratio", "perMin"]);
/** A code resolved to a human string by the renderer's message table. */
exports.ReportReasonCodeSchema = v4_1.z.string();
/** A key into `ReportViewModel.links`, so a recommendation can point at a URL. */
exports.ReportLinkKeySchema = v4_1.z.string();
exports.ReportDeltaSchema = v4_1.z.object({
    dir: v4_1.z.enum(["up", "down", "flat"]),
    /** rounded value/normal multiplier; renderer decides whether to print "6×". */
    mult: v4_1.z.number().optional(),
});
exports.ReportMetricSeriesSchema = v4_1.z.object({
    points: v4_1.z.array(v4_1.z.number()),
    /** "estimated" = a proxy (e.g. pending backlog), shown informational-only. */
    kind: v4_1.z.enum(["measured", "estimated"]),
});
exports.ReportMetricSchema = v4_1.z.object({
    /** A code, e.g. "start_latency_p95"; the messages map turns it into the label. */
    id: v4_1.z.string(),
    value: v4_1.z.number(),
    unit: exports.ReportUnitSchema,
    aggregation: v4_1.z.enum(["p95", "rate", "ratio", "count"]).optional(),
    /** baseline; renderer formats "(normal ~7s)". */
    normal: v4_1.z.number().optional(),
    delta: exports.ReportDeltaSchema.optional(),
    series: exports.ReportMetricSeriesSchema.optional(),
    /** named sub-values for composite metrics (e.g. throughput { done, triggered }). */
    breakdown: v4_1.z.record(v4_1.z.string(), v4_1.z.number()).optional(),
    /** shown on a cause line INSTEAD of "(normal ~x)", e.g. "pinned 40 of last 60 min". */
    annotation: v4_1.z.object({ code: exports.ReportReasonCodeSchema, value: v4_1.z.number().optional() }).optional(),
    /** "unknown" means `value` is a placeholder a consumer must not read as real. Absent = measured. */
    availability: v4_1.z.enum(["measured", "unknown"]).optional(),
    severity: exports.ReportSeveritySchema,
});
exports.ReportRecommendationSchema = v4_1.z.object({
    code: exports.ReportReasonCodeSchema,
    link: exports.ReportLinkKeySchema.optional(),
});
/** A footer line: an action, or the "do nothing" option (carries value). */
exports.ReportFooterEntrySchema = v4_1.z.object({
    code: exports.ReportReasonCodeSchema,
    link: exports.ReportLinkKeySchema.optional(),
    /** a computed fact (e.g. drainMinutes), never invented. */
    value: v4_1.z.number().optional(),
});
/** A ruled-out cause + its evidence, e.g. "not your code" (never emitted without evidence). */
exports.ReportExclusionSchema = v4_1.z.object({
    code: exports.ReportReasonCodeSchema,
    evidence: v4_1.z.record(v4_1.z.string(), v4_1.z.number()).optional(),
});
/** A measured fact backing the verdict. `ReportExclusion` states what the problem isn't. */
exports.ReportObservationSchema = v4_1.z.object({
    code: exports.ReportReasonCodeSchema,
    evidence: v4_1.z.record(v4_1.z.string(), v4_1.z.number()).optional(),
});
exports.ReportFindingSchema = v4_1.z.object({
    /** "flow" | "execution" | "liveness" | future "infrastructure" | "billing" */
    type: v4_1.z.string(),
    severity: exports.ReportSeveritySchema,
    /** Code for the state or cause, e.g. "env_limit_saturation" | "healthy". */
    reason: exports.ReportReasonCodeSchema,
    /** Code for the "read:" line. Built last, may span findings. */
    read: exports.ReportReasonCodeSchema.optional(),
    /** metric ids this finding covers, in causal order when degraded. */
    metricIds: v4_1.z.array(v4_1.z.string()),
    /** A single primary action. */
    recommendation: exports.ReportRecommendationSchema.optional(),
    /** optional parenthetical — same shape as recommendation. */
    hedge: exports.ReportRecommendationSchema.optional(),
    /** contiguous breach window of the driving metric -> "(last 40 min)". */
    anomalyWindow: v4_1.z.object({ minutes: v4_1.z.number(), touchesEnd: v4_1.z.boolean() }).optional(),
    /** Which dimension and key own the problem. `of` is the denominator label the renderer prints. */
    attribution: v4_1.z
        .object({ dim: v4_1.z.string(), key: v4_1.z.string(), share: v4_1.z.number(), of: v4_1.z.string() })
        .optional(),
    /** Ruled-out causes and evidence, rendered under the `read:` line. */
    exclusions: v4_1.z.array(exports.ReportExclusionSchema).optional(),
    /** Supporting facts, rendered under the `read:` line after the exclusions. */
    observations: v4_1.z.array(exports.ReportObservationSchema).optional(),
});
exports.ReportSummaryStatementSchema = v4_1.z.object({
    findingType: v4_1.z.string(),
    severity: exports.ReportSeveritySchema,
    /** Renders from (findingType, severity) unless a reason is present. */
    reason: exports.ReportReasonCodeSchema.optional(),
});
exports.ReportLinkSchema = v4_1.z.object({
    key: exports.ReportLinkKeySchema,
    label: v4_1.z.string(),
    url: v4_1.z.string(),
});
exports.ReportViewModelSchema = v4_1.z.object({
    /** "health" | "cost" | … */
    title: v4_1.z.string(),
    /** "prod" */
    scope: v4_1.z.string(),
    /** "last 1h" */
    period: v4_1.z.string(),
    /** "vs your 7d normal" */
    baselineLabel: v4_1.z.string().optional(),
    /** ISO string. Passed in, never read from the clock inside interpret. */
    generatedAt: v4_1.z.string(),
    /** live window length in minutes — lets the renderer say "of last 60 min". */
    windowMinutes: v4_1.z.number(),
    summary: v4_1.z.object({
        severity: exports.ReportSeveritySchema,
        statements: v4_1.z.array(exports.ReportSummaryStatementSchema),
    }),
    findings: v4_1.z.array(exports.ReportFindingSchema),
    metrics: v4_1.z.array(exports.ReportMetricSchema),
    /** dense structured payload for agents. */
    facts: v4_1.z.record(v4_1.z.string(), v4_1.z.unknown()),
    links: v4_1.z.array(exports.ReportLinkSchema),
    /** dominant finding's action + optional "do nothing" option. Max two entries. */
    footer: v4_1.z.array(exports.ReportFooterEntrySchema),
});
//# sourceMappingURL=reports.js.map