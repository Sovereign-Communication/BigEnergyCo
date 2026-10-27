import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(
  "blog/what-size-solar-system-for-off-grid/index.html",
  "utf8",
);
const listing = readFileSync("blog/index.html", "utf8");
const rss = readFileSync("rss.xml", "utf8");
const sitemap = readFileSync("sitemap.xml", "utf8");
const cleanText = (value) =>
  value.trim().split(/\s+/).filter(Boolean).join(" ");
const schema = JSON.parse(
  page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
)["@graph"];

test("off-grid sizing article claims, sources, metadata, and FAQs stay aligned", () => {
  const article = schema.find((item) => item["@type"] === "Article");
  const faq = schema.find((item) => item["@type"] === "FAQPage");
  const visible = [
    ...page
      .split("<h2>Frequently asked</h2>")[1]
      .split("</article>")[0]
      .matchAll(/<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>/g),
  ].map(([, question, answer]) => [cleanText(question), cleanText(answer)]);
  const structured = faq.mainEntity.map(({ name, acceptedAnswer }) => [
    name,
    acceptedAnswer.text,
  ]);
  const title = "What Size Solar System for Off-Grid? Honest Guide (2026)";
  const visibleArticle = page.split("<article>")[1].split("</article>")[0];
  const hrefs = new Set(
    page
      .split('href="')
      .slice(1)
      .map((attribute) => attribute.split('"')[0]),
  );

  assert.deepEqual(structured, visible);
  assert.equal(article.headline, title);
  assert.ok(listing.includes(title));
  assert.ok(page.includes("Last reviewed October 22, 2026"));
  assert.equal(article.dateModified, "2026-10-22T00:00:00Z");
  assert.match(page, /article:modified_time" content="2026-10-22/);
  assert.match(listing, /reviewed Oct 22, 2026/);
  assert.match(
    sitemap,
    /what-size-solar-system-for-off-grid\/<\/loc>\s*<lastmod>2026-10-22/,
  );
  assert.ok(hrefs.has("https://pvwatts.nrel.gov/"));
  assert.ok(hrefs.has("https://sam.nrel.gov/battery-storage/"));
  assert.ok(
    hrefs.has("https://www.energy.gov/cmei/systems/homeowners-guide-solar"),
  );
  assert.doesNotMatch(
    visibleArticle,
    /kWh\/kWp\/yr|\$\s?\d|\b\d+(?:\.\d+)?\s?(?:kW|kWh|%)/,
  );
});
