import { test } from "node:test";
import assert from "node:assert/strict";
import {
  frontierVerdict,
  renderFrontier,
  renderFrontierTable,
} from "../assets/js/sizing/frontier-chart.js";
import { buildFrontier } from "../assets/js/sizing/frontier.js";
import { LOCALES } from "../assets/js/shared/locales.js";
import { OFFLINE_PROFILES } from "../assets/js/sizing/profiles.js";
import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import {
  buildE1kw,
  expandProfile,
  flatProfile,
} from "../assets/js/sizing/engine.js";

// Battery-only (hardwareConfig "battery") is a grid-tie sweep that never finds
// any PV. Its ceiling is a peak-hour offset, not a bill cut — the alternating
// current never falls, the bill never drops and nothing pays itself back — so
// every surface that phrases that ceiling must use the battery wording. Before
// this it borrowed the grid wording and told the visitor that "cutting about
// 92.1% of your bill" cost $389, next to a panel saying it never pays back.

const REACH = {
  id: "tapering",
  kneePct: 92.1,
  kneeCostUsd: 389,
  tailCostPerPoint: 18,
  headCostPerPoint: 3,
  tailRatio: 5.9,
  ceilingPct: 92.1,
  ceilingCostUsd: 389,
  battMaxKwh: 12,
  pvMaxKw: 0,
  entryPvKw: 0,
  entryBattKwh: 2,
  entryCostUsd: 389,
};

// No `t` passed: frontierVerdict falls back to returning the key itself, which
// is exactly what this test wants to read.
const keyFor = (reach) => frontierVerdict({ mode: "gridtie", reach }, {});

const LINEAR_COSTS = {
  costPerWpv: 0.35,
  costPerKwhBatt: 140,
  costPerKwInv: 60,
};

// A real frontier off real weather, not a hand-built payload: the axis label is
// chosen from the envelope the sweep actually searched, so a fixture that
// skipped buildFrontier could not catch a wrong predicate.
function realFrontier({ mode, pvMax, battMax }) {
  const profile = OFFLINE_PROFILES.find((p) => p.name.includes("Honolulu"));
  assert.ok(profile, "offline Honolulu profile exists");
  const hours = synthesizeFromProfile(profile);
  const loadWh = expandProfile(flatProfile(10), hours.length);
  const f = buildFrontier({
    e1kw: buildE1kw(hours),
    loadWh,
    tempsC: Float64Array.from(hours, (h) => h.tAmb),
    chemistry: "lfp",
    mode,
    pvMax,
    battMax,
    ...LINEAR_COSTS,
  });
  assert.ok(f.points.length >= 2, "enough points to render");
  return f;
}

// renderFrontier only reaches for the host's width and innerHTML, so a stub is
// a faithful stand-in for the real element (and keeps this test DOM-free).
const fakeHost = () => ({
  innerHTML: "",
  getBoundingClientRect: () => ({ width: 720 }),
});

// Identity `t` so the rendered markup names the exact key that was chosen.
const renderOpts = { t: (k) => k, money: (v) => "$" + Math.round(v) };

const BATTERY_ONLY_FRONTIER = () =>
  realFrontier({ mode: "gridtie", pvMax: 0, battMax: 150 });

test("a no-PV grid-tie sweep selects the Battery verdict family", () => {
  assert.equal(keyFor(REACH), "frontierVerdictTaperingBattery");
  assert.equal(
    keyFor({ ...REACH, id: "steep-tail" }),
    "frontierVerdictSteepBattery",
  );
  assert.equal(
    keyFor({ ...REACH, id: "beyond-sweep" }),
    "frontierVerdictBeyondSweepBattery",
  );
  assert.equal(
    keyFor({ ...REACH, id: "already-covered" }),
    "frontierVerdictCoveredBattery",
  );
  assert.equal(
    keyFor({ ...REACH, id: "linear" }),
    "frontierVerdictLinearBattery",
  );
});

test("the same sweep WITH panels keeps the grid-tie verdict family", () => {
  assert.equal(keyFor({ ...REACH, pvMaxKw: 6 }), "frontierVerdictTaperingGrid");
});

test("an off-grid sweep is unaffected", () => {
  const out = frontierVerdict({ mode: "offgrid", reach: REACH }, {});
  assert.equal(out, "frontierVerdictTaperingOffgrid");
});

test("a no-PV frontier labels its Y axis as peak hours, not a bill cut", () => {
  const battery = realFrontier({ mode: "gridtie", pvMax: 0, battMax: 150 });
  assert.equal(
    Number(battery.reach.pvMaxKw) > 0,
    false,
    "fixture really is the battery-only envelope",
  );
  const host = fakeHost();
  renderFrontier(host, battery, renderOpts);
  assert.match(host.innerHTML, /frontierYGridBattery/);
  assert.doesNotMatch(
    host.innerHTML,
    // The battery key CONTAINS the grid key, so the bare name needs a guard.
    /frontierYGrid(?![A-Za-z])/,
    "the battery-only axis must not borrow the grid axis label",
  );

  // The same shape WITH panels keeps the bill-cut axis — the fix must not
  // soften a correct surface.
  const withPv = realFrontier({ mode: "gridtie", pvMax: 12, battMax: 40 });
  const host2 = fakeHost();
  renderFrontier(host2, withPv, renderOpts);
  assert.match(host2.innerHTML, /frontierYGrid(?![A-Za-z])/);
  assert.doesNotMatch(host2.innerHTML, /frontierYGridBattery/);
});

test("a no-PV frontier labels its data-table column as peak hours", () => {
  const battery = BATTERY_ONLY_FRONTIER();
  const host = fakeHost();
  renderFrontierTable(host, battery, renderOpts);
  assert.match(host.innerHTML, /frontierColCutBattery/);
  assert.doesNotMatch(host.innerHTML, /frontierColCut(?![A-Za-z])/);

  const withPv = realFrontier({ mode: "gridtie", pvMax: 12, battMax: 40 });
  const host2 = fakeHost();
  renderFrontierTable(host2, withPv, renderOpts);
  assert.match(host2.innerHTML, /frontierColCut(?![A-Za-z])/);
  assert.doesNotMatch(host2.innerHTML, /frontierColCutBattery/);
});

test("off-grid frontier axis and column are untouched", () => {
  const off = realFrontier({ mode: "offgrid", pvMax: 12, battMax: 40 });
  const chart = fakeHost();
  renderFrontier(chart, off, renderOpts);
  assert.match(chart.innerHTML, /frontierYOffgrid/);
  assert.doesNotMatch(chart.innerHTML, /frontierYGridBattery/);
  const table = fakeHost();
  renderFrontierTable(table, off, renderOpts);
  assert.match(table.innerHTML, /frontierColCover/);
  assert.doesNotMatch(table.innerHTML, /frontierColCutBattery/);
});

test("the target control is relabelled for a battery-only run in every locale", () => {
  const ids = ["en", "es", "pt", "fr", "de", "ar"];
  // The slider label and its value line are the visitor's stated goal; without
  // panels that goal is a peak-hour offset.
  const banned = /\bbill\b|factura|conta|facture|rechnung|فاتورة/i;
  for (const id of ids) {
    const L = LOCALES[id];
    for (const k of [
      "frontierYGridBattery",
      "frontierColCutBattery",
      "cutLabelBattery",
    ]) {
      assert.equal(typeof L[k], "string", `${id}: ${k}`);
      assert.ok(L[k].trim().length > 8, `${id}: ${k} looks empty`);
      assert.ok(!banned.test(L[k]), `${id}: ${k} still names a bill`);
    }
    assert.match(
      L.cutValueBattery,
      /\{pct\}/,
      `${id}: cutValueBattery lost its percentage`,
    );
    assert.ok(
      !banned.test(L.cutValueBattery),
      `${id}: cutValueBattery says bill`,
    );
    // The with-panels wording must survive untouched. This is the regression
    // half: a blanket relabel would break every solar visitor's control.
    assert.ok(banned.test(L.cutLabel), `${id}: cutLabel lost its bill wording`);
  }
});

test("every locale carries all five battery verdicts, and none claims a bill", () => {
  const ids = ["en", "es", "pt", "fr", "de", "ar"];
  const keys = [
    "frontierVerdictCoveredBattery",
    "frontierVerdictBeyondSweepBattery",
    "frontierVerdictSteepBattery",
    "frontierVerdictTaperingBattery",
    "frontierVerdictLinearBattery",
  ];
  for (const id of ids) {
    const L = LOCALES[id];
    assert.ok(L, `${id}: dictionary missing`);
    for (const k of keys) {
      assert.equal(typeof L[k], "string", `${id}: ${k}`);
      assert.ok(L[k].trim().length > 20, `${id}: ${k} looks empty`);
      // The whole point of the family: it describes shifting peak hours, so it
      // must never phrase the number as a share of a bill.
      assert.ok(!/\bbill\b/i.test(L[k]), `${id}: ${k} still says "bill"`);
    }
    assert.match(
      L.frontierVerdictTaperingBattery,
      /\{kneePct\}/,
      `${id}: tapering lost its percentage`,
    );
    assert.match(
      L.frontierVerdictTaperingBattery,
      /\{ratio\}/,
      `${id}: tapering lost its ratio`,
    );
    assert.match(
      L.frontierVerdictBeyondSweepBattery,
      /\{battMax\}/,
      `${id}: beyond-sweep lost its battery ceiling`,
    );
  }
});
