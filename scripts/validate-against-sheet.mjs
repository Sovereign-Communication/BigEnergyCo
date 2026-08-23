// Validation gate PHASE2_PLAN.md §5.1: replicate the reference Google Sheet.
//
// The sheet translates every hour's solar/cloud conditions into
// "Wh a 1 kW array would produce this hour". Export that column from the
// sheet as a CSV of plain numbers (one Wh value per row, chronological,
// hourly, same years/order as the engine expects) and run:
//
//   node scripts/validate-against-sheet.mjs <sheet-export.csv> <lat> <lon> [years]
//
// PASS if engine annual E1kW totals match the sheet within ±5% per year.
import { readFileSync } from "node:fs";
import { buildE1kw } from "../assets/js/sizing/engine.js";
import { parseHourly } from "../assets/js/sizing/nasa.js";

const csvPath = process.argv[2];
const lat = parseFloat(process.argv[3] ?? "19.5");
const lon = parseFloat(process.argv[4] ?? "-155.0");
const years = parseInt(process.argv[5] ?? "5", 10);

if (!csvPath || !Number.isFinite(lat)) {
  console.error("usage: node scripts/validate-against-sheet.mjs <sheet.csv> <lat> <lon> [years]");
  process.exit(1);
}

const sheetVals = readFileSync(csvPath, "utf8")
  .split(/\r?\n/)
  .map((l) => parseFloat(l.split(",")[0]))
  .filter((v) => Number.isFinite(v));

console.log(`Sheet rows: ${sheetVals.length}`);
if (sheetVals.length % 8760 !== 0 && sheetVals.length % 8784 !== 0) {
  console.error("Warning: row count does not look like whole years of hourly data.");
}

// Pull matching real weather for the same span (last N complete years).
const endYear = new Date().getUTCFullYear() - 1;
const startYear = endYear - years + 1;
const hours = [];
for (let y = startYear; y <= endYear; y += 2) {
  const yEnd = Math.min(y + 1, endYear);
  const res = await fetch(
    `https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=ALLSKY_SFC_SW_DWN,T2M&community=RE&latitude=${lat}&longitude=${lon}&start=${y}0101&end=${yEnd}1231&format=JSON`
  );
  hours.push(...parseHourly(await res.json()));
}
const e1kw = buildE1kw(hours);

if (e1kw.length !== sheetVals.length) {
  console.error(`Length mismatch: engine ${e1kw.length} vs sheet ${sheetVals.length}. Check years.`);
  process.exit(1);
}

let worst = 0;
for (let yIdx = 0; yIdx < years; yIdx++) {
  const slice = (n, len) => [...n].slice(yIdx * len, (yIdx + 1) * len).reduce((a, b) => a + b, 0) / 1000;
  const len = Math.floor(e1kw.length / years);
  const engineKwh = slice(e1kw, len);
  const sheetKwh = sheetVals.slice(yIdx * len, (yIdx + 1) * len).reduce((a, b) => a + b, 0) / 1000;
  const dev = Math.abs(engineKwh - sheetKwh) / Math.max(sheetKwh, 1);
  worst = Math.max(worst, dev);
  const mark = dev <= 0.05 ? "PASS" : "FAIL";
  console.log(`${mark} year ${startYear + yIdx}: engine ${engineKwh.toFixed(0)} kWh vs sheet ${sheetKwh.toFixed(0)} kWh (${(dev * 100).toFixed(1)}% off)`);
}
console.log(worst <= 0.05 ? "\nGATE PASSED (±5%)" : "\nGATE FAILED (>5% deviation)");
process.exit(worst <= 0.05 ? 0 : 1);
