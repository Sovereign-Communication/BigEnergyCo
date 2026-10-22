"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mintWaitpointIdForShard = mintWaitpointIdForShard;
exports.mintWaitpointIdFor = mintWaitpointIdFor;
const friendlyId_js_1 = require("./friendlyId.js");
const runOpsResidency_js_1 = require("./runOpsResidency.js");
// A Postgres waitpoint id, not the Redis store format (version "w"), which has no row to route.
// The core is always fresh, or the body would equal the anchor's own id.
function mintWaitpointIdForShard(key) {
    if (key === "new" || key === "legacy") {
        return friendlyId_js_1.WaitpointId.generate();
    }
    const id = (0, friendlyId_js_1.generateRunOpsIdV2)(key);
    return { id, friendlyId: friendlyId_js_1.WaitpointId.toFriendlyId(id) };
}
// Every Postgres waitpoint mint goes through here: the router refuses an unstamped id on a shard.
function mintWaitpointIdFor(anchorId) {
    return anchorId === undefined
        ? friendlyId_js_1.WaitpointId.generate()
        : mintWaitpointIdForShard((0, runOpsResidency_js_1.resolveShard)(anchorId));
}
//# sourceMappingURL=waitpointMint.js.map