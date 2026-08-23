// Fetch NASA POWER hourly series for a site and cache it as a JSON fixture.
// Usage: node scripts/fetch-power.mjs <lat> <lon> [years] [outfile]
import { writeFileSync } from "node:fs";
import { fetchHourlySeries } from "../assets/js/sizing/nasa.js";

const lat = parseFloat(process.argv[2]);
const lon = parseFloat(process.argv[3]);
const years = parseInt(process.argv[4] ?? "5", 10);
const out = process.argv[5] ?? `tests/fixtures/site_${lat.toFixed(2)}_${lon.toFixed(2)}_${years}y.json`;

if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
  console.error("usage: node scripts/fetch-power.mjs <lat> <lon> [years] [outfile]");
  process.exit(1);
}

console.log(`Fetching ${years}y hourly series for ${lat},${lon} ...`);
const data = await fetchHourlySeries({ latitude: lat, longitude: lon, years });
writeFileSync(out, JSON.stringify(data));
console.log(`Wrote ${data.hours.length} hours -> ${out}`);
