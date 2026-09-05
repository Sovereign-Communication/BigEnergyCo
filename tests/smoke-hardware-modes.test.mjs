import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBom } from "../assets/js/sizing/bom.js";
import { sweepSystems, buildFrontier, isBoundLimited } from "../assets/js/sizing/frontier.js";
import { runSizing } from "../assets/js/sizing/run.js";
import { buildE1kw, flatProfile, expandProfile } from "../assets/js/sizing/engine.js";
import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import { OFFLINE_PROFILES, PROFILE_YEAR } from "../assets/js/sizing/profiles.js";

const honolulu = OFFLINE_PROFILES.find((p) => p.name.includes("Honolulu"));
const fakeWeather = async () => ({
  hours: synthesizeFromProfile(honolulu),
  meta: { latitude: 21.31, longitude: -157.86, startYear: PROFILE_YEAR, endYear: PROFILE_YEAR, years: 1, source: "test fixture", offline: false },
});

const BASE_MSG = {
  latitude: 21.31, longitude: -157.86, dailyKwh: 20,
  tariff: 0.42, exportRate: 0.10, years: 1,
};

// ── BOM Smoke Tests ─────────────────────────────────────────────────────────

test("SMOKE: buildBom handles Solar-Only configuration without errors", () => {
  const bom = buildBom({
    pvKw: 6.5,
    battNameplateKwh: 0,
    chemistry: "lfp",
    peakLoadW: 3500,
  });

  assert.ok(bom.panels, "Panels must be defined for solar-only");
  assert.ok(bom.panels.count > 0);
  assert.ok(bom.panels.kwActual > 0);
  assert.ok(bom.panels.areaM2 > 0);

  assert.equal(bom.battery, null, "Battery must be null for solar-only");
  assert.equal(bom.voltage, null, "Voltage must be null for solar-only");
  assert.equal(bom.controller, null, "Charge controller must be null for solar-only");
  assert.ok(bom.inverter.recommendedKw > 0);
});

test("SMOKE: buildBom handles Battery-Only configuration without errors", () => {
  const bom = buildBom({
    pvKw: 0,
    battNameplateKwh: 16,
    chemistry: "lfp",
    peakLoadW: 4000,
  });

  assert.equal(bom.panels, null, "Panels must be null for battery-only");
  assert.ok(bom.battery, "Battery must be defined for battery-only");
  assert.ok(bom.battery.usableDod > 0);
  assert.ok(bom.voltage, "Voltage must be defined for battery-only");
  assert.equal(bom.voltage.volts, 48);
  assert.ok(bom.inverter.recommendedKw > 0);
});

// ── Frontier Sweep Smoke Tests ──────────────────────────────────────────────

test("SMOKE: buildFrontier strictly generates Solar-Only points when battMax = 0", () => {
  const hours = synthesizeFromProfile(honolulu);
  const e1kw = buildE1kw(hours);
  const loadWh = expandProfile(flatProfile(20), hours.length);

  const frontier = buildFrontier({
    e1kw, loadWh, mode: "gridtie", chemistry: "lfp",
    pvMax: 10, battMax: 0,
  });

  assert.ok(frontier.points.length > 0, "Should generate solar-only frontier points");
  for (const pt of frontier.points) {
    assert.equal(pt.battKwh, 0, `Point must have 0 battery kWh, got ${pt.battKwh}`);
    assert.ok(pt.pvKw > 0, `Point must have > 0 solar kW, got ${pt.pvKw}`);
    assert.ok(Number.isFinite(pt.capexUsd), `Capex must be finite, got ${pt.capexUsd}`);
  }
  // batt=0 must not falsely trigger boundLimited
  assert.equal(isBoundLimited([{ pvKw: 5, battKwh: 0 }], [0, 5, 10], [0]), false);
});

test("SMOKE: buildFrontier strictly generates Battery-Only points when pvMax = 0", () => {
  const hours = synthesizeFromProfile(honolulu);
  const e1kw = buildE1kw(hours);
  const loadWh = expandProfile(flatProfile(20), hours.length);

  const frontier = buildFrontier({
    e1kw, loadWh, mode: "gridtie", chemistry: "lfp",
    pvMax: 0, battMax: 25,
  });

  assert.ok(frontier.points.length > 0, "Should generate battery-only frontier points");
  for (const pt of frontier.points) {
    assert.equal(pt.pvKw, 0, `Point must have 0 solar kW, got ${pt.pvKw}`);
    assert.ok(pt.battKwh > 0, `Point must have > 0 battery kWh, got ${pt.battKwh}`);
    assert.ok(pt.outcomePct > 0, `Battery-only offset must be positive, got ${pt.outcomePct}%`);
    assert.ok(Number.isFinite(pt.capexUsd), `Capex must be finite, got ${pt.capexUsd}`);
  }
  // pv=0 must not falsely trigger boundLimited
  assert.equal(isBoundLimited([{ pvKw: 0, battKwh: 10 }], [0], [0, 10, 25]), false);
});

// ── runSizing Grid-Tie Auto Mode Smoke Tests ─────────────────────────────────

test("SMOKE: runSizing in Auto Grid-Tie mode for hardwareConfig = 'solar'", async () => {
  const payload = await runSizing({
    ...BASE_MSG,
    mode: "gridtie",
    chemistry: "auto",
    hardwareConfig: "solar",
  }, fakeWeather);

  assert.equal(payload.mode, "gridtie");
  assert.equal(payload.hardwareConfig, "solar");
  assert.ok(payload.focus, "Focus system must exist");
  assert.ok(payload.focus.pvKw > 0, "Focus system must have solar");
  assert.equal(payload.focus.battKwh, 0, "Focus system must have 0 battery");

  assert.ok(payload.matrix, "Matrix must exist");
  for (const col of payload.matrix.cols) {
    for (const row of payload.matrix.rows) {
      const cell = payload.matrix.cells[`${row.id}:${col.id}`];
      if (cell && cell.solvable) {
        assert.equal(cell.battKwh, 0, `Matrix cell ${col.id} must have 0 battery`);
        assert.ok(cell.pvKw > 0, `Matrix cell ${col.id} must have solar`);
      }
    }
  }

  assert.ok(payload.frontier, "Frontier must exist");
  for (const pt of payload.frontier.points) {
    assert.equal(pt.battKwh, 0, "Frontier points must have 0 battery");
    assert.ok(pt.pvKw > 0, "Frontier points must have solar");
  }

  const bom = buildBom({
    pvKw: payload.focus.pvKw,
    battNameplateKwh: payload.focus.battNameplateKwh,
    chemistry: payload.focus.chemistry,
    peakLoadW: payload.focus.peakLoadW,
  });
  assert.ok(bom.panels && bom.panels.count > 0);
  assert.equal(bom.battery, null);
});

test("SMOKE: runSizing in Auto Grid-Tie mode for hardwareConfig = 'battery'", async () => {
  const payload = await runSizing({
    ...BASE_MSG,
    mode: "gridtie",
    chemistry: "auto",
    hardwareConfig: "battery",
  }, fakeWeather);

  assert.equal(payload.mode, "gridtie");
  assert.equal(payload.hardwareConfig, "battery");
  assert.ok(payload.focus, "Focus system must exist");
  assert.equal(payload.focus.pvKw, 0, "Focus system must have 0 solar");
  assert.ok(payload.focus.battKwh > 0, "Focus system must have battery");

  assert.ok(payload.matrix, "Matrix must exist");
  for (const col of payload.matrix.cols) {
    for (const row of payload.matrix.rows) {
      const cell = payload.matrix.cells[`${row.id}:${col.id}`];
      if (cell && cell.solvable) {
        assert.equal(cell.pvKw, 0, `Matrix cell ${col.id} must have 0 solar`);
        assert.ok(cell.battKwh > 0, `Matrix cell ${col.id} must have battery`);
      }
    }
  }

  assert.ok(payload.frontier, "Frontier must exist");
  assert.ok(payload.frontier.points.length > 0, "Battery-only frontier must have points");
  for (const pt of payload.frontier.points) {
    assert.equal(pt.pvKw, 0, "Frontier points must have 0 solar");
    assert.ok(pt.battKwh > 0, "Frontier points must have battery");
  }

  const bom = buildBom({
    pvKw: payload.focus.pvKw,
    battNameplateKwh: payload.focus.battNameplateKwh,
    chemistry: payload.focus.chemistry,
    peakLoadW: payload.focus.peakLoadW,
  });
  assert.equal(bom.panels, null);
  assert.ok(bom.battery && bom.battery.usableDod > 0);
});

// ── runSizing Grid-Tie Manual Chemistry Mode Smoke Tests ────────────────────

test("SMOKE: runSizing in Manual LFP Grid-Tie mode for hardwareConfig = 'solar'", async () => {
  const payload = await runSizing({
    ...BASE_MSG,
    mode: "gridtie",
    chemistry: "lfp",
    hardwareConfig: "solar",
  }, fakeWeather);

  assert.equal(payload.mode, "gridtie");
  assert.equal(payload.hardwareConfig, "solar");
  assert.ok(payload.targets.length > 0);
  for (const t of payload.targets) {
    if (t.solvable) {
      assert.equal(t.battKwh, 0);
      assert.ok(t.pvKw > 0);
    }
  }
  if (payload.customTarget && payload.customTarget.solvable) {
    assert.equal(payload.customTarget.battKwh, 0);
    assert.ok(payload.customTarget.pvKw > 0);
  }
});

test("SMOKE: runSizing in Manual LFP Grid-Tie mode for hardwareConfig = 'battery'", async () => {
  const payload = await runSizing({
    ...BASE_MSG,
    mode: "gridtie",
    chemistry: "lfp",
    hardwareConfig: "battery",
    customCut: 0.15,
  }, fakeWeather);

  assert.equal(payload.mode, "gridtie");
  assert.equal(payload.hardwareConfig, "battery");
  assert.ok(payload.targets.length > 0);
  for (const t of payload.targets) {
    if (t.solvable) {
      assert.equal(t.pvKw, 0);
      assert.ok(t.battKwh > 0);
    }
  }
  if (payload.customTarget && payload.customTarget.solvable) {
    assert.equal(payload.customTarget.pvKw, 0);
    assert.ok(payload.customTarget.battKwh > 0);
  }
});

// ── Incremental Slider / Exact System Adoption Smoke Tests ──────────────────

test("SMOKE: incrementalCut handles battery-only and solar-only slider edits", async () => {
  // Battery-only incremental cut
  const patchBatt = await runSizing({
    ...BASE_MSG,
    mode: "gridtie",
    chemistry: "auto",
    hardwareConfig: "battery",
    incrementalCut: true,
    customCut: 0.18,
    focusPvKw: 0,
    focusBattKwh: 12,
    focusChemistry: "lfp",
  }, fakeWeather);

  assert.ok(patchBatt.customCut);
  assert.equal(patchBatt.customCut.fraction, 0.18);
  if (patchBatt.focusSoc) {
    assert.equal(patchBatt.focusSoc.pvKw, 0);
    assert.equal(patchBatt.focusSoc.battKwh, 12);
    assert.ok(patchBatt.focusSoc.socNameplatePct);
  }

  // Solar-only incremental cut
  const patchSolar = await runSizing({
    ...BASE_MSG,
    mode: "gridtie",
    chemistry: "auto",
    hardwareConfig: "solar",
    incrementalCut: true,
    customCut: 0.25,
    focusPvKw: 5,
    focusBattKwh: 0,
    focusChemistry: "lfp",
  }, fakeWeather);

  assert.ok(patchSolar.customCut);
  assert.equal(patchSolar.customCut.fraction, 0.25);
  if (patchSolar.focusSoc) {
    assert.equal(patchSolar.focusSoc.pvKw, 5);
    assert.equal(patchSolar.focusSoc.battKwh, 0);
    assert.equal(patchSolar.focusSoc.socNameplatePct, null);
  }
});

test("SMOKE: target cards and offgrid tiers carry socNameplatePct for SOC chart cohesion", async () => {
  // Grid-tie manual LFP
  const gtPayload = await runSizing({
    ...BASE_MSG,
    mode: "gridtie",
    chemistry: "lfp",
    hardwareConfig: "both",
  }, fakeWeather);

  assert.ok(gtPayload.targets.length > 0);
  const solvableTargetsWithBatt = gtPayload.targets.filter((t) => t.solvable && t.battKwh > 0);
  assert.ok(solvableTargetsWithBatt.length > 0);
  for (const t of solvableTargetsWithBatt) {
    assert.ok(t.socNameplatePct, `Target ${t.id} must have socNameplatePct`);
    assert.ok(Array.isArray(t.socNameplatePct.min));
    assert.ok(Array.isArray(t.socNameplatePct.max));
    assert.equal(t.socNameplatePct.min.length, t.socNameplatePct.max.length);
  }

  // Offgrid manual LFP
  const ogPayload = await runSizing({
    ...BASE_MSG,
    mode: "offgrid",
    chemistry: "lfp",
    hardwareConfig: "both",
  }, fakeWeather);

  assert.ok(ogPayload.tiers.length > 0);
  const solvableTiers = ogPayload.tiers.filter((t) => t.solvable && t.battKwh > 0);
  assert.ok(solvableTiers.length > 0);
  for (const t of solvableTiers) {
    assert.ok(t.socNameplatePct, `Tier ${t.id} must have socNameplatePct`);
    assert.ok(Array.isArray(t.socNameplatePct.min));
    assert.ok(Array.isArray(t.socNameplatePct.max));
  }
});

