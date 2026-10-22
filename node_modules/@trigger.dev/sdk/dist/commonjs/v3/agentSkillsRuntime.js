"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.readFileInSkill = readFileInSkill;
exports.runBashInSkill = runBashInSkill;
const node_child_process_1 = require("node:child_process");
const fs = __importStar(require("node:fs/promises"));
const nodePath = __importStar(require("node:path"));
/**
 * Server-only runtime for the auto-injected skill tools
 * (`loadSkill` / `readFile` / `bash`) that `chat.agent({ skills })`
 * wires up. Split off from `./ai.ts` so the chat-agent surface in
 * `@trigger.dev/sdk/ai` stays importable from client bundles —
 * Next.js + Webpack reject top-level `node:*` imports anywhere in a
 * client graph, even when a consumer only pulls in types.
 *
 * The SDK's `ai.ts` loads this module via a computed-string dynamic
 * import inside each tool's `execute` — webpack treats the
 * expression as an unknown dependency and skips static tracing, so
 * the node-only symbols here never surface in a client build. The
 * module resolves fine at runtime on a server worker because the
 * relative path (`./agentSkillsRuntime.js`) lands next to `ai.js` in
 * the emitted dist.
 *
 * Public subpath: `@trigger.dev/sdk/ai/skills-runtime`. Customers
 * who want to eagerly bundle the runtime server-side (e.g. warming
 * it on worker bootstrap) can import from there.
 */
const DEFAULT_BASH_OUTPUT_BYTES = 64 * 1024;
const DEFAULT_READ_FILE_BYTES = 1024 * 1024;
function truncate(s, limit) {
    if (s.length <= limit)
        return s;
    return s.slice(0, limit) + `\n…[truncated ${s.length - limit} bytes]`;
}
/**
 * Path-traversal guard: confirm `relative` resolves inside `root`,
 * even after symlinks are followed. Throws if it escapes via `..`, an
 * absolute prefix, or a symlink that points outside. Returns the
 * resolved real path.
 *
 * `fs.realpath` only works on paths that exist, so when the resolved
 * path doesn't exist yet (e.g. writing a new file) we fall back to
 * the lexical check — a non-existent path can't traverse a symlink
 * to escape since the symlink doesn't exist either.
 */
async function safeJoinInside(root, relative) {
    if (nodePath.isAbsolute(relative)) {
        throw new Error(`Path must be relative to the skill directory: ${relative}`);
    }
    const realRoot = await fs.realpath(nodePath.resolve(root));
    const resolved = nodePath.resolve(realRoot, relative);
    let real = resolved;
    try {
        real = await fs.realpath(resolved);
    }
    catch (err) {
        if (err.code !== "ENOENT") {
            throw err;
        }
        // Path doesn't exist yet; fall through with the lexical resolve.
    }
    const normalized = realRoot + nodePath.sep;
    if (real !== realRoot && !real.startsWith(normalized)) {
        throw new Error(`Path escapes the skill directory: ${relative}`);
    }
    return real;
}
async function readFileInSkill({ skillPath, relativePath, }) {
    let absolute;
    try {
        absolute = await safeJoinInside(skillPath, relativePath);
    }
    catch (err) {
        return { error: err.message };
    }
    try {
        const content = await fs.readFile(absolute, "utf8");
        return { content: truncate(content, DEFAULT_READ_FILE_BYTES) };
    }
    catch (err) {
        return { error: err.message };
    }
}
async function runBashInSkill({ skillPath, command, abortSignal, }) {
    return new Promise((resolvePromise) => {
        let child;
        try {
            child = (0, node_child_process_1.spawn)("bash", ["-c", command], {
                cwd: skillPath,
                signal: abortSignal,
            });
        }
        catch (err) {
            resolvePromise({ error: err.message });
            return;
        }
        // Cap stdout/stderr accumulation at the byte budget so an
        // LLM-generated command (`cat /dev/zero`, `yes`) can't OOM the
        // worker. Track total seen length separately so the truncation
        // notice still reports how much was dropped.
        let stdout = "";
        let stderr = "";
        let stdoutSeen = 0;
        let stderrSeen = 0;
        const limit = DEFAULT_BASH_OUTPUT_BYTES;
        child.stdout?.on("data", (chunk) => {
            const text = chunk.toString();
            stdoutSeen += text.length;
            if (stdout.length >= limit)
                return;
            const remaining = limit - stdout.length;
            stdout += text.length > remaining ? text.slice(0, remaining) : text;
        });
        child.stderr?.on("data", (chunk) => {
            const text = chunk.toString();
            stderrSeen += text.length;
            if (stderr.length >= limit)
                return;
            const remaining = limit - stderr.length;
            stderr += text.length > remaining ? text.slice(0, remaining) : text;
        });
        child.once("close", (code) => {
            const stdoutFinal = stdoutSeen > stdout.length
                ? `${stdout}\n…[truncated ${stdoutSeen - stdout.length} bytes]`
                : stdout;
            const stderrFinal = stderrSeen > stderr.length
                ? `${stderr}\n…[truncated ${stderrSeen - stderr.length} bytes]`
                : stderr;
            resolvePromise({
                exitCode: code,
                stdout: stdoutFinal,
                stderr: stderrFinal,
            });
        });
        child.once("error", (err) => {
            resolvePromise({ error: err.message });
        });
    });
}
//# sourceMappingURL=agentSkillsRuntime.js.map