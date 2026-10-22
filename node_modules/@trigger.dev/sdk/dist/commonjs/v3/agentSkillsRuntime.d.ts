export type BashSkillInput = {
    /** Absolute path to the skill's root (used as `cwd`). */
    skillPath: string;
    /** The bash command to run. */
    command: string;
    /** Optional abort signal forwarded to `spawn()`. */
    abortSignal?: AbortSignal;
};
export type BashSkillResult = {
    exitCode: number | null;
    stdout: string;
    stderr: string;
} | {
    error: string;
};
export type ReadFileInSkillInput = {
    /** Absolute path to the skill's root — the relative path must resolve inside it. */
    skillPath: string;
    /** Relative path the tool caller supplied. */
    relativePath: string;
};
export type ReadFileInSkillResult = {
    content: string;
} | {
    error: string;
};
export declare function readFileInSkill({ skillPath, relativePath, }: ReadFileInSkillInput): Promise<ReadFileInSkillResult>;
export declare function runBashInSkill({ skillPath, command, abortSignal, }: BashSkillInput): Promise<BashSkillResult>;
