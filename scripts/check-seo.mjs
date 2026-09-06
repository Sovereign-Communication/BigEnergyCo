// SEO integrity checks for all public pages. Run: node scripts/check-seo.mjs
// Fails (exit 1) on: missing/dupe h1, missing canonical, missing OG tags,
// unparseable JSON-LD, sitemap URLs that don't match real files, robots issues.
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

let failures = 0;
const fail = (msg) => {
  console.error(`FAIL ${msg}`);
  failures++;
};
const ok = (msg) => console.log(`OK   ${msg}`);

// Discover public HTML pages from the deploy allowlist (single source of truth:
// the deploy script). Falls back to a static list if git is unavailable.
function publicPages() {
  try {
    const out = execSync("node scripts/deploy-pages-local.mjs --check", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return out
      .split("\n")
      .filter((l) => l.trim().endsWith(".html"))
      .map((l) => l.trim());
  } catch {
    return ["index.html", "404.html", "blog/index.html"];
  }
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

  // canonical (home, blog index, posts — not utility pages).
  // Accepts self-closing tags and line-wrapped attributes: Prettier
  // normalizes void elements to `/>` and may put each attribute on its
  // own line — both are valid HTML.
  if (page === "index.html" || page.startsWith("blog/")) {
    if (
      /<link\s+rel="canonical"\s+href="https:\/\/bigenergyco\.pages\.dev\/[^"]*"\s*\/?>/.test(
        html,
      )
    )
      ok(`${page}: canonical`);
    else fail(`${page}: missing or wrong canonical`);
  }

  // OG tags on index and posts
  if (page === "index.html" || /^blog\/[^/]+\/index\.html$/.test(page)) {
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
    /<loc>(https:\/\/bigenergyco\.pages\.dev\/[^<]*)<\/loc>/g,
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
    .replace("https://bigenergyco.pages.dev/", "")
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

// Every public content page should be in the sitemap
for (const page of pages) {
  if (page === "index.html") continue;
  const urlPath = page.replace(/\/index\.html$/, "/");
  if (!urls.some((u) => u.includes(urlPath.replace("blog/", "blog/")))) {
    fail(`sitemap: page ${page} missing from sitemap.xml`);
  }
}

// robots.txt basics
const robots = readFileSync("robots.txt", "utf8");
if (!/Sitemap: https:\/\/bigenergyco\.pages\.dev\/sitemap\.xml/.test(robots))
  fail("robots.txt: missing sitemap directive");
else ok("robots.txt: sitemap directive present");

process.exit(failures ? 1 : 0);
