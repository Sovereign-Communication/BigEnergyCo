// Swap-strategy test: does deliberately oversizing the battery (2x, shallow
// cycles) beat the engine's own pick on true 20-year cost?
//
// The strategy under test (user proposal, Aug 2026): a bank that is oversized
// so it "hardly ever goes below 20%" sees half the cycle load of a tight bank,
// lasts ~2x as long, and can dodge bank-swap labor — potentially saving money
// even though the first bank costs more.
//
// How this test works: it drives the REAL engine (sizeForBillCut +
// simulateOffset + dailyExtremes + batteryReplacements + lifetimeCostUsd) on
// the offline Honolulu and London fixtures, with the same cost/labor
// derivation run.js uses (landed scope mids × regional labor/freight factors).
// For each chemistry it computes the engine's own pick, then forces 1.5x/2x/3x
// banks with a fresh minimal-PV search (the same meets() constraint the engine
// uses) and compares true 20-year cost. Fully offline and deterministic.
//
// Findings pinned here (Honolulu, 10 kWh/day, cut-80%, 20-yr horizon,
// re-pinned Sept 2026 after per-chemistry battery pricing (aaac300) and
// verified-oversize adoption (#6); costs use each chemistry's OWN landed-mid
// $/usable-kWh, mirroring run.js):
//   * LFP: engine pick is the tight 1-swap bank; 2x halves cycles/yr
//     (~582 -> ~297) and mean daily swing (~80% -> ~41%), reaching 0 swaps
//     at ~the same 20-yr cost ($2,814 -> $2,814, noise).
//   * Sodium: the engine now picks the 0-swap optimum ITSELF (13 kWh, 0 swaps,
//     $3,549, scenario zero_swap_natural) — forced 1.5x/2x/3x banks stay
//     0-swap but cost strictly more (+$1,274/+$2,548/+$5,096). Oversize wins
//     nothing: the lifetime-cost search already internalized the tradeoff.
//   * AGM: oversize NEVER pays — swaps stay capped at 8 until 3x (7) and the
//     3x system costs ~$27.5k more.
//   * London (cloudy) robustness: LFP already lands on 0 swaps (gentle ~298
//     cycles/yr) so oversize only adds cost (+$687); sodium likewise picks
//     0 swaps ($4,317) with 2x adding ~$1,935.
//   * Net: deliberate oversizing is not a strategy the tool should recommend
//     anywhere in this envelope — the engine adopts a verified-cheaper
//     oversized bank on its own, and the scenario note always matches the
//     recommended system (see tests/oversize-adopt.test.mjs).
//
// Run: node scripts/swap-strategy-test.mjs   (manual research script — NOT run
// in CI; `npm test` scopes to tests/. Re-pinned Sept 2026 to the unified
// engine; re-pin again if sizing economics change.)

import { buildE1kw, flatProfile, expandProfile, sizeForBillCut,
         simulateOffset, dailyExtremes, CHEMISTRIES, capacityScaleFor } from "../assets/js/sizing/engine.js";
import { batteryReplacements, lifetimeCostUsd, INSTALL_LABOR_PER_KWH_USABLE, HORIZON_YEARS } from "../assets/js/sizing/money.js";
import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import { OFFLINE_PROFILES } from "../assets/js/sizing/profiles.js";
import { getScope, estimateTariff, landedMidBattKwhFor } from "../assets/js/sizing/pricing.js";

const DAILY_KWH = 10;
const CUT = 0.8;
const MULTIPLIERS = [1.5, 2, 3];

let fails = 0;
const check = (name, ok) => { console.log((ok ? "OK    " : "FAIL  ") + name); if (!ok) fails++; };

/** Build the fixture + production cost derivation for one city (mirrors run.js). */
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
    cityName, e1kw, loadWh, tempsC,
    meanTempC: tempsC.reduce((a, b) => a + b, 0) / tempsC.length,
    loadTotal: [...loadWh].reduce((a, b) => a + b, 0),
    laborPerKwh: INSTALL_LABOR_PER_KWH_USABLE.map((v) => v * laborF),
    costPerWpvMid: (landedScope.pvPerW[0] + landedScope.pvPerW[1]) / 2 * landedF,
    // Per-chemistry landed-mid battery $/usable-kWh, mirroring run.js
    // (aaac300: replacement banks are costed at their OWN chemistry's rate).
    battMid: (chem) => landedMidBattKwhFor(chem, landedF),
    costPerKwInvMid: (landedScope.invPerKw[0] + landedScope.invPerKw[1]) / 2 * landedF,
  };
}

/** True 20-yr cost of a (pv, batt) system, with swaps + labor (mirrors run.js). */
function lifetimeFor(s, chem, pvKw, battKwh, cyclesPerYear) {
  const replacements = batteryReplacements(cyclesPerYear, CHEMISTRIES[chem].cyclesTo80);
  const battMid = s.battMid(chem);
  const life = lifetimeCostUsd({
    capexMidUsd: pvKw * 1000 * s.costPerWpvMid + pvKw * s.costPerKwInvMid + battKwh * battMid,
    battKwhUsable: battKwh,
    battPriceMidPerKwh: battMid,
    replacements,
    laborPerKwh: s.laborPerKwh,
  });
  return { replacements, total: life.total };
}

/** cycles/yr, mean daily swing, min usable SOC for a simulated system. */
function metrics(s, chem, pvKw, battKwh, capScale) {
  const sim = simulateOffset({
    pvKw, battKwhUsable: battKwh, e1kw: s.e1kw, loadWh: s.loadWh, chemistry: chem,
    startSoc: 0.5, tempsC: s.tempsC, capacityScale: capScale, capture: true,
  });
  const ext = dailyExtremes(sim.socSeries);
  let minUsable = 1, swingSum = 0;
  for (let d = 0; d < ext.min.length; d++) {
    swingSum += ext.max[d] - ext.min[d];
    if (ext.min[d] < minUsable) minUsable = ext.min[d];
  }
  return { cycYr: sim.cyclesEquivalent, meanSwing: swingSum / ext.min.length, minUsable };
}

/** Smallest PV meeting the cut target for a forced battery size (fresh search). */
function minPvFor(s, chem, battKwh, capScale, budget) {
  const evaluate = (pv) => simulateOffset({
    pvKw: pv, battKwhUsable: battKwh, e1kw: s.e1kw, loadWh: s.loadWh, chemistry: chem,
    startSoc: 0.5, tempsC: s.tempsC, capacityScale: capScale,
  });
  const meets = (r) => r.importedWh <= budget + 1e-6;
  if (meets(evaluate(0.05))) return 0.05;
  let lo = 0.05, hi = 45;
  if (!meets(evaluate(hi))) return null; // unsolvable
  while (hi - lo > 0.25) { const mid = (lo + hi) / 2; if (meets(evaluate(mid))) hi = mid; else lo = mid; }
  return +hi.toFixed(2);
}

/**
 * Run the full scenario: engine pick + forced oversize sweep.
 * Returns the pick and per-multiplier { battKwh, pvKw, metrics, cost }.
 */
function scenario(cityName, chem) {
  const s = site(cityName);
  const capScale = capacityScaleFor(chem, s.meanTempC);
  const pick = sizeForBillCut({
    e1kw: s.e1kw, loadWh: s.loadWh, tempsC: s.tempsC, chemistry: chem,
    minFraction: CUT, years: 1,
    costPerWpv: s.costPerWpvMid, costPerKwhBatt: s.battMid(chem), costPerKwInv: s.costPerKwInvMid,
    pvMax: 45, battMax: 120, battStep: 1, capacityScale: capScale, laborPerKwh: s.laborPerKwh,
  });
  if (!pick) throw new Error(`${cityName} ${chem}: cut${CUT * 100} unsolvable`);
  const pickM = metrics(s, chem, pick.pvKw, pick.battKwh, capScale);
  const pickCost = lifetimeFor(s, chem, pick.pvKw, pick.battKwh, pickM.cycYr);
  const budget = s.loadTotal * (1 - CUT);
  const rows = MULTIPLIERS.map((m) => {
    const battKwh = Math.round(pick.battKwh * m * 4) / 4;
    const pvKw = minPvFor(s, chem, battKwh, capScale, budget);
    const mets = metrics(s, chem, pvKw, battKwh, capScale);
    const cost = lifetimeFor(s, chem, pvKw, battKwh, mets.cycYr);
    return { m, battKwh, pvKw, metrics: mets, cost };
  });
  return { s, chem, capScale, pick, pickM, pickCost, rows };
}

console.log(`Swap-strategy test — real engine, offline fixtures, ${HORIZON_YEARS}-yr horizon, ${DAILY_KWH} kWh/day, cut-${CUT * 100}% (grid-tie)\n`);

// ── Honolulu: the strategy's home case ─────────────────────────────────────
const h = {
  lfp: scenario("Honolulu, USA", "lfp"),
  naion: scenario("Honolulu, USA", "naion"),
  agm: scenario("Honolulu, USA", "agm"),
};

console.log("— Honolulu LFP: oversize is swap-free at ~neutral cost —");
{
  const { pick, pickM, pickCost, rows } = h.lfp;
  check(`engine pick is the tight 1-swap bank (batt ${pick.battKwh} kWh, ${pickCost.replacements} swap, life ${(CHEMISTRIES.lfp.cyclesTo80 / pickM.cycYr).toFixed(1)} yr)`,
    Math.abs(pick.battKwh - 5) <= 0.5 && pickCost.replacements === 1 && pickM.cycYr > 550);
  const x2 = rows.find((r) => r.m === 2);
  check(`2x bank halves cycles/yr (~${pickM.cycYr.toFixed(0)} -> ~${x2.metrics.cycYr.toFixed(0)})`,
    x2.metrics.cycYr / pickM.cycYr >= 0.45 && x2.metrics.cycYr / pickM.cycYr <= 0.55);
  check(`2x bank halves mean daily swing (~${(pickM.meanSwing * 100).toFixed(0)}% -> ~${(x2.metrics.meanSwing * 100).toFixed(0)}%)`,
    x2.metrics.meanSwing / pickM.meanSwing >= 0.4 && x2.metrics.meanSwing / pickM.meanSwing <= 0.6);
  check(`2x bank reaches 0 swaps at ~same 20-yr cost ($${pickCost.total} -> $${x2.cost.total})`,
    x2.cost.replacements === 0 && Math.abs(x2.cost.total - pickCost.total) < 100);
}

console.log("\n— Honolulu Sodium-Ion: engine already picks the 0-swap optimum —");
{
  const { pick, pickCost, rows } = h.naion;
  check(`engine pick carries ${pickCost.replacements} swaps ($${pickCost.total}) with a matching note (${pick.oversizeScenario})`,
    pickCost.replacements === 0 && pick.oversizeScenario === "zero_swap_natural");
  for (const m of [1.5, 2, 3]) {
    const row = rows.find((r) => r.m === m);
    check(`${m}x bank (${row.battKwh} kWh, ${row.cost.replacements} swaps) only adds cost ($${row.cost.total} vs pick $${pickCost.total})`,
      row.cost.replacements === 0 && row.cost.total > pickCost.total + 500);
  }
}

console.log("\n— Honolulu AGM: oversize never pays —");
{
  const { pick, pickCost, rows } = h.agm;
  check(`pick is swap-capped (${pickCost.replacements} swaps, life ${(CHEMISTRIES.agm.cyclesTo80 / h.agm.pickM.cycYr).toFixed(1)} yr)`, pickCost.replacements >= 8);
  const x2 = rows.find((r) => r.m === 2), x3 = rows.find((r) => r.m === 3);
  check(`2x still caps at ${x2.cost.replacements} swaps`, x2.cost.replacements >= 7);
  check(`3x costs ~$${x3.cost.total - pickCost.total} more — extra capex never recovers`, x3.cost.total > pickCost.total + 15000);
}

// ── London (cloudy): strategy shape survives, but oversize is not needed ───
const l = {
  lfp: scenario("London, UK", "lfp"),
  naion: scenario("London, UK", "naion"),
};
console.log("\n— London LFP: cloudy → the pick is already 0-swap —");
{
  const { pick, pickCost, rows } = l.lfp;
  check(`pick already has ${pickCost.replacements} swaps (gentle ~${l.lfp.pickM.cycYr.toFixed(0)} cycles/yr)`, pickCost.replacements === 0);
  const x15 = rows.find((r) => r.m === 1.5);
  check(`oversizing only adds cost (+$${x15.cost.total - pickCost.total})`, x15.cost.total > pickCost.total + 500);
}
console.log("\n— London Sodium-Ion: pick already 0-swap, oversize only adds cost —");
{
  const { pick, pickCost, rows } = l.naion;
  check(`pick carries ${pickCost.replacements} swaps ($${pickCost.total})`, pickCost.replacements === 0);
  const x2 = rows.find((r) => r.m === 2);
  check(`2x bank (${x2.battKwh} kWh, ${x2.cost.replacements} swaps) only adds cost ($${x2.cost.total} vs $${pickCost.total})`,
    x2.cost.replacements === 0 && x2.cost.total > pickCost.total + 500);
}

console.log(`\n${fails === 0 ? "ALL SWAP-STRATEGY CHECKS PASSED" : fails + " CHECK(S) FAILED"}`);
process.exitCode = fails === 0 ? 0 : 1;