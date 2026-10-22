import { cp, copyFile, mkdir } from "node:fs/promises";
import { dirname, join, posix, relative } from "node:path";
import { glob } from "tinyglobby";
/**
 * Glob a set of matchers relative to `cwd` and return pairs describing
 * where each matched file should be copied to under `destinationDir`.
 *
 * Relative paths are preserved under `destinationDir`. Leading `..`
 * segments (from `../shared/file.txt` style patterns) are stripped so
 * files always land inside the destination.
 */
export async function findFilesByMatchers(matchers, destinationDir, options) {
    const result = [];
    const cwd = options?.cwd ?? process.cwd();
    for (const matcher of matchers) {
        const files = await glob({
            patterns: [matcher],
            cwd,
            ignore: options?.ignore ?? [],
            onlyFiles: true,
            absolute: true,
        });
        const assets = files.map((file) => {
            const pathInsideDestinationDir = relative(cwd, file)
                .split(posix.sep)
                .filter((p) => p !== "..")
                .join(posix.sep);
            return {
                source: file,
                destination: join(destinationDir, pathInsideDestinationDir),
            };
        });
        result.push({ matcher, assets });
    }
    return result;
}
/**
 * Copy a single file, creating parent directories as needed.
 */
export async function copyFileEnsuringDir(source, destination) {
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
}
/**
 * Copy every pair in the given matcher results. Parent directories are
 * created automatically. Returns the total number of files copied.
 */
export async function copyMatcherResults(matcherResults, onCopy) {
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
export async function copyDirectoryRecursive(source, destination) {
    await mkdir(destination, { recursive: true });
    await cp(source, destination, { recursive: true, force: true });
}
//# sourceMappingURL=copyFiles.js.map