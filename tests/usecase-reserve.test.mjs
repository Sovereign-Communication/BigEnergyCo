import { test } from "node:test";
import assert from "node:assert/strict";
import { infeasibleReason } from "../assets/js/sizing/engine.js";
import { useCase } from "../assets/js/sizing/usecases.js";
import {
  assertModeMatchesUseCase,
  assertUseCase,
  sizeUseCase,
} from "./usecase-fixture.mjs";

for (const [hardwareConfig, expected] of [
  ["solar", "needs-battery"],
  ["battery", null],
  ["both", null],
]) {
  test(`reserve feasibility: ${hardwareConfig}`, () => {
    assert.equal(
      infeasibleReason({ mode: "reserve", hardwareConfig }),
      expected,
    );
  });
}

test("reserve mode executes the canonical measured tradeoff", async () => {
  const p = await assertModeMatchesUseCase("reserve");
  const m = assertUseCase(p, "reserve");
  assert.equal(p.mode, "gridtie");
  assert.equal(m.reservePct, 0.2);
  assert.ok(m.battKwh > 0);
  assert.ok(m.reserveBillCutWithFloorPct <= m.reserveBillCutPct);
  assert.ok(m.reserveCoverHours > 0);
  assert.deepEqual(p.useCaseOutcome.value, {
    savingsLostPct: m.reserveSavingsLostPct,
    coverHours: m.reserveCoverHours,
  });
});

test("zero reserve reports no held energy through the shipped simulator", async () => {
  const p = await sizeUseCase({ mode: "reserve", reservePct: 0 });
  const m = assertUseCase(p, "reserve");
  assert.equal(m.reserveCoverHours, 0);
  assert.equal(m.reserveSavingsLostPct, 0);
  assert.notEqual(p.useCaseOutcome.status, "works");
});

test("a system with no battery is declined by the real reserve measurement", async () => {
  const p = await sizeUseCase({
    mode: "reserve",
    focusPvKw: 4,
    focusBattKwh: 0,
    focusChemistry: "lfp",
  });
  const m = assertUseCase(p, "reserve");
  assert.equal(m.battKwh, 0);
  assert.equal(m.reserveCoverHours, 0);
  assert.equal(p.useCaseOutcome.status, "not-here");
  assert.equal(p.useCaseOutcome.reasonKey, "verdictReserveNoBattery");
});

test("reserve inputs are normalized by the existing canonical policy", async () => {
  for (const [reservePct, expected] of [
    [NaN, 0],
    [-1, 0],
    [2, 0.9],
  ]) {
    const p = await sizeUseCase({ mode: "reserve", reservePct });
    assert.equal(assertUseCase(p, "reserve").reservePct, expected);
  }
});

test("an explicit useCase wins over a conflicting mode alias", async () => {
  const p = await sizeUseCase({ useCase: "backup", mode: "reserve" });
  assertUseCase(p, "backup");
  assert.equal(p.mode, "offgrid");
});

test("reserve measurements are interpreted as percentages, not fractions", async () => {
  for (const [reservePct, focusPvKw, expected] of [
    [0.2, 2, "works"],
    [0.8, 2, "partial"],
    [0.9, 0.1, "not-here"],
  ]) {
    const p = await sizeUseCase({
      mode: "reserve",
      reservePct,
      focusPvKw,
      focusBattKwh: 6,
    });
    const m = assertUseCase(p, "reserve");
    assert.ok(m.reserveSavingsLostPct > 0.5);
    assert.equal(p.useCaseOutcome.status, expected);
  }
});

test("reserve verdict boundaries are 20% and 50% of savings", () => {
  for (const [lost, expected] of [
    [19.99, "works"],
    [20, "works"],
    [20.01, "partial"],
    [50, "partial"],
    [50.01, "not-here"],
  ]) {
    assert.equal(
      useCase("reserve").verdict({
        battKwh: 6,
        reserveSavingsLostPct: lost,
        reserveCoverHours: 24,
      }).status,
      expected,
    );
  }
});

test("billcut is not a mode alias; valid legacy callers retain their hardware", async () => {
  await assert.rejects(
    sizeUseCase({ mode: "billcut", hardwareConfig: "solar" }),
    /useCase.*billcut/,
  );
  const p = await sizeUseCase({ mode: "offgrid", hardwareConfig: "solar" });
  assert.equal(p.hardwareConfig, "solar");
  assert.equal(p.mode, "offgrid");
  assert.equal(p.useCase, "offgrid");
});

test("legacy gridtie solar-only callers keep their hardware and bill-cut metric", async () => {
  const p = await sizeUseCase({ mode: "gridtie", hardwareConfig: "solar" });
  assertUseCase(p, "billcut");
  assert.equal(p.mode, "gridtie");
  assert.equal(p.hardwareConfig, "solar");
  assert.equal(p.focus.battKwh, 0);
});
