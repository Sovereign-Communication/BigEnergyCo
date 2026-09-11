import test from "node:test";
import assert from "node:assert/strict";
import { cycleLifeForDoD } from "../assets/js/sizing/engine.js";

test("cycleLifeForDoD: LFP adheres to empirical Wöhler power-law degradation", () => {
  const c80 = cycleLifeForDoD("lfp", 0.8);
  assert.equal(
    c80,
    6000,
    "LFP baseline benchmark must be exactly 6,000 cycles at 80% DoD",
  );

  const c100 = cycleLifeForDoD("lfp", 1.0);
  assert.ok(
    c100 >= 3800 && c100 <= 4500,
    `100% DoD accelerates degradation to ~4,100 cycles, got ${c100}`,
  );

  const c60 = cycleLifeForDoD("lfp", 0.6);
  assert.ok(
    c60 >= 9000 && c60 <= 10500,
    `60% DoD extends cycle life to 9,000-10,500 cycles (zero-swap threshold), got ${c60}`,
  );

  const c50 = cycleLifeForDoD("lfp", 0.5);
  assert.ok(c50 > c60, "Shallower DoD must strictly yield higher cycle life");

  // Cumulative energy throughput paradox: E_lifetime = N * DoD
  const throughput100 = c100 * 1.0;
  const throughput80 = c80 * 0.8;
  const throughput60 = c60 * 0.6;
  assert.ok(
    throughput60 > throughput80,
    "Cumulative energy throughput at 60% DoD must exceed 80% DoD",
  );
  assert.ok(
    throughput80 > throughput100,
    "Cumulative energy throughput at 80% DoD must exceed 100% DoD",
  );
});

test("cycleLifeForDoD: Sodium-ion handles 0V safe discharge and inverter clipping", () => {
  const c85 = cycleLifeForDoD("naion", 0.85);
  assert.equal(
    c85,
    5500,
    "Na-ion baseline at ~85% inverter cutoff window is 5,500 cycles",
  );

  const c100 = cycleLifeForDoD("naion", 1.0);
  assert.ok(
    c100 >= 4000 && c100 <= 4500,
    `Full 0V discharge yields ~4,200 cycles, got ${c100}`,
  );

  const c65 = cycleLifeForDoD("naion", 0.65);
  assert.ok(
    c65 >= 8000,
    `Oversized Na-ion bank (65% DoD) achieves >8,000 cycles (20+ years of daily cycling), got ${c65}`,
  );
});

test("cycleLifeForDoD: AGM suffers extreme cyclic degradation and hard ceiling", () => {
  const c50 = cycleLifeForDoD("agm", 0.5);
  assert.equal(c50, 500, "AGM 50% DoD ceiling benchmark is 500 cycles");

  const c100 = cycleLifeForDoD("agm", 1.0);
  assert.ok(
    c100 < 250,
    `AGM at 100% DoD is physically ruined in under 250 cycles, got ${c100}`,
  );

  const c20 = cycleLifeForDoD("agm", 0.2);
  assert.ok(
    c20 <= 2000,
    `Even at 20% DoD, AGM is capped at 2,000 cycles due to lead grid corrosion and drying, got ${c20}`,
  );
});

test("cycleLifeForDoD: boundary conditions and unknown chemistry fallback", () => {
  assert.equal(
    cycleLifeForDoD("lfp", 0.01),
    cycleLifeForDoD("lfp", 0.1),
    "Clamps minimum DoD to 0.1",
  );
  assert.equal(
    cycleLifeForDoD("lfp", 1.5),
    cycleLifeForDoD("lfp", 1.0),
    "Clamps maximum DoD to 1.0",
  );
  assert.equal(
    cycleLifeForDoD("unknown_chem", 0.8),
    4000,
    "Fallback returns sane 4,000 cycles",
  );
});
