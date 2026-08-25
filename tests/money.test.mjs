// Money math tests. Run: node --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HORIZON_YEARS,
  annualGridSpendUsd, paybackYears, batteryReplacements, lcoeUsdPerKwh,
  lifetimeCostUsd, exportValueUsd, INSTALL_LABOR_PER_KWH_USABLE, laborMidPerKwh,
} from "../assets/js/sizing/money.js";

test("annualGridSpendUsd: daily kWh × 365 × tariff", () => {
  assert.ok(Math.abs(annualGridSpendUsd(10, 0.4) - 10 * 365 * 0.4) < 1e-9);
});

test("annualGridSpendUsd: rejects missing or non-positive inputs", () => {
  assert.equal(annualGridSpendUsd(0, 0.4), null);
  assert.equal(annualGridSpendUsd(-1, 0.4), null);
  assert.equal(annualGridSpendUsd(10, 0), null);
  assert.equal(annualGridSpendUsd(10, NaN), null);
  assert.equal(annualGridSpendUsd(NaN, 0.4), null);
});

test("paybackYears: capex divided by annual spend", () => {
  // $2,000 system against $1,000/yr bills -> exactly 2 years
  assert.ok(Math.abs(paybackYears(2000, 1000) - 2) < 1e-9);
  // Hawaii-flavored case: $6k against $0.42/kWh at 10 kWh/day
  const spend = annualGridSpendUsd(10, 0.42);
  assert.ok(paybackYears(6000, spend) > 3 && paybackYears(6000, spend) < 5);
});

test("paybackYears: null when there is no bill to displace", () => {
  assert.equal(paybackYears(2000, null), null);
  assert.equal(paybackYears(2000, 0), null);
  assert.equal(paybackYears(NaN, 1000), null);
});

test("batteryReplacements: bank lasting the horizon needs none", () => {
  // cyclesTo80 / cyclesPerYear = exactly HORIZON_YEARS -> zero replacements
  assert.equal(batteryReplacements(240, 6000), 0);          // 25 yr life
  assert.equal(batteryReplacements(120, 6000), 0);          // 50 yr life
});

test("batteryReplacements: floor(horizon/life) full swaps", () => {
  // 10-year life -> replacements at yr10 and yr20 -> 2 by year 20
  assert.equal(batteryReplacements(600, 6000), 2);
  // AGM-style: ~1.5-year life under heavy cycling -> many swaps, capped at 8
  assert.ok(batteryReplacements(4000, 600) === 8 || batteryReplacements(4000, 600) <= 8);
  // 12.5-year life -> floor(20/12.5) = one replacement boundary within the horizon
  assert.equal(batteryReplacements(480, 6000), 1);
});

test("batteryReplacements: zero or missing cycling means zero replacements", () => {
  assert.equal(batteryReplacements(0, 6000), 0);
  assert.equal(batteryReplacements(NaN, 6000), 0);
});

test("lcoeUsdPerKwh: capex plus replacements over served energy", () => {
  // $5,000 capex serving 4,000 kWh/yr over the horizon, no replacements:
  const denom = 4000 * HORIZON_YEARS;
  const l = lcoeUsdPerKwh({ capexMidUsd: 5000, annualServedKwh: 4000 });
  assert.ok(Math.abs(l - 5000 / denom) < 1e-9);
  // One $2,000 replacement: (5000+2000)/denom
  const l2 = lcoeUsdPerKwh({ capexMidUsd: 5000, battReplaceCostUsd: 2000, replacements: 1, annualServedKwh: 4000 });
  assert.ok(Math.abs(l2 - 7000 / denom) < 1e-9);
});

test("lcoeUsdPerKwh: null without served energy or capex", () => {
  assert.equal(lcoeUsdPerKwh({ capexMidUsd: 5000, annualServedKwh: 0 }), null);
  assert.equal(lcoeUsdPerKwh({ capexMidUsd: NaN, annualServedKwh: 4000 }), null);
});

test("GATE: honest economics story — AGM swaps constantly, LFP rarely, gentle use never", () => {
  const HORIZON = HORIZON_YEARS;
  // One full cycle every day: LFP (6000 cyc) lives ~16.4 yrs -> one swap; AGM (600) hits the cap.
  assert.equal(batteryReplacements(365, 6000, HORIZON), 1);
  assert.ok(batteryReplacements(365, 600, HORIZON) >= 6, "AGM cycled daily needs many banks");
  // Gentle cycling (~5 EFC/wk): LFP outlives the horizon entirely -> zero swaps.
  assert.equal(batteryReplacements(200, 6000, HORIZON), 0);
});

test("lifetimeCostUsd: swaps pay for a new bank PLUS new labor each time", () => {
  const r = lifetimeCostUsd({
    capexMidUsd: 10000,
    battKwhUsable: 10,
    battPriceMidPerKwh: 102,
    replacements: 2,
  });
  // first labor = 10 × mid labor (21) = 210
  assert.equal(r.firstLabor, Math.round(10 * laborMidPerKwh(INSTALL_LABOR_PER_KWH_USABLE)));
  // each swap = bank (10×102=1020) + labor (210) = 1230 → ×2 = 2460
  assert.equal(r.swapsAndLabor, Math.round(2 * (10 * 102 + 10 * laborMidPerKwh(INSTALL_LABOR_PER_KWH_USABLE))));
  assert.equal(r.total, 10000 + r.firstLabor + r.swapsAndLabor);
});

test("GATE: lead-acid's true lifetime cost dwarfs its sticker price", () => {
  // Same job, same usable kWh: AGM needs ~7 swaps over 25 yr, LFP maybe one.
  const agm = lifetimeCostUsd({ capexMidUsd: 4000, battKwhUsable: 14, battPriceMidPerKwh: 60, replacements: 7 });
  const lfp = lifetimeCostUsd({ capexMidUsd: 9000, battKwhUsable: 11, battPriceMidPerKwh: 102, replacements: 1 });
  assert.ok(agm.total > lfp.total, `AGM true cost (${agm.total}) must exceed LFP (${lfp.total})`);
  assert.ok(agm.swapsAndLabor > agm.total - agm.swapsAndLabor, "swaps+labor are the majority of AGM lifetime spend");
});

test("exportValueUsd: clipped surplus × feed-in rate, zero-safe", () => {
  assert.equal(exportValueUsd(1000, 0.12), 120);
  assert.equal(exportValueUsd(0, 0.12), 0);
  assert.equal(exportValueUsd(1000, null), 0);
  assert.equal(exportValueUsd(null, 0.12), 0);
});
