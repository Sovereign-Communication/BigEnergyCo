// True break-even tests: payback that counts every bank swap.
// Run: node --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { trueBreakEvenYear, cumulativeCostSeries } from "../assets/js/sizing/money.js";

test("no swaps: break-even matches simple payback (within a year)", () => {
  const y = trueBreakEvenYear({ capexMidUsd: 2400, annualSavingsUsd: 1200, batteryLifeYears: 30 });
  assert.ok(y >= 2 && y <= 3, `expected ~2, got ${y}`);
});

test("swaps push break-even later than first-cost payback", () => {
  // Base: $2,400 at $200/yr savings -> year 12. A bank dying at year 8
  // ($1,200 swap) pushes cumulative cost to $3,600 — break-even slides
  // from year 12 to year 18 (within the 20-year horizon).
  const base = trueBreakEvenYear({ capexMidUsd: 2400, annualSavingsUsd: 200, batteryLifeYears: 30 });
  assert.equal(base, 12);
  const withSwaps = trueBreakEvenYear({
    capexMidUsd: 2400, annualSavingsUsd: 200,
    swapsAndLaborTotalUsd: 1200, replacements: 1, batteryLifeYears: 8,
  });
  assert.equal(withSwaps, 18);
});

test("GATE: swap costs can outpace savings — honest 'never' answer", () => {
  const y = trueBreakEvenYear({
    capexMidUsd: 1000, annualSavingsUsd: 100,
    swapsAndLaborTotalUsd: 16000, replacements: 8, batteryLifeYears: 2,
  });
  assert.equal(y, null, "a bank dying every 2 years at $2k/swap must NEVER break even");
});

test("GATE: lead-acid profile vs LFP profile — the gap is the message", () => {
  const agm = trueBreakEvenYear({
    capexMidUsd: 2500, annualSavingsUsd: 640,
    swapsAndLaborTotalUsd: 8900, replacements: 8, batteryLifeYears: 1.6,
  });
  const lfp = trueBreakEvenYear({
    capexMidUsd: 2300, annualSavingsUsd: 640,
    swapsAndLaborTotalUsd: 1700, replacements: 2, batteryLifeYears: 12.8,
  });
  assert.ok(agm === null || agm > lfp, `AGM (${agm}) must never beat LFP (${lfp})`);
});

test("cumulative series: grid line rises linearly, solar line steps at swaps", () => {
  const s = cumulativeCostSeries({
    capexMidUsd: 2400, annualSavingsUsd: 200,
    swapsAndLaborTotalUsd: 1200, replacements: 1, batteryLifeYears: 8,
  });
  assert.equal(s.years, 20);
  assert.equal(s.grid.length, 20);
  assert.equal(s.solar.length, 20);
  // grid: pure accumulation, no cost at year 0
  assert.equal(s.grid[0], 200);
  assert.equal(s.grid[19], 4000);
  // solar: full capex from day one, swap lands at year 8 (index 7)
  assert.equal(s.solar[0], 2400);
  assert.equal(s.solar[6], 2400);
  assert.equal(s.solar[7], 3600);
  assert.equal(s.solar[19], 3600);
  // crossing point = trueBreakEvenYear
  const be = trueBreakEvenYear({
    capexMidUsd: 2400, annualSavingsUsd: 200,
    swapsAndLaborTotalUsd: 1200, replacements: 1, batteryLifeYears: 8,
  });
  const crossYr = s.grid.findIndex((g, i) => g >= s.solar[i]) + 1;
  assert.equal(crossYr, be, "chart crossing must equal the break-even row");
});

test("cumulative series: null without savings (no tariff entered)", () => {
  assert.equal(cumulativeCostSeries({ capexMidUsd: 2400, annualSavingsUsd: 0 }), null);
  assert.equal(cumulativeCostSeries({ capexMidUsd: null, annualSavingsUsd: 200 }), null);
});
