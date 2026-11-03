// Plan §8 P0.4, quality axis: DEAD CODE AND DUPLICATION, MEASURED.
//
// Why this exists. The quality facet line ends with the sentence
// "Beyond them, dead code or duplication is unmeasured" — an honest hole
// printed every run, because nothing in the repository measured those two
// facts. The pack asks this axis for "no unnecessary lines, branches,
// abstractions, dead scaffolding, or duplicated logic", and two of those —
// dead scaffolding and duplicated logic — are text facts about the tree this
// gate can read directly. This module is that reading; the CLI
// (scripts/check-code-hygiene.mjs) runs it in the `test` job, so its verdict
// travels on the same records the clarity clause is worded from.
//
// Three rules the analysis is built to honor, because each is a way a hygiene
// gate can lie:
//
//   1. UNDER-REPORT, NEVER OVER-REPORT. A name is only declared dead when it
//      appears in no other tracked source file at all — the token search runs
//      over comments, strings, tests, scripts and HTML alike, so any plausible
//      consumer counts as use. False negatives (dead code we miss) are a hole
//      to close later; a false positive would fail a green run on a lie.
//   2. DECLARATIONS ARE NOT LOGIC. Import/export statements are stripped
//      before duplicate detection: two modules importing the same helpers is
//      every module's required skeleton, not duplicated logic, and reporting
//      it would train everyone to ignore the gate.
//   3. DEFAULT EXPORTS ARE UNMEASURED, STATED. `import x from` consumes a
//      binding by position, so name-based analysis cannot see it. They are
//      counted in the report as unmeasured rather than silently checked off.
//
// No I/O here: the CLI supplies the file maps, the tests supply fixtures.
import { createHash } from "node:crypto";

// A duplicate must be a BLOCK worth sharing: eight consecutive non-declaration
// lines. Shorter windows match by coincidence (braces, guards, one-liners);
// longer ones miss refactored twins that differ at the edges.
export const HYGIENE_WINDOW_LINES = 8;

/**
 * Remove `//` and `/* *\/` comments. The `//` rule skips a `//` that follows
 * a colon, so protocol separators in strings ("https://…") survive — the same
 * rule scripts/lib/byte-budgets.mjs uses before walking imports, so both
 * instruments see the same source.
 */
export function stripJsComments(src) {
  return String(src)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * Every bound name a module exports, plus a count of default exports (which
 * name-based analysis cannot follow, and which the report must call
 * unmeasured rather than clean).
 */
export function collectExports(src) {
  const s = stripJsComments(src);
  const names = new Set();
  for (const re of [
    /(?:^|\n)\s*export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
    /(?:^|\n)\s*export\s+class\s+([A-Za-z_$][\w$]*)/g,
    /(?:^|\n)\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
    /(?:^|\n)\s*export\s*\*\s*as\s+([A-Za-z_$][\w$]*)\s+from/g,
  ]) {
    for (const m of s.matchAll(re)) names.add(m[1]);
  }
  for (const m of s.matchAll(/(?:^|\n)\s*export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(",")) {
      const item = part.trim();
      if (!item) continue;
      // `a as b` publishes b under the name b; a plain `a` publishes a.
      const as = /\bas\s+([A-Za-z_$][\w$]*)$/.exec(item);
      const exported = as ? as[1] : item;
      if (exported === "default") continue;
      if (!/^[A-Za-z_$][\w$]*$/.test(exported)) continue;
      names.add(exported);
    }
  }
  const defaults = (s.match(/(?:^|\n)\s*export\s+default\b/g) || []).length;
  return { names: [...names].sort(), defaults };
}

/**
 * The module's LOGIC lines, ready for windowing: comments stripped,
 * import statements and `export { … }` / `export * from` lists removed
 * (declarations, not logic), the `export` keyword dropped from real
 * declarations so the declaration itself stays in the text, trimmed and
 * blank lines dropped.
 */
export function normalizeLogicLines(src) {
  let s = stripJsComments(src);
  // `import { … } from "x"` (possibly multi-line) and `import "x"`. The lazy
  // clause stops at the first from-clause + specifier, so it cannot run past
  // the statement; the repository is prettier-formatted, so every statement
  // after it carries the semicolon the pattern expects to find or skip.
  s = s.replace(/(^|\n)[ \t]*import\s[^;]*?from\s*["'][^"']+["']\s*;?/g, "$1");
  s = s.replace(/(^|\n)[ \t]*import\s*["'][^"']+["']\s*;?/g, "$1");
  s = s.replace(/(^|\n)[ \t]*export\s*\{[\s\S]*?\}\s*;?/g, "$1");
  s = s.replace(
    /(^|\n)[ \t]*export\s*\*\s*(?:as\s+[A-Za-z_$][\w$]*\s+)?from\s*["'][^"']+["']\s*;?/g,
    "$1",
  );
  // Keep the declaration, drop only the keyword: an exported function's BODY
  // is logic and may well be duplicated.
  s = s.replace(
    /(^|\n)([ \t]*)export\s+(?=(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\b)/g,
    "$1$2",
  );
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** Every identifier-looking token in a source, comments and strings included. */
export function wordTokens(src) {
  const set = new Set();
  for (const m of String(src).matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
    set.add(m[0]);
  }
  return set;
}

function windowHash(text) {
  return createHash("sha1").update(text).digest("hex").slice(0, 16);
}

/**
 * Merge all shared windows of one FILE PAIR into a single region entry:
 * consecutive or overlapping windows are the same duplicated block, not n
 * findings, and two blocks in the same pair are two ranges on one entry.
 */
function mergePairEntries(pairHits) {
  return [...pairHits.values()].map((e) => ({
    files: e.files,
    a_lines: mergeRanges(e.a_lines),
    b_lines: mergeRanges(e.b_lines),
  }));
}

function mergeRanges(nums) {
  const sorted = [...new Set(nums)].sort((x, y) => x - y);
  const out = [];
  for (const n of sorted) {
    const last = out[out.length - 1];
    if (last && n <= last[1] + 1) last[1] = Math.max(last[1], n);
    else out.push([n, n]);
  }
  return out;
}

/**
 * The whole reading.
 *
 * @param modules  Map<relPath, source> — the shipped JS every claim is about.
 * @param corpus   Map<relPath, source> — every tracked source that may consume
 *                 a name (superset of `modules`: tests, scripts, HTML).
 * @returns a plain report: counts, the findings, and `ok` (nothing found).
 */
export function analyzeHygiene({ modules, corpus }) {
  const tokenSets = new Map();
  for (const [rel, src] of corpus) tokenSets.set(rel, wordTokens(src));

  // ── dead files: a shipped module no other tracked file names at all ──────
  const deadFiles = [];
  for (const rel of modules.keys()) {
    const base = rel.split("/").pop();
    let referenced = false;
    for (const [other, src] of corpus) {
      if (other === rel) continue;
      if (String(src).includes(base)) {
        referenced = true;
        break;
      }
    }
    if (!referenced) deadFiles.push(rel);
  }

  // ── unreferenced exports: published names no other file ever mentions ────
  const unreferencedExports = [];
  let exportsChecked = 0;
  let defaultExportsUnmeasured = 0;
  for (const [rel, src] of modules) {
    const { names, defaults } = collectExports(src);
    defaultExportsUnmeasured += defaults;
    for (const name of names) {
      exportsChecked += 1;
      let used = false;
      for (const [other, set] of tokenSets) {
        if (other === rel) continue;
        if (set.has(name)) {
          used = true;
          break;
        }
      }
      if (used) continue;
      // A name the module mentions only at its own declaration is dead code;
      // one it still uses locally is a live symbol with a dead `export`. The
      // distinction is what makes the finding actionable without re-reading
      // every file.
      const own = (String(src).match(new RegExp(`\\b${name}\\b`, "g")) || [])
        .length;
      unreferencedExports.push({ module: rel, name, used_locally: own > 1 });
    }
  }

  // ── duplicated logic: eight shared non-declaration lines, two modules ────
  const windowsByHash = new Map();
  let logicLines = 0;
  for (const [rel, src] of modules) {
    const lines = normalizeLogicLines(src);
    logicLines += lines.length;
    for (let i = 0; i + HYGIENE_WINDOW_LINES <= lines.length; i += 1) {
      const text = lines.slice(i, i + HYGIENE_WINDOW_LINES).join("\n");
      const h = windowHash(text);
      if (!windowsByHash.has(h)) windowsByHash.set(h, []);
      windowsByHash.get(h).push({ rel, line: i + 1 });
    }
  }
  // Group by FILE PAIR across every shared hash, then merge each side's line
  // ranges: one duplicated block produces many overlapping windows, and they
  // are one finding, not one per window.
  const pairHits = new Map();
  let sharedWindows = 0;
  for (const hits of windowsByHash.values()) {
    const rels = [...new Set(hits.map((h) => h.rel))].sort();
    if (rels.length < 2) continue;
    sharedWindows += hits.length;
    for (let i = 0; i < rels.length; i += 1) {
      for (let j = i + 1; j < rels.length; j += 1) {
        const key = `${rels[i]}\u0000${rels[j]}`;
        if (!pairHits.has(key)) {
          pairHits.set(key, {
            files: [rels[i], rels[j]],
            a_lines: [],
            b_lines: [],
          });
        }
        const entry = pairHits.get(key);
        for (const h of hits) {
          if (h.rel === rels[i]) entry.a_lines.push(h.line);
          else if (h.rel === rels[j]) entry.b_lines.push(h.line);
        }
      }
    }
  }
  const dupRegions = mergePairEntries(pairHits);

  return {
    ok:
      deadFiles.length === 0 &&
      unreferencedExports.length === 0 &&
      dupRegions.length === 0,
    counts: {
      modules_scanned: modules.size,
      exports_checked: exportsChecked,
      default_exports_unmeasured: defaultExportsUnmeasured,
      dead_files: deadFiles.length,
      unreferenced_exports: unreferencedExports.length,
      dup_regions: dupRegions.length,
      shared_windows: sharedWindows,
      logic_lines: logicLines,
    },
    dead_files: deadFiles,
    unreferenced_exports: unreferencedExports,
    dup_regions: dupRegions,
  };
}
