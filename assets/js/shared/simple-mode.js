// Single owner of the display-mode state: what "Simple mode" is right now,
// what it reads at boot, and who to tell when it changes. UI code observes —
// it never keeps its own copy — so the toggle, the DOM attribute and the
// results card cannot disagree. Storage is the only persisted truth; this
// module's singleton is the only in-memory truth.
export const SIMPLE_MODE_KEY = "beco-simple-mode-v2";

// v2: the pre-real-Simple-mode builds defaulted the toggle ON and stored
// "simple" under the original key, so every profile that ever loaded one of
// them carries it. Rotating the key makes "off by default" true for those
// visitors too — no migration can distinguish their stored value from a
// deliberate choice, and the old default-on era had no deliberate choices.

let current = false; // module-local: the one in-memory truth
const listeners = new Set();

export function readSimpleMode(storage = globalThis.localStorage) {
  try {
    const value = storage?.getItem(SIMPLE_MODE_KEY);
    return value === "simple";
  } catch {
    return false;
  }
}

/** Subscribe to mode changes; returns an unsubscribe function. */
export function onSimpleModeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isSimpleMode() {
  return current;
}

/**
 * The one state setter. Persists, updates the singleton, and notifies
 * observers. Returns the resulting mode. UI code never writes `simpleMode`
 * directly, so every path (toggle, card button) lands here by construction.
 */
export function setSimpleMode(simple, storage = globalThis.localStorage) {
  const value = simple ? "simple" : "technical";
  try {
    storage?.setItem(SIMPLE_MODE_KEY, value);
  } catch {
    // Private browsing and blocked storage must not stop sizing.
  }
  if (current === simple) return current;
  current = simple === true;
  for (const fn of listeners) fn(current);
  return current;
}

/** Boot: adopt the persisted choice once, before any observer wires up. */
export function initSimpleMode(storage = globalThis.localStorage) {
  current = readSimpleMode(storage);
  return current;
}

export function modeLabel(simple) {
  return simple ? "Simple mode" : "Technical mode";
}
