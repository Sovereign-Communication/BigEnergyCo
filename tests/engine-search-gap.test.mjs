// Regression test for #154 — the engine's bank-size scan must find the
// cost-optimal bank size, including oversize options.
//
// Background (PR #2, merged 2026-09-03): the coarse scan (pvFloor trap +
// +/-1 kWh refinement) missed cheaper optima. Sodium 1.5x (1 swap) and 3x
// (0 swaps) banks both cost ~$39 less than the engine's 2-swap pick, but the
// scan never found them — a correctness defect in a sizing product.
//
// What closed the gap since (verified 2026-09-27):
//   * PR #6 "verified-oversize adoption": after the lattice scan, the engine
//     evaluates a zero-swap oversized bank on a FRESH simulation and adopts
//     it only when verified cheaper — so the optimum is found by the scan
//     itself, not missed by it.
//   * Per-chemistry battery pricing (aaac300): replacement banks are costed
//     at their own chemistry's landed rate, which moved the sodium optimum
//     onto the lattice the scan already evaluates.
//   * The stale pvFloor shortcut is gone: every bank row now binary-searches
//     PV from 0.05 (see the comment at the pvFloor site in engine.js).
//
// Residual bound: the scan evaluates every integer-kWh bank (battStep = 1 in
// production) on true 20-year lifetime cost, refines +/-1 kWh around the
// winner, and verifies/adopts a cheaper oversized bank. Any remaining miss
// is bounded by lattice granularity between adjacent 1 kWh steps —
// sub-dollar on the lifetime-cost objective, which is smooth in bank size.
//
// This test pins the documented PR #2 sodium case (Honolulu, 10 kWh/day,
// cut-80%, 20-year horizon, production cost derivation mirroring run.js):
// the engine's pick must cost no more than the forced 1.5x/2x/3x oversize
// alternatives. If the search gap ever reopens, this fails.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildE1kw,
  flatProfile,
  expandProfile,
  sizeForBillCut,
  simulateOffset,
  CHEMISTRIES,
  capacityScaleFor,
} from "../assets/js/sizing/engine.js";
import {
  batteryReplacements,
  lifetimeCostUsd,
  INSTALL_LABOR_PER_KWH_USABLE,
} from "../assets/js/sizing/money.js";
import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import { OFFLINE_PROFILES } from "../assets/js/sizing/profiles.js";
import {
  getScope,
  estimateTariff,
  landedMidBattKwhFor,
} from "../assets/js/sizing/pricing.js";

const DAILY_KWH = 10;
const CUT = 0.8;
const MULTIPLIERS = [1.5, 2, 3];

/** Fixture + production cost derivation for one city (mirrors run.js). */
function site(cityName) {
  const profile = OFFLINE_PROFILES.find((p) => p.name === cityName);
  const hours = synthesizeFromProfile(profile);
  const tempsC = hours.map((h) => h.tAmb);
  const e1kw = buildE1kw(hours);
  const loadWh = expandProfile(flatProfile(DAILY_KWH), hours.length);
  const landedScope = getScope("landed");
  const region = estimateTariff(profile.lat, profile.lon);
  const laborF = region.laborF ?? 1;
  const landedF = region.landedF ?? 1.1;
  return {
    e1kw,
    loadWh,
    tempsC,
    meanTempC: tempsC.reduce((a, b) => a + b, 0) / tempsC.length,
    loadTotal: [...loadWh].reduce((a, b) => a + b, 0),
    laborPerKwh: INSTALL_LABOR_PER_KWH_USABLE.map((v) => v * laborF),
    costPerWpvMid:
      ((landedScope.pvPerW[0] + landedScope.pvPerW[1]) / 2) * landedF,
    battMid: (chem) => landedMidBattKwhFor(chem, landedF),
    costPerKwInvMid:
      ((landedScope.invPerKw[0] + landedScope.invPerKw[1]) / 2) * landedF,
  };
}

/** True 20-year cost of a (pvKw, battKwh) system, swaps + labor included. */
function lifetimeFor(s, chem, pvKw, battKwh, cyclesPerYear) {
  const replacements = batteryReplacements(
    cyclesPerYear,
    CHEMISTRIES[chem].cyclesTo80,
  );
  const battMid = s.battMid(chem);
  const life = lifetimeCostUsd({
    capexMidUsd:
      pvKw * 1000 * s.costPerWpvMid +
      pvKw * s.costPerKwInvMid +
      battKwh * battMid,
    battKwhUsable: battKwh,
    battPriceMidPerKwh: battMid,
    replacements,
    laborPerKwh: s.laborPerKwh,
  });
  return { replacements, total: life.total };
}

/** Smallest PV meeting the cut target for a forced bank size. */
function minPvFor(s, chem, battKwh, capScale, budget) {
  const evaluate = (pv) =>
    simulateOffset({
      pvKw: pv,
      battKwhUsable: battKwh,
      e1kw: s.e1kw,
      loadWh: s.loadWh,
      chemistry: chem,
      startSoc: 0.5,
      tempsC: s.tempsC,
      capacityScale: capScale,
    });
  const meets = (r) => r.importedWh <= budget + 1e-6;
  if (meets(evaluate(0.05))) return 0.05;
  let lo = 0.05,
    hi = 45;
  if (!meets(evaluate(hi))) return null;
  while (hi - lo > 0.25) {
    const mid = (lo + hi) / 2;
    if (meets(evaluate(mid))) hi = mid;
    else lo = mid;
  }
  return +hi.toFixed(2);
}

test("engine pick costs no more than forced 1.5x/2x/3x oversize alternatives (PR #2 sodium case, #154)", () => {
  const s = site("Honolulu, USA");
  const chem = "naion";
  const capScale = capacityScaleFor(chem, s.meanTempC);

  const pick = sizeForBillCut({
    e1kw: s.e1kw,
    loadWh: s.loadWh,
    tempsC: s.tempsC,
    chemistry: chem,
    minFraction: CUT,
    years: 1,
    costPerWpv: s.costPerWpvMid,
    costPerKwhBatt: s.battMid(chem),
    costPerKwInv: s.costPerKwInvMid,
    pvMax: 45,
    battMax: 120,
    battStep: 1,
    capacityScale: capScale,
    laborPerKwh: s.laborPerKwh,
  });
  assert.ok(pick, "cut-80% must be solvable for Honolulu sodium");

  const pickSim = simulateOffset({
    pvKw: pick.pvKw,
    battKwhUsable: pick.battKwh,
    e1kw: s.e1kw,
    loadWh: s.loadWh,
    chemistry: chem,
    startSoc: 0.5,
    tempsC: s.tempsC,
    capacityScale: capScale,
    capture: true,
  });
  const pickCost = lifetimeFor(
    s,
    chem,
    pick.pvKw,
    pick.battKwh,
    pickSim.cyclesEquivalent,
  );

  const budget = s.loadTotal * (1 - CUT);
  for (const m of MULTIPLIERS) {
    const battKwh = Math.round(pick.battKwh * m * 4) / 4;
    const pvKw = minPvFor(s, chem, battKwh, capScale, budget);
    assert.ok(
      pvKw !== null,
      `${m}x bank (${battKwh} kWh) must stay solvable for the comparison`,
    );
    const sim = simulateOffset({
      pvKw,
      battKwhUsable: battKwh,
      e1kw: s.e1kw,
      loadWh: s.loadWh,
      chemistry: chem,
      startSoc: 0.5,
      tempsC: s.tempsC,
      capacityScale: capScale,
      capture: true,
    });
    const alt = lifetimeFor(s, chem, pvKw, battKwh, sim.cyclesEquivalent);
    assert.ok(
      pickCost.total <= alt.total + 1e-6,
      `search gap: engine pick ($${pickCost.total.toFixed(0)}, ${pick.battKwh} kWh) ` +
        `costs more than the forced ${m}x alternative ($${alt.total.toFixed(0)}, ${battKwh} kWh)`,
    );
  }
});
