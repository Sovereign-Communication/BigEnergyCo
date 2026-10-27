// Live end-to-end validation against real NASA POWER data.
// NOT part of CI (needs network). Run: node scripts/validate-live.mjs [lat] [lon] [dailyKwh]
import {
  buildE1kw,
  flatProfile,
  expandProfile,
  simulate,
  sizeAllTiers,
} from "../assets/js/sizing/engine.js";
import { fetchHourlySeries } from "../assets/js/sizing/nasa.js";

const lat = parseFloat(process.argv[2] ?? "19.5");
const lon = parseFloat(process.argv[3] ?? "-155.0");
const dailyKwh = parseFloat(process.argv[4] ?? "10");

console.log(
  `Site ${lat},${lon} · load ${dailyKwh} kWh/day · fetching NASA POWER...`,
);
const t0 = Date.now();
const { hours, meta } = await fetchHourlySeries({
  latitude: lat,
  longitude: lon,
  years: 5,
});
console.log(
  `Got ${hours.length} hourly records (${meta.startYear}–${meta.endYear}) in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
);

const t1 = Date.now();
const e1kw = buildE1kw(hours);
const loadWh = expandProfile(flatProfile(dailyKwh), hours.length);
const tempsC = Float64Array.from(hours, (h) => h.tAmb);
const years = meta.years;

const annualYield = [...e1kw].reduce((a, b) => a + b, 0) / 1000 / years;
console.log(`Annual yield: ${annualYield.toFixed(0)} kWh per kW-STC\n`);

for (const chem of ["lfp", "naion"]) {
  console.log(`── ${chem.toUpperCase()} ──`);
  const results = sizeAllTiers({
    e1kw,
    loadWh,
    tempsC,
    chemistry: chem,
    years,
    costPerWpv: 0.35,
    costPerKwhBatt: chem === "lfp" ? 140 : 160,
    battMax: 150,
  });
  for (const { tier, sizing } of results) {
    if (!sizing) {
      console.log(`  ${tier.label}: NO SOLUTION within search bounds`);
      continue;
    }
    const unmetPerYear = sizing.result.unmetHours / years;
    const longestYearsSpan = sizing.result.longestGapHours;
    console.log(
      `  ${tier.label}: ${sizing.pvKw} kW PV + ${sizing.battKwh} kWh usable` +
        ` · unmet ${unmetPerYear.toFixed(0)} h/yr · longest gap ${longestYearsSpan} h` +
        ` · cycles-equiv ${(sizing.result.cyclesEquivalent / years).toFixed(0)}/yr` +
        ` · ~$${Math.round(sizing.cost).toLocaleString()}`,
    );
  }
}
console.log(
  `\nSizing search completed in ${((Date.now() - t1) / 1000).toFixed(1)}s`,
);
