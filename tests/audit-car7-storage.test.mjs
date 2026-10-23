// Car 7 of the Jev audit listed 13 storage/randomness suspects, all in tests and
// scripts. Every one of them is a test double making a platform call the test is
// about — a Map-backed setItem, a fake head.appendChild, a Cache Storage
// stand-in — and the "secrets" battery flagged them for the shape of the call,
// not for anything in the data. There is nothing to change in those lines.
//
// What the trace did find is the car-1 shape one layer down: three shipped write
// paths guard their storage with try/catch so private browsing and a full quota
// cannot break the flow, and **not one of those guards had a test**. A guard
// nobody exercises is a guard a refactor can delete. That is what this file
// pins. `Math.random()` and timer scaffolding in the smoke drivers is recorded
// as why-safe on #202 instead: none of it produces a token, a key or an id.
//
// Scope: P0.6, completion-program evidence (facets: `docs`).
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isSimpleMode,
  onSimpleModeChange,
  setSimpleMode,
  SIMPLE_MODE_KEY,
} from "../assets/js/shared/simple-mode.js";
import {
  createWizard,
  persistWizard,
  restoreWizard,
} from "../assets/js/sizing/wizard.js";

// The wizard key is module-private on purpose (one writer, one reader); the
// assertion below only needs its literal, which the module's own comment calls
// the contract.
const WIZARD_STORAGE_KEY = "beco-wizard-state";
import {
  cachedCountryCities,
  loadCountryCities,
} from "../assets/js/sizing/cities.js";

// The storage Safari private mode and a full quota both produce: every write
// throws. A double that never throws is exactly how these guards went untested.
function throwingStorage() {
  const writes = [];
  return {
    writes,
    getItem() {
      throw new Error("storage blocked");
    },
    setItem(k, v) {
      writes.push([k, v]);
      throw new DOMException("quota exceeded", "QuotaExceededError");
    },
    removeItem() {
      throw new Error("storage blocked");
    },
  };
}

// ── simple mode ────────────────────────────────────────────────────────────

test("a blocked storage write cannot stop the mode from switching", () => {
  const storage = throwingStorage();
  const seen = [];
  const off = onSimpleModeChange((m) => seen.push(m));
  try {
    assert.doesNotThrow(
      () => setSimpleMode(true, storage),
      "a quota error must not reach the toggle",
    );
    assert.equal(
      isSimpleMode(),
      true,
      "the mode is the in-memory truth, not the storage write",
    );
    assert.deepEqual(seen, [true], "observers are still told");
    assert.deepEqual(
      storage.writes,
      [[SIMPLE_MODE_KEY, "simple"]],
      "the write was attempted, and failed, and that is the path under test",
    );
  } finally {
    off();
    setSimpleMode(false, throwingStorage());
  }
});

// ── wizard persistence ─────────────────────────────────────────────────────

test("a blocked storage write leaves the wizard usable and merely unpersisted", () => {
  const storage = throwingStorage();
  const wizard = createWizard();
  wizard.setValue("latitude", 21.31);
  wizard.setValue("longitude", -157.86);
  wizard.next();

  assert.doesNotThrow(() => persistWizard(wizard, storage));
  assert.equal(wizard.state.step, "load", "the flow advanced in memory");

  // Restoring from the same hostile storage must yield a fresh wizard rather
  // than throw or replay half a state.
  const restored = restoreWizard(storage);
  assert.deepEqual(
    restored.state,
    createWizard().state,
    "a blocked read is no state at all",
  );
  assert.deepEqual(
    storage.writes.map(([k]) => k),
    [WIZARD_STORAGE_KEY],
    "the persist was attempted under the wizard's own key",
  );
});

// ── country partitions ─────────────────────────────────────────────────────

test("a country partition still loads when its cache write is refused", async () => {
  // A real partition code the other tests do not use, so the module-level memo
  // cannot short-circuit this fetch.
  const rows = await loadCountryCities(
    "AL",
    async () => ({
      ok: true,
      json: async () => [
        { name: "Testville", country: "Testland", lat: "1.25", lng: "2.5" },
      ],
    }),
    throwingStorage(),
  );
  assert.equal(
    rows.length,
    1,
    "the partition is returned even though it could not be cached",
  );
});

test("a refused read is an empty partition, not a crash", () => {
  assert.doesNotThrow(() => cachedCountryCities("AL", throwingStorage()));
  assert.deepEqual(
    cachedCountryCities("AL", throwingStorage()),
    [],
    "an unreadable partition degrades to the seed catalog",
  );
});
