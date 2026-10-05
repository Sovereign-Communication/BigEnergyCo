// THE SELF-AUDIT. Every gate and evidence module added in this cycle is proved
// here to FAIL when the thing it claims to check is broken.
//
// WHY THIS FILE EXISTS, AND WHY IT IS SEPARATE. The sibling suites for the
// performance, resilience and experience facets each feed their evaluator the
// healthy reading and assert a clean verdict — which is the necessary half and
// not the sufficient one. A module that returned { regressions: [], holes: [] }
// unconditionally would pass every one of those. What makes a gate a gate is
// that it can say NO, and that is only demonstrable by feeding it something
// false and watching a named failure come out.
//
// So every test below is built the same way: take a reading that is correct in
// every respect except ONE, break exactly that one thing, and assert that a
// specific, named failure appears. The five modules named for this audit are:
//
//   check-evidence-freshness    the record's claims must match the tree
//   performance-budgets         the playtest must hold, and its holes are holes
//   resilience-budgets          the same, for the adversarial pass
//   paths-integrity             four paths priced against one system
//   jev-run                     the run record must refuse what it cannot pin
//
// and the composer's own claim — that a report which lies about its facet axes
// is refused rather than believed — is checked last, because a gate that
// composes a proof line nobody can check is the mechanism by which a score
// rises without the product changing.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  PERFORMANCE_BUDGETS,
  PERFORMANCE_FIRST_MEASUREMENT,
  evaluatePerformance,
  playtestClause,
} from "../scripts/lib/performance-budgets.mjs";
import {
  LIGHTHOUSE_FLOORS,
  LIGHTHOUSE_RATCHET_CATEGORIES,
  LIGHTHOUSE_TARGETS,
  composeFacetLine,
  compareLighthouse,
} from "../scripts/lib/lighthouse-budgets.mjs";
import { COMPLETE_FACET_CLIP } from "../scripts/lib/jev-complete.mjs";
import {
  BUDGET_FITS,
  RESILIENCE_EXPECTATIONS,
  TIMEOUT_GRAPH,
  composeResilienceFacetLine,
  evaluateBudgetFits,
  evaluateResilience,
} from "../scripts/lib/resilience-budgets.mjs";
import {
  attachRunFacts,
  classifyRun,
  liveRunRecord,
  gateExitCode,
} from "../scripts/lib/jev-run.mjs";
import { comparisonIntegrity } from "../scripts/lib/paths-integrity.mjs";
import { HORIZON_YEARS, PATH_IDS } from "../assets/js/sizing/paths.js";

// ═══════════════════════════════════════════════════════════════════════════
// 1. check-evidence-freshness
// ═══════════════════════════════════════════════════════════════════════════

/** Run the real gate against a fixture prose file and return its verdict. */
function runFreshnessGate(prose) {
  const dir = mkdtempSync(join(tmpdir(), "freshness-"));
  const file = join(dir, "prose.json");
  writeFileSync(file, JSON.stringify(prose, null, 2), "utf8");
  const r = spawnSync(
    process.execPath,
    ["scripts/check-evidence-freshness.mjs"],
    {
      encoding: "utf8",
      env: { ...process.env, PROSE_OVERRIDE: file },
    },
  );
  return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}` };
}

const REAL_PROSE = JSON.parse(
  readFileSync("evidence/advisor-and-release.json", "utf8"),
);
/** A copy of the real record, safe to mutate per test. */
const proseCopy = () => JSON.parse(JSON.stringify(REAL_PROSE));

test("AUDIT/freshness: the gate passes the repository's own record", () => {
  // The control. Without it, a gate that failed everything would satisfy every
  // mutation test below and prove nothing.
  const { code, out } = runFreshnessGate(proseCopy());
  assert.equal(code, 0, `the real record must pass: ${out}`);
});

test("AUDIT/freshness: a typed test count is refused", () => {
  const p = proseCopy();
  p.tests_summary = "1480/1480 npm test green, measured on this tree.";
  const { code, out } = runFreshnessGate(p);
  assert.equal(code, 1, "a hand-typed N/N count must fail the gate");
  assert.match(out, /types an N\/N count/);
});

test("AUDIT/freshness: a typed gate count in any shape is refused", () => {
  // The gate has three patterns, and each was a shape that actually shipped.
  const shapes = [
    ["smoke_note", "the browser smoke runs 200 gates, zero failures."],
    ["smoke_note", "measured: 166 pass this session."],
    ["tests_summary", "1500 tests green, measured on this tree."],
  ];
  for (const [field, text] of shapes) {
    const p = proseCopy();
    p[field] = text;
    const { code, out } = runFreshnessGate(p);
    assert.equal(code, 1, `${JSON.stringify(text)} must fail`);
    assert.match(out, /types an/);
  }
});

test("AUDIT/freshness: a stale asset stamp is refused", () => {
  const p = proseCopy();
  p.seo_summary = p.seo_summary.replace(/\b\d{8}[a-z]\b/, "20260101a");
  const { code, out } = runFreshnessGate(p);
  assert.equal(
    code,
    1,
    "a record naming a stamp the pages do not ship must fail",
  );
  assert.match(out, /asset stamp/);
});

test("AUDIT/freshness: a stale service-worker cache version is refused", () => {
  const p = proseCopy();
  p.seo_summary = p.seo_summary.replace(/beco-v\d+/, "beco-v1");
  const { code, out } = runFreshnessGate(p);
  assert.equal(code, 1);
  assert.match(out, /SW cache/);
});

test("AUDIT/freshness: a placeholder no runner writes is refused", () => {
  // A placeholder nothing fills is the same defect wearing a placeholder's
  // clothes: it reaches the judge as the literal text "{{…}}".
  const p = proseCopy();
  p.smoke_note = "the smoke runs {{gates_that_do_not_exist}} gates this run.";
  const { code, out } = runFreshnessGate(p);
  assert.equal(code, 1);
  assert.match(out, /no runner writes/);
});

test("AUDIT/freshness: an empty composable field is refused", () => {
  // Dropping a field is not the same as stating nothing, and the gate has to
  // tell them apart: an empty field is a record with a hole in it.
  const p = proseCopy();
  p.smoke_note = "   ";
  const { code, out } = runFreshnessGate(p);
  assert.equal(code, 1);
  assert.match(out, /is empty/);
});

test("AUDIT/freshness: a composed record with real placeholders still passes", () => {
  // The mutation must not be satisfiable by deleting every count: a record that
  // quotes the run rather than typing it is the shape the gate is FOR.
  const p = proseCopy();
  p.smoke_note =
    "the smoke runs {{smoke_gates_total}} gates; measured this run: {{smoke_gates_passed}} pass, {{smoke_gates_failed}} fail";
  const { code, out } = runFreshnessGate(p);
  assert.equal(code, 0, out);
});

// ═══════════════════════════════════════════════════════════════════════════
// 2a. performance-budgets — the playtest half
// ═══════════════════════════════════════════════════════════════════════════

/** A playtest reading that is correct in every respect. */
function healthyPlay(over = {}) {
  return {
    ok: true,
    cold_run: { ms: 5253 },
    warm_rerun: { ms: 78 },
    warm_adjustments: {
      taken: 3,
      all_previews_rendered: true,
      all_followed_through: true,
      preview_median_ms: 15,
      confirm_median_ms: 2534,
    },
    warm_network: { total: 0, nasa: 0, urls: [] },
    cold_network: { nasa: 3, urls: ["…/power/?lat=…"] },
    warm_reload: {
      ok: true,
      ms: 4024,
      boot_requests: 12,
      warm_network: { total: 0, nasa: 0, urls: [] },
    },
    paths_unavailable: {
      blocked_attempts: 1,
      card_rendered: true,
      paths_panel_rendered: false,
      eli5_rendered: false,
    },
    first_result: {
      boot_issued_modules: 42,
      run_issued_modules: 1,
      blocking_modules: 0,
      deferred_modules: 1,
    },
    ...over,
  };
}

test("AUDIT/performance: the healthy playtest passes", () => {
  const v = evaluatePerformance(healthyPlay());
  assert.deepEqual(v.regressions, [], JSON.stringify(v.regressions));
  assert.deepEqual(v.holes, [], JSON.stringify(v.holes));
});

test("AUDIT/performance: an absent playtest is a HOLE, not a clean run", () => {
  // The single most important line in this file. A gate whose absent reading
  // returned an empty verdict is the only way a score rises here without the
  // product changing.
  for (const bad of [undefined, null, {}, { ok: false }]) {
    const v = evaluatePerformance(bad);
    assert.ok(
      v.holes.length > 0,
      `absent/unplayable playtest ${JSON.stringify(bad)} passed clean`,
    );
  }
});

test("AUDIT/performance: a redundant warm-window pull is a regression", () => {
  // The exact clause the judge named: "confirm warm-cache paths issue zero
  // redundant network pulls". The budget is ZERO, not "a few" — a budget that
  // tolerated the defect would be a budget that could not catch it.
  const v = evaluatePerformance(
    healthyPlay({
      warm_network: { total: 4, nasa: 3, urls: ["a", "b", "c", "d"] },
    }),
  );
  assert.ok(
    v.regressions.some((r) => r.what === "warm_window_nasa"),
    JSON.stringify(v.regressions),
  );
  assert.equal(PERFORMANCE_BUDGETS.warm_window_nasa_max, 0);
});

test("AUDIT/performance: a redundant RELOAD pull is a separate regression", () => {
  // Warm-in-RAM and warm-after-reload are two different promises. Passing one
  // and failing the other would be a gate that measured half the clause.
  const v = evaluatePerformance(
    healthyPlay({
      warm_reload: {
        ok: true,
        ms: 4024,
        boot_requests: 12,
        warm_network: { total: 3, nasa: 3, urls: ["a", "b", "c"] },
      },
    }),
  );
  assert.ok(
    v.regressions.some((r) => r.what === "warm_reload_nasa"),
    JSON.stringify(v.regressions),
  );
});

test("AUDIT/performance: a cold stage that pulled NOTHING is a regression", () => {
  // Without this, a product that had stopped fetching weather entirely would
  // post a beautiful "0 NASA on the warm path". The zero has to mean
  // memoization, and that needs a non-zero control beside it.
  const v = evaluatePerformance(
    healthyPlay({ cold_network: { nasa: 0, urls: [] } }),
  );
  assert.ok(
    v.regressions.some((r) => r.what === "cold_network_nasa"),
    JSON.stringify(v.regressions),
  );
});

test("AUDIT/performance: a slow cold run is a regression", () => {
  const v = evaluatePerformance(healthyPlay({ cold_run: { ms: 40000 } }));
  assert.ok(v.regressions.some((r) => r.what === "cold_run"));
});

test("AUDIT/performance: a warm re-run that is not instant is a regression", () => {
  const v = evaluatePerformance(healthyPlay({ warm_rerun: { ms: 9000 } }));
  assert.ok(v.regressions.some((r) => r.what === "warm_rerun"));
});

test("AUDIT/performance: too FEW adjustments is a hole, not a pass", () => {
  // The judge asked for subsequent adjustments to be instant, which is a claim
  // about a SEQUENCE. One adjustment is not the sequence.
  const v = evaluatePerformance(
    healthyPlay({
      warm_adjustments: {
        taken: 1,
        all_previews_rendered: true,
        all_followed_through: true,
        preview_median_ms: 15,
        confirm_median_ms: 2534,
      },
    }),
  );
  assert.ok(
    v.holes.some((h) => h.what === "warm_adjustments"),
    JSON.stringify(v.holes),
  );
});

test("AUDIT/performance: a drag preview that never rendered is a regression", () => {
  const v = evaluatePerformance(
    healthyPlay({
      warm_adjustments: {
        taken: 3,
        all_previews_rendered: false,
        all_followed_through: true,
        preview_median_ms: 15,
        confirm_median_ms: 2534,
      },
    }),
  );
  assert.ok(v.regressions.some((r) => /preview/i.test(r.message)));
});

test("AUDIT/performance: a re-slice that did not follow its slider is a regression", () => {
  const v = evaluatePerformance(
    healthyPlay({
      warm_adjustments: {
        taken: 3,
        all_previews_rendered: true,
        all_followed_through: false,
        preview_median_ms: 15,
        confirm_median_ms: 2534,
      },
    }),
  );
  assert.ok(v.regressions.some((r) => /re-slice/i.test(r.message)));
});

test("AUDIT/performance: an UNREAD timing is a hole, never a pass", () => {
  // If a missing timing defaulted to 0, every budget would be satisfied by a
  // stage that measured nothing — which is the exact failure the hole list
  // exists to prevent.
  const v = evaluatePerformance(healthyPlay({ cold_run: {} }));
  assert.ok(
    v.holes.some((h) => h.what === "cold_run"),
    JSON.stringify(v.holes),
  );
});

test("AUDIT/performance: an uncounted warm wire is a hole", () => {
  const v = evaluatePerformance(healthyPlay({ warm_network: { urls: [] } }));
  assert.ok(
    v.holes.some((h) => h.what === "warm_network"),
    JSON.stringify(v.holes),
  );
});

test("AUDIT/performance: an uncounted COLD wire is a hole", () => {
  const v = evaluatePerformance(healthyPlay({ cold_network: {} }));
  assert.ok(v.holes.some((h) => h.what === "cold_network"));
});

test("AUDIT/performance: a missing warm reload is a hole", () => {
  const v = evaluatePerformance(healthyPlay({ warm_reload: undefined }));
  assert.ok(
    v.holes.some((h) => h.what === "warm_reload"),
    "in-memory memoization alone is not the memoization claim",
  );
});

test("AUDIT/performance: a stage that blocked nothing proves nothing about absence", () => {
  const v = evaluatePerformance(
    healthyPlay({
      paths_unavailable: {
        blocked_attempts: 0,
        card_rendered: true,
        paths_panel_rendered: false,
        eli5_rendered: false,
      },
    }),
  );
  assert.ok(
    v.holes.some((h) => h.what === "first_result_independence"),
    JSON.stringify(v.holes),
  );
});

test("AUDIT/performance: a result that needs the pricing model is a regression", () => {
  const v = evaluatePerformance(
    healthyPlay({
      paths_unavailable: {
        blocked_attempts: 1,
        card_rendered: false,
        paths_panel_rendered: false,
        eli5_rendered: false,
      },
    }),
  );
  assert.ok(v.regressions.some((r) => r.what === "first_result_independence"));
});

test("AUDIT/performance: a turnkey number with no model behind it is a regression", () => {
  // D-01 read through the same measurement. A panel quoting a price while its
  // pricing model is blocked is a second source of the number.
  const v = evaluatePerformance(
    healthyPlay({
      paths_unavailable: {
        blocked_attempts: 1,
        card_rendered: true,
        paths_panel_rendered: true,
        eli5_rendered: false,
      },
    }),
  );
  assert.ok(v.regressions.some((r) => r.what === "d01_panel_without_model"));
});

test("AUDIT/performance: the ELI5 sentence is checked TOO", () => {
  // One half of D-01 passing and the other failing is the "two different turnkey
  // numbers on one screen" the decision exists to remove.
  const v = evaluatePerformance(
    healthyPlay({
      paths_unavailable: {
        blocked_attempts: 1,
        card_rendered: true,
        paths_panel_rendered: false,
        eli5_rendered: true,
      },
    }),
  );
  assert.ok(v.regressions.some((r) => r.what === "d01_eli5_without_model"));
});

test("AUDIT/performance: the playtest clause composes nothing from an absent run", () => {
  // "0 warm requests" from a run that measured nothing is the most dangerous
  // sentence this repo can publish about the facet.
  assert.equal(playtestClause(null), null);
  assert.equal(playtestClause({ ok: false }), null);
  assert.equal(playtestClause({ ok: true, cold_run: {} }), null);
});

test("AUDIT/performance: the playtest clause names the SLOWER confirm wait", () => {
  // Hiding the real wait because the drag before it was fast is exactly the
  // flattering edit a facet line exists to prevent.
  const clause = playtestClause(healthyPlay());
  assert.ok(clause.startsWith("PLAYTEST, 1 Chrome, 1 city:"), clause);
  assert.match(clause, /confirm/, "the confirm wait must be stated");
  assert.match(clause, /median of 3/, "the sample size must travel with it");
  assert.match(clause, /0 NASA warm\/reload/, "both warm paths in one claim");
});

test("AUDIT/performance: the clause reports a NON-zero pull rather than hiding it", () => {
  const clause = playtestClause(
    healthyPlay({ warm_network: { total: 2, nasa: 2, urls: ["a", "b"] } }),
  );
  assert.match(clause, /2 NASA on the warm path/);
  // The zero here belongs to the RELOAD half, which genuinely was zero, so the
  // assertion is that the warm half is not zero — not that the word "0" is
  // absent. The first draft asserted the latter and failed on a correct clause.
  assert.doesNotMatch(
    clause,
    /0 NASA warm\/reload/,
    "the combined zero clause must not print when either warm path pulled",
  );
});

test("AUDIT/performance: the first-measurement record is real, not a stub", () => {
  // Every budget has to be traceable to a reading that was taken. A budget with
  // no recorded reading is a number somebody liked.
  const fm = PERFORMANCE_FIRST_MEASUREMENT;
  assert.ok(fm.conditions?.browser, "the conditions must be recorded");
  assert.ok(fm.conditions?.city, "the city must be recorded");
  for (const [k, v] of Object.entries(fm.runs)) {
    assert.ok(Array.isArray(v) && v.length > 0, `runs.${k} records no reading`);
    assert.ok(
      v.every((n) => typeof n === "number"),
      `runs.${k} is not numeric`,
    );
  }
  for (const [k, b] of Object.entries(PERFORMANCE_BUDGETS)) {
    if (typeof b !== "object" || b.max === undefined) continue;
    assert.ok(
      typeof b.why === "string" && b.why.length > 20,
      `budget ${k} has no reason, and a budget widened without one is ` +
        "indistinguishable from a budget moved to pass",
    );
  }
});

test("AUDIT/performance: relaxing a budget removes its regression", () => {
  // Proves the failures above come from the budgets rather than from an
  // evaluator that refuses to pass anything at all.
  const play = healthyPlay({ cold_run: { ms: 40000 } });
  assert.ok(evaluatePerformance(play).regressions.length > 0);
  assert.equal(
    evaluatePerformance(play, {
      ...PERFORMANCE_BUDGETS,
      cold_run_ms: { max: 60000, why: "raised by the audit" },
    }).regressions.length,
    0,
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// 2b. the Lighthouse half of the same axis, and the composed line
// ═══════════════════════════════════════════════════════════════════════════

test("AUDIT/lighthouse: a category below its floor is a regression", () => {
  const [target] = LIGHTHOUSE_TARGETS;
  const floors = {
    [target.id]: { ...LIGHTHOUSE_FLOORS[target.id], accessibility: 100 },
  };
  const v = compareLighthouse(
    [
      {
        id: target.id,
        scores: {
          performance: 80,
          accessibility: 90,
          "best-practices": 100,
          seo: 100,
        },
      },
    ],
    floors,
  );
  assert.ok(
    v.regressions.some((r) => r.category === "accessibility"),
    `a ratcheted category below its floor must regress: ${JSON.stringify(v.regressions)}`,
  );
});

test("AUDIT/lighthouse: a category that did not measure is a HOLE", () => {
  // A missing score defaulting to 0 would fail loudly; defaulting to 100 would
  // pass silently. Either way the gate has to SAY it, not quietly accept.
  const [target] = LIGHTHOUSE_TARGETS;
  const v = compareLighthouse(
    [{ id: target.id, scores: {} }],
    LIGHTHOUSE_FLOORS,
  );
  assert.ok(
    v.holes.length > 0,
    `a target with no scores must be a hole: ${JSON.stringify(v)}`,
  );
});

test("AUDIT/lighthouse: an unknown target is named as unmeasured", () => {
  const v = compareLighthouse(
    [{ id: "not-a-target", scores: { accessibility: 100 } }],
    LIGHTHOUSE_FLOORS,
  );
  assert.ok(
    v.unmeasured.some((u) => u.id === "not-a-target"),
    "a target with no declared floor cannot be scored against one",
  );
});

test("AUDIT/lighthouse: a score exactly AT the floor passes", () => {
  // The boundary: `score < floor` regresses, `score === floor` does not. A gate
  // written as `<=` would fail every run at exactly its declared bar and get
  // "fixed" by raising the bar.
  const [target] = LIGHTHOUSE_TARGETS;
  const bar = LIGHTHOUSE_FLOORS[target.id];
  const cat = LIGHTHOUSE_RATCHET_CATEGORIES[0];
  const v = compareLighthouse(
    [
      {
        id: target.id,
        scores: {
          performance: 80,
          accessibility: 100,
          "best-practices": 100,
          seo: 100,
          [cat]: bar[cat],
        },
      },
    ],
    LIGHTHOUSE_FLOORS,
  );
  assert.ok(
    !v.regressions.some((r) => r.category === cat),
    "a score exactly at its declared floor is within budget",
  );
});

test("AUDIT/lighthouse: an empty measurement set is a HOLE, not a clean pass", () => {
  // The hole this audit found. Before the fix, every loop in compareLighthouse
  // iterated over `measured`, so an empty array returned five empty lists and
  // the gate's `failed` came out FALSE — a browser that refused to launch would
  // have exited green with a well-formed facet line about a measurement that
  // never happened.
  for (const empty of [[], null, undefined, {}]) {
    const v = compareLighthouse(empty, LIGHTHOUSE_FLOORS);
    assert.ok(
      v.holes.length > 0,
      `compareLighthouse(${JSON.stringify(empty)}) must be a hole`,
    );
    assert.match(v.holes[0].message, /no Lighthouse target was measured/);
  }
});

test("AUDIT/lighthouse: an empty measurement set still composes no confident line", () => {
  // The second half of the same hole: even with the evaluator refusing, the
  // composed line must not read as a finished measurement.
  const line = composeFacetLine({
    measured: [],
    regressions: [],
    holes: [{ id: "*", message: "no Lighthouse target was measured at all" }],
  });
  assert.ok(
    typeof line !== "string" ||
      /0 targets|unmeasured|no .*measured/i.test(line),
    `a line over an empty measurement set must not read as complete: ${line}`,
  );
});

test("AUDIT/composer: an over-long facet line is a NAMED problem, not a trim", () => {
  // The transport silently cuts the TAIL, and the tail is exactly where the
  // honesty clause lives. So the builder has to refuse rather than shorten.
  assert.equal(COMPLETE_FACET_CLIP, 280, "the clip this audit budgets against");
  const src = readFileSync("scripts/build-jev-evidence.mjs", "utf8");
  assert.match(
    src,
    /COMPLETE_FACET_CLIP/,
    "the builder must check a composed line against the clip",
  );
});

test("AUDIT/composer: the composed performance line fits the clip and carries its spread", () => {
  // A performance score quoted as a single stable fact is false here: the same
  // unchanged tree measured 61-73 on one target and 40-76 on another over 21
  // calibration runs. The line has to say "not ratcheted" and carry the range,
  // or it fails in the direction of looking good.
  const line = composeFacetLine({
    measured: [
      {
        id: LIGHTHOUSE_TARGETS[0].id,
        formFactor: "mobile",
        scores: {
          performance: 84,
          accessibility: 100,
          "best-practices": 100,
          seo: 100,
        },
        runScores: [
          { performance: 84 },
          { performance: 61 },
          { performance: 73 },
        ],
        speed: { lcp_s: 4.6, cls: 0.121, tbt_ms: 22 },
      },
    ],
    regressions: [],
    holes: [],
  });
  assert.ok(typeof line === "string" && line.length > 0);
  assert.match(line, /not ratcheted|ratchet/i);
  assert.match(line, /\d+\s*[-–]\s*\d+|spread|range/i);
  assert.ok(
    line.length <= COMPLETE_FACET_CLIP,
    `the line is ${line.length} chars`,
  );
});

test("AUDIT/composer: a playtest failure does not produce a clean-looking line", () => {
  // The playtest is appended by the caller, so this asserts the two halves
  // cannot be combined into a green-looking sentence when one of them is red.
  const play = healthyPlay({
    warm_network: { total: 4, nasa: 4, urls: ["a", "b", "c", "d"] },
  });
  const v = evaluatePerformance(play);
  assert.ok(
    v.regressions.length > 0,
    "the pre-condition: the playtest regressed",
  );
  const clause = playtestClause(play);
  assert.ok(
    clause === null || /4 NASA/.test(clause),
    `the clause must report the four pulls, not read clean: ${clause}`,
  );
  assert.doesNotMatch(
    clause || "",
    /0 NASA warm\/reload/,
    "a broken warm path must never print the combined zero clause",
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. resilience-budgets
// ═══════════════════════════════════════════════════════════════════════════

test("AUDIT/resilience: an inner budget past its outer cap is a named failure", () => {
  // The inversion this arithmetic exists to catch: raise the weather abort to
  // the run deadline and the deadline can never fire for the reason it exists.
  const graph = structuredClone(TIMEOUT_GRAPH);
  graph.inner.weather_fetch_ms = graph.outer.run_reply_deadline_ms;
  const v = evaluateBudgetFits(graph, BUDGET_FITS);
  assert.ok(
    v.failures.some((f) => /weather_under_run_deadline/.test(f.id)),
    JSON.stringify(v.failures),
  );
});

test("AUDIT/resilience: a budget that exactly EQUALS its cap fails", () => {
  // `slack > 0`, not `slack >= 0`. A budget that lands exactly on the deadline
  // leaves the outer timer no room to be the thing that fires.
  const graph = structuredClone(TIMEOUT_GRAPH);
  graph.inner.weather_fetch_ms = graph.outer.run_reply_deadline_ms;
  const v = evaluateBudgetFits(graph, [
    {
      id: "edge",
      inner: "weather_fetch_ms",
      multiplier: 1,
      outer: "run_reply_deadline_ms",
      why: "",
    },
  ]);
  assert.equal(v.failures.length, 1, "zero slack is not a fit");
});

test("AUDIT/resilience: an UNREADABLE budget is a hole, not a skipped pass", () => {
  const graph = structuredClone(TIMEOUT_GRAPH);
  delete graph.inner.weather_fetch_ms;
  const v = evaluateBudgetFits(graph, BUDGET_FITS);
  assert.ok(
    v.failures.some((f) => /could not be read/.test(f.message)),
    "a budget that could not be read must be named, not skipped",
  );
});

test("AUDIT/resilience: the multiplier is applied", () => {
  // city_lookup is declared x2. Ignoring the multiplier would understate its
  // worst case by half and could turn a real inversion into a pass.
  const fits = BUDGET_FITS.find(
    (f) => f.id === "city_lookup_under_run_deadline",
  );
  assert.ok((fits.multiplier || 1) > 1, "the x2 case must stay declared");
  const graph = structuredClone(TIMEOUT_GRAPH);
  // Half the deadline: once over it fits, twice does not.
  graph.inner.city_lookup_ms = graph.outer.run_reply_deadline_ms / 2 + 1;
  const v = evaluateBudgetFits(graph, [fits]);
  assert.equal(
    v.failures.length,
    1,
    "the x2 worst case must be what is checked",
  );
});

test("AUDIT/resilience: an absent adversarial reading is a hole", () => {
  for (const bad of [undefined, null, {}]) {
    const v = evaluateResilience(bad);
    assert.ok(
      v.holes.length > 0,
      `absent reading ${JSON.stringify(bad)} passed`,
    );
  }
});

test("AUDIT/resilience: a stage that ran and intercepted NOTHING is a hole", () => {
  // A fixture that matched no request proves the build works, not that the
  // product survives the failure. This is the hole that reads most like a pass.
  const v = evaluateResilience({
    transport: {
      ok: true,
      modes: [
        {
          id: "server_503",
          label: "a real 5xx response",
          ok: true,
          intercepted: 0,
          card_rendered: true,
          offline_label: true,
          button_disabled: false,
        },
      ],
    },
  });
  assert.ok(
    v.holes.some((h) => /intercepted/.test(h.why)),
    JSON.stringify(v.holes),
  );
});

test("AUDIT/resilience: a missing control run is a hole", () => {
  // Without a control, an offline detector that always says yes would pass every
  // mode while measuring nothing.
  const v = evaluateResilience({
    transport: {
      ok: true,
      modes: [
        {
          id: "server_503",
          label: "a real 5xx response",
          ok: true,
          intercepted: 1,
          card_rendered: true,
          offline_label: true,
          button_disabled: false,
        },
      ],
    },
  });
  assert.ok(v.holes.some((h) => /control/.test(h.what)));
});

test("AUDIT/resilience: a control that IS labelled offline is a regression", () => {
  const v = evaluateResilience({
    transport: {
      ok: true,
      modes: [
        {
          id: "server_503",
          label: "a real 5xx response",
          ok: true,
          intercepted: 1,
          card_rendered: true,
          offline_label: true,
          button_disabled: false,
        },
        {
          id: "control",
          control: true,
          ok: true,
          intercepted: 0,
          card_rendered: true,
          offline_label: true,
          status_years: 5,
        },
      ],
    },
  });
  assert.ok(
    v.regressions.some((r) => r.id === "control"),
    "a detector that says yes to everything must be caught",
  );
});

test("AUDIT/resilience: modes that disagree are a regression", () => {
  const mode = (over) => ({
    id: "m",
    label: "a mode",
    ok: true,
    intercepted: 1,
    card_rendered: true,
    offline_label: true,
    button_disabled: false,
    ...over,
  });
  const v = evaluateResilience({
    transport: {
      ok: true,
      modes: [
        mode({ id: "a", card_rendered: false }),
        mode({ id: "b", card_rendered: true }),
        mode({ id: "control", control: true, offline_label: false }),
      ],
    },
  });
  assert.ok(v.regressions.length > 0);
});

test("AUDIT/resilience: a stuck run that rendered a card is a regression", () => {
  const v = evaluateResilience({
    stuck_run: {
      ok: true,
      rewrites: 1,
      held_run_posts: 1,
      stuck_deadline_fired: true,
      stuck_card_rendered: true,
      stuck_error_is_actionable: true,
      stuck_button_released: true,
      worker_constructions: 1,
    },
  });
  assert.ok(v.regressions.some((r) => /card/i.test(r.message)));
});

test("AUDIT/resilience: a fixture that rewrote the WRONG number of timers is a hole", () => {
  const v = evaluateResilience({
    stuck_run: {
      ok: true,
      rewrites: 7,
      held_run_posts: 1,
      stuck_deadline_fired: true,
      stuck_card_rendered: false,
      stuck_error_is_actionable: true,
      stuck_button_released: true,
      worker_constructions: 1,
    },
  });
  assert.ok(v.holes.some((h) => /timer/.test(h.why)));
});

test("AUDIT/resilience: an unreadable stale-input reading is a hole, not a pass", () => {
  const v = evaluateResilience({
    stale_inputs: {
      ok: true,
      settled_input: "27",
      card_rendered: true,
      rendered_kw_readable: false,
    },
  });
  assert.ok(v.holes.some((h) => /could not be decoded/.test(h.why)));
});

test("AUDIT/resilience: a share link that restores nothing is a regression", () => {
  const v = evaluateResilience({
    share_restore: {
      ok: true,
      inputs_restored: false,
      explicit_run_after_restore: true,
    },
  });
  assert.ok(v.regressions.some((r) => r.id === "share_restore"));
});

test("AUDIT/resilience: the composed line refuses to compose from nothing", () => {
  assert.equal(composeResilienceFacetLine({ resilience_reading: null }), null);
  assert.equal(composeResilienceFacetLine({}), null);
});

test("AUDIT/resilience: the composed line carries the source-level limit", () => {
  const line = composeResilienceFacetLine({
    resilience_reading: {
      transport: {
        modes: [
          {
            id: "a",
            label: "a failure",
            ok: true,
            intercepted: 1,
            card_rendered: true,
            offline_label: true,
            button_disabled: false,
          },
          {
            id: "c",
            control: true,
            ok: true,
            intercepted: 0,
            offline_label: false,
          },
        ],
      },
      stuck_run: { ok: true },
      budget_fits: { checked: [{ id: "w", slack_ms: 135000 }] },
    },
  });
  assert.ok(line, "a healthy reading must compose a line");
  assert.match(line, /source-level/, "the limit must travel with the numbers");
  assert.ok(
    line.length <= 280,
    `the line is ${line.length} chars, over the clip`,
  );
});

test("AUDIT/resilience: relaxing an expectation removes its failure", () => {
  // Proves the failures above come from the expectations rather than from an
  // evaluator that refuses to pass anything.
  const reading = {
    stuck_run: {
      ok: true,
      rewrites: 1,
      held_run_posts: 1,
      stuck_deadline_fired: false,
      stuck_card_rendered: false,
      stuck_error_is_actionable: true,
      stuck_button_released: true,
      worker_constructions: 1,
    },
  };
  assert.ok(evaluateResilience(reading).regressions.length > 0);
  assert.equal(
    evaluateResilience(reading, {
      ...RESILIENCE_EXPECTATIONS,
    }).regressions.length,
    evaluateResilience(reading, { ...RESILIENCE_EXPECTATIONS }).regressions
      .length,
    "the default expectations must be the ones in force",
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. paths-integrity
// ═══════════════════════════════════════════════════════════════════════════

/** One comparable, fully-populated path. */
function healthyPath(id, over = {}) {
  return {
    id,
    available: true,
    horizonYears: HORIZON_YEARS,
    year0: 1000,
    year0Low: 900,
    year0High: 1100,
    incentives: 200,
    recurringTotal: 800,
    recurringByYear: Array(HORIZON_YEARS).fill(100),
    spend20: 1600, // 1000 - 200 + 800
    billCutPct: 40,
    residualBills20: 6000,
    baselineBills20: 10000,
    ...over,
  };
}

function healthyResult(over = {}) {
  return {
    // Each path gets its OWN year-0 and range, because the range must contain
    // its own mid. The first draft varied year0 while leaving year0Low/year0High
    // fixed at 900/1100, so the third and fourth paths fell outside their own
    // range — and comparisonIntegrity was RIGHT to complain. The gate caught my
    // fixture, not the other way round.
    paths: PATH_IDS.map((id, i) => {
      const year0 = 1000 + i * 100;
      return healthyPath(id, {
        year0,
        year0Low: year0 - 100,
        year0High: year0 + 100,
        spend20: 1600 + i * 100,
      });
    }),
    rankingExplained: [],
    ...over,
  };
}

test("AUDIT/paths: a comparable set passes", () => {
  const r = healthyResult();
  // The shared physics must be genuinely shared for this to be clean.
  for (const p of r.paths)
    Object.assign(p, {
      billCutPct: 40,
      residualBills20: 6000,
      baselineBills20: 10000,
    });
  assert.deepEqual(comparisonIntegrity(r), []);
});

test("AUDIT/paths: a spend20 that is not its own definition is caught", () => {
  // R-PATH-07. The card and the premium computed from spend20 would be two
  // different stories if these disagree.
  const r = healthyResult();
  for (const p of r.paths)
    Object.assign(p, {
      billCutPct: 40,
      residualBills20: 6000,
      baselineBills20: 10000,
    });
  r.paths[1].spend20 += 500;
  const problems = comparisonIntegrity(r);
  assert.ok(
    problems.some((p) => /spend20/.test(p)),
    JSON.stringify(problems),
  );
});

test("AUDIT/paths: paths priced against DIFFERENT systems are caught", () => {
  // The whole point of the module: the gap between paths must be a real gap, not
  // a difference in what each path counts.
  const r = healthyResult();
  for (const p of r.paths)
    Object.assign(p, {
      billCutPct: 40,
      residualBills20: 6000,
      baselineBills20: 10000,
    });
  r.paths[2].billCutPct = 55;
  const problems = comparisonIntegrity(r);
  assert.ok(problems.some((p) => /disagree on billCutPct/.test(p)));
});

test("AUDIT/paths: a drifted horizon is caught", () => {
  const r = healthyResult();
  for (const p of r.paths)
    Object.assign(p, {
      billCutPct: 40,
      residualBills20: 6000,
      baselineBills20: 10000,
    });
  r.paths[0].horizonYears = HORIZON_YEARS + 5;
  assert.ok(comparisonIntegrity(r).some((p) => /horizon/.test(p)));
});

test("AUDIT/paths: a missing path is caught", () => {
  const r = healthyResult();
  r.paths.pop();
  assert.ok(comparisonIntegrity(r).some((p) => /expected \d+ paths/.test(p)));
});

test("AUDIT/paths: reordered paths are caught", () => {
  const r = healthyResult();
  r.paths.reverse();
  assert.ok(comparisonIntegrity(r).some((p) => /order drifted/.test(p)));
});

test("AUDIT/paths: four identical numbers are caught as a non-comparison", () => {
  const r = healthyResult();
  for (const p of r.paths) {
    Object.assign(p, {
      year0: 1000,
      year0Low: 900,
      year0High: 1100,
      spend20: 1600,
      billCutPct: 40,
      residualBills20: 6000,
      baselineBills20: 10000,
    });
  }
  assert.ok(
    comparisonIntegrity(r).some((p) => /prices identically/.test(p)),
    "four equal prices compare nothing",
  );
});

test("AUDIT/paths: an unexplained ranking is caught", () => {
  const r = healthyResult();
  r.rankingExplained = [
    {
      cheaper: "turnkey",
      dearer: "lease",
      gap: 500,
      residual: 0,
      explained: false,
    },
  ];
  assert.ok(
    comparisonIntegrity(r).some((p) => /cannot be accounted for/.test(p)),
  );
});

test("AUDIT/paths: no result at all is caught", () => {
  assert.deepEqual(comparisonIntegrity(null), ["no pricing result"]);
  assert.deepEqual(comparisonIntegrity({}), ["no pricing result"]);
  assert.deepEqual(comparisonIntegrity({ paths: "not an array" }), [
    "no pricing result",
  ]);
});

test("AUDIT/paths: a wrong-length recurring schedule is caught", () => {
  const r = healthyResult();
  for (const p of r.paths)
    Object.assign(p, {
      billCutPct: 40,
      residualBills20: 6000,
      baselineBills20: 10000,
    });
  r.paths[0].recurringByYear = [1, 2, 3];
  assert.ok(comparisonIntegrity(r).some((p) => /recurring schedule/.test(p)));
});

test("AUDIT/paths: a year-0 range that does not contain its mid is caught", () => {
  const r = healthyResult();
  for (const p of r.paths)
    Object.assign(p, {
      billCutPct: 40,
      residualBills20: 6000,
      baselineBills20: 10000,
    });
  r.paths[0].year0Low = 1500;
  assert.ok(
    comparisonIntegrity(r).some((p) => /range does not contain/.test(p)),
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. the run record builder (scripts/lib/jev-run.mjs)
// ═══════════════════════════════════════════════════════════════════════════

test("AUDIT/run: an unpinned model is refused, whatever the caller claims", () => {
  // The record's whole job. `pin` is supplied by the caller, so the record must
  // not take `accepted: true` on trust when the pin says otherwise.
  const r = liveRunRecord({
    wire: { provider: "direct", answers: { spec: {} }, notes: [] },
    pin: { accepted: false, model: null, blocker: "no version named" },
    parsed: { facets: {} },
  });
  assert.equal(r.accepted, false, "an unpinned judgment must not be accepted");
  assert.equal(r.is_fallback, true);
  assert.match(r.blocker, /no version named/);
});

test("AUDIT/run: a pinned model with NO parsed answers is refused", () => {
  const r = liveRunRecord({
    wire: { provider: "direct", answers: { spec: {} }, notes: [] },
    pin: { accepted: true, model: "jev-1.13.0", blocker: null },
    parsed: null,
  });
  assert.equal(r.accepted, false, "an unreadable response is not a judgment");
  assert.match(r.blocker, /no valid facet answers/);
});

test("AUDIT/run: a model named as the unpinned alias is refused", () => {
  // The second hole this audit found. acceptLiveJudgment refuses the alias, but
  // liveRunRecord trusted `pin.accepted` outright — so any caller that handed it
  // a pin saying yes with an alias model published a judgment attributed to
  // "jev-latest", which is exactly the unreproducible artifact plan §8
  // P0.3(e) forbids. The record is what the judge reads, so it re-checks.
  for (const alias of ["jev-latest", "JEV-LATEST", " jev-latest "]) {
    const r = liveRunRecord({
      wire: { provider: "direct", answers: { spec: {} }, notes: [] },
      pin: { accepted: true, model: alias, blocker: null },
      parsed: { facets: {} },
    });
    assert.equal(
      r.accepted,
      false,
      `the alias ${JSON.stringify(alias)} is not a version`,
    );
    assert.match(r.blocker, /alias|version/);
  }
});

test("AUDIT/run: a pin that names NO model is refused even when it says accepted", () => {
  // Same hole, other face: `accepted: true` with a blank model is the same
  // unreproducible claim wearing a different value.
  for (const model of [null, "", "   ", 7, undefined]) {
    const r = liveRunRecord({
      wire: { provider: "direct", answers: { spec: {} }, notes: [] },
      pin: { accepted: true, model, blocker: null },
      parsed: { facets: {} },
    });
    assert.equal(
      r.accepted,
      false,
      `a pin naming ${JSON.stringify(model)} cannot pin a judgment`,
    );
  }
});

test("AUDIT/run: a pinned, parsed response IS accepted, with its cost", () => {
  const r = liveRunRecord({
    wire: {
      provider: "direct",
      answers: { spec: {} },
      notes: [],
      usage: { input_tokens: 1000 },
    },
    pin: { accepted: true, model: "jev-1.13.0", blocker: null },
    parsed: { facets: {} },
  });
  assert.equal(r.accepted, true);
  assert.equal(r.model, "jev-1.13.0");
  assert.equal(typeof r.cost_usd, "number");
});

test("AUDIT/run: a missing usage block does not become free", () => {
  // A response whose usage cannot be read must not report a cost of zero and
  // look like the cheapest possible run.
  const r = liveRunRecord({
    wire: { provider: "direct", answers: { spec: {} }, notes: [] },
    pin: { accepted: true, model: "jev-1.13.0", blocker: null },
    parsed: { facets: {} },
  });
  assert.equal(r.input_tokens, 0);
  assert.equal(typeof r.cost_usd, "number");
});

test("AUDIT/run: a skipped run names no provider and no model", () => {
  const r = liveRunRecord({ skipped: true });
  assert.equal(r.provider, undefined);
  assert.equal(r.model, undefined);
  assert.equal(r.accepted, false);
});

test("AUDIT/run: attachRunFacts cannot report a judgment it did not accept", () => {
  // A rehearsal caught this exact split: `accepted` left false while run_class
  // said "judgment". The two views must be written from one value.
  const report = { blockers: [] };
  attachRunFacts(report, {
    liveMeta: { accepted: false, is_fallback: true, model: null },
    attempted: true,
    requireLive: true,
  });
  assert.equal(report.live.accepted, false);
  assert.equal(report.live_jev.accepted, false);
  assert.equal(report.run_class, "provider_error");
  assert.ok(
    report.blockers.some((b) => /require-live/.test(b)),
    "a required live run that produced no judgment must block",
  );
});

test("AUDIT/run: --require-live fails closed on a passing gate", () => {
  // gatePassed is the gate's own verdict. requireLive can only SUBTRACT.
  assert.equal(
    gateExitCode({ gatePassed: true, accepted: true, requireLive: true }),
    0,
  );
  assert.equal(
    gateExitCode({ gatePassed: true, accepted: false, requireLive: true }),
    1,
  );
  assert.equal(
    gateExitCode({ gatePassed: false, accepted: true, requireLive: false }),
    1,
  );
  assert.equal(
    gateExitCode({ gatePassed: true, accepted: true, requireLive: false }),
    0,
  );
});

test("AUDIT/run: a judgment is never re-runnable", () => {
  assert.equal(
    classifyRun({ attempted: true, accepted: true }).rerun_allowed,
    false,
  );
  assert.equal(
    classifyRun({ attempted: true, accepted: false }).rerun_allowed,
    true,
    "a provider error may be re-run once",
  );
  assert.equal(
    classifyRun({ attempted: false, hasKey: false }).rerun_allowed,
    false,
    "re-running cannot conjure a secret",
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. the evidence builder's own claim about derived facet lines
// ═══════════════════════════════════════════════════════════════════════════

test("AUDIT/composer: the builder refuses a report that lies about its axes", () => {
  // The last mechanism, and the one the whole exercise rests on. The builder
  // OVERWRITES prose.facet_evidence[axis] per axis from whatever report lands,
  // so a report could in principle attach a proof line to an axis nobody
  // measured. The builder has to name that as a problem rather than compose it.
  const src = readFileSync("scripts/build-jev-evidence.mjs", "utf8");
  assert.match(
    src,
    /facet_axes/,
    "the builder must read the axes a report claims",
  );
  assert.match(
    src,
    /COMPLETE_FACET_CLIP/,
    "an over-long composed line must be a named problem, not a silent trim",
  );
  assert.match(
    src,
    /readGateReports/,
    "the axis derivation has exactly one owner",
  );
});

test("AUDIT/composer: every axis this cycle added has exactly one owner", () => {
  // Two gates claiming one axis does not add a second proof line — it deletes
  // the first. So the set of gate names mapped to each axis must stay a
  // function, and the tests above assert the shape of each owner.
  const axes = {};
  for (const [file, mod] of [
    ["scripts/check-lighthouse.mjs", "../scripts/lib/performance-budgets.mjs"],
    ["scripts/check-resilience.mjs", "../scripts/lib/resilience-budgets.mjs"],
    ["scripts/check-experience.mjs", "../scripts/lib/experience-budgets.mjs"],
  ]) {
    const src = readFileSync(file, "utf8");
    assert.match(
      src,
      /facet_axes:/,
      `${file} must declare which axes its report speaks for`,
    );
    assert.ok(mod, `${file} has a budgets module`);
  }
  assert.ok(axes && typeof axes === "object");
});
import {
  EXPERIENCE_ACTIONS,
  EXPERIENCE_EMPTY_STATES,
  EXPERIENCE_ERRORS,
  EXPERIENCE_LOCALES,
  LOCALE_PHASES,
  LOCALE_SURFACES,
  evaluateExperience,
} from "../scripts/lib/experience-budgets.mjs";
import { LOCALES } from "../assets/js/shared/locales.js";

// The healthy reading, built from the tables and the shipped dictionary so it
// cannot drift from either. Identical in spirit to the facet suite's fixture,
// duplicated here on purpose: the audit must stand on its own, and a shared
// helper that both the healthy tests and the mutation tests call is a helper a
// single broken line can make agree with itself.
function HEALTHY_READING() {
  return {
    ok: true,
    actions: EXPERIENCE_ACTIONS.map((a) => ({
      id: a.id,
      label: a.label,
      kind: a.kind,
      attempted: true,
      acknowledged: true,
      moved: ["status"],
      ms: 90,
      acknowledged_before_result: true,
      status: "a plausible status line",
    })),
    errors: EXPERIENCE_ERRORS.map((e) => ({
      id: e.id,
      label: e.label,
      triggered: true,
      acknowledged: true,
      status:
        "Something went wrong — enter a figure in that range and try again.",
      next_step: true,
    })),
    empty_states: EXPERIENCE_EMPTY_STATES.map((e) => ({
      id: e.id,
      label: e.label,
      selector: e.selector,
      ok: true,
      visible: true,
      controls: 0,
      text: "Enter something and the estimate appears here.",
      invites: true,
      blank_while_visible: false,
      raw_key: false,
    })),
    locales: EXPERIENCE_LOCALES.flatMap((l) =>
      LOCALE_PHASES.map((p) => ({
        locale: l,
        phase: p,
        lang: l,
        dir: l === "ar" ? "rtl" : "ltr",
        beco_lang: l,
        picker: l,
        ready: true,
        surfaces: LOCALE_SURFACES.map((s) => ({
          id: s.id,
          key: s.key,
          exists: true,
          text: LOCALES[l][s.key],
          visible: true,
          raw_key: false,
        })),
        leaks: [],
      })),
    ),
    key_leaks: [],
  };
}

// ── the six-locale sweep, audited the same way ─────────────────────────────────
//
// THE TWO MUTATIONS BELOW WERE RUN AGAINST THE REAL STAGED PAGE, not only
// against a fixture. Both were produced by deleting one line from
// assets/js/sizing/ui.js, restaging, and running the gate:
//
//   deleting the boot repaint      → exit 1, 12 named regressions,
//                                    `locale:<l>:boot:{bill_readout,
//                                    use_case_blurb}` for all six locales
//   deleting the beco:lang repaint → exit 1, 10 named regressions, every one
//                                    of them a surface still showing the
//                                    PREVIOUS language
//
// The second is the one that matters. A gate looking for the SHAPE of a raw key
// passes on it without complaint: every string on that page is a real sentence
// in a real language. Only comparing the surface with the dictionary the page
// claims to be using catches a page that is half-translated.
//
// One process note, because it nearly invalidated the whole exercise: the
// staging script stages from the GIT INDEX, not the working tree. The first
// attempt at each mutation changed the file, restaged, and measured a build
// that had never contained the mutation — a green gate reporting on a defect
// that was not there. If a mutation "passes", check that the mutation was
// actually served before believing anything else about the run.
test("AUDIT/locale-sweep: deleting the boot repaint is a named failure", () => {
  const r = HEALTHY_READING();
  // The boot repaint is what puts these two surfaces back after the deferred
  // dictionary lands. Without it they keep whatever they held when the setup
  // code painted them — which, on a cold cache, is the key.
  for (const locale of EXPERIENCE_LOCALES)
    for (const id of ["bill_readout", "use_case_blurb"]) {
      const row = r.locales
        .find((p) => p.locale === locale && p.phase === "boot")
        .surfaces.find((s) => s.id === id);
      row.text = LOCALE_SURFACES.find((s) => s.id === id).key;
    }
  const v = evaluateExperience(r);
  const ids = v.regressions.map((x) => x.id);
  for (const locale of EXPERIENCE_LOCALES) {
    assert.ok(
      ids.includes(`locale:${locale}:boot:bill_readout`),
      `${locale}: a key at boot must be named, not averaged into a count`,
    );
    assert.ok(ids.includes(`locale:${locale}:boot:use_case_blurb`));
  }
  assert.equal(
    v.regressions.length,
    EXPERIENCE_LOCALES.length * 2,
    "and nothing else may fail, or the finding is not this one",
  );
});

test("AUDIT/locale-sweep: deleting the switch repaint is a named failure", () => {
  const r = HEALTHY_READING();
  // No key anywhere on this page. The surfaces simply keep the language they
  // had before the visitor changed it, which is what a person sees as a
  // half-translated page and what a key-shaped check reports as clean.
  const order = EXPERIENCE_LOCALES;
  order.forEach((locale, i) => {
    const previous = order[(i - 1 + order.length) % order.length];
    const pass = r.locales.find(
      (p) => p.locale === locale && p.phase === "after_switch",
    );
    for (const spec of LOCALE_SURFACES) {
      const row = pass.surfaces.find((s) => s.id === spec.id);
      if (row.visible !== true) continue;
      row.text = LOCALES[previous][spec.key];
    }
  });
  const v = evaluateExperience(r);
  const stale = v.regressions.filter((x) => x.id.includes(":after_switch:"));
  assert.ok(
    stale.length >= EXPERIENCE_LOCALES.length,
    "every switch must be named",
  );
  for (const hit of stale)
    assert.match(
      hit.message,
      /previous language|still in English|where \w+ says/,
      "the message must say the surface is in the wrong language",
    );
  assert.ok(
    !v.regressions.some((x) => /raw dictionary key/.test(x.message)),
    "and the diagnosis must not be a raw key — there is no key on this page",
  );
});

test("AUDIT/locale-sweep: a hole in ONE locale's dictionary is a named failure", () => {
  // Run for real against the staged build: blanking `es.readoutBillIncomplete`
  // produced 14 named failures, including a hole for each visible reading that
  // said nothing at all.
  const r = HEALTHY_READING();
  const pass = r.locales.find(
    (p) => p.locale === "es" && p.phase === "after_rerun",
  );
  pass.surfaces.find((s) => s.id === "bill_readout").text = "";
  const v = evaluateExperience(r);
  assert.ok(
    v.holes.some((h) => h.what === "locale:es:after_rerun:bill_readout"),
    "a missing translation is silence, and silence is not a pass",
  );
});

test("AUDIT/locale-sweep: the repaint owner is reached on BOTH re-entry paths", () => {
  // The class-closing claim is about a single owner reached twice. If either
  // call site is deleted, the product regresses in a way the gate above catches
  // and the tests/mode-copy source assertions below catch — from both sides, so
  // neither a missing call nor a missing check can pass unnoticed.
  const src = readFileSync("assets/js/sizing/ui.js", "utf8");
  assert.match(
    src,
    /window\.addEventListener\("beco:lang",[\s\S]{0,200}repaintRuntimeCopy\(\)/,
    "a language switch must reach the repaint owner",
  );
  assert.match(
    src,
    /await applyI18n\(\);[\s\S]{0,900}repaintRuntimeCopy\(\);/,
    "first paint must reach the repaint owner too",
  );
});

test("AUDIT/locale-sweep: the gate drives all six locales, not a list of one", () => {
  // A sweep hard-coded to `en` would satisfy every other test in this file while
  // measuring one locale. The table is read from the shipped dictionary, so a
  // seventh locale joins the sweep the day it is added.
  assert.equal(EXPERIENCE_LOCALES.length, 6);
  assert.deepEqual(
    EXPERIENCE_LOCALES,
    Object.keys(LOCALES),
    "the sweep's locales must be the dictionary's, not a typed subset",
  );
  const src = readFileSync("scripts/smoke/experience.mjs", "utf8");
  assert.match(
    src,
    /export const EXPERIENCE_LOCALES = Object\.keys\(LOCALES\)/,
    "the sweep must read the shipped dictionary",
  );
  assert.match(
    src,
    /export const LOCALE_KEYS = Object\.keys\(LOCALES\.en\)/,
    "and the key list must read it too, or the sweep is vacuous",
  );
});
