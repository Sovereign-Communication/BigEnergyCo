// End-to-end validation of the daily-minimum reliability pipeline
// (mirrors sizing-worker.js). Run: node scripts/validate-soc-pipeline.mjs
import { buildE1kw, flatProfile, expandProfile, sizeAllTiers, simulate, dailyMinimums } from "../assets/js/sizing/engine.js";
import { fetchHourlySeries } from "../assets/js/sizing/nasa.js";

const { hours, meta } = await fetchHourlySeries({ latitude: 21.31, longitude: -157.86, years: 1 });
const e1kw = buildE1kw(hours);
const loadWh = expandProfile(flatProfile(10), e1kw.length);
const tempsC = Float64Array.from(hours, (h) => h.tAmb);

const results = sizeAllTiers({ e1kw, loadWh, tempsC, chemistry: "lfp", years: meta.years });
let fail = 0;
for (const { tier, sizing } of results) {
  if (!sizing) { console.log(`${tier.id}: unsolvable`); continue; }
  const traced = simulate({ pvKw: sizing.pvKw, battKwhUsable: sizing.battKwh, e1kw, loadWh, chemistry: "lfp", tempsC, capture: true });
  const mins = dailyMinimums(traced.socSeries);
  let minPct = 100, emptyDays = 0;
  for (const v of mins) { const p = v * 100; if (p < minPct) minPct = p; if (p < 5) emptyDays++; }
  const okLen = mins.length === Math.ceil(hours.length / 24);
  const okMin = Math.abs(minPct / 100 - traced.minSoc) < 0.01;
  console.log(`${okLen && okMin ? "OK " : "FAIL"} ${tier.id}: ${sizing.pvKw}kW/${sizing.battKwh}kWh | lowest day ${Math.max(0, Math.round(minPct))}% | empty-ish days: ${emptyDays}`);
  if (!(okLen && okMin)) fail++;
}
console.log(fail === 0 ? "PIPELINE OK" : `${fail} FAILURES`);
process.exit(fail ? 1 : 0);
