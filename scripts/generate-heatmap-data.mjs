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

// Single source of truth: yield math, tariffs and costs come from the SAME
// modules the sizing tool runs on. A drift here once put Toronto in the US
// mainland tariff box ($0.17 USD instead of $0.13 CAD) — importing the shared
// estimator makes that class of bug impossible.
import {
  DERATES_DEFAULT,
  GAMMA_PMAX,
  NOCT,
  arrayEfficiency,
  tempFactor,
} from "../assets/js/sizing/engine.js";
import {
  estimateTariff,
  costRange,
  landedMidBattKwhFor,
} from "../assets/js/sizing/pricing.js";
import { batteryReplacements } from "../assets/js/sizing/money.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── Load data sources ──────────────────────────────────────────────────────

// 1. Offline profiles (typical-year hourly GHI + temperature for 66 cities)
const profilesSrc = readFileSync(
  join(ROOT, "assets/js/sizing/profiles.js"),
  "utf8",
);
const profilesMatch = profilesSrc.match(
  /export const OFFLINE_PROFILES\s*=\s*(\[[\s\S]*?\]);/,
);
if (!profilesMatch)
  throw new Error("Could not parse OFFLINE_PROFILES from profiles.js");
const OFFLINE_PROFILES = JSON.parse(profilesMatch[1]);
console.log(`Loaded ${OFFLINE_PROFILES.length} offline profiles`);

// 2. City-data JSON files
const cityDataDir = join(ROOT, "assets/js/sizing/city-data");
const countryFiles = readdirSync(cityDataDir).filter(
  (f) => f.endsWith(".json") && f !== "index.json",
);

let allCities = [];
for (const file of countryFiles) {
  const data = JSON.parse(readFileSync(join(cityDataDir, file), "utf8"));
  allCities = allCities.concat(data);
}
console.log(
  `Loaded ${allCities.length} cities from ${countryFiles.length} country files`,
);

// ── Yield math (shared with the engine) ────────────────────────────────────

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
  const R = 6371,
    toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad,
    dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function nearestProfile(lat, lon) {
  let best = null,
    bestDist = Infinity;
  for (const p of OFFLINE_PROFILES) {
    const d = haversineKm(lat, lon, p.lat, p.lon);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

// ── Tariff & Grid Deficit Profiles ─────────────────────────────────────────

// Grid deficit definitions for countries where the grid is either absent or heavily rationed.
// unservedPct: % of population with zero grid access (100% dependent on generator/off-grid)
// outagePctOnGrid: average outage fraction for connected customers who must burn petrol/diesel
// genCostPerKwh: typical delivered petrol/diesel cost ($/kWh served)
const GRID_DEFICITS = {
  NG: {
    unservedPct: 0.43,
    outagePctOnGrid: 0.5,
    genCostPerKwh: 0.55,
    note: "43% un-electrified, heavy generator reliance on grid",
  },
  CD: {
    unservedPct: 0.81,
    outagePctOnGrid: 0.45,
    genCostPerKwh: 0.6,
    note: "81% unserved",
  },
  SS: {
    unservedPct: 0.93,
    outagePctOnGrid: 0.6,
    genCostPerKwh: 0.65,
    note: "93% unserved",
  },
  TD: {
    unservedPct: 0.88,
    outagePctOnGrid: 0.5,
    genCostPerKwh: 0.6,
    note: "88% unserved",
  },
  NE: {
    unservedPct: 0.81,
    outagePctOnGrid: 0.5,
    genCostPerKwh: 0.55,
    note: "81% unserved",
  },
  CF: {
    unservedPct: 0.85,
    outagePctOnGrid: 0.55,
    genCostPerKwh: 0.6,
    note: "85% unserved",
  },
  MW: {
    unservedPct: 0.81,
    outagePctOnGrid: 0.4,
    genCostPerKwh: 0.55,
    note: "81% unserved",
  },
  BF: {
    unservedPct: 0.79,
    outagePctOnGrid: 0.4,
    genCostPerKwh: 0.55,
    note: "79% unserved",
  },
  SL: {
    unservedPct: 0.74,
    outagePctOnGrid: 0.45,
    genCostPerKwh: 0.55,
    note: "74% unserved",
  },
  LR: {
    unservedPct: 0.7,
    outagePctOnGrid: 0.5,
    genCostPerKwh: 0.6,
    note: "70% unserved",
  },
  MG: {
    unservedPct: 0.65,
    outagePctOnGrid: 0.4,
    genCostPerKwh: 0.55,
    note: "65% unserved",
  },
  HT: {
    unservedPct: 0.51,
    outagePctOnGrid: 0.6,
    genCostPerKwh: 0.6,
    note: "51% unserved, intense blackouts",
  },
  LB: {
    unservedPct: 0.05,
    outagePctOnGrid: 0.7,
    genCostPerKwh: 0.65,
    note: "Grid collapsed to ~2-4h/day, generator mafia",
  },
  YE: {
    unservedPct: 0.35,
    outagePctOnGrid: 0.75,
    genCostPerKwh: 0.65,
    note: "Grid largely non-functional, private diesel networks",
  },
  PK: {
    unservedPct: 0.22,
    outagePctOnGrid: 0.35,
    genCostPerKwh: 0.45,
    note: "Load-shedding + unserved rural populations",
  },
  ZA: {
    unservedPct: 0.11,
    outagePctOnGrid: 0.25,
    genCostPerKwh: 0.45,
    note: "Eskom load shedding cycles",
  },
};

/* TARIFF_BOXES removed: tariffs imported from pricing.js (single source) */

// Tariffs (with US-state refinement, Canada guard, labor/freight factors)
// come from the shared estimator - city rows carry ISO region + country, so
// Toronto resolves to Canada instead of the US mainland box. The generator /
// unserved-demand BLEND on top is heatmap-only by design (the sizing tool
// prices the nominal grid tariff the visitor actually pays).
function estimateTariffBlended(lat, lon, region = "", countryCode = "") {
  const base = estimateTariff(lat, lon, region, countryCode);
  const matched = {
    rate: base.rate,
    laborF: base.laborF ?? 1,
    landedF: base.landedF ?? 1.1,
    label: base.label,
  };

  // Blended real-world tariff: unserved demand & generator replacement cost
  const c = String(countryCode || "").toUpperCase();
  const deficit = GRID_DEFICITS[c];
  if (deficit) {
    const onGridRate = matched.rate;
    const genRate = deficit.genCostPerKwh;
    const onGridEffective =
      (1 - deficit.outagePctOnGrid) * onGridRate +
      deficit.outagePctOnGrid * genRate;
    const realEffectiveRate =
      deficit.unservedPct * genRate +
      (1 - deficit.unservedPct) * onGridEffective;
    matched.realRate = Math.round(realEffectiveRate * 100) / 100;
    matched.deficit = deficit;
  } else {
    matched.realRate = matched.rate;
    matched.deficit = null;
  }

  return matched;
}

// Cost model (shared landed scope) -----------------------------------------

function systemCostMid(pvKw, battKwhUsable, landedF = 1) {
  const r = costRange(pvKw, battKwhUsable, "landed", "lfp");
  return Math.round(
    ((r.lo + r.hi) / 2) *
      (Number.isFinite(landedF) && landedF > 0 ? landedF : 1),
  );
}

const USAGE_TIERS = [5, 10, 20, 30]; // kWh/day

function computePayback(yieldKwhPerKwp, dailyKwh, tariff, landedF) {
  if (yieldKwhPerKwp <= 0 || tariff <= 0) return null;

  const annualKwh = dailyKwh * 365;
  const targetFraction = 0.8;
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
  const targetFraction = 0.8;
  const pvKw = Math.max(0.5, (annualKwh * targetFraction) / yieldKwhPerKwp);
  const battKwhUsable = Math.max(1, dailyKwh * 0.3);

  const annualProduced = pvKw * yieldKwhPerKwp;
  const annualOffset = Math.min(annualProduced, annualKwh * targetFraction);
  const annualSavings = annualOffset * tariff;

  const initialCapex = systemCostMid(pvKw, battKwhUsable, landedF);
  const battReplaceCost = battKwhUsable * landedMidBattKwhFor("lfp", landedF);
  const totalCost = initialCapex + battReplaceCost;

  if (annualSavings <= 0) return null;
  const years = totalCost / annualSavings;
  return Math.round(years * 10) / 10;
}

function computeLcoe(yieldKwhPerKwp, dailyKwh, landedF) {
  if (yieldKwhPerKwp <= 0) return null;

  const annualKwh = dailyKwh * 365;
  const targetFraction = 0.8;
  const pvKw = Math.max(0.5, (annualKwh * targetFraction) / yieldKwhPerKwp);
  const battKwhUsable = Math.max(1, dailyKwh * 0.3);

  const annualProduced = Math.min(pvKw * yieldKwhPerKwp, annualKwh);
  const initialCapex = systemCostMid(pvKw, battKwhUsable, landedF);
  const battReplaceCost = battKwhUsable * landedMidBattKwhFor("lfp", landedF);
  const totalCost = initialCapex + battReplaceCost;

  const totalKwh = annualProduced * 20;
  if (totalKwh <= 0) return null;
  return Math.round((totalCost / totalKwh) * 1000) / 1000;
}

// ── Main generation ────────────────────────────────────────────────────────

console.log(
  "Computing heatmap data with grid-deficit & generator displacement model...",
);

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
  const tariffData = estimateTariffBlended(
    city.lat,
    city.lon,
    city.r,
    city.country,
  );

  // 1. Paper grid tariff economics
  const paybackGrid = USAGE_TIERS.map((kwh) =>
    computePayback(yieldVal, kwh, tariffData.rate, tariffData.landedF),
  );
  const breakevenGrid = USAGE_TIERS.map((kwh) =>
    computeBreakeven(yieldVal, kwh, tariffData.rate, tariffData.landedF),
  );

  // 2. Real-world generator / unserved demand blended economics
  const paybackReal = USAGE_TIERS.map((kwh) =>
    computePayback(yieldVal, kwh, tariffData.realRate, tariffData.landedF),
  );
  const breakevenReal = USAGE_TIERS.map((kwh) =>
    computeBreakeven(yieldVal, kwh, tariffData.realRate, tariffData.landedF),
  );

  const lcoe = computeLcoe(yieldVal, 10, tariffData.landedF);

  const pt = {
    lat: Math.round(city.lat * 100) / 100,
    lon: Math.round(city.lon * 100) / 100,
    n: city.name,
    c: city.country,
    t: tariffData.rate, // nominal grid tariff
    tr: tariffData.realRate, // blended real-world tariff
    y: yieldVal,
    p: paybackGrid, // nominal grid payback
    pr: paybackReal, // real-world blended payback
    b: breakevenGrid, // nominal break-even
    br: breakevenReal, // real-world break-even
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
  metric:
    "ESTIMATE (not a sizing): 80% bill-cut rule-of-thumb, LFP, landed-DIY costs, exactly one bank replacement assumed, generator/grid-deficit aware. Run the calculator for hourly-simulated sizing.",
  count: results.length,
  points: results,
};

const outPath = join(outDir, "heatmap-grid.json");
writeFileSync(outPath, JSON.stringify(output));

const sizeKB = Math.round(readFileSync(outPath).length / 1024);
console.log(`\nWrote ${results.length} points to ${outPath} (${sizeKB} KB)`);

// Verification checks
const lagos = results.find(
  (r) => r.n === "Lagos" || (r.c === "NG" && r.lat > 6 && r.lat < 7),
);
const beirut = results.find((r) => r.c === "LB");
const honolulu = results.find((r) => r.n === "Honolulu");

console.log("\n── Sanity checks ──");
if (lagos) {
  console.log(
    `Nigeria (${lagos.n}): Grid=$${lagos.t} (payback ${lagos.p[1]}yr)  -->  Real Blend=$${lagos.tr} (payback ${lagos.pr[1]}yr!) [Unserved: ${lagos.unserved}%]`,
  );
}
if (beirut) {
  console.log(
    `Lebanon (${beirut.n}): Grid=$${beirut.t} (payback ${beirut.p[1]}yr)  -->  Real Blend=$${beirut.tr} (payback ${beirut.pr[1]}yr!)`,
  );
}
if (honolulu) {
  console.log(`Honolulu: Grid=$${honolulu.t}, Payback=${honolulu.pr[1]}yr`);
}
