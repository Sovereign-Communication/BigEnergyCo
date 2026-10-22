"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertCompressionSupported = assertCompressionSupported;
exports.acceptEncodingHeader = acceptEncodingHeader;
exports.compressFrameBody = compressFrameBody;
exports.decompressFrameBody = decompressFrameBody;
const framing_js_1 = require("./framing.js");
const nodeZlibSpecifier = "node:zlib";
let zlibModule;
let zlibPromise;
async function loadZlib() {
    if (!zlibPromise) {
        zlibPromise = Promise.resolve(`${
        /* webpackIgnore: true */
        /* @vite-ignore */
        nodeZlibSpecifier}`).then(s => require(s)).then((mod) => {
            zlibModule = mod;
            return zlibModule;
        });
    }
    return zlibPromise;
}
function getLoadedZlib(type) {
    if (!zlibModule) {
        throw new Error(`received unexpected ${type}-compressed frame: compression was not negotiated`);
    }
    return zlibModule;
}
async function assertCompressionSupported(type) {
    if (type === "none") {
        return;
    }
    const z = await loadZlib();
    if (type === "zstd" && (!z.zstdCompressSync || !z.zstdDecompressSync)) {
        throw new Error("zstd compression requires Node.js v22.15+ (zlib zstd APIs are unavailable in this runtime)");
    }
}
/**
 * Build the `Accept-Encoding` header value advertising algorithms the client
 * can decode. Returns `undefined` when no compression is configured.
 */
function acceptEncodingHeader(compression) {
    if (compression === "none") {
        return Promise.resolve(undefined);
    }
    return Promise.resolve(compression);
}
function assertDecompressedPayloadSize(body) {
    if (body.byteLength > framing_js_1.MAX_DECOMPRESSED_PAYLOAD_BYTES) {
        throw new Error("payload exceeds decompressed limit");
    }
}
function assertCompressedPayloadSize(body) {
    if (body.byteLength > framing_js_1.MAX_FRAME_PAYLOAD_BYTES) {
        throw new Error("compressed payload exceeds frame limit");
    }
}
async function compressFrameBody(body, type) {
    assertDecompressedPayloadSize(body);
    switch (type) {
        case "none":
            return body;
        case "gzip":
            return assertAndReturnCompressed((await loadZlib()).gzipSync(body));
        case "zstd": {
            const z = await loadZlib();
            if (!z.zstdCompressSync) {
                throw new Error("zstd compression requires Node.js v22.15+");
            }
            return assertAndReturnCompressed(z.zstdCompressSync(body));
        }
    }
}
function assertAndReturnCompressed(body) {
    assertCompressedPayloadSize(body);
    return body;
}
function decompressFrameBody(body, type) {
    switch (type) {
        case "none": {
            assertDecompressedPayloadSize(body);
            return body;
        }
        case "gzip":
            return getLoadedZlib(type).gunzipSync(body, {
                maxOutputLength: framing_js_1.MAX_DECOMPRESSED_PAYLOAD_BYTES,
            });
        case "zstd": {
            const z = getLoadedZlib(type);
            if (!z.zstdDecompressSync) {
                throw new Error("zstd decompression requires Node.js v22.15+");
            }
            return z.zstdDecompressSync(body, {
                maxOutputLength: framing_js_1.MAX_DECOMPRESSED_PAYLOAD_BYTES,
            });
        }
    }
}
//# sourceMappingURL=compression.js.map