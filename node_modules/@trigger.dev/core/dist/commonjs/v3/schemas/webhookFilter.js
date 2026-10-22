"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilterAst = exports.FILTER_AST_VERSION = exports.FilterValue = exports.FilterScalar = exports.FilterOp = void 0;
const v4_1 = require("zod/v4");
// Webhook delivery filter: server-side predicate gating routing. LEAF module (imports only `z`).
// ── Runtime AST (stored on WebhookEndpoint.filterAst; produced by the engine parser) ──
exports.FilterOp = v4_1.z.enum([
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
exports.FilterScalar = v4_1.z.union([v4_1.z.string(), v4_1.z.number(), v4_1.z.boolean(), v4_1.z.null()]);
exports.FilterValue = v4_1.z.union([exports.FilterScalar, v4_1.z.array(exports.FilterScalar)]);
// Bump when the AST shape changes; a stored AST with a different version is re-parsed from `filter`.
exports.FILTER_AST_VERSION = 1;
exports.FilterAst = v4_1.z.lazy(() => v4_1.z.union([
    v4_1.z.object({ kind: v4_1.z.literal("and"), clauses: v4_1.z.array(exports.FilterAst) }),
    v4_1.z.object({ kind: v4_1.z.literal("or"), clauses: v4_1.z.array(exports.FilterAst) }),
    v4_1.z.object({
        kind: v4_1.z.literal("clause"),
        path: v4_1.z.string(),
        op: exports.FilterOp,
        value: exports.FilterValue.optional(),
        valueRef: v4_1.z.string().optional(),
    }),
    v4_1.z.object({
        kind: v4_1.z.literal("quantifier"),
        mode: v4_1.z.enum(["any", "all"]),
        path: v4_1.z.string(),
        clause: v4_1.z.object({ path: v4_1.z.string(), op: exports.FilterOp, value: exports.FilterValue }),
    }),
]));
//# sourceMappingURL=webhookFilter.js.map