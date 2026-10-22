import { S2Error } from "../error.js";
import { encodeToBase64 } from "./base64.js";
import * as Redacted from "./redacted.js";
/**
 * Request header used for per-stream append/read encryption keys.
 */
export const S2_ENCRYPTION_KEY_HEADER = "s2-encryption-key";
export const MAX_ENCRYPTION_KEY_HEADER_VALUE_LEN = 44;
export class EncryptionKeyLengthError extends S2Error {
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
/**
 * Helpers for normalizing client-supplied encryption keys.
 */
export const EncryptionKey = {
    /**
     * Normalize key material into the base64-encoded header form accepted by S2.
     */
    from(value) {
        const normalized = typeof value === "string" ? value.trim() : encodeToBase64(value);
        const keyMaterialLength = typeof value === "string" ? normalized.length : value.byteLength;
        if (normalized.length === 0 ||
            normalized.length > MAX_ENCRYPTION_KEY_HEADER_VALUE_LEN) {
            throw new EncryptionKeyLengthError(keyMaterialLength);
        }
        return normalized;
    },
};
export function resolveEncryptionKey(value) {
    if (value === undefined || value === null) {
        return undefined;
    }
    return Redacted.make(EncryptionKey.from(value));
}
//# sourceMappingURL=encryption.js.map