import { z } from "zod/v4";
/** A positive integer plus `m`, `h`, `d` or `w`, capped at 90d. Reports bucket by whole minutes. */
export declare const ReportPeriodSchema: z.ZodString;
export type ReportPeriod = z.infer<typeof ReportPeriodSchema>;
/** The response encodings the endpoint can render. `json` returns a `ReportViewModel`. */
export declare const ReportFormatSchema: z.ZodEnum<{
    ansi: "ansi";
    json: "json";
    markdown: "markdown";
}>;
export type ReportFormat = z.infer<typeof ReportFormatSchema>;
export declare const ReportSeveritySchema: z.ZodEnum<{
    crit: "crit";
    ok: "ok";
    warn: "warn";
}>;
export type ReportSeverity = z.infer<typeof ReportSeveritySchema>;
export declare const ReportUnitSchema: z.ZodEnum<{
    count: "count";
    ms: "ms";
    perMin: "perMin";
    ratio: "ratio";
}>;
export type ReportUnit = z.infer<typeof ReportUnitSchema>;
/** A code resolved to a human string by the renderer's message table. */
export declare const ReportReasonCodeSchema: z.ZodString;
export type ReportReasonCode = z.infer<typeof ReportReasonCodeSchema>;
/** A key into `ReportViewModel.links`, so a recommendation can point at a URL. */
export declare const ReportLinkKeySchema: z.ZodString;
export type ReportLinkKey = z.infer<typeof ReportLinkKeySchema>;
export declare const ReportDeltaSchema: z.ZodObject<{
    dir: z.ZodEnum<{
        down: "down";
        flat: "flat";
        up: "up";
    }>;
    mult: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type ReportDelta = z.infer<typeof ReportDeltaSchema>;
export declare const ReportMetricSeriesSchema: z.ZodObject<{
    points: z.ZodArray<z.ZodNumber>;
    kind: z.ZodEnum<{
        estimated: "estimated";
        measured: "measured";
    }>;
}, z.core.$strip>;
export type ReportMetricSeries = z.infer<typeof ReportMetricSeriesSchema>;
export declare const ReportMetricSchema: z.ZodObject<{
    id: z.ZodString;
    value: z.ZodNumber;
    unit: z.ZodEnum<{
        count: "count";
        ms: "ms";
        perMin: "perMin";
        ratio: "ratio";
    }>;
    aggregation: z.ZodOptional<z.ZodEnum<{
        count: "count";
        p95: "p95";
        rate: "rate";
        ratio: "ratio";
    }>>;
    normal: z.ZodOptional<z.ZodNumber>;
    delta: z.ZodOptional<z.ZodObject<{
        dir: z.ZodEnum<{
            down: "down";
            flat: "flat";
            up: "up";
        }>;
        mult: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    series: z.ZodOptional<z.ZodObject<{
        points: z.ZodArray<z.ZodNumber>;
        kind: z.ZodEnum<{
            estimated: "estimated";
            measured: "measured";
        }>;
    }, z.core.$strip>>;
    breakdown: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    annotation: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        value: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    availability: z.ZodOptional<z.ZodEnum<{
        measured: "measured";
        unknown: "unknown";
    }>>;
    severity: z.ZodEnum<{
        crit: "crit";
        ok: "ok";
        warn: "warn";
    }>;
}, z.core.$strip>;
export type ReportMetric = z.infer<typeof ReportMetricSchema>;
export declare const ReportRecommendationSchema: z.ZodObject<{
    code: z.ZodString;
    link: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ReportRecommendation = z.infer<typeof ReportRecommendationSchema>;
/** A footer line: an action, or the "do nothing" option (carries value). */
export declare const ReportFooterEntrySchema: z.ZodObject<{
    code: z.ZodString;
    link: z.ZodOptional<z.ZodString>;
    value: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type ReportFooterEntry = z.infer<typeof ReportFooterEntrySchema>;
/** A ruled-out cause + its evidence, e.g. "not your code" (never emitted without evidence). */
export declare const ReportExclusionSchema: z.ZodObject<{
    code: z.ZodString;
    evidence: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
}, z.core.$strip>;
export type ReportExclusion = z.infer<typeof ReportExclusionSchema>;
/** A measured fact backing the verdict. `ReportExclusion` states what the problem isn't. */
export declare const ReportObservationSchema: z.ZodObject<{
    code: z.ZodString;
    evidence: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
}, z.core.$strip>;
export type ReportObservation = z.infer<typeof ReportObservationSchema>;
export declare const ReportFindingSchema: z.ZodObject<{
    type: z.ZodString;
    severity: z.ZodEnum<{
        crit: "crit";
        ok: "ok";
        warn: "warn";
    }>;
    reason: z.ZodString;
    read: z.ZodOptional<z.ZodString>;
    metricIds: z.ZodArray<z.ZodString>;
    recommendation: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        link: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    hedge: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        link: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    anomalyWindow: z.ZodOptional<z.ZodObject<{
        minutes: z.ZodNumber;
        touchesEnd: z.ZodBoolean;
    }, z.core.$strip>>;
    attribution: z.ZodOptional<z.ZodObject<{
        dim: z.ZodString;
        key: z.ZodString;
        share: z.ZodNumber;
        of: z.ZodString;
    }, z.core.$strip>>;
    exclusions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        evidence: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    }, z.core.$strip>>>;
    observations: z.ZodOptional<z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        evidence: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type ReportFinding = z.infer<typeof ReportFindingSchema>;
export declare const ReportSummaryStatementSchema: z.ZodObject<{
    findingType: z.ZodString;
    severity: z.ZodEnum<{
        crit: "crit";
        ok: "ok";
        warn: "warn";
    }>;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ReportSummaryStatement = z.infer<typeof ReportSummaryStatementSchema>;
export declare const ReportLinkSchema: z.ZodObject<{
    key: z.ZodString;
    label: z.ZodString;
    url: z.ZodString;
}, z.core.$strip>;
export type ReportLink = z.infer<typeof ReportLinkSchema>;
export declare const ReportViewModelSchema: z.ZodObject<{
    title: z.ZodString;
    scope: z.ZodString;
    period: z.ZodString;
    baselineLabel: z.ZodOptional<z.ZodString>;
    generatedAt: z.ZodString;
    windowMinutes: z.ZodNumber;
    summary: z.ZodObject<{
        severity: z.ZodEnum<{
            crit: "crit";
            ok: "ok";
            warn: "warn";
        }>;
        statements: z.ZodArray<z.ZodObject<{
            findingType: z.ZodString;
            severity: z.ZodEnum<{
                crit: "crit";
                ok: "ok";
                warn: "warn";
            }>;
            reason: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    findings: z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        severity: z.ZodEnum<{
            crit: "crit";
            ok: "ok";
            warn: "warn";
        }>;
        reason: z.ZodString;
        read: z.ZodOptional<z.ZodString>;
        metricIds: z.ZodArray<z.ZodString>;
        recommendation: z.ZodOptional<z.ZodObject<{
            code: z.ZodString;
            link: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        hedge: z.ZodOptional<z.ZodObject<{
            code: z.ZodString;
            link: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        anomalyWindow: z.ZodOptional<z.ZodObject<{
            minutes: z.ZodNumber;
            touchesEnd: z.ZodBoolean;
        }, z.core.$strip>>;
        attribution: z.ZodOptional<z.ZodObject<{
            dim: z.ZodString;
            key: z.ZodString;
            share: z.ZodNumber;
            of: z.ZodString;
        }, z.core.$strip>>;
        exclusions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            evidence: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
        }, z.core.$strip>>>;
        observations: z.ZodOptional<z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            evidence: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    metrics: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        value: z.ZodNumber;
        unit: z.ZodEnum<{
            count: "count";
            ms: "ms";
            perMin: "perMin";
            ratio: "ratio";
        }>;
        aggregation: z.ZodOptional<z.ZodEnum<{
            count: "count";
            p95: "p95";
            rate: "rate";
            ratio: "ratio";
        }>>;
        normal: z.ZodOptional<z.ZodNumber>;
        delta: z.ZodOptional<z.ZodObject<{
            dir: z.ZodEnum<{
                down: "down";
                flat: "flat";
                up: "up";
            }>;
            mult: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        series: z.ZodOptional<z.ZodObject<{
            points: z.ZodArray<z.ZodNumber>;
            kind: z.ZodEnum<{
                estimated: "estimated";
                measured: "measured";
            }>;
        }, z.core.$strip>>;
        breakdown: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
        annotation: z.ZodOptional<z.ZodObject<{
            code: z.ZodString;
            value: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        availability: z.ZodOptional<z.ZodEnum<{
            measured: "measured";
            unknown: "unknown";
        }>>;
        severity: z.ZodEnum<{
            crit: "crit";
            ok: "ok";
            warn: "warn";
        }>;
    }, z.core.$strip>>;
    facts: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    links: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        url: z.ZodString;
    }, z.core.$strip>>;
    footer: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        link: z.ZodOptional<z.ZodString>;
        value: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ReportViewModel = z.infer<typeof ReportViewModelSchema>;
