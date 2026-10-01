// Cloudflare Web Analytics beacon loader (showcase branch).
//
// Privacy-first analytics: Cloudflare Web Analytics sets no cookies and
// collects no personal data, which fits a permanently-free public tool.
// The beacon only loads when a REAL token is configured; the placeholder
// below is never sent to the network. Where the real token goes is
// documented in docs/cloudflare-showcase.md (Pages environment variable
// injected at build, or a <meta> tag on the showcase Pages project).
//
// Usage (after provisioning):
//   <meta name="cf-beacon-token" content="<real token>">
//   <script src="/assets/js/cf-beacon.js" defer></script>

export const BEACON_SRC = "https://static.cloudflareinsights.com/beacon.min.js";
export const PLACEHOLDER_TOKEN = "REPLACE_WITH_CLOUDFLARE_WEB_ANALYTICS_TOKEN";

export function resolveBeaconToken(
  doc = typeof document !== "undefined" ? document : null,
) {
  if (!doc) return null;
  const fromWindow =
    typeof window !== "undefined" ? window.BEC_CF_BEACON_TOKEN : null;
  const fromMeta = doc
    .querySelector('meta[name="cf-beacon-token"]')
    ?.getAttribute("content");
  const token = (fromWindow || fromMeta || "").trim();
  if (!token || token === PLACEHOLDER_TOKEN) return null;
  // Tokens are 32-char hex; refuse anything else rather than beaconing junk.
  if (!/^[0-9a-f]{32}$/i.test(token)) return null;
  return token;
}

export function injectBeacon(doc, token) {
  const script = doc.createElement("script");
  script.defer = true;
  script.src = BEACON_SRC;
  script.setAttribute("data-cf-beacon", JSON.stringify({ token }));
  doc.head.appendChild(script);
  return script;
}

// Auto-run only in a real browser document. Importing this module never
// beacons by itself in tests: resolveBeaconToken returns null without a
// configured token and nothing is injected.
if (typeof document !== "undefined") {
  const token = resolveBeaconToken(document);
  if (token) injectBeacon(document, token);
}
