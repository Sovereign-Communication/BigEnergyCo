import { MAX_DECOMPRESSED_PAYLOAD_BYTES, MAX_FRAME_PAYLOAD_BYTES, } from "./framing.js";
const nodeZlibSpecifier = "node:zlib";
let zlibModule;
let zlibPromise;
async function loadZlib() {
    if (!zlibPromise) {
        zlibPromise = import(
        /* webpackIgnore: true */
        /* @vite-ignore */
        nodeZlibSpecifier).then((mod) => {
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
export async function assertCompressionSupported(type) {
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
export function acceptEncodingHeader(compression) {
    if (compression === "none") {
        return Promise.resolve(undefined);
    }
    return Promise.resolve(compression);
}
function assertDecompressedPayloadSize(body) {
    if (body.byteLength > MAX_DECOMPRESSED_PAYLOAD_BYTES) {
        throw new Error("payload exceeds decompressed limit");
    }
}
function assertCompressedPayloadSize(body) {
    if (body.byteLength > MAX_FRAME_PAYLOAD_BYTES) {
        throw new Error("compressed payload exceeds frame limit");
    }
}
export async function compressFrameBody(body, type) {
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
export function decompressFrameBody(body, type) {
    switch (type) {
        case "none": {
            assertDecompressedPayloadSize(body);
            return body;
        }
        case "gzip":
            return getLoadedZlib(type).gunzipSync(body, {
                maxOutputLength: MAX_DECOMPRESSED_PAYLOAD_BYTES,
            });
        case "zstd": {
            const z = getLoadedZlib(type);
            if (!z.zstdDecompressSync) {
                throw new Error("zstd decompression requires Node.js v22.15+");
            }
            return z.zstdDecompressSync(body, {
                maxOutputLength: MAX_DECOMPRESSED_PAYLOAD_BYTES,
            });
        }
    }
}
//# sourceMappingURL=compression.js.map