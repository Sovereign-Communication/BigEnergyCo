"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ownerEngine = exports.UnclassifiableRunId = exports.CUID_LENGTH = void 0;
exports.resolveShard = resolveShard;
exports.classifyKind = classifyKind;
exports.isClassifiable = isClassifiable;
exports.classifyResidency = classifyResidency;
const friendlyId_js_1 = require("./friendlyId.js");
/** @bugsnag/cuid emits 25-char ids (legacy mint path, flag OFF). */
exports.CUID_LENGTH = 25;
/**
 * Kept for API compatibility: the default classifier no longer throws (every
 * non-v1 shape is legacy), but injected classifiers may still raise it and
 * callers still catch it.
 */
class UnclassifiableRunId extends Error {
    value;
    valueLength;
    constructor(value) {
        super(`Unclassifiable run-ops id: value=${JSON.stringify(value)} (length ${value.length})`);
        this.name = "UnclassifiableRunId";
        this.value = value;
        this.valueLength = value.length;
    }
}
exports.UnclassifiableRunId = UnclassifiableRunId;
/**
 * Strip a single leading `<prefix>_` (e.g. `run_`, `waitpoint_`) if present,
 * so friendly and internal forms classify identically. Only the FIRST
 * underscore is treated as the prefix separator (mirrors fromFriendlyId's
 * two-part split contract in friendlyId.ts), without importing it.
 */
function internalForm(id) {
    const underscore = id.indexOf("_");
    return underscore === -1 ? id : id.slice(underscore + 1);
}
/**
 * Resolve the store that owns an id. A gen-2 body names its own shard; a gen-1
 * v1 body resolves to the single dedicated store; everything else is legacy.
 *
 * The version char at index 25 is one character, so the v1 and gen-2 shape
 * checks are mutually exclusive by construction — a gen-1 id can never resolve
 * to a shard, and a gen-2 id can never resolve to "new". Total: never throws.
 */
function resolveShard(id) {
    const body = internalForm(id);
    const shard = (0, friendlyId_js_1.runOpsIdV2ShardShape)(body);
    if (shard !== undefined)
        return shard;
    return (0, friendlyId_js_1.isRunOpsIdBodyShape)(body) ? "new" : "legacy";
}
/**
 * Returns the id lineage by the version-char rule: a well-formed run-ops v1 body
 * (version "1") or gen-2 body (version "2") is "runOpsId"; everything else —
 * including malformed shapes of either — is "cuid" (legacy). Total: never throws.
 * Transition: pre-cutover 27-char base62 ids (the old NEW-mint format) classify
 * LEGACY, so ship this with the base32hex generator only once any 27-char
 * NEW-resident runs are drained/disposable — no live run is misrouted mid-cutover.
 */
function classifyKind(id) {
    return resolveShard(id) === "legacy" ? "cuid" : "runOpsId";
}
/** Classification is total now; kept for API compatibility. */
function isClassifiable(_id) {
    return true;
}
/** Map an id to its owning run-ops store by the version-char rule. */
function classifyResidency(id) {
    return classifyKind(id) === "runOpsId" ? "NEW" : "LEGACY";
}
/** Primary public name (RoutingRunStore / cross-seam guard). */
exports.ownerEngine = classifyResidency;
//# sourceMappingURL=runOpsResidency.js.map