import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const html = readFileSync(
  "blog/battery-longevity-and-dod-reference/index.html",
  "utf8",
);
const start = html.indexOf("<!-- Executive Summary Callout -->");
const end = html.indexOf("3. LiFePO<sub>4</sub>", start);

test("cycle-life guidance cites test conditions and avoids a universal curve", () => {
  assert.ok(start >= 0 && end > start);
  const reviewedSection = html.slice(start, end);
  assert.match(reviewedSection, /https:\/\/www\.osti\.gov\/biblio\/1650174/);
  assert.match(
    reviewedSection,
    /https:\/\/docs\.nrel\.gov\/docs\/fy19osti\/73822\.pdf/,
  );
  assert.doesNotMatch(reviewedSection, /Wöhler|10,000 cycles|zero-swap/i);
});

test("the first battery FAQ schema matches its revised visible answer", () => {
  const json = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  assert.ok(json);
  const graph = JSON.parse(json[1]);
  const article = graph["@graph"].find((item) => item["@type"] === "Article");
  const faq = graph["@graph"].find((item) => item["@type"] === "FAQPage");
  assert.equal(article.dateModified, "2026-10-22T00:00:00Z");
  assert.equal(
    faq.mainEntity[0].name,
    "How should I compare cycle-life ratings at different DoD values?",
  );
  assert.match(
    html,
    /How should I compare cycle-life ratings at different DoD values\?/,
  );
  assert.doesNotMatch(
    faq.mainEntity[0].acceptedAnswer.text,
    /Wöhler|10,000 cycles/i,
  );
});
