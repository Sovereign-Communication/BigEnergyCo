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
exports.parseFrontmatter = parseFrontmatter;
exports.defineSkill = defineSkill;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const v3_1 = require("@trigger.dev/core/v3");
/**
 * Bundled skills are copied to `${cwd}/.trigger/skills/{id}/` by the CLI at
 * build time. At runtime the same layout holds for both `trigger dev` (cwd
 * = dev output dir) and deploy (cwd = /app).
 */
function bundledSkillPath(id) {
    return path.resolve(process.cwd(), ".trigger", "skills", id);
}
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n*/;
/**
 * Parse a minimal YAML-subset frontmatter block. We only support top-level
 * string keys like `name: foo` and `description: bar`. Enough for SKILL.md
 * frontmatter without pulling in a YAML dep.
 */
function parseFrontmatter(content) {
    const match = content.match(FRONTMATTER_RE);
    if (!match || !match[1]) {
        throw new Error("Skill: SKILL.md is missing a frontmatter block. " +
            "Expected `---\\nname: ...\\ndescription: ...\\n---` at the top of the file.");
    }
    const raw = match[1];
    const frontmatter = {};
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#"))
            continue;
        const idx = trimmed.indexOf(":");
        if (idx === -1)
            continue;
        const key = trimmed.slice(0, idx).trim();
        let value = trimmed.slice(idx + 1).trim();
        // Strip surrounding quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (key)
            frontmatter[key] = value;
    }
    if (typeof frontmatter.name !== "string" || !frontmatter.name) {
        throw new Error("Skill: SKILL.md frontmatter is missing required `name` field.");
    }
    if (typeof frontmatter.description !== "string" || !frontmatter.description) {
        throw new Error("Skill: SKILL.md frontmatter is missing required `description` field.");
    }
    const body = content.slice(match[0].length);
    return { frontmatter: frontmatter, body };
}
async function loadLocal(id) {
    const skillPath = bundledSkillPath(id);
    const skillMdPath = path.join(skillPath, "SKILL.md");
    let skillMd;
    try {
        skillMd = await fs.readFile(skillMdPath, "utf8");
    }
    catch (err) {
        throw new Error(`Skill "${id}": could not read SKILL.md at ${skillMdPath}. ` +
            `Skills must be bundled into .trigger/skills/{id}/ — this usually means ` +
            `the CLI build step didn't run, or the skill wasn't registered via ai.defineSkill. ` +
            `Underlying error: ${err.message}`);
    }
    const { frontmatter, body } = parseFrontmatter(skillMd);
    return {
        id,
        version: "local",
        labels: [],
        skillMd,
        frontmatter,
        body,
        path: skillPath,
    };
}
/**
 * Define an agent skill — a developer-authored folder with a `SKILL.md` file
 * plus optional `scripts/`, `references/`, and `assets/` subfolders. Registers
 * the skill with the resource catalog so the Trigger.dev CLI can bundle it
 * into the deploy image automatically (no build extension needed).
 *
 * Call `.local()` on the returned handle to load the bundled SKILL.md at
 * runtime and use it with `chat.skills.set()`.
 *
 * @example
 * ```ts
 * // trigger/skills/pdf-processing/SKILL.md
 * // trigger/skills/pdf-processing/scripts/extract.py
 * import { ai } from "@trigger.dev/sdk";
 *
 * export const pdfSkill = ai.defineSkill({
 *   id: "pdf-processing",
 *   path: "./skills/pdf-processing",
 * });
 *
 * export const agent = chat.agent({
 *   id: "docs",
 *   onChatStart: async () => {
 *     chat.skills.set([await pdfSkill.local()]);
 *   },
 *   run: async ({ messages, signal }) => {
 *     return streamText({
 *       model: openai("gpt-4o"),
 *       messages,
 *       abortSignal: signal,
 *       ...chat.toStreamTextOptions(),
 *     });
 *   },
 * });
 * ```
 */
function defineSkill(options) {
    v3_1.resourceCatalog.registerSkillMetadata({
        id: options.id,
        sourcePath: options.path,
    });
    return {
        id: options.id,
        async local() {
            return loadLocal(options.id);
        },
        async resolve() {
            throw new Error(`Skill "${options.id}": resolve() is not available yet — backend-managed ` +
                `skills ship in Phase 2. Use skill.local() instead.`);
        },
    };
}
//# sourceMappingURL=skill.js.map