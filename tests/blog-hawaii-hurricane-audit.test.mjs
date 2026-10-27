import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const article = readFileSync(
  "blog/hawaii-2026-hurricane-season-backup-power/index.html",
  "utf8",
);
const listing = readFileSync("blog/index.html", "utf8");
const flat = article.replace(/\s+/g, " ");
const jsonLd = (html) =>
  JSON.parse(html.match(/ld\+json">([\s\S]*?)<\/script>/)[1]);
const normalize = (text) =>
  text
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

test("storm article facts, safety advice, and sources stay evidence-based", () => {
  for (const phrase of [
    "Category 1 hurricane over the Big Island",
    "51 mph sustained wind",
    "71 mph gust",
    "federal emergency declaration",
    "90% of more than 36,000 Kauai Island Utility Cooperative customers",
    "List each critical device",
    "configured to operate in island mode",
    "at least 20 feet from buildings",
    "$400 per committed kW",
    "additional $400 per committed kW",
    "5 kW for two hours",
    "$2,000 one-time incentive",
    "five-year agreement",
    "household is served first",
    "leasing company is the system owner",
    "does not guarantee outage runtime",
  ])
    assert.ok(flat.includes(phrase), `missing: ${phrase}`);

  assert.match(flat, /late September.{0,250}flooding and road closures/i);
  assert.doesNotMatch(
    flat,
    /first hurricane-force gusts in 155 years|federal disaster declaration|92% of Kaua'i lost power|early October, no land impacts|battery wins on every axis|batteries win on everything/i,
  );

  for (const source of [
    "weather.gov/hfo/Lala2026",
    "governor.hawaii.gov/newsroom/office-of-the-governor",
    "dod.hawaii.gov/hiema/news-release-state-of-hawai",
    "weather.gov/index.php/hfo/September2026monthlysummary",
    "hawaiianelectric.com/products-and-services/customer-incentive-programs/bring-your-own-device-plus",
    "energy.gov/cmei/systems/solar-and-resilience-basics",
    "cpsc.gov/Newsroom/News-Releases/2026/CPSC-Warns-of-Generator-Carbon-Monoxide-and-Fire-Hazards-Ahead-of-Hurricane-Season",
    "fda.gov/medical-devices/emergency-situations-medical-devices/fda-offers-tips-about-medical-devices-and-natural-disasters",
  ])
    assert.ok(article.includes(source), `missing source: ${source}`);
});

test("visible storm FAQs match FAQPage structured data", () => {
  const faq = jsonLd(article)["@graph"].find(
    ({ "@type": type }) => type === "FAQPage",
  );
  const visible = [
    ...article.matchAll(
      /<details>\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>\s*<\/details>/g,
    ),
  ].map(([, question, answer]) => [normalize(question), normalize(answer)]);
  const structured = faq.mainEntity.map((entry) => [
    normalize(entry.name),
    normalize(entry.acceptedAnswer.text),
  ]);
  assert.equal(visible.length, 4);
  assert.deepEqual(structured, visible);
});

test("review date and blog card match Article and BlogPosting metadata", () => {
  const articleData = jsonLd(article)["@graph"].find(
    ({ "@type": type }) => type === "Article",
  );
  const post = jsonLd(listing).blogPost.find((item) =>
    item.url.includes("hurricane-season-backup-power"),
  );
  assert.equal(articleData.dateModified, "2026-10-22T00:00:00Z");
  assert.equal(post.dateModified, articleData.dateModified);
  assert.ok(article.includes("Last reviewed: October 22, 2026"));
  assert.match(listing, /Oct 22, 2026/);
  assert.ok(
    listing.includes("Verified reports on Hurricanes Lala, Lowell, and Nolo"),
  );
  assert.doesNotMatch(listing, /pays you to need the grid less/);
});
