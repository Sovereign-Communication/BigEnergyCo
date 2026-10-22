"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskEventStyle = exports.COLD_VARIANT = exports.WARM_VARIANT = exports.PRIMARY_VARIANT = void 0;
const v4_1 = require("zod/v4");
exports.PRIMARY_VARIANT = "primary";
exports.WARM_VARIANT = "warm";
exports.COLD_VARIANT = "cold";
const Variant = v4_1.z.enum([exports.PRIMARY_VARIANT, exports.WARM_VARIANT, exports.COLD_VARIANT]);
const AccessoryItem = v4_1.z.object({
    text: v4_1.z.string(),
    variant: v4_1.z.string().optional(),
    url: v4_1.z.string().optional(),
    icon: v4_1.z.string().optional(),
});
const Accessory = v4_1.z.object({
    items: v4_1.z.array(AccessoryItem),
    style: v4_1.z.enum(["codepath", "pills"]).optional(),
});
exports.TaskEventStyle = v4_1.z
    .object({
    icon: v4_1.z.string().optional(),
    variant: Variant.optional(),
    accessory: Accessory.optional(),
})
    .default({
    icon: undefined,
    variant: undefined,
});
//# sourceMappingURL=style.js.map