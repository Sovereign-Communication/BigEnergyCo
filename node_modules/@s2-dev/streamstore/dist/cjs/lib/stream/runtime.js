"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_USER_AGENT = exports.VERSION = void 0;
exports.detectRuntime = detectRuntime;
exports.supportsHttp2 = supportsHttp2;
exports.canSetUserAgentHeader = canSetUserAgentHeader;
const version_js_1 = require("../../version.js");
Object.defineProperty(exports, "VERSION", { enumerable: true, get: function () { return version_js_1.VERSION; } });
/**
 * Detect the current JavaScript runtime
 */
function detectRuntime() {
    // Check for Deno
    // @ts-expect-error - Deno global not in types
    if (typeof Deno !== "undefined") {
        return "deno";
    }
    // Check for Bun
    if (typeof Bun !== "undefined") {
        return "bun";
    }
    // Check for Cloudflare Workers
    // @ts-expect-error - WebSocketPair global is not in types
    if (typeof WebSocketPair !== "undefined") {
        return "workerd";
    }
    // Check for Node.js
    if (typeof process !== "undefined" && process.versions?.node !== undefined) {
        return "node";
    }
    // Check for browser
    if (typeof window !== "undefined" && typeof document !== "undefined") {
        return "browser";
    }
    return "unknown";
}
/**
 * Check if the current runtime supports HTTP/2 for s2s protocol
 */
function supportsHttp2() {
    const runtime = detectRuntime();
    switch (runtime) {
        case "node":
            return true;
        case "deno":
            // Deno < 2.7.5 not supported
            // @ts-expect-error - Deno global not in types
            return versionAtLeast(Deno.version?.deno, "2.7.5");
        case "bun":
            // Bun < 1.3.11 never sends connection-level WINDOW_UPDATE frames, so
            // HTTP/2 reads stall at 64 KiB (issue #113, fixed by oven-sh/bun#26917).
            return Bun.semver.satisfies(Bun.version, ">=1.3.11");
        case "browser":
        case "workerd":
            // Browsers and workerd don't support raw HTTP/2
            return false;
        default:
            return false;
    }
}
function versionAtLeast(version, minimum) {
    if (!version)
        return false;
    const [core, prerelease] = version.split("-");
    const actual = core?.split(".").map(Number) ?? [];
    const wanted = minimum.split(".").map(Number);
    for (let i = 0; i < wanted.length; i++) {
        const a = actual[i] ?? 0;
        const b = wanted[i] ?? 0;
        if (Number.isNaN(a))
            return false;
        if (a !== b)
            return a > b;
    }
    // A prerelease (e.g. 2.7.5-rc.1) precedes its stable release.
    return prerelease === undefined;
}
/**
 * Check if the current runtime allows setting a custom User-Agent header.
 *
 * Only browsers enforce the Fetch spec's "forbidden header name" restriction
 * that prevents setting User-Agent. All server-side runtimes (Node, Bun,
 * Deno, Cloudflare Workers, etc.) allow it.
 */
function canSetUserAgentHeader(runtime) {
    const rt = runtime ?? detectRuntime();
    return rt !== "browser";
}
exports.DEFAULT_USER_AGENT = `s2-sdk-typescript/${version_js_1.VERSION}`;
//# sourceMappingURL=runtime.js.map