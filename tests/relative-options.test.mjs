import test from "node:test";
import assert from "node:assert/strict";
import { cycleLifeForDoD } from "../assets/js/sizing/engine.js";
import {
  batteryReplacements,
  lifetimeCostUsd,
  cumulativeCostSeries,
} from "../assets/js/sizing/money.js";
import { fullRange, landedMidBattKwhFor } from "../assets/js/sizing/pricing.js";

test("relative options: tiers strictly maintain ratios relative to base anchor", () => {
  const base = {
    pvKw: 6.0,
    battKwh: 14.0,
    chemistry: "lfp",
    chemLabel: "LFP",
    costMid: 8500,
    lifetimeCostMid: 11000,
  };

  const tiers = [
    { id: "compact", battRatio: 0.6, pvRatio: 0.7 },
    { id: "lean", battRatio: 0.8, pvRatio: 0.85 },
    { id: "baseline", battRatio: 1.0, pvRatio: 1.0, isBaseline: true },
    { id: "high", battRatio: 1.35, pvRatio: 1.25 },
    { id: "max", battRatio: 1.75, pvRatio: 1.5 },
  ];

  // Helper simulating the stable-anchor resolution from renderRelativeOptions
  function resolveTier(sel, tierId) {
    const anchor = sel._relativeAnchor || sel;
    const t = tiers.find((x) => x.id === tierId);
    assert.ok(t, `Tier ${tierId} must exist`);

    const battKwh = Math.round(anchor.battKwh * t.battRatio * 10) / 10;
    const pvKw = Math.round(anchor.pvKw * t.pvRatio * 10) / 10;
    return {
      ...anchor,
      _relativeAnchor: anchor,
      _relativeTierId: t.id,
      pvKw,
      battKwh,
    };
  }

  // 1. Initial adoption of Maximum Independence (+75%)
  const adoptedMax1 = resolveTier(base, "max");
  assert.equal(adoptedMax1.battKwh, 24.5, "14.0 * 1.75 = 24.5 kWh");
  assert.equal(adoptedMax1.pvKw, 9.0, "6.0 * 1.5 = 9.0 kW");
  assert.equal(
    adoptedMax1._relativeAnchor,
    base,
    "Must hold reference to base anchor",
  );

  // 2. Re-clicking Maximum Independence must NOT multiply 24.5 * 1.75
  const adoptedMax2 = resolveTier(adoptedMax1, "max");
  assert.equal(
    adoptedMax2.battKwh,
    24.5,
    "Repeated adoption must not compound battery capacity",
  );
  assert.equal(
    adoptedMax2.pvKw,
    9.0,
    "Repeated adoption must not compound PV capacity",
  );

  // 3. Switching to High Resilience (+35%) from the adopted Max tier
  const adoptedHigh = resolveTier(adoptedMax2, "high");
  assert.equal(
    adoptedHigh.battKwh,
    18.9,
    "Must calculate 14.0 * 1.35 = 18.9 kWh, not compound against 24.5",
  );
  assert.equal(
    adoptedHigh.pvKw,
    7.5,
    "Must calculate 6.0 * 1.25 = 7.5 kW, not compound against 9.0",
  );

  // 4. Resetting to Baseline restores original values exactly
  const resetBase = resolveTier(adoptedHigh, "baseline");
  assert.equal(
    resetBase.battKwh,
    14.0,
    "Reset restores exact base battery kWh",
  );
  assert.equal(resetBase.pvKw, 6.0, "Reset restores exact base PV kW");
});

test("relative options: oversized tiers achieve shallower DoD and zero/reduced swaps", () => {
  const dailyKwh = 10;
  const baseBattKwh = 12.0; // 12 kWh usable
  const chem = "lfp";
  const ratedDoD = 0.8;

  // Base tier cycling
  const baseEffectiveDod = Math.min(
    ratedDoD,
    Math.max(0.1, (dailyKwh / baseBattKwh) * ratedDoD),
  );
  const baseRatedCycles = cycleLifeForDoD(chem, baseEffectiveDod);
  const baseAnnualCycles = Math.round((dailyKwh * 365) / baseBattKwh);
  const baseSwaps = batteryReplacements(baseAnnualCycles, baseRatedCycles, 20);

  // Max tier (1.75x capacity = 21 kWh usable)
  const maxBattKwh = 21.0;
  const maxEffectiveDod = Math.min(
    ratedDoD,
    Math.max(0.1, (dailyKwh / maxBattKwh) * ratedDoD),
  );
  const maxRatedCycles = cycleLifeForDoD(chem, maxEffectiveDod);
  const maxAnnualCycles = Math.round((dailyKwh * 365) / maxBattKwh);
  const maxSwaps = batteryReplacements(maxAnnualCycles, maxRatedCycles, 20);

  assert.ok(
    maxEffectiveDod < baseEffectiveDod,
    `Max tier DoD (${maxEffectiveDod.toFixed(2)}) must be shallower than base (${baseEffectiveDod.toFixed(2)})`,
  );
  assert.ok(
    maxRatedCycles > baseRatedCycles,
    `Max tier cycle life (${maxRatedCycles}) must exceed base cycle life (${baseRatedCycles})`,
  );
  assert.ok(
    maxSwaps <= baseSwaps,
    `Max tier 20-yr swaps (${maxSwaps}) must be <= base swaps (${baseSwaps})`,
  );
});

test("relative options: cumCostSeries calculates valid series terminating at lifetimeCostMid", () => {
  const pvKw = 7.5;
  const battKwh = 18.9;
  const chem = "lfp";
  const landedF = 1;
  const annualGridSpendUsd = 2400;

  const cost = fullRange(pvKw, battKwh, chem, landedF);
  const battMid = landedMidBattKwhFor(chem, landedF);
  const swaps = 0;
  const life = lifetimeCostUsd({
    capexMidUsd: cost.objectiveMid,
    battKwhUsable: battKwh,
    battPriceMidPerKwh: battMid,
    replacements: swaps,
    laborPerKwh: [12, 30],
  });

  const cumCost = cumulativeCostSeries({
    capexMidUsd: cost.objectiveMid,
    annualSavingsUsd: annualGridSpendUsd,
    residualAnnualUsd: 0,
    swapsAndLaborTotalUsd: life.swapsAndLabor,
    replacements: swaps,
    batteryLifeYears: 20,
    firstLaborUsd: life.firstLabor,
  });

  assert.ok(cumCost !== null, "Cumulative cost series must be defined");
  assert.equal(cumCost.years, 20);
  assert.equal(cumCost.system.length, 20);
  assert.equal(cumCost.grid.length, 20);

  // In offgrid with 0 residual and 0 swaps, system line after year 1 is capex + firstLabor
  assert.equal(cumCost.system[19], cost.objectiveMid + life.firstLabor);
  assert.equal(cumCost.grid[19], annualGridSpendUsd * 20);
});
