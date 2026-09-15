export const SIMPLE_MODE_KEY = "beco-simple-mode";

export function readSimpleMode(storage = globalThis.localStorage) {
  try {
    const value = storage?.getItem(SIMPLE_MODE_KEY);
    return value === null || value === undefined ? true : value !== "technical";
  } catch {
    return true;
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
