"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManifest = void 0;
const v4_1 = require("zod/v4");
exports.ConfigManifest = v4_1.z.object({
    project: v4_1.z.string(),
    dirs: v4_1.z.string().array(),
});
//# sourceMappingURL=config.js.map