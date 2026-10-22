import { test } from "node:test";
import assert from "node:assert/strict";
import { infeasibleReason } from "../assets/js/sizing/engine.js";
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
  test(`backup feasibility: ${hardwareConfig}`, () => {
    assert.equal(
      infeasibleReason({ mode: "backup", hardwareConfig }),
      expected,
    );
  });
}

test("backup mode executes the canonical outage sizing path", async () => {
  const p = await assertModeMatchesUseCase("backup");
  const m = assertUseCase(p, "backup");
  assert.equal(p.mode, "offgrid");
  assert.equal(p.hardwareConfig, "both");
  assert.equal(m.backupStartState, "measured-soc");
  assert.equal(m.backupTargetHours, 8);
  assert.equal(m.essentialKwhPerDay, 1.2);
  assert.equal(p.useCaseOutcome.value, m.outageCoveragePct);
  assert.ok(m.outageCoveragePct > 0 && m.outageCoveragePct <= 100);
});

test("backup sizes essentials rather than silently using the household load", async () => {
  const smallHome = await sizeUseCase({ mode: "backup", dailyKwh: 10 });
  const largeHome = await sizeUseCase({ mode: "backup", dailyKwh: 100 });
  assert.deepEqual(smallHome.focus, largeHome.focus);
  assert.deepEqual(smallHome.useCaseOutcome, largeHome.useCaseOutcome);
});

test("a longer outage target cannot increase measured coverage", async () => {
  const short = await sizeUseCase({ mode: "backup", outageTargetHours: 1 });
  const long = await sizeUseCase({ mode: "backup", outageTargetHours: 24 });
  assertUseCase(short, "backup");
  assertUseCase(long, "backup");
  assert.ok(long.useCaseOutcome.value < short.useCaseOutcome.value);
});

test("invalid outage targets use the canonical six-hour default", async () => {
  for (const outageTargetHours of [0, -5, NaN, Infinity]) {
    const p = await sizeUseCase({ mode: "backup", outageTargetHours });
    assert.equal(assertUseCase(p, "backup").backupTargetHours, 6);
  }
});

test("invalid essential loads use the disclosed canonical default", async () => {
  for (const essentialKwh of [0, -2, NaN]) {
    const p = await sizeUseCase({ mode: "backup", essentialKwh });
    const m = assertUseCase(p, "backup");
    assert.equal(m.essentialKwhDefaulted, true);
    assert.equal(m.essentialKwhPerDay, 0.6);
  }
});
