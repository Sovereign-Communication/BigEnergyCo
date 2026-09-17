// Three dev-script helpers used to answer "does this string mention that
// host?" instead of "is this OURS?". Each accepted something it should not, so
// each is pinned here in both directions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

import {
  deployedFiles,
  sameOriginPath,
  sitemapGaps,
} from "../scripts/lib/gates.mjs";
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

test("ALLOWLIST QUERY: --list reports exactly what a staged build contains", () => {
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
  assert.doesNotMatch(seo, /u\.includes\(urlPath/);
  assert.doesNotMatch(seo, /\.replace\("blog\/", "blog\/"\)/);

  const jsonld = readFileSync("scripts/validate-jsonld.mjs", "utf8");
  assert.match(jsonld, /sameOriginPath\(url, ORIGIN\)/);
  assert.doesNotMatch(jsonld, /url\.startsWith\(ORIGIN\)/);

  const smoke = readFileSync("scripts/browser-smoke.mjs", "utf8");
  assert.match(
    smoke,
    /import \{ normalizeBase \} from "\.\/lib\/base-url\.mjs"/,
  );
  assert.doesNotMatch(smoke, /pathname\.replace\(/);
});
