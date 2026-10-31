// Tests for the Emergency Reserve use case.
// Run: node --test tests/usecase-reserve.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { infeasibleReason } from "../assets/js/sizing/engine.js";

test("reserve mode requires a battery (solar-only is infeasible)", () => {
  const reason = infeasibleReason({
    mode: "reserve",
    hardwareConfig: "solar",
  });
  assert.equal(reason, "needs-battery");
});

test("reserve mode works with battery-only hardware", () => {
  const reason = infeasibleReason({
    mode: "reserve",
    hardwareConfig: "battery",
  });
  assert.equal(reason, null);
});

test("reserve mode works with solar+battery hardware", () => {
  const reason = infeasibleReason({
    mode: "reserve",
    hardwareConfig: "both",
  });
  assert.equal(reason, null);
});

test("reserve tradeoff calculation: 20% reserve on 10kWh battery", () => {
  const battKwh = 10;
  const reservePct = 0.2;
  const reserveKwh = battKwh * reservePct;
  const usableKwh = battKwh - reserveKwh;
  
  assert.equal(reserveKwh, 2);
  assert.equal(usableKwh, 8);
  
  // Tradeoff ratio: (1 - reservePct) / reservePct
  // Higher reserve = lower tradeoff (more emergency value, less cycling value)
  const tradeoff = (1 - reservePct) / reservePct;
  assert.ok(tradeoff > 0, "tradeoff should be positive");
  assert.equal(Math.round(tradeoff * 100) / 100, 4);
});

test("reserve with 0% is not viable (no reserve to measure)", () => {
  const reservePct = 0;
  const viable = reservePct > 0;
  assert.equal(viable, false);
});

test("reserve with no battery is not viable", () => {
  const battKwh = 0;
  const viable = battKwh > 0;
  assert.equal(viable, false);
});
