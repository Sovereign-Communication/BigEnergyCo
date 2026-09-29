// Gates for the slider workflow's canonical-state contract, pinned against the
// defects observed while driving the real surface:
//
//   1. The drag preview snapped the card to the NEAREST curve entry while the
//      thumb held an arbitrary % — at slider 73% the card claimed "-69%" and
//      the budget thumb sat at the previous system's price, then the confirm
//      jumped every number at once. The preview must project the slider's %
//      onto the curve: the card's bill-cut figure equals the thumb, every
//      figure moves continuously, and exact lattice values show the real
//      entry untouched.
//   2. A run started before the visitor's last slider move landed like fresh
//      truth: it re-seated the budget thumb on its marker and replaced the
//      slider-implied selection with the run's recommendation (with a slow
//      or cold-cache run the stale state persisted). The sliders own the
//      state; a behind-the-thumb reply must be detectable and reconcilable.
//   3. The slider re-slice re-simulated seconds of hourly physics per move.
//      The feasibility-sims memo makes subsequent adjustments cheap — but
//      ONLY because an exact-key hit is the identical computation. These
//      tests pin that no cached result can ever diverge from a cold engine,
//      and that the memo owner (run.js) drops the map the moment the load,
//      derates or series change.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { interpolateCurveTarget } from "../assets/js/sizing/frontier.js";
import { sliderStateDrifted } from "../assets/js/shared/cut-targets.js";
import {
  sizeForBillCut,
  SIM_CACHE_MAX_ENTRIES,
} from "../assets/js/sizing/engine.js";
import { runSizing } from "../assets/js/sizing/run.js";
import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import {
  OFFLINE_PROFILES,
  PROFILE_YEAR,
} from "../assets/js/sizing/profiles.js";

const POINTS = [
  {
    outcomePct: 60,
    capexUsd: 1000,
    capexLoUsd: 900,
    capexHiUsd: 1100,
    pvKw: 3,
    battKwh: 7,
    detail: {
      pvKw: 3,
      battKwh: 7,
      lifetimeCostMid: 2000,
      billAfterMonthlyUsd: 40,
      cutPct: 60,
      chemistry: "lfp",
    },
  },
  {
    outcomePct: 80,
    capexUsd: 3000,
    capexLoUsd: 2800,
    capexHiUsd: 3200,
    pvKw: 4,
    battKwh: 13,
    detail: {
      pvKw: 4,
      battKwh: 13,
      lifetimeCostMid: 5000,
      billAfterMonthlyUsd: 20,
      cutPct: 80,
      chemistry: "lfp",
    },
  },
];

test("preview projection: exact at a lattice point, real entry untouched", () => {
  const r = interpolateCurveTarget(POINTS, 60);
  assert.equal(r.exact, true);
  assert.equal(r.capexUsd, 1000);
  assert.equal(r.pvKw, 3);
  assert.equal(r.battKwh, 7);
  assert.equal(r.entry.lifetimeCostMid, 2000);
  assert.equal(r.entry.cutPct, 60);
});

test("preview projection: between points every figure moves linearly and cutPct tracks the slider", () => {
  const r = interpolateCurveTarget(POINTS, 70);
  assert.equal(r.exact, false);
  assert.equal(r.capexUsd, 2000);
  assert.equal(r.pvKw, 3.5);
  assert.equal(r.battKwh, 10);
  assert.equal(r.entry.lifetimeCostMid, 3500);
  assert.equal(r.entry.billAfterMonthlyUsd, 30);
  // THE contradiction pin: the card never claims a bill-cut figure the
  // slider does not hold.
  assert.equal(r.entry.cutPct, 70);
  assert.equal(r.outcomePct, 70);
});

test("preview projection: continuous along the curve — no snapping jumps", () => {
  let prev = null;
  for (let pct = 60; pct <= 80; pct += 1) {
    const r = interpolateCurveTarget(POINTS, pct);
    assert.equal(r.entry.cutPct, pct, `cutPct follows the slider at ${pct}`);
    if (prev) {
      // Within a linear segment consecutive steps move by a constant delta;
      // across the whole span the move per 1% is bounded by the chord slope,
      // so the preview can never jump the way a nearest-neighbour snap did.
      assert.ok(
        Math.abs(r.capexUsd - prev.capexUsd) <= 100 + 1e-9,
        `capex moved ${r.capexUsd - prev.capexUsd} between ${pct - 1}% and ${pct}%`,
      );
    }
    prev = r;
  }
});

test("preview projection: blended figures carry engine precision, never float noise", () => {
  const noisy = [
    {
      ...POINTS[0],
      outcomePct: 60,
      capexUsd: 1234.567,
      pvKw: 3.88,
      detail: { ...POINTS[0].detail, pvKw: 3.88 },
    },
    {
      ...POINTS[1],
      outcomePct: 80,
      capexUsd: 5678.901,
      pvKw: 6.14,
      detail: { ...POINTS[1].detail, pvKw: 6.14 },
    },
  ];
  const r = interpolateCurveTarget(noisy, 63);
  // Unrounded lerp would give 4.2189999…; cards quote pvKw raw.
  assert.equal(r.pvKw, 4.22);
  assert.equal(r.entry.pvKw, 4.22);
  assert.equal(r.capexUsd, 1901.22);
  for (const v of [r.pvKw, r.entry.pvKw, r.capexUsd, r.entry.lifetimeCostMid]) {
    assert.equal(v, +v.toFixed(2), `${v} must stop at 2 decimals`);
  }
});

test("preview projection: clamps below the floor and above the ceiling", () => {
  const lo = interpolateCurveTarget(POINTS, 10);
  assert.equal(lo.capexUsd, 1000, "below-range clamps to the cheapest system");
  const hi = interpolateCurveTarget(POINTS, 140);
  assert.equal(hi.capexUsd, 3000, "above-range clamps without an anchor");
  assert.equal(hi.entry.cutPct, 140, "the label still tracks the slider");
});

test("preview projection: the surplus anchor extends the walkable top", () => {
  const anchor = {
    outcomePct: 110,
    capexUsd: 6378,
    pvKw: 8.36,
    battKwh: 28,
    detail: { pvKw: 8.36, battKwh: 28, lifetimeCostMid: 7363, cutPct: 110 },
  };
  const mid = interpolateCurveTarget(POINTS, 95, anchor);
  assert.equal(mid.exact, false);
  assert.equal(mid.capexUsd, (3000 + 6378) / 2);
  assert.equal(mid.entry.cutPct, 95);
  const at = interpolateCurveTarget(POINTS, 110, anchor);
  assert.equal(at.capexUsd, 6378);
  assert.equal(at.entry.lifetimeCostMid, 7363);
});

test("preview projection: unsorted points still walk in outcome order", () => {
  const r = interpolateCurveTarget([POINTS[1], POINTS[0]], 70);
  assert.equal(r.capexUsd, 2000);
});

test("preview projection: nothing to project onto returns null", () => {
  assert.equal(interpolateCurveTarget([], 70), null);
  assert.equal(interpolateCurveTarget(null, 70), null);
  assert.equal(interpolateCurveTarget(POINTS, NaN), null);
});

test("slider drift: the sliders own the state a run was posted against", () => {
  assert.equal(
    sliderStateDrifted({ cut: 0.8, budget: 3735 }, { cut: 0.8, budget: 3735 }),
    false,
    "an untouched session is not drift",
  );
  assert.equal(
    sliderStateDrifted({ cut: 0.8, budget: 3735 }, { cut: 1.13, budget: 3735 }),
    true,
    "a cut move while the run is in flight is drift",
  );
  assert.equal(
    sliderStateDrifted({ cut: 0.8, budget: 3735 }, { cut: 0.8, budget: 6370 }),
    true,
    "a budget move while the run is in flight is drift",
  );
  assert.equal(
    sliderStateDrifted({ cut: 0.8, budget: null }, { cut: 0.8, budget: 2000 }),
    true,
    "pinning a previously free budget is drift",
  );
  assert.equal(sliderStateDrifted(null, { cut: 1, budget: 2 }), false);
  assert.equal(sliderStateDrifted({ cut: 1, budget: 2 }, null), false);
});

// ── The memo can never diverge ──────────────────────────────────────────────
// simulateOffset is pure in (pv, batt, chemistry, capacityScale, e1kw,
// loadWh, tempsC); the engine keys the first four and the owner scopes the
// rest. A cached search must be IDENTICAL to a cold one — memoization, never
// approximation (the reverted warm start diverged; this must never).

const honolulu = OFFLINE_PROFILES.find((p) => p.name.includes("Honolulu"));
const seriesOnce = () => ({
  hours: synthesizeFromProfile(honolulu),
  meta: {
    latitude: 21.31,
    longitude: -157.86,
    startYear: PROFILE_YEAR,
    endYear: PROFILE_YEAR,
    years: 1,
    source: "test fixture",
    offline: false,
  },
});
const ENGINE_BASE = {
  e1kw: null,
  loadWh: null,
  tempsC: null,
  chemistry: "lfp",
  years: 1,
  costPerWpv: 0.3,
  costPerKwhBatt: 150,
  costPerKwInv: 0,
  pvMax: 6,
  battMax: 10,
  battStep: 2,
  capacityScale: 1,
  laborPerKwh: [20, 50],
  invMinKw: 0.6,
  tariff: 0.3,
  exportRate: null,
};
function engineOpts(series, minFraction) {
  const hours = series.hours;
  const n = hours.length;
  // Flat 300 Wh/h load over the fixture year, constant temps: small enough to
  // search in milliseconds, real enough to be solvable.
  const loadWh = Float64Array.from({ length: n }, () => 300);
  const tempsC = Float64Array.from({ length: n }, () => 22);
  const e1kw = Float64Array.from(
    { length: n },
    (_, i) => Math.max(0, Math.sin(((i % 24) / 24) * Math.PI)) * 800,
  );
  return {
    ...ENGINE_BASE,
    e1kw,
    loadWh,
    tempsC,
    minFraction,
  };
}

test("GATE: the feasibility-sims memo cannot diverge from a cold engine", () => {
  const series = seriesOnce();
  const cache = new Map();
  for (const f of [0.6, 0.75, 0.4, 1.1, 0.75]) {
    const cached = sizeForBillCut({
      ...engineOpts(series, f),
      simCache: cache,
    });
    const cold = sizeForBillCut(engineOpts(series, f));
    assert.deepEqual(
      cached,
      cold,
      `minFraction ${f}: a memo-backed search must return the cold engine's exact result`,
    );
  }
  assert.ok(cache.size > 0, "the memo must actually hold the shared sims");
  assert.ok(
    cache.size <= SIM_CACHE_MAX_ENTRIES,
    "the memo is bounded by construction",
  );
  // A deterministic repeat probes the same candidates: served entirely from
  // the memo, so the map must not grow.
  const grown = cache.size;
  sizeForBillCut({ ...engineOpts(series, 0.75), simCache: cache });
  assert.equal(cache.size, grown, "an identical repeat adds no new sims");
});

const RUN_BASE = {
  latitude: 21.31,
  longitude: -157.86,
  tariff: 0.42,
  exportRate: null,
  chemistry: "auto",
  mode: "gridtie",
};

test("GATE: slider slices share the run's sims and a load change drops them", async () => {
  const series = seriesOnce();
  const fetchSame = async () => series;

  // Slice at the default load, twice: the second is served from the first
  // one's sims and must be byte-identical (the worker's real topology —
  // SITE_MEMO hands the same series object to every message).
  const slice1 = await runSizing(
    { ...RUN_BASE, dailyKwh: 20, customCut: 0.73, incrementalCut: true },
    { fetchWeather: fetchSame },
  );
  const slice2 = await runSizing(
    { ...RUN_BASE, dailyKwh: 20, customCut: 0.73, incrementalCut: true },
    { fetchWeather: fetchSame },
  );
  assert.deepEqual(slice2, slice1, "a warm repeat slice equals the first");

  // A different target at the same load reuses the same memo generation…
  const slice3 = await runSizing(
    { ...RUN_BASE, dailyKwh: 20, customCut: 0.61, incrementalCut: true },
    { fetchWeather: fetchSame },
  );
  const slice3Cold = await runSizing(
    { ...RUN_BASE, dailyKwh: 20, customCut: 0.61, incrementalCut: true },
    { fetchWeather: seriesOnce },
  );
  assert.deepEqual(
    slice3,
    slice3Cold,
    "a memo-backed slice equals a slice computed with a cold memo",
  );

  // …but the moment the LOAD changes the owner must start a fresh memo: a
  // stale hit from the old load would silently answer the new one.
  const slice4 = await runSizing(
    { ...RUN_BASE, dailyKwh: 33, customCut: 0.73, incrementalCut: true },
    { fetchWeather: fetchSame },
  );
  const slice4Cold = await runSizing(
    { ...RUN_BASE, dailyKwh: 33, customCut: 0.73, incrementalCut: true },
    { fetchWeather: seriesOnce },
  );
  assert.deepEqual(
    slice4,
    slice4Cold,
    "a slice after a load change must equal a cold-memo slice, never a stale one",
  );
});

// ── Wiring pins (the surface defects' code paths) ───────────────────────────
// The pure policy above is only canonical if the UI wires it in the places
// the defects lived: the cut slider's drag preview, the pair's thumb, the
// share hash, and the run reply's drift reconcile.

const ui = fs.readFileSync("assets/js/sizing/ui.js", "utf8");
const run = fs.readFileSync("assets/js/sizing/run.js", "utf8");
const engine = fs.readFileSync("assets/js/sizing/engine.js", "utf8");

test("wiring: the cut drag preview projects the slider's %, never the nearest entry", () => {
  assert.match(
    ui,
    /previewCurvePoint\(previewTargetAt\(parseInt\(slider\.value, 10\) \|\| 1\)\)/,
  );
  assert.match(
    ui,
    /interpolateCurveTarget\(p\.frontier\.points, pct, surplusAnchor\(p\)\)/,
  );
  // The budget thumb rides the same projection (pair coherence).
  assert.match(
    ui,
    /function previewTargetAt\(pct\)[\s\S]*?bs\.value = String\(Math\.min\(max, Math\.max\(min, Math\.round\(proj\.capexUsd\)\)\)\)/,
  );
});

test("wiring: both sliders write the share hash on every input, so the link never lags the thumb", () => {
  const writes =
    ui.match(/updateShareHash\(lastPayload, readInputs\(\)\);/g) || [];
  assert.ok(
    writes.length >= 2,
    "cut and budget input handlers each write the hash",
  );
});

test("wiring: a run reply that landed behind the sliders is reconciled, never left clobbering", () => {
  assert.match(
    ui,
    /const runDrifted = sliderStateDrifted\(lastRunSlider, readSliderState\(\)\);/,
  );
  assert.match(
    ui,
    /renderResults\(ev\.data\.payload\);\s*if \(runDrifted\) reconcileDriftedRun\(\);/,
  );
  assert.match(
    ui,
    /function reconcileDriftedRun\(\)[\s\S]*?followMarkerOnce = false;/,
  );
  // The snapshot is taken where the run is posted, not when it lands.
  assert.match(
    ui,
    /lastRunInput = inp;\s*lastRunSlider = readSliderState\(\);/,
  );
});

test("wiring: the share serializer derives the target id from the slider, never the lagging select mirror", () => {
  assert.match(
    ui,
    /const ag = targetForPct\(Math\.round\(inp\.customCut \* 100\)\);/,
  );
  assert.doesNotMatch(
    ui,
    /const ag = \$\("autoTarget"\)\.value;/,
    "mid-drag the mirror lags one sync behind and once wrote {ag: cut80, cc: 0.73}",
  );
});

test("wiring: the sims memo is scoped to identical inputs and bounded", () => {
  assert.match(run, /function simCacheFor\(series, e1kw, tempsC, loadWh\)/);
  assert.match(
    run,
    /st\.loadWh\.length === loadWh\.length &&\s*st\.loadWh\.every\(\(v, i\) => v === loadWh\[i\]\)/,
  );
  assert.match(
    engine,
    /if \(simCache\.size >= SIM_CACHE_MAX_ENTRIES\) simCache\.clear\(\);/,
  );
  assert.match(
    engine,
    /const key = `\$\{chemistry\}\|\$\{capacityScale\}\|\$\{pv\}\|\$\{batt\}`;/,
  );
});
