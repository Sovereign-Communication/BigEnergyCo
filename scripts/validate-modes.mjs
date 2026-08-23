// Live end-to-end validation of BOTH sizing modes against real NASA POWER
// data. NOT part of CI (needs network). Run:
//   node scripts/validate-modes.mjs [lat] [lon] [dailyKwh]
import {
  buildE1kw, flatProfile, expandProfile,
  sizeAllTiers, sizeAllBillTargets, CHEMISTRIES,
} from "../assets/js/sizing/engine.js";
import { fetchHourlySeries } from "../assets/js/sizing/nasa.js";
import { fullRange, getScope } from "../assets/js/sizing/pricing.js";
import { annualGridSpendUsd, paybackYears, batteryReplacements, lcoeUsdPerKwh } from "../assets/js/sizing/money.js";

const lat = parseFloat(process.argv[2] ?? "21.31");   // Honolulu default
const lon = parseFloat(process.argv[3] ?? "-157.86");
const dailyKwh = parseFloat(process.argv[4] ?? "10");
const tariff = 0.42;
const chemistry = "lfp";
const chem = CHEMISTRIES[chemistry];

console.log(`Site ${lat},${lon} · ${dailyKwh} kWh/day · $${tariff}/kWh · ${chemistry} · fetching NASA POWER...`);
const t0 = Date.now();
const { hours, meta } = await fetchHourlySeries({ latitude: lat, longitude: lon, years: 5 });
console.log(`${hours.length} hourly records (${meta.startYear}–${meta.endYear}) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const e1kw = buildE1kw(hours);
const loadWh = expandProfile(flatProfile(dailyKwh), hours.length);
const tempsC = Float64Array.from(hours, (h) => h.tAmb);
const yrs = meta.years;
const landed = getScope("landed");
const costPerWpv = (landed.pvPerW[0] + landed.pvPerW[1]) / 2;
const costPerKwhBatt = (landed.battPerKwhUsable[0] + landed.battPerKwhUsable[1]) / 2;
const money = (n) => "$" + Math.round(n).toLocaleString();

let failures = 0;
function check(cond, msg) {
  if (!cond) { console.error("  ✗ FAIL: " + msg); failures++; }
}

// ── Off-grid tiers ──
console.log("\n── OFF-GRID TIERS ──");
for (const { tier, sizing } of sizeAllTiers({ e1kw, loadWh, tempsC, chemistry, years: yrs, costPerWpv, costPerKwhBatt, battMax: 250 })) {
  if (!sizing) { console.log(`  ${tier.id}: no solution`); continue; }
  const cost = fullRange(sizing.pvKw, sizing.battKwh);
  const spend = annualGridSpendUsd(dailyKwh, tariff);
  const pbLo = paybackYears(cost.lo, spend), pbHi = paybackYears(cost.hi, spend);
  console.log(`  ${tier.id}: ${sizing.pvKw} kW + ${sizing.battKwh} kWh · ${money(cost.lo)}–${money(cost.hi)} · payback ${pbLo?.toFixed(2)}–${pbHi?.toFixed(2)} yr`);
  check(sizing.result.unmetHours / yrs <= tier.maxUnmetHoursPerYear + 1e-6, `${tier.id} exceeds unmet budget`);
  check(Number.isFinite(pbLo) && Number.isFinite(pbHi) && pbLo <= pbHi, `${tier.id} payback range sane`);
}

// ── Grid-tie targets ──
console.log("\n── GRID-TIE TARGETS ──");
const gridSpend = annualGridSpendUsd(dailyKwh, tariff);
console.log(`  current bill ≈ ${money(gridSpend)}/yr`);
const t1 = Date.now();
for (const { target, sizing } of sizeAllBillTargets({ e1kw, loadWh, tempsC, chemistry, years: yrs, costPerWpv, costPerKwhBatt, pvMax: 45, battMax: 120, battStep: 1 })) {
  if (!sizing) { console.log(`  ${target.id}: not reachable`); continue; }
  const cost = fullRange(sizing.pvKw, sizing.battKwh);
  const importedKwhYr = sizing.result.importedWh / 1000 / yrs;
  const billAfter = importedKwhYr * tariff;
  const savings = Math.max(0, gridSpend - billAfter);
  const cutPct = (1 - sizing.result.importedWh / (dailyKwh * 1000 * hrs24(yrs))) * 100;
  console.log(
    `  ${target.id}: ${sizing.pvKw} kW + ${sizing.battKwh} kWh · ${money(cost.lo)}–${money(cost.hi)}` +
    ` · bill −${cutPct.toFixed(1)}% → ${money(billAfter)}/yr · payback ${(cost.lo / savings).toFixed(2)}–${(cost.hi / savings).toFixed(2)} yr` +
    ` · clipped ${(sizing.result.curtailedWh / 1000 / yrs).toFixed(0)} kWh/yr`
  );
  check(cutPct >= target.minFraction * 100 - 0.5, `${target.id} misses its cut target (${cutPct.toFixed(1)}%)`);
  check(billAfter < gridSpend, `${target.id} must reduce the bill`);
}
console.log(`\nGrid-tie searches took ${((Date.now() - t1) / 1000).toFixed(1)}s`);
if (failures) { console.error(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
console.log("all checks passed");

function hrs24(years) { return years * 365 * 24 / 24; } // days→hours identity, kept for clarity
