import { test } from "node:test";
import assert from "node:assert/strict";
import {
  infeasibleReason,
  sizeForTier,
  sizeForBillCut,
  buildE1kw,
  flatProfile,
  expandProfile,
} from "../assets/js/sizing/engine.js";
import { runSizing } from "../assets/js/sizing/run.js";
import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import {
  OFFLINE_PROFILES,
  PROFILE_YEAR,
} from "../assets/js/sizing/profiles.js";

const honolulu = OFFLINE_PROFILES.find((p) => p.name.includes("Honolulu"));
const weather = async () => ({
  hours: synthesizeFromProfile(honolulu),
  meta: {
    latitude: 21.31,
    longitude: -157.86,
    startYear: PROFILE_YEAR,
    endYear: PROFILE_YEAR,
    years: 1,
    source: "test fixture",
    offline: true,
  },
});
const baseMsg = {
  latitude: 21.31,
  longitude: -157.86,
  dailyKwh: 10,
  tariff: 0.42,
  years: 1,
};

// ── infeasibleReason: the structural matrix ─────────────────────────────
test("infeasibleReason flags off-grid single-hardware combos", () => {
  assert.equal(
    infeasibleReason({ mode: "offgrid", hardwareConfig: "solar" }),
    "needs-battery",
  );
  assert.equal(
    infeasibleReason({ mode: "offgrid", hardwareConfig: "battery" }),
    "needs-panels",
  );
  assert.equal(
    infeasibleReason({ mode: "offgrid", hardwareConfig: "both" }),
    null,
  );
});

test("infeasibleReason flags battery-only surplus targets", () => {
  assert.equal(
    infeasibleReason({
      mode: "gridtie",
      hardwareConfig: "battery",
      minFraction: 1.05,
    }),
    "needs-pv-surplus",
  );
  assert.equal(
    infeasibleReason({
      mode: "gridtie",
      hardwareConfig: "battery",
      minFraction: 0.8,
    }),
    null,
  );
  assert.equal(
    infeasibleReason({
      mode: "gridtie",
      hardwareConfig: "solar",
      minFraction: 0.8,
    }),
    null,
  );
  assert.equal(
    infeasibleReason({
      mode: "gridtie",
      hardwareConfig: "both",
      minFraction: 1.11,
    }),
    null,
  );
});

// ── engine honors the envelope (no silent hardware violations) ──────────
test("sizeForTier with pvMax 0 searches nothing (battery-only off-grid)", () => {
  const hours = synthesizeFromProfile(honolulu);
  const e1kw = buildE1kw(hours);
  const loadWh = expandProfile(flatProfile(10), hours.length);
  const tempsC = Float64Array.from(hours, (h) => h.tAmb);
  const hit = sizeForTier({
    e1kw,
    loadWh,
    tempsC,
    chemistry: "lfp",
    maxUnmetHoursPerYear: 438,
    years: 1,
    costPerWpv: 0.4,
    costPerKwhBatt: 140,
    costPerKwInv: 60,
    pvMax: 0,
    battMax: 250,
    laborPerKwh: [12, 30],
    invMinKw: 1,
  });
  assert.equal(hit, null);
});

// ── runSizing: off-grid + solar-only explains itself ─────────────────────
test("offgrid solar-only is fully unsolvable with a needs-battery reason", async () => {
  const payload = await runSizing(
    {
      ...baseMsg,
      mode: "offgrid",
      chemistry: "auto",
      hardwareConfig: "solar",
      autoTier: "tier100",
    },
    { fetchWeather: weather },
  );
  assert.equal(payload.auto.length, 0);
  assert.equal(payload.unreachableReason, "needs-battery");
  for (const cell of Object.values(payload.matrix.cells)) {
    assert.equal(cell.solvable, false);
    assert.equal(cell.reason, "needs-battery");
  }
});

// ── runSizing: off-grid respects the battery-only envelope ───────────────
test("offgrid battery-only returns needs-panels reason", async () => {
  const payload = await runSizing(
    {
      ...baseMsg,
      mode: "offgrid",
      chemistry: "auto",
      hardwareConfig: "battery",
      autoTier: "tier99",
    },
    { fetchWeather: weather },
  );
  assert.equal(payload.unreachableReason, "needs-panels");
  // No matrix cell should claim a solvable PV system — the search
  // short-circuited because nothing recharges the bank.
  for (const cell of Object.values(payload.matrix.cells)) {
    assert.equal(cell.solvable, false);
    assert.equal(cell.reason, "needs-panels");
  }
});

// ── runSizing: degenerate grid-tie customs never throw ───────────────────
test("gridtie solar-only hi-cut custom column fails soft, not loud", async () => {
  const payload = await runSizing(
    {
      ...baseMsg,
      mode: "gridtie",
      chemistry: "auto",
      hardwareConfig: "solar",
      customCut: 0.95,
    },
    { fetchWeather: weather },
  );
  assert.ok(payload.customCut);
  // Either solves honestly or reports unsolvable — never throws, never
  // invents numbers.
  if (payload.customCut.best) {
    assert.equal(payload.customCut.best.solvable, true);
  } else {
    assert.equal(
      payload.customCut.entries.filter((e) => e && e.solvable).length,
      0,
    );
  }
});

test("gridtie battery-only surplus custom carries needs-pv-surplus", async () => {
  const payload = await runSizing(
    {
      ...baseMsg,
      mode: "gridtie",
      chemistry: "auto",
      hardwareConfig: "battery",
      customCut: 1.05,
    },
    { fetchWeather: weather },
  );
  assert.ok(payload.customCut);
  assert.equal(payload.customCut.best, null);
  assert.equal(payload.customCut.unreachableReason, "needs-pv-surplus");
});
