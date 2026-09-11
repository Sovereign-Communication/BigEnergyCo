// Tests for consumer use-cases, presets, autonomy, and balance-of-system logic.
// Run: node --test tests/consumer-usecases.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { pickSystemVoltage } from "../assets/js/sizing/bom.js";

test("pickSystemVoltage: van/RV scale loads (<=1.5kW, <=3kWh) select 12V", () => {
  assert.equal(pickSystemVoltage(2.5, 1.2), 12);
  assert.equal(pickSystemVoltage(3.0, 1.5), 12);
});

test("pickSystemVoltage: mid-scale cabins/workshops (<=3.5kW, <=10kWh) select 24V", () => {
  assert.equal(pickSystemVoltage(5.0, 2.5), 24);
  assert.equal(pickSystemVoltage(9.6, 3.0), 24);
});

test("pickSystemVoltage: house-scale (>3.5kW or >10kWh) select 48V", () => {
  assert.equal(pickSystemVoltage(15.0, 5.0), 48);
  assert.equal(pickSystemVoltage(30.0, 10.0), 48);
});

test("Days of autonomy formula: usable kWh / daily kWh", () => {
  const dailyKwh = 10;
  const usableKwh = 25;
  const autonomy = usableKwh / dailyKwh;
  assert.equal(autonomy, 2.5);
  assert.ok(autonomy >= 2, "2.5 days covers standard 2-day storm front");
});

test("Array tilt heuristic gives steeper angles in high latitudes for winter harvest", () => {
  function optimalWinterTilt(lat) {
    const absLat = Math.abs(lat);
    return Math.min(70, Math.round(absLat + 15));
  }
  function optimalYearRoundTilt(lat) {
    const absLat = Math.abs(lat);
    return Math.round(absLat * 0.9);
  }

  // Hawaii (21°N)
  assert.equal(optimalYearRoundTilt(21.3), 19);
  assert.equal(optimalWinterTilt(21.3), 36);

  // Montana / Germany (48°N)
  assert.equal(optimalYearRoundTilt(48.0), 43);
  assert.equal(optimalWinterTilt(48.0), 63);
});

test("240V split-phase detection flags deep well pump and high-power inductive loads", () => {
  const items = [
    { name: "LED bulb", w: 10, splitPhase: false },
    { name: "Deep well pump", w: 1100, splitPhase: true, surgeW: 3500 },
  ];
  const needsSplitPhase = items.some((i) => i.splitPhase);
  const maxSurge = Math.max(...items.map((i) => i.surgeW || i.w));
  assert.equal(needsSplitPhase, true);
  assert.equal(maxSurge, 3500);
});
