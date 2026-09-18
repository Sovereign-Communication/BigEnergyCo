// Release identity helpers: what stamp does an artifact carry, does a deployed
// surface match the checkout, and what did the last promote do?
//
// Pure on purpose. The staging verifier and the promote tool both have to make
// the same judgement ("is the thing we are about to promote the thing we
// verified?"), and a wrong answer there ships the wrong build — so every rule
// here is unit-tested instead of living inline in a script that spawns wrangler.
import { createHash } from "node:crypto";

/** Every `?v=<stamp>` in a text, as a Set. */
export function stampsIn(text) {
  return new Set(
    [...String(text).matchAll(/\?v=([0-9a-z]+)/gi)].map((m) => m[1]),
  );
}

/**
 * The single stamp an artifact declares.
 * @returns {{stamp:(string|null), all:string[], mixed:boolean, ok:boolean}}
 */
export function artifactStamp(text) {
  const all = [...stampsIn(text)].sort();
  return {
    stamp: all.length === 1 ? all[0] : null,
    all,
    mixed: all.length > 1,
    ok: all.length === 1,
  };
}

/**
 * Line-ending normalization before hashing. A Windows checkout is CRLF while
 * the CI staging build (ubuntu) is LF: what Pages serves is what matters, not
 * the checkout's autocrlf setting.
 */
export const normalizeText = (s) => String(s).replace(/\r\n/g, "\n");

export const sha256 = (s) =>
  createHash("sha256").update(s, "utf8").digest("hex");

/**
 * Which delivery surface a base URL is. The two differ in ways that decide what
 * a 404 means, so guessing here would produce a verifier that passes on the
 * wrong thing:
 *   gh-pages   — GitHub Pages serves the artifact verbatim, including
 *                `_headers`/`_redirects` as inert files (HTTP 200, ignored).
 *   cloudflare — Cloudflare consumes those two files (HTTP 404) and APPLIES
 *                them, so security headers exist only here.
 * @returns {"gh-pages"|"cloudflare"|"local"}
 */
export function surfaceFor(baseUrl) {
  let host;
  try {
    host = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return "local";
  }
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]")
    return "local";
  if (host.endsWith(".github.io")) return "gh-pages";
  return "cloudflare";
}

/**
 * Files whose presence is a property of the platform, not of the build.
 *   present       — assertion: should be fetchable (GitHub Pages serves the
 *                   artifact verbatim, both files included)
 *   absent        — assertion: should 404 (Cloudflare consumes them)
 *   informational — a local server is not a platform, so say nothing rather
 *                   than assert a rule that does not apply
 */
export function platformSpecialFiles(surface) {
  const state =
    surface === "gh-pages"
      ? "present"
      : surface === "cloudflare"
        ? "absent"
        : "informational";
  return { _headers: state, _redirects: state };
}

/**
 * Parse the release ledger (JSONL). Blank lines and `#` comments are ignored;
 * a malformed line is reported rather than silently skipped, because a ledger
 * that lies about the last release is worse than no ledger.
 * @returns {{records:object[], badLines:number[]}}
 */
export function parseLedger(text) {
  const records = [];
  const badLines = [];
  String(text)
    .split("\n")
    .forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      try {
        const rec = JSON.parse(trimmed);
        if (!rec || typeof rec !== "object") throw new Error("not an object");
        records.push(rec);
      } catch {
        badLines.push(i + 1);
      }
    });
  return { records, badLines };
}

/** The most recent ledger record, or null. */
export function lastRelease(text) {
  const { records } = parseLedger(text);
  return records.length ? records[records.length - 1] : null;
}

/**
 * A ledger line. Deliberately flat and complete: the whole point of recording
 * a release is being able to answer "what was live before this, and how do we
 * get back there?" without re-reading a shell history.
 */
export function releaseRecord({
  action = "promote",
  sha,
  stamp,
  stagingBase,
  productionBases = [],
  preStamps = {},
  postStamps = {},
  previousSha = null,
  deploymentUrl = null,
  verifiedAt = null,
  verification = null,
}) {
  return {
    at: new Date().toISOString(),
    action,
    sha,
    stamp,
    stagingBase,
    productionBases,
    preStamps,
    postStamps,
    previousSha,
    deploymentUrl,
    verifiedAt,
    verification,
    rollbackCommand: previousSha
      ? `node scripts/promote.mjs --to ${previousSha} --apply`
      : null,
  };
}
