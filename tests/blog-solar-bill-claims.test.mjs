import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const articlePath = "blog/how-to-cut-electricity-bill-with-solar/index.html";
const listingPath = "blog/index.html";
const articleUrl =
  "https://freeoffgridcalculator.com/blog/how-to-cut-electricity-bill-with-solar/";
const html = readFileSync(articlePath, "utf8");
const listing = readFileSync(listingPath, "utf8");
const normalizeText = (value) =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/&middot;/g, "·")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
const parseArticleGraph = () => {
  const match = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  assert.ok(match, "article JSON-LD exists");
  return JSON.parse(match[1])["@graph"];
};
const parseListingSchema = () => {
  const match = listing.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  assert.ok(match, "blog listing JSON-LD exists");
  return JSON.parse(match[1]);
};

test("solar bill guide has a visible review date that matches its metadata", () => {
  assert.match(
    html,
    /<time datetime="2026-10-22">Last reviewed: October 22, 2026<\/time>/,
  );
  assert.match(
    html,
    /<meta property="article:modified_time" content="2026-10-22"\s*\/>/,
  );
  const graph = parseArticleGraph();
  const article = graph.find((item) => item["@type"] === "Article");
  assert.ok(article);
  assert.equal(article.dateModified, "2026-10-22T00:00:00Z");
});

test("solar bill guide removes unsupported universal savings and cost claims", () => {
  assert.doesNotMatch(
    html,
    /\$0\.42\/kWh|\$0\.30–0\.80|one to four years|one to three years|\$80–125|\$110–165|6,000\s+cycles|Target 60–80%/i,
  );
  assert.match(html, /There is no universal percentage/);
  assert.match(html, /There is no universal payback period/);
  assert.match(html, /full price you would actually pay/);
  assert.match(html, /U\.S\. Department of Energy, Homeowner's Guide to Solar/);
  assert.match(html, /NASA POWER Hourly API documentation/);
  assert.match(html, /NREL PVWatts Calculator/);
});

test("solar bill guide visible FAQs match the FAQPage structured data", () => {
  const graph = parseArticleGraph();
  const faq = graph.find((item) => item["@type"] === "FAQPage");
  assert.ok(faq);
  const visible = [
    ...html.matchAll(
      /<details>\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>\s*<\/details>/g,
    ),
  ].map(([, question, answer]) => ({
    name: normalizeText(question),
    text: normalizeText(answer),
  }));
  const structured = faq.mainEntity.map((item) => ({
    name: normalizeText(item.name),
    text: normalizeText(item.acceptedAnswer.text),
  }));
  assert.equal(visible.length, 4);
  assert.deepEqual(structured, visible);
});

test("solar bill guide listing card and BlogPosting metadata agree", () => {
  const title = "How to Cut Your Electricity Bill With Solar (2026 Guide)";
  const schema = parseListingSchema();
  const post = schema.blogPost.find(
    (item) => item["@type"] === "BlogPosting" && item.url === articleUrl,
  );
  assert.ok(post);
  assert.equal(post.headline, title);
  assert.equal(post.name, title);
  assert.equal(post.dateModified, "2026-10-22T00:00:00Z");
  const cardStart = listing.indexOf("<!-- Article 3 -->");
  const cardEnd = listing.indexOf("        </article>", cardStart);
  assert.ok(cardStart >= 0 && cardEnd > cardStart);
  const card = listing.slice(cardStart, cardEnd);
  assert.match(card, /<time datetime="2026-10-22"/);
  assert.match(card, /Last reviewed: Oct 22, 2026/);
  assert.ok(card.includes(title));
  const excerpt = card.match(/<p class="card-excerpt">([\s\S]*?)<\/p>/);
  assert.ok(excerpt);
  assert.equal(normalizeText(excerpt[1]), post.description);
  assert.match(
    readFileSync("sitemap.xml", "utf8"),
    new RegExp(
      `<loc>${articleUrl.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}<\\/loc>\\s*<lastmod>2026-10-22<\\/lastmod>`,
    ),
  );
});
