// Regression tests for the no-browser quality-evidence validator (P0.4, F-38).
//
// The validator is the only part of the quality pass that still runs on every PR
// once the browser gates moved local, so the properties that matter are:
//
//   1. it CANNOT be made to pass on evidence that is stale, malformed, or over
//      a bar its gate declares blocking;
//   2. it DOES NOT fail on a gate that has honestly not been run yet, because
//      the remaining P0.4 gaps are real and a permanently red job is not a gate.
//
// (2) is the one a test suite is most likely to get wrong by accident — "no
// evidence" and "evidence that says something bad" are different states, and
// the line between them is the whole design. These tests pin it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

import {
  COVERED_Q_METRICS,
  EVIDENCE_REGISTRY,
  dig,
  daysBetween,
  evaluateEntry,
  validateEvidence,
} from "../scripts/lib/quality-evidence.mjs";

// The clock these tests read the committed evidence against. It sits just after
// the P0.4 evidence run, so the fixtures are neither future-dated (which the
// freshness check correctly refuses) nor older than the 45-day window. It is a
// fixed instant rather than `Date.now()` on purpose: a test that quietly ages
// with the calendar turns into a flaky test the first week it is not run.
const NOW = "2026-10-05T12:00:00.000Z";
const byMetric = (metric) => EVIDENCE_REGISTRY.find((e) => e.metric === metric);

function freshDoc(metric, extra = {}) {
  return {
    plan_item: "P0.4",
    metric,
    generated_at: "2026-09-20T12:00:00.000Z",
    code_sha: "abc1234",
    regressions: [],
    breaches: [],
    ...extra,
  };
}

test("the registry covers only Q-metrics the plan actually assigns to P0.4", () => {
  for (const entry of EVIDENCE_REGISTRY) {
    assert.ok(
      COVERED_Q_METRICS.includes(entry.q_metric),
      `${entry.metric} claims ${entry.q_metric}, which is not in COVERED_Q_METRICS`,
    );
  }
  // Every covered Q-metric must have a gate behind it, or the validator would
  // claim coverage it cannot actually check.
  const claimed = new Set(EVIDENCE_REGISTRY.map((e) => e.q_metric));
  for (const q of COVERED_Q_METRICS) {
    assert.ok(
      claimed.has(q),
      `${q} is declared covered but no registry entry produces evidence for it`,
    );
  }
});

test("every registry entry declares a file, a way to produce it, and a freshness window", () => {
  for (const entry of EVIDENCE_REGISTRY) {
    assert.equal(typeof entry.file, "string");
    assert.ok(
      entry.file.length > 0,
      `${entry.metric} declares no evidence file`,
    );
    assert.equal(typeof entry.generated_by, "string");
    assert.ok(
      entry.max_age_days > 0,
      `${entry.metric} declares no freshness window`,
    );
    assert.ok(
      entry.blocking.length > 0,
      `${entry.metric} declares no blocking rule, so it can never fail`,
    );
  }
});

test("evidence files are distinct, so one gate cannot be read as another's evidence", () => {
  const files = EVIDENCE_REGISTRY.map((e) => e.file);
  assert.equal(
    new Set(files).size,
    files.length,
    `duplicate evidence file in the registry: ${files.join(", ")}`,
  );
});

test("dig reports absence as well as value, so a missing key is never read as empty", () => {
  assert.deepEqual(dig({ a: { b: 1 } }, "a.b"), { found: true, value: 1 });
  assert.deepEqual(dig({ a: {} }, "a.b"), { found: false, value: undefined });
  assert.deepEqual(dig({}, "a"), { found: false, value: undefined });
  // A key that is present but null is found, and must not be mistaken for a
  // pass just because it is not a number.
  assert.deepEqual(dig({ a: null }, "a"), { found: true, value: null });
});

test("daysBetween measures elapsed days and refuses unparseable input", () => {
  assert.equal(daysBetween("2026-09-20T12:00:00Z", "2026-09-27T12:00:00Z"), 7);
  assert.equal(daysBetween("not a date", "2026-09-27T12:00:00Z"), null);
  assert.equal(daysBetween("2026-09-20T12:00:00Z", "nonsense"), null);
});

test("clean, current evidence inside its bar passes", () => {
  const entry = byMetric("a11y_matrix");
  const doc = { ...freshDoc("a11y_matrix"), audit_errors: [], unmeasured: [] };
  const result = evaluateEntry(entry, doc, { now: NOW });
  assert.deepEqual(
    result.problems,
    [],
    `unexpected problems: ${result.problems.join("; ")}`,
  );
});

test("a gate that has not run yet is a named gap, not a failure", () => {
  const { ok, problems, gaps } = validateEvidence(
    EVIDENCE_REGISTRY,
    {},
    { now: NOW },
  );
  assert.equal(ok, true, "absent evidence must not fail the validator");
  assert.deepEqual(problems, []);
  // And the gap must be loud: every declared metric has to be named, with the
  // command that would produce it, or "still owed" is invisible.
  assert.equal(gaps.length, EVIDENCE_REGISTRY.length);
  for (const gap of gaps) {
    assert.match(gap, /P0\.4 still owes this/);
    assert.match(gap, /run `/);
  }
});

test("stale evidence fails, and says how to regenerate it", () => {
  const entry = byMetric("lighthouse");
  const doc = freshDoc("lighthouse", {
    generated_at: "2026-01-01T00:00:00.000Z",
  });
  const result = evaluateEntry(entry, doc, { now: NOW });
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0], /days old, over its 45-day window/);
  assert.match(result.problems[0], /node scripts\/check-lighthouse\.mjs/);
});

test("a future-dated run fails, because a clock that runs ahead is not evidence", () => {
  const entry = byMetric("lighthouse");
  const doc = freshDoc("lighthouse", {
    generated_at: "2027-01-01T00:00:00.000Z",
  });
  const result = evaluateEntry(entry, doc, { now: NOW });
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0], /in the future/);
});

test("a truncated or half-written report fails on schema, not on thresholds", () => {
  const entry = byMetric("lighthouse");
  const result = evaluateEntry(entry, { plan_item: "P0.4" }, { now: NOW });
  assert.ok(result.problems.length > 0);
  assert.match(result.problems[0], /missing required key "metric"/);
  // A schema failure must not also be reported as a threshold breach: one
  // broken file is one problem, reported once.
  assert.equal(result.problems.filter((p) => p.includes("blocking")).length, 0);
});

test("a wrongly-typed field fails rather than passing as its zero value", () => {
  const entry = byMetric("cross_browser");
  const doc = freshDoc("cross_browser", {
    console_errors: "0",
    csp_violations: 0,
  });
  const result = evaluateEntry(entry, doc, { now: NOW });
  assert.ok(
    result.problems.some((p) =>
      /"console_errors" should be number, got string/.test(p),
    ),
    `expected a type failure, got: ${result.problems.join("; ")}`,
  );
});

test("Q-08's absolute bars are blocking, with no baseline to fall back on", () => {
  const entry = byMetric("cross_browser");
  const doc = freshDoc("cross_browser", {
    console_errors: 2,
    csp_violations: 0,
  });
  const result = evaluateEntry(entry, doc, { now: NOW });
  assert.equal(result.problems.length, 1);
  assert.match(
    result.problems[0],
    /reads 2 for "console_errors", and the gate's bar is 0/,
  );
});

test("Q-07's known hole is a named gap, not a blocking regression", () => {
  // The committed P0.4c report records one cell axe could not audit. P0.4b
  // declared its baseline row "with the hole in it", so the hole is a DECLARED
  // gap: named on every run, by cell id, and it does not redden the job.
  // Blocking on it would red every PR in the repository, including the ones
  // that are in the middle of closing it.
  const entry = byMetric("a11y_matrix");
  const doc = {
    ...freshDoc("a11y_matrix"),
    audit_errors: ["heatmap/arrival/none/ltr"],
    unmeasured: [{ id: "heatmap/arrival/none/ltr", violations: 1 }],
  };
  const result = evaluateEntry(entry, doc, { now: NOW });
  assert.deepEqual(result.problems, [], "a declared hole must not block");
  assert.ok(
    result.gaps.some((g) =>
      /1 cells the matrix could not audit \(heatmap\/arrival\/none\/ltr\)/.test(
        g,
      ),
    ),
    `the hole must be named by cell id, got: ${JSON.stringify(result.gaps)}`,
  );
});

test("a breach is not a regression: ratchet-mode readings stay reportable, not blocking", () => {
  const entry = byMetric("byte_budgets");
  const doc = freshDoc("byte_budgets", {
    breaches: [{ metric: "index.html", limit: 100000, value: 120000 }],
  });
  const result = evaluateEntry(entry, doc, { now: NOW });
  assert.deepEqual(
    result.problems,
    [],
    "a declared breach must not fail the validator",
  );
});

test("a regression in ratchet mode is blocking", () => {
  const entry = byMetric("byte_budgets");
  const doc = freshDoc("byte_budgets", {
    regressions: [{ metric: "index.html", baseline: 100000, value: 140000 }],
  });
  const result = evaluateEntry(entry, doc, { now: NOW });
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0], /1 entry in "regressions"/);
});

test("one bad file among committed evidence fails the run", () => {
  const good = freshDoc("lighthouse");
  const bad = freshDoc("visual", { unapproved_diffs: 3 });
  const { ok, problems } = validateEvidence(
    [byMetric("lighthouse"), byMetric("visual")],
    {
      lighthouse: good,
      visual: bad,
    },
    { now: NOW },
  );
  assert.equal(ok, false);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /visual.*unapproved_diffs/s);
});

test("a file that declares another metric's name is rejected", () => {
  const entry = byMetric("lighthouse");
  const doc = { ...freshDoc("lighthouse"), metric: "a11y_matrix" };
  const result = evaluateEntry(entry, doc, { now: NOW });
  assert.ok(
    result.problems.some((p) =>
      /declares metric "a11y_matrix", expected "lighthouse"/.test(p),
    ),
    `expected a metric mismatch, got: ${result.problems.join("; ")}`,
  );
});

test("the committed a11y matrix report is readable evidence, and its hole is closed", () => {
  // This is the gate whose evidence the repository actually commits, so it is
  // the one the validator can be held to against a real file rather than a
  // fixture. Three things are true of that file and all three are asserted:
  //
  //   1. It parses, holds the schema and clears every blocking bar, so it IS
  //      usable evidence and the job stays green.
  //   2. It carries `generated_at` and `code_sha`. The report this one replaced
  //      (the P0.4c run at the repo root) carried neither, and that is exactly
  //      how it went on reading as live evidence long after #162 had fixed the
  //      cell it claimed was broken. Asserted so the field cannot quietly go.
  //   3. heatmap/arrival/none/ltr now reads 0 violations with no audit error.
  //      That hole is CLOSED, and this is the test that says so.
  const entry = byMetric("a11y_matrix");
  const doc = JSON.parse(readFileSync(entry.file, "utf8"));
  const result = evaluateEntry(entry, doc, { now: NOW });

  assert.deepEqual(
    result.problems,
    [],
    `unexpected problems: ${result.problems.join("; ")}`,
  );
  assert.deepEqual(
    result.gaps,
    [],
    `unexpected gaps: ${result.gaps.join("; ")}`,
  );

  // (2) Freshness is stated, not inferred.
  assert.ok(Number.isFinite(Date.parse(doc.generated_at)));
  assert.match(doc.code_sha, /^[0-9a-f]{7,40}$/);
  assert.doesNotMatch(
    result.gaps.join(" "),
    /freshness is unmeasured/,
    "a report with a generated_at must not report its freshness as unmeasured",
  );

  // (3) The hole is closed.
  assert.deepEqual(doc.audit_errors, [], "no cell may be unauditable");
  assert.deepEqual(doc.regressions, []);
  assert.deepEqual(doc.unmeasured, [], "every declared cell must be measured");
  const heatmap = doc.cells.find((c) => c.id === "heatmap/arrival/none/ltr");
  assert.ok(heatmap, "the cell that was the hole must still be in the matrix");
  assert.deepEqual(heatmap.violations, [], "and it must read 0 violations");
});

test("the repository's own committed evidence passes with no gaps at all", () => {
  // The end-to-end consequence of the test above, as its own assertion. All
  // five P0.4 gates now have a committed report, so the validator is GREEN and
  // has nothing to report -- neither a problem nor a gap.
  const docs = {};
  for (const entry of EVIDENCE_REGISTRY) {
    docs[entry.metric] = JSON.parse(readFileSync(entry.file, "utf8"));
  }
  const { ok, problems, gaps } = validateEvidence(EVIDENCE_REGISTRY, docs, {
    now: NOW,
  });
  assert.equal(
    ok,
    true,
    `the committed evidence must not block: ${problems.join("; ")}`,
  );
  assert.deepEqual(problems, []);
  assert.deepEqual(gaps, [], `no gate may be unmeasured: ${gaps.join("; ")}`);
});

test("the superseded root report is gone, so it cannot be read as live evidence", () => {
  // The stale file that motivated the freshness check. Asserting its ABSENCE is
  // the point: a report that recorded an audit error for a cell that has read 0
  // violations since #162 must not sit in the tree looking current.
  assert.equal(
    existsSync(".a11y-matrix-p04c-report.json"),
    false,
    "the superseded P0.4c report must be removed, not left beside the fresh one",
  );
});

test("a whole unrun gate set reports every gap without failing the job", () => {
  // The state P0.4 was in for four of its five gates before this row landed,
  // pinned end to end: nothing is committed for them, every one is named with
  // the command that would produce it, and the exit code stays 0 so the job is
  // usable while those gaps are honestly open.
  const { ok, problems, gaps } = validateEvidence(
    EVIDENCE_REGISTRY,
    {},
    {
      now: NOW,
    },
  );
  assert.equal(ok, true);
  assert.deepEqual(problems, []);
  assert.equal(gaps.length, EVIDENCE_REGISTRY.length);
  for (const gap of gaps) {
    assert.match(gap, /P0\.4 still owes this/);
    assert.match(gap, /run `/);
  }
});
