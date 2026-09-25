// ── Jev pricing (single source of truth) ────────────────────────────────────
//
// Master plan R-AI-08 / decision D-13: Jev talks to TypeSafe DIRECTLY, and the
// canonical direct price is US$0.00042 per 1,000,000 tokens. Before P0.3(a) the
// only price in the repo was a private `JEV_INPUT_PRICE_PER_MILLION = 42.0` in
// the gate script, which the worker could not see and which the plan's finding
// F-37 records as wrong by a factor of 100,000.
//
// This module is the ONE place the number lives. Both consumers import it:
//   - scripts/validate-jev-complete.mjs  (the offline/live gate's cost roll-up)
//   - worker/index.js                     (the runtime /api/jev token accounting)
//
// It is deliberately dependency-free and side-effect-free so it is safe to
// import from a Cloudflare Worker (no node: builtins) and from Node scripts
// alike. If you need to change the price, change it HERE and nowhere else; the
// test in tests/jev-price.test.mjs fails if a second copy ever appears.
//
// ── Known open discrepancy (plan V-11) ──────────────────────────────────────
// The owner's reported usage is ~2 billion tokens for ~US$0.07, which implies
// ~US$0.000035 per million — about 12x BELOW the canonical rate above, and
// $0.84 at the canonical rate for the same volume. That does not reconcile. The
// canonical constant stands (D-13); P0 reconciles the computed figure against
// TypeSafe's actual billing so the gap becomes visible rather than silent.
// Nothing in this module "fixes" the discrepancy by adjusting the number.
export const JEV_PRICE_USD_PER_MILLION_TOKENS = 0.00042;

/**
 * Cost in USD for a Jev call that consumed `inputTokens`.
 *
 * TypeSafe's System One model is billed on input tokens; output is free, so
 * there is deliberately no output-token term. Returns 0 for a missing or
 * non-numeric count rather than NaN, because this feeds telemetry and a NaN
 * here would poison a ledger row.
 *
 * @param {number} inputTokens
 * @returns {number} cost in USD
 */
export function jevCostUsd(inputTokens) {
  const n = Number(inputTokens);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return (n * JEV_PRICE_USD_PER_MILLION_TOKENS) / 1e6;
}
