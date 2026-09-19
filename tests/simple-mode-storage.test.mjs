import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readSimpleMode,
  initSimpleMode,
  setSimpleMode,
  isSimpleMode,
} from "../assets/js/shared/simple-mode.js";

// The v1 key carried "simple" written by default-on builds. The rotation
// contract: the new key starts unset, unset reads OFF, and nothing ever
// reads the old key again — so every legacy profile deterministically
// boots in Regular mode.
test("storage contract: rotation makes every legacy profile boot OFF", () => {
  const legacy = new Map([
    ["beco-simple-mode", "simple"], // what default-on builds wrote
  ]);
  const store = {
    getItem: (k) => (legacy.has(k) ? legacy.get(k) : null),
    setItem: (k, v) => legacy.set(k, v),
  };

  // The rotated key is unset on every existing profile -> OFF, regardless
  // of what the old key holds.
  initSimpleMode(store);
  assert.equal(isSimpleMode(), false);

  // An explicit toggle still persists and round-trips through the setter.
  setSimpleMode(true, store);
  assert.equal(legacy.get("beco-simple-mode-v2"), "simple");
  assert.equal(isSimpleMode(), true);
  setSimpleMode(false, store);
  assert.equal(isSimpleMode(), false);

  // The old key is never read or rewritten by the new code.
  assert.equal(legacy.get("beco-simple-mode"), "simple");
});

test("storage contract: unset, corrupt and throwing storage all read OFF", () => {
  assert.equal(readSimpleMode({ getItem: () => null }), false);
  assert.equal(readSimpleMode({ getItem: () => "garbage" }), false);
  assert.equal(
    readSimpleMode({
      getItem: () => {
        throw new Error("blocked");
      },
    }),
    false,
  );
  // Default storage absent (SSR/worker contexts) must not throw either.
  assert.equal(readSimpleMode(undefined), false);

  // The state owner degrades the same way: init from hostile storage -> OFF.
  initSimpleMode(undefined);
  assert.equal(isSimpleMode(), false);
});
