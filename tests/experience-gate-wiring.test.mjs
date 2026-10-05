// The experience gate is wired into CI and its report is published under a name
// the Jev evidence builder actually downloads.
//
// This is the same shape as tests/resilience-gate-wiring.test.mjs and for the
// same reason: a browser gate nobody ever wired is a gate that reports on one
// developer's machine, and the facet line the judge reads then comes from
// wherever that machine happened to be. The wiring IS the measurement's reach.
//
// It matters MORE here than for the gates around it. The experience facet's
// previous proof line was hand-typed, and a hand-typed line is exactly what a
// derived line replaces: build-jev-evidence.mjs OVERWRITES
// prose.facet_evidence[axis] per axis, so a wired report is the only way the
// judge ever sees a walk instead of a sentence about one.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const yml = readFileSync(".github/workflows/test.yml", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("WIRING: the workflow runs the experience gate", () => {
  assert.match(
    yml,
    /node scripts\/check-experience\.mjs --stage _pages_experience/,
    "the gate must run against the staged allowlisted build",
  );
  assert.match(
    yml,
    /node scripts\/deploy-pages-local\.mjs --check --stage _pages_experience/,
    "the stage it walks must be built from the index, not from a stray " +
      "working-tree edit",
  );
});

test("WIRING: the step is recorded in the job result the judge reads", () => {
  // Without this the step runs, fails, and the job result still reads green for
  // that step — the exact ci_green defect #161 removed.
  assert.match(
    yml,
    /experienceBrowser: "\$\{\{ steps\.experience-browser\.outcome \}\}"/,
    "the step outcome must reach the job record the Jev gate reads",
  );
});

test("WIRING: the report is published under a name the builder downloads", () => {
  // `jev-complete` downloads `jev-results-*`; anything else is an artifact no
  // judge ever sees, which is how the Lighthouse report went unread for a cycle.
  assert.match(
    yml,
    /name: jev-results-experience-report/,
    "the artifact name prefix is the wire",
  );
  assert.match(yml, /jev-artifacts\/experience-report\.json/);
  assert.match(
    yml,
    /--out jev-artifacts\/experience-report\.json/,
    "the gate must write the report the workflow uploads",
  );
  assert.match(
    yml,
    /pattern: jev-results-\*/,
    "the evidence builder's download pattern must still match this artifact",
  );
});

test("WIRING: an unwalked facet is recorded, not skipped", () => {
  // `if: always()` so a browser that cannot start is recorded as unmeasured.
  // Without it, an earlier failure would silently skip the measurement and the
  // facet would arrive with no proof line and no explanation.
  const at = yml.indexOf("- name: First-run journey walk");
  assert.ok(at > 0, "the experience step must exist in the workflow");
  const step = yml.slice(at, at + 500);
  assert.match(step, /if: always\(\)/);
  assert.match(step, /id: experience-browser/);
});

test("WIRING: the upload runs even when the walk fails", () => {
  // The report is how the judge learns the facet is broken. Uploading it only on
  // success would mean a regression deletes its own evidence.
  const at = yml.indexOf("- name: Upload the first-run journey walk");
  assert.ok(at > 0, "the experience artifact upload must exist");
  assert.match(yml.slice(at, at + 300), /if: always\(\)/);
  assert.match(yml.slice(at, at + 300), /if-no-files-found: error/);
});

test("WIRING: package.json exposes the gate as a named script", () => {
  assert.equal(
    pkg.scripts["gate:experience"],
    "node scripts/check-experience.mjs",
  );
  // It needs a browser, so it must NOT be in `npm run seo` — that chain runs
  // without one on every machine and would make the gate unrunnable there.
  assert.doesNotMatch(
    pkg.scripts.seo,
    /check-experience/,
    "a browser gate must not sit in the no-browser gate chain",
  );
});

test("WIRING: the gate claims the axes it composes a line for, and only those", () => {
  // One owner PER AXIS. build-jev-evidence.mjs overwrites
  // prose.facet_evidence[axis] per axis, so a second gate claiming `experience`
  // would not add a proof line, it would delete this one.
  //
  // The gate now claims two axes rather than one, which is a different claim
  // from "two owners": `translation` moved here because the judge's demand for
  // it — "no raw key name reaching a visitor" — is a question about a rendered
  // surface, and only this gate drives a browser. The wiring that must hold is
  // that every declared axis has a line composed FOR it, which is why the
  // builder takes `facet_lines` and refuses one sentence served to two axes.
  const budgets = readFileSync("scripts/lib/experience-budgets.mjs", "utf8");
  assert.match(
    budgets,
    /EXPERIENCE_FACET_AXES = \["experience", "translation"\]/,
  );
  const gate = readFileSync("scripts/check-experience.mjs", "utf8");
  assert.match(
    gate,
    /facet_axes: EXPERIENCE_FACET_AXES/,
    "the report must declare its axes so the builder discovers them",
  );
  assert.match(
    gate,
    /facet_lines/,
    "and must carry a line per axis, or the builder serves one sentence twice",
  );
  assert.match(
    gate,
    /composeTranslationFacetLine/,
    "the translation line must be composed for translation, not reused",
  );
});

test("WIRING: the typed experience line must not survive beside a derived one", () => {
  // The evidence builder OVERWRITES per axis, so a hand-typed line is dead
  // weight — and worse, it is dead weight a reader can mistake for the measured
  // claim if the report fails to arrive. There is a sibling test in
  // jev-derived-facets.test.mjs that asserts the same thing; this one is scoped
  // to the experience cluster so a failure here names the facet without needing
  // the reader to know which sibling file to open.
  const prose = JSON.parse(
    readFileSync("evidence/advisor-and-release.json", "utf8"),
  );
  assert.equal(
    Object.hasOwn(prose.facet_evidence || {}, "experience"),
    false,
    "evidence/advisor-and-release.json still hand-types the experience line; " +
      "the derived line replaces it, and a typed line beside a derived one is a " +
      "number no run can check",
  );
});
