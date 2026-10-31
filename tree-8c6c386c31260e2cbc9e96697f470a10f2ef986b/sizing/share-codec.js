// Share-link codec — the pure half of shareable results.
//
// Policy lives here: what a share link is (#s= + base64url JSON), how it
// encodes/decodes, and the validation gate every incoming link must pass
// before it is allowed to touch the form. Mechanics stay in ui.js (writing
// inputs, re-rendering), so a malformed or hostile link is refused here
// before any DOM state moves. Extracted from ui.js per docs/ARCHITECTURE.md.

export const SHARE_PREFIX = "#s=";

export function b64urlEncode(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/**
 * Parse + validate an incoming share hash. Returns the decoded state with
 * numeric la/lo/kw, or null for anything malformed or out of bounds
 * (version must be 1; |la| <= 90; |lo| <= 180; 0.5 <= kw <= 500).
 */
export function parseShareHash(hash) {
  if (typeof hash !== "string" || !hash.startsWith(SHARE_PREFIX)) return null;
  let o;
  try {
    o = b64urlDecode(hash.slice(SHARE_PREFIX.length));
  } catch {
    return null;
  }
  if (!o || typeof o !== "object" || Array.isArray(o) || o.v !== 1) return null;
  const la = parseFloat(o.la);
  const lo = parseFloat(o.lo);
  const kw = parseFloat(o.kw);
  if (
    !Number.isFinite(la) ||
    !Number.isFinite(lo) ||
    !Number.isFinite(kw) ||
    Math.abs(la) > 90 ||
    Math.abs(lo) > 180 ||
    kw < 0.5 ||
    kw > 500
  )
    return null;
  return { ...o, la, lo, kw };
}
