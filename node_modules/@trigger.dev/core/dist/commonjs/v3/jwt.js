"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWT_AUDIENCE = exports.JWT_ISSUER = exports.JWT_ALGORITHM = void 0;
exports.isPublicJWT = isPublicJWT;
exports.extractJWTSub = extractJWTSub;
exports.generateJWT = generateJWT;
exports.validateJWT = validateJWT;
exports.JWT_ALGORITHM = "HS256";
exports.JWT_ISSUER = "https://id.trigger.dev";
exports.JWT_AUDIENCE = "https://api.trigger.dev";
function decodeJWTPayload(token) {
    const parts = token.split(".");
    const encodedPayload = parts[1];
    if (parts.length !== 3 || !encodedPayload)
        return;
    try {
        const base64 = encodedPayload
            .replace(/-/g, "+")
            .replace(/_/g, "/")
            .padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
        const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
    }
    catch {
        return;
    }
}
function isPublicJWT(token) {
    const payload = decodeJWTPayload(token);
    return (payload !== null && typeof payload === "object" && "pub" in payload && payload.pub === true);
}
function extractJWTSub(token) {
    const payload = decodeJWTPayload(token);
    return payload !== null &&
        typeof payload === "object" &&
        "sub" in payload &&
        typeof payload.sub === "string"
        ? payload.sub
        : undefined;
}
async function generateJWT(options) {
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(options.secretKey);
    const jwt = new SignJWT(options.payload)
        .setIssuer(exports.JWT_ISSUER)
        .setAudience(exports.JWT_AUDIENCE)
        .setProtectedHeader({ alg: exports.JWT_ALGORITHM })
        .setExpirationTime(options.expirationTime ?? "15m");
    if (!options.omitIssuedAt) {
        jwt.setIssuedAt();
    }
    return jwt.sign(secret);
}
async function validateJWT(token, apiKey) {
    const { jwtVerify, errors } = await import("jose");
    const secret = new TextEncoder().encode(apiKey);
    try {
        const { payload } = await jwtVerify(token, secret, {
            issuer: exports.JWT_ISSUER,
            audience: exports.JWT_AUDIENCE,
        });
        return { ok: true, payload };
    }
    catch (error) {
        if (error instanceof errors.JOSEError) {
            return {
                ok: false,
                error: error.message,
                code: error.code,
            };
        }
        else {
            return {
                ok: false,
                error: error instanceof Error ? error.message : "Unknown error",
                code: "ERR_UNKNOWN",
            };
        }
    }
}
//# sourceMappingURL=jwt.js.map