"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SerializableJsonSchema = exports.DeserializedJsonSchema = void 0;
const v4_1 = require("zod/v4");
const LiteralSchema = v4_1.z.union([v4_1.z.string(), v4_1.z.number(), v4_1.z.boolean(), v4_1.z.null()]);
exports.DeserializedJsonSchema = v4_1.z.lazy(() => v4_1.z.union([
    LiteralSchema,
    v4_1.z.array(exports.DeserializedJsonSchema),
    v4_1.z.record(v4_1.z.string(), exports.DeserializedJsonSchema),
]));
const SerializableSchema = v4_1.z.union([
    v4_1.z.string(),
    v4_1.z.number(),
    v4_1.z.boolean(),
    v4_1.z.null(),
    v4_1.z.date(),
    v4_1.z.undefined(),
    v4_1.z.symbol(),
]);
exports.SerializableJsonSchema = v4_1.z.lazy(() => v4_1.z.union([
    SerializableSchema,
    v4_1.z.array(exports.SerializableJsonSchema),
    v4_1.z.record(v4_1.z.string(), exports.SerializableJsonSchema),
]));
//# sourceMappingURL=json.js.map