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
import { readFileSync } from "node:fs";

import {
  COVERED_Q_METRICS,
  EVIDENCE_REGISTRY,
  dig,
  daysBetween,
  evaluateEntry,
  validateEvidence,
} from "../scripts/lib/quality-evidence.mjs";

const NOW = "2026-09-27T12:00:00.000Z";
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

test("the committed a11y matrix report is readable evidence, and its one hole is named", () => {
  // This is the one gate whose evidence the repository actually commits, so it
  // is the one the validator can be held to against a real file rather than a
  // fixture. Two things are true of that file and both are asserted here,
  // because between them they are the honest state of P0.4's a11y gate:
  //
  //   1. It parses, holds the schema and clears every blocking bar, so it IS
  //      usable evidence and the job stays green.
  //   2. It is NOT complete. One cell -- heatmap/arrival/none/ltr -- is recorded
  //      in both `audit_errors` and `unmeasured` with one violation, which is
  //      the "hole in it" the P0.4b baseline row already names. The validator
  //      reports it, by cell id, on every run.
  //
  // Both facts are asserted because both are true and both matter: the gate is
  // enforceable today, and it does not pretend the a11y matrix is finished. An
  // earlier version of this test assumed the committed report was clean and
  // asserted a failure; a test asserting either would have been asserting a
  // wish rather than reading the file.
  const entry = byMetric("a11y_matrix");
  const doc = JSON.parse(readFileSync(entry.file, "utf8"));
  const result = evaluateEntry(entry, doc, { now: NOW });

  // (1) Real evidence: no schema problem, and nothing over a blocking bar.
  assert.deepEqual(
    result.problems,
    [],
    `unexpected problems: ${result.problems.join("; ")}`,
  );

  // (2) Both open items are named rather than summed into a number: the
  //     freshness the file cannot state, and the cell it could not audit.
  assert.ok(
    result.gaps.some((g) =>
      /no "generated_at", so freshness is unmeasured/.test(g),
    ),
    `expected the freshness gap, got: ${JSON.stringify(result.gaps)}`,
  );
  assert.ok(
    result.gaps.some((g) => /heatmap\/arrival\/none\/ltr/.test(g)),
    `expected the unaudited cell to be named, got: ${JSON.stringify(result.gaps)}`,
  );

  // And the cell is named in the evidence itself, so the report and the
  // validator are describing the same single hole.
  assert.deepEqual(doc.audit_errors, ["heatmap/arrival/none/ltr"]);
  assert.deepEqual(
    doc.regressions,
    [],
    "the matrix has no regression, only the unmeasured cell",
  );
});

test("the repository's own committed evidence passes, and still names its open hole", () => {
  // The end-to-end consequence of the test above, as its own assertion. With
  // the evidence the repo actually has, the validator is GREEN -- and it still
  // prints the unaudited cell. Both are correct, and both are the point: the
  // gate is enforceable today, and it is not pretending P0.4's a11y matrix is
  // finished. What closes the hole is P0.4's exit evidence, the baseline
  // ledger row carrying every Q-metric.
  const docs = {
    a11y_matrix: JSON.parse(readFileSync(byMetric("a11y_matrix").file, "utf8")),
  };
  const { ok, problems, gaps } = validateEvidence(
    [byMetric("a11y_matrix")],
    docs,
    { now: NOW },
  );
  assert.equal(
    ok,
    true,
    `the committed evidence must not block: ${problems.join("; ")}`,
  );
  assert.deepEqual(problems, []);
  // The file IS committed, so it never reports as absent.
  assert.ok(
    gaps.every((g) => !/still owes this/.test(g)),
    `a committed file must not report as absent: ${JSON.stringify(gaps)}`,
  );
  assert.ok(gaps.some((g) => /heatmap\/arrival\/none\/ltr/.test(g)));
});

test("a whole unrun gate set reports every gap without failing the job", () => {
  // The state P0.4 is in for four of its five gates today, pinned end to end:
  // nothing is committed for them, every one is named with the command that
  // would produce it, and the exit code stays 0 so the job is usable now.
  const { ok, problems, gaps } = validateEvidence(
    EVIDENCE_REGISTRY,
    {},
    { now: NOW },
  );
  assert.equal(ok, true);
  assert.deepEqual(problems, []);
  assert.equal(gaps.length, EVIDENCE_REGISTRY.length);
  for (const gap of gaps) {
    assert.match(gap, /P0\.4 still owes this/);
    assert.match(gap, /run `/);
  }
});
