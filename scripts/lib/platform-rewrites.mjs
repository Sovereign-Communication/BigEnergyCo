// Edge-level HTML rewrites that happen to the response, not to our artifact.
//
// Why this exists: Cloudflare's Email Address Obfuscation rewrites every
// `mailto:` anchor in HTML and injects its decoder script. The brand domain is
// proxied, so that rewrite makes byte parity fail forever — 82 HTML files
// "differing" for a deployment that is 348/348 byte-identical on
// bigenergyco.pages.dev, which is the SAME artifact. A verification gate that
// can never pass on the surface it exists to check is worthless.
//
// The answer is not to stop comparing HTML, and not to compare less: it is to
// bring both sides into one canonical form that undoes exactly the rewrite we
// have observed, and to keep failing on every other byte. An unexpected
// platform transform therefore still fails, loudly, because nothing here
// tolerates it.
//
// The observed transform (freeoffgridcalculator.com, 2026-09-18) is recorded
// verbatim in tests/platform-rewrites.test.mjs so this cannot drift into
// tolerance of things we never saw.
import { normalizeText } from "./stamps.mjs";

/** The decoder the zone injects before the first module script. */
const CF_EMAIL_SCRIPT =
  /<script\b[^>]*\bsrc="\/cdn-cgi\/scripts\/[^"]*"[^>]*><\/script>/gi;

/** A rewritten anchor: `href="/cdn-cgi/l/email-protection#<payload>"`. */
const CF_EMAIL_ANCHOR =
  /<a\b[^>]*\bhref="\/cdn-cgi\/l\/email-protection#([0-9a-f]+)"[^>]*>[\s\S]*?<\/a\s*>/gi;

/** The same anchor as it exists in our own markup. */
const PLAIN_MAILTO_ANCHOR =
  /<a\b[^>]*\bhref="(mailto:[^"]*)"[^>]*>[\s\S]*?<\/a\s*>/gi;

/**
 * Decode a Cloudflare email payload: the first byte is a key, each remaining
 * byte is the character XORed with it.
 *
 * Returns null when the payload is not a plausible address, so a decode that
 * "succeeds" by accident cannot quietly excuse a real difference.
 * @returns {string|null}
 */
export function decodeCloudflareEmail(payload) {
  const hex = String(payload ?? "").trim();
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length < 4 || hex.length % 2)
    return null;
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2)
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  const key = bytes[0];
  const text = Buffer.from(bytes.slice(1).map((b) => b ^ key)).toString("utf8");
  // Printable ASCII that contains an @ and no whitespace: an email address, or
  // a full URL. Anything else is not something we know how to canonicalise.
  if (!/^[\x21-\x7e]+$/.test(text) || !text.includes("@")) return null;
  return text;
}

const hrefFor = (decoded) =>
  /^[a-z][a-z0-9+.-]*:/i.test(decoded) ? decoded : `mailto:${decoded}`;

/**
 * One deterministic token for "an email link to this address", so a rewritten
 * anchor in the response and a plain anchor in the checkout canonicalise to the
 * same bytes. The address is still part of the comparison: change it on either
 * side and the two hashes diverge.
 */
const emailToken = (href) => `<<email-link:${href}>>`;

/**
 * Canonicalise a document for the given surface.
 *
 * On a surface that does not rewrite HTML the text is returned with only
 * line-ending normalisation, so nothing extra is tolerated.
 *
 * @returns {{text:string, tolerated:string[]}} tolerated lists the platform
 *   rewrites that were undone here — reported, never hidden.
 */
export function canonicalizeHtml(html, surface) {
  const source = normalizeText(html);
  if (surface !== "cloudflare") return { text: source, tolerated: [] };

  const tolerated = new Set();
  let text = source;

  text = text.replace(CF_EMAIL_SCRIPT, () => {
    tolerated.add("injected email-decode script");
    return "";
  });
  text = text.replace(CF_EMAIL_ANCHOR, (match, payload) => {
    const decoded = decodeCloudflareEmail(payload);
    // Leave an undecodable payload alone: it will fail the comparison, which is
    // the correct outcome when we do not understand what the edge did.
    if (!decoded) return match;
    tolerated.add("obfuscated mailto link");
    return emailToken(hrefFor(decoded));
  });
  // Our own side of the same anchor. Not a platform rewrite, so not reported —
  // it exists so that both sides meet in one form.
  text = text.replace(PLAIN_MAILTO_ANCHOR, (match, href) =>
    emailToken(href.replace(/^mailto:/i, "mailto:")),
  );

  return { text, tolerated: [...tolerated] };
}
