"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdGenerator = exports.WebhookDeliveryId = exports.WebhookEndpointId = exports.SessionId = exports.ErrorId = exports.AttemptId = exports.BulkActionId = exports.BatchId = exports.WaitpointId = exports.SnapshotId = exports.RunId = exports.QueueId = exports.CheckpointId = exports.BackgroundWorkerId = exports.IdUtil = exports.WAITPOINT_ID_TYPE_INDEX = exports.WAITPOINT_ID_VERSION = exports.REGION_CODES = exports.DEFAULT_REGION_CHAR = exports.RUN_OPS_ID_SHARD_INDEX = exports.RUN_OPS_ID_VERSION_2 = exports.RUN_OPS_ID_VERSION = exports.RUN_OPS_ID_VERSION_INDEX = exports.RUN_OPS_ID_REGION_INDEX = exports.RUN_OPS_ID_LENGTH = void 0;
exports.generateFriendlyId = generateFriendlyId;
exports.isValidShardChar = isValidShardChar;
exports.regionCharForRegion = regionCharForRegion;
exports.base32hexEncode = base32hexEncode;
exports.base32hexDecode = base32hexDecode;
exports.generateRunOpsId = generateRunOpsId;
exports.generateRunOpsIdV2 = generateRunOpsIdV2;
exports.parseRunOpsIdBody = parseRunOpsIdBody;
exports.parseRunOpsIdV2Body = parseRunOpsIdV2Body;
exports.isRunOpsIdBody = isRunOpsIdBody;
exports.isRunOpsIdBodyShape = isRunOpsIdBodyShape;
exports.runOpsIdV2ShardShape = runOpsIdV2ShardShape;
exports.parseRunId = parseRunId;
exports.generateWaitpointId = generateWaitpointId;
exports.deriveWaitpointIdFromAnchor = deriveWaitpointIdFromAnchor;
exports.parseWaitpointId = parseWaitpointId;
exports.generateInternalId = generateInternalId;
exports.toFriendlyId = toFriendlyId;
exports.fromFriendlyId = fromFriendlyId;
const nanoid_1 = require("nanoid");
const cuid_1 = __importDefault(require("@bugsnag/cuid"));
const idGenerator = (0, nanoid_1.customAlphabet)("123456789abcdefghijkmnopqrstuvwxyz", 21);
function generateFriendlyId(prefix, size) {
    return `${prefix}_${idGenerator(size)}`;
}
// Run-ops v1 id: `<24-char base32hex core><region char><version char>` — 26 chars.
// Core = 6-byte big-endian unix ms timestamp + 9 bytes CSPRNG. Invariants:
//  - alphabet is lowercase [a-z0-9] (base32hex is [0-9a-v]): DNS-1123 safe for
//    k8s pod names, and byte order == lexicographic order, so ids sort in mint
//    order at ms resolution;
//  - the id NEVER contains "-" — that delimiter belongs to pod-name suffixes
//    (`runner-<id>-attempt-N`), so the id round-trips through a pod name by
//    cutting at the first hyphen;
//  - the `run_` (friendly) and `runner-` (pod) prefixes are part of the spec:
//    they guarantee the k8s name starts with a letter even though a base32hex
//    core can start with a digit.
const RUN_OPS_ID_ALPHABET = "0123456789abcdefghijklmnopqrstuv"; // base32hex, lowercase (RFC 4648 §7)
exports.RUN_OPS_ID_LENGTH = 26;
exports.RUN_OPS_ID_REGION_INDEX = 24;
exports.RUN_OPS_ID_VERSION_INDEX = 25;
exports.RUN_OPS_ID_VERSION = "1";
// Gen-2 id: same 26-char layout, but index 24 carries a routing SHARD KEY rather
// than a region char. MUST stay 26 chars: a 27-char shape could collide with the
// pre-cutover base62 format, which must keep classifying legacy.
exports.RUN_OPS_ID_VERSION_2 = "2";
exports.RUN_OPS_ID_SHARD_INDEX = exports.RUN_OPS_ID_REGION_INDEX;
const RUN_OPS_ID_CORE_BYTES = 15; // 6 timestamp + 9 random → exactly 24 base32hex chars
const RUN_OPS_ID_CORE_LENGTH = 24;
const RUN_OPS_ID_TIMESTAMP_BYTES = 6;
/** Region char stamped when the region is unknown or unmapped at mint. */
exports.DEFAULT_REGION_CHAR = "0";
// The region char is a raw positional char (readable via charAt before any
// decoding), NOT part of the base32hex core — so it may use the full DNS-safe
// lowercase [a-z0-9] range (e.g. "w" for us-west-2, which is outside [0-9a-v]).
const REGION_CHAR_PATTERN = /^[a-z0-9]$/;
// Same slot, same range: the gen-2 shard key is a region char's positional twin.
const SHARD_CHAR_PATTERN = REGION_CHAR_PATTERN;
/** True iff `value` is a single valid gen-2 shard char. The descriptor validator and
 * `resolveShard` share this so a configured key and a decoded key cannot drift. */
function isValidShardChar(value) {
    return SHARD_CHAR_PATTERN.test(value);
}
/** One lowercase [a-z0-9] char per supported region, at RUN_OPS_ID_REGION_INDEX. */
exports.REGION_CODES = {
    "us-east-1": "e",
    "us-west-2": "w",
    "eu-central-1": "c",
};
function regionCharForRegion(region) {
    return (region && exports.REGION_CODES[region]) || exports.DEFAULT_REGION_CHAR;
}
function resolveGetRandomValues() {
    const globalCrypto = globalThis.crypto;
    if (globalCrypto?.getRandomValues) {
        return (array) => globalCrypto.getRandomValues(array);
    }
    const webcrypto = loadNodeWebCrypto();
    if (webcrypto?.getRandomValues) {
        return (array) => webcrypto.getRandomValues(array);
    }
    throw new Error("No Web Crypto getRandomValues implementation available");
}
function loadNodeWebCrypto() {
    try {
        return (typeof require === "function" ? require("node:crypto") : undefined)?.webcrypto;
    }
    catch {
        return undefined;
    }
}
// Resolve the crypto source lazily on first use (memoized), so merely importing this
// widely-used module never throws when crypto is unavailable — only minting an id would.
let cachedGetRandomValues;
const getRandomValues = (array) => (cachedGetRandomValues ??= resolveGetRandomValues())(array);
/** Lowercase base32hex (RFC 4648 §7): 5 bits per char, order-preserving, no padding. */
function base32hexEncode(bytes) {
    let out = "";
    let buf = 0;
    let bits = 0;
    for (const b of bytes) {
        buf = (buf << 8) | b;
        bits += 8;
        while (bits >= 5) {
            out += RUN_OPS_ID_ALPHABET[(buf >> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    return out;
}
/** Inverse of base32hexEncode. Throws on characters outside the lowercase alphabet. */
function base32hexDecode(s) {
    const out = [];
    let buf = 0;
    let bits = 0;
    for (const c of s) {
        const v = RUN_OPS_ID_ALPHABET.indexOf(c);
        if (v === -1) {
            throw new Error(`invalid run id char: ${c}`);
        }
        buf = (buf << 5) | v;
        bits += 5;
        if (bits >= 8) {
            out.push((buf >> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return Uint8Array.from(out);
}
// Shared by both generations. The buffer MUST be per-call — a hoisted one would
// let concurrent mints overwrite each other's bytes.
function mintRunOpsIdCore() {
    const core = new Uint8Array(RUN_OPS_ID_CORE_BYTES);
    let ms = Date.now();
    for (let i = RUN_OPS_ID_TIMESTAMP_BYTES - 1; i >= 0; i--) {
        core[i] = ms % 256;
        ms = Math.floor(ms / 256);
    }
    getRandomValues(core.subarray(RUN_OPS_ID_TIMESTAMP_BYTES));
    return base32hexEncode(core);
}
/**
 * Mint a run-ops v1 id body (26 chars, no prefix): 24-char base32hex core
 * (6-byte ms timestamp + 9 CSPRNG bytes) + region char + version char "1".
 * The trailing version char at RUN_OPS_ID_VERSION_INDEX is the residency
 * discriminator — see runOpsResidency.ts.
 */
function generateRunOpsId(region) {
    return `${mintRunOpsIdCore()}${regionCharForRegion(region)}${exports.RUN_OPS_ID_VERSION}`;
}
/**
 * Mint a gen-2 id body (26 chars, no prefix): the same core, then the shard key,
 * then version char "2". Throws on a shard char outside [a-z0-9] — an id that
 * cannot be routed must never be minted.
 */
function generateRunOpsIdV2(shardChar) {
    if (!SHARD_CHAR_PATTERN.test(shardChar)) {
        throw new Error(`invalid run-ops shard char: ${JSON.stringify(shardChar)}`);
    }
    return `${mintRunOpsIdCore()}${shardChar}${exports.RUN_OPS_ID_VERSION_2}`;
}
const LEGACY_RUN_ID = { format: "legacy", table: "legacy" };
/**
 * Parse a v1 id body (no prefix). Returns undefined unless the body is exactly
 * 26 chars with version "1" at index 25 and every char inside the base32hex
 * alphabet — anything else (cuid, nanoid, pre-cutover 27-char base62, malformed
 * v1) is a legacy shape.
 */
function parseRunOpsIdBody(body) {
    if (body.length !== exports.RUN_OPS_ID_LENGTH)
        return undefined;
    if (body[exports.RUN_OPS_ID_VERSION_INDEX] !== exports.RUN_OPS_ID_VERSION)
        return undefined;
    const region = body[exports.RUN_OPS_ID_REGION_INDEX] ?? "";
    if (!REGION_CHAR_PATTERN.test(region))
        return undefined;
    const timestamp = parseRunOpsIdCoreTimestamp(body);
    if (timestamp === undefined)
        return undefined;
    return { timestamp, region, version: exports.RUN_OPS_ID_VERSION };
}
// Decode the leading 24-char core and recover its embedded ms timestamp.
// Returns undefined (never throws) when the core is outside the base32hex alphabet.
function parseRunOpsIdCoreTimestamp(body) {
    let core;
    try {
        core = base32hexDecode(body.slice(0, RUN_OPS_ID_CORE_LENGTH));
    }
    catch {
        return undefined;
    }
    let ms = 0;
    for (let i = 0; i < RUN_OPS_ID_TIMESTAMP_BYTES; i++) {
        ms = ms * 256 + (core[i] ?? 0);
    }
    return new Date(ms);
}
/**
 * Parse a gen-2 id body (no prefix): the mirror of {@link parseRunOpsIdBody},
 * requiring version "2" at index 25 and a shard key in [a-z0-9] at index 24.
 * Total: returns undefined for any other string, and never throws.
 */
function parseRunOpsIdV2Body(body) {
    if (body.length !== exports.RUN_OPS_ID_LENGTH)
        return undefined;
    if (body[exports.RUN_OPS_ID_VERSION_INDEX] !== exports.RUN_OPS_ID_VERSION_2)
        return undefined;
    const shard = body[exports.RUN_OPS_ID_SHARD_INDEX] ?? "";
    if (!SHARD_CHAR_PATTERN.test(shard))
        return undefined;
    const timestamp = parseRunOpsIdCoreTimestamp(body);
    if (timestamp === undefined)
        return undefined;
    return { timestamp, shard, version: exports.RUN_OPS_ID_VERSION_2 };
}
/** True if the (prefixless) id body is a well-formed run-ops v1 id. */
function isRunOpsIdBody(body) {
    return parseRunOpsIdBody(body) !== undefined;
}
// Same alphabet base32hexDecode accepts, so this and "the decode would not throw" are one
// predicate. Decoding a timestamp to discard it costs ~30x more on the router's hot path.
const RUN_OPS_ID_CORE_PATTERN = /^[0-9a-v]{24}$/;
function isRunOpsIdBodyShape(body) {
    return (body.length === exports.RUN_OPS_ID_LENGTH &&
        body[exports.RUN_OPS_ID_VERSION_INDEX] === exports.RUN_OPS_ID_VERSION &&
        REGION_CHAR_PATTERN.test(body[exports.RUN_OPS_ID_REGION_INDEX] ?? "") &&
        RUN_OPS_ID_CORE_PATTERN.test(body.slice(0, RUN_OPS_ID_CORE_LENGTH)));
}
function runOpsIdV2ShardShape(body) {
    if (body.length !== exports.RUN_OPS_ID_LENGTH)
        return undefined;
    if (body[exports.RUN_OPS_ID_VERSION_INDEX] !== exports.RUN_OPS_ID_VERSION_2)
        return undefined;
    const shard = body[exports.RUN_OPS_ID_SHARD_INDEX] ?? "";
    if (!SHARD_CHAR_PATTERN.test(shard))
        return undefined;
    return RUN_OPS_ID_CORE_PATTERN.test(body.slice(0, RUN_OPS_ID_CORE_LENGTH)) ? shard : undefined;
}
/** Parse a `run_`-prefixed friendly id; anything not a well-formed v1/gen-2 id is legacy. */
function parseRunId(id) {
    if (!id.startsWith("run_"))
        return LEGACY_RUN_ID;
    const body = id.slice(4);
    const v1 = parseRunOpsIdBody(body);
    if (v1)
        return { format: "b32hex", table: "partitioned", ...v1 };
    const v2 = parseRunOpsIdV2Body(body);
    if (v2)
        return { format: "b32hexV2", table: "partitioned", ...v2 };
    return LEGACY_RUN_ID;
}
// Waitpoint ids reuse the run-ops body layout — 24-char base32hex core, then a
// positional char, then a version char — so the body parses positionally instead of
// splitting on "_". Index 24 carries the TYPE (the slot a run uses for its region or
// shard char), which leaves room to move to a shard char under a later version.
exports.WAITPOINT_ID_VERSION = "w";
exports.WAITPOINT_ID_TYPE_INDEX = exports.RUN_OPS_ID_REGION_INDEX;
// "w" sits OUTSIDE the base32hex alphabet [0-9a-v], so the version char can never be
// mistaken for a core char, and it can never collide with a numeric run generation.
const WAITPOINT_TYPE_CHARS = {
    RUN: "r",
    BATCH: "b",
    DATETIME: "d",
    MANUAL: "m",
};
const WAITPOINT_TYPES_BY_CHAR = {
    r: "RUN",
    b: "BATCH",
    d: "DATETIME",
    m: "MANUAL",
};
const LEGACY_WAITPOINT_ID = { format: "legacy" };
/**
 * Mint a standalone waitpoint id body (26 chars, no prefix) for DATETIME and MANUAL: a
 * fresh core, the type char, then the waitpoint version char.
 */
function generateWaitpointId(type) {
    return `${mintRunOpsIdCore()}${WAITPOINT_TYPE_CHARS[type]}${exports.WAITPOINT_ID_VERSION}`;
}
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
function deriveWaitpointIdFromAnchor(anchorId, type) {
    const body = stripAnchorPrefix(anchorId);
    if (!parseRunOpsIdBody(body) && !parseRunOpsIdV2Body(body)) {
        return undefined;
    }
    return `${body.slice(0, RUN_OPS_ID_CORE_LENGTH)}${WAITPOINT_TYPE_CHARS[type]}${exports.WAITPOINT_ID_VERSION}`;
}
/**
 * Classify a waitpoint id. Accepts the prefixed (`waitpoint_<body>`) and bare forms, but
 * NOT another entity's prefix (`run_`, `batch_`, ...) — this is the discriminator a
 * later ticket uses to route a possibly customer-supplied id, so a foreign prefix must
 * classify legacy rather than have its body reinterpreted as a waitpoint id. Total:
 * never throws.
 */
function parseWaitpointId(id) {
    const body = stripWaitpointIdPrefix(id);
    if (body.length !== exports.RUN_OPS_ID_LENGTH)
        return LEGACY_WAITPOINT_ID;
    if (body[exports.RUN_OPS_ID_VERSION_INDEX] !== exports.WAITPOINT_ID_VERSION)
        return LEGACY_WAITPOINT_ID;
    const type = WAITPOINT_TYPES_BY_CHAR[body[exports.WAITPOINT_ID_TYPE_INDEX] ?? ""];
    if (!type)
        return LEGACY_WAITPOINT_ID;
    const timestamp = parseRunOpsIdCoreTimestamp(body);
    if (timestamp === undefined)
        return LEGACY_WAITPOINT_ID;
    return { format: "b32hexW", type, timestamp };
}
// Strip any `<prefix>_` if present. Prefix-agnostic is correct ONLY here: the caller
// already knows anchorId names a run or batch anchor, so there is no foreign prefix to
// guard against. Do not reuse for parseWaitpointId — see stripWaitpointIdPrefix.
function stripAnchorPrefix(id) {
    const underscore = id.indexOf("_");
    return underscore === -1 ? id : id.slice(underscore + 1);
}
const WAITPOINT_ID_PREFIX = "waitpoint_";
// Strip the `waitpoint_` prefix if present; any other prefix, or a bare body, is left
// as-is. Unlike stripAnchorPrefix, this must never strip a foreign prefix down to a body
// that then happens to pass the run-ops shape check.
function stripWaitpointIdPrefix(id) {
    return id.startsWith(WAITPOINT_ID_PREFIX) ? id.slice(WAITPOINT_ID_PREFIX.length) : id;
}
function generateInternalId() {
    return (0, cuid_1.default)();
}
/** Convert an internal ID to a friendly ID */
function toFriendlyId(entityName, internalId) {
    if (!entityName) {
        throw new Error("Entity name cannot be empty");
    }
    if (!internalId) {
        throw new Error("Internal ID cannot be empty");
    }
    if (internalId.startsWith(`${entityName}_`)) {
        return internalId;
    }
    return `${entityName}_${internalId}`;
}
/** Convert a friendly ID to an internal ID */
function fromFriendlyId(friendlyId, expectedEntityName) {
    if (!friendlyId) {
        throw new Error("Friendly ID cannot be empty");
    }
    const parts = friendlyId.split("_");
    if (parts.length !== 2) {
        throw new Error("Invalid friendly ID format");
    }
    const [entityName, internalId] = parts;
    if (!entityName) {
        throw new Error("Entity name cannot be empty");
    }
    if (!internalId) {
        throw new Error("Internal ID cannot be empty");
    }
    if (expectedEntityName && entityName !== expectedEntityName) {
        throw new Error(`Invalid entity name: ${entityName}`);
    }
    return internalId;
}
class IdUtil {
    entityName;
    constructor(entityName) {
        this.entityName = entityName;
    }
    generate() {
        const internalId = generateInternalId();
        return {
            id: internalId,
            friendlyId: this.toFriendlyId(internalId),
        };
    }
    toFriendlyId(internalId) {
        return toFriendlyId(this.entityName, internalId);
    }
    fromFriendlyId(friendlyId) {
        return fromFriendlyId(friendlyId);
    }
    /** Will convert friendlyIds, and will leave ids as they are */
    toId(value) {
        if (value.startsWith(`${this.entityName}_`)) {
            return fromFriendlyId(value);
        }
        return value;
    }
}
exports.IdUtil = IdUtil;
exports.BackgroundWorkerId = new IdUtil("worker");
exports.CheckpointId = new IdUtil("checkpoint");
exports.QueueId = new IdUtil("queue");
exports.RunId = new IdUtil("run");
exports.SnapshotId = new IdUtil("snapshot");
exports.WaitpointId = new IdUtil("waitpoint");
exports.BatchId = new IdUtil("batch");
exports.BulkActionId = new IdUtil("bulk");
exports.AttemptId = new IdUtil("attempt");
exports.ErrorId = new IdUtil("error");
exports.SessionId = new IdUtil("session");
exports.WebhookEndpointId = new IdUtil("wh"); // wh_...
/**
 * Webhook delivery id: time-encoded so the partition key (`createdAt`) is recoverable from the id.
 * The body is `base32hex(6-byte big-endian unix ms timestamp + 9 CSPRNG bytes)` (24 chars) plus a
 * version char "1", prefixed `whd_`. `WebhookDelivery` is RANGE-partitioned on `createdAt`, and the
 * engine sets the row's `createdAt` to the mint timestamp, so a point lookup by id can recover the
 * partition from the id alone instead of threading `createdAt` through every caller.
 */
const WEBHOOK_DELIVERY_ID_PREFIX = "whd";
const WEBHOOK_DELIVERY_ID_TIMESTAMP_BYTES = 6;
const WEBHOOK_DELIVERY_ID_CORE_BYTES = 15;
const WEBHOOK_DELIVERY_ID_CORE_LENGTH = 24;
const WEBHOOK_DELIVERY_ID_VERSION = "1";
const WEBHOOK_DELIVERY_ID_BODY_LENGTH = 25;
function webhookDeliveryIdBody(idOrFriendlyId) {
    return idOrFriendlyId.startsWith(`${WEBHOOK_DELIVERY_ID_PREFIX}_`)
        ? idOrFriendlyId.slice(WEBHOOK_DELIVERY_ID_PREFIX.length + 1)
        : idOrFriendlyId;
}
exports.WebhookDeliveryId = {
    /**
     * Mint a delivery id. The row's `createdAt` MUST be set to the returned `timestamp` so the id's
     * embedded timestamp equals the partition key that {@link WebhookDeliveryId.parseTimestamp} recovers.
     */
    generate() {
        const timestamp = new Date();
        const core = new Uint8Array(WEBHOOK_DELIVERY_ID_CORE_BYTES);
        let ms = timestamp.getTime();
        for (let i = WEBHOOK_DELIVERY_ID_TIMESTAMP_BYTES - 1; i >= 0; i--) {
            core[i] = ms % 256;
            ms = Math.floor(ms / 256);
        }
        getRandomValues(core.subarray(WEBHOOK_DELIVERY_ID_TIMESTAMP_BYTES));
        const id = `${base32hexEncode(core)}${WEBHOOK_DELIVERY_ID_VERSION}`;
        return { id, friendlyId: `${WEBHOOK_DELIVERY_ID_PREFIX}_${id}`, timestamp };
    },
    toFriendlyId(id) {
        return id.startsWith(`${WEBHOOK_DELIVERY_ID_PREFIX}_`)
            ? id
            : `${WEBHOOK_DELIVERY_ID_PREFIX}_${id}`;
    },
    toId(idOrFriendlyId) {
        return webhookDeliveryIdBody(idOrFriendlyId);
    },
    /**
     * Decode the mint timestamp (== the row's `createdAt` partition key) from an id or friendlyId.
     * Returns `undefined` if the value is not a well-formed time-encoded id.
     */
    parseTimestamp(idOrFriendlyId) {
        const body = webhookDeliveryIdBody(idOrFriendlyId);
        if (body.length !== WEBHOOK_DELIVERY_ID_BODY_LENGTH)
            return undefined;
        if (body[WEBHOOK_DELIVERY_ID_CORE_LENGTH] !== WEBHOOK_DELIVERY_ID_VERSION)
            return undefined;
        let core;
        try {
            core = base32hexDecode(body.slice(0, WEBHOOK_DELIVERY_ID_CORE_LENGTH));
        }
        catch {
            return undefined;
        }
        let ms = 0;
        for (let i = 0; i < WEBHOOK_DELIVERY_ID_TIMESTAMP_BYTES; i++) {
            ms = ms * 256 + (core[i] ?? 0);
        }
        return new Date(ms);
    },
};
class IdGenerator {
    alphabet;
    length;
    prefix;
    constructor({ alphabet, length, prefix }) {
        this.alphabet = alphabet;
        this.length = length;
        this.prefix = prefix;
    }
    generate() {
        return `${this.prefix}${(0, nanoid_1.customAlphabet)(this.alphabet, this.length)()}`;
    }
}
exports.IdGenerator = IdGenerator;
//# sourceMappingURL=friendlyId.js.map