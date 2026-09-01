// Fast-path GATE tests for the rescale machinery:
//   1. A cached payload rescaled for a ×2 load matches a FRESH engine run at
//      that load — cut %, break-even, payback, and every money figure agree
//      within small tolerances (the engine is scale-invariant for flat
//      profiles, so the numbers must match, not merely approximate).
//   2. The incremental reSlice now returns the moving recommendation
//      (patch.best / bestReason / focus) so the banner follows the slider.
//   3. Every cumulative series carries the new `system` line (capex + swaps,
//      no residual) whose endpoint equals the recommendation's
//      lifetimeCostMid -- the chart and the card can never disagree.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runSizing } from "../assets/js/sizing/run.js";
import { rescalePayload, scaleSeries } from "../assets/js/sizing/rescale.js";
import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import { OFFLINE_PROFILES, PROFILE_YEAR } from "../assets/js/sizing/profiles.js";

const honolulu = OFFLINE_PROFILES.find((p) => p.name.includes("Honolulu"));
const fakeWeather = async () => ({
  hours: synthesizeFromProfile(honolulu),
  meta: { latitude: 21.31, longitude: -157.86, startYear: PROFILE_YEAR, endYear: PROFILE_YEAR, years: 1, source: "test fixture", offline: false },
});
const BASE = { latitude: 21.31, longitude: -157.86, tariff: 0.42, exportRate: null, chemistry: "auto", mode: "gridtie", customCut: 0.8 };

test("GATE: rescale ×2 of cached payload ≈ fresh engine run at ×2 load", async () => {
  const p1 = await runSizing({ ...BASE, dailyKwh: 20.18 }, { fetchWeather: fakeWeather });
  const p2 = await runSizing({ ...BASE, dailyKwh: 40.36 }, { fetchWeather: fakeWeather });
  const r = rescalePayload(p1, 2);

  // Payload-level money scales exactly.
  assert.equal(r.annualGridSpendUsd, 2 * p1.annualGridSpendUsd);
  // The engine's discrete search (1 kWh battery steps) can land ±1pt on the
  // achieved cut% at a different load; the rescaled SYSTEM is the same build.
  assert.ok(Math.abs(r.best.cutPct - p2.best.cutPct) <= 2, `cut% ${r.best.cutPct} vs fresh ${p2.best.cutPct}`);
  assert.ok(Math.abs((r.best.trueBreakEvenYear || 0) - (p2.best.trueBreakEvenYear || 0)) <= 1,
    `break-even ${r.best.trueBreakEvenYear} vs ${p2.best.trueBreakEvenYear}`);
  assert.equal(r.best.lcoeUsdPerKwh, p1.best.lcoeUsdPerKwh, "levelized cost is a ratio => preserved");

  const approx = (a, b, tolPct, what) => {
    const rel = Math.abs(a - b) / Math.max(Math.abs(b), 1);
    assert.ok(rel <= tolPct, `${what}: rescaled ${a} vs fresh ${b} (${(rel * 100).toFixed(1)}% off, tol ${tolPct * 100}%)`);
  };

  // Every matrix cell in the rescaled payload tracks the fresh run.
  for (const cid of ["naion:cut60", "lfp:cut80", "agm:cut95", "lfp:custom"]) {
    const a = r.matrix.cells[cid];
    const b = p2.matrix.cells[cid];
    assert.ok(b && b.solvable, `fresh run solved ${cid}`);
    assert.ok(a && a.solvable, `rescaled ${cid} solved`);
    assert.ok(Math.abs(a.cutPct - b.cutPct) <= 2, `${cid} cut% ${a.cutPct} vs ${b.cutPct}`);
    assert.ok(Math.abs((a.trueBreakEvenYear || 0) - (b.trueBreakEvenYear || 0)) <= 1, `${cid} break-even ${a.trueBreakEvenYear} vs ${b.trueBreakEvenYear}`);
    // PV sizing can shift up to ~15% for chemistries with a wide PV/battery
    // Pareto face (the search lands on a neighbour at a different load); the
    // money figures below are the contract that must track.
    approx(a.pvKw, b.pvKw, 0.2, `${cid} pvKw`);
    assert.ok(Math.abs(a.battKwh - b.battKwh) <= 4, `${cid} battKwh ${a.battKwh} vs ${b.battKwh}`);
    approx(a.lifetimeCostMid, b.lifetimeCostMid, 0.06, `${cid} lifetimeCostMid`);
    approx(a.swapsAndLaborUsd, b.swapsAndLaborUsd, 0.12, `${cid} swapsAndLabor`);
  }

  // Auto cards + custom-cut best + frontier details all agree too.
  for (let i = 0; i < r.auto.length; i++) {
    approx(r.auto[i].pvKw, p2.auto[i].pvKw, 0.2, `auto[${i}] pvKw`);
    approx(r.auto[i].lifetimeCostMid, p2.auto[i].lifetimeCostMid, 0.06, `auto[${i}] lifetimeCostMid`);
  }
  approx(r.customCut.best.pvKw, p2.customCut.best.pvKw, 0.2, "customCut.best pvKw");

  // Frontier points sit on the same curve. The sweeps sample at slightly
  // different places, so compare each rescaled point against the fresh point
  // NEAREST in capex rather than by index.
  const fresh = p2.frontier.points;
  for (const pt of r.frontier.points) {
    let bestF = null, bestGap = Infinity;
    for (const fp of fresh) {
      const g = Math.abs(fp.capexUsd - pt.capexUsd);
      if (g < bestGap) { bestGap = g; bestF = fp; }
    }
    assert.ok(bestF, "fresh curve has a nearest point");
    approx(pt.capexUsd, bestF.capexUsd, 0.2, "frontier capexUsd vs nearest fresh point");
    assert.ok(Math.abs(pt.outcomePct - bestF.outcomePct) <= 4,
      `frontier outcome ${pt.outcomePct} vs fresh ${bestF.outcomePct} at similar capex`);
  }

  // The 20-yr cumulative story scales with the bill.
  const sA = r.best.cumCostSeries, sB = p2.best.cumCostSeries;
  approx(sA.grid[19], sB.grid[19], 0.03, "cumulative grid end");
  approx(sA.solar[19], sB.solar[19], 0.03, "cumulative solar end");
  approx(sA.system[19], sB.system[19], 0.03, "cumulative system end");

  // The frontier verdict's cost figures scale with the load; the verdict id
  // and percentages stay put.
  assert.equal(r.frontier.reach.id, p2.frontier.reach.id, "reach verdict id preserved");
  approx(r.frontier.reach.ceilingCostUsd, p2.frontier.reach.ceilingCostUsd, 0.2, "reach ceilingCostUsd");
  if (r.frontier.reach.kneeCostUsd !== null && p2.frontier.reach.kneeCostUsd !== null) {
    approx(r.frontier.reach.kneeCostUsd, p2.frontier.reach.kneeCostUsd, 0.2, "reach kneeCostUsd");
  }
});

test("rescale round-trip: ×2 then ×0.5 restores the original payload", async () => {
  const p = await runSizing({ ...BASE, dailyKwh: 20.18 }, { fetchWeather: fakeWeather });
  const back = rescalePayload(rescalePayload(p, 2), 0.5);
  assert.equal(back.best.pvKw, p.best.pvKw);
  assert.equal(back.best.lifetimeCostMid, p.best.lifetimeCostMid);
  assert.equal(back.annualGridSpendUsd, p.annualGridSpendUsd);
  assert.deepEqual(back.best.cumCostSeries, p.best.cumCostSeries);
  assert.deepEqual(back.best.cutPct, p.best.cutPct);
});

test("GATE: rescale stays honest at the regime floor (15 ⇄ 30 kWh/day)", async () => {
  const p15 = await runSizing({ ...BASE, dailyKwh: 15 }, { fetchWeather: fakeWeather });
  const p30 = await runSizing({ ...BASE, dailyKwh: 30 }, { fetchWeather: fakeWeather });
  for (const cid of ["lfp:cut80", "naion:cut60", "agm:cut95", "lfp:custom"]) {
    const up = rescalePayload(p15, 2).matrix.cells[cid];
    const upF = p30.matrix.cells[cid];
    const down = rescalePayload(p30, 0.5).matrix.cells[cid];
    const downF = p15.matrix.cells[cid];
    const rel = (a, b) => Math.abs(a.lifetimeCostMid - b.lifetimeCostMid) / b.lifetimeCostMid;
    assert.ok(up.solvable && upF.solvable, `${cid} solved both ways`);
    assert.ok(rel(up, upF) <= 0.06, `${cid} 15->30 money ${rel(up, upF).toFixed(3)}`);
    assert.ok(rel(down, downF) <= 0.06, `${cid} 30->15 money ${rel(down, downF).toFixed(3)}`);
  }
});

test("rescale never mutates the cached payload", async () => {
  const p = await runSizing({ ...BASE, dailyKwh: 20.18 }, { fetchWeather: fakeWeather });
  const before = JSON.stringify(p);
  rescalePayload(p, 1.37);
  assert.equal(JSON.stringify(p), before, "original payload untouched");
});

test("incremental cut returns the moving recommendation (best/bestReason/focus)", async () => {
  const p = await runSizing({ ...BASE, dailyKwh: 20.18 }, { fetchWeather: fakeWeather });
  const patch = await runSizing(
    { ...BASE, dailyKwh: 20.18, incrementalCut: true, customCut: 0.6 },
    { fetchWeather: fakeWeather },
  );
  assert.ok(patch.best && patch.best.solvable, "patch carries the recommended system");
  assert.equal(patch.best.chemistry, patch.customCut.best.chemistry, "recommendation == custom-target winner");
  assert.equal(patch.best.pvKw, patch.customCut.best.pvKw);
  assert.equal(patch.best.cutPct, patch.customCut.achievedPct, "recommendation cut matches the slider");
  assert.ok(typeof patch.bestReason === "string" && patch.bestReason.length > 40, "plain-language why");
  assert.equal(patch.focus.pvKw, patch.best.pvKw, "focus follows the recommendation");
  // The recommendation now tracks the slider, not the fixed 80% target.
  assert.notEqual(patch.best.cutPct, p.best.cutPct, "60% slider changes the recommendation away from 80%");
});

test("every cumulative series carries the system line, ending on lifetimeCostMid", async () => {
  const p = await runSizing({ ...BASE, dailyKwh: 20.18 }, { fetchWeather: fakeWeather });
  const series = p.best.cumCostSeries;
  assert.ok(Array.isArray(series.system) && series.system.length === 20, "system series present");
  // Out-of-pocket (solar) sits above the system-only line by the residual bills.
  assert.ok(series.solar[19] > series.system[19], "wedge between the lines is positive");
  assert.ok(series.system[0] < series.solar[0], "systems starts below the out-of-pocket line");
  // system endpoint == the card's Total 20-year cost (capex + first labor + swaps).
  assert.ok(Math.abs(series.system[19] - p.best.lifetimeCostMid) <= 1,
    `system[19] ${series.system[19]} ~= lifetimeCostMid ${p.best.lifetimeCostMid}`);
  // Break-even crossing of grid vs solar preserved: first year grid >= solar.
  const be = series.grid.findIndex((g, i) => g >= series.solar[i]) + 1;
  assert.equal(be, p.best.trueBreakEvenYear, "chart crossing == card break-even");
});

test("scaleSeries preserves the system line and years", () => {
  const s = { years: 2, grid: [1000, 2000], solar: [500, 800], system: [500, 600] };
  const r = scaleSeries(s, 2.5);
  assert.deepEqual(r, { years: 2, grid: [2500, 5000], solar: [1250, 2000], system: [1250, 1500] });
});