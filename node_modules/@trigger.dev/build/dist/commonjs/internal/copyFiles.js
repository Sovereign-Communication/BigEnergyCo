"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findFilesByMatchers = findFilesByMatchers;
exports.copyFileEnsuringDir = copyFileEnsuringDir;
exports.copyMatcherResults = copyMatcherResults;
exports.copyDirectoryRecursive = copyDirectoryRecursive;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const tinyglobby_1 = require("tinyglobby");
/**
 * Glob a set of matchers relative to `cwd` and return pairs describing
 * where each matched file should be copied to under `destinationDir`.
 *
 * Relative paths are preserved under `destinationDir`. Leading `..`
 * segments (from `../shared/file.txt` style patterns) are stripped so
 * files always land inside the destination.
 */
async function findFilesByMatchers(matchers, destinationDir, options) {
    const result = [];
    const cwd = options?.cwd ?? process.cwd();
    for (const matcher of matchers) {
        const files = await (0, tinyglobby_1.glob)({
            patterns: [matcher],
            cwd,
            ignore: options?.ignore ?? [],
            onlyFiles: true,
            absolute: true,
        });
        const assets = files.map((file) => {
            const pathInsideDestinationDir = (0, node_path_1.relative)(cwd, file)
                .split(node_path_1.posix.sep)
                .filter((p) => p !== "..")
                .join(node_path_1.posix.sep);
            return {
                source: file,
                destination: (0, node_path_1.join)(destinationDir, pathInsideDestinationDir),
            };
        });
        result.push({ matcher, assets });
    }
    return result;
}
/**
 * Copy a single file, creating parent directories as needed.
 */
async function copyFileEnsuringDir(source, destination) {
    await (0, promises_1.mkdir)((0, node_path_1.dirname)(destination), { recursive: true });
    await (0, promises_1.copyFile)(source, destination);
}
/**
 * Copy every pair in the given matcher results. Parent directories are
 * created automatically. Returns the total number of files copied.
 */
async function copyMatcherResults(matcherResults, onCopy) {
    let count = 0;
    for (const { assets } of matcherResults) {
        for (const pair of assets) {
            onCopy?.(pair);
            await copyFileEnsuringDir(pair.source, pair.destination);
            count++;
        }
    }
    return count;
}
/**
 * Recursively copy a directory to another location. Preserves structure;
 * overwrites existing files at the destination.
 *
 * Used by the built-in skill bundler — we copy entire skill folders as a
 * unit, not file-by-file.
 */
async function copyDirectoryRecursive(source, destination) {
    await (0, promises_1.mkdir)(destination, { recursive: true });
    await (0, promises_1.cp)(source, destination, { recursive: true, force: true });
}
//# sourceMappingURL=copyFiles.js.map