// Plan §8 P0.4 / F-38: the no-browser CI validator for the quality-pass
// evidence this repo commits.
//
// WHY THIS FILE EXISTS. The heavy P0.4 gates need browsers: Lighthouse, the
// axe-core matrix over Q-07, cross-browser smoke, visual regression. The
// mission's execution decision is that those run LOCALLY, on the agent machine,
// and that GitHub CI keeps only what is already reliable there (Tests, CodeQL,
// coverage, web-smoke, jev-complete) — "no browsers in CI, no CI wall-clock
// bloat".
//
// Moving a gate out of CI has one real cost, and this file is the answer to it.
// With no browser in CI, nothing stops the committed evidence going stale: a
// report that was green six weeks ago still sits in the repository, and to
// anything that only reads the file it is indistinguishable from a green run
// today. So the evidence is committed, and this validator is what keeps the
// COMMIT honest on every PR through the reliable CI path. It reads the
// committed files and asserts three things about each one:
//
//   1. SCHEMA     - the fields the gate's own contract declares are present
//                   and of the right type, so a report cannot be truncated or
//                   half-written and still read as a result.
//   2. THRESHOLD  - the readings the gate holds blocking are actually inside
//                   the bar the gate declares for them.
//   3. FRESHNESS  - the evidence describes a recent tree, not an old one.
//
// WHAT IT DELIBERATELY DOES NOT DO. It never opens a browser, never re-runs a
// gate, and never invents a reading. Its entire authority is the sentence
// "the file this repository committed says this, and it is current". A missing
// file is not a reading it can substitute for.
//
// THE LINE BETWEEN "FAILING" AND "UNMEASURED", and why it is drawn here.
//
// This is the one design decision in the file that is not obvious, so the
// reasoning is stated rather than left in a constant. A validator that failed
// on absent evidence would be red on every PR from the moment it landed until
// a human produced four browser runs by hand — a permanently red gate is not a
// gate, it is noise, and it gets ignored within a week. A validator that said
// nothing about absent evidence would let P0.4 be declared done on the strength
// of one green file.
//
// So the two are separated, using the vocabulary the a11y matrix report already
// established in its own `regressions` / `breaches` / `unmeasured` fields:
//
//   - REGRESSION (blocking, exit 1). Evidence that EXISTS and is stale, is
//     malformed, or is over a bar the gate declares blocking. This is the
//     failure mode that matters: something that was true stopped being true,
//     or a committed file stopped being readable as evidence.
//   - GAP (non-blocking, printed). Evidence that does not exist yet. Named on
//     every run so the list of what P0.4 still owes is impossible to miss, and
//     left out of the exit code so the job is usable while those gaps are
//     honestly open.
//
// P0.4's completion is not decided by this job. It is decided by the baseline
// ledger row the plan names as its exit evidence, which must carry every
// Q-metric and be green. This validator's job is narrower and it is the part
// that can run without a browser: keep what is committed honest, and keep the
// remaining gaps visible.

/**
 * The Q-metrics this validator can speak to. Declared here, beside the
 * registry, so the tests can assert that every registry entry names a real
 * Q-metric and that no Q-metric is claimed without a registry entry behind it —
 * one source, so the validator cannot assert coverage the plan does not grant
 * it, nor silently drop a metric it was built for.
 *
 * Q-01 (Jev completeness) is deliberately absent: it is judged by
 * `scripts/validate-jev-complete.mjs` against a live judge, not by a committed
 * report, and re-deriving it from a file would be exactly the "recomputed
 * substitute reading" this file refuses to produce. Q-04 (field speed) is
 * absent because it needs Search Console and Cloudflare data that does not
 * exist yet. Q-06 is a Playwright scenario suite (P6.8), not a P0.4 gate.
 */
export const COVERED_Q_METRICS = ["Q-02", "Q-05", "Q-07", "Q-08", "Q-09"];

/**
 * One entry per P0.4 gate that must leave machine-readable evidence behind.
 *
 * `blocking` is the part that decides the exit code, and it is declared as
 * paths with a rule rather than as prose, so the same declaration drives the
 * validator, the tests, and the printed report — there is no second place where
 * "what counts as blocking" is written down differently.
 *
 * `freshness_key` names the field carrying when the run happened. An evidence
 * file predating that field is reported as an unmeasured FRESHNESS rather than
 * a failure: the file is real and its schema still holds, it simply does not
 * record its own age, and inventing one would be worse than saying so.
 */
export const EVIDENCE_REGISTRY = [
  {
    metric: "byte_budgets",
    q_metric: "Q-05",
    file: ".quality-evidence/byte-budgets.json",
    generated_by: "npm run gate:byte-budgets",
    plan_ref: "docs/plan/MASTER_PLAN.md §8 P0.4, §3.1, Q-05",
    required_keys: {
      plan_item: "string",
      metric: "string",
      generated_at: "string",
      code_sha: "string",
      regressions: "array",
      breaches: "array",
    },
    blocking: [{ path: "regressions", rule: "empty-array" }],
    freshness_key: "generated_at",
    max_age_days: 45,
  },
  {
    metric: "a11y_matrix",
    q_metric: "Q-07",
    // The canonical path, beside the other four. The report used to sit at the
    // repo root as `.a11y-matrix-p04c-report.json` and was SUPERSEDED: it was
    // generated before #162 fixed the heatmap cell, so it recorded an audit
    // error and one violation for `heatmap/arrival/none/ltr` that a fresh run
    // shows are 0. It carried no `generated_at` and no `code_sha`, so nothing
    // could tell a live reading from a dead one — which is precisely the failure
    // this validator exists to catch, arrived at by the route it was built to
    // prevent. The a11y driver now writes both fields.
    file: ".quality-evidence/a11y-matrix.json",
    generated_by: "npm run gate:a11y-matrix",
    plan_ref: "docs/plan/MASTER_PLAN.md §8 P0.4, §3.2, Q-07",
    required_keys: {
      plan_item: "string",
      metric: "string",
      generated_at: "string",
      code_sha: "string",
      regressions: "array",
      audit_errors: "array",
      breaches: "array",
      unmeasured: "array",
    },
    // Only `regressions` blocks here, and that is the repo's own ratchet
    // semantics rather than a softer bar chosen for convenience. The
    // committed P0.4c report records one cell — `heatmap/arrival/none/ltr` —
    // in BOTH `audit_errors` and `unmeasured`, with one violation: axe could
    // not audit that cell, so the matrix is incomplete there. P0.4b declared
    // its baseline row "with the hole in it", which is the decision this
    // encoding follows: a KNOWN hole is a declared gap, reported loudly on
    // every run, and it is P0.4's exit evidence — the baseline ledger row —
    // that has to close it. Treating it as a blocking regression instead would
    // make this job red on every PR in the repository, including the PRs that
    // are in the middle of fixing it.
    blocking: [{ path: "regressions", rule: "empty-array" }],
    // Reported, never blocking: the cells the matrix could not audit. These are
    // named here so the printed report says which cells are still open rather
    // than only that some number of them are.
    reported_gaps: [
      { path: "unmeasured", label: "cells the matrix could not audit" },
    ],
    freshness_key: "generated_at",
    max_age_days: 45,
  },
  {
    metric: "lighthouse",
    q_metric: "Q-02",
    file: ".quality-evidence/lighthouse.json",
    generated_by:
      "node scripts/check-lighthouse.mjs --out .quality-evidence/lighthouse.json",
    plan_ref: "docs/plan/MASTER_PLAN.md §8 P0.4, Q-02",
    required_keys: {
      plan_item: "string",
      metric: "string",
      generated_at: "string",
      code_sha: "string",
      regressions: "array",
      breaches: "array",
    },
    // Only the three deterministic categories are ratcheted; `performance` is
    // measured and reported but deliberately not a floor, because its spread
    // across repeated runs on an unchanged tree is wider than any affordable
    // run count can narrow. The full measurement behind that split lives in
    // scripts/lib/lighthouse-budgets.mjs and is not restated here.
    blocking: [{ path: "regressions", rule: "empty-array" }],
    freshness_key: "generated_at",
    max_age_days: 45,
  },
  {
    metric: "cross_browser",
    q_metric: "Q-08",
    file: ".quality-evidence/cross-browser.json",
    generated_by:
      "node scripts/check-cross-browser.mjs --out .quality-evidence/cross-browser.json",
    plan_ref: "docs/plan/MASTER_PLAN.md §8 P0.4, Q-08",
    required_keys: {
      plan_item: "string",
      metric: "string",
      generated_at: "string",
      code_sha: "string",
      console_errors: "number",
      csp_violations: "number",
    },
    // Q-08 is stated as absolute numbers, not a baseline: Chromium, Firefox
    // and WebKit at 320/390/768/1440 with 0 console errors and 0 CSP
    // violations. There is no "it was already this bad" reading available.
    blocking: [
      { path: "console_errors", rule: "zero" },
      { path: "csp_violations", rule: "zero" },
    ],
    freshness_key: "generated_at",
    max_age_days: 45,
  },
  {
    metric: "visual",
    q_metric: "Q-09",
    file: ".quality-evidence/visual.json",
    generated_by:
      "node scripts/check-visual.mjs --out .quality-evidence/visual.json",
    plan_ref: "docs/plan/MASTER_PLAN.md §8 P0.4, Q-09",
    required_keys: {
      plan_item: "string",
      metric: "string",
      generated_at: "string",
      code_sha: "string",
      unapproved_diffs: "number",
    },
    // Q-09's threshold is > 0.1% of pixels per snapshot, so anything above the
    // scaffolding's approved set is a failure rather than a ratchet reading.
    blocking: [{ path: "unapproved_diffs", rule: "zero" }],
    freshness_key: "generated_at",
    max_age_days: 45,
  },
];

/** The JSON type each schema key must have. */
const TYPE_CHECKS = {
  string: (v) => typeof v === "string",
  number: (v) => typeof v === "number" && Number.isFinite(v),
  array: (v) => Array.isArray(v),
  object: (v) => v !== null && typeof v === "object" && !Array.isArray(v),
  boolean: (v) => typeof v === "boolean",
};

/** Walks a dotted path, reporting whether it was found as well as its value. */
export function dig(doc, path) {
  let cur = doc;
  for (const key of path.split(".")) {
    if (cur === null || typeof cur !== "object" || !(key in cur)) {
      return { found: false, value: undefined };
    }
    cur = cur[key];
  }
  return { found: true, value: cur };
}

/** Whole days between two ISO timestamps, or null if either is unparseable. */
export function daysBetween(fromIso, toIso) {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return (to - from) / 86_400_000;
}

function checkSchema(entry, doc) {
  const problems = [];
  for (const [key, type] of Object.entries(entry.required_keys)) {
    const { found, value } = dig(doc, key);
    if (!found) {
      problems.push(
        `${entry.metric}: ${entry.file} is missing required key "${key}"`,
      );
      continue;
    }
    if (!TYPE_CHECKS[type](value)) {
      problems.push(
        `${entry.metric}: ${entry.file} key "${key}" should be ${type}, got ${Array.isArray(value) ? "array" : typeof value}`,
      );
    }
  }
  if (dig(doc, "metric").found && dig(doc, "metric").value !== entry.metric) {
    problems.push(
      `${entry.metric}: ${entry.file} declares metric "${dig(doc, "metric").value}", expected "${entry.metric}"`,
    );
  }
  return problems;
}

function checkThresholds(entry, doc) {
  const problems = [];
  for (const { path, rule } of entry.blocking) {
    const { found, value } = dig(doc, path);
    if (!found) continue; // already reported by the schema check
    if (rule === "empty-array" && Array.isArray(value) && value.length > 0) {
      problems.push(
        `${entry.metric}: ${entry.file} has ${value.length} entr${value.length === 1 ? "y" : "ies"} in "${path}", which the gate holds blocking`,
      );
    }
    if (rule === "zero" && typeof value === "number" && value !== 0) {
      problems.push(
        `${entry.metric}: ${entry.file} reads ${value} for "${path}", and the gate's bar is 0`,
      );
    }
  }
  return problems;
}

function checkReportedGaps(entry, doc) {
  const gaps = [];
  for (const { path, label } of entry.reported_gaps ?? []) {
    const { found, value } = dig(doc, path);
    if (!found || !Array.isArray(value) || value.length === 0) continue;
    const ids = value.map((v) => (typeof v === "string" ? v : (v?.id ?? "?")));
    gaps.push(`${entry.metric}: ${value.length} ${label} (${ids.join(", ")})`);
  }
  return gaps;
}

function checkFreshness(entry, doc, now) {
  const { found, value } = dig(doc, entry.freshness_key);
  if (!found) {
    // A real file whose gate predates the timestamp field. Said plainly rather
    // than failed: the schema still holds, the run just does not record its age.
    return {
      problems: [],
      gap: `${entry.metric}: no "${entry.freshness_key}", so freshness is unmeasured`,
    };
  }
  const age = daysBetween(value, now);
  if (age === null) {
    return {
      problems: [
        `${entry.metric}: ${entry.file} has an unparseable "${entry.freshness_key}" (${value})`,
      ],
      gap: null,
    };
  }
  if (age > entry.max_age_days) {
    return {
      problems: [
        `${entry.metric}: ${entry.file} is ${age.toFixed(1)} days old, over its ${entry.max_age_days}-day window; re-run \`${entry.generated_by}\``,
      ],
      gap: null,
    };
  }
  if (age < 0) {
    return {
      problems: [
        `${entry.metric}: ${entry.file} claims "${entry.freshness_key}" of ${value}, which is in the future`,
      ],
      gap: null,
    };
  }
  return { problems: [], gap: null };
}

/**
 * Validates one registry entry against a document. Pure: the caller supplies
 * the parsed JSON, so the whole thing is testable without a filesystem and,
 * more importantly, without a browser.
 */
export function evaluateEntry(entry, doc, { now }) {
  const schema = checkSchema(entry, doc);
  // Thresholds and freshness are only meaningful once the schema holds; a
  // missing key would otherwise be reported a second time as a breach.
  if (schema.length > 0)
    return {
      metric: entry.metric,
      file: entry.file,
      problems: schema,
      gaps: [],
    };
  const thresholds = checkThresholds(entry, doc);
  const freshness = checkFreshness(entry, doc, now);
  return {
    metric: entry.metric,
    file: entry.file,
    problems: [...thresholds, ...freshness.problems],
    gaps: [freshness.gap, ...checkReportedGaps(entry, doc)].filter(Boolean),
  };
}

/**
 * Validates a whole set of evidence documents keyed by registry entry.
 * `docs` maps `entry.metric` to the parsed JSON, or to `null` when the file is
 * not committed at all — a missing file is a named gap, not a silent pass and
 * not a failure.
 */
export function validateEvidence(entries, docs, { now }) {
  const results = entries.map((entry) => {
    const doc = docs[entry.metric];
    if (doc === null || doc === undefined) {
      return {
        metric: entry.metric,
        file: entry.file,
        problems: [],
        gaps: [
          `${entry.metric}: no committed evidence at ${entry.file}; P0.4 still owes this (run \`${entry.generated_by}\`)`,
        ],
      };
    }
    return evaluateEntry(entry, doc, { now });
  });
  const problems = results.flatMap((r) => r.problems);
  const gaps = results.flatMap((r) => r.gaps);
  return { ok: problems.length === 0, problems, gaps, results };
}
