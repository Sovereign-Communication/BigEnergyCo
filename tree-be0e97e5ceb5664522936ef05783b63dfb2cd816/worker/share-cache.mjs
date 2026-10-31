// KV edge cache for share-link payloads (showcase branch).
//
// Share links today are `#s=` + base64url JSON — fully client-side, which is
// great for privacy but makes long payloads unwieldy and unmeasurable. This
// module stores the validated payload in KV under a short id so a share can
// be `?share=<id>`: the payload lives at the edge, close to whoever opens it.
//
// Privacy: the payload is exactly what the share codec already puts in the
// URL hash (site coordinates, system size — no names, emails, or accounts).
// Nothing new is collected. TTL is short (7 days); KV is a cache, not a
// database of record.
//
// The validation rules are NOT duplicated here: parseShareHash from the
// canonical share codec (assets/js/sizing/share-codec.js) is the single
// owner. A payload that fails the codec never reaches KV.

import {
  parseShareHash,
  b64urlEncode,
  SHARE_PREFIX,
} from "../assets/js/sizing/share-codec.js";

// Short enough for a chat message, unguessable enough to not enumerate.
export const SHARE_TTL_SECONDS = 7 * 24 * 3600;

const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const ID_LENGTH = 12;

// 256 % 36 leaves residues 0-3 reachable by 8 byte values and the other 32
// residues by only 7, so mapping a raw byte with `b % 36` makes '0'-'3' about
// 14% more likely than every other symbol. The first four symbols are exactly
// the ones an attacker would try. Rejecting the 4 unusable values removes the
// bias entirely and costs nothing: 252/256 of draws are kept.
const REJECT_FROM = 252;

/**
 * A 12-character share id, uniform over the alphabet.
 *
 * `fill` is a test seam: a function that fills the given byte array.
 * Production passes crypto.getRandomValues. Draws are rejected and retaken
 * rather than folded, so a seam that always returns >= REJECT_FROM loops
 * forever — which is the correct behaviour for a source that cannot produce a
 * fair symbol, and is the reason this is a loop and not a fold.
 */
export function makeShareId(fill = (bytes) => crypto.getRandomValues(bytes)) {
  const byte = new Uint8Array(1);
  let id = "";
  while (id.length < ID_LENGTH) {
    fill(byte);
    if (byte[0] >= REJECT_FROM) continue; // biased residue; draw again
    id += ID_ALPHABET[byte[0] % 36];
  }
  return id;
}

export function isValidShareId(id) {
  return (
    typeof id === "string" && id.length === 12 && /^[0-9a-z]{12}$/.test(id)
  );
}

function kvKey(id) {
  return `share:${id}`;
}

/**
 * Validate a `#s=...` hash with the canonical codec and store the decoded
 * payload in KV. Returns { ok: true, id } or { ok: false, reason }.
 * reason: "invalid_payload" | "kv_unavailable"
 */
export async function storeSharePayload(kv, shareHash, fill = null) {
  const parsed = parseShareHash(shareHash);
  if (!parsed) return { ok: false, reason: "invalid_payload" };
  if (!kv || typeof kv.put !== "function") {
    return { ok: false, reason: "kv_unavailable" };
  }
  const id = makeShareId(fill || undefined);
  await kv.put(kvKey(id), JSON.stringify(parsed), {
    expirationTtl: SHARE_TTL_SECONDS,
  });
  return { ok: true, id };
}

/**
 * Fetch a cached share payload. Returns { ok: true, payload } or
 * { ok: false, reason }: "invalid_id" | "not_found" | "kv_unavailable".
 * The payload is re-validated on the way out: a cache entry that no longer
 * passes the codec is treated as not found, so codec tightening can never
 * resurrect a stale permissive entry.
 */
export async function getSharePayload(kv, id) {
  if (!isValidShareId(id)) return { ok: false, reason: "invalid_id" };
  if (!kv || typeof kv.get !== "function") {
    return { ok: false, reason: "kv_unavailable" };
  }
  const raw = await kv.get(kvKey(id));
  if (!raw) return { ok: false, reason: "not_found" };
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "not_found" };
  }
  // Re-derive a hash from the stored payload and run it through the codec:
  // this guarantees the stored object still satisfies the current rules.
  const recheck = parseShareHash(SHARE_PREFIX + b64urlEncode(payload));
  if (!recheck) return { ok: false, reason: "not_found" };
  return { ok: true, payload: recheck };
}
