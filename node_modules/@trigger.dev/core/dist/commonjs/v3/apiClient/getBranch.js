"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBranch = getBranch;
exports.getDevBranch = getDevBranch;
const getEnv_js_1 = require("../utils/getEnv.js");
const gitBranch_js_1 = require("../utils/gitBranch.js");
function getBranch({ specified, gitMeta, }) {
    if (specified) {
        return specified;
    }
    // not specified, so detect our variable from process.env
    const envVar = (0, getEnv_js_1.getEnvVar)("TRIGGER_PREVIEW_BRANCH");
    if (envVar) {
        return envVar;
    }
    // detect the Vercel preview branch
    const vercelPreviewBranch = (0, getEnv_js_1.getEnvVar)("VERCEL_GIT_COMMIT_REF");
    if (vercelPreviewBranch) {
        return vercelPreviewBranch;
    }
    // not specified, so detect from git metadata
    if (gitMeta?.commitRef) {
        return gitMeta.commitRef;
    }
    return undefined;
}
function getDevBranch({ specified }) {
    // For development we don't look at git/Vercel — only the flag and our env var.
    const branch = specified ?? (0, getEnv_js_1.getEnvVar)("TRIGGER_DEV_BRANCH");
    // No branch and the "default" sentinel both mean the root dev env, which
    // carries no branch. Collapse to undefined so callers send no branch
    if (!branch || (0, gitBranch_js_1.isDefaultDevBranch)(branch)) {
        return undefined;
    }
    return branch;
}
//# sourceMappingURL=getBranch.js.map