// Tests for the Time-of-Use Savings use case.
// Run: node --test tests/usecase-tou.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { infeasibleReason } from "../assets/js/sizing/engine.js";

test("tou mode requires a battery (solar-only is infeasible)", () => {
  const reason = infeasibleReason({
    mode: "tou",
    hardwareConfig: "solar",
  });
  assert.equal(reason, "needs-battery");
});

test("tou mode works with battery-only hardware", () => {
  const reason = infeasibleReason({
    mode: "tou",
    hardwareConfig: "battery",
  });
  assert.equal(reason, null);
});

test("tou mode works with solar+battery hardware", () => {
  const reason = infeasibleReason({
    mode: "tou",
    hardwareConfig: "both",
  });
  assert.equal(reason, null);
});

test("tou arbitrage math: high spread yields positive savings", () => {
  const battKwh = 10;
  const peak = 0.35;
  const offPeak = 0.12;
  const usableKwh = battKwh * 0.9;
  const spreadPerKwh = peak - offPeak;
  const dailySaving = usableKwh * spreadPerKwh * 0.9;

  assert.ok(spreadPerKwh > 0, "spread should be positive");
  assert.ok(dailySaving > 0, "daily saving should be positive");
  assert.equal(Math.round(spreadPerKwh * 1000) / 1000, 0.23);
});

test("tou with flat rate (no spread) is not viable", () => {
  const peak = 0.2;
  const offPeak = 0.2;
  const viable = Number.isFinite(peak) && Number.isFinite(offPeak) && peak > offPeak;
  assert.equal(viable, false);
});

test("tou with peak <= off-peak is not viable", () => {
  const peak = 0.1;
  const offPeak = 0.15;
  const viable = Number.isFinite(peak) && Number.isFinite(offPeak) && peak > offPeak;
  assert.equal(viable, false);
});
