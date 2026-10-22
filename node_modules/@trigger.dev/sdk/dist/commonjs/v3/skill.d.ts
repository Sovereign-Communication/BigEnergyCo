/**
 * Parsed `SKILL.md` frontmatter. Only `name` + `description` are required;
 * additional keys are preserved but untyped.
 */
export type SkillFrontmatter = {
    name: string;
    description: string;
    [key: string]: unknown;
};
/**
 * A resolved skill ready to hand to `chat.skills.set()`. Includes the parsed
 * SKILL.md content plus the on-disk path to the bundled skill folder.
 */
export type ResolvedSkill = {
    id: string;
    /** Skill version — `"local"` in Phase 1 until backend-managed overrides land. */
    version: number | "local";
    /** Labels applied to this version — empty in Phase 1. */
    labels: string[];
    /** Full raw `SKILL.md` content (with frontmatter). */
    skillMd: string;
    /** Parsed frontmatter fields. */
    frontmatter: SkillFrontmatter;
    /** Body of SKILL.md with the frontmatter block stripped. */
    body: string;
    /** Absolute path to the bundled skill folder (scripts, references, assets live here). */
    path: string;
};
export type SkillOptions<TIdentifier extends string = string> = {
    id: TIdentifier;
    /** Path to the skill source folder, relative to the project root. */
    path: string;
};
export type SkillHandle<TIdentifier extends string = string> = {
    id: TIdentifier;
    /**
     * Read the bundled `SKILL.md` from disk and return the resolved skill.
     *
     * This is the Phase 1 path — backend-managed overrides are not available
     * yet. Works locally (during `trigger dev`) and in the deploy image.
     */
    local(): Promise<ResolvedSkill>;
    /**
     * Resolve the skill against the dashboard (current/override version).
     *
     * Not available in Phase 1 — throws. Use `local()` until backend-managed
     * skills ship.
     */
    resolve(): Promise<ResolvedSkill>;
};
export type AnySkillHandle = SkillHandle<string>;
/** Extract the id literal type from a SkillHandle. */
export type SkillIdentifier<T extends AnySkillHandle> = T extends SkillHandle<infer TId> ? TId : string;
/**
 * Parse a minimal YAML-subset frontmatter block. We only support top-level
 * string keys like `name: foo` and `description: bar`. Enough for SKILL.md
 * frontmatter without pulling in a YAML dep.
 */
export declare function parseFrontmatter(content: string): {
    frontmatter: SkillFrontmatter;
    body: string;
};
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
export declare function defineSkill<TIdentifier extends string>(options: SkillOptions<TIdentifier>): SkillHandle<TIdentifier>;
