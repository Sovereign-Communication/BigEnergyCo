import fs from "node:fs";
const articlePath = process.argv[2];
let html = fs.readFileSync(articlePath, "utf8");
html = html.replace('content="2026-10-21"', 'content="2026-10-22"');
html = html.replace("2026-10-21T00:00:00Z", "2026-10-22T00:00:00Z");
html = html.replace(
  "kit listing says it fits 16 cells; confirm",
  "kit listing is inquiry-only and says it fits 16 cells; confirm",
);
if (!html.includes('content="2026-10-22"') || !html.includes("2026-10-22T00:00:00Z")) {
  throw new Error("Article modified dates were not updated.");
}
fs.writeFileSync(articlePath, html);

const sitemapPath = process.argv[3];
let sitemap = fs.readFileSync(sitemapPath, "utf8");
const url = "<loc>https://freeoffgridcalculator.com/blog/diy-vs-prebuilt-sodium-ion-lifepo4-battery-storage/</loc>";
const urlIndex = sitemap.indexOf(url);
const oldLastmod = "<lastmod>2026-08-30</lastmod>";
const lastmodIndex = sitemap.indexOf(oldLastmod, urlIndex);
if (urlIndex < 0 || lastmodIndex < 0) throw new Error("Sitemap entry not found.");
sitemap =
  sitemap.slice(0, lastmodIndex) +
  "<lastmod>2026-10-22</lastmod>" +
  sitemap.slice(lastmodIndex + oldLastmod.length);
fs.writeFileSync(sitemapPath, sitemap);
console.log("Updated source-date note and article modified dates.");
