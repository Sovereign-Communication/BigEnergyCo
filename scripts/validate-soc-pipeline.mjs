// End-to-end validation of the SOC-history pipeline (mirrors sizing-worker.js).
import { buildE1kw, flatProfile, expandProfile, sizeAllTiers, simulate, downsampleEnvelope } from "../assets/js/sizing/engine.js";
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
  const env = downsampleEnvelope(traced.socSeries, 1500);
  const loMin = Math.min(...env.map((p) => p.lo)) * 100;
  const hiMax = Math.max(...env.map((p) => p.hi)) * 100;
  const okLen = env.length === 1500 && traced.socSeries.length === hours.length;
  const okBounds = env.every((p) => p.lo <= p.hi + 1e-9 && p.lo >= -0.001 && p.hi <= 1.001);
  // envelope must agree with the simulator's own minSoc
  const okMin = Math.abs(loMin - traced.minSoc * 100) < 0.35;
  console.log(`${okLen && okBounds && okMin ? "OK " : "FAIL"} ${tier.id}: ${sizing.pvKw}kW/${sizing.battKwh}kWh | soc ${loMin.toFixed(1)}–${hiMax.toFixed(1)}% | minSoc match:${okMin}`);
  if (!(okLen && okBounds && okMin)) fail++;
}
console.log(fail === 0 ? "PIPELINE OK" : `${fail} FAILURES`);
process.exit(fail ? 1 : 0);
