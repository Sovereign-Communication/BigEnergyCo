"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discriminatedUnion = discriminatedUnion;
const v4_1 = require("zod/v4");
function discriminatedUnion(discriminator, options) {
    return v4_1.z.discriminatedUnion(discriminator, options);
}
//# sourceMappingURL=zod.js.map