import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const page = read("blog/off-grid-battery-bank-sizing/index.html");
const listing = read("blog/index.html");
const rss = read("rss.xml");
const sitemap = read("sitemap.xml");
const title = "How to Size an Off-Grid Battery Bank (2026)";
const clean = (value) => value.trim().split(/\s+/).filter(Boolean).join(" ");
const graph = JSON.parse(
  page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
)["@graph"];
const faqRows = /<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>/g;

test("off-grid battery bank audit keeps claims, sources, metadata, and FAQs aligned", () => {
  const article = graph.find((item) => item["@type"] === "Article");
  const faq = graph.find((item) => item["@type"] === "FAQPage");
  const body = page.split("<article>")[1].split("</article>")[0];
  const visible = [
    ...body.split("<h2>Frequently asked</h2>")[1].matchAll(faqRows),
  ].map(([, q, a]) => [clean(q), clean(a)]);
  assert.deepEqual(
    faq.mainEntity.map(({ name, acceptedAnswer }) => [
      name,
      acceptedAnswer.text,
    ]),
    visible,
  );
  assert.equal(article.headline, title);
  assert.equal(article.dateModified, "2026-10-22T00:00:00Z");
  assert.ok(
    [
      "Last reviewed: October 22, 2026",
      'article:modified_time" content="2026-10-22"',
    ].every((value) => page.includes(value)),
  );
  assert.ok(
    [title, "Last reviewed: Oct 22, 2026", "2026-10-22T00:00:00Z"].every(
      (value) => listing.includes(value),
    ) && rss.includes(`<title>${title}</title>`),
  );

  assert.match(
    sitemap,
    /off-grid-battery-bank-sizing\/<\/loc>\s*<lastmod>2026-10-22/,
  );
  const hrefs = new Set(
    page
      .split('href="')
      .slice(1)
      .map((part) => part.split('"')[0]),
  );
  assert.equal(article.citation.filter((href) => hrefs.has(href)).length, 4);
  assert.doesNotMatch(body, /Tier [AB]|Class-T|\$45|dark-week/);
});
