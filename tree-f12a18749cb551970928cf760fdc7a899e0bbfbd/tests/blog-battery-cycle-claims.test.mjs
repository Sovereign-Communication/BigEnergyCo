import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const html = readFileSync(
  "blog/battery-longevity-and-dod-reference/index.html",
  "utf8",
);
const listing = readFileSync("blog/index.html", "utf8");
const TEXT_ENTITIES = {
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};
const collectTextNodes = (value) => {
  const nodes = [];
  let inTag = false;
  let textStart = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (!inTag && value[index] === "<") {
      nodes.push(value.slice(textStart, index));
      inTag = true;
    } else if (inTag && value[index] === ">") {
      inTag = false;
      textStart = index + 1;
    }
  }
  if (!inTag) nodes.push(value.slice(textStart));
  return nodes.join("");
};
const normalizeText = (value) =>
  collectTextNodes(value)
    .replace(
      /&(amp|quot|#39|apos);/g,
      (entity) => TEXT_ENTITIES[entity] ?? entity,
    )
    .replace(/\s+/g, " ")
    .trim();

const start = html.indexOf("<!-- Executive Summary Callout -->");
const end = html.indexOf(
  "<h2>3. Chemistry does not guarantee a service life</h2>",
  start,
);

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

test("chemistry guidance avoids universal cycle-life and discharge claims", () => {
  const start = html.indexOf(
    "<h2>3. Chemistry does not guarantee a service life</h2>",
  );
  const end = html.indexOf(
    "<h2>6. Build a cost comparison from stated inputs",
    start,
  );
  assert.ok(start >= 0 && end > start);
  const chemistry = html.slice(start, end);
  assert.match(chemistry, /https:\/\/www\.osti\.gov\/biblio\/1650174/);
  assert.match(
    chemistry,
    /https:\/\/assets\.discoverbattery\.com\/documents\/07_sla\/885_product_literature\/standard-agm-battery-performance\.pdf/,
  );
  assert.match(chemistry, /Do not infer a pack's usable range/);
  assert.doesNotMatch(
    chemistry,
    /safely discharges to 0\.0V|zero capacity loss|5,500 to 6,500 cycles|6,000 to 8,000 cycles|6 to 8 years/i,
  );
});
test("the cost comparison exposes assumptions instead of promised savings", () => {
  const start = html.indexOf(
    "<h2>6. Build a cost comparison from stated inputs</h2>",
  );
  const heading = html.indexOf("7. Builder", start);
  const end = html.lastIndexOf("<h2>", heading);
  assert.ok(start >= 0 && end > start);
  const cost = html.slice(start, end);
  assert.match(
    cost,
    /Source and date,\s+currency, tax, shipping, and installation/,
  );
  assert.match(
    cost,
    /Source for cycle-life or calendar-life assumptions,\s+plus\s+labor, freight, and recycling/,
  );
  assert.doesNotMatch(
    cost,
    /\$2,375|\$3,135|\$17,000|saves \$1,990|5\.4&times;/i,
  );
});
test("the first battery FAQ schema matches its revised visible answer", () => {
  const json = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  assert.ok(json);
  const graph = JSON.parse(json[1]);
  const article = graph["@graph"].find((item) => item["@type"] === "Article");
  const faq = graph["@graph"].find((item) => item["@type"] === "FAQPage");
  assert.equal(article.dateModified, "2026-09-11T00:00:00Z");
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

test("battery FAQ schema mirrors the visible answers without universal claims", () => {
  const json = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  assert.ok(json);
  const graph = JSON.parse(json[1]);
  const faq = graph["@graph"].find((item) => item["@type"] === "FAQPage");
  const visible = [
    ...html.matchAll(
      /<div class="faq-item">\s*<div class="faq-question">([\s\S]*?)<\/div>\s*<div class="faq-answer">([\s\S]*?)<\/div>\s*<\/div>/g,
    ),
  ].map(([, question, answer]) => ({
    name: normalizeText(question),
    text: normalizeText(answer),
  }));
  const structured = faq.mainEntity.map((entry) => ({
    name: normalizeText(entry.name),
    text: normalizeText(entry.acceptedAnswer.text),
  }));
  assert.equal(visible.length, 5);
  assert.deepEqual(structured, visible);
  assert.match(html, /https:\/\/www\.catl\.com\/en\/news\/6861\.html/);
  assert.match(
    html,
    /https:\/\/assets\.discoverbattery\.com\/documents\/07_sla\/885_product_literature\/standard-agm-battery-performance\.pdf/,
  );
  assert.doesNotMatch(
    [...visible, ...structured]
      .map((entry) => `${entry.name} ${entry.text}`)
      .join(" "),
    /copper dissolves irreversibly|0\.0V without structural degradation|5,500 cycles|6 to 8 years|3 to 5 times|Wöhler exponent|10,000 cycles|saves \$1,990/i,
  );
});

test("the blog card and structured data use the revised battery guide title", () => {
  const title = "Battery cycle life and depth of discharge: a practical guide";
  assert.equal(listing.match(new RegExp(title, "g"))?.length, 3);
  assert.doesNotMatch(
    listing,
    /Zero-Swap Guide|eliminate battery replacements/i,
  );
});
