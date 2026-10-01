// Plan §8 P0.4, quality axis: the dead-code and duplication instrument the
// quality facet line is worded from ("dead-code/duplication scan").
//
// What these tests hold in place:
//   • the under-report rule — a name mentioned anywhere outside its own module
//     counts as used, so a green gate cannot fail a live symbol;
//   • the declaration filter — import/export skeletons are not logic, so two
//     modules importing the same helpers are never reported as duplication;
//   • the shape of a finding — dead definition vs. live-locally-but-dead-export,
//     and one region per duplicated block rather than one per shared window;
//   • the honest hole — default exports are counted UNMEASURED, never clean;
//   • the repository itself: the real gate runs green on this tree, so the
//     clause the judge reads ("...scan") cannot describe a run that would fail.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  analyzeHygiene,
  collectExports,
  normalizeLogicLines,
  stripJsComments,
} from "../scripts/lib/code-hygiene.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** A corpus of one module plus its consumers. */
function tree(modules, others = {}) {
  const corpus = new Map([
    ...Object.entries(modules),
    ...Object.entries(others),
  ]);
  return {
    modules: new Map(Object.entries(modules)),
    corpus,
  };
}

test("HYGIENE: a clean tree measures clean", () => {
  const { modules, corpus } = tree(
    {
      "a.js": `export function used() {\n  return 1;\n}\n`,
    },
    {
      "b.js": `import { used } from "./a.js";\nconsole.log(used());\n`,
    },
  );
  const r = analyzeHygiene({ modules, corpus });
  assert.equal(r.ok, true);
  assert.equal(r.counts.unreferenced_exports, 0);
  assert.equal(r.counts.dead_files, 0);
  assert.equal(r.counts.dup_regions, 0);
  assert.ok(r.counts.exports_checked >= 1);
});

test("HYGIENE: a name mentioned only at its own declaration is a dead definition", () => {
  const { modules, corpus } = tree(
    {
      "a.js": `export const NEVER_USED = 42;\nexport const USED = 1;\n`,
    },
    {
      "b.js": `import { USED } from "./a.js";\n`,
    },
  );
  const r = analyzeHygiene({ modules, corpus });
  assert.equal(r.ok, false);
  assert.deepEqual(r.unreferenced_exports, [
    { module: "a.js", name: "NEVER_USED", used_locally: false },
  ]);
  assert.ok(
    !r.unreferenced_exports.some((e) => e.name === "USED"),
    "an export another file imports is not dead",
  );
});

test("HYGIENE: a locally used export with no outside consumer is reported as such", () => {
  const { modules, corpus } = tree({
    "a.js": `const helper = 1;\nexport function wrapper() {\n  return helper;\n}\nwrapper();\n`,
  });
  const r = analyzeHygiene({ modules, corpus });
  assert.equal(r.ok, false);
  assert.deepEqual(r.unreferenced_exports, [
    { module: "a.js", name: "wrapper", used_locally: true },
  ]);
});

test("HYGIENE: any mention anywhere outside the module counts as use — comments and strings included", () => {
  const { modules, corpus } = tree(
    { "a.js": `export function maybe() {\n  return 1;\n}\n` },
    {
      // Not an import: a comment. The under-report rule still counts it, a
      // false positive would fail a green run on a lie.
      "b.js": `// see maybe() for the old path\n`,
      "c.js": `const name = "maybe";\n`,
      "d.html": `<script type="module">import { maybe } from "./a.js";</script>`,
    },
  );
  const r = analyzeHygiene({ modules, corpus });
  assert.equal(r.ok, true, JSON.stringify(r.unreferenced_exports));
});

test("HYGIENE: default exports are counted unmeasured, never clean", () => {
  const { modules, corpus } = tree(
    { "a.js": `export default function thing() {\n  return 1;\n}\n` },
    { "index.html": `<script type="module" src="./a.js"></script>` },
  );
  const r = analyzeHygiene({ modules, corpus });
  assert.equal(r.counts.default_exports_unmeasured, 1);
  assert.equal(r.counts.exports_checked, 0, "a default has no name to search");
  assert.deepEqual(r.dead_files, [], "the consumer above names the module");
  assert.ok(r.ok, "unmeasured must not read as a finding");
});

test("HYGIENE: collectExports reads the four declaration shapes and the list form", () => {
  assert.deepEqual(
    collectExports(`
export function a() {}
export async function b() {}
export class C {}
export const d = 1;
export const e = 2, f = 3;
export { g, h as i };
export { j } from "./x.js";
export default function() {}
`),
    { names: ["C", "a", "b", "d", "e", "g", "i", "j"], defaults: 1 },
  );
});

test("HYGIENE: import skeletons are declarations, not duplicated logic", () => {
  const sharedImports = `import { alpha, beta, gamma, delta } from "./x.js";\nimport { one, two, three } from "./y.js";\nimport { four, five, six } from "./z.js";\n`;
  const { modules, corpus } = tree({
    "a.js": `${sharedImports}export const a = 1;\n`,
    "b.js": `${sharedImports}export const b = 2;\n`,
  });
  const r = analyzeHygiene({ modules, corpus });
  assert.equal(r.counts.dup_regions, 0, JSON.stringify(r.dup_regions));
  // The same logic, duplicated, IS reported — eight shared non-declaration
  // lines, as ONE region for the pair, not one per overlapping window.
  const block = Array.from(
    { length: 12 },
    (_, i) => `  const v${i} = compute(${i});`,
  ).join("\n");
  const dup = tree({
    "a.js": `export function first() {\n${block}\n  return 1;\n}\n`,
    "b.js": `export function second() {\n${block}\n  return 2;\n}\n`,
  });
  const d = analyzeHygiene(dup);
  assert.equal(d.ok, false);
  assert.equal(d.dup_regions.length, 1, JSON.stringify(d.dup_regions));
  assert.deepEqual(d.dup_regions[0].files, ["a.js", "b.js"]);
  assert.ok(d.dup_regions[0].a_lines.length >= 1);
  assert.equal(
    d.counts.shared_windows >= 8,
    true,
    "windows merge into one region",
  );
});

test("HYGIENE: seven shared lines are below the window and not reported", () => {
  const block = Array.from(
    { length: 7 },
    (_, i) => `  const v${i} = compute(${i});`,
  ).join("\n");
  const { modules, corpus } = tree({
    "a.js": `export function first() {\n${block}\n  return 1;\n}\n`,
    "b.js": `export function second() {\n${block}\n  return 2;\n}\n`,
  });
  const r = analyzeHygiene({ modules, corpus });
  assert.equal(r.counts.dup_regions, 0, JSON.stringify(r.dup_regions));
});

test("HYGIENE: a shipped module nothing else names is a dead file", () => {
  const { modules, corpus } = tree(
    {
      "ghost.js": `export const x = 1;\n`,
      "live.js": `export const y = 2;\n`,
    },
    {
      "index.html": `<script type="module" src="./live.js"></script>`,
    },
  );
  const r = analyzeHygiene({ modules, corpus });
  assert.equal(r.ok, false);
  assert.deepEqual(r.dead_files, ["ghost.js"]);
});

test("HYGIENE: normalizeLogicLines strips comments and the export keyword, keeps the body", () => {
  const src = [
    "// a comment",
    "export function keep() {",
    "  // inner",
    "  return 1; // trailing",
    "}",
    "export { ghost };",
  ].join("\n");
  const lines = normalizeLogicLines(src);
  assert.deepEqual(lines, ["function keep() {", "return 1;", "}"]);
  assert.equal(
    stripJsComments("const u = 'https://x/y' // c"),
    "const u = 'https://x/y' ",
  );
});

test("HYGIENE: the repository itself measures clean — the gate the clause claims", () => {
  // The judge reads "dead-code/duplication scan" as a run that passed. This
  // asserts exactly that against the real tree, so the clause cannot describe
  // a repository the instrument would fail.
  const r = spawnSync(process.execPath, ["scripts/check-code-hygiene.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /OK — dead code and duplication measured/);
});
