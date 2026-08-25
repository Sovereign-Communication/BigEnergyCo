// True break-even tests: payback that counts every bank swap.
// Run: node --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { trueBreakEvenYear } from "../assets/js/sizing/money.js";

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
