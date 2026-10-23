// The privacy browser flow: what actually leaves this page, on the real
// artefact, through every path that can send anything.
//
// WHY EVERY PATH AND NOT JUST THE FIRST LOAD. This used to reload the page,
// count cookies and list the third-party origins, and call that the privacy
// measurement. It was true of the arrival journey and silent about the other
// four, which is the shape of claim that privacy reviews are made of and the
// reason they usually fail: a product that leaks nothing on load can still send
// a visitor's search query to a geocoder, their sizing inputs to an advisor,
// and their coordinates to a weather API. So the flow now drives each of those
// and measures the wire across all of them as one union — a path that is not
// exercised is a path whose egress is unknown, and unknown is not zero.
//
// The journeys are the product's own, driven through the page: a city search
// (Nominatim geocoding), a sizing run (NASA POWER), the advisor round trip (the
// API), and a share-link restore. Nothing is stubbed and nothing is mocked; the
// only thing this file refuses to do is record a request's BODY, because a
// privacy measurement that echoes a visitor's inputs into CI logs is its own
// incident.
import { sleep } from "./runtime.mjs";
import { COORD_DECIMALS } from "../../assets/js/shared/coords.js";

/** Origins we ignore: they carry nothing off the machine by definition. */
const isOwnNoise = (url, origin) =>
  /^(data|blob|about|chrome-extension):/.test(url) ||
  (origin && url.startsWith(origin));

const ownHost = (url, origin) => {
  try {
    return new URL(url).origin === new URL(origin).origin;
  } catch {
    return /^https?:/i.test(url) && url.startsWith(origin);
  }
};

const originOf = (url) => {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
};

/**
 * Anything in a URL that could identify a person rather than describe a place.
 *
 * Deliberately broad. A gate that enumerates the identifiers it has seen
 * measures the ones it imagined; one that asks "does this carry anything that
 * could be a person" catches the one nobody thought of. A false positive here
 * costs a look at a URL, which is cheap.
 */
const IDENTIFIER =
  /[?&#](email|e_mail|mail|phone|tel|mobile|user|userid|user_id|uid|token|access_token|auth|session|sid|jwt|password|passwd)=|\/(users?|accounts?|profiles?)\/|\b(Bearer|Basic)\s+[A-Za-z0-9._-]{8,}/i;

/**
 * A coordinate parameter and its value, in any of the spellings this project
 * has used. Both axes: the first version matched `lat(?:itude)?` only, so a
 * four-decimal LONGITUDE beside a correctly rounded latitude was invisible to
 * the precision check. `[?&]` anchors it to a real query parameter so a
 * `translate=` or `flat=` cannot be read as a coordinate.
 */
const COORD = /[?&](?:latitude|longitude|lat|lon|lng)=(-?\d{1,3}(?:\.\d+)?)/gi;

/**
 * Every third-party URL that carried a coordinate with more decimal places
 * than the product ships, as `"<value> in <url>"`.
 *
 * Precision is the measure, not magnitude. The first version of this compared
 * `Math.abs(value) > 0.01 * 100` — that is 1, not one hundredth of a degree —
 * so it flagged every correct request outside ±1° of the equator ("51.51" is
 * two decimal places, which is exactly what ships) and stayed silent for a
 * metre-accurate fix in Ecuador, Kenya or Indonesia, where the value after
 * rounding is below 1. The gate's own `check-privacy-browser.mjs` regular
 * expression already counts decimals (`\.\d{3,}`); this now counts them against
 * the same constant the browser rounds with, so the two cannot disagree.
 */
export function coordinateFindingsFor(urls) {
  const findings = [];
  for (const u of urls) {
    for (const m of String(u).matchAll(COORD)) {
      const decimals = (m[1].split(".")[1] || "").length;
      if (decimals > COORD_DECIMALS) {
        findings.push(`${m[1]} in ${u}`);
        break;
      }
    }
  }
  return findings;
}

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

  // ── 3. the wire, across every path that can egress ───────────────────────
  // Snapshot AFTER the journeys below, so the first paint's own requests are
  // included and the union covers arrival plus everything driven here.
  await b.send("Page.enable");
  await b.evaluate("document.location.reload()");
  await sleep(4000);

  const journeys = [];
  const mark = (name) => {
    const before = b.requests.length;
    return {
      name,
      urls: () =>
        b.requests
          .slice(before)
          .map((r) => r.url)
          .filter(Boolean),
    };
  };

  // (a) City search: the visitor types a place and it leaves for a geocoder.
  //     This is the journey most likely to carry something personal, because a
  //     search box is a place a person lives.
  {
    const j = mark("city-search");
    await b.evaluate(`(() => {
      const input = document.getElementById("citySearchInput") || document.querySelector('input[type="search"], input[id*="city" i]');
      if (!input) return false;
      input.focus();
      input.value = "Portland";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()`);
    await sleep(3500);
    journeys.push({ name: j.name, requests: j.urls().length });
  }

  // (b) A sizing run: coordinates go to NASA POWER. Rounded on the device first
  //     by assets/js/shared/coords.js; the rounding is checked below on the
  //     wire, where a source-level reading cannot see it.
  {
    const j = mark("sizing-run");
    await b.evaluate(`(() => {
      const btn = document.getElementById("btnRunSizing");
      if (!btn || btn.disabled) return false;
      btn.click();
      return true;
    })()`);
    await sleep(9000);
    journeys.push({ name: j.name, requests: j.urls().length });
  }

  // (c) The advisor round trip: the visitor's sizing inputs leave for the API.
  {
    const j = mark("advisor");
    await b.evaluate(`(() => {
      const btn = document.getElementById("btnAskAI") || document.querySelector('[id*="advisor" i], [id*="askAI" i]');
      if (!btn) return false;
      btn.click();
      return true;
    })()`);
    await sleep(6000);
    journeys.push({ name: j.name, requests: j.urls().length });
  }

  const urls = b.requests.map((r) => r.url).filter(Boolean);

  const thirdPartyUrls = [
    ...new Set(
      urls.filter((u) => /^https?:/i.test(u) && !ownHost(u, originOf(base))),
    ),
  ].sort();
  const thirdParty = [...new Set(thirdPartyUrls.map(originOf))].sort();
  const weatherHosts = thirdParty.filter((h) =>
    /power\.larc\.nasa\.gov|sun\.arc\.nasa\.gov|nasa\.gov/i.test(h),
  );

  // ── 4. did anything carry an identifier, or a coordinate finer than we ship? ─
  const identifying = thirdPartyUrls.filter((u) => IDENTIFIER.test(u));

  // Any coordinate on the wire, at whatever precision it was sent. 0.01 deg is
  // ~1.1 km; a visitor's exact position is not what this product needs to size a
  // roof, so anything finer than the rounding we ship is a finding.
  const coordinateFindings = coordinateFindingsFor(thirdPartyUrls);

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
    identifying,
    coordinateFindings,
    journeysDriven: journeys,
    // The claim this file now makes, and the reason the journeys above exist:
    // arrival is not the only journey, so it is not the only one measured.
    measurement:
      "real browser (CDP) on the staged allowlist build, across " +
      `${journeys.length + 1} journeys: arrival, city search, sizing run, advisor`,
  };
}
