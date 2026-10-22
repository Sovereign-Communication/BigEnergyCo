import type { GitMeta } from "../schemas/index.js";
export declare function getBranch({ specified, gitMeta, }: {
    specified?: string;
    gitMeta?: GitMeta;
}): string | undefined;
export declare function getDevBranch({ specified }: {
    specified?: string;
}): string | undefined;
