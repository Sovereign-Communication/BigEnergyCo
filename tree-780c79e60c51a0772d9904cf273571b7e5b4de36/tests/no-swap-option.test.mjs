// Tests for #155 — the no-swap UI option for battery sizing.
//
// A visible toggle lets the user turn the battery-oversize swap strategy
// off. In no-swap mode the engine returns its direct pick (bank swaps
// counted, never avoided by oversizing); results are labeled in both modes;
// default behavior is unchanged.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildE1kw,
  flatProfile,
  expandProfile,
  sizeForBillCut,
  capacityScaleFor,
} from "../assets/js/sizing/engine.js";
import { INSTALL_LABOR_PER_KWH_USABLE } from "../assets/js/sizing/money.js";
import { runSizing } from "../assets/js/sizing/run.js";
import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import {
  OFFLINE_PROFILES,
  PROFILE_YEAR,
} from "../assets/js/sizing/profiles.js";
import {
  getScope,
  estimateTariff,
  landedMidBattKwhFor,
} from "../assets/js/sizing/pricing.js";

const honolulu = OFFLINE_PROFILES.find((p) => p.name.includes("Honolulu"));

function fixtureWeather() {
  return async () => ({
    hours: synthesizeFromProfile(honolulu),
    meta: {
      latitude: 21.31,
      longitude: -157.86,
      startYear: PROFILE_YEAR,
      endYear: PROFILE_YEAR,
      years: 1,
      source: "test fixture",
      offline: true,
    },
  });
}

// Honolulu sodium, 54 kWh/day, cut-82%: a case where the strategy demonstrably
// adopts an oversized bank (scenario oversized_cheaper), so the off-mode
// contrast is real, not vacuous.
function engineArgs() {
  const hours = synthesizeFromProfile(honolulu);
  const tempsC = hours.map((h) => h.tAmb);
  const meanTempC = tempsC.reduce((a, b) => a + b, 0) / tempsC.length;
  const landedScope = getScope("landed");
  const region = estimateTariff(honolulu.lat, honolulu.lon);
  const laborF = region.laborF ?? 1;
  const landedF = region.landedF ?? 1.1;
  const chem = "naion";
  return {
    e1kw: buildE1kw(hours),
    loadWh: expandProfile(flatProfile(54), hours.length),
    tempsC,
    chemistry: chem,
    minFraction: 0.82,
    years: 1,
    costPerWpv: ((landedScope.pvPerW[0] + landedScope.pvPerW[1]) / 2) * landedF,
    costPerKwhBatt: landedMidBattKwhFor(chem, landedF),
    costPerKwInv:
      ((landedScope.invPerKw[0] + landedScope.invPerKw[1]) / 2) * landedF,
    pvMax: 45,
    battMax: 120,
    battStep: 1,
    capacityScale: capacityScaleFor(chem, meanTempC),
    laborPerKwh: INSTALL_LABOR_PER_KWH_USABLE.map((v) => v * laborF),
  };
}

test("engine default keeps the oversize strategy (existing behavior)", () => {
  const pick = sizeForBillCut(engineArgs());
  assert.equal(
    pick.oversizeScenario,
    "oversized_cheaper",
    "this fixture must exercise a real oversize adoption",
  );
  assert.ok(
    pick.oversizedBattKwh >= pick.battKwh,
    "adopted bank is the oversized one",
  );
});

test("engine oversizeStrategy:false returns the labeled direct pick", () => {
  const on = sizeForBillCut(engineArgs());
  const off = sizeForBillCut({ ...engineArgs(), oversizeStrategy: false });
  assert.equal(off.oversizeScenario, "strategy_off");
  assert.ok(
    off.battKwh < on.battKwh,
    `no-swap mode must skip the adopted oversized bank (off ${off.battKwh} kWh < on ${on.battKwh} kWh)`,
  );
  assert.equal(
    off.oversizedBattKwh,
    off.battKwh,
    "no oversized bank is named in no-swap mode",
  );
  assert.equal(off.oversizeSavingsUsd, 0);
  assert.match(
    off.bestPriceCallout,
    /Oversize strategy off: the engine's direct pick/,
    "no-swap results are labeled",
  );
});

test("runSizing noSwapMode:true labels entries strategy_off; default unchanged", async () => {
  const msg = {
    latitude: 21.31,
    longitude: -157.86,
    dailyKwh: 54,
    tariff: 0.15,
    exportRate: null,
    years: 1,
    mode: "gridtie",
    chemistry: "naion",
    customCut: 0.82,
    hardwareConfig: "both",
  };
  const def = await runSizing({ ...msg }, { fetchWeather: fixtureWeather() });
  const noswap = await runSizing(
    { ...msg, noSwapMode: true },
    { fetchWeather: fixtureWeather() },
  );
  const defTargets = (def.targets || []).filter((t) => t.solvable);
  const offTargets = (noswap.targets || []).filter((t) => t.solvable);
  assert.ok(defTargets.length > 0 && offTargets.length > 0);

  for (const t of defTargets) {
    assert.notEqual(
      t.oversizeScenario,
      "strategy_off",
      "default path must never carry the no-swap label",
    );
  }
  for (const t of offTargets) {
    assert.equal(
      t.oversizeScenario,
      "strategy_off",
      "no-swap mode labels every result",
    );
    assert.match(
      t.bestPriceCallout,
      /Oversize strategy off/,
      "no-swap callout names the mode",
    );
  }
  // Results recompute between modes: at least the labeling differs, and the
  // engine-level test above pins the bank-size contrast on an adopting case.
  assert.ok(
    offTargets.some(
      (t, i) =>
        t.oversizeScenario !== defTargets[i].oversizeScenario ||
        t.battKwh !== defTargets[i].battKwh,
    ),
    "toggling the option must change the results",
  );
});
