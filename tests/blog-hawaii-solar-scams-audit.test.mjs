import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const articleHtml = readFileSync(
  "blog/hawaii-solar-scams-2026-warning/index.html",
  "utf8",
);
const listingHtml = readFileSync("blog/index.html", "utf8");
const canonicalHtml = readFileSync(
  "blog/is-a-home-battery-worth-it/index.html",
  "utf8",
);
const readSchema = (html) =>
  JSON.parse(
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
  );
const articleSchema = readSchema(articleHtml);
const listingSchema = readSchema(listingHtml);
const walk = function* (value) {
  if (Array.isArray(value)) {
    for (const item of value) yield* walk(item);
  } else if (value && typeof value === "object") {
    yield value;
    for (const child of Object.values(value)) yield* walk(child);
  }
};
const articleData = [...walk(articleSchema)].find(
  (node) =>
    node["@type"] === "Article" &&
    node["@id"] ===
      "https://freeoffgridcalculator.com/blog/hawaii-solar-scams-2026-warning/#article",
);
const listingData = [...walk(listingSchema)].find(
  (node) =>
    node["@type"] === "BlogPosting" &&
    node.url ===
      "https://freeoffgridcalculator.com/blog/hawaii-solar-scams-2026-warning/",
);
const cards = [
  ...listingHtml.matchAll(/<article class="article-card">[\s\S]*?<\/article>/g),
];
const card = cards.find((match) =>
  match[0].includes("./hawaii-solar-scams-2026-warning/"),
)?.[0];
const cardExcerpt = card?.match(/<p class="card-excerpt">([\s\S]*?)<\/p>/)?.[1];
const normalize = (text) =>
  text
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
const body = articleHtml.match(/<main>([\s\S]*?)<\/main>/)[1];
const flatBody = normalize(body);

test("Hawaii solar warning audit stays source-backed and accurately dated", () => {
  assert.ok(articleData, "article JSON-LD is present");
  assert.ok(listingData, "matching blog index BlogPosting is present");
  assert.equal(articleData.datePublished, "2026-10-15T00:00:00Z");
  assert.equal(articleData.dateModified, "2026-10-22T00:00:00Z");
  assert.equal(listingData.dateModified, articleData.dateModified);
  assert.ok(
    articleHtml.includes(
      'property="article:modified_time" content="2026-10-22"',
    ),
  );
  assert.ok(articleHtml.includes("Last reviewed: October 22, 2026"));
});

test("visible article and blog card carry the reviewed claims, not hidden FAQ markup", () => {
  const description = articleHtml.match(
    /<meta\s+name="description"\s+content="([^"]+)"/,
  )?.[1];
  assert.equal(description, articleData.description);
  assert.equal(listingData.description, normalize(cardExcerpt));
  assert.ok(card, "article card links to the audited article");
  assert.ok(
    ![...walk(articleSchema)].some((node) => node["@type"] === "FAQPage"),
  );
  for (const phrase of [
    "reported deceptive and misleading claims",
    "Claiming your contractor went out of business",
    "The DCCA says consumers have three business days after a door-to-door sale to cancel",
    "federal coverage is limited to certain sales",
    "Treat the result as a model, not a roof inspection or guarantee",
  ]) {
    assert.ok(flatBody.includes(phrase), "missing reviewed claim: " + phrase);
  }
  for (const stale of [
    "working right now",
    "they're lying to homeowners",
    "No license, no signature",
    "record the interaction",
    "the economics can be excellent",
  ]) {
    assert.ok(
      !flatBody.includes(stale),
      "stale overstatement remains: " + stale,
    );
  }
});

test("claim links and shared article style remain intact", () => {
  for (const source of [
    "https://cca.hawaii.gov/ocp/state-warns-public-about-misleading-door-to-door-solar-sales/",
    "https://consumer.ftc.gov/articles/buyers-remorse-ftcs-cooling-rule-may-help",
    "https://businesscheck.hawaii.gov",
    "https://consumercomplaint.hawaii.gov",
    "https://power.larc.nasa.gov/docs/",
  ]) {
    assert.ok(
      articleHtml.includes('href="' + source + '"'),
      "missing source: " + source,
    );
  }
  const styleBlock = (html) => html.match(/<style>[\s\S]*?<\/style>/)?.[0];
  assert.equal(styleBlock(articleHtml), styleBlock(canonicalHtml));
});
