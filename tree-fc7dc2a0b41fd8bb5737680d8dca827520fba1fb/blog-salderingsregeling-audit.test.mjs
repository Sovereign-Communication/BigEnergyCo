import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const article = readFileSync(
  "blog/salderingsregeling-stopt-2027/index.html",
  "utf8",
);
const listing = readFileSync("blog/index.html", "utf8");
const flat = article.replace(/\s+/g, " ");
const jsonLd = (html) =>
  JSON.parse(
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
  );
const normalize = (text) =>
  text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

test("the Dutch article states current rules and labels the worked example as assumptions", () => {
  for (const phrase of [
    "1 januari 2027",
    "tot 1 januari 2030",
    "50% van het kale leveringstarief",
    "geen landelijk gemiddelde of actuele contractofferte",
    "vóór terugleverkosten",
    "€ 630 variabele besparing per jaar",
    "€ 84 per jaar vóór terugleverkosten",
    "geen terugverdientijd",
    "consument.acm.nl/elektriciteit-en-gas/duurzame-energie/wat-is-salderen",
    "zoek.officielebekendmakingen.nl/stcrt-2025-43817.html",
    "rijksoverheid.nl/themas/klimaat-milieu-en-natuur/energie-thuis/salderingsregeling",
  ])
    assert.ok(flat.includes(phrase), `missing: ${phrase}`);

  assert.doesNotMatch(
    flat,
    /dat is het Nederlandse gemiddelde|30% naar 60.{0,3}70%|14.{0,3}20 jaar mee|€\s*640 per jaar|€\s*90 per jaar|nog steeds een prima investering/i,
  );
  const importRate = 0.3;
  const exportRate = 0.06;
  const production = 3500;
  const consumption = 3000;
  const baselineCost = consumption * importRate;
  const savingsAt = (selfUseShare) => {
    const direct = production * selfUseShare;
    const exported = production - direct;
    const imported = consumption - direct;
    return baselineCost - (imported * importRate - exported * exportRate);
  };
  assert.equal(Math.round(savingsAt(0.3)), 462);
  assert.equal(Math.round(savingsAt(0.5)), 630);
  assert.equal(Math.round(savingsAt(0.4) - savingsAt(0.3)), 84);
  assert.doesNotMatch(article, /\p{Extended_Pictographic}/u);
});

test("visible FAQs match the FAQPage structured data", () => {
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
  assert.equal(visible.length, 5);
  assert.deepEqual(structured, visible);
});

test("review date, article metadata, and blog card remain synchronized", () => {
  const articleData = jsonLd(article)["@graph"].find(
    ({ "@type": type }) => type === "Article",
  );
  const post = jsonLd(listing).blogPost.find((item) =>
    item.url.includes("salderingsregeling-stopt-2027"),
  );
  const cardStart = listing.indexOf('href="./salderingsregeling-stopt-2027/"');
  const excerptStart = listing.indexOf('<p class="card-excerpt">', cardStart);
  const excerptEnd = listing.indexOf("</p>", excerptStart);
  const excerpt = normalize(listing.slice(excerptStart, excerptEnd));
  const description = article.match(
    /name="description"\s+content="([^"]+)"/s,
  )?.[1];
  assert.equal(articleData.dateModified, "2026-10-22T00:00:00Z");
  assert.equal(post.dateModified, articleData.dateModified);
  assert.ok(
    article.includes('<time datetime="2026-10-22">22 oktober 2026</time>'),
  );
  assert.equal(articleData.description, description);
  assert.equal(post.description, excerpt);
});
