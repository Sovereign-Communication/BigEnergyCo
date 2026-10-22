/**
 * The two store FAMILIES a run/waitpoint can reside in. "NEW" is the dedicated
 * family: one store under gen-1, one per shard under gen-2. Use
 * {@link resolveShard} when the specific store matters.
 */
export type Residency = "LEGACY" | "NEW";
export type ShardKey = "legacy" | "new" | string;
/**
 * Underlying id lineage. "runOpsId" is the label for the NEW-store mint path
 * — a base32hex run-ops v1 id (see friendlyId.ts). It is the value persisted in
 * the runOpsMintKind feature flag. "cuid" is every legacy shape (cuid, nanoid,
 * and the pre-cutover 27-char base62 format).
 */
export type ResidencyKind = "cuid" | "runOpsId";
/** @bugsnag/cuid emits 25-char ids (legacy mint path, flag OFF). */
export declare const CUID_LENGTH = 25;
/**
 * Kept for API compatibility: the default classifier no longer throws (every
 * non-v1 shape is legacy), but injected classifiers may still raise it and
 * callers still catch it.
 */
export declare class UnclassifiableRunId extends Error {
    readonly value: string;
    readonly valueLength: number;
    constructor(value: string);
}
/**
 * Resolve the store that owns an id. A gen-2 body names its own shard; a gen-1
 * v1 body resolves to the single dedicated store; everything else is legacy.
 *
 * The version char at index 25 is one character, so the v1 and gen-2 shape
 * checks are mutually exclusive by construction — a gen-1 id can never resolve
 * to a shard, and a gen-2 id can never resolve to "new". Total: never throws.
 */
export declare function resolveShard(id: string): ShardKey;
/**
 * Returns the id lineage by the version-char rule: a well-formed run-ops v1 body
 * (version "1") or gen-2 body (version "2") is "runOpsId"; everything else —
 * including malformed shapes of either — is "cuid" (legacy). Total: never throws.
 * Transition: pre-cutover 27-char base62 ids (the old NEW-mint format) classify
 * LEGACY, so ship this with the base32hex generator only once any 27-char
 * NEW-resident runs are drained/disposable — no live run is misrouted mid-cutover.
 */
export declare function classifyKind(id: string): ResidencyKind;
/** Classification is total now; kept for API compatibility. */
export declare function isClassifiable(_id: string): boolean;
/** Map an id to its owning run-ops store by the version-char rule. */
export declare function classifyResidency(id: string): Residency;
/** Primary public name (RoutingRunStore / cross-seam guard). */
export declare const ownerEngine: typeof classifyResidency;
