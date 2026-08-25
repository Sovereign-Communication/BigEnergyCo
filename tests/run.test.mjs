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
  assert.equal(p.contract, 4, "payload carries current contract version");
  assert.ok(Array.isArray(p.auto) && p.auto.length === 3, "three chemistry cards");
  assert.equal(p.history.kind, "auto");
  assert.equal(p.tiers.length, 0);
  assert.ok(Array.isArray(p.history.pvDaily) && p.history.pvDaily.length === 365,
    "sun strip: one daily-solar entry per day");
  assert.ok(Math.max(...p.history.pvDaily) > 3, "sun strip peak day is sane (>3 kWh/kW)");
  for (const a of p.auto) {
    assert.equal(a.solvable, true);
    for (const k of ["chemLabel", "pvKw", "battKwh", "battNameplateKwh", "usableDod",
      "costLo", "costHi", "replacementsHorizon", "swapsAndLaborUsd", "lifetimeCostMid",
      "lcoeUsdPerKwh", "paybackYearsLo", "paybackYearsHi", "cardNote"]) {
      assert.ok(a[k] !== undefined && a[k] !== null, `auto.${k} present`);
    }
    // chart contract: nameplate bands exist with one entry per day
    assert.ok(a.socNameplatePct && a.socNameplatePct.min.length === 365, `${a.chemistry} chart bands cover 365 days`);
    // break-even contract: a number or explicit null — NEVER undefined
    assert.ok(typeof a.trueBreakEvenYear === "number" || a.trueBreakEvenYear === null,
      `${a.chemistry}.trueBreakEvenYear must be number|null (got ${typeof a.trueBreakEvenYear})`);
    const top = Math.max(...a.socNameplatePct.max);
    if (a.chemistry === "agm") assert.ok(top <= 55, `AGM band tops ≤55% of nameplate (got ${top})`);
    if (a.chemistry === "lfp") assert.ok(top >= 85, `LFP band tops ≥85% (got ${top})`);
  }
  // AGM's true cost must exceed LFP's — the whole point of auto mode
  const agm = p.auto.find((a) => a.chemistry === "agm");
  const lfp = p.auto.find((a) => a.chemistry === "lfp");
  assert.ok(agm.lifetimeCostMid > lfp.lifetimeCostMid, "lead-acid lifetime > LFP");
  assert.ok(agm.replacementsHorizon > lfp.replacementsHorizon, "lead-acid swaps more banks");
  // True break-even: AGM either never breaks even or strictly later than LFP
  assert.ok(agm.trueBreakEvenYear === null || lfp.trueBreakEvenYear === null || agm.trueBreakEvenYear > lfp.trueBreakEvenYear,
    `AGM BE (${agm.trueBreakEvenYear}) vs LFP (${lfp.trueBreakEvenYear})`);
  assert.ok(lfp.trueBreakEvenYear >= Math.round(lfp.paybackYearsLo), "no-swap break-even ≈ first-cost payback");
});

test("off-grid AUTO honors the independence submenu (tier100 → zero unmet)", async () => {
  const p99 = await runSizing({ ...MSG, chemistry: "auto", mode: "offgrid", autoTier: "tier99" }, { fetchWeather: fakeWeather });
  const p100 = await runSizing({ ...MSG, chemistry: "auto", mode: "offgrid", autoTier: "tier100" }, { fetchWeather: fakeWeather });
  assert.ok(p100.auto.every((a) => a.unmetHoursPerYear === 0), "tier100 selection must size for zero unmet hours");
  // tier100 needs no less hardware than tier99, per chemistry
  for (const chem of ["naion", "lfp", "agm"]) {
    const a99 = p99.auto.find((a) => a.chemistry === chem);
    const a100 = p100.auto.find((a) => a.chemistry === chem);
    if (!a99 || !a100) continue;
    assert.ok(a100.pvKw >= a99.pvKw && a100.battKwh >= a99.battKwh, `${chem}: 100% hardware ≥ 99%`);
  }
  assert.ok(!p99.autoNote.includes("100% independence"), "basis note tracks selection");
  assert.ok(p100.autoNote.includes("100% independence"));
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
      "servedKwhPerYear", "replacementsHorizon", "lifetimeCostMid", "paybackYearsLo"]) {
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
      "replacementsHorizon", "swapsAndLaborUsd", "lifetimeCostMid"]) {
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

test("grid-tie AUTO honors the bill-cut submenu (cut60 → ~60%)", async () => {
  const p = await runSizing({ ...MSG, chemistry: "auto", mode: "gridtie", autoTargetId: "cut60" }, { fetchWeather: fakeWeather });
  assert.ok(p.auto.length >= 2);
  for (const a of p.auto) {
    assert.ok(a.cutPct >= 59 && a.cutPct <= 63, `${a.chemistry} cut ${a.cutPct}% should sit at ~60`);
    assert.ok(a.trueBreakEvenYear === null || a.trueBreakEvenYear > 0, "break-even sane");
  }
});

test("impossible loads degrade gracefully (nulls, no crash)", async () => {
  const p = await runSizing({
    ...MSG, chemistry: "lfp", mode: "offgrid", dailyKwh: 400,
  }, { fetchWeather: fakeWeather });
  assert.equal(p.tiers[0].solvable, false, "tier100 unsolvable at absurd load");
  assert.equal(p.tiers[0].paybackYearsLo, null);
});
