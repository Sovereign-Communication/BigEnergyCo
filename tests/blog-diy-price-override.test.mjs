import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const article = readFileSync(
  new URL(
    "../blog/diy-vs-prebuilt-sodium-ion-lifepo4-battery-storage/index.html",
    import.meta.url,
  ),
  "utf8",
);
const faqQuestion = "Is it cheaper to build your own LiFePO4 battery?";

test("DIY price snapshot is sourced, scoped, and arithmetically correct", () => {
  assert.match(article, /owner-supplied \$80–\$120 per usable/);
  assert.match(article, /https:\/\/www\.docanpower\.com\/rept-280ah-prismatic-cell/);
  assert.match(article, /https:\/\/www\.docanpower\.com\/s3-diy-box-jk-bms-v19/);
  assert.match(article, /kit listing is inquiry-only/);
  assert.match(article, /about \$116 per usable kWh/);
  assert.doesNotMatch(
    article,
    /40-60% cheaper|prices ranging from \$800 to \$1,200 per kWh|cost per kWh of \$300 to \$500|50% to 70%/,
  );

  const nameplateKwh = (16 * 3.2 * 280) / 1000;
  const usableKwh = nameplateKwh * 0.8;
  const materialPrice = 16 * 60 + 365;
  assert.equal(nameplateKwh.toFixed(2), "14.34");
  assert.equal(usableKwh.toFixed(2), "11.47");
  assert.equal(Math.round(materialPrice / usableKwh), 116);
});

test("visible DIY price FAQ and Article/FAQ structured data agree", () => {
  const documents = [...article.matchAll(
    /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  )].map((match) => JSON.parse(match[1]));
  const nodes = documents.flatMap((document) =>
    Array.isArray(document["@graph"]) ? document["@graph"] : [document],
  );
  const faq = nodes.find((node) => node["@type"] === "FAQPage");
  assert.ok(faq, "FAQPage JSON-LD exists");
  const structured = faq.mainEntity.find((item) => item.name === faqQuestion);
  assert.ok(structured, "pricing question exists in FAQPage JSON-LD");

  const questionIndex = article.lastIndexOf(faqQuestion);
  const answerOpen = article.indexOf('<div class="faq-answer">', questionIndex);
  const answerStart = article.indexOf(">", answerOpen) + 1;
  const answerEnd = article.indexOf("</div>", answerStart);
  const visible = article.slice(answerStart, answerEnd).replace(/\s+/g, " ").trim();
  assert.equal(visible, structured.acceptedAnswer.text);
  assert.match(article, /article:modified_time" content="2026-10-22"/);
  assert.match(article, /"dateModified": "2026-10-22T00:00:00Z"/);
});
