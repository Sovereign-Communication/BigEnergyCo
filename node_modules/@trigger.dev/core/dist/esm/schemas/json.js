import { z } from "zod/v4";
const LiteralSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const DeserializedJsonSchema = z.lazy(() => z.union([
    LiteralSchema,
    z.array(DeserializedJsonSchema),
    z.record(z.string(), DeserializedJsonSchema),
]));
const SerializableSchema = z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.date(),
    z.undefined(),
    z.symbol(),
]);
export const SerializableJsonSchema = z.lazy(() => z.union([
    SerializableSchema,
    z.array(SerializableJsonSchema),
    z.record(z.string(), SerializableJsonSchema),
]));
//# sourceMappingURL=json.js.map