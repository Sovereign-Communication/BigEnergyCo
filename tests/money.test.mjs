// Money math tests. Run: node --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HORIZON_YEARS,
  annualGridSpendUsd, paybackYears, batteryReplacements, lcoeUsdPerKwh,
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
  // 10-year life -> replacements at yr10 and yr20 -> 2 by year 25
  assert.equal(batteryReplacements(600, 6000), 2);
  // AGM-style: ~1.5-year life under heavy cycling -> many swaps, capped at 8
  assert.ok(batteryReplacements(4000, 600) === 8 || batteryReplacements(4000, 600) <= 8);
  // 12.5-year life -> floor(25/12.5) = exactly two replacement boundaries
  assert.equal(batteryReplacements(480, 6000), 2);
});

test("batteryReplacements: zero or missing cycling means zero replacements", () => {
  assert.equal(batteryReplacements(0, 6000), 0);
  assert.equal(batteryReplacements(NaN, 6000), 0);
});

test("lcoeUsdPerKwh: capex plus replacements over served energy", () => {
  // $5,000 capex serving 4,000 kWh/yr for 25 yrs, no replacements:
  // 5000 / (4000*25) = $0.05/kWh
  const l = lcoeUsdPerKwh({ capexMidUsd: 5000, annualServedKwh: 4000 });
  assert.ok(Math.abs(l - 0.05) < 1e-9);
  // One $2,000 replacement: (5000+2000)/100000 = $0.07/kWh
  const l2 = lcoeUsdPerKwh({ capexMidUsd: 5000, battReplaceCostUsd: 2000, replacements: 1, annualServedKwh: 4000 });
  assert.ok(Math.abs(l2 - 0.07) < 1e-9);
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
