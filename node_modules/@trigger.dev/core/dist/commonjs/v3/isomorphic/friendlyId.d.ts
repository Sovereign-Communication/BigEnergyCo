export declare function generateFriendlyId(prefix: string, size?: number): string;
export declare const RUN_OPS_ID_LENGTH = 26;
export declare const RUN_OPS_ID_REGION_INDEX = 24;
export declare const RUN_OPS_ID_VERSION_INDEX = 25;
export declare const RUN_OPS_ID_VERSION = "1";
export declare const RUN_OPS_ID_VERSION_2 = "2";
export declare const RUN_OPS_ID_SHARD_INDEX = 24;
/** Region char stamped when the region is unknown or unmapped at mint. */
export declare const DEFAULT_REGION_CHAR = "0";
/** True iff `value` is a single valid gen-2 shard char. The descriptor validator and
 * `resolveShard` share this so a configured key and a decoded key cannot drift. */
export declare function isValidShardChar(value: string): boolean;
/** One lowercase [a-z0-9] char per supported region, at RUN_OPS_ID_REGION_INDEX. */
export declare const REGION_CODES: Readonly<Record<string, string>>;
export declare function regionCharForRegion(region: string | undefined): string;
/** Lowercase base32hex (RFC 4648 §7): 5 bits per char, order-preserving, no padding. */
export declare function base32hexEncode(bytes: Uint8Array): string;
/** Inverse of base32hexEncode. Throws on characters outside the lowercase alphabet. */
export declare function base32hexDecode(s: string): Uint8Array;
/**
 * Mint a run-ops v1 id body (26 chars, no prefix): 24-char base32hex core
 * (6-byte ms timestamp + 9 CSPRNG bytes) + region char + version char "1".
 * The trailing version char at RUN_OPS_ID_VERSION_INDEX is the residency
 * discriminator — see runOpsResidency.ts.
 */
export declare function generateRunOpsId(region?: string): string;
/**
 * Mint a gen-2 id body (26 chars, no prefix): the same core, then the shard key,
 * then version char "2". Throws on a shard char outside [a-z0-9] — an id that
 * cannot be routed must never be minted.
 */
export declare function generateRunOpsIdV2(shardChar: string): string;
export type ParsedRunId = {
    format: "b32hex";
    table: "partitioned";
    timestamp: Date;
    region: string;
    version: string;
} | {
    format: "b32hexV2";
    table: "partitioned";
    timestamp: Date;
    shard: string;
    version: string;
} | {
    format: "legacy";
    table: "legacy";
};
/**
 * Parse a v1 id body (no prefix). Returns undefined unless the body is exactly
 * 26 chars with version "1" at index 25 and every char inside the base32hex
 * alphabet — anything else (cuid, nanoid, pre-cutover 27-char base62, malformed
 * v1) is a legacy shape.
 */
export declare function parseRunOpsIdBody(body: string): {
    timestamp: Date;
    region: string;
    version: string;
} | undefined;
/**
 * Parse a gen-2 id body (no prefix): the mirror of {@link parseRunOpsIdBody},
 * requiring version "2" at index 25 and a shard key in [a-z0-9] at index 24.
 * Total: returns undefined for any other string, and never throws.
 */
export declare function parseRunOpsIdV2Body(body: string): {
    timestamp: Date;
    shard: string;
    version: string;
} | undefined;
/** True if the (prefixless) id body is a well-formed run-ops v1 id. */
export declare function isRunOpsIdBody(body: string): boolean;
export declare function isRunOpsIdBodyShape(body: string): boolean;
export declare function runOpsIdV2ShardShape(body: string): string | undefined;
/** Parse a `run_`-prefixed friendly id; anything not a well-formed v1/gen-2 id is legacy. */
export declare function parseRunId(id: string): ParsedRunId;
export declare const WAITPOINT_ID_VERSION = "w";
export declare const WAITPOINT_ID_TYPE_INDEX = 24;
export type WaitpointIdType = "RUN" | "BATCH" | "DATETIME" | "MANUAL";
export type ParsedWaitpointId = {
    format: "b32hexW";
    type: WaitpointIdType;
    timestamp: Date;
} | {
    format: "legacy";
};
/**
 * Mint a standalone waitpoint id body (26 chars, no prefix) for DATETIME and MANUAL: a
 * fresh core, the type char, then the waitpoint version char.
 */
export declare function generateWaitpointId(type: WaitpointIdType): string;
/**
 * Derive the 1:1 waitpoint id body for a RUN or BATCH anchor by reusing the anchor's
 * 24-char core. Pure, so create-if-absent is idempotent without a lock. Returns
 * undefined when the anchor is not a run-ops id, which is the caller's signal to mint a
 * legacy waitpoint instead.
 *
 * Only the core survives: the anchor's region or shard char and its version char are
 * both replaced. So the anchor id is NOT recoverable from the waitpoint id — the reverse
 * direction uses the completedBy* back-pointer.
 */
export declare function deriveWaitpointIdFromAnchor(anchorId: string, type: WaitpointIdType): string | undefined;
/**
 * Classify a waitpoint id. Accepts the prefixed (`waitpoint_<body>`) and bare forms, but
 * NOT another entity's prefix (`run_`, `batch_`, ...) — this is the discriminator a
 * later ticket uses to route a possibly customer-supplied id, so a foreign prefix must
 * classify legacy rather than have its body reinterpreted as a waitpoint id. Total:
 * never throws.
 */
export declare function parseWaitpointId(id: string): ParsedWaitpointId;
export declare function generateInternalId(): string;
/** Convert an internal ID to a friendly ID */
export declare function toFriendlyId(entityName: string, internalId: string): string;
/** Convert a friendly ID to an internal ID */
export declare function fromFriendlyId(friendlyId: string, expectedEntityName?: string): string;
export declare class IdUtil {
    private entityName;
    constructor(entityName: string);
    generate(): {
        id: string;
        friendlyId: string;
    };
    toFriendlyId(internalId: string): string;
    fromFriendlyId(friendlyId: string): string;
    /** Will convert friendlyIds, and will leave ids as they are */
    toId(value: string): string;
}
export declare const BackgroundWorkerId: IdUtil;
export declare const CheckpointId: IdUtil;
export declare const QueueId: IdUtil;
export declare const RunId: IdUtil;
export declare const SnapshotId: IdUtil;
export declare const WaitpointId: IdUtil;
export declare const BatchId: IdUtil;
export declare const BulkActionId: IdUtil;
export declare const AttemptId: IdUtil;
export declare const ErrorId: IdUtil;
export declare const SessionId: IdUtil;
export declare const WebhookEndpointId: IdUtil;
export declare const WebhookDeliveryId: {
    /**
     * Mint a delivery id. The row's `createdAt` MUST be set to the returned `timestamp` so the id's
     * embedded timestamp equals the partition key that {@link WebhookDeliveryId.parseTimestamp} recovers.
     */
    generate(): {
        id: string;
        friendlyId: string;
        timestamp: Date;
    };
    toFriendlyId(id: string): string;
    toId(idOrFriendlyId: string): string;
    /**
     * Decode the mint timestamp (== the row's `createdAt` partition key) from an id or friendlyId.
     * Returns `undefined` if the value is not a well-formed time-encoded id.
     */
    parseTimestamp(idOrFriendlyId: string): Date | undefined;
};
export declare class IdGenerator {
    private alphabet;
    private length;
    private prefix;
    constructor({ alphabet, length, prefix }: {
        alphabet: string;
        length: number;
        prefix: string;
    });
    generate(): string;
}
