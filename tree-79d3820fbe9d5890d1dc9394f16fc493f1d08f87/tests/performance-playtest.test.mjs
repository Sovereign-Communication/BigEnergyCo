// The `performance` facet was held because a real browser measurement existed
// and nothing composed it into the record — and then, when that was fixed, the
// measurement itself was wrong in a way that would have made the next version of
// this file a rubber stamp.
//
// The three failures these tests exist for, each of which has actually happened
// in this repo:
//
//   1. A COUNT THAT CANNOT SEE THE WORKER. The warm-window count came off the
//      PAGE session's Network domain. The sizing worker is a separate CDP
//      target, so a NASA pull it issued was invisible — and the claim being
//      measured is precisely "no redundant weather pulls". A gate that cannot
//      see the worker's traffic reports 0 for a worker that just fetched five
//      years of weather. That is a false zero, and a false zero on this facet is
//      indistinguishable from a pass.
//
//   2. A TIMESTAMP TAKEN BY THE HARNESS. The first-result split read
//      `performance.now()` when its 25 ms poll noticed the card. That is up to
//      25 ms LATE, which is long enough for a 37 KB module off localhost to
//      finish inside the gap and be filed "blocking" — on a build that had
//      already moved it behind a dynamic import. The measurement disagreed with
//      the source and looked like the source was wrong. Both sides of the
//      comparison have to be the browser's own timestamps.
//
//   3. A CLAIM THE RUN NEVER MADE. The facet line grew a warm clause while the
//      instrument behind it stayed the old one, so the line quoted claims the
//      run had not measured. A line is only as true as the reading it composes.
//
// Every budget clause below is MUTATION-CHECKED: the measurement is perturbed
// one field at a time and the evaluator's verdict must change. A gate nobody has
// proved bites is a comment with an exit code.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  composeFacetLine,
  composeFacetLineWithOmissions,
} from "../scripts/lib/lighthouse-budgets.mjs";
import {
  PERFORMANCE_BUDGETS,
  PERFORMANCE_FACET_AXES,
  PERFORMANCE_FIRST_MEASUREMENT,
  evaluatePerformance,
  playtestClause,
} from "../scripts/lib/performance-budgets.mjs";
import { LIGHTHOUSE_FACET_AXES } from "../scripts/lib/lighthouse-budgets.mjs";
import { COMPLETE_FACET_CLIP } from "../scripts/lib/jev-complete.mjs";

const GATE = "scripts/check-lighthouse.mjs";
const RUNTIME = "scripts/smoke/runtime.mjs";
const PLAY = "scripts/smoke/performance.mjs";

/** A Lighthouse report shaped like the one the gate writes, 14 targets wide. */
const PERF_SCORES = [61, 56, 100, 96, 87, 71, 73, 100, 57, 64, 100, 94, 93, 63];
const lighthouseReport = (extra = {}) => ({
  measured: PERF_SCORES.map((performance, i) => ({
    scores: {
      performance,
      accessibility: 100,
      "best-practices": i === 0 || i === 4 ? 96 : 100,
      seo: [5, 8, 13].includes(i) ? 63 : 100,
    },
  })),
  regressions: [],
  holes: [],
  ratchet_categories: ["accessibility", "best-practices", "seo"],
  ...extra,
});

/** A playtest reading shaped like the one the driver produces. */
const playtestReading = (extra = {}) => ({
  ok: true,
  worker_sessions: 2,
  cold_run: { ms: 5010, completed: true, started_run: true },
  cold_network: { total: 27, nasa: 3, urls: [] },
  first_result: {
    modules: 42,
    blocking_modules: 42,
    deferred_modules: 0,
    boot_issued_modules: 35,
    run_issued_modules: 7,
    card_at_ms: 13144,
  },
  warm_rerun: { ms: 41, started: true, cardPresent: true },
  warm_adjustments: {
    taken: 3,
    preview_median_ms: 8,
    confirm_median_ms: 1823,
    all_previews_rendered: true,
    all_followed_through: true,
  },
  warm_network: { total: 0, nasa: 0, urls: [] },
  warm_reload: {
    ok: true,
    ms: 4024,
    boot_requests: 83,
    warm_network: { nasa: 0 },
  },
  paths_unavailable: {
    ok: true,
    blocked_attempts: 1,
    card_rendered: true,
    paths_panel_rendered: false,
    eli5_rendered: false,
  },
  ...extra,
});

/** A deep-ish merge for one field, so each mutation changes exactly one thing. */
const withField = (base, path, value) => {
  const clone = structuredClone(base);
  const keys = path.split(".");
  let node = clone;
  for (const k of keys.slice(0, -1)) node = node[k];
  node[keys.at(-1)] = value;
  return clone;
};

// ── 1. the count has to be able to see the worker ───────────────────────────

test("PLAYTEST: the warm count can see the sizing worker's own traffic", () => {
  const src = readFileSync(PLAY, "utf8");
  // The sizing worker is its own CDP target. Without auto-attach plus a Network
  // domain per worker session, its NASA pulls never appear on the page session's
  // wire and the memoization claim reads 0 for the wrong reason.
  assert.match(
    src,
    /Target\.setAutoAttach/,
    "worker targets must auto-attach, or their requests are invisible",
  );
  assert.match(
    src,
    /Network\.enable/,
    "each attached session needs its own Network domain before it can be counted",
  );
  assert.match(
    src,
    /attachWorkerNetwork/,
    "the playtest must attach worker sessions rather than assume the page sees them",
  );
  // …and the count must actually be reported, so a reader can see how many
  // sessions were being watched. A count with no denominator is not evidence.
  assert.match(
    src,
    /worker_sessions/,
    "the report must carry how many sessions were watched",
  );
});

test("PLAYTEST: the runtime still records requests off the wire", () => {
  const runtime = readFileSync(RUNTIME, "utf8");
  assert.match(
    runtime,
    /Network\.requestWillBeSent/,
    "the CDP runtime must record requests so a window can be counted",
  );
  assert.match(
    runtime,
    /return \{ ws, send, evaluate, errors, requests, poll, close \}/,
    "the measurement reads the wire through the one existing CDP client",
  );
});

// ── 2. the timestamps have to be the browser's ──────────────────────────────

test("PLAYTEST: the card's arrival is timed by a DOM observer, not by the poll", () => {
  const src = readFileSync(PLAY, "utf8");
  assert.match(
    src,
    /MutationObserver/,
    "the card timestamp must come from the DOM's own mutation, not from the " +
      "polling loop that notices it",
  );
  // Both halves of the comparison must be the browser's clock, or the split is
  // the harness grading its own homework.
  assert.match(
    src,
    /s\.end <= cardAt/,
    "blocking/deferred is decided by WHEN, not by graph",
  );
  assert.match(
    src,
    /card_present_before_run/,
    "a stage whose card was already up must be refused, not read as a fast run",
  );
});

test("PLAYTEST: a stage that produced no first result is a hole, not a split", () => {
  // The split is computed only when a card timestamp exists AND the card was not
  // already present. Both absences are reported as no split rather than as zeros,
  // because "0 deferred modules" from a run that measured nothing is the most
  // dangerous sentence available about this facet.
  const none = evaluatePerformance(
    withField(playtestReading(), "first_result", null),
  );
  assert.match(
    none.notes.join(" "),
    /first-result split: none/,
    `an absent split must say so: ${none.notes.join(" | ")}`,
  );
  assert.equal(
    none.regressions.length,
    0,
    "an absent split is a note, not a defect",
  );
});

// ── 3. every budget clause bites ────────────────────────────────────────────

const MUTATIONS = [
  {
    name: "a warm re-run over budget",
    patch: (p) => withField(p, "warm_rerun.ms", 2500),
    expect: /warm_rerun/,
  },
  {
    name: "a cold run that never finished is not a fast run",
    patch: (p) => withField(p, "cold_run.ms", null),
    expect: /cold_run/,
    list: "holes",
  },
  {
    name: "a warm path that re-pulls weather",
    patch: (p) => withField(p, "warm_network.nasa", 2),
    expect: /warm_window_nasa/,
  },
  {
    name: "a reload that re-pulls weather, with only page RAM to hide behind",
    patch: (p) => withField(p, "warm_reload.warm_network.nasa", 3),
    expect: /warm_reload_nasa/,
  },
  {
    name: "a drag preview that stopped being instant",
    patch: (p) => withField(p, "warm_adjustments.preview_median_ms", 900),
    expect: /warm_preview_median/,
  },
  {
    name: "a confirm re-slice that never followed through",
    patch: (p) => withField(p, "warm_adjustments.all_followed_through", false),
    expect: /confirm/,
  },
  {
    name: "a sequence of zero adjustments",
    patch: (p) => withField(p, "warm_adjustments.taken", 0),
    expect: /adjustment/,
    list: "holes",
  },
  {
    name: "a cold stage that pulled no weather at all",
    patch: (p) => withField(p, "cold_network.nasa", 0),
    expect: /cold_network_nasa/,
  },
  {
    name: "a first result that depends on the pricing model",
    patch: (p) => withField(p, "paths_unavailable.card_rendered", false),
    expect: /first_result_independence/,
  },
  {
    name: "a block that never took, proving nothing about a missing module",
    patch: (p) => withField(p, "paths_unavailable.blocked_attempts", 0),
    expect: /first_result_independence/,
    list: "holes",
  },
  {
    name: "a priced panel with no model behind it",
    patch: (p) => withField(p, "paths_unavailable.paths_panel_rendered", true),
    expect: /d01_panel_without_model/,
  },
  {
    name: "an ELI5 turnkey sentence outliving its model",
    patch: (p) => withField(p, "paths_unavailable.eli5_rendered", true),
    expect: /d01_eli5_without_model/,
  },
  {
    name: "a reload that was never measured",
    patch: (p) => withField(p, "warm_reload", null),
    expect: /warm_reload/,
    list: "holes",
  },
];

for (const mutation of MUTATIONS) {
  test(`PLAYTEST: ${mutation.name} is caught`, () => {
    const list = mutation.list === "holes" ? "holes" : "regressions";
    const baseline = evaluatePerformance(playtestReading());
    assert.equal(
      baseline.regressions.length,
      0,
      "the unmutated reading must be clean, or this test proves nothing",
    );
    assert.equal(baseline.holes.length, 0, "and hole-free");

    const mutated = evaluatePerformance(mutation.patch(playtestReading()));
    const found = mutated[list].some((entry) =>
      mutation.expect.test(
        `${entry.what || ""} ${entry.message || ""} ${entry.why || ""}`,
      ),
    );
    assert.ok(
      found,
      `${mutation.name} produced no ${list} entry. A budget clause that cannot ` +
        `fail is a comment. Got: ${JSON.stringify(mutated[list])}`,
    );
  });
}

// ── 4. the budgets are declared from readings that are recorded ─────────────

test("PLAYTEST: every budget is traceable to a recorded reading", () => {
  const runs = PERFORMANCE_FIRST_MEASUREMENT.runs;
  // A budget much wider than the reading that set it has to say why, or it is
  // indistinguishable from a budget moved until CI went green.
  for (const [key, budget] of Object.entries(PERFORMANCE_BUDGETS)) {
    if (typeof budget !== "object") continue;
    assert.ok(
      typeof budget.why === "string" && budget.why.length > 20,
      `${key} has no stated reason for being ${budget.max}`,
    );
  }
  // The memoization budgets are ZERO, not "a small number". A tolerance here
  // would be a tolerance for the exact defect the claim is about.
  assert.equal(PERFORMANCE_BUDGETS.warm_window_nasa_max, 0);
  assert.equal(PERFORMANCE_BUDGETS.warm_reload_nasa_max, 0);

  // …and each timing budget must be at least as wide as the worst reading it was
  // declared from. A budget below its own evidence is a budget that would fail on
  // the run that produced it.
  const pairs = [
    ["cold_run_ms", "cold_run_ms"],
    ["warm_rerun_ms", "warm_rerun_ms"],
    ["preview_median_ms", "preview_ms"],
    ["confirm_median_ms", "confirm_ms"],
    ["warm_reload_ms", "warm_reload_ms"],
  ];
  for (const [budgetKey, readingKey] of pairs) {
    const worst = Math.max(...runs[readingKey]);
    assert.ok(
      PERFORMANCE_BUDGETS[budgetKey].max >= worst,
      `${budgetKey} budget ${PERFORMANCE_BUDGETS[budgetKey].max} is below its own ` +
        `worst recorded reading ${worst}`,
    );
  }
});

test("PLAYTEST: the sequence claim has a floor, because one sample is not a sequence", () => {
  assert.ok(PERFORMANCE_BUDGETS.adjustments_required >= 3);
  assert.match(
    PERFORMANCE_FIRST_MEASUREMENT.conditions.note,
    /worker/i,
    "the recording must state that worker traffic was counted, since that is " +
      "the condition the whole measurement rests on",
  );
});

// ── 5. the line composes from the run and fits the transport ────────────────

test("PLAYTEST: the measured numbers reach the judge's line", () => {
  const line = composeFacetLine(
    lighthouseReport({ warm_interaction: playtestReading() }),
  );
  assert.match(line, /cold 5\.0s/, `cold sizing run missing: ${line}`);
  assert.match(line, /repeat 41ms/, `warm re-run missing: ${line}`);
  assert.match(line, /drag 8ms/, `drag preview missing: ${line}`);
  assert.match(
    line,
    /1\.8s confirm/,
    `the slow confirm re-slice must not be dropped because the drag was fast: ${line}`,
  );
  assert.match(
    line,
    /0 NASA warm\/reload/,
    `the memoization claim is missing: ${line}`,
  );
  assert.match(
    line,
    /result renders without pricing model/,
    `the first-result independence claim is missing: ${line}`,
  );
  assert.ok(
    line.length <= COMPLETE_FACET_CLIP,
    `the composed line is ${line.length} chars, over the ${COMPLETE_FACET_CLIP}-char ` +
      "clip: it would be cut in transit and the axis would arrive without its numbers",
  );
});

test("PLAYTEST: the line states the limit of its own numbers", () => {
  const line = composeFacetLine(
    lighthouseReport({ warm_interaction: playtestReading() }),
  );
  // A timing quoted without its conditions is the same defect as a byte count
  // quoted without the graph it was measured on.
  assert.match(line, /1 Chrome/i, line);
  assert.match(line, /1 city/i, line);
});

test("PLAYTEST: a warm measurement does not launder the noisy first-paint score", () => {
  const line = composeFacetLine(
    lighthouseReport({ warm_interaction: playtestReading() }),
  );
  assert.match(line, /not ratcheted/i, line);
  assert.match(
    line,
    /over 21 runs/,
    `the calibration envelope is gone: ${line}`,
  );
});

test("PLAYTEST: no measurement means the line still says the claims are unmeasured", () => {
  for (const warm of [
    undefined,
    { ok: false, error: "no city suggestion for Honolulu" },
    { ok: false },
    // A partial reading: three of the numbers, none of the whole. Printing a
    // clause from this would be printing a claim the run did not make.
    { ok: true, cold_run: { ms: 5010 }, warm_rerun: { ms: 41 } },
  ]) {
    const line = composeFacetLine(
      lighthouseReport(warm === undefined ? {} : { warm_interaction: warm }),
    );
    assert.match(
      line,
      /not warm interactions or memoization/,
      `a missing or partial playtest must leave the limit standing: ${line}`,
    );
    assert.doesNotMatch(
      line,
      /PLAYTEST,/,
      `no playtest clause may be composed from a measurement that did not happen: ${line}`,
    );
  }
});

test("PLAYTEST: the clip degrades a sentence in place rather than cutting the tail", () => {
  const { line, omitted } = composeFacetLineWithOmissions(
    lighthouseReport({ warm_interaction: playtestReading() }),
  );
  assert.ok(
    line.length <= COMPLETE_FACET_CLIP,
    `line is ${line.length} chars; the fit did not do its job`,
  );
  // Whatever the fit gave up must be RECORDED, so a sentence that did not reach
  // the judge cannot vanish silently while the run reports green.
  for (const o of omitted)
    assert.ok(
      typeof o.sentence === "string" && o.sentence.length > 0,
      "an omission must name what was omitted",
    );
  // …and the honesty tail is never the thing that gets dropped.
  assert.match(line, /not ratcheted/i, `the honesty tail was cut: ${line}`);
  assert.match(line, /PLAYTEST,/, `the measurement itself was cut: ${line}`);
});

test("PLAYTEST: the line survives the slowest plausible run", () => {
  // A cold CI runner is slower than the machine the readings came from. The worst
  // case is asserted here rather than discovered as a silently clipped axis.
  const line = composeFacetLine(
    lighthouseReport({
      warm_interaction: playtestReading({
        cold_run: { ms: 24500 },
        warm_rerun: { ms: 1500 },
        warm_adjustments: {
          taken: 3,
          preview_median_ms: 120,
          confirm_median_ms: 12400,
          all_previews_rendered: true,
          all_followed_through: true,
        },
        warm_network: { total: 12, nasa: 0, urls: [] },
        warm_reload: {
          ok: true,
          ms: 19000,
          boot_requests: 90,
          warm_network: { nasa: 0 },
        },
      }),
    }),
  );
  assert.ok(
    line.length <= COMPLETE_FACET_CLIP,
    `worst case composes to ${line.length} chars, over the ${COMPLETE_FACET_CLIP}-char ` +
      "clip: shorten the clause, do not raise the clip",
  );
});

// ── 6. one owner per axis ───────────────────────────────────────────────────

test("PLAYTEST: the performance axis has exactly one owner", () => {
  // The evidence builder OVERWRITES prose.facet_evidence[axis] with the last
  // derived line it reads. Two gates declaring `performance` would not add a
  // second proof line — one of them would disappear without a word. The two
  // declarations are therefore the same list, checked here and at run time.
  assert.deepEqual(PERFORMANCE_FACET_AXES, LIGHTHOUSE_FACET_AXES);
  assert.deepEqual(PERFORMANCE_FACET_AXES, ["performance"]);
  const gate = readFileSync(GATE, "utf8");
  assert.match(
    gate,
    /playtest_facet_axes/,
    "the report must carry both declarations",
  );
  assert.match(
    gate,
    /axisOwnershipConflict/,
    "a disagreement between the two owners must stop the gate",
  );
});

// ── 7. the gate drives the real surface ─────────────────────────────────────

test("PLAYTEST: the gate measures it on the real surface, not from a fixture", () => {
  const gate = readFileSync(GATE, "utf8");
  assert.match(
    gate,
    /runPerformancePlaytest\(ctx, \{ url: srv\.url \}\)/,
    "the gate must drive the real page over the static server it already serves",
  );
  assert.match(
    gate,
    /measureWarmReload\(ctx/,
    "the warm RELOAD is a separate claim",
  );
  assert.match(
    gate,
    /measureWithPathsUnavailable\(ctx/,
    "first-result independence is proved by removal, so the stage must run",
  );
  assert.match(
    gate,
    /warm_interaction: warmInteraction/,
    "the report must carry the measurement, or the line cannot be composed from it",
  );
  assert.match(
    gate,
    /warmInteraction = \{ ok: false, error:/,
    "a failed playtest must be recorded as a hole, not invented",
  );
  assert.match(
    gate,
    /report\.facet_line\.length > COMPLETE_FACET_CLIP/,
    "an over-long facet line must fail the gate, not be cut in transit",
  );
  // Both lists reach the exit code. A measured-and-wrong playtest, or one that
  // could not be measured at all, cannot exit green beside a line that says the
  // interaction claims were measured.
  assert.match(
    gate,
    /playtestRegressions\.length > 0/,
    "regressions must be blocking",
  );
  assert.match(gate, /playtestHoles\.length > 0/, "holes must be blocking");
});

test("PLAYTEST: the blocked-module stage blocks on EVERY session, or it proves nothing", () => {
  const src = readFileSync(PLAY, "utf8");
  // Blocking the URL on the page session alone would leave the worker's copy of
  // the same module loading normally, and the reading would then depend on which
  // copy answered first.
  assert.match(
    src,
    /Network\.setBlockedURLs/,
    "the module must be removed at the network layer, not edited out of the build",
  );
  assert.match(
    src,
    /blocked_attempts/,
    "the report must say whether the block actually took",
  );
  assert.match(
    src,
    /Network\.setBlockedURLs\", \{ urls: \[\] \}/,
    "the block must be lifted afterwards, or later stages measure a broken page",
  );
});

test("PLAYTEST: the clause is composed from the run, never typed", () => {
  // playtestClause reads the reading; a hand-written string would drift from the
  // numbers the way a hand-typed facet line did.
  assert.equal(
    playtestClause(null),
    null,
    "an absent playtest must compose no clause at all",
  );
  const clause = playtestClause(playtestReading());
  assert.match(clause, /cold 5\.0s/);
  assert.match(clause, /0 NASA warm\/reload/);
  assert.doesNotMatch(
    clause,
    /warm_requests/,
    "the zero total is implied by the zero NASA count here; printing both spent " +
      "clip on a second way of saying the same thing",
  );
});
