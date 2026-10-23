import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const article = readFileSync(
  "blog/off-grid-vs-grid-tie-payback/index.html",
  "utf8",
);
const listing = readFileSync("blog/index.html", "utf8");
const sitemap = readFileSync("sitemap.xml", "utf8");
const rss = readFileSync("rss.xml", "utf8");
const title =
  "Off-Grid vs. Grid-Tied Solar: Compare Payback and Resilience (2026)";
const jsonSource = article.match(
  /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/i,
)?.[1];
assert.ok(jsonSource, "article JSON-LD exists");
const graph = JSON.parse(jsonSource)["@graph"];
const articleSchema = graph.find((item) => item["@type"] === "Article");
const faq = graph.find((item) => item["@type"] === "FAQPage");
const clean = (value) => value.replace(/\s+/g, " ").trim();
const visibleFaq = [
  ...article
    .split("<h2>Frequently asked</h2>")[1]
    .matchAll(/<summary>(.*?)<\/summary>[\s\S]*?<p>(.*?)<\/p>/gs),
].map(([, q, a]) => [clean(q), clean(a)]);
const schemaFaq = faq.mainEntity.map(({ name, acceptedAnswer }) => [
  name,
  acceptedAnswer.text,
]);

test("grid-tied vs stand-alone article is sourced, cautious, and synchronized", () => {
  assert.equal(articleSchema.headline, title);
  assert.equal(articleSchema.name, title);
  assert.match(articleSchema.description, /local tariffs/);
  assert.deepEqual(schemaFaq, visibleFaq);
  const listingText = listing.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  assert.equal(listingText.split(title).length - 1, 3);
  assert.ok(article.includes("2026-10-22T00:00:00Z"));
  assert.ok(article.includes('article:modified_time" content="2026-10-22"'));
  assert.ok(article.includes("Last reviewed: October 22, 2026"));
  assert.ok(listing.includes("Updated Oct 22, 2026"));
  assert.ok(sitemap.includes("<lastmod>2026-10-22</lastmod>"));
  assert.ok(rss.includes(title));
  assert.ok(
    rss.includes(
      "Compare off-grid and grid-connected solar using local tariffs",
    ),
  );
  assert.ok(article.includes("homeowners-guide-solar"));
  assert.ok(
    article.includes(
      "Compare off-grid and grid-connected solar using local tariffs",
    ),
  );
  assert.ok(article.includes("solar-integration-distributed-energy-resources"));
  assert.ok(article.includes("43844.pdf"));
  assert.ok(
    article.includes(
      "atb.nrel.gov/electricity/2024/residential_battery_storage",
    ),
  );
  const main = article.split('<main id="main"')[1].split("</main>")[0];
  assert.doesNotMatch(
    main,
    /\$|6,000 cycles|0\.30.?0\.80|under two years|one to three years|three times the grid rate|same 3 kW array/i,
  );
  assert.match(main, /modeled\s+estimates/i);
});
