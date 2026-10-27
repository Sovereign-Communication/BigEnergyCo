// Master plan P0.3(c) / §13.3: the gate must reach 99, program exit must require
// every facet `proven`, and a scoped run must judge an item's own facets
// against the same bar while failing on any facet that dropped below its last
// ledger level.
//
// The ratchet is the part worth testing hardest: it is the clause that stops
// "scope it narrowly enough" from becoming a way to hide a regression elsewhere.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  COMPLETE_MIN_SCORE,
  COMPLETE_EXIT_FACET_INDEX,
  SCOPE_FACETS,
  resolveScopeFacets,
  readRatchetBaseline,
  checkRatchet,
  loadCompletePack,
  scoreCompleteGate,
  planItemAtLeast,
  COMPLETE_EXIT_RULE_FROM,
} from "../scripts/lib/jev-complete.mjs";
import { scopedVerdict } from "../scripts/lib/jev-verdict.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLAN = readFileSync(join(ROOT, "docs/plan/MASTER_PLAN.md"), "utf8");
const pack = loadCompletePack(ROOT);

const facet = (ordinal) => ({ ordinal, index: ordinal, level: `l${ordinal}` });

test("GATE: the target is 99, not 95 (D-03, finding F-37)", () => {
  assert.equal(COMPLETE_MIN_SCORE, 99.0);
  assert.notEqual(COMPLETE_MIN_SCORE, 95.0);
});

test("GATE: program exit is defined as every facet at the top level", () => {
  assert.equal(COMPLETE_EXIT_FACET_INDEX, 4);
  assert.equal(pack.sentiment.ordinals[COMPLETE_EXIT_FACET_INDEX], 100);
  assert.equal(
    pack.sentiment.levels[COMPLETE_EXIT_FACET_INDEX].startsWith("proven"),
    true,
  );
});

test("GATE: a whole-program run fails while any facet is short of proven", () => {
  // One facet at 85 keeps the mean high but must still fail the exit rule.
  // Hard gates read straight off the evidence object, so they must all be set
  // for the mechanical half to be 100 — otherwise this would pass for the
  // wrong reason and prove nothing.
  const ev = Object.fromEntries(
    [
      "tests_green",
      "smoke_green",
      "ci_green",
      "legacy_gates_green",
      "prettier_clean",
      "seo_green",
      "secrets_clean",
      "tree_clean",
    ].map((k) => [k, true]),
  );
  const levels = Object.fromEntries(Object.keys(pack.axes).map((a) => [a, 4]));
  levels.release = 3; // one facet a step below proven
  const r = scoreCompleteGate(ev, {
    pack,
    liveJudgment: { live_levels: levels },
  });
  assert.equal(r.hard_gates_passed, true, "every hard gate is green");
  assert.equal(r.mechanical_score, 100);
  assert.equal(
    r.facets.release.ordinal,
    85,
    "release is a step below proven, which is the level its code fact feeds it",
  );
  assert.equal(
    r.score >= COMPLETE_MIN_SCORE,
    true,
    "the mean is high enough to clear 99 on its own",
  );
  assert.equal(r.pass, false, "but the exit rule still fails the run");
  assert.deepEqual(
    r.facets_not_proven,
    ["release"],
    "and it names exactly the facet that is short",
  );
});

test("GATE: every plan item has a scope, and no scope names an unknown axis", () => {
  const inPlan = new Set(PLAN.match(/P\d+\.\d+/g) || []);
  const known = new Set(Object.keys(pack.axes));
  for (const id of inPlan) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(SCOPE_FACETS, id),
      `plan item ${id} has no SCOPE_FACETS entry — a new item must declare ` +
        `its facets, not silently fall back to the whole-program run`,
    );
  }
  for (const [id, axes] of Object.entries(SCOPE_FACETS)) {
    assert.ok(axes.length > 0, `${id} must judge at least one facet`);
    for (const a of axes) {
      assert.ok(known.has(a), `${id} names axis "${a}" the pack does not have`);
    }
  }
  // The other direction too: a scope for an item the plan does not contain is
  // dead configuration that will never be exercised.
  for (const id of Object.keys(SCOPE_FACETS)) {
    assert.ok(
      inPlan.has(id),
      `SCOPE_FACETS has ${id}, which the plan never lists`,
    );
  }
});

test("GATE: a known scope resolves, an unknown one throws rather than widening", () => {
  assert.deepEqual(resolveScopeFacets("P0.3", pack), [
    "correctness",
    "docs",
    "security",
    "testing",
  ]);
  assert.equal(
    resolveScopeFacets(null, pack),
    null,
    "no scope = whole program",
  );
  assert.throws(() => resolveScopeFacets("P9.9", pack), /unknown --scope/);
  // P0.3 owns four axes; a pack missing one must be rejected rather than
  // silently scored against a partial set.
  assert.throws(
    () =>
      resolveScopeFacets("P0.3", {
        axes: { correctness: {}, security: {}, testing: {} },
      }),
    /axes the pack does not have/,
    "a scope naming a missing axis must throw",
  );
});

const LEDGER_WITH = JSON.stringify({
  ts: "2026-09-26",
  kind: "item-done",
  ref: "P0.3c",
  evidence: {
    jev: {
      facet_ordinals: { release: 85, physics: 100, testing: 100 },
      baseline_advance: { reason: "declared baseline for the ratchet" },
    },
  },
});
// A row that merely records a run: it carries levels but does NOT declare a
// baseline, so it must never become one.
const LEDGER_UNDECLARED = JSON.stringify({
  ts: "2026-09-26",
  kind: "item-done",
  ref: "P0.3d",
  evidence: { jev: { facet_ordinals: { release: 100, physics: 100 } } },
});
const LEDGER_WITHOUT = JSON.stringify({
  ts: "2026-09-26",
  kind: "note",
  ref: "x",
});

test("GATE: the ratchet reads the last DECLARED baseline, not the last run row", () => {
  const b = readRatchetBaseline(LEDGER_WITH, pack);
  assert.equal(b.status, "active");
  assert.equal(b.ordinals.release, 85);
  // A later row without facet_ordinals must not erase an earlier baseline.
  const later = `${LEDGER_WITHOUT}\n${LEDGER_WITH}\n${LEDGER_WITHOUT}`;
  assert.equal(readRatchetBaseline(later, pack).status, "active");
});

test("GATE: an undeclared run row can never become the ratchet baseline", () => {
  // The loophole this closes: any ordinary ledger append used to reset the
  // ratchet by carrying facet_ordinals, so a run could clear a real drop by
  // writing down new numbers.
  const b = readRatchetBaseline(`${LEDGER_WITH}\n${LEDGER_UNDECLARED}`, pack);
  assert.equal(b.from_ref, "P0.3c", "the declared row must still win");
  assert.equal(
    b.ordinals.release,
    85,
    "the undeclared 100 must not be trusted",
  );
  assert.equal(b.undeclared_rows_skipped, 1);

  // On its own it is not a baseline at all, and the count is reported.
  const alone = readRatchetBaseline(LEDGER_UNDECLARED, pack);
  assert.equal(alone.status, "inactive_no_baseline");
  assert.equal(alone.undeclared_rows_skipped, 1);
  assert.equal(alone.reason, null);
});

test("GATE: a declared baseline must state a reason, or it is not a declaration", () => {
  for (const bad of [{}, { reason: "" }, { reason: "   " }, "", 0, false]) {
    const row = JSON.stringify({
      ts: "t",
      ref: "x",
      evidence: {
        jev: { facet_ordinals: { release: 85 }, baseline_advance: bad },
      },
    });
    const b = readRatchetBaseline(row, pack);
    assert.equal(
      b.status,
      "inactive_no_baseline",
      `baseline_advance ${JSON.stringify(bad)} must not count as a declaration`,
    );
  }
  // A plain string reason is accepted, so a row can declare itself tersely.
  const terse = JSON.stringify({
    ts: "t",
    ref: "x",
    evidence: {
      jev: { facet_ordinals: { release: 85 }, baseline_advance: "measured" },
    },
  });
  const b = readRatchetBaseline(terse, pack);
  assert.equal(b.status, "active");
  assert.equal(b.reason, "measured");
  assert.equal(b.ordinals.release, 85);
});

test("GATE: a declared baseline still catches a drop below it", () => {
  // The ruling must not become a blank cheque: declaring a baseline fixes
  // where the bar sits, it does not stop the bar being enforced.
  const b = readRatchetBaseline(LEDGER_WITH, pack);
  const r = checkRatchet(
    { release: facet(60), physics: facet(100), testing: facet(100) },
    b,
  );
  assert.equal(r.status, "violation");
  assert.equal(r.regressions[0].axis, "release");
});

test("GATE: no baseline is reported as inactive, never as a pass", () => {
  const b = readRatchetBaseline(LEDGER_WITHOUT, pack);
  assert.equal(b.status, "inactive_no_baseline");
  const r = checkRatchet({ release: facet(85) }, b);
  assert.equal(r.status, "inactive_no_baseline");
  assert.equal(r.regressions.length, 0);
});

test("GATE: the ratchet catches a drop in a facet OUTSIDE the scope", () => {
  // This is the anti-loophole test. Scope P0.3 judges four facets; a collapse
  // in `release` is not in scope and must still fail the run.
  const baseline = readRatchetBaseline(LEDGER_WITH, pack);
  const current = {
    release: facet(60),
    physics: facet(100),
    testing: facet(100),
  };
  const r = checkRatchet(current, baseline);
  assert.equal(r.status, "violation");
  assert.equal(r.regressions.length, 1);
  assert.equal(r.regressions[0].axis, "release");
  assert.equal(r.regressions[0].previous_ordinal, 85);
  assert.equal(r.regressions[0].current_ordinal, 60);
});

test("GATE: the ratchet passes when nothing dropped, and ignores gains", () => {
  const baseline = readRatchetBaseline(LEDGER_WITH, pack);
  const same = checkRatchet(
    { release: facet(85), physics: facet(100), testing: facet(100) },
    baseline,
  );
  assert.equal(same.status, "met");
  // Improving a facet must never count as a violation.
  const better = checkRatchet(
    { release: facet(100), physics: facet(100), testing: facet(100) },
    baseline,
  );
  assert.equal(better.status, "met");
});

test("GATE: the ratchet ignores facets the baseline never recorded", () => {
  const baseline = readRatchetBaseline(LEDGER_WITH, pack);
  const r = checkRatchet(
    { release: facet(85), an_unrecorded_facet: facet(0) },
    baseline,
  );
  assert.equal(r.status, "met");
  assert.equal(r.regressions.length, 0);
});

test("GATE: the CLI wires --scope through to the exit code", () => {
  const cli = readFileSync(
    join(ROOT, "scripts/validate-jev-complete.mjs"),
    "utf8",
  );
  // The scoped policy moved to its own module (scripts/lib/jev-verdict.mjs) so
  // the CLI could be a pipeline; the rules themselves are pinned there now, by
  // the same expressions.
  const verdict = readFileSync(
    join(ROOT, "scripts/lib/jev-verdict.mjs"),
    "utf8",
  );
  assert.match(cli, /--scope/, "the CLI must accept --scope");
  assert.match(
    cli,
    /opts\.scope \? scopedPass : report\.pass/,
    "a scoped run must decide its own exit code, not the whole-program one",
  );
  assert.match(
    verdict,
    /readRatchetBaseline/,
    "the scoped verdict must read the ledger for the ratchet baseline",
  );
});

// ── §9 rule 6: the P0.3 bootstrap, and what it must never relax ─────────────
// P0.3 builds the gate that judges it, so a P0.3 sub-PR merges on green CI
// plus no ratchet regression, even below 99. From P0.4 the ≥ 99 threshold and
// the all-proven rule bind. The hard gates and the ratchet bind throughout.
test("GATE: the P0.3 bootstrap relaxes the score, never the ratchet or hard gates", () => {
  // The bootstrap rule is policy, and policy now has its own owner: the rules
  // are pinned in scripts/lib/jev-verdict.mjs, by the same expressions.
  const verdict = readFileSync(
    join(ROOT, "scripts/lib/jev-verdict.mjs"),
    "utf8",
  );
  const block = verdict.slice(verdict.indexOf("const pass ="));
  // The score and all-proven checks must sit INSIDE the !exitRuleBinds guard.
  assert.match(
    block,
    /!exitRuleBinds \|\|\s*\(scopedCombined >= report\.min_score && short\.length === 0\)/,
    "score and all-proven must only bind at or after the binding point",
  );
  // These two must be unconditional: a bootstrap that let a facet regress, or
  // let a red hard gate through, would be a weakened gate wearing a name.
  assert.match(
    block,
    /report\.hard_gates_passed &&\s*ratchet\.status === "met"/,
    "hard gates and the ratchet bind for every scope, bootstrap or not",
  );
  assert.doesNotMatch(
    block,
    /ratchet\.status === "met" &&\s*(!exitRuleBinds|report\.hard_gates_passed)/,
    "the ratchet and hard gates must not be moved inside the bootstrap guard",
  );
  assert.match(
    verdict,
    /bootstrap_applies: !exitRuleBinds/,
    "the report must state that the bootstrap applied, so a below-99 pass is never silent",
  );
});

test("GATE: an inactive ratchet is not a bootstrap pass", () => {
  // "No regression" must mean "checked and clean", never "never checked".
  const b = readRatchetBaseline(LEDGER_WITHOUT, pack);
  assert.equal(b.status, "inactive_no_baseline");
  const r = checkRatchet({ release: facet(0) }, b);
  assert.equal(r.status, "inactive_no_baseline");
  // The scoped verdict must require a literal "met". `!== "violation"` would
  // let a run with no baseline at all pass the clause meant to catch a drop.
  const verdict = readFileSync(
    join(ROOT, "scripts/lib/jev-verdict.mjs"),
    "utf8",
  );
  const block = verdict.slice(verdict.indexOf("const pass ="));
  assert.match(block, /ratchet\.status === "met"/);
  assert.doesNotMatch(
    block,
    /ratchet\.status !== "violation"/,
    "an inactive ratchet must not satisfy the clause",
  );
});

// ── §13.3: the evidence judges the change, not its merge state ──────────────
// A gate that cannot require its own merge to pass (the P0.3(c) self-judging
// deadlock) is a gate that can never go green. The record must therefore never
// describe whether a PR is open, unmerged or waiting on its own gate.
test("GATE: the run record never tells the judge the PR's merge state", () => {
  const ev = JSON.parse(
    readFileSync(join(ROOT, "evidence/advisor-and-release.json"), "utf8"),
  );
  // Deliberately narrow: it is the PR's own merge state that is forbidden, not
  // ordinary English. "Open:" naming a known limitation is fine.
  const mergeState =
    /(#\d+\s+is\s+(open|unmerged)|unmerged|not merged|NOT MERGE-READY|its (own\s+)?(scoped\s+)?(jev\s+)?gate exits|waiting on (its|the) (own )?gate|is blocked by (its|the) (own )?gate)/i;
  const lines = [];
  for (const k of [
    "tests_summary",
    "ci_summary",
    "smoke_note",
    "seo_summary",
    "advisor_audit",
  ]) {
    if (typeof ev[k] === "string") lines.push([k, ev[k]]);
  }
  (ev.notes || []).forEach((n, i) => lines.push([`note[${i}]`, String(n)]));
  for (const [k, v] of Object.entries(ev.facet_evidence || {})) {
    lines.push([`facet.${k}`, String(v)]);
  }
  for (const [k, v] of lines) {
    assert.doesNotMatch(
      v,
      mergeState,
      `evidence.${k} describes the PR's merge state, which §13.3 forbids — ` +
        "describe the head commit's content, measurements and check outcomes",
    );
  }
});
// P0.3 wrote the rule and is the item it cannot judge: the record must
// truthfully say the PR is open and its gate failing, which holds correctness
// below `proven` until it merges, and it cannot merge until the gate passes.
// The rule therefore starts at the next item — and from there it is stricter
// than scoped mode ever was, because scoped mode did not enforce it at all.
test("GATE: the all-proven exit rule starts at P0.4, not at its own author", () => {
  assert.equal(COMPLETE_EXIT_RULE_FROM, "P0.4");
  assert.equal(
    planItemAtLeast("P0.3", COMPLETE_EXIT_RULE_FROM),
    false,
    "P0.3 must not be judged by the rule it introduced",
  );
  assert.equal(planItemAtLeast("P0.4", COMPLETE_EXIT_RULE_FROM), true);
  assert.equal(planItemAtLeast("P10", COMPLETE_EXIT_RULE_FROM), true);
});

// The exemption is coarse because the PLAN is coarse: it lists P0.3 as one
// item, so "P0.3d" is not an id a scoped run can be given. If the plan ever
// grows sub-items, this test fails and the binding point must be revisited
// rather than left quietly one item behind.
//
// 2026-09-27: the tripwire fired on A-001's prose cross-references ("measured
// in Chromium in the P0.3(c) work"; finding F-45 mapped to P0.3(e)). Those are
// not item definitions — the plan still lists P0.3 as one item (§9 rule 6:
// "For scope purposes, P0.3's bullets (a)–(e) are one plan item, P0.3") — so
// the check now looks for sub-ids in item-definition position (a table row's
// ID cell), not in prose. A sub-id defined there would still trip it.
test("GATE: the plan has no P0.3 sub-ids, which is why the rule binds at P0.4", () => {
  const subIds =
    PLAN.match(/^\|\s*P0\.3\s*\([a-e]\)\s*\||^\|\s*P0\.3[a-e]\b\s*\|/gm) || [];
  assert.deepEqual(
    subIds,
    [],
    "the plan now defines P0.3 sub-items: --scope can name them, so the " +
      "all-proven exit rule can bind at P0.3(d) instead of exempting the " +
      "whole of P0.3",
  );
});

test("GATE: plan item ordering is (major, minor, letter), and a typo binds nothing", () => {
  assert.equal(planItemAtLeast("P0.3c", "P0.3d"), false);
  assert.equal(planItemAtLeast("P0.3d", "P0.3c"), true);
  assert.equal(planItemAtLeast("P0.4", "P0.3d"), true, "minor rolls over");
  assert.equal(planItemAtLeast("P1", "P0.3d"), true, "major rolls over");
  assert.equal(planItemAtLeast("P0.3d", "P0.3d"), true, "equal binds");
  // Fail closed on anything unparseable: a typo must never silently disable
  // the exit rule, because that would turn a stricter gate into a no-op.
  for (const bad of ["P0.3", "", null, undefined, "nonsense", "0.3d"]) {
    assert.equal(
      planItemAtLeast(bad, COMPLETE_EXIT_RULE_FROM),
      false,
      `unparseable item ${JSON.stringify(bad)} must not count as at-or-after`,
    );
  }
});

test("GATE: a scoped run at or after the binding point fails on any facet short of proven", () => {
  // Pinned in the module that owns the rule (scripts/lib/jev-verdict.mjs).
  const verdict = readFileSync(
    join(ROOT, "scripts/lib/jev-verdict.mjs"),
    "utf8",
  );
  // The rule must actually gate the scoped exit, not merely be reported.
  assert.match(
    verdict,
    /!exitRuleBinds \|\|\s*\(scopedCombined >= report\.min_score && short\.length === 0\)/,
    "from the binding point a scoped run must require the score AND every in-scope facet proven",
  );
  assert.match(
    verdict,
    /planItemAtLeast\(scope, COMPLETE_EXIT_RULE_FROM\)/,
    "the binding point must be data, not a hardcoded item id",
  );
  assert.match(
    verdict,
    /exit_rule_binds_from: COMPLETE_EXIT_RULE_FROM/,
    "the report must state where the rule binds, so it is never implicit",
  );
});

// A declared baseline that the reader cannot resolve is the quietest failure in
// the whole ratchet: readRatchetBaseline SKIPS a row it cannot read, so the
// declaration looks accepted in the ledger while the previous baseline keeps
// binding. That happened once for real — the P0.3d-baseline row nested
// `facet_ordinals` inside `baseline_advance`, and the reader looks for the two
// as siblings, so the row was ignored and the gate kept ratcheting against
// P0.3c-baseline-2 while the ledger claimed a new bar. This pins the real
// ledger against it: the declared baseline must resolve, cover every axis the
// pack declares, and be the row the ledger actually names.
test("GATE: the ledger's declared baseline resolves, and covers every axis", () => {
  const ledger = readFileSync(join(ROOT, "docs/plan/LEDGER.jsonl"), "utf8");
  const baseline = readRatchetBaseline(ledger, pack);
  assert.equal(
    baseline.status,
    "active",
    "no ledger row declares a baseline the reader can resolve — the ratchet " +
      "is inactive, so no run is checked against anything",
  );
  assert.ok(baseline.from_ref, "the resolved baseline must name its row");
  assert.ok(baseline.reason, "a resolved baseline must carry its reason");
  // Every axis the pack declares, including the five P0.3(d) facets. A
  // baseline that silently omits an axis leaves that facet un-ratcheted.
  for (const axis of Object.keys(pack.axes)) {
    assert.equal(
      typeof baseline.ordinals[axis],
      "number",
      `the declared baseline has no ordinal for "${axis}", so that facet ` +
        "carries no regression protection",
    );
  }
  // And the row the reader resolved must be one the ledger really contains,
  // carrying its ordinals as a sibling of the declaration — the exact shape
  // that was silently skipped.
  const row = ledger
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .find((r) => r.ref === baseline.from_ref);
  assert.ok(row, `the ledger has no row with ref ${baseline.from_ref}`);
  assert.ok(
    row.evidence?.jev?.facet_ordinals,
    `${baseline.from_ref} must carry evidence.jev.facet_ordinals beside its ` +
      "declaration, not nested inside it",
  );
});

// ── what a scoped run actually judges, exercised through the real function ──
// The rules above are pinned by reading the source. These run `scopedVerdict`
// itself, because the thing that went wrong for two review passes was not the
// rule — the rule was correct, and the gate proved it — but the OUTPUT, which
// listed five out-of-scope facets as the blockers of a P0.4 run. A policy that
// is only pinned by regex can be right and still be reported as wrong, so the
// property that actually matters is pinned by value: a facet outside the scope
// cannot change the scoped verdict.
//
// Built from the real pack and the real verdict function — no stub of either.
const AXES = Object.keys(pack.axes);
const provenFacet = { ordinal: 100, index: 4, level: "l4" };

/**
 * A report whose in-scope facets are all proven and whose others carry
 * `outOfScopeOrdinal`. Their `index` is left at 0 and never read: the
 * all-proven check only looks at facets inside the scope, and the ratchet reads
 * `ordinal` alone.
 */
const scopedReport = (outOfScopeOrdinal) => {
  const facets = {};
  for (const axis of AXES) {
    facets[axis] = SCOPE_FACETS["P0.4"].includes(axis)
      ? { ...provenFacet }
      : {
          ordinal: outOfScopeOrdinal,
          index: 0,
          level: `l${outOfScopeOrdinal}`,
        };
  }
  return {
    facets,
    hard_gates_passed: true,
    mechanical_score: 100,
    min_score: COMPLETE_MIN_SCORE,
  };
};

/** A ledger whose declared baseline records the report's own ordinals. */
const baselineFor = (report, overrides = {}) =>
  JSON.stringify({
    ts: "2026-09-28",
    kind: "baseline",
    ref: "test-baseline",
    evidence: {
      jev: {
        facet_ordinals: {
          ...Object.fromEntries(
            Object.entries(report.facets).map(([a, f]) => [a, f.ordinal]),
          ),
          ...overrides,
        },
        baseline_advance: { reason: "declared by the test" },
      },
    },
  });

const judge = (report, ledgerText, scope = "P0.4") =>
  scopedVerdict({ report, scope, pack, ledgerText });

test("GATE: out-of-scope facets cannot decide a scoped verdict", () => {
  // Seventeen facets at zero, and the four P0.4 facets all proven. If scope
  // worked by anything other than reading its own facets, this could not pass.
  const report = scopedReport(0);
  const v = judge(report, baselineFor(report));
  assert.equal(
    v.pass,
    true,
    "a run whose own facets are all proven must pass with 17 others at zero",
  );
  assert.equal(v.scoped.ratchet.status, "met");
  assert.equal(v.scoped.facets_short_of_proven.length, 0);
});

test("GATE: out-of-scope facets cannot move a scoped verdict at all", () => {
  // The by-hand proof, kept as a test: raise, lower and delete every facet
  // outside the scope and the scoped score, the short list and the verdict must
  // not budge by a single digit.
  const base = scopedReport(0);
  const ledger = baselineFor(base);
  const first = judge(base, ledger);
  assert.equal(first.pass, true);

  for (const ordinal of [0, 35, 60, 85, 100]) {
    const moved = scopedReport(ordinal);
    // Re-baseline so the ratchet stays `met` and cannot be what is being
    // measured here; the ratchet has its own test below.
    const v = judge(moved, baselineFor(moved));
    assert.equal(
      v.scoped.score,
      first.scoped.score,
      `out-of-scope ordinal ${ordinal} moved the scoped score`,
    );
    assert.equal(
      v.pass,
      first.pass,
      `out-of-scope ordinal ${ordinal} moved the verdict`,
    );
  }

  const deleted = JSON.parse(JSON.stringify(base));
  for (const axis of AXES) {
    if (!SCOPE_FACETS["P0.4"].includes(axis)) delete deleted.facets[axis];
  }
  const without = judge(deleted, ledger);
  assert.equal(without.scoped.score, first.scoped.score);
  assert.equal(
    without.pass,
    first.pass,
    "deleting 17 facets changed the verdict",
  );
});

test("GATE: the ratchet still fails a run over an OUT-of-scope drop", () => {
  // The counterpart, and the reason neutrality is not a loophole. `comparison`
  // is not a P0.4 facet; it is baselined at 85 and the run reports 60. Nothing
  // in scope changed, so only the ratchet can be what fails this.
  const report = scopedReport(0);
  report.facets.comparison = { ordinal: 60, index: 0, level: "l60" };
  const dropped = judge(
    report,
    baselineFor(scopedReport(0), { comparison: 85 }),
  );
  assert.equal(
    dropped.pass,
    false,
    "an out-of-scope regression must fail the run",
  );
  assert.equal(dropped.scoped.ratchet.status, "violation");
  assert.equal(dropped.scoped.ratchet.regressions[0].axis, "comparison");
  // And the in-scope facets are all still proven, so nothing else failed.
  assert.equal(dropped.scoped.facets_short_of_proven.length, 0);
  assert.equal(dropped.scoped.score, 100, "the in-scope score is untouched");
});

test("GATE: the scoped score is computed from the scoped facets only", () => {
  // The absolute-value half of neutrality, and the part an equality-only test
  // cannot see. With the 17 out-of-scope facets at ZERO, averaging them in is
  // invisible: the full sum divided by the facet count happens to equal the
  // in-scope mean. So they sit at 60 here, where the two readings differ — an
  // all-facet mean would be 66.9 and the score 90.07, against 96.25 and 98.88.
  const report = scopedReport(60);
  report.facets.quality = { ordinal: 85, index: 3, level: "l85" };
  const v = judge(report, baselineFor(scopedReport(60), { quality: 85 }));
  assert.equal(v.scoped.semantic_score, 96.25, "the mean is over 4 facets");
  assert.equal(v.scoped.score, 98.88, "and not over 21");
});

test("GATE: an in-scope facet short of proven fails, and only that", () => {
  const report = scopedReport(0);
  report.facets.quality = { ordinal: 85, index: 3, level: "l85" };
  const v = judge(report, baselineFor(scopedReport(0), { quality: 85 }));
  assert.equal(v.pass, false);
  assert.deepEqual(v.scoped.facets_short_of_proven, ["quality"]);
  // (100+100+85+100)/4 = 96.25, so 0.7*100 + 0.3*96.25 = 98.875. One facet a
  // step down costs 0.3*15/4 = 1.125 — which is why "confident" is not the bar.
  assert.equal(v.scoped.score, 98.88);
});
