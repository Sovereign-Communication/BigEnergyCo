"use strict";
/**
 * S2S Protocol Message Framing
 *
 * Message format:
 * - 3 bytes: Length prefix (total message length including flag byte, big-endian)
 * - 1 byte: Flag byte [T][CC][RRRRR]
 *   - T (bit 7): Terminal flag (1 = stream ends after this message)
 *   - CC (bits 6-5): Compression (00=none, 01=zstd, 10=gzip)
 *   - RRRRR (bits 4-0): Reserved
 * - Variable: Body (protobuf message or JSON error for terminal frames)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.S2SFrameParser = exports.MAX_DECOMPRESSED_PAYLOAD_BYTES = exports.MAX_FRAME_PAYLOAD_BYTES = exports.MAX_FRAME_BYTES = void 0;
exports.frameMessage = frameMessage;
const FLAG_TOTAL_SIZE = 1;
const STATUS_CODE_SIZE = 2;
exports.MAX_FRAME_BYTES = 2 * 1024 * 1024;
exports.MAX_FRAME_PAYLOAD_BYTES = exports.MAX_FRAME_BYTES - FLAG_TOTAL_SIZE;
exports.MAX_DECOMPRESSED_PAYLOAD_BYTES = exports.MAX_FRAME_PAYLOAD_BYTES;
/**
 * Frame a message for s2s protocol
 */
function frameMessage(opts) {
    const compression = opts.terminal ? "none" : (opts.compression ?? "none");
    // Build flag byte
    let flag = 0;
    if (opts.terminal) {
        flag |= 0x80; // Set bit 7
    }
    if (compression === "zstd") {
        flag |= 0x20; // Set bit 5
    }
    else if (compression === "gzip") {
        flag |= 0x40; // Set bit 6
    }
    // For terminal frames with status code, prepend 2-byte status code to body
    let body = opts.body;
    if (opts.terminal && opts.statusCode !== undefined) {
        const statusBytes = new Uint8Array(2);
        statusBytes[0] = (opts.statusCode >> 8) & 0xff;
        statusBytes[1] = opts.statusCode & 0xff;
        body = new Uint8Array(statusBytes.length + opts.body.length);
        body.set(statusBytes, 0);
        body.set(opts.body, statusBytes.length);
    }
    // Calculate total length (flag + body)
    const length = 1 + body.length;
    if (length > exports.MAX_FRAME_BYTES) {
        throw new Error(`Message too large: ${length} bytes (max ${exports.MAX_FRAME_BYTES} bytes)`);
    }
    // Allocate frame buffer
    const frame = new Uint8Array(3 + length);
    // Write 3-byte length prefix (big-endian)
    frame[0] = (length >> 16) & 0xff;
    frame[1] = (length >> 8) & 0xff;
    frame[2] = length & 0xff;
    // Write flag byte
    frame[3] = flag;
    // Write body
    frame.set(body, 4);
    return frame;
}
/**
 * Parser for reading s2s frames from a stream
 */
class S2SFrameParser {
    buffer = new Uint8Array(0);
    /**
     * Add data to the parser buffer
     */
    push(data) {
        const newBuffer = new Uint8Array(this.buffer.length + data.length);
        newBuffer.set(this.buffer, 0);
        newBuffer.set(data, this.buffer.length);
        this.buffer = newBuffer;
    }
    /**
     * Try to parse the next frame from the buffer
     * Returns null if not enough data available
     */
    parseFrame() {
        // Need at least 4 bytes (3-byte length + 1-byte flag)
        if (this.buffer.length < 4) {
            return null;
        }
        // Read 3-byte length prefix (big-endian)
        const length = (this.buffer[0] << 16) | (this.buffer[1] << 8) | this.buffer[2];
        if (length > exports.MAX_FRAME_BYTES) {
            throw new Error("frame exceeds decode limit");
        }
        // The protocol requires at least a flag byte, so length must be >= 1
        if (length < 1) {
            throw new Error(`Invalid S2S frame: length prefix is 0, but the flag byte is mandatory (minimum length is 1)`);
        }
        // Check if we have the full message
        if (this.buffer.length < 3 + length) {
            return null;
        }
        // Read flag byte
        const flag = this.buffer[3];
        const terminal = (flag & 0x80) !== 0;
        const compressionBits = (flag & 0x60) >> 5;
        let compression;
        switch (compressionBits) {
            case 0:
                compression = "none";
                break;
            case 1:
                compression = "zstd";
                break;
            case 2:
                compression = "gzip";
                break;
            default:
                throw new Error("unknown compression algorithm");
        }
        // Extract body (length includes flag byte, so body is length - 1 bytes)
        let body = this.buffer.slice(4, 4 + length - 1);
        let statusCode;
        // For terminal frames, check for status code
        if (terminal) {
            if (body.length < STATUS_CODE_SIZE) {
                throw new Error("terminal message missing status code");
            }
            statusCode = (body[0] << 8) | body[1];
            body = body.slice(STATUS_CODE_SIZE);
        }
        // Remove parsed frame from buffer
        this.buffer = this.buffer.slice(3 + length);
        return {
            terminal,
            compression,
            body,
            statusCode,
        };
    }
    /**
     * Check if parser has any buffered data
     */
    hasData() {
        return this.buffer.length > 0;
    }
}
exports.S2SFrameParser = S2SFrameParser;
//# sourceMappingURL=framing.js.map