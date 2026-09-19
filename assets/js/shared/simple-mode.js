// v2: the pre-real-Simple-mode builds defaulted the toggle ON and stored
// "simple" under the original key, so every profile that ever loaded one of
// them carries it. Rotating the key makes "off by default" true for those
// visitors too — no migration can distinguish their stored value from a
// deliberate choice, and the old default-on era had no deliberate choices.
export const SIMPLE_MODE_KEY = "beco-simple-mode-v2";

// Simple mode is opt-in: unset storage means technical/regular view. Only an
// explicit stored "simple" selects it, so default visitors keep every detail.
export function readSimpleMode(storage = globalThis.localStorage) {
  try {
    const value = storage?.getItem(SIMPLE_MODE_KEY);
    return value === "simple";
  } catch {
    return false;
  }
}

export function writeSimpleMode(simple, storage = globalThis.localStorage) {
  const value = simple ? "simple" : "technical";
  try {
    storage?.setItem(SIMPLE_MODE_KEY, value);
  } catch {
    // Private browsing and blocked storage must not stop sizing.
  }
  return simple === true;
}

export function modeLabel(simple) {
  return simple ? "Simple mode" : "Technical mode";
}
