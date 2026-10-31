// The six use cases: the registry, its metrics, its verdicts, and the three
// engines the three missing cases needed (reserve floor, outage coverage,
// portable runtime). Run: node --test tests/usecases.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import {
  USE_CASES,
  USE_CASE_IDS,
  USE_CASE_LIST,
  isUseCaseId,
  useCase,
  metricIds,
  inputsFor,
  declaredControls,
  deriveLegacy,
  useCaseForLegacy,
  loadsFor,
  sizingTierFor,
  normaliseReservePct,
  normaliseOutageTarget,
  outcomeFor,
} from "../assets/js/sizing/usecases.js";
import {
  buildE1kw,
  flatProfile,
  expandProfile,
  simulate,
  simulateOffset,
  simulateOutage,
  simulatePortable,
  clampReserveFloor,
  CHEMISTRIES,
} from "../assets/js/sizing/engine.js";
import { runSizing } from "../assets/js/sizing/run.js";
import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import {
  OFFLINE_PROFILES,
  PROFILE_YEAR,
} from "../assets/js/sizing/profiles.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const site = OFFLINE_PROFILES.find((p) => p.name.includes("Honolulu"));
const fakeWeather = async () => ({
  hours: synthesizeFromProfile(site),
  meta: {
    latitude: site.lat,
    longitude: site.lon,
    startYear: PROFILE_YEAR,
    endYear: PROFILE_YEAR,
    years: 1,
    source: "test fixture",
    offline: false,
  },
});

const INPUTS = {
  latitude: site.lat,
  longitude: site.lon,
  dailyKwh: 20,
  tariff: 0.42,
  exportRate: 0.1,
  years: 1,
  chemistry: "lfp",
  reservePct: 0.2,
  outageTargetHours: 8,
  essentialKwh: 1.2,
  backupSolarRecharge: true,
  touPeakRate: 0.42 * 1.6,
  touOffPeakRate: 0.42 * 0.55,
  portableDeviceKwh: 2.4,
  portableBankKwh: 3,
  portablePvW: 200,
  portableShorePower: false,
};

// ── the registry ────────────────────────────────────────────────────────────

test("D-16's six use cases are declared exactly once, each with an owner", () => {
  assert.equal(USE_CASE_IDS.length, 6);
  assert.deepEqual(USE_CASE_IDS, [
    "billcut",
    "tou",
    "backup",
    "reserve",
    "offgrid",
    "portable",
  ]);
  for (const id of USE_CASE_IDS) {
    const c = useCase(id);
    assert.ok(c, `${id} has a registry entry`);
    assert.equal(c.id, id, `${id}.id names itself`);
    assert.ok(c.labelKey && c.blurbKey, `${id} has visitor-facing copy`);
    assert.ok(c.legacy, `${id} declares how it reaches the engine enum pair`);
    assert.ok(
      c.metric && c.metric.labelKey,
      `${id} has a metric and its label`,
    );
    assert.equal(typeof c.verdict, "function");
    assert.equal(typeof c.metricOf, "function");
  }
  // Bill cut is primary (D-16), so it must be first: the flow's default and
  // the chooser's first option both read from this order.
  assert.equal(USE_CASE_IDS[0], "billcut");
  assert.equal(USE_CASE_LIST.length, 6);
});

test("every use case reports its OWN outcome metric", () => {
  const ids = metricIds();
  assert.equal(
    new Set(ids).size,
    6,
    `metrics must be distinct: ${ids.join(",")}`,
  );
  // Names are pinned because the facet reads them: a case that quietly
  // renamed its metric would be a case that quietly changed what it answers.
  assert.deepEqual(ids, [
    "bill_cut_pct",
    "tou_peak_offset_pct",
    "outage_coverage_pct",
    "reserve_tradeoff",
    "grid_independence_pct",
    "portable_runtime_coverage_pct",
  ]);
  // None is the parent's metric wearing another name.
  assert.notEqual(
    USE_CASES.tou.metric.id,
    USE_CASES.billcut.metric.id,
    "time-of-use must not report a bill cut",
  );
  assert.notEqual(
    USE_CASES.backup.metric.id,
    USE_CASES.offgrid.metric.id,
    "backup must not report grid independence",
  );
  assert.notEqual(
    USE_CASES.reserve.metric.id,
    USE_CASES.billcut.metric.id,
    "the reserve's metric is the trade-off, not the parent's bill cut",
  );
});

test("every declared input control exists in the shipped page", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  for (const id of declaredControls())
    assert.match(
      html,
      new RegExp(`id="${id}"`),
      `declared control ${id} must exist in index.html`,
    );
  // And every case must be selectable.
  for (const id of USE_CASE_IDS)
    assert.match(
      html,
      new RegExp(`<option value="${id}"`),
      `${id} must be an option in the chooser`,
    );
});

test("the legacy pair is DERIVED from the use case, and hidden from the visitor", () => {
  assert.deepEqual(deriveLegacy("offgrid"), {
    mode: "offgrid",
    hardwareConfig: "both",
  });
  assert.deepEqual(deriveLegacy("tou"), {
    mode: "gridtie",
    hardwareConfig: "battery",
  });
  // Portable has no grid and no array at all (R-UC-06).
  assert.deepEqual(deriveLegacy("portable"), {
    mode: "portable",
    hardwareConfig: null,
  });
  // A bad id must never land on a case that would report the wrong metric.
  assert.deepEqual(deriveLegacy("nonsense"), deriveLegacy("billcut"));
  assert.equal(isUseCaseId("nonsense"), false);

  // The reverse direction exists for v1 share links that carry only the pair.
  assert.equal(useCaseForLegacy({ mode: "offgrid" }), "offgrid");
  assert.equal(
    useCaseForLegacy({ mode: "gridtie", hardwareConfig: "battery" }),
    "tou",
  );
  assert.equal(
    useCaseForLegacy({ mode: "gridtie", hardwareConfig: "both" }),
    "billcut",
  );

  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  // The ROW and the SELECT are checked separately: hiding the row while
  // leaving the control live would still let a keyboard user reach a
  // vocabulary the product has decided not to show.
  for (const [id, tag] of [
    ["systemGoalRow", "div"],
    ["hardwareConfigRow", "div"],
    ["systemGoal", "select"],
    ["hardwareConfig", "select"],
  ]) {
    const m = html.match(new RegExp(`<${tag}[^>]*id="${id}"[^>]*>`));
    assert.ok(m, `${id} is in the markup`);
    assert.match(
      m[0],
      /\bhidden\b|display:\s*none/,
      `${id} must be hidden from the visitor`,
    );
  }
});

test("each use case declares which load it is SIZED on", () => {
  // The defect this clause exists for: backup was first sized for an 80%
  // bill cut, which can legitimately pick a 0 kWh bank, and the outage
  // simulator was then pointed at nothing.
  assert.equal(loadsFor("backup"), "essentials");
  assert.equal(loadsFor("portable"), "devices");
  assert.equal(loadsFor("billcut"), "household");
  assert.equal(loadsFor("offgrid"), "household");
  assert.equal(loadsFor("tou"), "household");
  // Backup is sized at a zero-unmet-hours budget: "keep it running", not
  // "keep it running most of the time".
  assert.equal(sizingTierFor("backup"), "tier100");
  assert.equal(sizingTierFor("billcut"), null);
});

test("every use case can answer 'not-here', and says why", () => {
  for (const id of USE_CASE_IDS) {
    const v = useCase(id).verdict({});
    assert.equal(
      v.status,
      "not-here",
      `${id} must decline an unmeasured run rather than claim success`,
    );
    assert.ok(v.reasonKey, `${id} must name a reason`);
  }
  // The reserve cannot pretend a reserve is free.
  assert.equal(
    useCase("reserve").verdict({ battKwh: 0 }).reasonKey,
    "verdictReserveNoBattery",
  );
  // Time-of-use is the plan's own verdict: a battery alone that cannot pay
  // for itself must say so.
  const tou = useCase("tou").verdict({
    touPeakOffsetPct: 18,
    touSavingUsd20y: 120,
    touBatteryCostUsd20y: 800,
  });
  assert.equal(tou.status, "not-here");
  assert.equal(tou.reasonKey, "verdictTou");
});

test("verdicts only ever report works/partial/not-here", () => {
  const probes = [
    {},
    { billCutPct: 100, targetBillCutPct: 80 },
    { billCutPct: 60 },
    { billCutPct: 10 },
    { touPeakOffsetPct: 30, touSavingUsd20y: 900, touBatteryCostUsd20y: 400 },
    { outageCoveragePct: 100 },
    { outageCoveragePct: 70 },
    { outageCoveragePct: 20 },
    { battKwh: 10, reserveSavingsLostPct: 0.05, reserveCoverHours: 12 },
    { battKwh: 10, reserveSavingsLostPct: 0.8, reserveCoverHours: 12 },
    { gridIndependencePct: 100 },
    { gridIndependencePct: 96 },
    { gridIndependencePct: 80 },
    { portableCoveragePct: 95 },
    { portableCoveragePct: 60 },
    { portableCoveragePct: 5 },
  ];
  for (const id of USE_CASE_IDS)
    for (const p of probes) {
      const v = useCase(id).verdict(p);
      assert.ok(
        ["works", "partial", "not-here"].includes(v.status),
        `${id} returned ${v.status}`,
      );
      assert.equal(typeof v.reasonKey, "string");
    }
});

test("outcomeFor never invents an outcome for an unknown use case", () => {
  assert.equal(outcomeFor("nonsense", { billCutPct: 50 }), null);
  assert.equal(outcomeFor("billcut", null), null);
  const o = outcomeFor("offgrid", {
    gridIndependencePct: 99.5,
    measured: true,
  });
  assert.equal(o.metricId, "grid_independence_pct");
  assert.equal(o.measured, true);
});

test("an unmeasured run reports 'not measured' rather than a verdict", () => {
  // An infeasible run has no system, so printing a number the engine never
  // produced would be the facet's exact failure dressed as a feature.
  const o = outcomeFor("offgrid", { gridIndependencePct: 0, measured: false });
  assert.equal(o.reasonKey, "useCaseNotMeasured");
  assert.equal(o.measured, false);
});

test("normaliseReservePct and normaliseOutageTarget fail closed", () => {
  assert.equal(normaliseReservePct(0.2), 0.2);
  assert.equal(normaliseReservePct(NaN), 0);
  assert.equal(normaliseReservePct(-1), 0);
  assert.equal(normaliseReservePct(undefined), 0);
  // A reserve can never be the whole bank, or "savings" becomes a fiction.
  assert.equal(normaliseReservePct(5), 0.9);
  assert.equal(clampReserveFloor(5), 0.9);
  assert.equal(clampReserveFloor(null), 0);
  assert.equal(normaliseOutageTarget(8), 8);
  assert.equal(normaliseOutageTarget(0), 6);
  assert.equal(normaliseOutageTarget(9999), 168);
});

// ── R-UC-04: the reserve floor ──────────────────────────────────────────────

test("reserveFloor keeps daily cycling above the floor (R-UC-04)", () => {
  const hours = synthesizeFromProfile(site);
  const e1kw = buildE1kw(hours);
  const load = expandProfile(flatProfile(30), e1kw.length);
  const base = { e1kw, loadWh: load, chemistry: "lfp" };

  const free = simulate({ ...base, pvKw: 6, battKwhUsable: 10 });
  const held = simulate({
    ...base,
    pvKw: 6,
    battKwhUsable: 10,
    reserveFloor: 0.2,
  });
  assert.ok(
    free.minSoc < 0.2,
    `the unrestricted run should dig below 20% (it reached ${free.minSoc})`,
  );
  assert.ok(
    held.minSoc >= 0.2 - 1e-9,
    `the reserved run must never go under the floor (it reached ${held.minSoc})`,
  );
  // And the floor must cost something, or the toggle would be free.
  assert.ok(
    held.unmetWh > free.unmetWh,
    "holding a reserve must make the served load worse",
  );
});

test("a zero reserveFloor is bit-identical to not passing one", () => {
  const hours = synthesizeFromProfile(site);
  const e1kw = buildE1kw(hours);
  const load = expandProfile(flatProfile(20), e1kw.length);
  const args = {
    pvKw: 5,
    battKwhUsable: 10,
    e1kw,
    loadWh: load,
    chemistry: "lfp",
  };
  assert.deepEqual(
    simulate(args),
    simulate({ ...args, reserveFloor: 0 }),
    "the default must not change a single existing payload",
  );
  const off = { ...args, battKwhUsable: 5 };
  assert.deepEqual(
    simulateOffset(off),
    simulateOffset({ ...off, reserveFloor: 0 }),
  );
});

// ── R-UC-03: the outage simulator ───────────────────────────────────────────

test("simulateOutage reports a coverage distribution, not one number", () => {
  const hours = synthesizeFromProfile(site);
  const e1kw = buildE1kw(hours);
  const essentials = expandProfile(flatProfile(1.2), e1kw.length);
  const out = simulateOutage({
    battKwhUsable: 2,
    e1kw,
    essentialsWh: essentials,
    chemistry: "lfp",
    targetHours: 8,
  });
  assert.ok(out.starts > 300, "every hour of the year is an outage start");
  assert.ok(out.coveragePct >= 0 && out.coveragePct <= 100);
  assert.ok(out.hoursBackupP10 <= out.hoursBackupP50, "P10 below P50");
  assert.ok(out.hoursBackupP50 <= out.hoursBackupMax);
  // With no SOC series the bank is assumed FULL, and the assumption is named
  // rather than buried: the measured path supplies a series instead.
  assert.equal(out.startState, "assumed-full");
  // 2 kWh usable against 50 W of essentials is 40 hours from full — every
  // 8-hour outage in the record is survived.
  assert.equal(out.coveragePct, 100);
  assert.ok(out.autonomyDays > 0);
});

test("a bigger bank raises backup coverage", () => {
  const hours = synthesizeFromProfile(site);
  const e1kw = buildE1kw(hours);
  const essentials = expandProfile(flatProfile(1.2), e1kw.length);
  const args = { e1kw, essentialsWh: essentials, targetHours: 8 };
  // 0.2 kWh delivers about 190 Wh; 8 h of 50 W essentials is 400 Wh.
  const small = simulateOutage({ ...args, battKwhUsable: 0.2 });
  const big = simulateOutage({ ...args, battKwhUsable: 2 });
  assert.equal(small.coveragePct, 0, "a 0.2 kWh bank cannot cover 8 hours");
  assert.ok(
    big.coveragePct > small.coveragePct,
    `${big.coveragePct}% must beat ${small.coveragePct}%`,
  );
  assert.equal(big.coveragePct, 100);
});

test("an explicit start state is honoured and named", () => {
  const hours = synthesizeFromProfile(site);
  const e1kw = buildE1kw(hours);
  const essentials = expandProfile(flatProfile(1.2), e1kw.length);
  const out = simulateOutage({
    battKwhUsable: 1,
    e1kw,
    essentialsWh: essentials,
    targetHours: 8,
    startSoc: 0.2,
  });
  assert.equal(out.startState, "explicit");
  assert.ok(out.coveragePct < 100, "starting near-empty must cost coverage");
});

test("the measured-SOC start state is used when a series is supplied", () => {
  const hours = synthesizeFromProfile(site);
  const e1kw = buildE1kw(hours);
  const essentials = expandProfile(flatProfile(1.2), e1kw.length);
  const gridUp = simulate({
    pvKw: 6,
    battKwhUsable: 4,
    e1kw,
    loadWh: essentials,
    chemistry: "lfp",
    capture: true,
  });
  assert.ok(gridUp.socSeries, "the grid-up run produced an SOC series");
  const fromFloor = simulateOutage({
    battKwhUsable: 4,
    e1kw,
    essentialsWh: essentials,
    targetHours: 8,
  });
  const fromMeasured = simulateOutage({
    battKwhUsable: 4,
    e1kw,
    essentialsWh: essentials,
    targetHours: 8,
    startSocSeries: gridUp.socSeries,
  });
  assert.equal(fromMeasured.startState, "measured-soc");
  // A bank that charged all afternoon is not sitting at the floor at 19:00,
  // so starting from the real series can only be at least as good.
  assert.ok(
    fromMeasured.coveragePct >= fromFloor.coveragePct,
    `${fromMeasured.coveragePct}% must be >= the floor-started ${fromFloor.coveragePct}%`,
  );
});

test("simulateOutage releases the reserve inside the outage", () => {
  const hours = synthesizeFromProfile(site);
  const e1kw = buildE1kw(hours);
  const essentials = expandProfile(flatProfile(1.2), e1kw.length);
  // An outage that begins with the bank at the reserve floor must be able to
  // spend that floor: the reserve is released exactly when the grid is gone,
  // which is the entire point of holding it.
  const atFloor = simulateOutage({
    battKwhUsable: 3,
    e1kw,
    essentialsWh: essentials,
    targetHours: 8,
    reserveFloor: 0.2,
    startSoc: 0.2,
  });
  const full = simulateOutage({
    battKwhUsable: 3,
    e1kw,
    essentialsWh: essentials,
    targetHours: 8,
    reserveFloor: 0.2,
    startSoc: 1,
  });
  assert.ok(
    full.coveragePct >= atFloor.coveragePct,
    "starting full must be at least as good as starting at the floor",
  );
  // The floor is not held back during the outage: a 3 kWh bank started at 20%
  // covers 20% of 3 kWh for the FIRST hour, and if the floor were still in
  // force it would cover nothing at all.
  assert.ok(
    atFloor.hoursBackupP50 > 0,
    "the reserve must be spendable once the grid is gone",
  );
});

// ── R-UC-06: portable ───────────────────────────────────────────────────────

test("simulatePortable measures days, and shore power changes the answer", () => {
  const hours = synthesizeFromProfile(site);
  const e1kw = buildE1kw(hours);
  const devices = expandProfile(flatProfile(2.4), e1kw.length);
  const solar = simulatePortable({
    battKwhUsable: 3,
    e1kw,
    devicesWh: devices,
    pvKw: 0.2,
    shorePower: false,
    startSoc: 1,
    hoursPerTrip: 24,
  });
  const shore = simulatePortable({
    battKwhUsable: 3,
    e1kw,
    devicesWh: devices,
    pvKw: 0.2,
    shorePower: true,
    startSoc: 1,
    hoursPerTrip: 24,
  });
  assert.equal(solar.trips, 365);
  assert.ok(solar.coveragePct < 50, "a 200 W panel cannot sustain 2.4 kWh/day");
  assert.equal(shore.coveragePct, 100, "mains power every morning changes it");
  assert.ok(shore.autonomyHours > 0);
  assert.ok(
    shore.autonomyHours >= solar.autonomyHours,
    "autonomy is reported either way, from one full charge",
  );
});

test("portable autonomy is not just the trip length handed back", () => {
  const hours = synthesizeFromProfile(site);
  const e1kw = buildE1kw(hours);
  const devices = expandProfile(flatProfile(2.4), e1kw.length);
  const out = simulatePortable({
    battKwhUsable: 3,
    e1kw,
    devicesWh: devices,
    pvKw: 0,
    shorePower: false,
    startSoc: 1,
    hoursPerTrip: 24,
  });
  // 3 kWh usable, 2.4 kWh/day = 100 W: ~29 hours before losses. Reporting
  // exactly 24 would be the trip window echoing back, not autonomy.
  assert.ok(
    out.autonomyHours > 24,
    `autonomy (${out.autonomyHours} h) must exceed the 24 h trip window`,
  );
  assert.ok(out.autonomyHours < 168);
});

// ── the real walk ───────────────────────────────────────────────────────────

test("all six use cases are measured by the real engine, each with its own metric", async () => {
  const seen = new Set();
  for (const id of USE_CASE_IDS) {
    const p = await runSizing(
      { ...INPUTS, useCase: id },
      { fetchWeather: fakeWeather },
    );
    const o = p.useCaseOutcome;
    assert.ok(o, `${id} produced an outcome`);
    assert.equal(o.useCase, id);
    assert.equal(o.metricId, useCase(id).metric.id);
    assert.ok(!seen.has(o.metricId), `${o.metricId} was already reported`);
    seen.add(o.metricId);
    assert.ok(
      ["works", "partial", "not-here"].includes(o.status),
      `${id} returned ${o.status}`,
    );
    assert.ok(o.reasonKey, `${id} must carry a reason`);
    assert.notEqual(
      o.measured,
      false,
      `${id} must be measurable on a solvable site`,
    );
    assert.equal(
      o.measurement.__useCaseContext,
      undefined,
      "the hourly context must not survive on the payload",
    );
  }
  assert.equal(seen.size, 6);
});

test("at least one use case declines on an unremarkable site", async () => {
  // If every case said "works" here, the verdicts would be decoration. This
  // is the clause that keeps them load-bearing.
  const statuses = [];
  for (const id of USE_CASE_IDS) {
    const p = await runSizing(
      { ...INPUTS, useCase: id },
      { fetchWeather: fakeWeather },
    );
    statuses.push([id, p.useCaseOutcome.status]);
  }
  const declined = statuses.filter(([, s]) => s !== "works");
  assert.ok(
    declined.length >= 1,
    `every case claimed success: ${JSON.stringify(statuses)}`,
  );
});

test("the hourly measurement context is non-enumerable and never shipped", async () => {
  // The context holds a year of Float64 samples. It is attached to the payload
  // so the wrapper can measure the use case, and it is attached
  // NON-ENUMERABLE so it cannot survive structuredClone or JSON.stringify even
  // if a future caller forgets to delete it. This is a source-level guard on
  // one line, and it is labelled as that: the behavioural half is the payload
  // assertion below.
  const src = fs.readFileSync(
    path.join(ROOT, "assets/js/sizing/run.js"),
    "utf8",
  );
  // Anchored on attachUseCaseContext, not on the file: run.js defines two more
  // non-enumerable properties (the cache copy and the cache hit), and a bare
  // /enumerable: false/ would still match after the mutation this guards.
  const at = src.indexOf("function attachUseCaseContext");
  assert.ok(at > 0, "attachUseCaseContext exists in run.js");
  const fn = src.slice(at, src.indexOf("\n  }", at));
  assert.ok(
    fn.includes("enumerable: false"),
    "the use-case context must be attached non-enumerably",
  );
  const p = await runSizing(
    { ...INPUTS, useCase: "backup" },
    { fetchWeather: fakeWeather },
  );
  assert.ok(
    !Object.keys(p).some((k) => k.startsWith("__")),
    "no internal key rides out as an enumerable payload field",
  );
  assert.ok(
    !Object.getOwnPropertyNames(p).includes("__useCaseContext"),
    "the hourly context was left on the payload",
  );
  assert.match(JSON.stringify(p), /useCaseOutcome/);
  assert.doesNotMatch(JSON.stringify(p), /__useCaseContext/);
});

test("backup measures the outage start state from a grid-up run", async () => {
  // Starting every outage from an assumed-empty bank would under-report
  // coverage, so run.js runs the system grid-connected first and hands the
  // real SOC series to the outage simulator.
  const p = await runSizing(
    { ...INPUTS, useCase: "backup" },
    { fetchWeather: fakeWeather },
  );
  assert.equal(p.useCaseOutcome.measurement.backupStartState, "measured-soc");
});

test("backup is sized on the essentials, so it has a battery to lose", async () => {
  const p = await runSizing(
    { ...INPUTS, useCase: "backup" },
    { fetchWeather: fakeWeather },
  );
  assert.ok(p.useCaseOutcome.measurement.battKwh > 0, "a backup needs a bank");
  assert.ok(p.useCaseOutcome.measurement.outageCoveragePct > 0);
  // The whole-home load must NOT be what it was sized on.
  assert.ok(
    p.dailyKwh <= INPUTS.essentialKwh,
    `backup was sized on ${p.dailyKwh} kWh/day, not the ${INPUTS.essentialKwh} kWh of essentials`,
  );
});

test("a legacy caller with no use case keeps its exact pair", async () => {
  // Solar-only is a bill-cut configuration. If the wrapper re-derived it from
  // "billcut" it would silently add a battery to every solar-only run ever
  // shipped — so a caller that does not name a use case is left alone.
  const p = await runSizing(
    { ...INPUTS, mode: "gridtie", hardwareConfig: "solar" },
    { fetchWeather: fakeWeather },
  );
  assert.equal(p.hardwareConfig, "solar");
  assert.equal(p.useCase, "billcut");
});

test("an infeasible run still returns a payload and says it is unmeasured", async () => {
  // No explicit use case here, so the legacy pair is left alone and the
  // structurally impossible combo (off-grid + battery-only) survives to the
  // engine. That is the exact situation the guards exist for.
  const p = await runSizing(
    { ...INPUTS, mode: "offgrid", hardwareConfig: "battery" },
    { fetchWeather: fakeWeather },
  );
  assert.ok(p.unreachableReason, "the combo is structurally impossible");
  assert.equal(p.useCase, "offgrid");
  assert.ok(p.useCaseOutcome, "the caller still gets an outcome object");
  assert.equal(p.useCaseOutcome.measured, false);
  assert.equal(p.useCaseOutcome.reasonKey, "useCaseNotMeasured");
});

test("the reserve measures the same system with and without the floor", async () => {
  const withFloor = await runSizing(
    { ...INPUTS, useCase: "reserve", reservePct: 0.25 },
    { fetchWeather: fakeWeather },
  );
  const m = withFloor.useCaseOutcome.measurement;
  assert.equal(m.measured, true);
  assert.ok("reserveBillCutPct" in m);
  assert.ok("reserveBillCutWithFloorPct" in m);
  // On this probe site the cheapest 80% cut needs no bank, and the case says
  // exactly that rather than reporting a free reserve.
  if (m.battKwh === 0)
    assert.equal(withFloor.useCaseOutcome.reasonKey, "verdictReserveNoBattery");
  else assert.ok(m.reserveBillCutWithFloorPct <= m.reserveBillCutPct);
});

// ── the gate and the evidence line ──────────────────────────────────────────

test("GATE: the use-case playtest passes on the real tree", () => {
  const out = execFileSync(process.execPath, ["scripts/check-usecases.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.match(out, /USECASES OK/);
  assert.match(out, /own metric: bill_cut_pct/);
  // The walk must actually reach the engine, not be a table of constants.
  assert.match(out, /use-case walk \(probe site: Honolulu/);
});

test("GATE: the use-case gate is wired into the preflight, not merely present", () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
  );
  assert.match(pkg.scripts.seo, /check-usecases\.mjs/);
  assert.equal(pkg.scripts["gate:usecases"], "node scripts/check-usecases.mjs");
});

test("EVIDENCE: the usecases facet line cannot contradict the gate", () => {
  const ev = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, "evidence/advisor-and-release.json"),
      "utf8",
    ),
  );
  const line = ev.facet_evidence.usecases;
  assert.ok(line && line.length > 40, "the facet line is a measurement");
  // It must name the gate that proves it, and the six cases it walked.
  assert.match(line, /check-usecases\.mjs/);
  for (const id of USE_CASE_IDS)
    assert.ok(line.includes(id), `the line must report ${id}`);
  // And it must not assert the negation of the thing the gate proves.
  for (const bad of [
    "only in copy",
    "no use-case surface",
    "shares another use case's metric",
    "no outage simulation",
    "no reserve",
  ])
    assert.ok(
      !line.includes(bad),
      `the line asserts the gate's negation: ${bad}`,
    );
  // The six must be walked, not asserted.
  assert.match(line, /walk/i);
  assert.match(line, /metric/i);
});
