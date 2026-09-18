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
  baselineSource = null,
  rollbackReason = null,
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
    // Where the way back came from: "ledger" (a release we recorded) or
    // "cloudflare-deployment-history" (what production was actually serving).
    baselineSource,
    deploymentUrl,
    verifiedAt,
    verification,
    rollbackCommand: rollbackCommandFor(previousSha),
    // Never silently blank: if we could not record a way back, say so.
    rollbackUnavailable: previousSha
      ? null
      : (rollbackReason ?? "no baseline recorded"),
  };
}

/** The one command that puts production back where it was. */
export const rollbackCommandFor = (sha) =>
  sha ? `node scripts/promote.mjs --to ${sha} --apply` : null;

/**
 * Correct a record that is already in the ledger.
 *
 * Never a silent edit: the amendment is appended to the record and derived
 * fields are recomputed, so a patched baseline cannot leave a stale or missing
 * rollback command behind.
 */
export function amendRelease(
  record,
  patch,
  { reason, at = new Date().toISOString() } = {},
) {
  const next = { ...record, ...patch };
  if (Object.prototype.hasOwnProperty.call(patch, "previousSha")) {
    next.rollbackCommand = rollbackCommandFor(patch.previousSha);
    next.rollbackUnavailable = patch.previousSha
      ? null
      : (patch.rollbackUnavailable ?? record.rollbackUnavailable ?? null);
  }
  next.amended = [
    ...(Array.isArray(record.amended) ? record.amended : []),
    { at, reason: reason ?? "unspecified", fields: Object.keys(patch) },
  ];
  return next;
}

/** Do two SHAs name the same commit when one may be abbreviated? */
export function sameSha(a, b) {
  if (!a || !b) return false;
  const [long, short] = a.length >= b.length ? [a, b] : [b, a];
  return short.length >= 7 && long.startsWith(short);
}

/**
 * Parse `wrangler pages deployment list --json`.
 *
 * Tolerant of a banner line before the JSON (npx and wrangler both like to
 * print one) but strict about the result: an unparseable history must look
 * like "no history", never like an empty production.
 * @returns {object[]|null}
 */
export function parseDeployments(text) {
  const raw = String(text ?? "");
  const start = raw.indexOf("[");
  if (start < 0) return null;
  let data;
  try {
    data = JSON.parse(raw.slice(start));
  } catch {
    return null;
  }
  if (!Array.isArray(data)) return null;
  return data.map((d) => ({
    id: d.Id ?? d.id ?? null,
    environment: d.Environment ?? d.environment ?? null,
    branch: d.Branch ?? d.branch ?? null,
    source: d.Source ?? d.source ?? null,
    deployment: d.Deployment ?? d.deployment ?? null,
    status: d.Status ?? d.status ?? null,
  }));
}

/**
 * The release to roll back to when this promote lands.
 *
 * The ledger is authoritative when it has an entry. When it does not — the
 * first gated release, which is exactly when a way back matters most — ask what
 * production is serving right now. Deployments come newest-first from
 * wrangler, and the one being promoted is skipped so re-promoting the same
 * commit still names the release before it.
 *
 * @returns {{sha:(string|null), source:(string|null), reason:(string|null)}}
 */
export function rollbackBaseline({
  ledgerText = "",
  deployments = null,
  promotingSha = null,
} = {}) {
  const last = lastRelease(ledgerText);
  if (last?.sha) return { sha: last.sha, source: "ledger", reason: null };

  if (!Array.isArray(deployments))
    return {
      sha: null,
      source: null,
      reason:
        "no earlier release in the ledger, and Cloudflare deployment history was not available",
    };

  const live = deployments.find(
    (d) =>
      String(d.environment || "").toLowerCase() === "production" &&
      d.source &&
      !sameSha(d.source, promotingSha),
  );
  if (!live)
    return {
      sha: null,
      source: null,
      reason:
        "Cloudflare reports no production deployment other than the one being promoted",
    };

  return {
    sha: live.source,
    source: "cloudflare-deployment-history",
    reason: null,
    deployment: live.deployment ?? null,
    deployedAgo: live.status ?? null,
  };
}
