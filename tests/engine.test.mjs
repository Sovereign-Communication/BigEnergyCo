// Sizing engine test suite. Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DERATES_DEFAULT, GAMMA_PMAX, CHEMISTRIES,
  cellTemp, tempFactor, arrayEfficiency, buildE1kw,
  flatProfile, shapedProfile, applianceProfile, expandProfile,
  simulate, sizeForTier, sizeAllTiers, RELIABILITY_TIERS,
} from "../assets/js/sizing/engine.js";

const EPS = 1e-6;

// ── Deterministic synthetic weather ─────────────────────────────────────────

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tropical-ish year: strong diurnal cycle, mild seasons, occasional cloudy days. */
function makeWeather(hours = 8760, seed = 42, opts = {}) {
  const rand = mulberry32(seed);
  const out = new Array(hours);
  for (let i = 0; i < hours; i++) {
    const hod = i % 24;
    const doy = Math.floor(i / 24);
    const seasonal = opts.seasonalAmp
      ? 1 + opts.seasonalAmp * Math.sin((doy / 365) * 2 * Math.PI)
      : 1;
    const diurnal = Math.max(0, Math.sin(((hod - 6) / 12) * Math.PI));
    // multi-day cloud systems: slow random walk between clear and overcast
    if (i % 24 === 0 || !out.__cloud) out.__cloud = 0.55 + 0.45 * rand();
    const cloudBase = out.__cloud;
    const dayNoise = 0.75 + 0.25 * rand();
    const ghi = Math.max(0, 950 * seasonal * diurnal * cloudBase * dayNoise);
    const tAmb = (opts.baseTemp ?? 22)
      + (opts.tempAmp ?? 6) * Math.sin((doy / 365) * 2 * Math.PI)
      + 3 * diurnal
      + 4 * (rand() - 0.5);
    out[i] = { ghi, tAmb };
  }
  return out;
}

// ── Derate chain & temperature model ────────────────────────────────────────

test("cellTemp uses NOCT model at 800 W/m² reference", () => {
  assert.equal(cellTemp(25, 0), 25);
  assert.ok(Math.abs(cellTemp(20, 800) - 45) < EPS); // NOCT definition
});

test("tempFactor matches gamma formula independently recomputed", () => {
  const tCell = cellTemp(30, 600);
  const expected = 1 + GAMMA_PMAX * (tCell - 25);
  assert.ok(Math.abs(tempFactor(30, 600) - expected) < EPS);
  assert.ok(tempFactor(30, 600) < 1, "hot cells lose output");
});

test("buildE1kw is linear in array size (the sheet multiplier property)", () => {
  const w = makeWeather(48);
  const e = buildE1kw(w);
  // 4.5 kW array => multiply by 4.5; nothing else changes.
  for (let i = 0; i < e.length; i++) {
    assert.ok(e[i] <= w[i].ghi + EPS, "derates can only reduce output");
  }
  assert.ok(e.some((x) => x > 500), "clear tropical mid-day should exceed 500 Wh/kW");
});

test("buildE1kw handles fill values (-999) as zero", () => {
  const w = [{ ghi: -999, tAmb: NaN }, { ghi: 800, tAmb: 25 }];
  const e = buildE1kw(w);
  assert.equal(e[0], 0);
  assert.ok(e[1] > 0);
});

test("arrayEfficiency multiplies all derates", () => {
  const d = { soiling: 0.5, wiring: 0.5, mismatch: 0.5, mppt: 0.5, snow: 1 };
  assert.ok(Math.abs(arrayEfficiency(d) - 0.0625) < EPS);
});

// ── Load models ─────────────────────────────────────────────────────────────

test("flatProfile totals the daily kWh", () => {
  const p = flatProfile(10);
  const sum = [...p].reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 10000) < EPS);
});

test("shapedProfile rejects bad shapes and honors weights", () => {
  assert.throws(() => shapedProfile(10, [1, 2, 3]));
  const raw = Array(24).fill(0.02);
  for (const h of [17, 18, 19, 20]) raw[h] += 0.05;
  const norm = raw.reduce((a, b) => a + b, 0);
  const weights = raw.map((x) => x / norm);
  const p = shapedProfile(10, weights);
  const total = [...p].reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 10000) < EPS);
  assert.ok(Math.abs(p[19] / total - weights[19]) < EPS, "evening peak carries its weight");
});

test("applianceProfile distributes energy across running hours", () => {
  const p = applianceProfile([{ watts: 120, hoursPerDay: 5, startHour: 18 }]);
  let total = 0; for (const x of p) total += x;
  assert.ok(Math.abs(total - 600) < EPS, "120W x 5h = 600 Wh");
  assert.ok(Math.abs(p[18] - 120) < EPS && Math.abs(p[22] - 120) < EPS);

  const q = applianceProfile([{ watts: 100, hoursPerDay: 2.5, startHour: 10, count: 2 }]);
  let tq = 0; for (const x of q) tq += x;
  assert.ok(Math.abs(tq - 500) < EPS, "count=2 doubles it: 200W x 2.5h");

  const r = applianceProfile([{ watts: 240, hoursPerDay: 2, startHour: 23 }]); // wraps midnight
  assert.ok(r[23] > 0 && r[0] > 0 && r[1] === 0, "wraps past midnight correctly");
});

test("expandProfile repeats daily shape across series", () => {
  const p = flatProfile(24); // 1000 Wh/hour
  const e = expandProfile(p, 48);
  assert.equal(e.length, 48);
  assert.ok(Math.abs(e[47] - 1000) < EPS);
});

// ── Simulator physics ───────────────────────────────────────────────────────

test("energy conservation: served + unmet == load, always", () => {
  const w = makeWeather(24 * 60, 7, { seasonalAmp: 0.35, baseTemp: 12, tempAmp: 14 });
  const e1 = buildE1kw(w);
  const load = expandProfile(flatProfile(12), e1.length);
  const temps = Float64Array.from(w, (x) => x.tAmb);
  for (const chem of ["lfp", "naion", "agm"]) {
    const r = simulate({ pvKw: 3, battKwhUsable: 15, e1kw: e1, loadWh: load, chemistry: chem, tempsC: temps });
    assert.ok(Math.abs((r.servedWh + r.unmetWh) - 12 * 1000 * 60) < 1e-3, `conservation holds for ${chem}`);
  }
});

test("cold LFP blocks charging below 0°C but sodium-ion charges", () => {
  const w = makeWeather(24 * 30, 99, { baseTemp: -15, tempAmp: 4 });
  const e1 = buildE1kw(w);
  const load = expandProfile(flatProfile(4), e1.length);
  const temps = Float64Array.from(w, (x) => x.tAmb);

  const rLfp = simulate({ pvKw: 6, battKwhUsable: 20, e1kw: e1, loadWh: load, chemistry: "lfp", tempsC: temps });
  const rNa = simulate({ pvKw: 6, battKwhUsable: 20, e1kw: e1, loadWh: load, chemistry: "naion", tempsC: temps });
  assert.ok(rLfp.unmetWh > rNa.unmetWh, "frozen LFP serves strictly worse than Na-ion in deep cold");
});

test("zero PV: unmet equals load minus what initial SOC can deliver", () => {
  const n = 48; // exactly two days
  const e1 = new Float64Array(n);
  const load = expandProfile(flatProfile(6), n);
  const cap = 10; // kWh usable
  const r = simulate({ pvKw: 0, battKwhUsable: cap, e1kw: e1, loadWh: load, chemistry: "lfp", startSoc: 1 });
  const eta = Math.sqrt(CHEMISTRIES.lfp.roundTrip);
  const loadTotal = (n / 24) * 6 * 1000;
  const deliverable = cap * 1000 * eta;
  assert.ok(Math.abs(r.unmetWh - (loadTotal - deliverable)) < 1e-6);
  assert.ok(Math.abs(r.servedWh + r.unmetWh - loadTotal) < 1e-6);
  assert.ok(r.minSoc >= -EPS, "SOC floor respected");
});

test("single-hour hand case: exact unmet arithmetic", () => {
  const e1 = new Float64Array([0]);
  const load = new Float64Array([500]);
  const r = simulate({ pvKw: 0, battKwhUsable: 1, e1kw: e1, loadWh: load, chemistry: "lfp", startSoc: 0.4 });
  const eta = Math.sqrt(CHEMISTRIES.lfp.roundTrip);
  const expectedUnmet = 500 - 0.4 * 1000 * eta;
  assert.ok(Math.abs(r.unmetWh - expectedUnmet) < 1e-9);
  assert.equal(r.unmetHours, 1);
});

test("unmet hours behave structurally in a dark-day scenario", () => {
  const hours = [];
  for (let i = 0; i < 48; i++) {
    const hod = i % 24;
    hours.push({ ghi: i < 24 && hod >= 7 && hod <= 17 ? 900 : 0, tAmb: 20 });
  }
  const e1 = buildE1kw(hours);
  const shape = heavyEveningShape();
  const load = expandProfile(shapedProfile(6, shape), 48);

  const big = simulate({ pvKw: 2, battKwhUsable: 5, e1kw: e1, loadWh: load, chemistry: "lfp" });
  const small = simulate({ pvKw: 2, battKwhUsable: 1, e1kw: e1, loadWh: load, chemistry: "lfp" });

  for (const r of [big, small]) {
    assert.ok(r.minSoc >= -EPS);
    assert.ok(r.longestGapHours <= r.unmetHours + EPS);
  }
  assert.ok(small.unmetHours > big.unmetHours, "smaller bank serves strictly worse");
  assert.ok(big.unmetHours > 0, "day-2 blackout cannot be fully covered by a 5 kWh bank here");
});

function heavyEveningShape() {
  const s = Array(24).fill(0.005);
  s[17] = 0.15; s[18] = 0.25; s[19] = 0.25; s[20] = 0.20; s[21] = 0.08;
  const sum = s.reduce((a, b) => a + b, 0);
  return s.map((x) => x / sum);
}

// ── Tier search ─────────────────────────────────────────────────────────────

test("sizeForTier finds a configuration that meets the constraint", () => {
  const w = makeWeather(24 * 180, 123, { seasonalAmp: 0.4, baseTemp: 16, tempAmp: 10 });
  const e1 = buildE1kw(w);
  const load = expandProfile(flatProfile(8), e1.length);
  const temps = Float64Array.from(w, (x) => x.tAmb);
  const best = sizeForTier({
    e1kw: e1, loadWh: load, tempsC: temps, chemistry: "naion",
    maxUnmetHoursPerYear: 87.6, years: 180 / 365,
    pvMax: 12, battMax: 40,
  });
  assert.ok(best, "should find a viable system");
  assert.ok(best.result.unmetHours / (180 / 365) <= 87.6 + 1e-6);
});

test("stricter tiers require no less hardware than looser tiers", () => {
  const w = makeWeather(24 * 150, 555, { seasonalAmp: 0.5, baseTemp: 10, tempAmp: 16 });
  const e1 = buildE1kw(w);
  const load = expandProfile(flatProfile(7), e1.length);
  const temps = Float64Array.from(w, (x) => x.tAmb);
  const common = { e1kw: e1, loadWh: load, tempsC: temps, chemistry: "naion", years: 150 / 365, pvMax: 15, battMax: 50 };
  const t95 = sizeForTier({ ...common, maxUnmetHoursPerYear: 438 });
  const t99 = sizeForTier({ ...common, maxUnmetHoursPerYear: 87.6 });
  const t100 = sizeForTier({ ...common, maxUnmetHoursPerYear: 0 });
  assert.ok(t95 && t99 && t100, "all three tiers solvable on this site");
  const hw = (s) => s.pvKw + s.battKwh / 10; // rough combined scale
  assert.ok(hw(t95) <= hw(t99) + 1e-9, "95% needs less than 99%");
  assert.ok(hw(t99) <= hw(t100) + 1e-9, "99% needs less than 100%");
});

test("sizeAllTiers aligns with RELIABILITY_TIERS and marks impossibility as null", () => {
  const w = makeWeather(24 * 40, 8, {});
  const e1 = buildE1kw(w);
  const load = expandProfile(flatProfile(50), e1.length); // absurd 50 kWh/day
  const results = sizeAllTiers({
    e1kw: e1, loadWh: load, chemistry: "agm",
    years: 40 / 365, pvMax: 2, battMax: 3,
  });
  assert.equal(results.length, RELIABILITY_TIERS.length);
  assert.equal(results[0].tier.id, "tier100");
  assert.equal(results[0].sizing, null, "impossible constraint yields null");
});

// ── Regression guard: the Hawaii sanity bound ───────────────────────────────

test("tropical site annual yield lands in plausible range", () => {
  const w = makeWeather(8760, 2026, { seasonalAmp: 0.06, baseTemp: 24, tempAmp: 3 });
  const e1 = buildE1kw(w);
  const annualKwhPerKw = [...e1].reduce((a, b) => a + b, 0) / 1000;
  // Real-world Hawaii coastal GHI ~1900-2100 kWh/m²/yr; after derates expect ~1500-1850
  assert.ok(annualKwhPerKw > 1450 && annualKwhPerKw < 1900,
    `annual yield per kW was ${annualKwhPerKw.toFixed(0)} kWh`);
});
