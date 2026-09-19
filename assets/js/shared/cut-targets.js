// The bill-cut targets the UI offers. These mirror the grid-tie columns the
// engine actually sizes (BILL_TARGETS in sizing/engine.js: cut60/80/95) — the
// recommendation can always honor the choice. Engine itself is deliberately
// NOT imported here: it is worker-only code and importing it would bloat the
// main-thread bundle; tests/pin the mirror to the engine instead.
export const CUT_TARGET_PCT = { cut95: 95, cut80: 80, cut60: 60 };

export const CUSTOM_TARGET = "custom";

/**
 * Which select state a given cut percentage is: a real target id, or the
 * honest "custom" mirror whenever the results slider holds an arbitrary cut.
 * The single mapping the sync path, the select handler and the share
 * serializer all use, so the two controls cannot disagree.
 */
export function targetForPct(pct) {
  const match = Object.entries(CUT_TARGET_PCT).find(([, p]) => p === pct);
  return match ? match[0] : CUSTOM_TARGET;
}
