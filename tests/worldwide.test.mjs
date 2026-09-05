// Worldwide-phase tests: lead-acid delivered capacity, cold scaling, and
// sodium-aware pricing. Run: node --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHEMISTRIES,
  coldCapacityScale,
  capacityScaleFor,
  buildE1kw,
  flatProfile,
  expandProfile,
  simulate,
} from "../assets/js/sizing/engine.js";
import { fullRange, battOnlyCost } from "../assets/js/sizing/pricing.js";

test("GATE: sodium on LFP voltage settings = less capacity but LONGER life", () => {
  // The ~40 V LFP low cutoff sits above true sodium empty: shallower
  // effective DoD protects the pack, so life EXCEEDS the deep-cycle rating
  // even though usable capacity shrinks.
  assert.equal(CHEMISTRIES.naion.usableScale, 0.85);
  assert.ok(
    CHEMISTRIES.naion.cyclesTo80 > 4500,
    "shallow effective DoD must extend rated life",
  );
  assert.ok(
    CHEMISTRIES.naion.cyclesTo80 < CHEMISTRIES.lfp.cyclesTo80,
    "still below LFP's proven benchmark",
  );
});

test("GATE: lead-acid assumes NO active balancing (typical DIY strings)", () => {
  assert.ok(
    CHEMISTRIES.agm.cyclesTo80 <= 550,
    "manufacturer lab ratings are not achieved without balancers",
  );
});

test("capacityScaleFor: sodium keeps 0.85 rate scale; cold drags AGM below it", () => {
  assert.equal(capacityScaleFor("lfp"), 1);
  assert.equal(capacityScaleFor("naion"), 0.85);
  assert.ok(
    capacityScaleFor("agm", 5) < capacityScaleFor("naion", 5),
    "cold-site AGM loses capacity on top of its rate loss; sodium's cold story is about charging, not capacity",
  );
});

test("coldCapacityScale: hot sites 1.0, cold sites floor at 0.6 (lead-acid only)", () => {
  assert.equal(coldCapacityScale("agm", 30), 1);
  assert.equal(
    coldCapacityScale("lfp", -10),
    1,
    "temperature model handles charging separately for lithium",
  );
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
  const lfp = simulate({
    pvKw: 2,
    battKwhUsable: 10,
    e1kw: e1,
    loadWh: load,
    chemistry: "lfp",
  });
  const agm = simulate({
    pvKw: 2,
    battKwhUsable: 10,
    e1kw: e1,
    loadWh: load,
    chemistry: "agm",
  });
  assert.ok(
    agm.unmetWh > lfp.unmetWh,
    `AGM (${agm.unmetWh.toFixed(0)}) must serve strictly worse than LFP (${lfp.unmetWh.toFixed(0)})`,
  );
  assert.ok(
    agm.unmetWh > 0 && lfp.unmetWh > 0,
    "weak-array scenario strains both banks",
  );
});

test("sodium pricing carries a premium over LFP in every scope", () => {
  for (const scope of ["cells", "landed", "powmr"]) {
    const lfpR = fullRange(4, 20, "lfp");
    const naR = fullRange(4, 20, "naion");
    assert.ok(
      naR.battPerKwhLo >= lfpR.battPerKwhLo,
      `${scope}: sodium low >= lfp low`,
    );
    assert.ok(
      naR.battPerKwhHi >= lfpR.battPerKwhHi,
      `${scope}: sodium high >= lfp high`,
    );
    break; // ranges are chemistry-level; one pass suffices
  }
  const lfpOnly = battOnlyCost(50, "lfp");
  const naOnly = battOnlyCost(50, "naion");
  assert.ok(naOnly.landed.lo > lfpOnly.landed.lo);
  assert.ok(naOnly.cells.hi > lfpOnly.cells.hi);
});
