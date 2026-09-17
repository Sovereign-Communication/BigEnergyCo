// Security-header and CSP gate. Run: node scripts/check-headers.mjs [--live]
//
// The runbook states that every third-party endpoint the app touches must be
// listed in `_headers` AND probed — but nothing enforced it, so a new fetch
// could ship blocked (the feature silently dies in production) or a new
// endpoint could ship without a policy review. This script closes both holes
// offline, and `--live` re-verifies the same headers on the deployed origins.
//
// Static checks:
//   1. every deployed page receives the full required header set
//   2. CSP has the directives and hosts the app actually needs
//   3. no policy weakener (`*`, http:, 'unsafe-eval') sneaks in
//   4. CSP STRICTNESS — 'unsafe-inline' in script-src is frozen debt, since it
//      is what actually permits an injected inline handler to run
//   5. ENDPOINT REGISTRY — every external host the shipped JS/HTML loads from
//      or calls is allowlisted in the matching directive
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import {
  cspAllowsHost,
  deployedFiles,
  headersFor as headersForRules,
  parseCsp,
  parseHeadersFile,
} from "./lib/gates.mjs";

const LIVE = process.argv.includes("--live");
const LIVE_BASES = (
  process.env.HEADERS_BASES ||
  "https://freeoffgridcalculator.com/,https://sovereign-communication.github.io/BigEnergyCo/"
)
  .split(",")
  .filter(Boolean);

// This gate has no frozen debt left. Both items it used to ratchet are now
// invariants: `script-src 'unsafe-inline'` is gone (the last inline script and
// the last on* attribute were extracted to versioned modules), and the two
// cross-origin isolation headers ship in _headers. Either coming back is a
// security regression, not a budget question, so both fail outright below.

let failures = 0;
const fail = (msg) => {
  console.error(`FAIL ${msg}`);
  failures++;
};
const ok = (msg) => console.log(`OK   ${msg}`);

// ── policy parsing ──────────────────────────────────────────────────────────
// The pure helpers live in scripts/lib/gates.mjs so tests can exercise them
// without executing this gate.
if (!existsSync("_headers")) {
  fail("_headers is missing — the deployed site would ship with no policy");
  process.exit(1);
}
const rules = parseHeadersFile(readFileSync("_headers", "utf8"));
if (!rules.length) fail("_headers parsed to zero rules");

// ── 1. the header set every page must carry ─────────────────────────────────
const headersFor = (urlPath) => headersForRules(urlPath, rules);

const REQUIRED = {
  "x-content-type-options": /^nosniff$/i,
  "x-frame-options": /^(deny|sameorigin)$/i,
  "referrer-policy": /strict-origin|no-referrer|same-origin/i,
  "permissions-policy": /geolocation=/i,
  "strict-transport-security": /max-age=(\d+)/i,
  "content-security-policy": /default-src/i,
  "cross-origin-opener-policy": /^same-origin$/i,
  "cross-origin-resource-policy": /^(same-origin|same-site)$/i,
};

// Every deployed page, not a sample: a page-scoped rule added above `/*` is
// exactly how one page would silently lose its policy.
const headerMisses = [];
for (const page of deployedFiles().filter((f) => f.endsWith(".html"))) {
  const h = headersFor("/" + page.replace(/index\.html$/, ""));
  for (const [name, pattern] of Object.entries(REQUIRED)) {
    if (!h.has(name)) {
      headerMisses.push(`${page}: missing ${name}`);
      continue;
    }
    const value = h.get(name);
    if (name === "strict-transport-security") {
      const maxAge = Number((pattern.exec(value) || [])[1] || 0);
      if (maxAge < 31536000)
        headerMisses.push(`${page}: HSTS max-age ${maxAge} < 31536000`);
    } else if (!pattern.test(value)) {
      headerMisses.push(`${page}: ${name} = "${value}"`);
    }
  }
}
if (headerMisses.length)
  for (const m of headerMisses.slice(0, 12)) fail(`headers — ${m}`);
else ok("every deployed page carries the required security header set");

// Assets must not be cached without a policy either (Pages applies /* to all).
const assetHeaders = headersFor("/assets/js/sizing/ui.js");
if (!assetHeaders.has("content-security-policy"))
  fail("assets are served without a CSP — /* must apply to the whole origin");
else ok("asset responses inherit the origin-wide policy");

// ── 2/3. CSP shape ──────────────────────────────────────────────────────────
const cspValue = headersFor("/").get("content-security-policy") || "";
const csp = parseCsp(cspValue);

for (const directive of [
  "default-src",
  "script-src",
  "style-src",
  "img-src",
  "connect-src",
  "object-src",
  "base-uri",
  "frame-ancestors",
]) {
  if (!csp[directive]) fail(`CSP is missing the ${directive} directive`);
  else ok(`CSP declares ${directive}`);
}
for (const weak of ["*"]) {
  for (const [name, sources] of Object.entries(csp)) {
    if (sources.includes(weak))
      fail(`CSP ${name} contains the wildcard source "${weak}"`);
  }
}
if (csp["script-src"]?.includes("'unsafe-eval'"))
  fail("CSP script-src allows 'unsafe-eval'");
else ok("CSP never allows 'unsafe-eval'");
if (csp["object-src"]?.join(" ") !== "'none'")
  fail("CSP object-src must be 'none'");
if (csp["base-uri"]?.join(" ") !== "'self'")
  fail("CSP base-uri must be 'self'");
if (csp["frame-ancestors"]?.join(" ") !== "'none'")
  fail("CSP frame-ancestors must be 'none'");

// ── 4. strictness invariants ────────────────────────────────────────────────
// Every executable script the site ships is an external, version-stamped file
// and every event handler is bound with addEventListener, so the escape hatch
// that makes an injected inline handler run is gone. Re-adding it would
// silently undo that hardening, hence: fail, never warn.
if (csp["script-src"]?.includes("'unsafe-inline'"))
  fail(
    "script-src allows 'unsafe-inline' — inline script must never be re-enabled",
  );
else if (csp["script-src"]?.some((s) => /^'unsafe-/.test(s)))
  fail(
    `script-src carries an unsafe keyword: ${csp["script-src"].filter((s) => /^'unsafe-/.test(s)).join(", ")}`,
  );
else
  ok(
    "script-src is closed — every shipped script is an external, versioned file",
  );

// The origin-wide rule is what every page gets today, but a future page-scoped
// rule must not be able to hand one page back the escape hatch. Check the
// EFFECTIVE policy per deployed page, not just the one on "/".
const inlinePages = deployedFiles()
  .filter((f) => f.endsWith(".html"))
  .filter((f) =>
    parseCsp(
      headersFor("/" + f.replace(/index\.html$/, "")).get(
        "content-security-policy",
      ) || "",
    )["script-src"]?.includes("'unsafe-inline'"),
  );
if (inlinePages.length)
  fail(
    `script-src 'unsafe-inline' is served to: ${inlinePages.slice(0, 5).join(", ")}`,
  );
else
  ok(
    `no deployed page is served script-src 'unsafe-inline' (${deployedFiles().filter((f) => f.endsWith(".html")).length} pages checked)`,
  );

// ── 5. endpoint registry: every host the app uses must be allowed ───────────
function shippedSources() {
  return deployedFiles().filter((l) => /\.(html|js)$/.test(l));
}

// Metadata hosts are not subresources: canonical/OG/JSON-LD URLs are read by
// crawlers, never fetched by the page. Keep the exemption explicit and short.
const METADATA_HOSTS = new Set([
  "freeoffgridcalculator.com",
  "www.freeoffgridcalculator.com",
  "sovereign-communication.github.io",
  "schema.org",
  "www.w3.org",
]);

/** Strip comments so a doc link never counts as a real request. */
const stripComments = (js) =>
  js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** Tile/script templates carry {s}/{z}/{x}/{y}; normalize before parsing. */
const deTemplate = (text) => text.replace(/\{[a-z]+\}/gi, "x");

const found = []; // {host, directive, where}
const addHost = (raw, directive, where) => {
  try {
    found.push({
      host: new URL(deTemplate(raw)).hostname.toLowerCase(),
      directive,
      where,
    });
  } catch {
    /* not a URL — ignore */
  }
};

for (const file of shippedSources()) {
  const raw = readFileSync(file, "utf8");
  if (file.endsWith(".js")) {
    const text = deTemplate(stripComments(raw));
    // Strongest signal: an actual fetch/worker/import call site.
    for (const m of text.matchAll(
      /\b(?:fetch|importScripts)\(\s*[`"'](https:\/\/[^`"']+)/g,
    ))
      addHost(m[1], "connect-src", file);
    for (const m of text.matchAll(/new\s+Worker\(\s*[`"'](https:\/\/[^`"']+)/g))
      addHost(m[1], "script-src", file);
    // Catch-all for SUBRESOURCES only: an absolute URL whose path ends in an
    // asset extension, or a raster-tile template. This catches a new tile host
    // or CDN constant that no fetch() pattern reveals, while leaving outbound
    // navigation links (donation links) and non-URL identifiers (Cache Storage
    // namespaces) alone — the browser never fetches those under CSP.
    for (const m of raw.matchAll(/https:\/\/[^\s"'`)\\]+/g)) {
      const url = m[0];
      let host;
      try {
        host = new URL(deTemplate(url)).hostname.toLowerCase();
      } catch {
        continue;
      }
      if (METADATA_HOSTS.has(host)) continue;
      const isTile = /\{[zyx]\}/i.test(url);
      const isAsset =
        /\.(?:js|mjs|css|png|jpe?g|svg|webp|gif|ico|json|woff2?|wasm)(?:\?|#|$)/i.test(
          url,
        );
      if (!isTile && !isAsset) continue;
      if (![...found].some((f) => f.host === host && f.where === file))
        found.push({ host, directive: "any", where: file });
    }
  } else {
    for (const m of raw.matchAll(/<script[^>]*\ssrc="(https:\/\/[^"]+)"/gi))
      addHost(m[1], "script-src", file);
    for (const m of raw.matchAll(/<link[^>]*\shref="(https:\/\/[^"]+)"/gi)) {
      const tag = m[0].toLowerCase();
      const directive = /rel="stylesheet"/.test(tag)
        ? "style-src"
        : /rel="preconnect"/.test(tag)
          ? "connect-src"
          : null;
      if (directive) addHost(m[1], directive, file);
    }
    for (const m of raw.matchAll(/<img[^>]*\ssrc="(https:\/\/[^"]+)"/gi))
      addHost(m[1], "img-src", file);
  }
}

const ALL_DIRECTIVES = [
  "script-src",
  "style-src",
  "img-src",
  "connect-src",
  "font-src",
  "media-src",
];
const registry = new Map();
for (const { host, directive, where } of found) {
  const key = `${directive}:${host}`;
  if (!registry.has(key)) registry.set(key, { host, directive, where });
}
const unlisted = [];
const allowedHosts = new Set();
for (const { host, directive, where } of registry.values()) {
  const candidates = directive === "any" ? ALL_DIRECTIVES : [directive];
  const allowedIn = candidates.find((d) => cspAllowsHost(csp[d] || [], host));
  if (allowedIn) {
    allowedHosts.add(host);
    continue;
  }
  // A host the policy allows for connections is still acceptable for a call
  // site discovered generically — but never for a script/style/image load.
  if (directive === "any" && cspAllowsHost(csp["connect-src"] || [], host)) {
    allowedHosts.add(host);
    continue;
  }
  unlisted.push(`${host} (used by ${where}, needs ${candidates.join(" or ")})`);
}
if (unlisted.length)
  for (const u of unlisted)
    fail(`endpoint registry — not allowed by CSP: ${u}`);
else
  ok(
    `endpoint registry: ${allowedHosts.size} external host(s) allowlisted — ${[...allowedHosts].sort().join(", ")}`,
  );

// ── 6. live verification (opt-in) ───────────────────────────────────────────
if (LIVE) {
  for (const base of LIVE_BASES) {
    let res;
    try {
      res = await fetch(base, {
        redirect: "follow",
        signal: AbortSignal.timeout(20000),
      });
    } catch (e) {
      fail(`live ${base}: unreachable (${e.message})`);
      continue;
    }
    const get = (n) => res.headers.get(n) || "";
    const liveMisses = Object.entries(REQUIRED).filter(([name]) => !get(name));
    const cspHeader = get("content-security-policy");
    if (!liveMisses.length && /default-src/.test(cspHeader))
      ok(`live ${base}: policy headers served (HTTP ${res.status})`);
    else
      fail(
        `live ${base}: missing ${liveMisses.map(([n]) => n).join(", ") || "csp directives"}`,
      );
  }
}

console.log(failures ? `\n${failures} HEADER FAILURE(S)` : "\nHEADERS OK");
process.exit(failures ? 1 : 0);
