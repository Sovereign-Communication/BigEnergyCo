import { z } from "zod/v4";
import type { IdempotencyKeyScope } from "../idempotency-key-catalog/catalog.js";
import type { MachinePresetName, RuntimeEnvironmentType } from "./common.js";
/**
 * Request body schema for executing a query
 */
export declare const QueryExecuteRequestBody: z.ZodObject<{
    query: z.ZodString;
    scope: z.ZodDefault<z.ZodEnum<{
        environment: "environment";
        organization: "organization";
        project: "project";
    }>>;
    period: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    from: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    to: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    format: z.ZodDefault<z.ZodEnum<{
        csv: "csv";
        json: "json";
    }>>;
}, z.core.$strip>;
export type QueryExecuteRequestBody = z.infer<typeof QueryExecuteRequestBody>;
/**
 * Response body schema for JSON format queries
 */
export declare const QueryExecuteJSONResponseBody: z.ZodObject<{
    format: z.ZodLiteral<"json">;
    results: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, z.core.$strip>;
export type QueryExecuteJSONResponseBody = z.infer<typeof QueryExecuteJSONResponseBody>;
/**
 * Response body type for CSV format queries
 */
export declare const QueryExecuteCSVResponseBody: z.ZodObject<{
    format: z.ZodLiteral<"csv">;
    results: z.ZodString;
}, z.core.$strip>;
export type QueryExecuteCSVResponseBody = z.infer<typeof QueryExecuteCSVResponseBody>;
export declare const QueryExecuteResponseBody: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
    format: z.ZodLiteral<"json">;
    results: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, z.core.$strip>, z.ZodObject<{
    format: z.ZodLiteral<"csv">;
    results: z.ZodString;
}, z.core.$strip>]>;
export type QueryExecuteResponseBody = z.infer<typeof QueryExecuteResponseBody>;
/**
 * Schema for a single column in the query schema response
 */
export declare const QuerySchemaColumn: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    example: z.ZodOptional<z.ZodString>;
    allowedValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
    coreColumn: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type QuerySchemaColumn = z.infer<typeof QuerySchemaColumn>;
/**
 * Schema for a single table in the query schema response
 */
export declare const QuerySchemaTable: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    timeColumn: z.ZodOptional<z.ZodString>;
    columns: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        example: z.ZodOptional<z.ZodString>;
        allowedValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
        coreColumn: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type QuerySchemaTable = z.infer<typeof QuerySchemaTable>;
/**
 * Response body for the query schema endpoint
 */
export declare const QuerySchemaResponseBody: z.ZodObject<{
    tables: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        timeColumn: z.ZodOptional<z.ZodString>;
        columns: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            example: z.ZodOptional<z.ZodString>;
            allowedValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            coreColumn: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type QuerySchemaResponseBody = z.infer<typeof QuerySchemaResponseBody>;
/**
 * Summary of a widget in a dashboard (for listing)
 */
export declare const DashboardWidgetSummary: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    query: z.ZodString;
    type: z.ZodEnum<{
        bignumber: "bignumber";
        chart: "chart";
        table: "table";
        title: "title";
    }>;
}, z.core.$strip>;
export type DashboardWidgetSummary = z.infer<typeof DashboardWidgetSummary>;
/**
 * Summary of a dashboard (for listing)
 */
export declare const DashboardSummary: z.ZodObject<{
    key: z.ZodString;
    title: z.ZodString;
    widgets: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        query: z.ZodString;
        type: z.ZodEnum<{
            bignumber: "bignumber";
            chart: "chart";
            table: "table";
            title: "title";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type DashboardSummary = z.infer<typeof DashboardSummary>;
/**
 * Response body for listing dashboards
 */
export declare const ListDashboardsResponseBody: z.ZodObject<{
    dashboards: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        title: z.ZodString;
        widgets: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            query: z.ZodString;
            type: z.ZodEnum<{
                bignumber: "bignumber";
                chart: "chart";
                table: "table";
                title: "title";
            }>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ListDashboardsResponseBody = z.infer<typeof ListDashboardsResponseBody>;
/**
 * User-facing friendly run status values returned by the query system.
 */
export declare const runFriendlyStatus: readonly ["Delayed", "Queued", "Pending version", "Dequeued", "Executing", "Waiting", "Reattempting", "Paused", "Canceled", "Interrupted", "Completed", "Failed", "System failure", "Crashed", "Expired", "Timed out"];
export type RunFriendlyStatus = (typeof runFriendlyStatus)[number];
/**
 * Full row type for the `runs` query table.
 *
 * Each property corresponds to a column available in TSQL queries against the
 * `runs` table. Types are mapped from the underlying ClickHouse column types:
 *
 * - `String` → `string`
 * - `UInt8` / `UInt32` / `Int64` / `Float64` → `number`
 * - `DateTime64` → `string`
 * - `Nullable(X)` → `X | null`
 * - `Array(String)` → `string[]`
 * - `JSON` → `Record<string, unknown>`
 * - `LowCardinality(String)` with constrained values → narrow union type
 */
export interface RunsTableRow {
    /** Unique run ID (e.g. `run_cm1a2b3c4d5e6f7g8h9i`) */
    run_id: string;
    /** Environment slug */
    environment: string;
    /** Project reference (e.g. `proj_howcnaxbfxdmwmxazktx`) */
    project: string;
    /** Environment type */
    environment_type: RuntimeEnvironmentType;
    /** Number of attempts (starts at 1) */
    attempt_count: number;
    /** Run status (friendly name) */
    status: RunFriendlyStatus;
    /** Whether the run is finished (0 or 1) */
    is_finished: number;
    /** Task identifier/slug */
    task_identifier: string;
    /** Queue name */
    queue: string;
    /** Batch ID (if part of a batch), or `null` */
    batch_id: string | null;
    /** Root run ID (for child runs), or `null` */
    root_run_id: string | null;
    /** Parent run ID (for child runs), or `null` */
    parent_run_id: string | null;
    /** Nesting depth (0 for root runs) */
    depth: number;
    /** Whether this is a root run (0 or 1) */
    is_root_run: number;
    /** Whether this is a child run (0 or 1) */
    is_child_run: number;
    /** Idempotency key */
    idempotency_key: string;
    /** Idempotency key scope (empty string means no idempotency key is set) */
    idempotency_key_scope: IdempotencyKeyScope | "";
    /** Region, or `null` */
    region: string | null;
    /** When the run was triggered (ISO 8601) */
    triggered_at: string;
    /** When the run was queued, or `null` */
    queued_at: string | null;
    /** When the run was dequeued, or `null` */
    dequeued_at: string | null;
    /** When execution began, or `null` */
    executed_at: string | null;
    /** When the run completed, or `null` */
    completed_at: string | null;
    /** Delayed execution until this time, or `null` */
    delay_until: string | null;
    /** Whether the run had a delay (0 or 1) */
    has_delay: number;
    /** When the run expired, or `null` */
    expired_at: string | null;
    /** TTL string for expiration (e.g. `"10m"`) */
    ttl: string;
    /** Time from execution start to completion in ms, or `null` */
    execution_duration: number | null;
    /** Time from trigger to completion in ms, or `null` */
    total_duration: number | null;
    /** Time from queued to dequeued in ms, or `null` */
    queued_duration: number | null;
    /** Compute usage duration in ms */
    usage_duration: number;
    /** Compute cost in dollars */
    compute_cost: number;
    /** Invocation cost in dollars */
    invocation_cost: number;
    /** Total cost in dollars (compute + invocation) */
    total_cost: number;
    /** The data returned from the task */
    output: Record<string, unknown>;
    /** Error data if the run failed */
    error: Record<string, unknown>;
    /** Tags added to the run */
    tags: string[];
    /** Code version in reverse date format (e.g. `"20240115.1"`) */
    task_version: string;
    /** SDK package version */
    sdk_version: string;
    /** CLI package version */
    cli_version: string;
    /** Machine preset the run executed on */
    machine: MachinePresetName;
    /** Whether this is a test run (0 or 1) */
    is_test: number;
    /** Concurrency key passed when triggering */
    concurrency_key: string;
    /** Max allowed compute duration in seconds, or `null` */
    max_duration: number | null;
    /** Bulk action group IDs that operated on this run */
    bulk_action_group_ids: string[];
}
/** @internal Map of query table names to their full row types */
type QueryTableMap = {
    runs: RunsTableRow;
};
/**
 * Type helper for Query results.
 *
 * @example
 * ```typescript
 * // All columns from the runs table
 * type AllRuns = QueryTable<"runs">;
 *
 * // Only specific columns
 * type MyResult = QueryTable<"runs", "status" | "run_id">;
 *
 * // Access a single field type
 * type Status = QueryTable<"runs">["status"]; // RunFriendlyStatus
 *
 * // Use with query.execute
 * const result = await query.execute<QueryTable<"runs", "status" | "run_id">>(
 *   "SELECT status, run_id FROM runs"
 * );
 * ```
 */
export type QueryTable<TTable extends keyof QueryTableMap, TColumns extends keyof QueryTableMap[TTable] = keyof QueryTableMap[TTable]> = Pick<QueryTableMap[TTable], TColumns>;
export {};
