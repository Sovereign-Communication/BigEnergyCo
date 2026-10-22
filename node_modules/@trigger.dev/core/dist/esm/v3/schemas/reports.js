import { z } from "zod/v4";
// Shared contract for `GET /api/v1/reports/:key`: the period grammar and the `format=json` body.
// The view model is semantic, not a UI tree: reasons are codes the renderer resolves to prose.
const PERIOD_UNIT_MS = { m: 6e4, h: 36e5, d: 864e5, w: 6048e5 };
const MAX_PERIOD_MS = 90 * 864e5; // 90d
/** A positive integer plus `m`, `h`, `d` or `w`, capped at 90d. Reports bucket by whole minutes. */
export const ReportPeriodSchema = z
    .string()
    .regex(/^[1-9]\d*[mhdw]$/, "period must be a shorthand like '30m', '1h' or '7d' — minutes (m), hours (h), days (d) or weeks (w); seconds are not supported")
    .refine(
// The regex guarantees the last char is a known unit; `?? 0` just satisfies the type checker.
(p) => Number(p.slice(0, -1)) * (PERIOD_UNIT_MS[p.slice(-1)] ?? 0) <= MAX_PERIOD_MS, "period is too large (max 90d)");
/** The response encodings the endpoint can render. `json` returns a `ReportViewModel`. */
export const ReportFormatSchema = z.enum(["markdown", "json", "ansi"]);
export const ReportSeveritySchema = z.enum(["ok", "warn", "crit"]);
export const ReportUnitSchema = z.enum(["ms", "count", "ratio", "perMin"]);
/** A code resolved to a human string by the renderer's message table. */
export const ReportReasonCodeSchema = z.string();
/** A key into `ReportViewModel.links`, so a recommendation can point at a URL. */
export const ReportLinkKeySchema = z.string();
export const ReportDeltaSchema = z.object({
    dir: z.enum(["up", "down", "flat"]),
    /** rounded value/normal multiplier; renderer decides whether to print "6×". */
    mult: z.number().optional(),
});
export const ReportMetricSeriesSchema = z.object({
    points: z.array(z.number()),
    /** "estimated" = a proxy (e.g. pending backlog), shown informational-only. */
    kind: z.enum(["measured", "estimated"]),
});
export const ReportMetricSchema = z.object({
    /** A code, e.g. "start_latency_p95"; the messages map turns it into the label. */
    id: z.string(),
    value: z.number(),
    unit: ReportUnitSchema,
    aggregation: z.enum(["p95", "rate", "ratio", "count"]).optional(),
    /** baseline; renderer formats "(normal ~7s)". */
    normal: z.number().optional(),
    delta: ReportDeltaSchema.optional(),
    series: ReportMetricSeriesSchema.optional(),
    /** named sub-values for composite metrics (e.g. throughput { done, triggered }). */
    breakdown: z.record(z.string(), z.number()).optional(),
    /** shown on a cause line INSTEAD of "(normal ~x)", e.g. "pinned 40 of last 60 min". */
    annotation: z.object({ code: ReportReasonCodeSchema, value: z.number().optional() }).optional(),
    /** "unknown" means `value` is a placeholder a consumer must not read as real. Absent = measured. */
    availability: z.enum(["measured", "unknown"]).optional(),
    severity: ReportSeveritySchema,
});
export const ReportRecommendationSchema = z.object({
    code: ReportReasonCodeSchema,
    link: ReportLinkKeySchema.optional(),
});
/** A footer line: an action, or the "do nothing" option (carries value). */
export const ReportFooterEntrySchema = z.object({
    code: ReportReasonCodeSchema,
    link: ReportLinkKeySchema.optional(),
    /** a computed fact (e.g. drainMinutes), never invented. */
    value: z.number().optional(),
});
/** A ruled-out cause + its evidence, e.g. "not your code" (never emitted without evidence). */
export const ReportExclusionSchema = z.object({
    code: ReportReasonCodeSchema,
    evidence: z.record(z.string(), z.number()).optional(),
});
/** A measured fact backing the verdict. `ReportExclusion` states what the problem isn't. */
export const ReportObservationSchema = z.object({
    code: ReportReasonCodeSchema,
    evidence: z.record(z.string(), z.number()).optional(),
});
export const ReportFindingSchema = z.object({
    /** "flow" | "execution" | "liveness" | future "infrastructure" | "billing" */
    type: z.string(),
    severity: ReportSeveritySchema,
    /** Code for the state or cause, e.g. "env_limit_saturation" | "healthy". */
    reason: ReportReasonCodeSchema,
    /** Code for the "read:" line. Built last, may span findings. */
    read: ReportReasonCodeSchema.optional(),
    /** metric ids this finding covers, in causal order when degraded. */
    metricIds: z.array(z.string()),
    /** A single primary action. */
    recommendation: ReportRecommendationSchema.optional(),
    /** optional parenthetical — same shape as recommendation. */
    hedge: ReportRecommendationSchema.optional(),
    /** contiguous breach window of the driving metric -> "(last 40 min)". */
    anomalyWindow: z.object({ minutes: z.number(), touchesEnd: z.boolean() }).optional(),
    /** Which dimension and key own the problem. `of` is the denominator label the renderer prints. */
    attribution: z
        .object({ dim: z.string(), key: z.string(), share: z.number(), of: z.string() })
        .optional(),
    /** Ruled-out causes and evidence, rendered under the `read:` line. */
    exclusions: z.array(ReportExclusionSchema).optional(),
    /** Supporting facts, rendered under the `read:` line after the exclusions. */
    observations: z.array(ReportObservationSchema).optional(),
});
export const ReportSummaryStatementSchema = z.object({
    findingType: z.string(),
    severity: ReportSeveritySchema,
    /** Renders from (findingType, severity) unless a reason is present. */
    reason: ReportReasonCodeSchema.optional(),
});
export const ReportLinkSchema = z.object({
    key: ReportLinkKeySchema,
    label: z.string(),
    url: z.string(),
});
export const ReportViewModelSchema = z.object({
    /** "health" | "cost" | … */
    title: z.string(),
    /** "prod" */
    scope: z.string(),
    /** "last 1h" */
    period: z.string(),
    /** "vs your 7d normal" */
    baselineLabel: z.string().optional(),
    /** ISO string. Passed in, never read from the clock inside interpret. */
    generatedAt: z.string(),
    /** live window length in minutes — lets the renderer say "of last 60 min". */
    windowMinutes: z.number(),
    summary: z.object({
        severity: ReportSeveritySchema,
        statements: z.array(ReportSummaryStatementSchema),
    }),
    findings: z.array(ReportFindingSchema),
    metrics: z.array(ReportMetricSchema),
    /** dense structured payload for agents. */
    facts: z.record(z.string(), z.unknown()),
    links: z.array(ReportLinkSchema),
    /** dominant finding's action + optional "do nothing" option. Max two entries. */
    footer: z.array(ReportFooterEntrySchema),
});
//# sourceMappingURL=reports.js.map