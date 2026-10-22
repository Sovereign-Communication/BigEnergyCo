import { BuildRuntime } from "../schemas/build.js";
export declare const DEFAULT_RUNTIME = "node";
export type DeprecatedConfigRuntime = "experimental-node-24" | "experimental-node-26";
export declare function isDeprecatedConfigRuntime(runtime: unknown): runtime is DeprecatedConfigRuntime;
/** Maps a deprecated runtime alias to the runtime that should be used instead. */
export declare function deprecatedRuntimeReplacement(runtime: DeprecatedConfigRuntime): BuildRuntime;
/** @deprecated Renamed to {@link DeprecatedConfigRuntime}. */
export type ExperimentalConfigRuntime = DeprecatedConfigRuntime;
/** @deprecated Renamed to {@link isDeprecatedConfigRuntime}. */
export declare const isExperimentalConfigRuntime: typeof isDeprecatedConfigRuntime;
export declare function resolveBuildRuntime(runtime: unknown): BuildRuntime;
export declare function binaryForRuntime(runtime: BuildRuntime): string;
export declare function execPathForRuntime(runtime: BuildRuntime): string;
export type ExecOptions = {
    loaderEntryPoint?: string;
    customConditions?: string[];
};
export declare function execOptionsForRuntime(runtime: BuildRuntime, options: ExecOptions, additionalNodeOptions?: string): string;
export declare function detectRuntimeVersion(): string | undefined;
