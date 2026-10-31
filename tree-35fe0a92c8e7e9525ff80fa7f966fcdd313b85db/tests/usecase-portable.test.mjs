import { test } from "node:test";
import assert from "node:assert/strict";

// Portable mode payload logic — mirrors run.js portable branch.
// Extracted here for unit testing without the full worker harness.
function portablePayload({ portableBankKwh, portableDailyKwh }) {
  const bankKwh = Number(portableBankKwh);
  const dailyKwh = Number(portableDailyKwh);
  if (
    !Number.isFinite(bankKwh) ||
    bankKwh <= 0 ||
    !Number.isFinite(dailyKwh) ||
    dailyKwh <= 0
  ) {
    return { viable: false, reason: "verdictPortable" };
  }
  const usableKwh = bankKwh * 0.9;
  const runtimeDays = usableKwh / dailyKwh;
  return {
    viable: true,
    bankKwh: Math.round(bankKwh * 10) / 10,
    dailyKwh: Math.round(dailyKwh * 10) / 10,
    runtimeDays: Math.round(runtimeDays * 10) / 10,
  };
}

test("sufficient bank → works with runtime days", () => {
  const p = portablePayload({ portableBankKwh: 5, portableDailyKwh: 2 });
  assert.equal(p.viable, true);
  // 5 * 0.9 / 2 = 2.25 days
  assert.equal(p.runtimeDays, 2.3);
  assert.equal(p.bankKwh, 5);
  assert.equal(p.dailyKwh, 2);
});

test("zero bank → not-here", () => {
  const p = portablePayload({ portableBankKwh: 0, portableDailyKwh: 2 });
  assert.equal(p.viable, false);
  assert.equal(p.reason, "verdictPortable");
});

test("negative bank → not-here", () => {
  const p = portablePayload({ portableBankKwh: -3, portableDailyKwh: 2 });
  assert.equal(p.viable, false);
});

test("zero daily consumption → not-here", () => {
  const p = portablePayload({ portableBankKwh: 5, portableDailyKwh: 0 });
  assert.equal(p.viable, false);
  assert.equal(p.reason, "verdictPortable");
});

test("non-finite inputs → not-here", () => {
  const p = portablePayload({ portableBankKwh: NaN, portableDailyKwh: 2 });
  assert.equal(p.viable, false);
  const q = portablePayload({ portableBankKwh: 5, portableDailyKwh: Infinity });
  assert.equal(q.viable, false);
});

test("small bank, light load → fractional runtime", () => {
  const p = portablePayload({ portableBankKwh: 1, portableDailyKwh: 0.5 });
  assert.equal(p.viable, true);
  // 1 * 0.9 / 0.5 = 1.8 days
  assert.equal(p.runtimeDays, 1.8);
});
