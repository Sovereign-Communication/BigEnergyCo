"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventFilter = exports.stringPatternMatchers = void 0;
const v4_1 = require("zod/v4");
exports.stringPatternMatchers = [
    v4_1.z.object({
        $endsWith: v4_1.z.string(),
    }),
    v4_1.z.object({
        $startsWith: v4_1.z.string(),
    }),
    v4_1.z.object({
        $ignoreCaseEquals: v4_1.z.string(),
    }),
];
const EventMatcher = v4_1.z.union([
    /** Match against a string */
    v4_1.z.array(v4_1.z.string()),
    /** Match against a number */
    v4_1.z.array(v4_1.z.number()),
    /** Match against a boolean */
    v4_1.z.array(v4_1.z.boolean()),
    v4_1.z.array(v4_1.z.union([
        ...exports.stringPatternMatchers,
        v4_1.z.object({
            $exists: v4_1.z.boolean(),
        }),
        v4_1.z.object({
            $isNull: v4_1.z.boolean(),
        }),
        v4_1.z.object({
            $anythingBut: v4_1.z.union([v4_1.z.string(), v4_1.z.number(), v4_1.z.boolean()]),
        }),
        v4_1.z.object({
            $anythingBut: v4_1.z.union([v4_1.z.array(v4_1.z.string()), v4_1.z.array(v4_1.z.number()), v4_1.z.array(v4_1.z.boolean())]),
        }),
        v4_1.z.object({
            $gt: v4_1.z.number(),
        }),
        v4_1.z.object({
            $lt: v4_1.z.number(),
        }),
        v4_1.z.object({
            $gte: v4_1.z.number(),
        }),
        v4_1.z.object({
            $lte: v4_1.z.number(),
        }),
        v4_1.z.object({
            $between: v4_1.z.tuple([v4_1.z.number(), v4_1.z.number()]),
        }),
        v4_1.z.object({
            $includes: v4_1.z.union([v4_1.z.string(), v4_1.z.number(), v4_1.z.boolean()]),
        }),
        v4_1.z.object({
            $not: v4_1.z.union([v4_1.z.string(), v4_1.z.number(), v4_1.z.boolean()]),
        }),
    ])),
]);
exports.EventFilter = v4_1.z.lazy(() => v4_1.z.record(v4_1.z.string(), v4_1.z.union([EventMatcher, exports.EventFilter])));
//# sourceMappingURL=eventFilter.js.map