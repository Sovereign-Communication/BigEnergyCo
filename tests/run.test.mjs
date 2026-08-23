// UI-contract tests: runSizing() drives everything the renderers read.
// These tests pin that contract across all four run modes using injected
// offline weather, so a field rename can never silently blank a card or
// chart again. Run: node --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { runSizing } from "../assets/js/sizing/run.js";
import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import { OFFLINE_PROFILES, PROFILE_YEAR } from "../assets/js/sizing/profiles.js";

const honolulu = OFFLINE_PROFILES.find((p) => p.name.includes("Honolulu"));
const fakeWeather = async () => ({
  hours: synthesizeFromProfile(honolulu),
  meta: {
    latitude: 21.31, longitude: -157.86,
    startYear: PROFILE_YEAR, endYear: PROFILE_YEAR, years: 1,
    source: "test fixture", offline: false,
  },
});

const MSG = {
  latitude: 21.31, longitude: -157.86, dailyKwh: 10,
  tariff: 0.42, exportRate: null,
};

test("off-grid AUTO: every field the renderer reads exists and is sane", async () => {
  const p = await runSizing({ ...MSG, chemistry: "auto", mode: "offgrid" }, { fetchWeather: fakeWeather });
  assert.equal(p.mode, "offgrid");
  assert.ok(Array.isArray(p.auto) && p.auto.length === 3, "three chemistry cards");
  assert.equal(p.history.kind, "auto");
  assert.equal(p.tiers.length, 0);
  for (const a of p.auto) {
    assert.equal(a.solvable, true);
    for (const k of ["chemLabel", "pvKw", "battKwh", "battNameplateKwh", "usableDod",
      "costLo", "costHi", "replacements25y", "swapsAndLaborUsd", "lifetimeCostMid",
      "lcoeUsdPerKwh", "paybackYearsLo", "paybackYearsHi", "cardNote"]) {
      assert.ok(a[k] !== undefined && a[k] !== null, `auto.${k} present`);
    }
    // chart contract: nameplate bands exist with one entry per day
    assert.ok(a.socNameplatePct && a.socNameplatePct.min.length === 365, `${a.chemistry} chart bands cover 365 days`);
    const top = Math.max(...a.socNameplatePct.max);
    if (a.chemistry === "agm") assert.ok(top <= 55, `AGM band tops ≤55% of nameplate (got ${top})`);
    if (a.chemistry === "lfp") assert.ok(top >= 85, `LFP band tops ≥85% (got ${top})`);
  }
  // AGM's true cost must exceed LFP's — the whole point of auto mode
  const agm = p.auto.find((a) => a.chemistry === "agm");
  const lfp = p.auto.find((a) => a.chemistry === "lfp");
  assert.ok(agm.lifetimeCostMid > lfp.lifetimeCostMid, "lead-acid lifetime > LFP");
  assert.ok(agm.replacements25y > lfp.replacements25y, "lead-acid swaps more banks");
});

test("off-grid SPECIFIC: tier cards + percent history chart bands", async () => {
  const p = await runSizing({ ...MSG, chemistry: "lfp", mode: "offgrid" }, { fetchWeather: fakeWeather });
  assert.equal(p.tiers.length, 3);
  assert.equal(p.auto, null);
  assert.equal(p.history.kind, "offgrid");
  assert.ok(p.history.tiers.length >= 2, "chart bands traced per solvable tier");
  for (const t of p.tiers.filter((x) => x.solvable)) {
    for (const k of ["pvKw", "battKwh", "battNameplateKwh", "costLo", "costHi",
      "unmetHoursPerYear", "longestGapHours", "cyclesPerYear", "minSocPct",
      "servedKwhPerYear", "replacements25y", "lifetimeCostMid", "paybackYearsLo"]) {
      assert.ok(t[k] !== null && t[k] !== undefined, `tier.${k} non-null`);
    }
    assert.ok(Number.isFinite(t.paybackYearsLo) && t.paybackYearsLo > 0, "payback positive");
  }
  for (const b of p.history.tiers) {
    assert.equal(b.dailyMin.length, b.dailyMax.length);
    assert.equal(b.totalDays, 365);
  }
});

test("grid-tie SPECIFIC: target fields incl. export economics + chart", async () => {
  const p = await runSizing({ ...MSG, chemistry: "naion", mode: "gridtie", exportRate: 0.10 }, { fetchWeather: fakeWeather });
  assert.equal(p.mode, "gridtie");
  assert.equal(p.targets.length, 3);
  assert.equal(p.history.kind, "gridtie");
  let sawExportValue = false;
  for (const t of p.targets.filter((x) => x.solvable)) {
    for (const k of ["pvKw", "battKwh", "cutPct", "importedKwhPerYear", "clippedKwhPerYear",
      "billAfterMonthlyUsd", "paybackYearsLo", "exportValueAnnualUsd",
      "replacements25y", "swapsAndLaborUsd", "lifetimeCostMid"]) {
      assert.ok(t[k] !== null && t[k] !== undefined, `target.${k} non-null`);
    }
    assert.ok(t.cutPct >= t.minFraction * 100 - 1, `cut honored (${t.cutPct}% vs ${(t.minFraction * 100).toFixed(0)}%)`);
    if (t.exportValueAnnualUsd > 0) sawExportValue = true;
  }
  assert.ok(sawExportValue, "feed-in credit produces export value on clipped surplus");
});

test("grid-tie AUTO: nameplate bands present for every solvable chemistry", async () => {
  const p = await runSizing({ ...MSG, chemistry: "auto", mode: "gridtie" }, { fetchWeather: fakeWeather });
  assert.equal(p.history.kind, "auto");
  assert.ok(p.auto.length >= 2, "at least sodium+LFP solvable");
  for (const a of p.auto) {
    assert.ok(a.socNameplatePct && a.socNameplatePct.min.length === 365, `${a.chemistry} bands`);
    assert.ok(Number.isFinite(a.billAfterMonthlyUsd), "bill-after present");
  }
});

test("impossible loads degrade gracefully (nulls, no crash)", async () => {
  const p = await runSizing({
    ...MSG, chemistry: "lfp", mode: "offgrid", dailyKwh: 400,
  }, { fetchWeather: fakeWeather });
  assert.equal(p.tiers[0].solvable, false, "tier100 unsolvable at absurd load");
  assert.equal(p.tiers[0].paybackYearsLo, null);
});
