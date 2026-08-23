// Grid-connected offset mode tests. Run: node --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BILL_TARGETS, simulateOffset, sizeForBillCut, sizeAllBillTargets,
  buildE1kw, flatProfile, expandProfile,
} from "../assets/js/sizing/engine.js";

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeWeather(hours = 24 * 180, seed = 42, opts = {}) {
  const rand = mulberry32(seed);
  const out = new Array(hours);
  for (let i = 0; i < hours; i++) {
    const hod = i % 24;
    const doy = Math.floor(i / 24);
    const seasonal = opts.seasonalAmp ? 1 + opts.seasonalAmp * Math.sin((doy / 365) * 2 * Math.PI) : 1;
    const diurnal = Math.max(0, Math.sin(((hod - 6) / 12) * Math.PI));
    if (i % 24 === 0 || !out.__cloud) out.__cloud = 0.55 + 0.45 * rand();
    const cloudBase = out.__cloud;
    const dayNoise = 0.75 + 0.25 * rand();
    const ghi = Math.max(0, 950 * seasonal * diurnal * cloudBase * dayNoise);
    const tAmb = (opts.baseTemp ?? 22)
      + (opts.tempAmp ?? 6) * Math.sin((doy / 365) * 2 * Math.PI)
      + 3 * diurnal
      + 4 * (rand() - 0.5);
    out[i] = { ghi, tAmb };
  }
  return out;
}

test("simulateOffset conserves energy: direct + battery + imported == load", () => {
  const w = makeWeather(24 * 90, 11, { seasonalAmp: 0.3, baseTemp: 18, tempAmp: 8 });
  const e1 = buildE1kw(w);
  const load = expandProfile(flatProfile(9), e1.length);
  for (const chem of ["lfp", "naion", "agm"]) {
    const r = simulateOffset({ pvKw: 4, battKwhUsable: 8, e1kw: e1, loadWh: load, chemistry: chem });
    const total = r.directWh + r.battWhAc + r.importedWh;
    assert.ok(Math.abs(total - 9 * 1000 * 90) < 1e-3, `conservation holds for ${chem} (off by ${total - 9 * 1000 * 90})`);
  }
});

test("simulateOffset never exports: imports >= 0 and clipped surplus is tracked", () => {
  const w = makeWeather(24 * 60, 21);
  const e1 = buildE1kw(w);
  const load = expandProfile(flatProfile(5), e1.length); // small load, big array
  const r = simulateOffset({ pvKw: 12, battKwhUsable: 6, e1kw: e1, loadWh: load });
  assert.ok(r.importedWh >= -1e-6);
  assert.ok(r.curtailedWh > 0, "oversized array must clip surplus beyond storage");
  assert.ok(r.minSoc >= -1e-9 && r.finalSoc <= 1 + 1e-9);
});

test("simulateOffset: zero-battery system still cuts the bill via daytime solar", () => {
  const w = makeWeather(24 * 60, 33);
  const e1 = buildE1kw(w);
  const load = expandProfile(flatProfile(8), e1.length);
  const r = simulateOffset({ pvKw: 5, battKwhUsable: 0, e1kw: e1, loadWh: load });
  assert.equal(r.cyclesEquivalent, 0);
  assert.ok(r.directWh > 0, "panels alone serve daytime load");
  assert.ok(r.importedWh > 0, "nights still come from the grid");
});

test("imports are monotonically non-increasing in PV for fixed battery", () => {
  const w = makeWeather(24 * 45, 77);
  const e1 = buildE1kw(w);
  const load = expandProfile(flatProfile(7), e1.length);
  let prev = Infinity;
  for (const pv of [1, 2, 3, 5, 8, 12]) {
    const r = simulateOffset({ pvKw: pv, battKwhUsable: 5, e1kw: e1, loadWh: load });
    assert.ok(r.importedWh <= prev + 1e-6, `pv=${pv} must not increase imports`);
    prev = r.importedWh;
  }
});

test("sizeForBillCut meets its target with cheaper hardware than a bigger target", () => {
  const w = makeWeather(24 * 150, 555, { seasonalAmp: 0.4, baseTemp: 17, tempAmp: 10 });
  const e1 = buildE1kw(w);
  const load = expandProfile(flatProfile(10), e1.length);
  const common = { e1kw: e1, loadWh: load, years: 150 / 365, pvMax: 20, battMax: 40 };
  const c60 = sizeForBillCut({ ...common, minFraction: 0.6 });
  const c80 = sizeForBillCut({ ...common, minFraction: 0.8 });
  assert.ok(c60, "60% cut solvable here");
  assert.ok(c80, "80% cut solvable here");
  // verify the found systems actually meet their targets when re-checked
  const totalWh = [...load].reduce((a, b) => a + b, 0);
  assert.ok(c60.result.importedWh <= totalWh * 0.4 + 1e-6, "60% target honored");
  assert.ok(c80.result.importedWh <= totalWh * 0.2 + 1e-6, "80% target honored");
  const hw = (s) => s.pvKw + s.battKwh / 5;
  assert.ok(hw(c60) <= hw(c80) + 1e-9, "shallower cut needs no more hardware than deeper cut");
});

test("sizeAllBillTargets aligns with BILL_TARGETS order and marks impossibility", () => {
  const w = makeWeather(24 * 40, 8, {}); // short dark-ish window
  const e1 = buildE1kw(w);
  const load = expandProfile(flatProfile(200), e1.length); // absurd load
  const results = sizeAllBillTargets({
    e1kw: e1, loadWh: load, chemistry: "lfp",
    years: 40 / 365, pvMax: 2, battMax: 2,
  });
  assert.equal(results.length, BILL_TARGETS.length);
  assert.equal(results[0].target.id, "cut60");
  assert.equal(results[results.length - 1].sizing, null, "95% cut impossible at this scale");
});
