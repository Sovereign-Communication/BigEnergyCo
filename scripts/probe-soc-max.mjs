// Does any tier's battery genuinely fail to reach 100%? Full-resolution check.
import { buildE1kw, flatProfile, expandProfile, sizeAllTiers, simulate } from "../assets/js/sizing/engine.js";
import { fetchHourlySeries } from "../assets/js/sizing/nasa.js";

const SCENARIOS = [
  { name: "Honolulu, 10 kWh/day", lat: 21.31, lon: -157.86, kwh: 10 },
  { name: "London, 15 kWh/day", lat: 51.51, lon: -0.13, kwh: 15 },
  { name: "Phoenix, 40 kWh/day", lat: 33.45, lon: -112.07, kwh: 40 },
];

for (const sc of SCENARIOS) {
  const { hours, meta } = await fetchHourlySeries({ latitude: sc.lat, longitude: sc.lon, years: 1 });
  const e1kw = buildE1kw(hours);
  const loadWh = expandProfile(flatProfile(sc.kwh), e1kw.length);
  const tempsC = Float64Array.from(hours, (h) => h.tAmb);
  console.log(`── ${sc.name} ──`);
  const results = sizeAllTiers({ e1kw, loadWh, tempsC, chemistry: "lfp", years: meta.years });
  for (const { tier, sizing } of results) {
    if (!sizing) continue;
    const traced = simulate({
      pvKw: sizing.pvKw, battKwhUsable: sizing.battKwh,
      e1kw, loadWh, chemistry: "lfp", tempsC, capture: true,
    });
    let maxSoc = -Infinity;
    let hrsAbove95 = 0;
    for (const v of traced.socSeries) {
      if (v > maxSoc) maxSoc = v;
      if (v >= 0.95) hrsAbove95++;
    }
    console.log(
      `  ${tier.id}: ${sizing.pvKw}kW/${sizing.battKwh}kWh | true max ${(maxSoc * 100).toFixed(1)}% | hrs ≥95%: ${hrsAbove95} (${((hrsAbove95 / hours.length) * 100).toFixed(1)}% of hours)`
    );
  }
}
