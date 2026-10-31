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
//
// The rewriting walks elements rather than running regexes over markup. Regex
// tag-stripping is incomplete by nature — an unclosed element, a `>` inside an
// attribute — and static analysis correctly treats that shape as sanitization.
// Deciding from an element's own attributes, and only splicing out a balanced
// element, is both correct and quiet about it.
import { attr } from "./gates.mjs";
import { normalizeText } from "./stamps.mjs";

/** The edge's protected-link prefix. */
const CF_EMAIL_PREFIX = "/cdn-cgi/l/email-protection#";

/** Where the edge keeps the decoder it injects. */
const CF_SCRIPT_PREFIX = "/cdn-cgi/scripts/";

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

/** Is `at` the start of a `<name` tag rather than `<namex`? */
const isTagStart = (lower, at, name) => {
  const next = lower[at + 1 + name.length];
  return next === undefined || /[\s/>]/.test(next);
};

/**
 * Replace every `<name>…</name>` element for which `decide` returns a string,
 * leaving everything else — including anything it does not understand — alone.
 * An element without a closing tag is skipped rather than guessed at, so a
 * truncated document fails the comparison instead of being silently shortened.
 */
function rewriteElements(source, name, decide) {
  const lower = source.toLowerCase();
  const openToken = `<${name}`;
  let out = "";
  let i = 0;

  while (i < source.length) {
    const at = lower.indexOf(openToken, i);
    if (at < 0 || !isTagStart(lower, at, name)) {
      if (at < 0) {
        out += source.slice(i);
        break;
      }
      out += source.slice(i, at + 1);
      i = at + 1;
      continue;
    }

    const gt = source.indexOf(">", at);
    if (gt < 0) {
      out += source.slice(i); // unterminated tag: change nothing
      break;
    }
    const openTag = source.slice(at, gt + 1);
    let end = gt + 1;
    if (!/\/\s*>$/.test(openTag)) {
      const close = lower.indexOf(`</${name}`, end);
      const closeGt = close < 0 ? -1 : source.indexOf(">", close);
      if (closeGt < 0) {
        out += source.slice(i, at + 1); // no closing tag: leave it to fail
        i = at + 1;
        continue;
      }
      end = closeGt + 1;
    }

    const replacement = decide(openTag);
    out +=
      source.slice(i, at) +
      (typeof replacement === "string" ? replacement : source.slice(at, end));
    i = end;
  }

  return out;
}

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

  // The decoder the zone injects. Decided by the element's own src, so the
  // application's own <script> tags can never be caught by this.
  let text = rewriteElements(source, "script", (openTag) => {
    const src = attr(openTag, "src");
    if (!src || !src.startsWith(CF_SCRIPT_PREFIX)) return null;
    tolerated.add("injected email-decode script");
    return "";
  });

  text = rewriteElements(text, "a", (openTag) => {
    const href = attr(openTag, "href");
    if (!href) return null;
    if (href.startsWith(CF_EMAIL_PREFIX)) {
      const decoded = decodeCloudflareEmail(href.slice(CF_EMAIL_PREFIX.length));
      // Undecodable: leave it alone so it fails the comparison, which is the
      // right outcome when we do not understand what the edge did.
      if (!decoded) return null;
      tolerated.add("obfuscated mailto link");
      return emailToken(hrefFor(decoded));
    }
    // Our own side of the same anchor. Not a platform rewrite, so not reported
    // — it exists so that both sides meet in one form.
    if (/^mailto:/i.test(href))
      return emailToken(href.replace(/^mailto:/i, "mailto:"));
    return null;
  });

  return { text, tolerated: [...tolerated] };
}
