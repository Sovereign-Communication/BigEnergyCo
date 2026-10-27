import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const article = read("blog/is-a-home-battery-worth-it/index.html");
const listing = read("blog/index.html");
const title = "Is a Home Battery Worth It? A Homeowner's Decision Guide";
const clean = (value) => value.replace(/\s+/g, " ").trim();
const pair = /<summary>(.*?)<\/summary>[\s\S]*?<p>(.*?)<\/p>/gs;
test("home battery article claims, sources, metadata, card, and FAQs stay aligned", () => {
  const json = article.split('application/ld+json">')[1].split("</script>")[0];
  const faq = JSON.parse(json)["@graph"].find(
    (item) => item["@type"] === "FAQPage",
  );
  const section = article.split("<h2>Frequently asked</h2>")[1];
  const visible = [...section.matchAll(pair)].map(([, q, a]) => [
    clean(q),
    clean(a),
  ]);
  const structured = faq.mainEntity.map(({ name, acceptedAnswer }) => [
    name,
    acceptedAnswer.text,
  ]);
  assert.deepEqual(structured, visible);
  assert.ok(
    article.includes("2026-10-22T00:00:00Z") &&
      article.includes("Last reviewed: October 22, 2026") &&
      article.includes("homeowners-guide-solar") &&
      article.includes("id=Time-of-day") &&
      listing.split(title).length - 1 === 3,
  );
  assert.doesNotMatch(article, /\$|\d+ years|Honolulu|Germany/);
});
