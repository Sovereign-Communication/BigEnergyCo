import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readSimpleMode,
  initSimpleMode,
  setSimpleMode,
  isSimpleMode,
} from "../assets/js/shared/simple-mode.js";

// The v3 contract: first-time visitors (no stored preference) default to
// simple mode ON. Only an explicit "technical" opts out. This reverses the
// v2 "off by default" posture per the 2026-10-13 UX audit (P0-1).
test("storage contract: no stored preference boots ON (simple)", () => {
  const store = {
    _map: new Map(),
    getItem(k) {
      return this._map.has(k) ? this._map.get(k) : null;
    },
    setItem(k, v) {
      this._map.set(k, v);
    },
  };

  // No stored value -> simple mode ON.
  initSimpleMode(store);
  assert.equal(isSimpleMode(), true);

  // An explicit "technical" choice persists and is respected.
  setSimpleMode(false, store);
  assert.equal(store._map.get("beco-simple-mode-v2"), "technical");
  assert.equal(isSimpleMode(), false);

  // Re-init from stored "technical" stays technical.
  initSimpleMode(store);
  assert.equal(isSimpleMode(), false);

  // Explicit "simple" round-trips too.
  setSimpleMode(true, store);
  assert.equal(isSimpleMode(), true);
});

test("storage contract: unset, corrupt and throwing storage all read ON (simple)", () => {
  assert.equal(readSimpleMode({ getItem: () => null }), true);
  assert.equal(readSimpleMode({ getItem: () => "garbage" }), true);
  assert.equal(
    readSimpleMode({
      getItem: () => {
        throw new Error("blocked");
      },
    }),
    true,
  );
  // Default storage absent (SSR/worker contexts) must not throw either.
  assert.equal(readSimpleMode(undefined), true);

  // The state owner degrades the same way: init from hostile storage -> ON.
  initSimpleMode(undefined);
  assert.equal(isSimpleMode(), true);
});
