"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnapshotRouteWireLenient = exports.SnapshotRouteWire = void 0;
const zod_1 = require("zod");
/**
 * A run's versioned storage route (control metadata, never a TRES column), stamped on the queue message
 * from its immutable BIRTH residency. Carried opaquely on the DequeuedMessage so the worker's separate
 * start-attempt request honors durable residency even on a poll-lagging pod whose dial reads undefined.
 *
 * Kept in this leaf (only `zod` imported), not in `runEngine.ts`, so `supervisor/schemas.ts` can use it at
 * module-eval time without the `messages -> supervisor/schemas -> runEngine` cycle leaving it undefined.
 */
exports.SnapshotRouteWire = zod_1.z.object({
    version: zod_1.z.literal(1),
    residency: zod_1.z.enum(["postgres", "mirrored", "redis-primary"]),
    organizationId: zod_1.z.string(),
});
/**
 * The route as it crosses a MIXED-VERSION HTTP boundary. A rolling deploy can put a newer worker in
 * front of an older webapp, so a route this build cannot read must never fail the whole request:
 * every engine consumer treats an absent route as "unknown" and resolves residency durably instead.
 *
 * Accepts anything, keeps a valid v1 route normalized through the canonical schema above, and turns
 * an unknown future version or a malformed value into `undefined`. Unrelated fields on the body keep
 * their own strict validation.
 */
exports.SnapshotRouteWireLenient = zod_1.z
    .unknown()
    .transform((value) => {
    const parsed = exports.SnapshotRouteWire.safeParse(value);
    return parsed.success ? parsed.data : undefined;
});
//# sourceMappingURL=snapshotRoute.js.map