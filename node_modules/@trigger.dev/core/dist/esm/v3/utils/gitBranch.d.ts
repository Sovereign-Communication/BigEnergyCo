/**
 * The sentinel branch name the CLI/SDK sends for a `trigger dev` session that
 * isn't targeting a named dev branch. On the server the "root" development
 * environment is stored with `branchName: null`, so this value never matches a
 * real row — call sites translate it to "no branch" via {@link isDefaultDevBranch}.
 *
 * It's a wire value: any client (the CLI, a custom frontend) can send it in the
 * `x-trigger-branch` header, so the server must always interpret it, never
 * assume the CLI stripped it.
 */
export declare const DEFAULT_DEV_BRANCH = "default";
/**
 * Whether a branch name is the {@link DEFAULT_DEV_BRANCH} sentinel, i.e. it
 * refers to the root development environment rather than a named dev branch.
 */
export declare function isDefaultDevBranch(branchName: string | null | undefined): boolean;
export declare function isValidGitBranchName(branch: string): boolean;
export declare function sanitizeBranchName(ref: string | null | undefined): string | null;
