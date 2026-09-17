// Base-URL normalization for the browser smoke harness.
//
// Split out of scripts/browser-smoke.mjs, which launches Chrome the moment it
// is imported — so this had to move to be unit-testable.
//
// BASE must always end in "/": sub-pages are built as `${BASE}solar-heatmap/`,
// so a slash-less argument like `https://example.com` would otherwise produce
// the invalid host `example.comsolar-heatmap` (a Chrome error page, which then
// surfaces as false heatmap gate failures). A path-bearing base such as
// `https://host/mirror` needs the slash for the same reason.
export function normalizeBase(raw) {
  try {
    const url = new URL(raw);
    const path = url.pathname.endsWith("/") ? url.pathname : url.pathname + "/";
    return url.origin + path;
  } catch {
    return raw.endsWith("/") ? raw : raw + "/";
  }
}
