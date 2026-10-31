// The `resilience` facet was carried for a cycle by a prose line describing
// intent — retries, timeouts, fallbacks, a deadline — while not one of those
// mechanisms had ever been made to fail on purpose. These tests are for the
// measurement that replaced it, and they exist because that measurement nearly
// published four separate lies before it was correct.
//
// EVERY instrument bug this file pins was found by the instrument itself, which
// is the argument for reporting counters rather than verdicts:
//
//   1. THE INTERCEPTOR DISARMED ITSELF BETWEEN MODES. Only the first failure mode
//      was ever intercepted; the other five quietly fetched real weather and
//      reported a healthy card. `intercepted: 0` is what named it.
//   2. THE OFFLINE DETECTOR SAID YES TO EVERYTHING. It matched document-wide
//      text for "typical-year", which this page explains permanently, so all six
//      stages read as degraded — including the ones that reached real weather.
//      The fix was a control run whose answer is known to be no.
//   3. THE COUNTERS WERE READ AFTER TEARDOWN. `intercepted` was reset by
//      disarming and the timer-rewrite count was deleted by removing the shim,
//      so stages that had genuinely fired both reported zero.
//   4. THE STALE-INPUT DETECTOR FAILED EVERY CLEAN RUN. It scanned the whole
//      document for the digits 10 and 27; this page is full of numbers, so both
//      were always present and a correct run looked superseded.
//
// So: each budget clause is mutation-checked here, the control run is pinned as
// mandatory, and the facet line is held to the transport clip.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  BUDGET_FITS,
  RESILIENCE_EXPECTATIONS,
  RESILIENCE_FACET_AXES,
  RESILIENCE_SCOPE_LIMIT,
  TIMEOUT_GRAPH,
  composeResilienceFacetLine,
  evaluateBudgetFits,
  evaluateResilience,
  readTimeoutGraph,
} from "../scripts/lib/resilience-budgets.mjs";
import { LIGHTHOUSE_FACET_AXES } from "../scripts/lib/lighthouse-budgets.mjs";
import { COMPLETE_FACET_CLIP } from "../scripts/lib/jev-complete.mjs";

const GATE = "scripts/check-resilience.mjs";
const SMOKE = "scripts/smoke/resilience.mjs";

/** A reading shaped like the one the gate produces, all stages clean. */
const cleanReading = (extra = {}) => ({
  transport: {
    ok: true,
    modes: [
      ...[
        "connection_failed",
        "request_aborted",
        "connection_refused",
        "server_503",
        "malformed_200",
      ].map((id) => ({
        id,
        ok: true,
        intercepted: 3,
        card_rendered: true,
        offline_label: true,
        button_disabled: false,
        status_years: 1,
        page_errors: [],
      })),
      {
        id: "control",
        control: true,
        ok: true,
        intercepted: 0,
        card_rendered: true,
        offline_label: false,
        button_disabled: false,
        status_years: 5,
        page_errors: [],
      },
    ],
  },
  stuck_run: {
    ok: true,
    rewrites: 1,
    held_run_posts: 1,
    run_posts: 2,
    worker_constructions: 1,
    stuck_status:
      "The sizing engine did not reply in time — check your connection and click Size My System to try again.",
    stuck_error_is_actionable: true,
    stuck_card_rendered: false,
    stuck_deadline_fired: true,
    stuck_button_released: true,
    page_errors: [],
  },
  stale_inputs: {
    ok: true,
    settled_input: "27",
    rendered_kw: 27.4,
    rendered_kw_readable: true,
    stale_figure_rendered: false,
    new_figure_rendered: true,
    page_errors: [],
  },
  share_restore: {
    ok: true,
    restored_daily_kwh: "14",
    inputs_restored: true,
    explicit_run_after_restore: true,
    page_errors: [],
  },
  ...extra,
});

const withField = (base, path, value) => {
  const clone = structuredClone(base);
  const keys = path.split(".");
  let node = clone;
  for (const k of keys.slice(0, -1)) node = node[k];
  node[keys.at(-1)] = value;
  return clone;
};

// ── the timeout arithmetic ──────────────────────────────────────────────────

test("BUDGET: the graph is read from the shipped modules, not retyped", async () => {
  const live = await readTimeoutGraph();
  // The point of reading them live: raising a real constant must move the
  // arithmetic. A copy in the budgets file would still read 45000 after the
  // product changed and the gate would keep passing a relationship that no
  // longer holds.
  assert.equal(live.outer.run_reply_deadline_ms, 180000);
  assert.equal(live.inner.weather_fetch_ms, 45000);
  assert.equal(live.inner.city_lookup_ms, 12000);
  assert.equal(live.inner.country_fetch_ms, 8000);
  assert.equal(
    live.inner.jev_probe_ms,
    3500,
    "validate.js does not export its timeout, so it is read from its source " +
      "marker — if that marker moves, this test says so instead of the gate " +
      "silently reading NaN",
  );
  assert.equal(evaluateBudgetFits(live).failures.length, 0);
});

test("BUDGET: every inner budget fits its outer cap, with the reason recorded", () => {
  const { failures, checked } = evaluateBudgetFits();
  assert.equal(
    failures.length,
    0,
    `budget fits failed: ${JSON.stringify(failures)}`,
  );
  assert.equal(checked.length, BUDGET_FITS.length);
  for (const fit of BUDGET_FITS)
    assert.ok(
      typeof fit.why === "string" && fit.why.length > 20,
      `${fit.id} has no stated reason, so raising it later would be free`,
    );
});

test("BUDGET: an inner budget raised past its cap is caught (mutation)", () => {
  const baseline = evaluateBudgetFits();
  assert.equal(baseline.failures.length, 0);
  // The exact inversion this check exists for: the weather abort meeting the
  // run deadline. Past that point the inner timeout always wins, the outer can
  // never fire for a stuck worker, and a hung run holds the page with no error.
  for (const inner of [180000, 200000]) {
    const mutated = structuredClone(TIMEOUT_GRAPH);
    mutated.inner.weather_fetch_ms = inner;
    const { failures } = evaluateBudgetFits(mutated);
    assert.equal(
      failures.length,
      1,
      `a ${inner}ms weather budget inside a 180000ms run deadline must fail`,
    );
    assert.match(failures[0].message, /weather_under_run_deadline/);
  }
});

test("BUDGET: the city lookup is checked at TWICE its single-timer budget", () => {
  // Two call sites, and a share-restore can resolve a city and then its country
  // partition in sequence. A check that compared one number would pass a budget
  // that is actually over once both are counted.
  const fit = BUDGET_FITS.find(
    (f) => f.id === "city_lookup_under_run_deadline",
  );
  assert.equal(fit.multiplier, 2);
  const checked = evaluateBudgetFits().checked.find(
    (c) => c.id === "city_lookup_under_run_deadline",
  );
  assert.equal(checked.worst_ms, 24000);
});

test("BUDGET: an unreadable constant is a hole, never a pass", () => {
  const mutated = structuredClone(TIMEOUT_GRAPH);
  mutated.inner.weather_fetch_ms = undefined;
  const { failures, checked } = evaluateBudgetFits(mutated);
  assert.ok(
    failures.some((f) => /could not be read/.test(f.message)),
    "a fit whose constants could not be read was not checked, and must say so",
  );
  assert.equal(
    checked.length,
    BUDGET_FITS.length - 1,
    "an unchecked fit must not appear among the checked ones",
  );
});

// ── the browser reading, mutation-checked ───────────────────────────────────

const MUTATIONS = [
  {
    name: "a transport failure that leaves the page with no answer",
    patch: (r) => withField(r, "transport.modes.0.card_rendered", false),
    expect: /NO result at all/,
  },
  {
    name: "a degraded result that does not admit it degraded",
    patch: (r) => withField(r, "transport.modes.0.offline_label", false),
    expect: /did not say it was degraded/,
  },
  {
    name: "a failure that leaves the Run button disabled",
    patch: (r) => withField(r, "transport.modes.0.button_disabled", true),
    expect: /Run button stayed disabled/,
  },
  {
    name: "a stage that intercepted nothing and proved nothing",
    patch: (r) => withField(r, "transport.modes.0.intercepted", 0),
    expect: /no failure of this kind occurred/,
    list: "holes",
  },
  {
    name: "an offline detector that says yes to a healthy run",
    patch: (r) => withField(r, "transport.modes.5.offline_label", true),
    expect: /detector says yes to everything/,
  },
  {
    name: "modes that do not degrade alike",
    patch: (r) => withField(r, "transport.modes.1.card_rendered", false),
    expect: /did not produce the same outcome|transport_classification/,
  },
  {
    name: "a silent worker that never trips the deadline",
    patch: (r) => withField(r, "stuck_run.stuck_deadline_fired", false),
    expect: /never tripped the page-side deadline/,
  },
  {
    name: "a stuck run that renders a result anyway",
    patch: (r) => withField(r, "stuck_run.stuck_card_rendered", true),
    expect: /rendered a result card/,
  },
  {
    name: "a deadline with no actionable error",
    patch: (r) => withField(r, "stuck_run.stuck_error_is_actionable", false),
    expect: /no actionable error/,
  },
  {
    name: "a deadline that leaves the button disabled",
    patch: (r) => withField(r, "stuck_run.stuck_button_released", false),
    expect: /left the Run button disabled/,
  },
  {
    name: "a dead worker that is never replaced",
    patch: (r) => withField(r, "stuck_run.worker_constructions", 0),
    expect: /no fresh worker was constructed/,
  },
  {
    name: "a fixture that shortened more than one timer",
    patch: (r) => withField(r, "stuck_run.rewrites", 7),
    expect: /timer\(s\) instead of exactly one/,
    list: "holes",
  },
  {
    name: "a fixture that swallowed more than one message",
    patch: (r) => withField(r, "stuck_run.held_run_posts", 3),
    expect: /run message\(s\) instead of/,
    list: "holes",
  },
  {
    name: "a card showing the superseded run's figure",
    patch: (r) => withField(r, "stale_inputs.stale_figure_rendered", true),
    expect: /SUPERSEDED run's figure/,
  },
  {
    name: "a stale-inputs stage that could not read which run rendered",
    patch: (r) => withField(r, "stale_inputs.rendered_kw_readable", false),
    expect: /which run painted the screen is unknown/,
    list: "holes",
  },
  {
    name: "a share link that does not restore its inputs",
    patch: (r) => withField(r, "share_restore.inputs_restored", false),
    expect: /did not come back/,
  },
  {
    name: "a restored page that cannot run",
    patch: (r) =>
      withField(r, "share_restore.explicit_run_after_restore", false),
    expect: /could not complete an explicit run/,
  },
];

for (const mutation of MUTATIONS) {
  test(`READING: ${mutation.name} is caught`, () => {
    const list = mutation.list === "holes" ? "holes" : "regressions";
    const baseline = evaluateResilience(cleanReading());
    assert.equal(
      baseline.regressions.length,
      0,
      "the clean reading must be clean",
    );
    assert.equal(baseline.holes.length, 0, "and hole-free");
    const mutated = evaluateResilience(mutation.patch(cleanReading()));
    assert.ok(
      mutated[list].some((e) =>
        mutation.expect.test(
          `${e.id || ""} ${e.message || ""} ${e.what || ""} ${e.why || ""}`,
        ),
      ),
      `${mutation.name} produced no ${list} entry. A clause that cannot fail is ` +
        `a comment. Got: ${JSON.stringify(mutated[list])}`,
    );
  });
}

test("READING: an absent stage is a hole, never a pass", () => {
  for (const stage of [
    "transport",
    "stuck_run",
    "stale_inputs",
    "share_restore",
  ]) {
    const { regressions, holes } = evaluateResilience(
      withField(cleanReading(), stage, null),
    );
    assert.equal(
      regressions.length,
      0,
      `${stage} missing must not read as a defect`,
    );
    assert.ok(
      holes.some((h) => h.what.includes(stage.split("_")[0])),
      `${stage} missing must be a named hole, got ${JSON.stringify(holes)}`,
    );
  }
  // And no reading at all.
  const none = evaluateResilience(null);
  assert.equal(none.regressions.length, 0);
  assert.ok(none.holes.some((h) => h.what === "resilience"));
});

test("READING: the control run is mandatory, not optional polish", () => {
  const noControl = structuredClone(cleanReading());
  noControl.transport.modes = noControl.transport.modes.filter(
    (m) => !m.control,
  );
  const { holes } = evaluateResilience(noControl);
  assert.ok(
    holes.some((h) => /control run/.test(h.why)),
    "without a control the offline detector has never been seen refuse, and " +
      "every degraded_run_is_labelled pass above it is meaningless",
  );
});

test("READING: the expectations are declared data, not implicit in the gate", () => {
  // A reader should be able to learn what "passing" meant without reading the
  // assertions, and a change to the bar should be visible as a diff.
  assert.equal(RESILIENCE_EXPECTATIONS.min_intercepted_per_mode, 1);
  assert.equal(
    RESILIENCE_EXPECTATIONS.control_must_not_be_labelled_offline,
    true,
  );
  assert.equal(RESILIENCE_EXPECTATIONS.fixture_shortens_exactly_one_timer, 1);
  assert.equal(RESILIENCE_EXPECTATIONS.fixture_swallows_exactly_one_message, 1);
});

// ── the facet line ──────────────────────────────────────────────────────────

test("FACET: the resilience line is composed from the run and fits the clip", () => {
  const line = composeResilienceFacetLine({
    resilience_reading: {
      ...cleanReading(),
      budget_fits: evaluateBudgetFits(),
    },
  });
  assert.ok(line, "a measured run must produce a line");
  assert.match(line, /5 failures degrade alike/, line);
  assert.match(line, /control clean/, line);
  assert.match(line, /silent worker trips the page deadline/, line);
  assert.match(line, /inner budgets fit their outer caps/, line);
  // The limit is not decoration: the 45s weather abort is NOT browser-exercised,
  // and a line that let a reader assume otherwise would be lying by omission.
  assert.match(line, /source-level/i, line);
  assert.match(line, /worker-realm timers cannot be shortened/, line);
  assert.ok(
    line.length <= COMPLETE_FACET_CLIP,
    `the line is ${line.length} chars, over the ${COMPLETE_FACET_CLIP}-char clip; ` +
      "it would be cut in transit and the limit half is exactly what gets cut",
  );
});

test("FACET: nothing measured means no line at all", () => {
  assert.equal(composeResilienceFacetLine({}), null);
  assert.equal(composeResilienceFacetLine({ resilience_reading: null }), null);
  // "0 failures" from a run that measured nothing is the most dangerous
  // sentence available about this facet, so it must not be constructible.
  const nothing = composeResilienceFacetLine({ resilience_reading: {} });
  assert.equal(nothing, null);
});

test("FACET: the resilience axis has exactly one owner", () => {
  // The evidence builder OVERWRITES prose.facet_evidence[axis] with the last
  // derived line it reads, so a second gate declaring `resilience` would not add
  // a proof line — it would silently delete this one.
  assert.deepEqual(RESILIENCE_FACET_AXES, ["resilience"]);
  assert.ok(
    !LIGHTHOUSE_FACET_AXES.includes("resilience"),
    "the Lighthouse gate must not also claim resilience",
  );
});

// ── wiring ──────────────────────────────────────────────────────────────────

test("GATE: it drives the real surface and publishes its axes", () => {
  const gate = readFileSync(GATE, "utf8");
  assert.match(
    gate,
    /facet_axes: RESILIENCE_FACET_AXES/,
    "the report must declare its axes",
  );
  assert.match(
    gate,
    /composeResilienceFacetLine/,
    "the line must be composed from the run",
  );
  assert.match(
    gate,
    /report\.facet_line\.length > COMPLETE_FACET_CLIP/,
    "an over-long line must fail the gate rather than be cut in transit",
  );
  // Every stage the judge named has to actually be driven, not merely imported.
  for (const fn of [
    "runTransportClassification",
    "runStuckRunRecovery",
    "runStaleInputs",
    "runShareRestore",
  ])
    assert.match(
      gate,
      new RegExp(`${fn}\\(ctx`),
      `${fn} must be driven by the gate`,
    );
  assert.match(
    gate,
    /serveStatic/,
    "the measurement must run against the staged build served under the real policy",
  );
});

test("GATE: holes are as blocking as regressions", () => {
  const gate = readFileSync(GATE, "utf8");
  assert.match(
    gate,
    /for \(const h of verdict\.holes\) fail\(/,
    "a stage that did not run must exit non-zero, or an unexercised path " +
      "reads as a passing one",
  );
  assert.match(gate, /for \(const r of verdict\.regressions\) fail\(/);
});

test("SMOKE: the failures are injected at the network layer, per session", () => {
  const smoke = readFileSync(SMOKE, "utf8");
  // The sizing worker is its own CDP target, so a fixture on the page session
  // alone would leave worker-issued traffic untouched and the stage would
  // measure a page that was never actually degraded.
  assert.match(
    smoke,
    /Target\.setAutoAttach/,
    "worker targets must auto-attach",
  );
  assert.match(
    smoke,
    /Fetch\.enable/,
    "the interceptor arms a real network-layer fault",
  );
  // Disarming must not mean "hold": a paused request that is never continued
  // hangs the page, which is exactly what the first draft did.
  assert.match(
    smoke,
    /if \(!stats\.mode\)/,
    "a disarmed interceptor must stay transparent",
  );
  assert.match(
    smoke,
    /Fetch\.continueRequest/,
    "non-target requests must be continued, not paused",
  );
  // The synthetic responses carry CORS headers, or the browser's CORB check
  // rejects them before the page's own status handling runs and the stage is
  // measuring a CORS failure wearing a 503's name.
  assert.match(
    smoke,
    /access-control-allow-origin/,
    "a fulfilled response needs the header the real endpoint sends",
  );
  assert.match(smoke, /control: true/, "the control stage must exist");
});
