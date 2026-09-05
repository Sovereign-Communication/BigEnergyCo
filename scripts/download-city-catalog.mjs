import {
  mkdirSync,
  writeFileSync,
  rmSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const SOURCE_URL = "https://download.geonames.org/export/dump/allCountries.zip";
const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`city catalog HTTP ${response.status}`);
const temp = join(tmpdir(), `beco-cities-${Date.now()}`);
mkdirSync(temp, { recursive: true });
const zipPath = join(temp, "allCountries.zip");
writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()));
execFileSync(
  process.platform === "win32" ? "powershell.exe" : "unzip",
  process.platform === "win32"
    ? [
        "-NoProfile",
        "-Command",
        `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${temp}' -Force`,
      ]
    : ["-o", zipPath, "-d", temp],
);
const rows = readFileSync(join(temp, "allCountries.txt"), "utf8").split(
  /\r?\n/,
);
const populated = new Set([
  "PPL",
  "PPLA",
  "PPLA2",
  "PPLA3",
  "PPLA4",
  "PPLC",
  "PPLG",
  "PPLQ",
  "PPLS",
  "PPLX",
  "STLMT",
]);
const MIN_POPULATION = 10_000;
const byCountry = new Map();
for (const line of rows) {
  const c = line.split("\t");
  const lat = Number(c[4]),
    lon = Number(c[5]);
  const population = Number(c[14] || 0);
  if (
    c.length < 19 ||
    c[6] !== "P" ||
    !populated.has(c[7]) ||
    population < MIN_POPULATION ||
    !c[1] ||
    !c[8] ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  )
    continue;
  const list = byCountry.get(c[8]) || [];
  list.push({
    name: c[1],
    country: c[8],
    r: c[10] || c[8],
    lat,
    lon,
    population,
  });
  byCountry.set(c[8], list);
}
const out = join(ROOT, "assets/js/sizing/city-data");
mkdirSync(out, { recursive: true });
for (const file of readdirSync(out)) rmSync(join(out, file), { force: true });
const index = [];
for (const [code, records] of byCountry) {
  writeFileSync(join(out, `${code}.json`), JSON.stringify(records));
  index.push({ code, count: records.length });
}
writeFileSync(
  join(out, "index.json"),
  JSON.stringify(index.sort((a, b) => a.code.localeCompare(b.code))),
);
rmSync(temp, { recursive: true, force: true });
console.log(
  `Wrote ${index.reduce((sum, item) => sum + item.count, 0)} records across ${index.length} country files.`,
);
