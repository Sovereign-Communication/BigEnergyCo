/**
 * A single matched asset — source file and its destination inside the
 * build output directory.
 */
export type CopyPair = {
    source: string;
    destination: string;
};
/**
 * Result of a single matcher's glob, grouped with the matcher that
 * produced it so callers can warn on empty matches.
 */
export type MatcherResult = {
    matcher: string;
    assets: CopyPair[];
};
/**
 * Glob a set of matchers relative to `cwd` and return pairs describing
 * where each matched file should be copied to under `destinationDir`.
 *
 * Relative paths are preserved under `destinationDir`. Leading `..`
 * segments (from `../shared/file.txt` style patterns) are stripped so
 * files always land inside the destination.
 */
export declare function findFilesByMatchers(matchers: string[], destinationDir: string, options?: {
    cwd?: string;
    ignore?: string[];
}): Promise<MatcherResult[]>;
/**
 * Copy a single file, creating parent directories as needed.
 */
export declare function copyFileEnsuringDir(source: string, destination: string): Promise<void>;
/**
 * Copy every pair in the given matcher results. Parent directories are
 * created automatically. Returns the total number of files copied.
 */
export declare function copyMatcherResults(matcherResults: MatcherResult[], onCopy?: (pair: CopyPair) => void): Promise<number>;
/**
 * Recursively copy a directory to another location. Preserves structure;
 * overwrites existing files at the destination.
 *
 * Used by the built-in skill bundler — we copy entire skill folders as a
 * unit, not file-by-file.
 */
export declare function copyDirectoryRecursive(source: string, destination: string): Promise<void>;
