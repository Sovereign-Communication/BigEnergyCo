// Fixed monthly charges (utility connection fees): they can never be cut,
// so they ride along on every bill figure — grid spend, bill-after, and the
// residual the cumulative chart keeps paying — while savings, payback and
// cut % (displaced variable bill only) come out identical with or without
// the fee. Run: node --test tests/fixedcharges.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { runSizing } from "../assets/js/sizing/run.js";
import { rescalePayload } from "../assets/js/sizing/rescale.js";
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
  dailyKwh: 10,
  tariff: 0.42,
  exportRate: null,
  years: 1,
  mode: "gridtie",
  chemistry: "auto",
  hardwareConfig: "both",
  customCut: 0.8,
};

test("FEE: fixed charge rides bills, never savings", async () => {
  const p0 = await runSizing(BASE, { fetchWeather: fakeWeather });
  const p1 = await runSizing(
    { ...BASE, fixedMonthlyUsd: 30 },
    { fetchWeather: fakeWeather },
  );
  assert.equal(p0.fixedMonthlyUsd, null, "absent fee stays null");
  assert.equal(p1.fixedMonthlyUsd, 30);
  // Grid baseline grows by exactly the fee.
  assert.equal(
    p1.annualGridSpendUsd,
    p0.annualGridSpendUsd + 360,
    "annual grid spend adds 12× the fee",
  );
  const b0 = p0.customCut.best;
  const b1 = p1.customCut.best;
  assert.ok(b0 && b1, "both solve");
  // Same system picked: the fee cannot change lifetime-optimal hardware.
  assert.equal(b1.chemistry, b0.chemistry);
  assert.equal(b1.pvKw, b0.pvKw);
  assert.equal(b1.battKwh, b0.battKwh);
  assert.equal(b1.lifetimeCostMid, b0.lifetimeCostMid);
  assert.equal(b1.cutPct, b0.cutPct, "cut measures the variable bill");
  // Monthly bill-after carries exactly one fee.
  assert.equal(b1.billAfterMonthlyUsd, b0.billAfterMonthlyUsd + 30);
  // Savings never saw the fee: identical payback horizons.
  assert.equal(b1.paybackYearsLo, b0.paybackYearsLo);
  assert.equal(b1.paybackYearsHi, b0.paybackYearsHi);
  assert.equal(b1.trueBreakEvenYear, b0.trueBreakEvenYear);
  // Cumulative lines: grid and solar keep paying the fee every year, the
  // system line (hardware alone) is untouched.
  const s0 = b0.cumCostSeries;
  const s1 = b1.cumCostSeries;
  assert.equal(s1.grid[19], s0.grid[19] + 7200);
  assert.equal(s1.solar[19], s0.solar[19] + 7200);
  assert.deepEqual(s1.system, s0.system);
});

test("FEE: rescale rebases around the fee instead of scaling it", async () => {
  const p1 = await runSizing(
    { ...BASE, fixedMonthlyUsd: 30 },
    { fetchWeather: fakeWeather },
  );
  const r = rescalePayload(p1, 2);
  assert.equal(
    r.annualGridSpendUsd,
    Math.round((p1.annualGridSpendUsd - 360) * 2 + 360),
  );
  assert.equal(
    r.best.billAfterMonthlyUsd,
    Math.round((p1.best.billAfterMonthlyUsd - 30) * 2 + 30),
  );
  assert.equal(
    r.best.cumCostSeries.grid[19],
    Math.round((p1.best.cumCostSeries.grid[19] - 7200) * 2 + 7200),
  );
  // Against a fresh engine run at the new load: both honestly meet the
  // 80% target (mixes may differ across flat ridges and adoption regimes,
  // so hardware and money are NOT compared fresh-vs-rescaled here — the
  // exact rebase formulas above are the fee contract).
  const p2 = await runSizing(
    { ...BASE, dailyKwh: 20, fixedMonthlyUsd: 30 },
    { fetchWeather: fakeWeather },
  );
  assert.ok(
    r.best.cutPct >= 79 && p2.best.cutPct >= 79,
    `both meet the 80% target (rescaled ${r.best.cutPct}, fresh ${p2.best.cutPct})`,
  );
});

test("FEE: degenerate fee values behave as no fee", async () => {
  for (const fee of [0, -5, null, undefined, NaN]) {
    const p = await runSizing(
      { ...BASE, fixedMonthlyUsd: fee },
      { fetchWeather: fakeWeather },
    );
    assert.equal(p.fixedMonthlyUsd, null, `fee ${String(fee)} normalizes away`);
  }
});
