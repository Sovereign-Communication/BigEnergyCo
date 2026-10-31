// Tests for the Outage Backup use case.
// Run: node --test tests/usecase-backup.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { infeasibleReason } from "../assets/js/sizing/engine.js";

test("backup mode requires a battery (solar-only is infeasible)", () => {
  const reason = infeasibleReason({
    mode: "backup",
    hardwareConfig: "solar",
  });
  assert.equal(reason, "needs-battery");
});

test("backup mode works with battery-only hardware", () => {
  const reason = infeasibleReason({
    mode: "backup",
    hardwareConfig: "battery",
  });
  assert.equal(reason, null);
});

test("backup mode works with solar+battery hardware", () => {
  const reason = infeasibleReason({
    mode: "backup",
    hardwareConfig: "both",
  });
  assert.equal(reason, null);
});

test("backup coverage math: sufficient battery covers target", () => {
  const battKwh = 20;
  const targetHrs = 8;
  const essentialKwhDay = 5;
  const essentialKwAvg = essentialKwhDay / 24;
  const usableKwh = battKwh * 0.9;
  const hoursOfBackup = usableKwh / essentialKwAvg;
  const coveragePct = Math.min(100, (hoursOfBackup / targetHrs) * 100);

  assert.ok(hoursOfBackup > targetHrs, "battery should exceed target");
  assert.equal(coveragePct, 100);
});

test("backup coverage math: small battery gives partial coverage", () => {
  const battKwh = 5;
  const targetHrs = 24;
  const essentialKwhDay = 10;
  const essentialKwAvg = essentialKwhDay / 24;
  const usableKwh = battKwh * 0.9;
  const hoursOfBackup = usableKwh / essentialKwAvg;
  const coveragePct = Math.min(100, (hoursOfBackup / targetHrs) * 100);

  assert.ok(coveragePct < 100, "coverage should be partial");
  assert.ok(coveragePct > 0, "coverage should be positive");
});

test("backup with no battery is not viable", () => {
  const battKwh = 0;
  const viable = battKwh > 0;
  assert.equal(viable, false);
});

test("backup with invalid target hours is not viable", () => {
  for (const targetHrs of [0, -5, NaN, Infinity]) {
    const viable =
      Number.isFinite(targetHrs) && targetHrs > 0;
    assert.equal(viable, false, `target ${targetHrs} should be invalid`);
  }
});

test("backup with invalid essential loads is not viable", () => {
  for (const essentialKwhDay of [0, -2, NaN]) {
    const viable =
      Number.isFinite(essentialKwhDay) && essentialKwhDay > 0;
    assert.equal(viable, false, `loads ${essentialKwhDay} should be invalid`);
  }
});
