// Cloudflare Turnstile server-side verification for the showcase branch.
//
// Why: the free calculator is the top of a verified-electrician lead funnel,
// so lead quality IS the business. Bot-submitted chat sessions burn paid
// Groq tokens and poison the funnel. Turnstile makes "is this a human"
// a Cloudflare-answered question instead of our problem.
//
// Contract:
//   verifyTurnstile(token, secret, doFetch?) -> { ok: true } or
//     { ok: false, reason } where reason is one of:
//     "missing_token" | "missing_secret" | "network_error" |
//     "invalid_token" | "bad_response"
// doFetch is a test seam (defaults to global fetch).
//
// Fail-open=false: callers must treat any non-ok result as "reject the
// request". The secret comes from a wrangler secret binding
// (TURNSTILE_SECRET_KEY) — never from the repo or the client.

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(token, secret, doFetch = fetch) {
  if (!token || typeof token !== "string" || token.length === 0) {
    return { ok: false, reason: "missing_token" };
  }
  if (!secret || typeof secret !== "string" || secret.length === 0) {
    return { ok: false, reason: "missing_secret" };
  }
  let res;
  try {
    res = await doFetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
    });
  } catch {
    return { ok: false, reason: "network_error" };
  }
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    return { ok: false, reason: "bad_response" };
  }
  if (payload && payload.success === true) {
    return { ok: true };
  }
  return { ok: false, reason: "invalid_token" };
}
