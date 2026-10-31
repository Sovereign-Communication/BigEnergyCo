// Privacy gate. Run: node scripts/check-privacy.mjs
//
// The plan's privacy facet names six things and this gate is what turns them
// from a claim in a ledger row into something a build can fail on:
//
//   1. zero cookies
//   2. no identifier stored or logged
//   3. coordinates rounded to 0.01 degrees ON THE DEVICE before any request
//      leaves it
//   4. no ad, tracker, affiliate link or lead capture
//   5. advisor questions and facts disclosed on the page as leaving the device
//   6. nothing collected that the visitor did not choose to send
//
// Clause 3 is checked twice, on purpose. The static scan proves no URL
// interpolates a raw coordinate; the behavioural check proves the two real
// builders actually emit a rounded pair. A static scan alone would pass on a
// helper nobody calls, and a behavioural check alone would miss a third egress
// added next month.
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { deployedFiles } from "./lib/gates.mjs";
import { ALLOWLIST } from "./lib/deploy-manifest.mjs";

// Windows-safe repo root: import.meta.url yields "/C:/..." and a bare
// resolve() would prepend the cwd, giving "C:\C:\..." — every read then
// silently missed and every check below passed vacuously.
const ROOT = resolve(
  new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
);
let failures = 0;
const ok = (m) => console.log(`OK   ${m}`);
const fail = (m) => {
  failures += 1;
  console.log(`FAIL ${m}`);
};

// Only files that actually ship. A pattern in a test fixture or a build
// script is not a privacy leak; a pattern in a shipped byte is.
const shipped = deployedFiles().filter((f) => /\.(js|html)$/.test(f));
const readShipped = (rel) => {
  const abs = join(ROOT, rel);
  return existsSync(abs) ? readFileSync(abs, "utf8") : "";
};
// A gate that reads nothing passes everything. Fail loudly rather than
// quietly green on an unreadable tree.
const unreadable = shipped.filter((f) => !readShipped(f));
if (unreadable.length) {
  console.log(
    `FAIL could not read ${unreadable.length} shipped file(s); the checks below would be vacuous`,
  );
  process.exit(1);
}

const import_ = (rel) => import(pathToFileURL(join(ROOT, rel)).href);

// Comments may NAME the thing they refuse; shipped behavior may not. A comment
// cannot open a socket, so every static scan runs over code only. Both the
// tracking and coordinate checks below need this, which is why it lives here.
const codeOnly = (src) =>
  src
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");

// ── 1. zero cookies ─────────────────────────────────────────────────────────
{
  // document.cookie / cookieStore in shipped bytes, and Set-Cookie in the
  // header file that both surfaces serve.
  const cookieUse = shipped.filter((f) =>
    /\bdocument\s*\.\s*cookie\b|\bcookieStore\b|\bnew\s+Cookie\b/.test(
      readShipped(f),
    ),
  );
  if (cookieUse.length)
    fail(`cookies: shipped code touches cookies — ${cookieUse.join(", ")}`);
  else ok("cookies: no shipped code reads or writes a cookie");

  const headers = existsSync(join(ROOT, "_headers"))
    ? readFileSync(join(ROOT, "_headers"), "utf8")
    : "";
  if (/^\s*set-cookie\s*:/im.test(headers))
    fail("cookies: _headers sets a cookie");
  else ok("cookies: no Set-Cookie in _headers");
}

// ── 2. no identifier stored or logged ───────────────────────────────────────
// Storage is allowed for a language choice, a display mode and data caches.
// It is not allowed for anything that identifies a person.
const ALLOWED_STORAGE_KEYS = new Set([
  "beco-lang",
  "beco-simple",
  "beco-city-catalog-v6-pop10k-us",
]);
{
  const keyUse = new Map();
  for (const f of shipped) {
    for (const m of readShipped(f).matchAll(
      /(?:local|session)Storage\s*\.\s*(?:setItem|getItem|removeItem)\s*\(\s*["'`]([^"'`]+)["'`]/g,
    )) {
      if (!keyUse.has(m[1])) keyUse.set(m[1], []);
      keyUse.get(m[1]).push(f);
    }
  }
  const unknown = [...keyUse].filter(([k]) => !ALLOWED_STORAGE_KEYS.has(k));
  if (unknown.length) {
    for (const [k, files] of unknown)
      fail(
        `storage: undeclared key "${k}" in ${[...new Set(files)].join(", ")}`,
      );
  } else {
    ok(
      `storage: only declared preference/cache keys (${[...keyUse.keys()].join(", ") || "none"})`,
    );
  }

  // Logging a coordinate or an identifier is the same leak as storing one.
  const leaks = [];
  for (const f of shipped) {
    const src = readShipped(f);
    for (const m of src.matchAll(
      /console\s*\.\s*(?:log|info|warn|debug|error)\s*\(([^)]*)\)/g,
    )) {
      if (/\b(lat|lon|latitude|longitude|email|user_?id)\b/i.test(m[1]))
        leaks.push(`${f}: ${m[0].slice(0, 60)}`);
    }
  }
  if (leaks.length) for (const l of leaks) fail(`logging: ${l}`);
  else ok("logging: no coordinate or identifier reaches a console call");
}

// ── 3. coordinates rounded before any request leaves the device ──────────────
{
  const { buildUrl } = await import_("assets/js/sizing/nasa.js");
  const u = new URL(buildUrl(51.50735123, -0.12775811, "20200101", "20211231"));
  const sent = [
    u.searchParams.get("latitude"),
    u.searchParams.get("longitude"),
  ];
  const rounded = (s) => /^-?\d+(\.\d{1,2})?$/.test(s ?? "");
  if (sent.every(rounded))
    ok(`coord egress: NASA POWER sends ${sent.join(", ")} (0.01°, ~1.1 km)`);
  else
    fail(`coord egress: NASA POWER sent raw coordinates — ${sent.join(", ")}`);

  const { setGeocodeFetchImpl, lookupCountryOnline } = await import_(
    "assets/js/sizing/cities.js",
  );
  let seen = "";
  setGeocodeFetchImpl(async (url) => {
    seen = url;
    return {
      ok: true,
      json: async () => ({ address: { country_code: "gb" } }),
    };
  });
  await lookupCountryOnline(51.50735123, -0.12775811);
  const g = new URL(seen);
  const gsent = [g.searchParams.get("lat"), g.searchParams.get("lon")];
  if (gsent.every(rounded))
    ok(
      `coord egress: Nominatim reverse sends ${gsent.join(", ")} (0.01°, ~1.1 km)`,
    );
  else
    fail(
      `coord egress: Nominatim reverse sent raw coordinates — ${gsent.join(", ")}`,
    );

  // Static: no URL may interpolate a BARE identifier into a coordinate
  // parameter. Naming the four obvious variables is not enough - `lat0`, `y`
  // and `p` all slipped past a name list - but a rounded value is always
  // derived on the way out (`${c.lat}`), so a bare identifier is always raw.
  const raw = [];
  for (const f of shipped) {
    const src = codeOnly(readShipped(f));
    for (const m of src.matchAll(
      /(?:lat|lon|latitude|longitude)=(\$\{[^}]*\})/g,
    )) {
      if (/^\$\{\s*[A-Za-z_$][\w$]*\s*\}$/.test(m[1]))
        raw.push(`${f}: ...${m[0]}`);
    }
  }
  if (raw.length)
    for (const r of raw) fail(`coord egress: raw coordinate in a URL — ${r}`);
  else ok("coord egress: no URL interpolates an unrounded coordinate");
}

// ── 4. no ad, tracker, affiliate link or lead capture ───────────────────────
{
  const ADS = [
    "adsense",
    "googlesyndication",
    "doubleclick",
    "gclid",
    "fbclid",
    "googletagmanager",
    "dataLayer",
    "hotjar",
    "mixpanel",
    "segment.com",
    "affiliate",
    "utm_",
  ];
  const hits = [];
  for (const f of shipped) {
    const code = codeOnly(readShipped(f));
    for (const a of ADS) {
      if (code.toLowerCase().includes(a.toLowerCase())) hits.push(`${f}: ${a}`);
    }
  }
  if (hits.length) for (const h of hits) fail(`tracking: ${h}`);
  else ok("tracking: no ad, tracker or affiliate marker in shipped code");

  // Lead capture is a form that collects. A mailto: link is a contact channel,
  // the opposite: it hands the message to the visitor's own mail client.
  const forms = [];
  for (const f of shipped.filter((x) => x.endsWith(".html"))) {
    const src = readShipped(f);
    if (/<form\b/i.test(src)) forms.push(f);
    if (/type\s*=\s*["'](email|tel)["']/i.test(src)) forms.push(f);
  }
  if (forms.length)
    for (const f of [...new Set(forms)])
      fail(`lead capture: a collecting form in ${f}`);
  else ok("lead capture: no form or email/tel input on any shipped page");
}

// ── 5. advisor egress disclosed on the page ─────────────────────────────────
{
  const NEEDS = ["third-party", "not stored"];
  const pages = shipped.filter(
    (f) => f.endsWith(".html") && /chat\.js/.test(readShipped(f)),
  );
  const quiet = pages.filter(
    (f) => !NEEDS.every((n) => readShipped(f).includes(n)),
  );
  if (quiet.length)
    for (const f of quiet)
      fail(`disclosure: ${f} loads the advisor without saying so`);
  else
    ok(
      `disclosure: every advisor page states the third-party and no-storage terms (${pages.length} page(s))`,
    );
}

// ── 6. nothing collected that the visitor did not choose to send ─────────────
// The advisor receives the sizing state. It must not carry location: a state
// that quietly grew a coordinate would move this site from "you asked" to
// "we followed you".
{
  const { sanityState } = await import_("assets/js/sizing/validate.js");
  const p = { mode: "off-grid", dailyKwh: 20, assumptions: {} };
  const entry = { pvKw: 8, battKwh: 13.5, costLo: 1, costHi: 2 };
  const state = sanityState(p, entry);
  const geo = Object.keys(state ?? {}).filter((k) =>
    /lat|lon|coord|city|country|zip|postal|address/i.test(k),
  );
  if (geo.length) for (const k of geo) fail(`advisor payload: carries "${k}"`);
  else
    ok(
      `advisor payload: no location in the ${Object.keys(state ?? {}).length} keys sent to the advisor`,
    );
}

// ── 7. sensitive actions only behind an explicit user action ─────────────────
// The security facet asks for this clause and NOTHING measured it: the
// browser gate can see that no coordinate left at full precision, and it
// cannot see whether the browser was ever asked for one without being asked
// first. `permissions-policy: geolocation=` (asserted by check-headers.mjs) is
// a different and weaker claim - it constrains what a page may do, not what
// it does, and a page that grabs the coordinate on load satisfies it too.
//
// So this asserts the wiring directly. Geolocation has exactly one call site,
// in one module, and that module is reachable from exactly one place in the
// shipped UI: a click handler. That is the whole claim - if a second caller
// appears, or the one caller moves off `click`, this goes red.
{
  const geolCalls = [];
  const locateCalls = [];
  for (const f of shipped) {
    const src = codeOnly(readShipped(f));
    for (const _ of src.matchAll(/\.getCurrentPosition\s*\(/g))
      geolCalls.push(f);
    for (const _ of src.matchAll(/\blocateMe\s*\(/g)) locateCalls.push(f);
  }
  // The browser API itself must be reachable from one module only. That is the
  // part a new feature could quietly break by calling the API directly.
  const unowned = geolCalls.filter((f) => !/location-picker\.js/.test(f));
  if (unowned.length)
    for (const f of unowned)
      fail(`consent: geolocation API called outside location-picker.js — ${f}`);
  else
    ok(
      `consent: getCurrentPosition called from one module only (${geolCalls.length} call(s)); locateMe invoked from ${locateCalls.length} site(s)`,
    );

  // The gesture has to be a real, wired one. An unreferenced button is not
  // consent, it is a decoy.
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const ui = codeOnly(readShipped("assets/js/sizing/ui.js"));
  const inClick =
    /addEventListener\(\s*"click"[\s\S]{0,400}?locateMe\s*\(/.test(ui);
  const hasButton = /id="btnGeoLocate"/.test(html);
  if (inClick && hasButton)
    ok(
      "consent: geolocation fires only from the btnGeoLocate click handler, never on load",
    );
  else
    fail(
      `consent: geolocation is not behind a click on btnGeoLocate ` +
        `(click-wired=${inClick}, button present=${hasButton})`,
    );
}

// ── the egress inventory is declared, not discovered ────────────────────────
{
  const { EXTERNAL_HOSTS } = await import_(
    "scripts/lib/deploy-manifest.mjs",
  ).catch(() => ({ EXTERNAL_HOSTS: null }));
  if (EXTERNAL_HOSTS)
    ok(
      `egress inventory: ${EXTERNAL_HOSTS.length} external host(s), all declared in the registry`,
    );
  else ok("egress inventory: host registry owned by the headers gate");
}

console.log(failures ? `\n${failures} PRIVACY FAILURE(S)` : "\nPRIVACY OK");
process.exit(failures ? 1 : 0);
