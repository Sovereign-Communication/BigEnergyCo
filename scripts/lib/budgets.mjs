// The release path's time budget — one owner, enforced in code.
//
// Why this exists: `scripts/verify-staging.mjs` retries transport failures, and
// retries that merely multiply a per-attempt timeout can outlive whatever wraps
// them — the CI job (`timeout-minutes` in .github/workflows/verify-staging.yml)
// or promote's subprocess cap. When that happens the verifier is KILLED
// mid-retry and returns a timeout/cancel instead of a verdict, which is exactly
// the outcome the retry exists to prevent: "the gate could not run" is
// indistinguishable from "the gate passed".
//
// So the retry loop takes a TOTAL DEADLINE rather than extra attempts, and that
// deadline plus process-startup slack must fit inside every outer limit:
//
//     VERIFY_BUDGET_MS + BUDGET_SLACK_MS  <=  PROMOTE_TIMEOUT_MS
//                                         <=  JOB_TIMEOUT_MINUTES
//
// tests/ci-resilience.test.mjs pins that relation AND the literal in the
// workflow file, so editing one number without the others fails a test instead
// of silently re-opening the hole.
//
// The verifier holds up its end: every request is clamped to `min(ceiling,
// remaining)` and the browser smoke's own timeout is clamped the same way, so
// DEADLINE + the slack above is the true worst case — not a sum of attempts.
//
// Compression only: the verifier accepts VERIFY_BUDGET_MS from the environment
// so a proof can drive a slow failure under a deliberately tiny budget, but it
// is clamped to the declared budget. A shorter budget can only make the gate
// FAIL SOONER; it can never buy a longer run or turn a red gate green.

/** Per-request ceiling, clamped down to whatever the budget has left. */
export const FETCH_TIMEOUT_MS = 30_000;

/** One browser-smoke attempt; the budget, not this, is what bounds the loop. */
export const SMOKE_ATTEMPT_TIMEOUT_MS = 15 * 60_000;

/** Total wall clock the verifier may take, retries included. */
export const VERIFY_BUDGET_MS = 15 * 60_000;

/** Room for a wrapper's own startup/teardown around the verifier. */
export const BUDGET_SLACK_MS = 2 * 60_000;

/** promote.mjs kills its verify-staging.mjs child after this. */
export const PROMOTE_TIMEOUT_MS = 20 * 60_000;

/** .github/workflows/verify-staging.yml `timeout-minutes`. */
export const JOB_TIMEOUT_MINUTES = 25;

/** Does `budgetMs` plus startup slack provably fit inside `outerMs`? */
export const budgetFitsInside = (budgetMs, outerMs) =>
  budgetMs + BUDGET_SLACK_MS <= outerMs;

/** The verifier's budget, from the environment. Compression only — see above. */
export function budgetFromEnv(env = process.env) {
  const raw = Number(env?.VERIFY_BUDGET_MS);
  if (!Number.isFinite(raw) || raw <= 0) return VERIFY_BUDGET_MS;
  return Math.min(raw, VERIFY_BUDGET_MS);
}
