export const SIMPLE_MODE_KEY = "beco-simple-mode";

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
