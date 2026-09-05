#!/usr/bin/env node
// Generate the pre-computed heatmap data from city-data + offline profiles.
// Pure math — no NASA API calls, no network.
//
// Usage:  node scripts/generate-heatmap-data.mjs
// Output: assets/data/heatmap-grid.json
//
// For each city in city-data/*.json, look up the nearest offline profile,
// compute annual yield per kWp, look up the regional tariff, and compute
// payback at 4 usage tiers (5, 10, 20, 30 kWh/day).
//
// Accounts for unserved/underserved grid demand where generators and backup
// fuel dictate true energy replacement value (e.g. Nigeria, Lebanon, Pakistan, etc.).

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── Load data sources ──────────────────────────────────────────────────────

// 1. Offline profiles (typical-year hourly GHI + temperature for 66 cities)
const profilesSrc = readFileSync(join(ROOT, "assets/js/sizing/profiles.js"), "utf8");
const profilesMatch = profilesSrc.match(/export const OFFLINE_PROFILES\s*=\s*(\[[\s\S]*?\]);/);
if (!profilesMatch) throw new Error("Could not parse OFFLINE_PROFILES from profiles.js");
const OFFLINE_PROFILES = JSON.parse(profilesMatch[1]);
console.log(`Loaded ${OFFLINE_PROFILES.length} offline profiles`);

// 2. City-data JSON files
const cityDataDir = join(ROOT, "assets/js/sizing/city-data");
const countryFiles = readdirSync(cityDataDir).filter(f => f.endsWith(".json") && f !== "index.json");

let allCities = [];
for (const file of countryFiles) {
  const data = JSON.parse(readFileSync(join(cityDataDir, file), "utf8"));
  allCities = allCities.concat(data);
}
console.log(`Loaded ${allCities.length} cities from ${countryFiles.length} country files`);

// ── Engine constants ───────────────────────────────────────────────────────

const DERATES = { soiling: 0.97, wiring: 0.98, mismatch: 0.99, mppt: 0.98, snow: 1.00 };
const GAMMA_PMAX = -0.0034;
const NOCT = 45;

function arrayEfficiency() {
  return DERATES.soiling * DERATES.wiring * DERATES.mismatch * DERATES.mppt * DERATES.snow;
}

function cellTemp(tAmbC, ghiWm2) {
  return tAmbC + (NOCT - 20) * (ghiWm2 / 800);
}

function tempFactor(tAmbC, ghiWm2) {
  return Math.max(0, 1 + GAMMA_PMAX * (cellTemp(tAmbC, ghiWm2) - 25));
}

function annualYieldKwhPerKwp(profile) {
  const base = arrayEfficiency();
  const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let totalWh = 0;

  for (let m = 0; m < 12; m++) {
    for (let h = 0; h < 24; h++) {
      const ghi = profile.ghi[m][h];
      const tAmb = profile.tAmb[m][h];
      if (ghi <= 0) continue;
      const whPerHour = ghi * base * tempFactor(tAmb, ghi);
      totalWh += whPerHour * DAYS_PER_MONTH[m];
    }
  }

  return Math.round(totalWh / 1000); // kWh/kWp/year
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad, dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function nearestProfile(lat, lon) {
  let best = null, bestDist = Infinity;
  for (const p of OFFLINE_PROFILES) {
    const d = haversineKm(lat, lon, p.lat, p.lon);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best;
}

// ── Tariff & Grid Deficit Profiles ─────────────────────────────────────────

// Grid deficit definitions for countries where the grid is either absent or heavily rationed.
// unservedPct: % of population with zero grid access (100% dependent on generator/off-grid)
// outagePctOnGrid: average outage fraction for connected customers who must burn petrol/diesel
// genCostPerKwh: typical delivered petrol/diesel cost ($/kWh served)
const GRID_DEFICITS = {
  NG: { unservedPct: 0.43, outagePctOnGrid: 0.50, genCostPerKwh: 0.55, note: "43% un-electrified, heavy generator reliance on grid" },
  CD: { unservedPct: 0.81, outagePctOnGrid: 0.45, genCostPerKwh: 0.60, note: "81% unserved" },
  SS: { unservedPct: 0.93, outagePctOnGrid: 0.60, genCostPerKwh: 0.65, note: "93% unserved" },
  TD: { unservedPct: 0.88, outagePctOnGrid: 0.50, genCostPerKwh: 0.60, note: "88% unserved" },
  NE: { unservedPct: 0.81, outagePctOnGrid: 0.50, genCostPerKwh: 0.55, note: "81% unserved" },
  CF: { unservedPct: 0.85, outagePctOnGrid: 0.55, genCostPerKwh: 0.60, note: "85% unserved" },
  MW: { unservedPct: 0.81, outagePctOnGrid: 0.40, genCostPerKwh: 0.55, note: "81% unserved" },
  BF: { unservedPct: 0.79, outagePctOnGrid: 0.40, genCostPerKwh: 0.55, note: "79% unserved" },
  SL: { unservedPct: 0.74, outagePctOnGrid: 0.45, genCostPerKwh: 0.55, note: "74% unserved" },
  LR: { unservedPct: 0.70, outagePctOnGrid: 0.50, genCostPerKwh: 0.60, note: "70% unserved" },
  MG: { unservedPct: 0.65, outagePctOnGrid: 0.40, genCostPerKwh: 0.55, note: "65% unserved" },
  HT: { unservedPct: 0.51, outagePctOnGrid: 0.60, genCostPerKwh: 0.60, note: "51% unserved, intense blackouts" },
  LB: { unservedPct: 0.05, outagePctOnGrid: 0.70, genCostPerKwh: 0.65, note: "Grid collapsed to ~2-4h/day, generator mafia" },
  YE: { unservedPct: 0.35, outagePctOnGrid: 0.75, genCostPerKwh: 0.65, note: "Grid largely non-functional, private diesel networks" },
  PK: { unservedPct: 0.22, outagePctOnGrid: 0.35, genCostPerKwh: 0.45, note: "Load-shedding + unserved rural populations" },
  ZA: { unservedPct: 0.11, outagePctOnGrid: 0.25, genCostPerKwh: 0.45, note: "Eskom load shedding cycles" },
};

const TARIFF_BOXES = [
  { box: [47.0, 55.5, 5.0, 15.5], rate: 0.40, label: "Germany", laborF: 2.2, landedF: 1.10 },
  { box: [49.5, 61.0, -8.5, 2.0], rate: 0.34, label: "UK/Ireland", laborF: 1.9, landedF: 1.10 },
  { box: [36.0, 47.5, 6.0, 19.0], rate: 0.42, label: "Italy", laborF: 1.8, landedF: 1.10 },
  { box: [35.5, 44.0, -10.0, 4.5], rate: 0.26, label: "Spain/Portugal", laborF: 1.5, landedF: 1.10 },
  { box: [41.0, 51.5, -5.5, 10.0], rate: 0.25, label: "France/Belgium/NL", laborF: 2.0, landedF: 1.10 },
  { box: [48.5, 55.0, 13.5, 24.5], rate: 0.20, label: "Poland/Czechia", laborF: 1.2, landedF: 1.10 },
  { box: [55.0, 60.0, 20.0, 28.5], rate: 0.21, label: "Finland/Baltics", laborF: 1.6, landedF: 1.15 },
  { box: [24, 50, -125, -66], rate: 0.17, label: "US mainland", laborF: 1.5, landedF: 1.05 },
  { box: [50.5, 72, -168, -129], rate: 0.24, label: "Alaska", laborF: 1.7, landedF: 1.35 },
  { box: [-56.0, -17.0, -74.0, -34.0], rate: 0.17, label: "Brazil", laborF: 0.9, landedF: 1.60 },
  { box: [-30.0, -17.0, -73.0, -53.0], rate: 0.16, label: "Chile/Uruguay", laborF: 1.0, landedF: 1.35 },
  { box: [0.0, 12.5, -79.0, -71.0], rate: 0.20, label: "Colombia/Venezuela", laborF: 0.8, landedF: 1.40 },
  { box: [-20.5, -0.5, -81.5, -75.0], rate: 0.14, label: "Peru/Ecuador", laborF: 0.7, landedF: 1.30 },
  { box: [14.5, 33.0, -118.0, -86.0], rate: 0.16, label: "Mexico", laborF: 0.9, landedF: 1.20 },
  { box: [4.0, 21.5, 116.0, 127.0], rate: 0.19, label: "Philippines", laborF: 0.6, landedF: 1.25 },
  { box: [-11.5, 6.5, 94.5, 141.5], rate: 0.11, label: "Indonesia/Malaysia/SG", laborF: 0.6, landedF: 1.20 },
  { box: [5.5, 20.5, 97.0, 106.0], rate: 0.13, label: "Thailand/Myanmar", laborF: 0.5, landedF: 1.20 },
  { box: [8.0, 24.0, 102.0, 110.0], rate: 0.08, label: "Vietnam", laborF: 0.5, landedF: 1.15 },
  { box: [6.0, 36.0, 68.0, 98.0], rate: 0.08, label: "South Asia", laborF: 0.4, landedF: 1.25 },
  { box: [30.5, 46.5, 128.5, 146.5], rate: 0.20, label: "Japan/S.Korea", laborF: 1.7, landedF: 1.05 },
  { box: [-50.0, -9.5, 111.0, 180.0], rate: 0.29, label: "Australia/NZ", laborF: 1.7, landedF: 1.20 },
  { box: [20.0, 32.5, 34.0, 60.0], rate: 0.09, label: "Saudi/UAE/Qatar", laborF: 1.0, landedF: 1.10 },
  { box: [35.5, 42.5, 25.5, 45.0], rate: 0.11, label: "Turkey", laborF: 0.7, landedF: 1.30 },
  { box: [29.5, 32.0, 34.0, 36.0], rate: 0.16, label: "Israel/Jordan", laborF: 1.2, landedF: 1.25 },
  { box: [20.5, 32.5, -18.0, -1.0], rate: 0.14, label: "Morocco/Algeria", laborF: 0.6, landedF: 1.30 },
  { box: [21.5, 32.0, 24.0, 37.0], rate: 0.05, label: "Egypt/Libya", laborF: 0.4, landedF: 1.30 },
  { box: [4.5, 12.5, -4.5, 2.5], rate: 0.14, label: "Ghana/W.Africa", laborF: 0.5, landedF: 1.35 },
  { box: [3.0, 14.5, 2.5, 15.5], rate: 0.07, label: "Nigeria/Niger", laborF: 0.4, landedF: 1.35 },
  { box: [-5.5, 5.5, 33.0, 42.0], rate: 0.19, label: "Kenya/E.Africa", laborF: 0.5, landedF: 1.35 },
  { box: [-35.5, -17.5, 15.5, 33.5], rate: 0.18, label: "South Africa", laborF: 0.8, landedF: 1.30 },
  { box: [3.5, 12.0, 8.0, 24.0], rate: 0.12, label: "Central Africa", laborF: 0.4, landedF: 1.50 },
  // Regional fallbacks
  { box: [18.5, 28.5, -179, -154], rate: 0.42, label: "Hawaii/Pacific", laborF: 1.8, landedF: 1.40 },
  { box: [59, 72, 24, 46], rate: 0.18, label: "Nordics", laborF: 1.6, landedF: 1.10 },
  { box: [35.5, 72, -11, 41], rate: 0.29, label: "Europe", laborF: 1.8, landedF: 1.10 },
  { box: [42, 71, -141, -52], rate: 0.13, label: "Canada", laborF: 1.5, landedF: 1.10 },
  { box: [7, 25, -93, -58], rate: 0.33, label: "Caribbean/C.Am", laborF: 0.8, landedF: 1.35 },
  { box: [-56, 13, -82, -34], rate: 0.16, label: "South America", laborF: 0.9, landedF: 1.35 },
  { box: [22, 47, 123, 147], rate: 0.21, label: "Japan/Korea", laborF: 1.7, landedF: 1.05 },
  { box: [-48, -9, 110, 180], rate: 0.26, label: "Australia/NZ", laborF: 1.7, landedF: 1.20 },
  { box: [5, 37, 60, 98], rate: 0.08, label: "South Asia", laborF: 0.4, landedF: 1.25 },
  { box: [18, 54, 73, 135], rate: 0.09, label: "China/Mongolia", laborF: 0.7, landedF: 1.00 },
  { box: [-12, 26, 90, 142], rate: 0.12, label: "Southeast Asia", laborF: 0.55, landedF: 1.20 },
  { box: [12, 43, 33, 64], rate: 0.09, label: "Middle East", laborF: 1.0, landedF: 1.10 },
  { box: [-36, 38, -19, 53], rate: 0.16, label: "Africa", laborF: 0.5, landedF: 1.35 },
];

function estimateTariff(lat, lon, countryCode = "") {
  let matched = null;
  for (const t of TARIFF_BOXES) {
    const [latMin, latMax, lonMin, lonMax] = t.box;
    if (lat >= latMin && lat <= latMax && lon >= lonMin && lon <= lonMax) {
      matched = { rate: t.rate, laborF: t.laborF, landedF: t.landedF };
      break;
    }
  }
  if (!matched) {
    matched = { rate: 0.28, laborF: 1, landedF: 1.1 };
  }

  // Calculate blended real-world tariff considering unserved demand & generator replacement cost
  const c = countryCode.toUpperCase();
  const deficit = GRID_DEFICITS[c];
  if (deficit) {
    const onGridRate = matched.rate;
    const genRate = deficit.genCostPerKwh;
    // On-grid users spend a blend of grid rate and generator backup rate:
    const onGridEffective = (1 - deficit.outagePctOnGrid) * onGridRate + (deficit.outagePctOnGrid * genRate);
    // National blended energy displacement cost:
    const realEffectiveRate = (deficit.unservedPct * genRate) + ((1 - deficit.unservedPct) * onGridEffective);
    matched.realRate = Math.round(realEffectiveRate * 100) / 100;
    matched.deficit = deficit;
  } else {
    matched.realRate = matched.rate;
    matched.deficit = null;
  }

  return matched;
}

// ── Cost model ─────────────────────────────────────────────────────────────

const LANDED_SCOPE = {
  pvPerW: [0.16, 0.28],
  battPerKwhUsable: [80, 125],
  invPerKw: [90, 260],
};

function systemCostMid(pvKw, battKwhUsable, landedF = 1) {
  const pvMid = pvKw * 1000 * (LANDED_SCOPE.pvPerW[0] + LANDED_SCOPE.pvPerW[1]) / 2 * landedF;
  const battMid = battKwhUsable * (LANDED_SCOPE.battPerKwhUsable[0] + LANDED_SCOPE.battPerKwhUsable[1]) / 2 * landedF;
  const invMid = pvKw * (LANDED_SCOPE.invPerKw[0] + LANDED_SCOPE.invPerKw[1]) / 2 * landedF;
  return Math.round(pvMid + battMid + invMid);
}

const USAGE_TIERS = [5, 10, 20, 30]; // kWh/day

function computePayback(yieldKwhPerKwp, dailyKwh, tariff, landedF) {
  if (yieldKwhPerKwp <= 0 || tariff <= 0) return null;

  const annualKwh = dailyKwh * 365;
  const targetFraction = 0.80;
  const pvKw = Math.max(0.5, (annualKwh * targetFraction) / yieldKwhPerKwp);
  const battKwhUsable = Math.max(1, dailyKwh * 0.3);

  const annualProduced = pvKw * yieldKwhPerKwp;
  const annualOffset = Math.min(annualProduced, annualKwh * targetFraction);
  const annualSavings = annualOffset * tariff;

  const capex = systemCostMid(pvKw, battKwhUsable, landedF);
  if (annualSavings <= 0) return null;
  const years = capex / annualSavings;
  return Math.round(years * 10) / 10;
}

function computeBreakeven(yieldKwhPerKwp, dailyKwh, tariff, landedF) {
  if (yieldKwhPerKwp <= 0 || tariff <= 0) return null;

  const annualKwh = dailyKwh * 365;
  const targetFraction = 0.80;
  const pvKw = Math.max(0.5, (annualKwh * targetFraction) / yieldKwhPerKwp);
  const battKwhUsable = Math.max(1, dailyKwh * 0.3);

  const annualProduced = pvKw * yieldKwhPerKwp;
  const annualOffset = Math.min(annualProduced, annualKwh * targetFraction);
  const annualSavings = annualOffset * tariff;

  const initialCapex = systemCostMid(pvKw, battKwhUsable, landedF);
  const battReplaceCost = battKwhUsable * (LANDED_SCOPE.battPerKwhUsable[0] + LANDED_SCOPE.battPerKwhUsable[1]) / 2 * landedF;
  const totalCost = initialCapex + battReplaceCost;

  if (annualSavings <= 0) return null;
  const years = totalCost / annualSavings;
  return Math.round(years * 10) / 10;
}

function computeLcoe(yieldKwhPerKwp, dailyKwh, landedF) {
  if (yieldKwhPerKwp <= 0) return null;

  const annualKwh = dailyKwh * 365;
  const targetFraction = 0.80;
  const pvKw = Math.max(0.5, (annualKwh * targetFraction) / yieldKwhPerKwp);
  const battKwhUsable = Math.max(1, dailyKwh * 0.3);

  const annualProduced = Math.min(pvKw * yieldKwhPerKwp, annualKwh);
  const initialCapex = systemCostMid(pvKw, battKwhUsable, landedF);
  const battReplaceCost = battKwhUsable * (LANDED_SCOPE.battPerKwhUsable[0] + LANDED_SCOPE.battPerKwhUsable[1]) / 2 * landedF;
  const totalCost = initialCapex + battReplaceCost;

  const totalKwh = annualProduced * 20;
  if (totalKwh <= 0) return null;
  return Math.round((totalCost / totalKwh) * 1000) / 1000;
}

// ── Main generation ────────────────────────────────────────────────────────

console.log("Computing heatmap data with grid-deficit & generator displacement model...");

const profileYields = new Map();
for (const p of OFFLINE_PROFILES) {
  profileYields.set(p, annualYieldKwhPerKwp(p));
}

const seen = new Set();
const dedupedCities = [];
for (const city of allCities) {
  if (!Number.isFinite(city.lat) || !Number.isFinite(city.lon)) continue;
  const key = `${Math.round(city.lat * 20)}|${Math.round(city.lon * 20)}`;
  if (seen.has(key)) continue;
  seen.add(key);
  dedupedCities.push(city);
}
console.log(`After dedup: ${dedupedCities.length} unique grid points`);

const results = [];
for (const city of dedupedCities) {
  const profile = nearestProfile(city.lat, city.lon);
  if (!profile) continue;

  const yieldVal = profileYields.get(profile);
  const tariffData = estimateTariff(city.lat, city.lon, city.country);

  // 1. Paper grid tariff economics
  const paybackGrid = USAGE_TIERS.map(kwh => computePayback(yieldVal, kwh, tariffData.rate, tariffData.landedF));
  const breakevenGrid = USAGE_TIERS.map(kwh => computeBreakeven(yieldVal, kwh, tariffData.rate, tariffData.landedF));

  // 2. Real-world generator / unserved demand blended economics
  const paybackReal = USAGE_TIERS.map(kwh => computePayback(yieldVal, kwh, tariffData.realRate, tariffData.landedF));
  const breakevenReal = USAGE_TIERS.map(kwh => computeBreakeven(yieldVal, kwh, tariffData.realRate, tariffData.landedF));

  const lcoe = computeLcoe(yieldVal, 10, tariffData.landedF);

  const pt = {
    lat: Math.round(city.lat * 100) / 100,
    lon: Math.round(city.lon * 100) / 100,
    n: city.name,
    c: city.country,
    t: tariffData.rate,       // nominal grid tariff
    tr: tariffData.realRate,  // blended real-world tariff
    y: yieldVal,
    p: paybackGrid,           // nominal grid payback
    pr: paybackReal,          // real-world blended payback
    b: breakevenGrid,         // nominal break-even
    br: breakevenReal,        // real-world break-even
    l: lcoe,
  };

  if (tariffData.deficit) {
    pt.unserved = Math.round(tariffData.deficit.unservedPct * 100);
  }

  results.push(pt);
}

// Sort by real-world payback at 10 kWh/day
results.sort((a, b) => (a.pr[1] ?? 999) - (b.pr[1] ?? 999));

// ── Write output ───────────────────────────────────────────────────────────

const outDir = join(ROOT, "assets/data");
mkdirSync(outDir, { recursive: true });

const output = {
  generated: new Date().toISOString(),
  usageTiersKwhDay: USAGE_TIERS,
  metric: "80% bill-cut, LFP battery, landed-DIY costs, generator/grid-deficit aware",
  count: results.length,
  points: results,
};

const outPath = join(outDir, "heatmap-grid.json");
writeFileSync(outPath, JSON.stringify(output));

const sizeKB = Math.round(readFileSync(outPath).length / 1024);
console.log(`\nWrote ${results.length} points to ${outPath} (${sizeKB} KB)`);

// Verification checks
const lagos = results.find(r => r.n === "Lagos" || (r.c === "NG" && r.lat > 6 && r.lat < 7));
const beirut = results.find(r => r.c === "LB");
const honolulu = results.find(r => r.n === "Honolulu");

console.log("\n── Sanity checks ──");
if (lagos) {
  console.log(`Nigeria (${lagos.n}): Grid=$${lagos.t} (payback ${lagos.p[1]}yr)  -->  Real Blend=$${lagos.tr} (payback ${lagos.pr[1]}yr!) [Unserved: ${lagos.unserved}%]`);
}
if (beirut) {
  console.log(`Lebanon (${beirut.n}): Grid=$${beirut.t} (payback ${beirut.p[1]}yr)  -->  Real Blend=$${beirut.tr} (payback ${beirut.pr[1]}yr!)`);
}
if (honolulu) {
  console.log(`Honolulu: Grid=$${honolulu.t}, Payback=${honolulu.pr[1]}yr`);
}
