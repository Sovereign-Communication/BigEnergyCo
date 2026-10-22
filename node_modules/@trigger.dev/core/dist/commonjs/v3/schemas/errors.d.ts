import { z } from "zod/v4";
/**
 * The lifecycle state of an error group. Mirrors the dashboard's
 * `ErrorGroupState.status` (`UNRESOLVED | RESOLVED | IGNORED`) but is exposed
 * lowercase over the API, matching the `filter[status]` query value.
 */
export declare const ErrorGroupStatus: z.ZodEnum<{
    ignored: "ignored";
    resolved: "resolved";
    unresolved: "unresolved";
}>;
export type ErrorGroupStatus = z.infer<typeof ErrorGroupStatus>;
/**
 * A single error group as returned by the list endpoint. `count` is the number
 * of occurrences within the requested time range; `firstSeen`/`lastSeen` are
 * the group's global first/last occurrence.
 */
export declare const ErrorGroupListItem: z.ZodObject<{
    id: z.ZodString;
    fingerprint: z.ZodString;
    taskIdentifier: z.ZodString;
    errorType: z.ZodString;
    errorMessage: z.ZodString;
    status: z.ZodEnum<{
        ignored: "ignored";
        resolved: "resolved";
        unresolved: "unresolved";
    }>;
    count: z.ZodNumber;
    firstSeen: z.ZodCoercedDate<unknown>;
    lastSeen: z.ZodCoercedDate<unknown>;
    resolvedAt: z.ZodNullable<z.ZodCoercedDate<unknown>>;
    ignoredUntil: z.ZodNullable<z.ZodCoercedDate<unknown>>;
}, z.core.$strip>;
export type ErrorGroupListItem = z.infer<typeof ErrorGroupListItem>;
export declare const ListErrorsResponse: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        fingerprint: z.ZodString;
        taskIdentifier: z.ZodString;
        errorType: z.ZodString;
        errorMessage: z.ZodString;
        status: z.ZodEnum<{
            ignored: "ignored";
            resolved: "resolved";
            unresolved: "unresolved";
        }>;
        count: z.ZodNumber;
        firstSeen: z.ZodCoercedDate<unknown>;
        lastSeen: z.ZodCoercedDate<unknown>;
        resolvedAt: z.ZodNullable<z.ZodCoercedDate<unknown>>;
        ignoredUntil: z.ZodNullable<z.ZodCoercedDate<unknown>>;
    }, z.core.$strip>>;
    pagination: z.ZodObject<{
        next: z.ZodOptional<z.ZodString>;
        previous: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type ListErrorsResponse = z.infer<typeof ListErrorsResponse>;
/**
 * The full detail for a single error group: summary fields, the affected task
 * versions (most recent five), and the complete lifecycle state.
 */
export declare const ErrorGroupDetail: z.ZodObject<{
    id: z.ZodString;
    fingerprint: z.ZodString;
    taskIdentifier: z.ZodString;
    errorType: z.ZodString;
    errorMessage: z.ZodString;
    count: z.ZodNumber;
    firstSeen: z.ZodCoercedDate<unknown>;
    lastSeen: z.ZodCoercedDate<unknown>;
    affectedVersions: z.ZodArray<z.ZodString>;
    status: z.ZodEnum<{
        ignored: "ignored";
        resolved: "resolved";
        unresolved: "unresolved";
    }>;
    resolvedAt: z.ZodNullable<z.ZodCoercedDate<unknown>>;
    resolvedInVersion: z.ZodNullable<z.ZodString>;
    resolvedBy: z.ZodNullable<z.ZodString>;
    ignoredAt: z.ZodNullable<z.ZodCoercedDate<unknown>>;
    ignoredUntil: z.ZodNullable<z.ZodCoercedDate<unknown>>;
    ignoredReason: z.ZodNullable<z.ZodString>;
    ignoredByUserId: z.ZodNullable<z.ZodString>;
    ignoredUntilOccurrenceRate: z.ZodNullable<z.ZodNumber>;
    ignoredUntilTotalOccurrences: z.ZodNullable<z.ZodNumber>;
}, z.core.$strip>;
export type ErrorGroupDetail = z.infer<typeof ErrorGroupDetail>;
export declare const ResolveErrorRequestBody: z.ZodObject<{
    resolvedInVersion: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ResolveErrorRequestBody = z.infer<typeof ResolveErrorRequestBody>;
export declare const IgnoreErrorRequestBody: z.ZodObject<{
    duration: z.ZodOptional<z.ZodNumber>;
    occurrenceRate: z.ZodOptional<z.ZodNumber>;
    totalOccurrences: z.ZodOptional<z.ZodNumber>;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type IgnoreErrorRequestBody = z.infer<typeof IgnoreErrorRequestBody>;
