import { S2Error } from "../error.js";
import * as Redacted from "./redacted.js";
/**
 * Encryption algorithm for basin-level default stream encryption.
 */
export type EncryptionAlgorithm = "aegis-256" | "aes-256-gcm";
/**
 * Accepted input for client-supplied encryption keys.
 *
 * - `string`: base64-encoded key material
 * - `Uint8Array`: raw key material, which will be base64-encoded automatically
 */
export type EncryptionKeyInput = string | Uint8Array;
/**
 * Request header used for per-stream append/read encryption keys.
 */
export declare const S2_ENCRYPTION_KEY_HEADER = "s2-encryption-key";
export declare const MAX_ENCRYPTION_KEY_HEADER_VALUE_LEN = 44;
export declare class EncryptionKeyLengthError extends S2Error {
    readonly length: number;
    constructor(length: number);
}
/**
 * Helpers for normalizing client-supplied encryption keys.
 */
export declare const EncryptionKey: {
    /**
     * Normalize key material into the base64-encoded header form accepted by S2.
     */
    from(value: EncryptionKeyInput): string;
};
export declare function resolveEncryptionKey(value: EncryptionKeyInput | undefined | null): Redacted.Redacted<string> | undefined;
//# sourceMappingURL=encryption.d.ts.map