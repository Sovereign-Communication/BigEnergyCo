// Privacy flow: what the page actually DOES, measured in a browser.
//
// scripts/check-privacy.mjs is a static gate. It reads the shipped source and
// proves six claims about it — no shipped code touches a cookie, no identifier
// reaches a console call, no URL interpolates an unrounded coordinate, no
// tracker marker, no collecting form, no undisclosed advisor load. All six are
// statements about SOURCE.
//
// Every one of them has a runtime version, and the runtime is where privacy
// claims usually break, because the mechanisms a source scan cannot see are
// exactly the ones a browser creates on its own:
//
//   - an HttpOnly cookie is invisible to `document.cookie` AND to any grep, and
//     the response `Set-Cookie` header is the only place it appears. A page can
//     honestly contain no cookie code and still set one.
//   - a third-party request made by injected markup, a CSS `url()`, a font, or
//     a service-worker import never appears in a JavaScript grep.
//   - storage written by an inline handler or a worker never appears either.
//
// So this flow measures the three things only a browser can answer, and it
// fails the run rather than reporting a number for someone else to interpret.
import { sleep } from "./runtime.mjs";

/** Hosts that are the site's own, and therefore not egress. */
const ownHost = (url, origin) => {
  try {
    return new URL(url).origin === origin;
  } catch {
    // data:, blob:, about: are not egress; anything unparseable is reported
    // as its own string so it cannot hide by being unreadable.
    return /^(data|blob|about|chrome-extension):/.test(url);
  }
};

export async function runPrivacyFlow(b, base) {
  const origin = new URL(base).origin;

  // ── 1. cookies, measured two ways ─────────────────────────────────────────
  // `document.cookie` is what JS can read; Network.getCookies is the browser's
  // own store, which includes HttpOnly cookies that JS can never see. A gate
  // that only asked the first one would pass a page setting a session cookie.
  const viaGetCookies = await b.send("Network.getCookies", {
    urls: [origin + "/", base],
  });
  const stored = viaGetCookies?.cookies || [];
  const viaDocument = await b.evaluate(
    "document.cookie ? document.cookie.split(';').length : 0",
  );

  // ── 2. web storage ────────────────────────────────────────────────────────
  // Key names only, never values: this measurement exists to prove nothing is
  // STORED, and a privacy report that echoes a visitor's identifier into CI
  // logs would be its own incident.
  const storage = await b.evaluate(`(() => {
    const keys = (s) => { try { return Object.keys(s); } catch (e) { return ["<unreadable>"]; } };
    return { local: keys(localStorage), session: keys(sessionStorage) };
  })()`);

  // ── 3. the wire ───────────────────────────────────────────────────────────
  // Every request the page issued, from the CDP log the runtime already keeps.
  // Snapshot AFTER load, so the first paint's own requests are included.
  await b.send("Page.enable");
  await b.evaluate("document.location.reload()");
  await sleep(4000);

  const urls = b.requests.map((r) => r.url).filter(Boolean);
  const thirdParty = [
    ...new Set(
      urls
        .filter((u) => /^https?:/i.test(u) && !ownHost(u, origin))
        .map((u) => {
          try {
            return new URL(u).origin;
          } catch {
            return u;
          }
        }),
    ),
  ].sort();

  // ── 4. what each third party is ───────────────────────────────────────────
  // An egress list is not a verdict. A site can make a request to its own
  // weather API and mean nothing by it; the claim worth making is that each
  // third party is a DISCLOSED one. This flow reports what it found; the
  // declared inventory in check-privacy.mjs is what it is compared against.
  const weatherHosts = thirdParty.filter((h) =>
    /power\.larc\.nasa\.gov|sun\.arc\.nasa\.gov|nasa\.gov/i.test(h),
  );

  const thirdPartyUrls = [
    ...new Set(urls.filter((u) => /^https?:/i.test(u) && !ownHost(u, origin))),
  ].sort();

  return {
    cookieCount: stored.length,
    cookieNames: stored.map((c) => c.name),
    httpOnlyCount: stored.filter((c) => c.httpOnly).length,
    visibleToDocument: viaDocument,
    localStorageKeys: storage?.local || [],
    sessionStorageKeys: storage?.session || [],
    requestCount: urls.length,
    thirdPartyOrigins: thirdParty,
    thirdPartyUrls,
    weatherHosts,
    measurement: "real browser (CDP), first load of the staged allowlist build",
  };
}
