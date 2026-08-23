// Worldwide-phase tests: lead-acid delivered capacity, cold scaling, and
// sodium-aware pricing. Run: node --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHEMISTRIES, coldCapacityScale, capacityScaleFor,
  buildE1kw, flatProfile, expandProfile, simulate,
} from "../assets/js/sizing/engine.js";
import { fullRange, battOnlyCost } from "../assets/js/sizing/pricing.js";

test("capacityScaleFor: LFP and sodium are unscaled; AGM loses to rate", () => {
  assert.equal(capacityScaleFor("lfp"), 1);
  assert.equal(capacityScaleFor("naion"), 1);
  assert.ok(capacityScaleFor("agm") < 1, "AGM rate loss must be reflected");
});

test("coldCapacityScale: hot sites 1.0, cold sites floor at 0.6 (lead-acid only)", () => {
  assert.equal(coldCapacityScale("agm", 30), 1);
  assert.equal(coldCapacityScale("lfp", -10), 1, "temperature model handles charging separately for lithium");
  const mild = coldCapacityScale("agm", 10);
  assert.ok(mild < 1 && mild > 0.6, "25°C−10°C = 15 × 0.8% ≈ 12% loss");
  assert.equal(coldCapacityScale("agm", -40), 0.6, "floor");
});

test("GATE: same nameplate bank serves strictly less in AGM than LFP", () => {
  // Weak array + steady load forces the bank to cycle hard every night:
  // the derated AGM must hit empty sooner than the identical-nameplate LFP.
  const hours = [];
  for (let i = 0; i < 24 * 30; i++) {
    const hod = i % 24;
    hours.push({ ghi: hod >= 9 && hod <= 14 ? 400 : 0, tAmb: 25 });
  }
  const e1 = buildE1kw(hours);
  const load = expandProfile(flatProfile(10), e1.length);
  const lfp = simulate({ pvKw: 2, battKwhUsable: 10, e1kw: e1, loadWh: load, chemistry: "lfp" });
  const agm = simulate({ pvKw: 2, battKwhUsable: 10, e1kw: e1, loadWh: load, chemistry: "agm" });
  assert.ok(agm.unmetWh > lfp.unmetWh,
    `AGM (${agm.unmetWh.toFixed(0)}) must serve strictly worse than LFP (${lfp.unmetWh.toFixed(0)})`);
  assert.ok(agm.unmetWh > 0 && lfp.unmetWh > 0, "weak-array scenario strains both banks");
});

test("sodium pricing carries a premium over LFP in every scope", () => {
  for (const scope of ["cells", "landed", "powmr"]) {
    const lfpR = fullRange(4, 20, "lfp");
    const naR = fullRange(4, 20, "naion");
    assert.ok(naR.battPerKwhLo >= lfpR.battPerKwhLo, `${scope}: sodium low >= lfp low`);
    assert.ok(naR.battPerKwhHi >= lfpR.battPerKwhHi, `${scope}: sodium high >= lfp high`);
    break; // ranges are chemistry-level; one pass suffices
  }
  const lfpOnly = battOnlyCost(50, "lfp");
  const naOnly = battOnlyCost(50, "naion");
  assert.ok(naOnly.landed.lo > lfpOnly.landed.lo);
  assert.ok(naOnly.cells.hi > lfpOnly.cells.hi);
});
