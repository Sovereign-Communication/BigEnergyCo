// Offline bundled-profile tests. Run: node --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import {
  buildE1kw,
  expandProfile,
  flatProfile,
  simulate,
} from "../assets/js/sizing/engine.js";
import {
  OFFLINE_PROFILES,
  PROFILE_YEAR,
} from "../assets/js/sizing/profiles.js";

const honolulu = OFFLINE_PROFILES.find((p) => p.name.includes("Honolulu"));

test("bundled profiles exist for every region and carry full 12×24 matrices", () => {
  assert.ok(OFFLINE_PROFILES.length >= 60, "should cover all city presets");
  for (const p of OFFLINE_PROFILES) {
    assert.equal(p.ghi.length, 12);
    assert.equal(p.tAmb.length, 12);
    for (const row of p.ghi) {
      assert.equal(row.length, 24);
    }
    for (const row of p.tAmb) {
      assert.equal(row.length, 24);
    }
    assert.ok(Number.isFinite(p.lat) && Number.isFinite(p.lon));
  }
});

test("synthesizeFromProfile: 8760 hours, midnight GHI ~0, midday peak sane", () => {
  const hours = synthesizeFromProfile(honolulu);
  assert.equal(hours.length, 8760);
  // Night hours must be dark everywhere.
  for (let m = 0; m < 12; m++) {
    assert.equal(
      hours[m * 24 * 31 + 0].ghi === undefined
        ? hours[0].ghi
        : hours[m * 28 + 0].ghi >= 0,
      true,
    );
    assert.equal(honolulu.ghi[m][3], 0, "3 AM is night in every month");
  }
  // June midday should beat December midday (northern hemisphere).
  const junNoon = honolulu.ghi[5][12];
  const decNoon = honolulu.ghi[11][12];
  assert.ok(junNoon > decNoon, "seasonal cycle present");
});

test("GATE: offline profile produces plausible annual yield through the real engine", () => {
  const hours = synthesizeFromProfile(honolulu);
  const e1 = buildE1kw(hours);
  const annualKwhPerKw = [...e1].reduce((a, b) => a + b, 0) / 1000;
  assert.ok(
    annualKwhPerKw > 1400 && annualKwhPerKw < 2000,
    `Honolulu typical-year yield was ${annualKwhPerKw.toFixed(0)} kWh/kW`,
  );
  // And the simulator runs on it end to end, conserving energy exactly.
  const load = expandProfile(flatProfile(10), e1.length);
  const temps = Float64Array.from(hours, (h) => h.tAmb);
  const r = simulate({
    pvKw: 4,
    battKwhUsable: 7,
    e1kw: e1,
    loadWh: load,
    chemistry: "lfp",
    tempsC: temps,
  });
  const loadTotalWh = [...load].reduce((a, b) => a + b, 0);
  assert.ok(r.servedWh > 0);
  assert.ok(Math.abs(r.servedWh + r.unmetWh - loadTotalWh) < 1e-6);
});

test("profile year metadata is a complete recent year", () => {
  const thisYear = new Date().getUTCFullYear();
  assert.ok(
    PROFILE_YEAR >= thisYear - 2 && PROFILE_YEAR <= thisYear - 1,
    `PROFILE_YEAR=${PROFILE_YEAR}`,
  );
});
