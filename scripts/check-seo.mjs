// SEO integrity checks for all public pages. Run: node scripts/check-seo.mjs
// Fails (exit 1) on: missing/dupe h1, missing canonical, missing OG tags,
// unparseable JSON-LD, sitemap URLs that don't match real files, robots issues.
import { readFileSync, existsSync } from "node:fs";

import { deployedFiles, sitemapGaps } from "./lib/gates.mjs";

let failures = 0;
const fail = (msg) => {
  console.error(`FAIL ${msg}`);
  failures++;
};
const ok = (msg) => console.log(`OK   ${msg}`);

// Discover public HTML pages from the deploy manifest (single source of truth,
// shared with the verifier and every other gate). The old per-script CLI spawn
// is gone: it was the flake vector — a child process intermittently lost a
// contiguous slice of its output under CI parallelism.
function publicPages() {
  return deployedFiles().filter((f) => f.endsWith(".html"));
}

const pages = publicPages().filter((p) => p !== "404.html"); // 404 is a utility page
if (!pages.length) fail("no public pages discovered");

for (const page of pages) {
  if (!existsSync(page)) {
    fail(`${page}: file missing`);
    continue;
  }
  const html = readFileSync(page, "utf8");

  // h1: exactly one per page
  const h1s = [...html.matchAll(/<h1[\s>]/g)].length;
  if (h1s === 1) ok(`${page}: single h1`);
  else fail(`${page}: expected exactly 1 <h1>, found ${h1s}`);

  // canonical (home, blog index, posts, city pages, heatmap, about — not utility pages).
  // Accepts self-closing tags and line-wrapped attributes: Prettier
  // normalizes void elements to `/>` and may put each attribute on its
  // own line — both are valid HTML.
  if (
    page === "index.html" ||
    page.startsWith("blog/") ||
    page.startsWith("solar-calculator/") ||
    page.startsWith("solar-heatmap/") ||
    page.startsWith("about/")
  ) {
    if (
      /<link\s+rel="canonical"\s+href="https:\/\/freeoffgridcalculator\.com\/[^"]*"\s*\/?>/.test(
        html,
      )
    )
      ok(`${page}: canonical`);
    else fail(`${page}: missing or wrong canonical`);
  }

  // OG tags on index, posts, city pages, heatmap, about, blog hub
  if (
    page === "index.html" ||
    page === "blog/index.html" ||
    /^blog\/[^/]+\/index\.html$/.test(page) ||
    page.startsWith("solar-calculator/") ||
    page.startsWith("solar-heatmap/") ||
    page.startsWith("about/")
  ) {
    const ogTitle = /property="og:title"/.test(html);
    const ogDesc = /property="og:description"/.test(html);
    const ogImage = /property="og:image"/.test(html);
    const twCard = /name="twitter:card"/.test(html);
    if (ogTitle && ogDesc && ogImage && twCard)
      ok(`${page}: OG/Twitter complete`);
    else
      fail(
        `${page}: OG incomplete (title:${ogTitle} desc:${ogDesc} image:${ogImage} card:${twCard})`,
      );
    // hreflang: exactly en + x-default, both self-referential. ?lang=
    // variants are client-side translations that canonical here, so listing
    // them as hreflang targets would ship a known-ignored signal to Google.
    const hreflangs = [...html.matchAll(/hreflang="([^"]+)"/g)].map(
      (x) => x[1],
    );
    const hasQueryLang = /hreflang="[^"]+"\s+href="[^"]*\?lang=/.test(html);
    if (hasQueryLang) {
      fail(`${page}: hreflang points at a ?lang= URL (non-indexable target)`);
    } else if (
      hreflangs.includes("en") &&
      hreflangs.includes("x-default") &&
      hreflangs.length === 2
    ) {
      ok(`${page}: hreflang present (en + x-default)`);
    } else {
      fail(
        `${page}: hreflang must be exactly en + x-default, found [${hreflangs.join(", ")}]`,
      );
    }

    // BreadcrumbList JSON-LD schema present on city and blog post pages
    if (
      page.startsWith("solar-calculator/") ||
      (/^blog\/[^/]+\/index\.html$/.test(page) && page !== "blog/index.html")
    ) {
      if (/ BreadcrumbList /.test(html) || /"BreadcrumbList"/.test(html)) {
        ok(`${page}: BreadcrumbList JSON-LD present`);
      } else {
        fail(`${page}: missing BreadcrumbList JSON-LD schema`);
      }
    }
  }

  // JSON-LD parses
  const blocks = [
    ...html.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    ),
  ];
  for (const [i, m] of blocks.entries()) {
    try {
      JSON.parse(m[1]);
      ok(`${page}: JSON-LD block ${i + 1} parses`);
    } catch (e) {
      fail(`${page}: JSON-LD block ${i + 1} invalid: ${e.message}`);
    }
  }
}

// Sitemap URLs must correspond to real files
const sitemap = readFileSync("sitemap.xml", "utf8");
const urls = [
  ...sitemap.matchAll(
    /<loc>(https:\/\/freeoffgridcalculator\.com\/[^<]*)<\/loc>/g,
  ),
].map((m) => m[1]);
const lastmods = [
  ...sitemap.matchAll(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/g),
].map((m) => m[1]);
if (!urls.length) fail("sitemap.xml: no URLs found");
// Every URL needs a lastmod, and none may be older than a year — a sitemap
// that rots silently tells search consoles the site is abandoned.
if (lastmods.length !== urls.length)
  fail(
    `sitemap.xml: ${urls.length - lastmods.length} URL(s) missing <lastmod>`,
  );
else ok("sitemap.xml: every URL has <lastmod>");
{
  const oldestAllowed = Date.now() - 366 * 86400000;
  const stale = lastmods.filter(
    (d) => Date.parse(d + "T00:00:00Z") < oldestAllowed,
  );
  if (stale.length)
    fail(`sitemap.xml: ${stale.length} lastmod(s) older than 366 days`);
  else ok("sitemap.xml: all lastmod dates within 366 days");
}
for (const url of urls) {
  const path = url
    .replace("https://freeoffgridcalculator.com/", "")
    .replace(/\/$/, "");
  const file =
    path === ""
      ? "index.html"
      : existsSync(`${path}/index.html`)
        ? `${path}/index.html`
        : existsSync(path)
          ? path
          : null;
  if (file) ok(`sitemap: ${url} -> ${file}`);
  else fail(`sitemap: ${url} has no matching file`);
}

// Every public content page needs its OWN sitemap entry, and every entry needs
// a page. Both directions are compared as exact URLs: the old test was a
// substring search for the page path, which a neighbouring path
// (`/blog/escape-load-shedding-2/`) or a lookalike host satisfied — and a
// no-op path replacement inside it made the result meaningless.
const { missing: sitemapMissing, extra: sitemapExtra } = sitemapGaps(
  pages,
  urls,
  "https://freeoffgridcalculator.com/",
);
for (const url of sitemapMissing.slice(0, 8))
  fail(`sitemap: page ${url} missing from sitemap.xml`);
if (sitemapMissing.length > 8)
  fail(`sitemap: ${sitemapMissing.length - 8} more page(s) missing`);
for (const url of sitemapExtra.slice(0, 8))
  fail(`sitemap: ${url} is listed but no page deploys there`);
if (!sitemapMissing.length && !sitemapExtra.length)
  ok(`sitemap: all ${pages.length} public pages listed, no stale entries`);

// Search Console verification tags must survive refactors: a missing tag can
// silently un-verify a property and stall indexing. The first token verifies
// the active `freeoffgridcalculator.com` property (Domain or URL-prefix); the
// second is the legacy pages.dev token (kept until that property is retired).
const GSC_REQUIRED_TOKEN = "zVFiMH4WnfvhMHtnivIgDm_-5XtelVgcL709oHh3pWk";

// robots.txt basics
const robots = readFileSync("robots.txt", "utf8");
if (!/Sitemap: https:\/\/freeoffgridcalculator\.com\/sitemap\.xml/.test(robots))
  fail("robots.txt: missing sitemap directive");
else ok("robots.txt: sitemap directive present");

// Search Console verification gate: index.html must keep both GSC tags.
const homeHtml = readFileSync("index.html", "utf8");
const gscTags = [
  ...homeHtml.matchAll(
    /<meta\s+name="google-site-verification"\s+content="([^"]+)"/g,
  ),
].map((m) => m[1]);
if (gscTags.includes(GSC_REQUIRED_TOKEN))
  ok(
    "index.html: Google Search Console (freeoffgridcalculator.com) tag present",
  );
else
  fail(
    "index.html: missing Google Search Console verification tag for freeoffgridcalculator.com",
  );
const LEGACY_PAGESDEV_TOKEN = "iXiF6PQy5IhjMtll2YzS3-amK6BtApSkpdlKM73dSEc";
if (gscTags.includes(LEGACY_PAGESDEV_TOKEN))
  ok("index.html: legacy pages.dev GSC tag retained");
else
  fail(
    "index.html: legacy pages.dev GSC tag missing (keep until that property is retired)",
  );

process.exit(failures ? 1 : 0);
