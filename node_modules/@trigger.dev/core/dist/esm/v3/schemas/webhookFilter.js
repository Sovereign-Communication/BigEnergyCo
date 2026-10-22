import { z } from "zod/v4";
// Webhook delivery filter: server-side predicate gating routing. LEAF module (imports only `z`).
// ── Runtime AST (stored on WebhookEndpoint.filterAst; produced by the engine parser) ──
export const FilterOp = z.enum([
    "eq",
    "neq",
    "gt",
    "lt",
    "gte",
    "lte",
    "in",
    "nin",
    "startsWith",
    "endsWith",
    "contains",
]);
export const FilterScalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const FilterValue = z.union([FilterScalar, z.array(FilterScalar)]);
// Bump when the AST shape changes; a stored AST with a different version is re-parsed from `filter`.
export const FILTER_AST_VERSION = 1;
export const FilterAst = z.lazy(() => z.union([
    z.object({ kind: z.literal("and"), clauses: z.array(FilterAst) }),
    z.object({ kind: z.literal("or"), clauses: z.array(FilterAst) }),
    z.object({
        kind: z.literal("clause"),
        path: z.string(),
        op: FilterOp,
        value: FilterValue.optional(),
        valueRef: z.string().optional(),
    }),
    z.object({
        kind: z.literal("quantifier"),
        mode: z.enum(["any", "all"]),
        path: z.string(),
        clause: z.object({ path: z.string(), op: FilterOp, value: FilterValue }),
    }),
]));
//# sourceMappingURL=webhookFilter.js.map