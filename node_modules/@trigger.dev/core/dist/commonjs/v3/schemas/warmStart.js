"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmStartConnectResponse = void 0;
const v4_1 = require("zod/v4");
exports.WarmStartConnectResponse = v4_1.z.object({
    connectionTimeoutMs: v4_1.z.number().optional(),
    keepaliveMs: v4_1.z.number().optional(),
});
//# sourceMappingURL=warmStart.js.map