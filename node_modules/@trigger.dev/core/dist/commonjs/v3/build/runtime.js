"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isExperimentalConfigRuntime = exports.DEFAULT_RUNTIME = void 0;
exports.isDeprecatedConfigRuntime = isDeprecatedConfigRuntime;
exports.deprecatedRuntimeReplacement = deprecatedRuntimeReplacement;
exports.resolveBuildRuntime = resolveBuildRuntime;
exports.binaryForRuntime = binaryForRuntime;
exports.execPathForRuntime = execPathForRuntime;
exports.execOptionsForRuntime = execOptionsForRuntime;
exports.detectRuntimeVersion = detectRuntimeVersion;
const node_path_1 = require("node:path");
const url_1 = require("url");
const build_js_1 = require("../schemas/build.js");
const flags_js_1 = require("./flags.js");
const node_os_1 = require("node:os");
exports.DEFAULT_RUNTIME = "node";
function isDeprecatedConfigRuntime(runtime) {
    return runtime === "experimental-node-24" || runtime === "experimental-node-26";
}
/** Maps a deprecated runtime alias to the runtime that should be used instead. */
function deprecatedRuntimeReplacement(runtime) {
    switch (runtime) {
        case "experimental-node-24":
            return "node-24";
        case "experimental-node-26":
            return "node-26";
    }
}
/** @deprecated Renamed to {@link isDeprecatedConfigRuntime}. */
exports.isExperimentalConfigRuntime = isDeprecatedConfigRuntime;
function resolveBuildRuntime(runtime) {
    const parsedRuntime = build_js_1.ConfigRuntime.safeParse(runtime);
    if (!parsedRuntime.success) {
        const value = typeof runtime === "string" ? `"${runtime}"` : String(runtime);
        throw new Error(`Unsupported runtime ${value} in trigger.config. Supported runtimes: ${build_js_1.ConfigRuntime.options.join(", ")}.`);
    }
    switch (parsedRuntime.data) {
        case "experimental-node-24":
            return "node-24";
        case "experimental-node-26":
            return "node-26";
        default:
            return parsedRuntime.data;
    }
}
function binaryForRuntime(runtime) {
    switch (runtime) {
        case "node":
        case "node-22":
        case "node-24":
        case "node-26":
            return "node";
        case "bun":
            return "bun";
        default:
            throw new Error(`Unsupported runtime ${runtime}`);
    }
}
function execPathForRuntime(runtime) {
    switch (runtime) {
        case "node":
        case "node-22":
        case "node-24":
        case "node-26":
            return process.execPath;
        case "bun":
            if (typeof process.env.BUN_INSTALL === "string") {
                return (0, node_path_1.join)(process.env.BUN_INSTALL, "bin", "bun");
            }
            if (typeof process.env.BUN_INSTALL_BIN === "string") {
                return (0, node_path_1.join)(process.env.BUN_INSTALL_BIN, "bun");
            }
            return (0, node_path_1.join)((0, node_os_1.homedir)(), ".bun", "bin", "bun");
        default:
            throw new Error(`Unsupported runtime ${runtime}`);
    }
}
function execOptionsForRuntime(runtime, options, additionalNodeOptions) {
    switch (runtime) {
        case "node":
        case "node-22":
        case "node-24":
        case "node-26": {
            const importEntryPoint = options.loaderEntryPoint
                ? `--import=${(0, url_1.pathToFileURL)(options.loaderEntryPoint).href}`
                : undefined;
            const conditions = options.customConditions?.map((condition) => `--conditions=${condition}`);
            //later flags will win (after the dedupe)
            const flags = [
                process.env.NODE_OPTIONS,
                additionalNodeOptions,
                importEntryPoint,
                conditions,
                nodeRuntimeNeedsGlobalWebCryptoFlag() ? "--experimental-global-webcrypto" : undefined,
            ]
                .filter(Boolean)
                .flat()
                .join(" ");
            return (0, flags_js_1.dedupFlags)(flags);
        }
        case "bun": {
            return "";
        }
    }
}
// Detect if we are using node v18, since we don't support lower than 18, and we only need to enable the flag for v18
function nodeRuntimeNeedsGlobalWebCryptoFlag() {
    try {
        return process.versions.node.startsWith("18.");
    }
    catch {
        return false;
    }
}
function detectRuntimeVersion() {
    try {
        // Check if we're running under Bun
        const isBun = typeof process.versions.bun === "string";
        if (isBun) {
            return process.versions.bun;
        }
        // Otherwise, return Node.js version
        return process.versions.node;
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=runtime.js.map