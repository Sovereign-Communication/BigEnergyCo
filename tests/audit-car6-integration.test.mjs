// Car 6 (#201): the integration half, executed against shipped code.
//
// The audit's testplan battery counted functions with no DIRECT test. For a
// private helper that a public entry point exercises on every call, "no direct
// test" is not the same as "unverified": `runDischarge`, `priceOne`,
// `simulateOffset`, `buildBom`, `sweepSystems` and `sizeForTier` are all
// reached through `simulate`, `priceAllPaths` and the tier search, and each of
// those has direct tests that a defect in the helper would fail. Those are
// recorded on the thread rather than re-tested here — a second test that
// only re-enters the same public function through a different name adds a
// count, not a signal.
//
// What genuinely was unverified is the input boundary and two ladder controls:
// neither `readInputs` nor `setLevel` had a test that RAN the shipped code
// (the one test naming `readInputs` matches a source regex), and
// `syncCutControls` only ever appeared inside someone else's `doesNotMatch`.
// Each is sliced out of ui.js and executed, with only the module state and the
// collaborators it reaches stubbed — so a regression in the arithmetic fails
// here, not in a comment about the arithmetic.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

import { targetForPct } from "../assets/js/shared/cut-targets.js";
import { DAYS_PER_MONTH } from "../assets/js/sizing/pricing.js";

const ui = readFileSync("assets/js/sizing/ui.js", "utf8");

function between(start, end) {
  const from = ui.indexOf(start);
  assert.notEqual(from, -1, `${start} must exist in ui.js`);
  const to = ui.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `${end} must follow ${start}`);
  return ui.slice(from, to);
}

const KWH_FROM_BILL = between(
  "function kwhFromBill(bill, rate)",
  "function billForKwh",
);
const READ_INPUTS = between(
  "function readInputs()",
  "function readPercentInput",
);
const SET_LEVEL = between("function setLevel(lvl)", "function renderBestPick");
const SYNC_CUT = between(
  "function syncCutControls(pct)",
  "function setupCutSlider",
);

/** A form whose values are whatever the test says they are. */
function form(values) {
  const elements = new Map(
    Object.entries(values).map(([id, value]) => [
      id,
      { value, checked: value === true },
    ]),
  );
  return {
    $: (id) => elements.get(id) ?? null,
    elements,
  };
}

// ── readInputs: the boundary between the form and the engine ──────────────
//
// Everything below is a units question, and every wrong answer is silent: the
// engine prices in USD and the form speaks the visitor's currency, so a dropped
// division gives an answer that is plausible, stable, and wrong by the FX rate.

function readInputs(values, overrides = {}) {
  const { $ } = form(values);
  const sandbox = {
    $,
    // Real: sliced from the same file, so the bill→kWh formula under test is
    // the shipped one rather than a restatement of it.
    kwhFromBill: null,
    fixedDisplay: () => overrides.fixedCharge ?? 0,
    getTariff: () => overrides.tariff ?? 0.3,
    getFixedCharge: () => overrides.fixedCharge ?? null,
    fxActive: () => overrides.fx ?? null,
    readPercentInput: (id) => {
      const raw = parseFloat($(id)?.value);
      return Number.isFinite(raw) && raw > 0 ? raw / 100 : null;
    },
    useCaseInputs: () => ({}),
    applianceState: () => ({
      kwh: 12,
      peakW: 0,
      peakSurgeW: 0,
      requiresSplitPhase: false,
    }),
    billAnchorKwh: 7.5,
    generatorBasis: false,
    pendingFocus: null,
    customCutFraction: 0.8,
    PANEL_WATTS_DEFAULT: 550,
    // The real constant, imported: "how long is a month" is not a second
    // opinion this test gets to hold.
    DAYS_PER_MONTH,
    window: {},
  };
  vm.createContext(sandbox);
  vm.runInContext(
    `${KWH_FROM_BILL}\n${READ_INPUTS}\nthis.readInputs = readInputs;`,
    sandbox,
  );
  return { inputs: sandbox.readInputs(), sandbox };
}

test("car6: readInputs converts every display-currency figure to USD once", () => {
  // 1.25 local units per US$1: the engine must see 0.30/1.25, not 0.30.
  const fx = { rate: 1.25, code: "XYZ" };
  const { inputs } = readInputs(
    {
      latInput: "21.31",
      lonInput: "-157.86",
      loadMode: "kwh",
      dailyKwhInput: "20",
      chemSelect: "lfp",
      systemGoal: "gridtie",
      autoTier: "tier99",
      autoTarget: "custom",
      hardwareConfig: "both",
      tariff: "0.375",
      exportRate: "0.125",
      fixedChargeVal: "25",
    },
    { fx, tariff: 0.375, fixedCharge: 25 },
  );

  // tariff: the input is in display currency; the engine gets USD.
  assert.ok(Math.abs(inputs.tariff - 0.375 / 1.25) < 1e-12);
  // export rate: same treatment, and it is a separate conversion site.
  assert.ok(Math.abs(inputs.exportRate - 0.125 / 1.25) < 1e-12);
  // fixed charge: always a number (0 = none) so option comparison never sees
  // undefined, and converted the same way.
  assert.ok(Math.abs(inputs.fixedMonthlyUsd - 25 / 1.25) < 1e-12);
});

test("car6: readInputs with no display currency leaves the figures unconverted", () => {
  const { inputs } = readInputs(
    {
      latInput: "48.86",
      lonInput: "2.35",
      loadMode: "kwh",
      dailyKwhInput: "9",
      chemSelect: "lfp",
      systemGoal: "gridtie",
      autoTier: "tier99",
      autoTarget: "custom",
      hardwareConfig: "both",
      exportRate: "0",
    },
    { fx: null, tariff: 0.28, fixedCharge: null },
  );
  assert.equal(inputs.tariff, 0.28, "USD stays USD");
  // A non-positive export rate means "no export credit", never 0 USD/kWh
  // quietly competing with a real tariff.
  assert.equal(inputs.exportRate, null);
  assert.equal(inputs.fixedMonthlyUsd, 0);
});

test("car6: bill mode derives kWh from the bill, never from the raw kWh box", () => {
  // The box holds a leftover 999 from a previous mode. If the derivation reads
  // it, this run sizes a system for 999 kWh/day.
  const { inputs, sandbox } = readInputs(
    {
      latInput: "21.31",
      lonInput: "-157.86",
      loadMode: "bill",
      dailyKwhInput: "999",
      billSlider: "150",
      chemSelect: "lfp",
      systemGoal: "gridtie",
      autoTier: "tier99",
      autoTarget: "custom",
      hardwareConfig: "both",
    },
    { tariff: 0.3, fixedCharge: 15 },
  );
  const expected = (150 - 15) / (0.3 * DAYS_PER_MONTH);
  assert.ok(Math.abs(inputs.dailyKwh - expected) < 1e-9, `${inputs.dailyKwh}`);
  assert.notEqual(inputs.dailyKwh, 999);
  // A positive, finite derivation becomes the new slider anchor.
  assert.equal(sandbox.billAnchorKwh, inputs.dailyKwh);
});

test("car6: an unusable load entry yields NaN, so the run refuses it", () => {
  const { inputs } = readInputs(
    {
      latInput: "21.31",
      lonInput: "-157.86",
      loadMode: "kwh",
      dailyKwhInput: "",
      chemSelect: "lfp",
      systemGoal: "gridtie",
      autoTier: "tier99",
      autoTarget: "custom",
      hardwareConfig: "both",
    },
    { tariff: 0.3 },
  );
  // `run()` gates on `Number.isFinite(dailyKwh) && > 0`, so NaN is the
  // fail-closed answer; 0 or 10 would both size a system nobody asked for.
  assert.ok(Number.isNaN(inputs.dailyKwh));
});

test("car6: off-grid prefers its own slider over the shared kWh box", () => {
  const { inputs } = readInputs(
    {
      latInput: "21.31",
      lonInput: "-157.86",
      loadMode: "bill",
      offgridKwhSlider: "14",
      dailyKwhInput: "999",
      chemSelect: "lfp",
      systemGoal: "offgrid",
      autoTier: "tier99",
      autoTarget: "custom",
      hardwareConfig: "both",
    },
    { tariff: 0.3 },
  );
  assert.equal(inputs.dailyKwh, 14);
  // Falling back to the numeric box when the slider is empty is the documented
  // second choice, not a silent zero.
  const fallback = readInputs(
    {
      latInput: "21.31",
      lonInput: "-157.86",
      loadMode: "bill",
      offgridKwhSlider: "",
      dailyKwhInput: "11",
      chemSelect: "lfp",
      systemGoal: "offgrid",
      autoTier: "tier99",
      autoTarget: "custom",
      hardwareConfig: "both",
    },
    { tariff: 0.3 },
  );
  assert.equal(fallback.inputs.dailyKwh, 11);
});

test("car6: a roof area caps the PV envelope in kW, not in m²", () => {
  const base = {
    latInput: "21.31",
    lonInput: "-157.86",
    loadMode: "kwh",
    dailyKwhInput: "10",
    chemSelect: "lfp",
    systemGoal: "gridtie",
    autoTier: "tier99",
    autoTarget: "custom",
    hardwareConfig: "both",
  };
  const capped = readInputs({ ...base, roofAreaM2: "30" }, { tariff: 0.3 });
  // floor(30 / 6) panels × 550 W = 2.75 kW.
  assert.equal(capped.inputs.pvMaxOverride, 2.75);
  const none = readInputs({ ...base, roofAreaM2: "-4" }, { tariff: 0.3 });
  assert.equal(
    none.inputs.pvMaxOverride,
    null,
    "an unusable area caps nothing",
  );
  const empty = readInputs(base, { tariff: 0.3 });
  assert.equal(empty.inputs.pvMaxOverride, null);
});

test("car6: readInputs records the last inputs for the share link", () => {
  const { inputs, sandbox } = readInputs(
    {
      latInput: "21.31",
      lonInput: "-157.86",
      loadMode: "kwh",
      dailyKwhInput: "10",
      chemSelect: "sodium",
      systemGoal: "gridtie",
      hardwareConfig: "solar",
      autoTier: "tier99",
      autoTarget: "custom",
      climateAwareToggle: true,
      noSwapToggle: true,
    },
    { tariff: 0.3 },
  );
  assert.equal(
    sandbox.window.lastInputs,
    inputs,
    "the same object, not a copy",
  );
  assert.equal(inputs.chemistry, "sodium");
  assert.equal(inputs.hardwareConfig, "solar");
  assert.equal(inputs.climateAware, true);
  assert.equal(inputs.noSwapMode, true);
});

// ── setLevel: the result ladder ───────────────────────────────────────────

test("car6: setLevel renders only when there is a payload to render", () => {
  const rendered = [];
  const sandbox = {
    resultLevel: "best",
    lastPayload: null,
    syncLadderTabs: () => rendered.push("tabs"),
    renderResults: (p) => rendered.push(`render:${p.id}`),
  };
  vm.createContext(sandbox);
  vm.runInContext(`${SET_LEVEL}\nthis.setLevel = setLevel;`, sandbox);

  // A ladder tab before any result: the level still moves (it is the visitor's
  // choice) and the tabs re-sync, but nothing is re-rendered from a null
  // payload. The unfixed shape — renderResults(lastPayload) unconditionally —
  // throws inside a click handler and leaves the tab visually selected over an
  // empty panel.
  sandbox.setLevel("matrix");
  assert.equal(sandbox.resultLevel, "matrix");
  assert.deepEqual(rendered, ["tabs"]);

  sandbox.lastPayload = { id: "p1" };
  rendered.length = 0;
  sandbox.setLevel("compare");
  assert.deepEqual(rendered, ["tabs", "render:p1"]);
});

// ── syncCutControls: one control, three places ────────────────────────────

function syncCut(pct, initial = {}) {
  const { $, elements } = form(initial);
  const labels = [];
  const sandbox = {
    $,
    customCutFraction: 0.8,
    syncCutLabel: () => labels.push("label"),
    targetForPct,
  };
  vm.createContext(sandbox);
  vm.runInContext(
    `${SYNC_CUT}\nthis.syncCutControls = syncCutControls;`,
    sandbox,
  );
  sandbox.syncCutControls(pct);
  return { sandbox, elements, labels };
}

test("car6: syncCutControls clamps to the slider's real range and rounds", () => {
  assert.equal(syncCut(0).sandbox.customCutFraction, 0.01, "0% is 1%, not 0");
  assert.equal(syncCut(-40).sandbox.customCutFraction, 0.01);
  assert.equal(
    syncCut(200).sandbox.customCutFraction,
    1.5,
    "150% is the ceiling",
  );
  assert.equal(
    syncCut(47.6).sandbox.customCutFraction,
    0.48,
    "rounded, not truncated",
  );
});

test("car6: syncCutControls writes all three places from one value", () => {
  const { sandbox, elements, labels } = syncCut(75, {
    cutSlider: "1",
    autoTarget: "cut60",
  });
  assert.equal(sandbox.customCutFraction, 0.75);
  // The slider and the preset select are two views of the same value: a select
  // left showing a stale preset is the defect this guards.
  assert.equal(elements.get("cutSlider").value, "75");
  assert.equal(elements.get("autoTarget").value, targetForPct(75));
  assert.notEqual(elements.get("autoTarget").value, "cut60");
  assert.deepEqual(labels, ["label"], "the label is refreshed exactly once");
});

test("car6: syncCutControls tolerates a form without the optional nodes", () => {
  // The slider and the preset select are optional in the DOM; a missing node
  // must not stop the state write, or a page that omits them cannot restore a
  // shared cut.
  const { sandbox } = syncCut(60, {});
  assert.equal(sandbox.customCutFraction, 0.6);
});

test("car6: readInputs needs only the four controls it dereferences", () => {
  // `latInput`, `lonInput`, `loadMode` and `chemSelect` are read without
  // optional chaining — they are the form's contract, present on every page
  // that can run a sizing. Everything else may be absent, and an absent
  // optional control must read as "unset" rather than throwing. This pins the
  // boundary of that contract: one more unguarded `$(...)` read would break
  // the four-node form, and the failure would be a click handler that throws
  // instead of a status line.
  const { inputs } = readInputs(
    {
      latInput: "21.31",
      lonInput: "-157.86",
      loadMode: "kwh",
      chemSelect: "lfp",
    },
    { tariff: 0.3 },
  );
  assert.equal(inputs.chemistry, "lfp");
  assert.equal(
    inputs.autoTier,
    "tier99",
    "a missing preset falls back, never undefined",
  );
  assert.equal(inputs.hardwareConfig, "both");
  assert.equal(inputs.peakLoadW, null);
  assert.equal(inputs.wiringOverride, null);
});
