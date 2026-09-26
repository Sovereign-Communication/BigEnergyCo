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
} from "../scripts/lib/jev-complete.mjs";

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
    jev: { facet_ordinals: { release: 85, physics: 100, testing: 100 } },
  },
});
const LEDGER_WITHOUT = JSON.stringify({
  ts: "2026-09-26",
  kind: "note",
  ref: "x",
});

test("GATE: the ratchet reads the LAST ledger row that recorded per-facet levels", () => {
  const b = readRatchetBaseline(LEDGER_WITH, pack);
  assert.equal(b.status, "active");
  assert.equal(b.ordinals.release, 85);
  // A later row without facet_ordinals must not erase an earlier baseline.
  const later = `${LEDGER_WITHOUT}\n${LEDGER_WITH}\n${LEDGER_WITHOUT}`;
  assert.equal(readRatchetBaseline(later, pack).status, "active");
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
  assert.match(cli, /--scope/, "the CLI must accept --scope");
  assert.match(
    cli,
    /opts\.scope \? scopedPass : report\.pass/,
    "a scoped run must decide its own exit code, not the whole-program one",
  );
  assert.match(
    cli,
    /readRatchetBaseline/,
    "the CLI must read the ledger for the ratchet baseline",
  );
});
