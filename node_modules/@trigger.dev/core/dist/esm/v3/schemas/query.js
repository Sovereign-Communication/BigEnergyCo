import { z } from "zod/v4";
import { discriminatedUnion } from "../utils/zod.js";
/**
 * Request body schema for executing a query
 */
export const QueryExecuteRequestBody = z.object({
    query: z.string(),
    scope: z.enum(["organization", "project", "environment"]).default("environment"),
    period: z.string().nullish(),
    from: z.string().nullish(),
    to: z.string().nullish(),
    format: z.enum(["json", "csv"]).default("json"),
});
/**
 * Response body schema for JSON format queries
 */
export const QueryExecuteJSONResponseBody = z.object({
    format: z.literal("json"),
    results: z.array(z.record(z.string(), z.any())),
});
/**
 * Response body type for CSV format queries
 */
export const QueryExecuteCSVResponseBody = z.object({
    format: z.literal("csv"),
    results: z.string(),
});
export const QueryExecuteResponseBody = discriminatedUnion("format", [
    QueryExecuteJSONResponseBody,
    QueryExecuteCSVResponseBody,
]);
// ---------------------------------------------------------------------------
// Query schema discovery types
// ---------------------------------------------------------------------------
/**
 * Schema for a single column in the query schema response
 */
export const QuerySchemaColumn = z.object({
    name: z.string(),
    type: z.string(),
    description: z.string().optional(),
    example: z.string().optional(),
    allowedValues: z.array(z.string()).optional(),
    coreColumn: z.boolean().optional(),
});
/**
 * Schema for a single table in the query schema response
 */
export const QuerySchemaTable = z.object({
    name: z.string(),
    description: z.string().optional(),
    timeColumn: z.string().optional(),
    columns: z.array(QuerySchemaColumn),
});
/**
 * Response body for the query schema endpoint
 */
export const QuerySchemaResponseBody = z.object({
    tables: z.array(QuerySchemaTable),
});
// ---------------------------------------------------------------------------
// Dashboard types
// ---------------------------------------------------------------------------
/**
 * Summary of a widget in a dashboard (for listing)
 */
export const DashboardWidgetSummary = z.object({
    id: z.string(),
    title: z.string(),
    query: z.string(),
    type: z.enum(["bignumber", "chart", "table", "title"]),
});
/**
 * Summary of a dashboard (for listing)
 */
export const DashboardSummary = z.object({
    key: z.string(),
    title: z.string(),
    widgets: z.array(DashboardWidgetSummary),
});
/**
 * Response body for listing dashboards
 */
export const ListDashboardsResponseBody = z.object({
    dashboards: z.array(DashboardSummary),
});
// ---------------------------------------------------------------------------
// Query table row types
// ---------------------------------------------------------------------------
/**
 * User-facing friendly run status values returned by the query system.
 */
export const runFriendlyStatus = [
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