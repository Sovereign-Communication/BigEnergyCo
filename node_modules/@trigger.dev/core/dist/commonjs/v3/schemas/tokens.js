"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetPersonalAccessTokenResponseSchema = exports.GetPersonalAccessTokenRequestSchema = exports.CreateAuthorizationCodeResponseSchema = void 0;
const v4_1 = require("zod/v4");
exports.CreateAuthorizationCodeResponseSchema = v4_1.z.object({
    url: v4_1.z.string().url(),
    authorizationCode: v4_1.z.string(),
});
exports.GetPersonalAccessTokenRequestSchema = v4_1.z.object({
    authorizationCode: v4_1.z.string(),
});
exports.GetPersonalAccessTokenResponseSchema = v4_1.z.object({
    token: v4_1.z
        .object({
        token: v4_1.z.string(),
        obfuscatedToken: v4_1.z.string(),
    })
        .nullable(),
});
//# sourceMappingURL=tokens.js.map