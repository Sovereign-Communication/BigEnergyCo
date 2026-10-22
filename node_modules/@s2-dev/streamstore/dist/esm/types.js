/**
 * S2 SDK Types
 *
 * All public SDK types are defined here. Types use camelCase field names
 * for idiomatic JavaScript/TypeScript usage.
 *
 * Generated types (snake_case, matching API wire format) are available
 * from "./generated/types.gen.js" as the `API` namespace.
 */
import { S2Error } from "./error.js";
import { meteredBytes as calculateMeteredBytes, utf8ByteLength, } from "./utils.js";
export { EncryptionKey, EncryptionKeyLengthError } from "./lib/encryption.js";
const textEncoder = new TextEncoder();
/**
 * Factory functions for creating AppendRecord instances.
 */
export var AppendRecord;
(function (AppendRecord) {
    /**
     * Create a string-format append record with pre-calculated metered size.
     */
    function string(params) {
        // Create record with placeholder, then calculate actual size
        const record = {
            body: params.body,
            headers: params.headers,
            timestamp: params.timestamp,
            meteredBytes: 0,
        };
        // Safe to cast: we're setting a readonly property during construction
        record.meteredBytes =
            calculateMeteredBytes(record);
        return record;
    }
    AppendRecord.string = string;
    /**
     * Create a bytes-format append record with pre-calculated metered size.
     * String header names and values are encoded as UTF-8.
     */
    function bytes(params) {
        const headers = params.headers?.map(([name, value]) => [
            typeof name === "string" ? textEncoder.encode(name) : name,
            typeof value === "string" ? textEncoder.encode(value) : value,
        ]);
        // Create record with placeholder, then calculate actual size
        const record = {
            body: params.body,
            headers,
            timestamp: params.timestamp,
            meteredBytes: 0,
        };
        // Safe to cast: we're setting a readonly property during construction
        record.meteredBytes =
            calculateMeteredBytes(record);
        return record;
    }
    AppendRecord.bytes = bytes;
    /**
     * Create a fence command record.
     * String-format, but can be batched freely alongside bytes records.
     */
    function fence(fencingToken, timestamp) {
        const tokenBytes = utf8ByteLength(fencingToken);
        if (tokenBytes > 36) {
            throw new S2Error({
                message: "fencing token must not exceed 36 bytes in length",
                origin: "sdk",
                status: 422,
            });
        }
        return string({
            body: fencingToken,
            headers: [["", "fence"]],
            timestamp,
        });
    }
    AppendRecord.fence = fence;
    /**
     * Create a trim command record.
     * Bytes-format, but can be batched freely alongside string records.
     */
    function trim(seqNum, timestamp) {
        if (!Number.isSafeInteger(seqNum) || seqNum < 0) {
            throw new S2Error({
                message: "seqNum must be a non-negative safe integer",
                origin: "sdk",
            });
        }
        const buffer = new Uint8Array(8);
        const view = new DataView(buffer.buffer);
        view.setBigUint64(0, BigInt(seqNum), false);
        return bytes({
            body: buffer,
            headers: [["", "trim"]],
            timestamp,
        });
    }
    AppendRecord.trim = trim;
    /**
     * Maximum body size in bytes for a record with the given headers, such that
     * a batch containing only that record stays within {@link MAX_APPEND_BYTES}.
     *
     * When batching multiple records, the limit applies to the sum of their
     * metered sizes, so the available body size shrinks accordingly.
     */
    function maxBodyBytes(headers) {
        return Math.max(0, MAX_APPEND_BYTES - calculateMeteredBytes({ headers }));
    }
    AppendRecord.maxBodyBytes = maxBodyBytes;
})(AppendRecord || (AppendRecord = {}));
// =============================================================================
// Append Input
// =============================================================================
/** Maximum number of records in a single append batch. */
export const MAX_APPEND_RECORDS = 1000;
/** Maximum total metered bytes for records in a single append batch (1 MiB). */
export const MAX_APPEND_BYTES = 1024 * 1024;
/**
 * Factory functions for creating AppendInput instances.
 */
export var AppendInput;
(function (AppendInput) {
    /**
     * Create an AppendInput with validation.
     * A batch may contain both string and bytes records.
     *
     * @throws {S2Error} If validation fails (empty, too many records, or too large)
     */
    function create(records, options) {
        if (records.length === 0) {
            throw new S2Error({
                message: "AppendInput must contain at least one record",
                origin: "sdk",
            });
        }
        if (records.length > MAX_APPEND_RECORDS) {
            throw new S2Error({
                message: `AppendInput cannot contain more than ${MAX_APPEND_RECORDS} records (got ${records.length})`,
                origin: "sdk",
            });
        }
        const totalBytes = records.reduce((sum, r) => sum + r.meteredBytes, 0);
        if (totalBytes > MAX_APPEND_BYTES) {
            throw new S2Error({
                message: `AppendInput exceeds maximum of ${MAX_APPEND_BYTES} bytes (got ${totalBytes} bytes)`,
                origin: "sdk",
            });
        }
        if (options?.fencingToken !== undefined) {
            const tokenBytes = utf8ByteLength(options.fencingToken);
            if (tokenBytes > 36) {
                throw new S2Error({
                    message: "fencing token must not exceed 36 bytes in length",
                    origin: "sdk",
                    status: 422,
                });
            }
        }
        if (options?.matchSeqNum !== undefined &&
            (!Number.isSafeInteger(options.matchSeqNum) || options.matchSeqNum < 0)) {
            throw new S2Error({
                message: "matchSeqNum must be a non-negative safe integer",
                origin: "sdk",
            });
        }
        return {
            records,
            matchSeqNum: options?.matchSeqNum,
            fencingToken: options?.fencingToken,
            meteredBytes: totalBytes,
        };
    }
    AppendInput.create = create;
})(AppendInput || (AppendInput = {}));
//# sourceMappingURL=types.js.map