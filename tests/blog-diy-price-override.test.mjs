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

test("DIY cost guidance compares full scope without a retailer price snapshot", () => {
  assert.ok(
    /Compare written quotes using the same capacity and output/.test(article),
  );
  assert.ok(
    /electrical protection, licensed electrical work, permits, inspection/.test(
      article,
    ),
  );
  assert.ok(
    /claim a universal DIY saving or current per-kWh price/.test(article),
  );
  assert.equal(
    /Docan|REPT|Apex 280|JK BMS|docanpower\.com|\$80(?:\u2013|-)\$120|\$1,325|\$116 per usable kWh/.test(
      article,
    ),
    false,
    "retailer names and unsupported price snapshots are absent",
  );
});

test("visible DIY price FAQ and Article/FAQ structured data agree", () => {
  const documents = [
    ...article.matchAll(
      /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ].map((match) => JSON.parse(match[1]));
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
  const visible = article
    .slice(answerStart, answerEnd)
    .replace(/\s+/g, " ")
    .trim();
  assert.equal(visible, structured.acceptedAnswer.text);
  assert.match(visible, /no universal per-kWh price or savings guarantee/);
  assert.equal(/\$|Docan|REPT|docanpower/.test(visible), false);
  assert.match(article, /article:modified_time" content="2026-10-22"/);
  assert.match(article, /"dateModified": "2026-10-22T00:00:00Z"/);
});
