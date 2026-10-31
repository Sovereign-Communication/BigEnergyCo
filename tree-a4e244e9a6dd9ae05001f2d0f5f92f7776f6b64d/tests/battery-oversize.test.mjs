import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateOversizeOptimization,
  simulateOffset,
  buildE1kw,
  flatProfile,
  expandProfile,
} from "../assets/js/sizing/engine.js";
import { runSizing } from "../assets/js/sizing/run.js";
import { sweepSystems } from "../assets/js/sizing/frontier.js";
import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import {
  OFFLINE_PROFILES,
  PROFILE_YEAR,
} from "../assets/js/sizing/profiles.js";

const honolulu = OFFLINE_PROFILES.find((p) => p.name.includes("Honolulu"));
const fakeWeather = async () => ({
  hours: synthesizeFromProfile(honolulu),
  meta: {
    latitude: 21.31,
    longitude: -157.86,
    startYear: PROFILE_YEAR,
    endYear: PROFILE_YEAR,
    years: 1,
    source: "test fixture",
    offline: false,
  },
});

const MSG = {
  latitude: 21.31,
  longitude: -157.86,
  dailyKwh: 20,
  tariff: 0.42,
  exportRate: 0.1,
  years: 1,
};

test("evaluateOversizeOptimization identifies zero-swap natural when replacements = 0", () => {
  const opt = evaluateOversizeOptimization({
    pvKw: 5,
    battKwh: 15,
    sizingResult: { cyclesEquivalent: 150 },
    chemistry: "lfp",
    years: 1,
    costPerWpv: 0.35,
    costPerKwhBatt: 140,
    costPerKwInv: 60,
    laborPerKwh: [80, 100, 130],
  });

  assert.equal(opt.oversizeScenario, "zero_swap_natural");
  assert.equal(opt.useOversized, false);
  assert.equal(opt.oversizeSavingsUsd, 0);
  assert.match(
    opt.bestPriceCallout,
    /Best 20-year price: battery bank naturally outlasts/,
  );
});

test("evaluateOversizeOptimization compares oversized vs swaps when replacements > 0", () => {
  const opt = evaluateOversizeOptimization({
    pvKw: 5,
    battKwh: 4,
    sizingResult: { cyclesEquivalent: 300 },
    chemistry: "agm",
    years: 1,
    costPerWpv: 0.35,
    costPerKwhBatt: 100,
    costPerKwInv: 60,
    laborPerKwh: [80, 100, 130],
  });

  assert.ok(
    ["oversized_cheaper", "swaps_cheaper"].includes(opt.oversizeScenario),
  );
  assert.ok(
    Number.isFinite(opt.oversizeSavingsUsd) && opt.oversizeSavingsUsd > 0,
  );
  if (opt.useOversized) {
    assert.equal(opt.oversizeScenario, "oversized_cheaper");
    assert.ok(opt.oversizedBattKwh > 4);
    assert.match(
      opt.bestPriceCallout,
      /oversized battery \(\d+ kWh\) to avoid replacements/,
    );
    assert.match(opt.bestPriceCallout, /lowest 20-year cost/);
  } else {
    assert.equal(opt.oversizeScenario, "swaps_cheaper");
    assert.match(opt.bestPriceCallout, /Best 20-year price:/);
    assert.match(
      opt.bestPriceCallout,
      /standard sizing with \d+ replacement\(s\) is/,
    );
  }
});

test("simulateOffset handles Battery-Only mode (pvKw = 0) with peak-hour ToU discharge", () => {
  const hours = synthesizeFromProfile(honolulu);
  const e1kw = buildE1kw(hours);
  const loadWh = expandProfile(flatProfile(24), hours.length);
  const tempsC = Float64Array.from(hours, (h) => h.tAmb);

  const sim = simulateOffset({
    pvKw: 0,
    battKwhUsable: 10,
    e1kw,
    loadWh,
    chemistry: "lfp",
    tempsC,
    capture: true,
  });

  assert.equal(sim.directWh, 0);
  assert.ok(sim.battWhAc > 0, "battery should serve AC load during peak hours");
  assert.ok(
    sim.importedWh > 0,
    "grid covers off-peak load plus battery charging",
  );
  assert.equal(sim.curtailedWh, 0, "no curtailed solar in battery-only mode");
  assert.ok(sim.minSoc < 1.0, "battery discharged");
  assert.ok(sim.cyclesEquivalent > 0, "battery cycled");
});

test("runSizing supports hardwareConfig = 'battery' (Battery-Only)", async () => {
  const p = await runSizing(
    {
      ...MSG,
      mode: "gridtie",
      chemistry: "lfp",
      hardwareConfig: "battery",
    },
    { fetchWeather: fakeWeather },
  );

  assert.equal(p.hardwareConfig, "battery");
  assert.ok(p.targets.length > 0);
  const solvable = p.targets.filter((t) => t.solvable);
  assert.ok(solvable.length > 0, "should have solvable battery-only targets");
  for (const t of solvable) {
    assert.equal(t.pvKw, 0, "battery-only configuration must have pvKw = 0");
    assert.ok(
      t.battKwh > 0,
      "battery-only configuration must have battKwh > 0",
    );
    assert.ok(t.bestPriceCallout, "must include best price scenario callout");
  }
});

test("runSizing supports hardwareConfig = 'solar' (Solar-Only)", async () => {
  const p = await runSizing(
    {
      ...MSG,
      mode: "gridtie",
      chemistry: "lfp",
      hardwareConfig: "solar",
    },
    { fetchWeather: fakeWeather },
  );

  assert.equal(p.hardwareConfig, "solar");
  assert.ok(p.targets.length > 0);
  const solvable = p.targets.filter((t) => t.solvable);
  assert.ok(solvable.length > 0, "should have solvable solar-only targets");
  for (const t of solvable) {
    assert.ok(t.pvKw > 0, "solar-only configuration must have pvKw > 0");
    assert.equal(
      t.battKwh,
      0,
      "solar-only configuration must have battKwh = 0",
    );
    assert.ok(t.bestPriceCallout, "must include best price scenario callout");
  }
});

test("frontier sweepSystems in grid-tie mode includes solar_only, battery_only, and both pointTypes", () => {
  const hours = synthesizeFromProfile(honolulu);
  const e1kw = buildE1kw(hours);
  const loadWh = expandProfile(flatProfile(10), hours.length);
  const tempsC = Float64Array.from(hours, (h) => h.tAmb);

  const raw = sweepSystems({
    e1kw,
    loadWh,
    tempsC,
    chemistry: "lfp",
    mode: "gridtie",
    pvMax: 10,
    battMax: 20,
    pvSteps: 5,
    battStep: 5,
  });

  const types = new Set(raw.map((pt) => pt.pointType));
  assert.ok(
    types.has("solar_only"),
    "curve lattice must include solar-only systems (batt = 0)",
  );
  assert.ok(
    types.has("battery_only"),
    "curve lattice must include battery-only systems (pv = 0)",
  );
  assert.ok(
    types.has("both"),
    "curve lattice must include solar+battery systems (pv > 0 & batt > 0)",
  );
});
