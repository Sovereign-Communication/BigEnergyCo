"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IgnoreErrorRequestBody = exports.ResolveErrorRequestBody = exports.ErrorGroupDetail = exports.ListErrorsResponse = exports.ErrorGroupListItem = exports.ErrorGroupStatus = void 0;
const v4_1 = require("zod/v4");
/**
 * The lifecycle state of an error group. Mirrors the dashboard's
 * `ErrorGroupState.status` (`UNRESOLVED | RESOLVED | IGNORED`) but is exposed
 * lowercase over the API, matching the `filter[status]` query value.
 */
exports.ErrorGroupStatus = v4_1.z.enum(["unresolved", "resolved", "ignored"]);
/**
 * A single error group as returned by the list endpoint. `count` is the number
 * of occurrences within the requested time range; `firstSeen`/`lastSeen` are
 * the group's global first/last occurrence.
 */
exports.ErrorGroupListItem = v4_1.z.object({
    id: v4_1.z.string(),
    fingerprint: v4_1.z.string(),
    taskIdentifier: v4_1.z.string(),
    errorType: v4_1.z.string(),
    errorMessage: v4_1.z.string(),
    status: exports.ErrorGroupStatus,
    count: v4_1.z.number(),
    firstSeen: v4_1.z.coerce.date(),
    lastSeen: v4_1.z.coerce.date(),
    resolvedAt: v4_1.z.coerce.date().nullable(),
    ignoredUntil: v4_1.z.coerce.date().nullable(),
});
exports.ListErrorsResponse = v4_1.z.object({
    data: v4_1.z.array(exports.ErrorGroupListItem),
    pagination: v4_1.z.object({
        next: v4_1.z.string().optional(),
        previous: v4_1.z.string().optional(),
    }),
});
/**
 * The full detail for a single error group: summary fields, the affected task
 * versions (most recent five), and the complete lifecycle state.
 */
exports.ErrorGroupDetail = v4_1.z.object({
    id: v4_1.z.string(),
    fingerprint: v4_1.z.string(),
    taskIdentifier: v4_1.z.string(),
    errorType: v4_1.z.string(),
    errorMessage: v4_1.z.string(),
    count: v4_1.z.number(),
    firstSeen: v4_1.z.coerce.date(),
    lastSeen: v4_1.z.coerce.date(),
    affectedVersions: v4_1.z.array(v4_1.z.string()),
    status: exports.ErrorGroupStatus,
    resolvedAt: v4_1.z.coerce.date().nullable(),
    resolvedInVersion: v4_1.z.string().nullable(),
    resolvedBy: v4_1.z.string().nullable(),
    ignoredAt: v4_1.z.coerce.date().nullable(),
    ignoredUntil: v4_1.z.coerce.date().nullable(),
    ignoredReason: v4_1.z.string().nullable(),
    ignoredByUserId: v4_1.z.string().nullable(),
    ignoredUntilOccurrenceRate: v4_1.z.number().nullable(),
    ignoredUntilTotalOccurrences: v4_1.z.number().nullable(),
});
exports.ResolveErrorRequestBody = v4_1.z.object({
    resolvedInVersion: v4_1.z.string().optional(),
});
exports.IgnoreErrorRequestBody = v4_1.z.object({
    /** How long to ignore the error for, in milliseconds. */
    duration: v4_1.z.number().int().positive().optional(),
    /** Re-surface the error if its occurrence rate exceeds this many per minute. */
    occurrenceRate: v4_1.z.number().positive().optional(),
    /** Re-surface the error once it accrues this many new occurrences. */
    totalOccurrences: v4_1.z.number().int().positive().optional(),
    reason: v4_1.z.string().max(1000).optional(),
});
//# sourceMappingURL=errors.js.map