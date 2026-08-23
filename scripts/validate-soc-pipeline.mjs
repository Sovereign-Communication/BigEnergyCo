// End-to-end validation of the full-daily-range pipeline (mirrors worker).
// Hard gate: EVERY tier's top edge must touch ~100% — the percent-SOC promise.
import { buildE1kw, flatProfile, expandProfile, sizeAllTiers, simulate, dailyExtremes } from "../assets/js/sizing/engine.js";
import { fetchHourlySeries } from "../assets/js/sizing/nasa.js";

const SITES = [
  { name: "Honolulu", lat: 21.31, lon: -157.86 },
  { name: "London", lat: 51.51, lon: -0.13 },
];
let fail = 0;

for (const site of SITES) {
  const { hours, meta } = await fetchHourlySeries({ latitude: site.lat, longitude: site.lon, years: 1 });
  const e1kw = buildE1kw(hours);
  const loadWh = expandProfile(flatProfile(10), e1kw.length);
  const tempsC = Float64Array.from(hours, (h) => h.tAmb);
  console.log(`── ${site.name} · 10 kWh/day ──`);

  const results = sizeAllTiers({ e1kw, loadWh, tempsC, chemistry: "lfp", years: meta.years });
  for (const { tier, sizing } of results) {
    if (!sizing) { console.log(`SKIP ${tier.id}`); continue; }
    const traced = simulate({ pvKw: sizing.pvKw, battKwhUsable: sizing.battKwh, e1kw, loadWh, chemistry: "lfp", tempsC, capture: true });
    const ext = dailyExtremes(traced.socSeries);
    let minPct = 100, emptyDays = 0, fullDays = 0;
    for (let d = 0; d < ext.min.length; d++) {
      const lo = ext.min[d] * 100;
      if (lo < minPct) minPct = lo;
      if (lo < 5) emptyDays++;
      if (ext.max[d] >= 0.995) fullDays++;
    }
    const maxOfMax = Math.max(...ext.max) * 100;
    const okTop = maxOfMax >= 99.5; // THE gate: every system visibly reaches full
    if (!okTop) fail++;
    console.log(
      `${okTop ? "OK " : "FAIL"} ${tier.id}: ${sizing.pvKw}kW/${sizing.battKwh}kWh | band tops at ${maxOfMax.toFixed(1)}% | ` +
      `full ${fullDays} days | lowest ${Math.max(0, Math.round(minPct))}% | empty ${emptyDays} days`
    );
  }
}
console.log(fail === 0 ? "\nGATE PASSED — every system reaches 100%" : `\n${fail} GATE FAILURES`);
process.exit(fail ? 1 : 0);
