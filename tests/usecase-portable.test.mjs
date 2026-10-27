import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertModeMatchesUseCase,
  assertUseCase,
  sizeUseCase,
} from "./usecase-fixture.mjs";

test("portable mode reaches the canonical trip simulator", async () => {
  const p = await assertModeMatchesUseCase("portable");
  const m = assertUseCase(p, "portable");
  assert.equal(p.mode, "gridtie");
  assert.equal(p.hardwareConfig, "battery");
  assert.equal(m.portableBankKwh, 3);
  assert.equal(m.portableDeviceKwh, 2.4);
  assert.equal(m.portableTrips, 7);
  assert.equal(p.useCaseOutcome.value, m.portableCoveragePct);
  assert.ok(m.portableAutonomyHours > 24);
});

test("zero or negative portable banks use the existing two-kWh default", async () => {
  for (const portableBankKwh of [0, -3]) {
    const p = await sizeUseCase({ mode: "portable", portableBankKwh });
    assert.equal(assertUseCase(p, "portable").portableBankKwh, 2);
  }
});

test("zero device consumption uses the canonical one-kWh default", async () => {
  const p = await sizeUseCase({ mode: "portable", portableDeviceKwh: 0 });
  assert.equal(assertUseCase(p, "portable").portableDeviceKwh, 1);
});

test("non-finite portable inputs cannot produce non-finite runtime", async () => {
  const p = await sizeUseCase({
    mode: "portable",
    portableBankKwh: NaN,
    portableDeviceKwh: Infinity,
  });
  const m = assertUseCase(p, "portable");
  assert.equal(m.portableBankKwh, 2);
  assert.equal(m.portableDeviceKwh, 1);
  assert.ok(Number.isFinite(m.portableAutonomyHours));
  assert.ok(Number.isFinite(m.portableCoveragePct));
});

test("the visitor's bank and device load change the real runtime", async () => {
  const small = await sizeUseCase({
    mode: "portable",
    portableBankKwh: 1,
    portableDeviceKwh: 0.5,
    portablePvW: 0,
  });
  const big = await sizeUseCase({
    mode: "portable",
    portableBankKwh: 2,
    portableDeviceKwh: 0.5,
    portablePvW: 0,
  });
  assert.ok(
    assertUseCase(big, "portable").portableAutonomyHours >
      assertUseCase(small, "portable").portableAutonomyHours,
  );
});

test("shore power changes measured trip coverage rather than a copied formula", async () => {
  const isolated = await sizeUseCase({ mode: "portable", portablePvW: 0 });
  const shore = await sizeUseCase({
    mode: "portable",
    portablePvW: 0,
    portableShorePower: true,
  });
  assertUseCase(isolated, "portable");
  assertUseCase(shore, "portable");
  assert.ok(isolated.useCaseOutcome.value < 100);
  assert.equal(shore.useCaseOutcome.value, 100);
});
