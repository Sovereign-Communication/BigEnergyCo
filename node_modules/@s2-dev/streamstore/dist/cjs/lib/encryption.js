"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptionKey = exports.EncryptionKeyLengthError = exports.MAX_ENCRYPTION_KEY_HEADER_VALUE_LEN = exports.S2_ENCRYPTION_KEY_HEADER = void 0;
exports.resolveEncryptionKey = resolveEncryptionKey;
const error_js_1 = require("../error.js");
const base64_js_1 = require("./base64.js");
const Redacted = require("./redacted.js");
/**
 * Request header used for per-stream append/read encryption keys.
 */
exports.S2_ENCRYPTION_KEY_HEADER = "s2-encryption-key";
exports.MAX_ENCRYPTION_KEY_HEADER_VALUE_LEN = 44;
class EncryptionKeyLengthError extends error_js_1.S2Error {
    length;
    constructor(length) {
        super({
            message: `invalid encryption key: key material length ${length} is out of range`,
            origin: "sdk",
        });
        this.length = length;
        this.name = "EncryptionKeyLengthError";
    }
}
exports.EncryptionKeyLengthError = EncryptionKeyLengthError;
/**
 * Helpers for normalizing client-supplied encryption keys.
 */
exports.EncryptionKey = {
    /**
     * Normalize key material into the base64-encoded header form accepted by S2.
     */
    from(value) {
        const normalized = typeof value === "string" ? value.trim() : (0, base64_js_1.encodeToBase64)(value);
        const keyMaterialLength = typeof value === "string" ? normalized.length : value.byteLength;
        if (normalized.length === 0 ||
            normalized.length > exports.MAX_ENCRYPTION_KEY_HEADER_VALUE_LEN) {
            throw new EncryptionKeyLengthError(keyMaterialLength);
        }
        return normalized;
    },
};
function resolveEncryptionKey(value) {
    if (value === undefined || value === null) {
        return undefined;
    }
    return Redacted.make(exports.EncryptionKey.from(value));
}
//# sourceMappingURL=encryption.js.map