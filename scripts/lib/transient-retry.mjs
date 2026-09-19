// Telling a platform flake apart from a regression, for the release gates.
//
// Why this exists: on 2026-09-19 the post-merge `Verify staging` run failed on
// `ERR_CERT_VERIFIER_CHANGED` while loading chat.js from GitHub Pages. The
// identical verification passed locally seconds later, and passed when the job
// was rerun — a runner-side transport flake, not a regression. A gate that
// cannot tell the two apart has only two bad options: block a good release, or
// retry everything and eventually hide a real one.
//
// The rule here is deliberately narrow:
//   • only TRANSPORT signatures are retryable (TLS/cert, DNS, socket, timeout,
//     and 5xx from the edge). A 404 is NOT transient — a missing asset is the
//     exact regression this gate exists to catch.
//   • a retried step re-runs the SAME assertion. A deterministic regression
//     therefore fails every attempt and still fails the gate; retrying can only
//     ever absorb non-determinism that comes from the network.
//   • every retry is reported by the caller, so a flake is visible in the log
//     rather than silently absorbed into a green run.
//   • the loop is bounded by a TOTAL WALL-CLOCK DEADLINE, not by attempts. Three
//     attempts of thirty seconds each is already more than a CI job allows, so
//     an attempt that cannot fit is never started — and a run that runs out of
//     budget throws a `BudgetExhausted` verdict instead of being killed.
//     scripts/lib/budgets.mjs owns that arithmetic.

const TRANSIENT_PATTERNS = [
  // TLS/certificate family — ERR_CERT_VERIFIER_CHANGED is the one observed.
  /\bERR_(?:CERT|SSL)_[A-Z_]+\b/,
  // Connectivity, DNS, sockets.
  /\bERR_(?:CONNECTION_[A-Z_]+|TIMED_OUT|SOCKET_NOT_CONNECTED|NETWORK_CHANGED|INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|ADDRESS_UNREACHABLE)\b/,
  /\bnet::ERR_(?:CERT|SSL|CONNECTION|TIMED_OUT|SOCKET|NETWORK|NAME|ADDRESS)_?[A-Z_]*\b/,
  // Node/undici transport errors.
  /\b(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|EAI_AGAIN|ENETUNREACH|UND_ERR_[A-Z_]+)\b/,
  /\bsocket hang ?up\b/i,
  /\bfetch failed\b/i,
  // An aborted request or a stalled connection (undici/DOMException wording).
  /\bTimeoutError\b/,
  /aborted due to timeout/i,
  // 5xx is the platform failing, not the artifact (the same class as the 504s
  // in the Cloudflare analytics). 404 is deliberately absent.
  /\bHTTP 5\d\d\b/,
  // verify-staging's own network-failure detail prefix.
  /^network: /m,
];

/**
 * The retry loop's own verdict: it ran out of its wall-clock allowance. This is
 * a FAILED gate with a clear reason, not a crash, and it is never retried —
 * retrying is what would have exceeded the allowance in the first place.
 */
export class BudgetExhausted extends Error {
  constructor(message) {
    super(message);
    this.name = "BudgetExhausted";
    // Callers key off this to report "not checked — budget" rather than
    // mislabelling it as a transport failure.
    this.budgetExhausted = true;
  }
}

/** Absolute deadline `ms` from now, for passing into `retryTransient`. */
export const deadlineFrom = (ms) => Date.now() + ms;

/**
 * Does this failure text describe a transport flake rather than a failed
 * assertion?
 * @param {unknown} text
 * @returns {boolean}
 */
export function isTransientFailure(text) {
  const s = typeof text === "string" ? text : String(text ?? "");
  if (!s) return false;
  return TRANSIENT_PATTERNS.some((re) => re.test(s));
}

/**
 * Run `fn`, retrying ONLY when it fails transiently.
 *
 * On the final attempt the error is rethrown with `transient = true` when the
 * last failure was transport-class, so callers can report "still failing after
 * N attempts on a transport error" without guessing.
 *
 * `fn` receives the attempt number and the milliseconds remaining before the
 * deadline, so it can clamp its own per-attempt timeout to what actually fits.
 *
 * @template T
 * @param {(attempt: number, remainingMs: number) => Promise<T>} fn
 * @param {object} [opts]
 * @param {number} [opts.attempts] total attempts, including the first
 * @param {number} [opts.delayMs] base backoff; growth is linear per attempt
 * @param {number} [opts.deadline] absolute ms epoch (see `deadlineFrom`); the
 *   loop never starts an attempt or a backoff that would pass it
 * @param {(info: {attempt: number, text: string}) => void} [opts.onRetry]
 * @param {(ms: number) => Promise<void>} [opts.sleep] injectable for tests
 * @param {(text: string) => boolean} [opts.classify] injectable for tests
 * @returns {Promise<T>}
 */
export async function retryTransient(fn, opts = {}) {
  const {
    attempts = 3,
    delayMs = 5000,
    deadline = Infinity,
    onRetry,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    classify = isTransientFailure,
  } = opts;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0)
      throw new BudgetExhausted(
        `the verification budget ran out before attempt ${attempt} of ${attempts} — the step was not retried again`,
      );
    try {
      return await fn(attempt, remaining);
    } catch (e) {
      // A budget verdict is final: retrying is what would exceed the budget.
      if (e instanceof BudgetExhausted) throw e;
      const text = `${e?.stdout ?? ""}${e?.stderr ?? ""}${e?.message ?? e ?? ""}`;
      const transient = classify(text);
      const last = attempt === attempts;
      if (!transient || last) {
        // An assertional failure never retries, and a transient one that
        // outlives every attempt is still a failure. Either way the gate fails.
        if (typeof e === "object" && e !== null) e.transient = transient;
        throw e;
      }
      const backoff = delayMs * attempt;
      // Never sleep past the deadline: that would be the killed-job path again.
      if (deadline - Date.now() - backoff <= 0)
        throw new BudgetExhausted(
          `the verification budget ran out after ${attempt} attempt(s) of ${attempts} — retrying would outlast it. Last failure (transient): ${text.replace(/\s+/g, " ").trim().slice(0, 200)}`,
        );
      onRetry?.({ attempt, text });
      await sleep(backoff);
    }
  }
  // Unreachable: the loop either returns or throws.
  throw new Error("retryTransient exhausted without a verdict");
}
