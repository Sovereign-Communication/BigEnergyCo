// Unification gates: every chart, card, matrix cell, curve point and share
// path must tell the SAME story. Each test below pins one cross-view
// invariant that produced a real bug during the 2026-09 unification audit.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  simulateOffset,
  simulate,
  sizeForBillCut,
  PEAK_HOUR_START,
  PEAK_HOUR_END,
} from "../assets/js/sizing/engine.js";
import { buildFrontier } from "../assets/js/sizing/frontier.js";
import {
  fullRange,
  landedMidBattKwhFor,
  costRange,
} from "../assets/js/sizing/pricing.js";
import {
  cumulativeCostSeries,
  seriesBreakdown,
  trueBreakEvenYear,
  lcoeUsdPerKwh,
  batteryReplacements,
  lifetimeCostUsd,
} from "../assets/js/sizing/money.js";
import {
  rescalePayload,
  scaleRecord,
  sameSiteOptions,
} from "../assets/js/sizing/rescale.js";
import { runSizing, PAYLOAD_CONTRACT } from "../assets/js/sizing/run.js";
import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import {
  OFFLINE_PROFILES,
  PROFILE_YEAR,
} from "../assets/js/sizing/profiles.js";

const honolulu = OFFLINE_PROFILES.find((p) => p.name.includes("Honolulu"));
const fakeWeather = async () => ({
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
const BASE = {
  latitude: 21.31,
  longitude: -157.86,
  tariff: 0.42,
  exportRate: null,
  chemistry: "auto",
  mode: "gridtie",
  customCut: 0.8,
};

// WS1.1: the landed midpoint can never escape its own displayed range.
test("UNIFY: fullRange mid always inside [lo, hi], every landedF x chemistry", () => {
  for (const f of [1.0, 1.05, 1.1, 1.35, 1.6]) {
    for (const chem of ["lfp", "naion", "agm"]) {
      for (const [pv, b] of [
        [5, 0],
        [0, 10],
        [8, 20],
        [0.5, 2],
      ]) {
        const r = fullRange(pv, b, chem, f);
        assert.ok(
          r.objectiveMid >= r.lo && r.objectiveMid <= r.hi,
          `${chem} pv=${pv} batt=${b} f=${f}: mid ${r.objectiveMid} outside [${r.lo}, ${r.hi}]`,
        );
      }
    }
  }
});

// WS1.2/1.3: replacement banks priced at their own chemistry's rate.
test("UNIFY: AGM/Na-ion replacement rates exceed LFP; runSizing honors them", async () => {
  assert.ok(
    landedMidBattKwhFor("agm", 1.1) > landedMidBattKwhFor("lfp", 1.1),
    "AGM usable-kWh costs more than LFP",
  );
  assert.ok(
    landedMidBattKwhFor("naion", 1.1) > landedMidBattKwhFor("lfp", 1.1),
    "Na-ion carries its premium",
  );
  const p = await runSizing(
    { ...BASE, dailyKwh: 12 },
    { fetchWeather: fakeWeather },
  );
  const agm = p.auto.find((a) => a.chemistry === "agm");
  const lfp = p.auto.find((a) => a.chemistry === "lfp");
  assert.ok(agm && lfp && agm.solvable && lfp.solvable);
  // AGM lifetime must reflect AGM-priced swaps, not lithium prices.
  const agmBankRate = landedMidBattKwhFor("agm", 1.1);
  const impliedMin = agm.replacementsHorizon * agm.battKwh * agmBankRate * 0.9;
  assert.ok(
    agm.swapsAndLaborUsd >= impliedMin,
    `AGM swaps $${agm.swapsAndLaborUsd} below AGM-rate floor $${Math.round(impliedMin)}`,
  );
  assert.ok(
    agm.lifetimeCostMid > lfp.lifetimeCostMid,
    "AGM true cost exceeds LFP",
  );
});

// WS1.4: battery-only grid charging is metered — no free energy.
test("UNIFY: battery-only imports cover load PLUS charging losses", () => {
  const n = 24 * 7;
  const e1kw = new Float64Array(n).fill(0);
  const load = new Float64Array(n).fill(500);
  const r = simulateOffset({
    pvKw: 0,
    battKwhUsable: 10,
    e1kw,
    loadWh: load,
    chemistry: "lfp",
  });
  const loadTotal = 500 * n;
  assert.ok(
    r.importedWh >= loadTotal,
    `imported ${r.importedWh} must cover load ${loadTotal} (losses add)`,
  );
  assert.ok(r.battWhAc > 0, "peak shifting still happens");
  assert.ok(
    r.peakLoadWh > 0 && r.peakOffsetFraction > 0,
    "peak metric reported",
  );
});

// WS1.5: first-install labor on both lines; residual slice exact.
test("UNIFY: solar and system lines both start at capex+labor; residual exact", () => {
  const s = cumulativeCostSeries({
    capexMidUsd: 10000,
    annualSavingsUsd: 2000,
    residualAnnualUsd: 500,
    swapsAndLaborTotalUsd: 4840,
    replacements: 2,
    batteryLifeYears: 8,
    firstLaborUsd: 420,
  });
  assert.equal(
    s.solar[0] - 500,
    10000 + 420,
    "solar starts at capex + first labor",
  );
  assert.equal(
    s.system[0],
    10000 + 420,
    "system starts at capex + first labor",
  );
  const bd = seriesBreakdown(s);
  assert.equal(
    bd.residualBills,
    20 * 500,
    "residual slice is exactly the remaining bills",
  );
  assert.equal(
    bd.systemTotal + bd.residualBills,
    bd.withSolar,
    "stack identity holds",
  );
});

// WS1.5b: break-even counts first labor too.
test("UNIFY: trueBreakEvenYear slips when first labor is counted", () => {
  const base = {
    capexMidUsd: 5000,
    annualSavingsUsd: 2500,
    swapsAndLaborTotalUsd: 0,
    replacements: 0,
    batteryLifeYears: 99,
  };
  const noLabor = trueBreakEvenYear(base);
  const withLabor = trueBreakEvenYear({ ...base, firstLaborUsd: 2400 });
  assert.ok(
    withLabor >= noLabor,
    `labor cannot hasten payback (${noLabor} vs ${withLabor})`,
  );
  assert.equal(noLabor, 2, "sanity: 5000/2500 = year 2");
  assert.equal(withLabor, 3, "7400/2500 crosses in year 3");
});

// WS1.6: LCOE is all-in (hardware + first labor + every swap's labor).
test("UNIFY: LCOE includes install labor on first bank and swaps", () => {
  const bare = lcoeUsdPerKwh({
    capexMidUsd: 10000,
    battReplaceCostUsd: 2000,
    replacements: 2,
    annualServedKwh: 5000,
  });
  const full = lcoeUsdPerKwh({
    capexMidUsd: 10000,
    battReplaceCostUsd: 2000,
    replacements: 2,
    annualServedKwh: 5000,
    firstLaborUsd: 420,
    swapsAndLaborTotalUsd: 4840,
  });
  assert.ok(full > bare, "labor-inclusive LCOE exceeds hardware-only");
  assert.equal(full, (10000 + 420 + 4840) / (5000 * 20));
  // Back-compat: old call shape still works.
  assert.equal(bare, (10000 + 4000) / (5000 * 20));
});

// WS4.1/4.2/4.3: rescale preserves rates, scales marker dollars + envelope.
test("UNIFY: rescale never touches unit rates; scales marker + envelope", async () => {
  const p1 = await runSizing(
    { ...BASE, dailyKwh: 20 },
    { fetchWeather: fakeWeather },
  );
  const r = rescalePayload(p1, 2);
  const rec = {
    pvKw: 5,
    battKwh: 10,
    battPerKwhLo: 45,
    battPerKwhHi: 70,
    costLo: 1000,
  };
  const scaled = scaleRecord(rec, 2);
  assert.equal(scaled.battPerKwhLo, 45, "unit $/kWh rate invariant");
  assert.equal(scaled.battPerKwhHi, 70, "unit $/kWh rate invariant");
  assert.equal(scaled.costLo, 2000, "amounts scale");
  if (p1.frontier?.marker) {
    assert.equal(
      r.frontier.marker.capexUsd,
      Math.round(p1.frontier.marker.capexUsd * 2),
      "marker dollars scale with curve",
    );
  }
  if (p1.frontier?.reach && typeof p1.frontier.reach.pvMaxKw === "number") {
    assert.equal(
      r.frontier.reach.pvMaxKw,
      Math.round(p1.frontier.reach.pvMaxKw * 2 * 100) / 100,
      "envelope scales",
    );
  }
});

// WS4.5: site gate respects hardware envelope.
test("UNIFY: sameSiteOptions rejects cross-envelope rescales", () => {
  const a = {
    latitude: 21.31,
    longitude: -157.86,
    mode: "gridtie",
    chemistry: "lfp",
    tariff: 0.42,
    exportRate: null,
    hardwareConfig: "both",
  };
  assert.ok(sameSiteOptions(a, { ...a }), "identical inputs match");
  assert.ok(
    !sameSiteOptions(a, { ...a, hardwareConfig: "battery" }),
    "battery-only envelope differs",
  );
  assert.ok(!sameSiteOptions(a, { ...a, tariff: 0.43 }), "tariff differs");
});

// Battery-only end-to-end: search, cards, curve all speak peak-offset.
test("UNIFY: battery-only search/card/curve agree on the peak metric", async () => {
  const p = await runSizing(
    {
      ...BASE,
      dailyKwh: 15,
      chemistry: "lfp",
      mode: "gridtie",
      hardwareConfig: "battery",
    },
    { fetchWeather: fakeWeather },
  );
  assert.ok(
    p.frontier && p.frontier.points.length >= 2,
    "pure-battery sweep draws a curve",
  );
  for (const pt of p.frontier.points) {
    assert.ok(
      pt.outcomePct >= 0 && pt.outcomePct <= 100,
      `peak outcome in range (got ${pt.outcomePct})`,
    );
    assert.equal(
      pt.battKwh > 0 && pt.pvKw === 0,
      true,
      "pure-battery sweep holds battery-only points",
    );
  }
  const solved = (p.targets || []).filter((t) => t.solvable);
  assert.ok(solved.length > 0, "peak targets solve");
  for (const t of solved) {
    assert.ok(
      t.cutPct >= 0 && t.cutPct <= 100,
      `card cut in range (got ${t.cutPct})`,
    );
  }
});

// P2: battery-only books a real inverter cost.
test("UNIFY: battery-only systems price their inverter (never $0 power electronics)", () => {
  const noInv = fullRange(0, 10, "lfp", 1.1);
  const withInv = fullRange(0, 10, "lfp", 1.1, 2);
  assert.ok(
    withInv.objectiveMid > noInv.objectiveMid,
    "peak-based inverter basis exceeds $0 default",
  );
  assert.ok(
    withInv.lo > noInv.lo && withInv.hi > noInv.hi,
    "range legs move together",
  );
});

// Matrix cells carry full-bill grid lines (residual included), like the cards.
test("UNIFY: grid-tie matrix cells accumulate the FULL bill on the grid line", async () => {
  const p = await runSizing(
    { ...BASE, dailyKwh: 15 },
    { fetchWeather: fakeWeather },
  );
  const cell = p.matrix.cells["lfp:cut80"];
  assert.ok(cell && cell.solvable);
  const expectGrid = Math.round(p.annualGridSpendUsd * 20);
  assert.ok(
    Math.abs(cell.cumCostSeries.grid[19] - expectGrid) <= 20,
    `cell grid line ${cell.cumCostSeries.grid[19]} ≈ 20× spend ${expectGrid}`,
  );
});

// Payload contract current.
test("UNIFY: payload carries contract 12 with load + peak fields", async () => {
  const p = await runSizing(
    { ...BASE, dailyKwh: 10 },
    { fetchWeather: fakeWeather },
  );
  assert.equal(p.contract, PAYLOAD_CONTRACT);
  assert.equal(PAYLOAD_CONTRACT, 12);
  assert.ok(Number.isFinite(p.dailyKwh) && Number.isFinite(p.peakLoadW));
  assert.equal(typeof p.peakIsAverage, "boolean");
});
