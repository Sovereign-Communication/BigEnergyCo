// Validate JSON-LD blocks on every shippable page. Run: node scripts/validate-jsonld.mjs
// Page list is driven by sitemap.xml (the same file submitted to search
// consoles), so new city/post/heatmap pages are covered automatically —
// never hand-maintain a page list here.
import { readFileSync, existsSync } from "node:fs";

const ORIGIN = "https://bigenergyco.pages.dev";
const sitemap = readFileSync("sitemap.xml", "utf8");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!locs.length) {
  console.error("FAIL sitemap.xml: no <loc> entries found");
  process.exit(1);
}

const pages = [];
for (const url of locs) {
  if (!url.startsWith(ORIGIN)) {
    console.error(`FAIL sitemap.xml: unexpected origin ${url}`);
    process.exit(1);
  }
  const path = url.slice(ORIGIN.length);
  if (!path.endsWith("/")) {
    console.error(`FAIL sitemap.xml: non-page URL ${url} (validator covers directory pages)`);
    process.exit(1);
  }
  const file = path === "/" ? "index.html" : `${path.slice(1)}index.html`;
  pages.push({ url, file });
}

let failures = 0;
for (const { url, file } of pages) {
  if (!existsSync(file)) {
    console.error(`FAIL ${url}: sitemap target missing on disk (${file})`);
    failures++;
    continue;
  }
  const html = readFileSync(file, "utf8");
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!blocks.length) { console.log(`${file}: NO JSON-LD (ok only for utility pages)`); continue; }
  for (const [i, m] of blocks.entries()) {
    try {
      const data = JSON.parse(m[1]);
      const types = (data["@graph"] ? data["@graph"] : [data]).map((n) => n["@type"]).flat();
      console.log(`OK   ${file} [block ${i + 1}]: ${types.join(", ")}`);
    } catch (e) {
      console.error(`FAIL ${file} [block ${i + 1}]: ${e.message}`);
      failures++;
    }
  }
}
process.exit(failures ? 1 : 0);
