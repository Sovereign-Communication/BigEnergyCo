// Three dev-script helpers used to answer "does this string mention that
// host?" instead of "is this OURS?". Each accepted something it should not, so
// each is pinned here in both directions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";

import {
  deployedFiles,
  deployedFilesFrom,
  pageLastTouched,
  sameOriginPath,
  sitemapEntries,
  sitemapGaps,
  staleLastmods,
} from "../scripts/lib/gates.mjs";
import { withMutationLock } from "../scripts/lib/mutation-lock.mjs";
import { normalizeBase } from "../scripts/lib/base-url.mjs";

// ── normalizeBase (browser smoke) ───────────────────────────────────────────

test("SMOKE BASE: every form ends in exactly one trailing slash", () => {
  // The heatmap URL is `${BASE}solar-heatmap/`, so a missing slash builds the
  // host `example.comsolar-heatmap` and the heatmap gates fail on a Chrome
  // error page instead of on the app.
  assert.equal(normalizeBase("https://example.com"), "https://example.com/");
  assert.equal(normalizeBase("https://example.com/"), "https://example.com/");
  assert.equal(
    normalizeBase("https://example.com/mirror"),
    "https://example.com/mirror/",
    "a path-bearing base needs the slash too",
  );
  assert.equal(
    normalizeBase("https://example.com/mirror/"),
    "https://example.com/mirror/",
  );
  assert.equal(
    normalizeBase("https://example.com/mirror/?x=1#hash"),
    "https://example.com/mirror/",
    "a base is an origin+path; query and hash must not leak into sub-page URLs",
  );
  // Non-URL input still gets a slash (the caller may pass something exotic).
  assert.equal(normalizeBase("example.com"), "example.com/");
  assert.equal(normalizeBase("example.com/"), "example.com/");
  // And the string composition actually works for a sub-page.
  assert.equal(
    `${normalizeBase("https://example.com/mirror")}solar-heatmap/`,
    "https://example.com/mirror/solar-heatmap/",
  );
});

// ── sameOriginPath (JSON-LD validator) ──────────────────────────────────────

test("SITEMAP ORIGIN: a lookalike host is not our own page", () => {
  const origin = "https://freeoffgridcalculator.com";
  assert.equal(sameOriginPath(`${origin}/blog/`, origin), "/blog/");
  assert.equal(sameOriginPath(`${origin}/`, origin), "/");
  assert.equal(
    sameOriginPath(
      "https://freeoffgridcalculator.com.evil.example/blog/",
      origin,
    ),
    null,
    "a prefix match would have accepted this",
  );
  assert.equal(
    sameOriginPath("https://www.freeoffgridcalculator.com/", origin),
    null,
    "a different host is a different site",
  );
  assert.equal(
    sameOriginPath("http://freeoffgridcalculator.com/", origin),
    null,
  );
  assert.equal(sameOriginPath("not a url", origin), null);
});

// ── sitemapGaps (check-seo) ─────────────────────────────────────────────────

const SITE = "https://example.com/";

test("SITEMAP GAPS: only an exact entry counts", () => {
  const pages = ["index.html", "blog/index.html", "blog/post/index.html"];
  const urls = [SITE, SITE + "blog/", SITE + "blog/post/"];
  assert.deepEqual(sitemapGaps(pages, urls, SITE), { missing: [], extra: [] });

  // A neighbouring path must NOT satisfy the entry for `/blog/post/`.
  const neighbour = [SITE, SITE + "blog/", SITE + "blog/post-2/"];
  const gaps = sitemapGaps(pages, neighbour, SITE);
  assert.deepEqual(
    gaps.missing,
    [SITE + "blog/post/"],
    "a substring test would have accepted /blog/post-2/",
  );
  assert.deepEqual(gaps.extra, [SITE + "blog/post-2/"]);

  // A sitemap entry with no page behind it is a 404 served to crawlers.
  assert.deepEqual(sitemapGaps(pages, [...urls, SITE + "gone/"], SITE).extra, [
    SITE + "gone/",
  ]);
});

test("SITEMAP GAPS: the real tree is complete and has no stale entries", () => {
  // Guards the gate itself: this must stay a real assertion, so it reads the
  // deployed page list and the shipped sitemap, not a fixture.
  const pages = [
    ...readFileSync("sitemap.xml", "utf8").matchAll(/<loc>([^<]+)<\/loc>/g),
  ].map((m) => m[1]);
  assert.ok(pages.length > 50, "sitemap must not go empty");
  // deployedFiles() is the shared, read-only allowlist query (it used to call
  // --check, which BUILDS the staging dir — several gates asking at once raced
  // on it).
  const deployed = deployedFiles().filter(
    (f) => f.endsWith(".html") && f !== "404.html",
  );
  assert.ok(deployed.length > 50, "deploy allowlist must not go empty");
  assert.deepEqual(
    sitemapGaps(deployed, pages, "https://freeoffgridcalculator.com/"),
    { missing: [], extra: [] },
    "every deployed page is listed, and every listing has a page behind it",
  );
});

// ── sitemap <lastmod> freshness (check-seo) ─────────────────────────────────

test("SITEMAP FRESHNESS: each <loc> keeps its own <lastmod>", () => {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    "<url><loc>https://example.com/</loc><lastmod>2026-01-01</lastmod></url>",
    "<url><loc>https://example.com/missing/</loc></url>",
    "<url><loc>https://example.com/b/</loc><lastmod>2026-02-02</lastmod></url>",
    "</urlset>",
  ].join("\n");
  assert.deepEqual(sitemapEntries(xml), [
    { loc: "https://example.com/", lastmod: "2026-01-01" },
    // Zipping two flat lists positionally is what made this per-entry pairing
    // necessary: entry 2 would have been handed entry 3's date.
    { loc: "https://example.com/missing/", lastmod: null },
    { loc: "https://example.com/b/", lastmod: "2026-02-02" },
  ]);
  // Three entries, not four: `<urlset>` is not a `<url>`.
  assert.equal(sitemapEntries(xml).length, 3);
});

test("SITEMAP FRESHNESS: a date older than the page's last change is refused", () => {
  const entries = [
    { loc: "https://example.com/", lastmod: "2026-01-01" },
    { loc: "https://example.com/newer/", lastmod: "2026-02-02" },
    { loc: "https://example.com/equal/", lastmod: "2026-03-03" },
  ];
  const files = {
    "https://example.com/": "index.html",
    "https://example.com/newer/": "newer/index.html",
    "https://example.com/equal/": "equal/index.html",
  };
  const touched = {
    "index.html": "2026-01-31", // the page was rewritten after the shipped date
    "newer/index.html": "2026-01-01", // the sitemap runs ahead of the page
    "equal/index.html": "2026-03-03",
  };
  const { stale, checked } = staleLastmods(
    entries,
    (url) => files[url] ?? null,
    (file) => touched[file] ?? null,
  );
  assert.deepEqual(stale, [
    {
      url: "https://example.com/",
      file: "index.html",
      lastmod: "2026-01-01",
      touched: "2026-01-31",
    },
  ]);
  assert.equal(checked, 3, "a newer date and an equal one are both fresh");
});

test("SITEMAP FRESHNESS: an entry it cannot judge is skipped, never failed", () => {
  const entries = [
    { loc: null, lastmod: "2026-01-01" },
    { loc: "https://example.com/nodate/", lastmod: null },
    { loc: "https://example.com/gone/", lastmod: "2026-01-01" },
    { loc: "https://example.com/nonsense/", lastmod: "yesterday" },
    { loc: "https://example.com/uncommitted/", lastmod: "2026-01-01" },
  ];
  const files = {
    "https://example.com/nonsense/": "nonsense/index.html",
    "https://example.com/uncommitted/": "uncommitted/index.html",
  };
  const { stale, checked } = staleLastmods(
    entries,
    (url) => files[url] ?? null,
    () => null, // nothing is derivable here
  );
  assert.deepEqual(stale, []);
  assert.equal(
    checked,
    0,
    "presence, resolution and derivation are other checks' subjects — one defect must not be reported twice under two names",
  );
});

test("SITEMAP FRESHNESS: a shallow checkout is refused by name, never answered", () => {
  // What `git log -1 -- <file>` actually does on a grafted root: it does not
  // fail, it reports the tip for every file — so a date comparison against it
  // is a comparison against the wrong commit on all 82 entries at once.
  const run = (args) => (args[0] === "rev-parse" ? "true\n" : "2026-10-13\n");
  const result = pageLastTouched(["index.html", "blog/index.html"], run);
  assert.ok(result.error, "a shallow checkout has no answer to give");
  assert.match(result.error, /shallow/);
  assert.match(result.error, /git fetch --unshallow/);
  assert.equal(result.dates.size, 0, "no date survives the refusal");
});

test("SITEMAP FRESHNESS: a checkout with no git at all is refused too", () => {
  const result = pageLastTouched(["index.html"], () => {
    throw new Error("git: command not found");
  });
  assert.match(result.error, /cannot read git history/);
  assert.equal(result.dates.size, 0);
});

test("SITEMAP FRESHNESS: a full history derives each file's own last commit", () => {
  const dates = {
    "index.html": "2026-10-05",
    "blog/index.html": "2026-10-13",
  };
  const asked = [];
  const run = (args) => {
    if (args[0] === "rev-parse") return "false\n";
    const file = args[args.length - 1];
    asked.push(file);
    return `${dates[file] ?? ""}\n`;
  };
  const result = pageLastTouched(
    ["index.html", "blog/index.html", "new/index.html"],
    run,
  );
  assert.equal(result.error, null);
  assert.equal(result.dates.get("index.html"), "2026-10-05");
  assert.equal(result.dates.get("blog/index.html"), "2026-10-13");
  assert.deepEqual(
    result.missing,
    ["new/index.html"],
    "a page with no commit is unverifiable, which is not the same as stale",
  );
  assert.deepEqual(asked, ["index.html", "blog/index.html", "new/index.html"]);
});

test("SITEMAP FRESHNESS: the shipped dates match their pages, and the stale hub is caught", (t) => {
  const entries = sitemapEntries(readFileSync("sitemap.xml", "utf8"));
  assert.ok(entries.length > 50, "sitemap must not go empty");
  const origin = "https://freeoffgridcalculator.com/";
  const fileFor = (url) => {
    const path = String(url).replace(origin, "").replace(/\/$/, "");
    if (path === "") return "index.html";
    if (existsSync(`${path}/index.html`)) return `${path}/index.html`;
    if (existsSync(path)) return path;
    return null;
  };
  const derived = pageLastTouched(
    [...new Set(entries.map((e) => fileFor(e.loc)).filter(Boolean))],
    (args) =>
      execFileSync("git", args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
  );
  if (derived.error) {
    // A shallow checkout cannot answer this, and the gate refuses loudly there
    // rather than guessing. Report that instead of inventing the pass it cannot
    // earn — a green that verified nothing is the defect this check exists for.
    t.skip(`no full history to derive from: ${derived.error}`);
    return;
  }
  const dateFor = (file) => derived.dates.get(file) ?? null;
  const { stale, checked } = staleLastmods(entries, fileFor, dateFor);
  assert.equal(stale.length, 0, `stale entries: ${JSON.stringify(stale)}`);
  assert.ok(checked > 50, `checked ${checked} of ${entries.length} entries`);

  // MUTATION: the audit's headline case, restored. The blog hub shipped
  // 2026-08-30 while its last commit was 2026-10-13; with that date back the
  // check must fail, which is what makes the green above mean something.
  const hub = `${origin}blog/`;
  const mutated = entries.map((e) =>
    e.loc === hub ? { ...e, lastmod: "2026-08-30" } : e,
  );
  const result = staleLastmods(mutated, fileFor, dateFor);
  assert.equal(result.stale.length, 1);
  assert.equal(result.stale[0].url, hub);
  assert.equal(result.stale[0].lastmod, "2026-08-30");
  assert.equal(result.stale[0].touched, dateFor("blog/index.html"));
});

test("ALLOWLIST PARSE: dotless platform files and nested paths survive the parser", () => {
  // `_headers` and `_redirects` have no dot and the platform files sit beside
  // nested assets, so a naive "looks like a filename" rule silently drops real
  // deployed files — and every gate that reads this list would then validate a
  // smaller site than the one that ships.
  const stdout = [
    "Deployable files:",
    "  index.html",
    "  _headers",
    "  _redirects",
    "  assets/site.css",
    "",
    "--list: 4 file(s), nothing built.",
  ].join("\n");
  assert.deepEqual(deployedFilesFrom(stdout), [
    "index.html",
    "_headers",
    "_redirects",
    "assets/site.css",
  ]);
  assert.deepEqual(deployedFilesFrom(""), []);
});

test("ALLOWLIST QUERY: --list reports exactly what a staged build contains", async () => {
  // The gates validate what --list returns, so it must be the same SET a real
  // deploy ships. One staged build (into a throwaway dir) proves it.
  // --stage is resolved relative to the repo root by design (deploy.yml passes
  // `_pages`), so the throwaway staging dir has to live inside the repo.
  const stage = "_pages_allowlist_check";
  rmSync(stage, { recursive: true, force: true });
  try {
    const staged = execSync(
      `node scripts/deploy-pages-local.mjs --check --stage ${stage}`,
      { encoding: "utf8" },
    )
      .split("Deployable files:")[1]
      .split("--check:")[0]
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .sort();
    const listed = deployedFiles().sort();
    assert.ok(staged.length > 50, "the staged build must not be empty");
    assert.deepEqual(
      listed,
      staged,
      "--list must equal the staged file set, or the gates validate a different site",
    );
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
});

// ── the scripts use the helpers (no private copy left behind) ───────────────

test("SCRIPTS: the hardened helpers are the ones actually used", () => {
  const seo = readFileSync("scripts/check-seo.mjs", "utf8");
  assert.match(seo, /sitemapGaps\(/);
  // The freshness verdict is the shared helper, not a private copy of it: a
  // second implementation is one that can drift from the tested one.
  assert.match(seo, /sitemapEntries\(/);
  assert.match(seo, /pageLastTouched\(/);
  assert.match(seo, /staleLastmods\(/);
  assert.doesNotMatch(seo, /u\.includes\(urlPath/);
  assert.doesNotMatch(seo, /\.replace\("blog\/", "blog\/"\)/);

  const jsonld = readFileSync("scripts/validate-jsonld.mjs", "utf8");
  assert.match(jsonld, /sameOriginPath\(url, ORIGIN\)/);
  assert.doesNotMatch(jsonld, /url\.startsWith\(ORIGIN\)/);

  // normalizeBase stays the single owner of argv canonicalization: the
  // orchestrator imports it; the runtime it drives must not re-derive paths.
  const orchestrator = readFileSync("scripts/browser-smoke.mjs", "utf8");
  assert.match(
    orchestrator,
    /import \{ normalizeBase \} from "\.\/lib\/base-url\.mjs"/,
  );
  const smoke = readFileSync("scripts/smoke/runtime.mjs", "utf8");
  // The browser runtime, not the thin orchestrator, owns process launch and
  // every page evaluation entry point — so the hardening contract lives here.
  assert.match(
    smoke,
    /Runtime\.evaluate/,
    "the runtime drives the page through Runtime.evaluate",
  );
  assert.doesNotMatch(
    smoke,
    /pathname\.replace\(/,
    "base-URL handling stays in normalizeBase",
  );
});

test("local smoke GATES the API health probe instead of skipping it", () => {
  const closing = readFileSync("scripts/smoke/closing.js", "utf8");
  assert.match(
    closing,
    /const workerProbe = ctx\.isLocalBase\s*\? ""\s*:/,
    "localhost must not send a CORS-blocked API health request",
  );
  assert.match(closing, /\$\{workerProbe\}/);
  // This used to be pinned as a REQUIRED SKIP ("the production-only check must
  // be visibly skipped"). That skip is what let `web-smoke` sit red for weeks:
  // the local server had no /api/chat route, the console-error gate failed on
  // the resulting 404, and the health check itself reported nothing. The local
  // server now mounts the real worker, so the probe is a real gate.
  //
  // The intent is preserved and tightened: a local run must not quietly report
  // success for a check it did not perform.
  assert.doesNotMatch(
    closing,
    /SMOKE SKIP\s+API health/,
    "the local API health check must be a gate, not a skip — a skip is a check that cannot fail",
  );
  assert.match(
    closing,
    /gate\(\s*"API health reachable \(local: real worker, same origin\)"/,
    "the local run must gate on the real worker answering on its own origin",
  );
  assert.match(
    closing,
    /"API health is served by the real worker, not a stub"/,
    "and must prove the answer came from the worker, not a hand-written stand-in",
  );
  assert.match(
    closing,
    /"API health reachable",\s*\/(?:\^HTTP 200)\/\.test\(probes\.worker \|\| ""\)/,
    "on production origins the health probe must still require HTTP 200",
  );
});

test("the local static server mounts the real API worker", () => {
  // The root cause of the permanently-red smoke: /api/* was hand-written
  // stand-ins for two routes and nothing at all for /api/chat. Pinned here so
  // the mount cannot be quietly removed, and so the unmounted path is required
  // to fail loudly rather than 404 like a broken product.
  const serve = readFileSync("scripts/serve-static.mjs", "utf8");
  assert.match(
    serve,
    /mountWorker = true/,
    "the worker must be mounted by default, like the deployed one-origin surface",
  );
  assert.match(
    serve,
    /handleWorkerRequest\(worker, req, res/,
    "/api/* must be routed to the real worker, not to a local stand-in",
  );
  assert.match(
    serve,
    /501[\s\S]{0,200}API worker not mounted/,
    "an unmounted worker must answer 501 naming why, not 404 like a missing endpoint",
  );
  assert.doesNotMatch(
    serve,
    /local static mirror \(no API worker here\)/,
    "the hand-written /api/health stand-in must be gone",
  );
});

test("the document-start worker stub covers the local stage only", () => {
  // The stub fakes /api/health (jevSanity:true) and /api/jev (available:false)
  // so the Jev gates are meaningful against a workerless local emulator. If it
  // ever ran against a real surface it would fake the worker's own answers —
  // "API health reachable" and the server-side activation state would read as
  // passes for requests that never left the machine.
  const orchestrator = readFileSync("scripts/browser-smoke.mjs", "utf8");
  assert.match(
    orchestrator,
    /if \(isLocalBase\) \{\s*await ctx\.send\("Page\.addScriptToEvaluateOnNewDocument", \{\s*source: jevHealthAtDocumentStart,/,
    "the fake worker layer must be installed only when the smoke targets a local stage",
  );
  assert.equal(
    orchestrator.split("Page.addScriptToEvaluateOnNewDocument").length,
    2,
    "the stub must have exactly one registration site — the guarded one",
  );

  // The layer owns BOTH routes: answering only /api/health would enable the
  // Jev path against a no-key server whose /api/jev then 503s on every
  // out-of-gate render and fails the strict console-error gate.
  const jev = readFileSync("scripts/smoke/jev.js", "utf8");
  const layer = jev.slice(jev.indexOf("jevHealthAtDocumentStart"));
  assert.match(layer, /\/api\/health/);
  assert.match(layer, /\/api\/jev/);
  assert.match(layer, /available: false/);
});
