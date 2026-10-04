// R2 upload path for quality-evidence artifacts (showcase branch).
//
// The repo's quality story (Lighthouse/axe reports, Jev evidence bundles)
// currently lives as files committed to the repo. For the showcase, finished
// reports are pushed to R2 — the same object storage Cloudflare pitches —
// via the S3-compatible binding, so evidence has a durable home outside git.
//
// Safety: content-type allowlist, hard size cap, and key sanitization happen
// here, before any byte reaches the bucket. Keys are namespaced by report
// kind; nothing here lists or deletes.

export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_CONTENT_TYPES = new Set([
  "application/json",
  "text/html",
  "text/csv",
]);

const EVIDENCE_KINDS = new Set(["lighthouse", "axe", "jev", "smoke"]);

export function evidenceKey(kind, name) {
  // name: caller-supplied run label, e.g. "2026-09-28T120000Z".
  if (!EVIDENCE_KINDS.has(kind)) return null;
  if (
    typeof name !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name)
  ) {
    return null;
  }
  const ext = kind === "axe" || kind === "lighthouse" ? "json" : "json";
  return `evidence/${kind}/${name}.${ext}`;
}

/**
 * Validate + store an evidence artifact. Returns { ok: true, key } or
 * { ok: false, reason }: "invalid_kind" | "invalid_name" |
 * "invalid_content_type" | "too_large" | "r2_unavailable".
 */
export async function putEvidence(bucket, kind, name, body, contentType) {
  const key = evidenceKey(kind, name);
  if (!key) {
    return {
      ok: false,
      reason: EVIDENCE_KINDS.has(kind) ? "invalid_name" : "invalid_kind",
    };
  }
  const ct = (contentType || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.has(ct)) {
    return { ok: false, reason: "invalid_content_type" };
  }
  const bytes =
    typeof body === "string" ? new TextEncoder().encode(body) : body;
  // `body` is whatever JSON carried. A number, an object or an array has no
  // `.byteLength`, and `undefined > LIMIT` is false — so the size check passed
  // a value it could not measure, and `bucket.put` then threw a TypeError that
  // escaped the handler as a 500 with no CORS headers. Anything that is not a
  // string (or bytes) is a client error, named as one.
  if (
    typeof bytes !== "string" &&
    !(bytes instanceof Uint8Array) &&
    !(bytes instanceof ArrayBuffer)
  ) {
    return { ok: false, reason: "invalid_body" };
  }
  const size = typeof bytes === "string" ? bytes.length : bytes.byteLength;
  if (!Number.isFinite(size)) {
    return { ok: false, reason: "invalid_body" };
  }
  if (size > EVIDENCE_MAX_BYTES) {
    return { ok: false, reason: "too_large" };
  }
  if (!bucket || typeof bucket.put !== "function") {
    return { ok: false, reason: "r2_unavailable" };
  }
  await bucket.put(key, bytes, { httpMetadata: { contentType: ct } });
  return { ok: true, key };
}
