// How a Jev report reads to a person, when the run was scoped.
//
// This is the file's whole reason to exist. `--scope P0.4` decides its exit code
// from four facets; the whole program is twenty-one. The old layout printed the
// whole-program score first under the bare word "score", listed every facet
// below the bar under "blocking", and buried the scoped verdict in the middle —
// so a reader of PR #166's own CI log saw five P2/P4/P5/P8 facets presented as
// the blockers of a P0.4 PR, with nothing in the output saying none of them had
// anything to do with the exit. That is how the accounting went sideways twice,
// while the gate itself was provably right.
//
// So these tests pin the OUTPUT, not the rule (tests/jev-scope.test.mjs pins the
// rule, and now its value). A report that misstates why it failed is worse than
// no report: it teaches the reader to ignore the one line that mattered.
import { test } from "node:test";
import assert from "node:assert/strict";

import { printReport } from "../scripts/lib/jev-report-print.mjs";

const facet = (ordinal, index) => ({
  ordinal,
  index,
  level:
    index === 4
      ? "proven — google-quality, evidenced end to end"
      : "confident — solid with minor gaps",
  source: "live",
});

/** The shape a real report carries: the five P0.3(d) facets at zero. */
const facets = () => ({
  spec: facet(60, 2),
  design: facet(85, 3),
  correctness: facet(85, 3),
  quality: facet(85, 3),
  security: facet(85, 3),
  performance: facet(35, 1),
  accessibility: facet(85, 3),
  i18n: facet(35, 1),
  seo: facet(100, 4),
  resilience: facet(60, 2),
  experience: facet(85, 3),
  docs: facet(85, 3),
  testing: facet(100, 4),
  release: facet(85, 3),
  advisor: facet(60, 2),
  physics: facet(85, 3),
  provenance: facet(0, 0),
  comparison: facet(0, 0),
  usecases: facet(0, 0),
  privacy: facet(0, 0),
  translation: facet(0, 0),
});

const baseReport = () => ({
  target: "fixture @ abc1234",
  score: 87.36,
  min_score: 99,
  pass: false,
  mechanical_score: 100,
  semantic_score: 57.86,
  hard_gates_passed: true,
  hard_gates: { tests_green: true, ci_green: false },
  facets: facets(),
  blocking_facets: [
    "comparison",
    "privacy",
    "provenance",
    "translation",
    "usecases",
  ],
  facets_not_proven: Object.keys(facets()).filter(
    (a) => a !== "seo" && a !== "testing",
  ),
  required_work: [
    {
      bucket: "comparison_gap",
      label: "Path comparison gap",
      work_type: "architecture",
      axis: "comparison",
      primary: false,
      suggested_next_action: "Model all four purchase paths.",
    },
    {
      bucket: "perf_gap",
      label: "Performance gap",
      work_type: "playtest",
      axis: "performance",
      primary: true,
      suggested_next_action: "Run the playtest pass on the real surface.",
    },
  ],
  recommended_actions: {
    architecture: [{ suggested_next_action: "Model all four purchase paths." }],
  },
  blockers: ["blocking facet: comparison", "score 87.36 below target 99.00"],
  live_jev: { provider: "typesafe", is_fallback: false, cost_usd: 0.000003 },
});

const scopedBlock = () => ({
  scope: "P0.4",
  facets: ["accessibility", "performance", "quality", "testing"],
  semantic_score: 76.25,
  score: 92.88,
  min_score: 99,
  bootstrap_applies: false,
  bootstrap_rule: "plan §9 rule 6",
  facets_short_of_proven: ["accessibility", "performance", "quality"],
  exit_rule_binds_from: "P0.4",
  exit_rule_binding: true,
  ratchet: {
    status: "violation",
    baseline_ts: "2026-09-26",
    baseline_ref: "P0.3d-baseline-2",
    facets_compared: 21,
    regressions: [
      { axis: "performance", previous_ordinal: 85, current_ordinal: 35 },
    ],
  },
  pass: false,
});

// The committed implementation's output for `baseReport()`, captured before the
// scoped path was written and compared against it byte for byte. History,
// not a description of the new code: a program-exit report that quietly
// changed shape would be its own kind of regression.
const WHOLE_PROGRAM_GOLDEN = `
=== Jev complete gate: fixture @ abc1234 ===
score: 87.36 / 100  (target 99)  [FAIL]
mechanical: 100  semantic: 57.86
hard gates:
  ✓ tests_green
  ✗ ci_green
facets (21):
  · spec           confident — solid with minor gaps  (ordinal 60, live)
  ✓ design         confident — solid with minor gaps  (ordinal 85, live)
  ✓ correctness    confident — solid with minor gaps  (ordinal 85, live)
  ✓ quality        confident — solid with minor gaps  (ordinal 85, live)
  ✓ security       confident — solid with minor gaps  (ordinal 85, live)
  · performance    confident — solid with minor gaps  (ordinal 35, live)
  ✓ accessibility  confident — solid with minor gaps  (ordinal 85, live)
  · i18n           confident — solid with minor gaps  (ordinal 35, live)
  ✓ seo            proven — google-quality, evidenced end to end  (ordinal 100, live)
  · resilience     confident — solid with minor gaps  (ordinal 60, live)
  ✓ experience     confident — solid with minor gaps  (ordinal 85, live)
  ✓ docs           confident — solid with minor gaps  (ordinal 85, live)
  ✓ testing        proven — google-quality, evidenced end to end  (ordinal 100, live)
  ✓ release        confident — solid with minor gaps  (ordinal 85, live)
  · advisor        confident — solid with minor gaps  (ordinal 60, live)
  ✓ physics        confident — solid with minor gaps  (ordinal 85, live)
  ✗ provenance     confident — solid with minor gaps  (ordinal 0, live)
  ✗ comparison     confident — solid with minor gaps  (ordinal 0, live)
  ✗ usecases       confident — solid with minor gaps  (ordinal 0, live)
  ✗ privacy        confident — solid with minor gaps  (ordinal 0, live)
  ✗ translation    confident — solid with minor gaps  (ordinal 0, live)
blocking: comparison, privacy, provenance, translation, usecases
not proven (19/21): spec, design, correctness, quality, security, performance, accessibility, i18n, resilience, experience, docs, release, advisor, physics, provenance, comparison, usecases, privacy, translation
required work (by severity):
    [comparison_gap] Path comparison gap — architecture
      Model all four purchase paths.
  * [perf_gap] Performance gap — playtest
      Run the playtest pass on the real surface.
recommended actions by work type:
  architecture (1):
    - Model all four purchase paths.
blockers:
  - blocking facet: comparison
  - score 87.36 below target 99.00
live: provider=typesafe fallback=false cost=$0.000003

`;

const render = (report) => {
  let out = "";
  printReport(report, { write: (s) => (out += s) });
  return out;
};
const scopedRender = () => render({ ...baseReport(), scoped: scopedBlock() });

test("PRINT: a scoped run names its scope before it prints any number", () => {
  const text = scopedRender();
  const scopeAt = text.indexOf("scope: P0.4");
  assert.ok(scopeAt > 0, "the scope must be stated");
  // Nothing that reads as a verdict may appear before it.
  for (const earlier of ["score:", "87.36", "92.88", "blocking"]) {
    const at = text.indexOf(earlier);
    assert.ok(
      at === -1 || at > scopeAt,
      `"${earlier}" appears before the scope is named, so it can be read as the verdict`,
    );
  }
  assert.match(text, /THIS RUN'S VERDICT IS THE SCOPED ONE/);
});

test("PRINT: the scoped verdict is printed first, and as the verdict", () => {
  const text = scopedRender();
  const scopedAt = text.indexOf("scoped (P0.4): 92.88 / 100");
  const wholeAt = text.indexOf("whole program (reported only");
  assert.ok(scopedAt > 0, "the scoped verdict must be printed");
  assert.ok(
    scopedAt < wholeAt,
    "the whole-program score must not be printed before the verdict that decided the run",
  );
  assert.match(
    text,
    /scoped \(P0\.4\): 92\.88 \/ 100 {2}\(target 99\) {2}\[FAIL\]/,
  );
});

test("PRINT: it says which facets decided the exit, and which condition failed", () => {
  const text = scopedRender();
  assert.match(text, /decided this run's exit code:/);
  // The four conditions scopedVerdict() actually evaluates, with this
  // report's outcomes. A reader must be able to see the whole conjunction.
  assert.match(text, /✓ hard gates passed/);
  assert.match(text, /✗ ratchet violation/);
  assert.match(text, /✗ score 92\.88 >= 99/);
  assert.match(text, /✗ every in-scope facet proven/);
  assert.match(
    text,
    /short of proven \(3\): accessibility, performance, quality/,
  );
  assert.match(text, /regression: performance 85 -> 35/);
});

test("PRINT: out-of-scope blockers are kept, and labelled out of scope", () => {
  const text = scopedRender();
  // Every one of the five is still named — no information is dropped.
  for (const axis of [
    "comparison",
    "privacy",
    "provenance",
    "translation",
    "usecases",
  ]) {
    assert.match(
      text,
      new RegExp(`\\b${axis}\\b`),
      `${axis} disappeared from the report`,
    );
  }
  assert.match(
    text,
    /blocking, out of P0\.4 scope \(5\): comparison, privacy, provenance, translation, usecases/,
    "the five must be reported as out of scope, not as this run's blockers",
  );
  // And the facet list marks scope per row, so no line can be misread.
  assert.match(
    text,
    /^ {2}✗ comparison\s+confident — solid with minor gaps {2}\(ordinal 0, live\) \[out of scope\]$/m,
  );
  assert.match(
    text,
    /^ {2}✓ quality\s+confident — solid with minor gaps {2}\(ordinal 85, live\) \[in scope\]$/m,
  );
});

test("PRINT: the whole-program numbers survive, labelled as not judged", () => {
  const text = scopedRender();
  assert.match(
    text,
    /whole program \(reported only — NOT this run's exit criterion\): 87\.36 \/ 100/,
  );
  assert.match(text, /mechanical: 100 {2}semantic: 57\.86/);
  assert.match(text, /not proven, whole program \(19\/21\):/);
  // Nothing that used to be printed may go missing.
  for (const gone of [
    /✓ tests_green/,
    /✗ ci_green/,
    /blocking facet: comparison/,
    /score 87\.36 below target 99\.00/,
    /\[comparison_gap\] Path comparison gap/,
    /Model all four purchase paths\./,
    /provider=typesafe fallback=false/,
    /cost=\$0\.000003/,
  ]) {
    assert.match(text, gone, `the report lost ${gone}`);
  }
  // The scope tag rides on the work_type line, so a reader can sort the list.
  assert.match(text, /Path comparison gap — architecture \[out of scope\]/);
  assert.match(text, /Performance gap — playtest \[in scope\]/);
});

test("PRINT: a whole-program run is unchanged, byte for byte", () => {
  // The other half of the promise. P10's program-exit report and P0.3's
  // bootstrap read this output; a scoped fix must not reshape it. The literal
  // below is the committed implementation's output for this fixture, captured
  // before the scoped path was written and compared against it byte for byte —
  // it is history, not a description of the new code.
  const text = render(baseReport());
  assert.equal(text, WHOLE_PROGRAM_GOLDEN);
  // And nothing scoped leaks into it.
  assert.doesNotMatch(text, /scope: P0\.4/);
  assert.doesNotMatch(text, /scoped \(/);
  assert.doesNotMatch(text, /in scope|out of scope/);
});

test("PRINT: a scoped run at a bootstrap item does not list rules that do not bind", () => {
  // P0.3 is exempt from the >= 99 and all-proven rules. Printing them as
  // failures there would be the same lie in a new place.
  const report = {
    ...baseReport(),
    scoped: {
      ...scopedBlock(),
      scope: "P0.3",
      facets: ["correctness", "security", "testing", "docs"],
      score: 91.5,
      exit_rule_binding: false,
      facets_short_of_proven: ["correctness"],
      pass: true,
    },
  };
  const text = render(report);
  assert.match(text, /scope: P0\.3/);
  assert.match(
    text,
    /the >= 99 and all-proven rules do not bind at P0\.3 \(they bind from P0\.4\)/,
  );
  assert.doesNotMatch(text, /✗ score 91\.50/);
  assert.match(text, /✓ hard gates passed/);
});
