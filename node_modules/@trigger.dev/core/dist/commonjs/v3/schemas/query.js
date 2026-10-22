"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFriendlyStatus = exports.ListDashboardsResponseBody = exports.DashboardSummary = exports.DashboardWidgetSummary = exports.QuerySchemaResponseBody = exports.QuerySchemaTable = exports.QuerySchemaColumn = exports.QueryExecuteResponseBody = exports.QueryExecuteCSVResponseBody = exports.QueryExecuteJSONResponseBody = exports.QueryExecuteRequestBody = void 0;
const v4_1 = require("zod/v4");
const zod_js_1 = require("../utils/zod.js");
/**
 * Request body schema for executing a query
 */
exports.QueryExecuteRequestBody = v4_1.z.object({
    query: v4_1.z.string(),
    scope: v4_1.z.enum(["organization", "project", "environment"]).default("environment"),
    period: v4_1.z.string().nullish(),
    from: v4_1.z.string().nullish(),
    to: v4_1.z.string().nullish(),
    format: v4_1.z.enum(["json", "csv"]).default("json"),
});
/**
 * Response body schema for JSON format queries
 */
exports.QueryExecuteJSONResponseBody = v4_1.z.object({
    format: v4_1.z.literal("json"),
    results: v4_1.z.array(v4_1.z.record(v4_1.z.string(), v4_1.z.any())),
});
/**
 * Response body type for CSV format queries
 */
exports.QueryExecuteCSVResponseBody = v4_1.z.object({
    format: v4_1.z.literal("csv"),
    results: v4_1.z.string(),
});
exports.QueryExecuteResponseBody = (0, zod_js_1.discriminatedUnion)("format", [
    exports.QueryExecuteJSONResponseBody,
    exports.QueryExecuteCSVResponseBody,
]);
// ---------------------------------------------------------------------------
// Query schema discovery types
// ---------------------------------------------------------------------------
/**
 * Schema for a single column in the query schema response
 */
exports.QuerySchemaColumn = v4_1.z.object({
    name: v4_1.z.string(),
    type: v4_1.z.string(),
    description: v4_1.z.string().optional(),
    example: v4_1.z.string().optional(),
    allowedValues: v4_1.z.array(v4_1.z.string()).optional(),
    coreColumn: v4_1.z.boolean().optional(),
});
/**
 * Schema for a single table in the query schema response
 */
exports.QuerySchemaTable = v4_1.z.object({
    name: v4_1.z.string(),
    description: v4_1.z.string().optional(),
    timeColumn: v4_1.z.string().optional(),
    columns: v4_1.z.array(exports.QuerySchemaColumn),
});
/**
 * Response body for the query schema endpoint
 */
exports.QuerySchemaResponseBody = v4_1.z.object({
    tables: v4_1.z.array(exports.QuerySchemaTable),
});
// ---------------------------------------------------------------------------
// Dashboard types
// ---------------------------------------------------------------------------
/**
 * Summary of a widget in a dashboard (for listing)
 */
exports.DashboardWidgetSummary = v4_1.z.object({
    id: v4_1.z.string(),
    title: v4_1.z.string(),
    query: v4_1.z.string(),
    type: v4_1.z.enum(["bignumber", "chart", "table", "title"]),
});
/**
 * Summary of a dashboard (for listing)
 */
exports.DashboardSummary = v4_1.z.object({
    key: v4_1.z.string(),
    title: v4_1.z.string(),
    widgets: v4_1.z.array(exports.DashboardWidgetSummary),
});
/**
 * Response body for listing dashboards
 */
exports.ListDashboardsResponseBody = v4_1.z.object({
    dashboards: v4_1.z.array(exports.DashboardSummary),
});
// ---------------------------------------------------------------------------
// Query table row types
// ---------------------------------------------------------------------------
/**
 * User-facing friendly run status values returned by the query system.
 */
exports.runFriendlyStatus = [
    "Delayed",
    "Queued",
    "Pending version",
    "Dequeued",
    "Executing",
    "Waiting",
    "Reattempting",
    "Paused",
    "Canceled",
    "Interrupted",
    "Completed",
    "Failed",
    "System failure",
    "Crashed",
    "Expired",
    "Timed out",
];
//# sourceMappingURL=query.js.map