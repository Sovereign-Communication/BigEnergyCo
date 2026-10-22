import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const article = readFileSync(
  "blog/diy-vs-prebuilt-sodium-ion-lifepo4-battery-storage/index.html",
  "utf8",
);

const normalize = (value) =>
  value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const range = (startHeading, endHeading) => {
  const start = article.indexOf(startHeading);
  const end = article.indexOf(endHeading, start);
  assert.ok(start >= 0 && end > start, `${startHeading} section exists`);
  return article.slice(start, end);
};

test("battery chemistry guidance cites scoped evidence and removes universal ratings", () => {
  const comparison = range(
    "<h2>LiFePO4: read the model-specific data</h2>",
    "<h2>The Honest Disadvantages of DIY Builds</h2>",
  );

  assert.match(comparison, /https:\/\/www\.osti\.gov\/biblio\/1650174/);
  assert.match(comparison, /https:\/\/www\.catl\.com\/en\/news\/6861\.html/);
  assert.doesNotMatch(
    comparison,
    /4,000\s*-\s*6,000|2,000\s*-\s*4,000|safe to store fully discharged|non-flammable electrolyte|160\s*Wh\/kg|100-130\s*Wh\/kg|1\.5V to 3\.65V/i,
  );
  assert.match(comparison, /mark it unknown/i);
});

test("chemistry-related DIY FAQs match their visible and structured answers", () => {
  const schemaScripts = [
    ...article.matchAll(
      /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ].map((match) => JSON.parse(match[1]));
  const nodes = schemaScripts.flatMap((document) =>
    Array.isArray(document["@graph"]) ? document["@graph"] : [document],
  );
  const faq = nodes.find((node) => node["@type"] === "FAQPage");
  assert.ok(faq, "FAQPage JSON-LD exists");

  const questions = [
    "Can I mix sodium-ion and LFP cells?",
    "How many cycles does a DIY LFP battery last?",
    "What is the best BMS for DIY sodium-ion builds?",
    "Is sodium-ion safer than LiFePO4?",
    "How do I calculate the size of my DIY battery?",
    "Do I need a license to build a DIY battery for off-grid use?",
  ];

  for (const question of questions) {
    const structured = faq.mainEntity.find((item) => item.name === question);
    assert.ok(structured, `FAQPage includes ${question}`);
    const questionIndex = article.lastIndexOf(question);
    const answerOpen = article.indexOf(
      '<div class="faq-answer">',
      questionIndex,
    );
    const answerStart = article.indexOf(">", answerOpen) + 1;
    const answerEnd = article.indexOf("</div>", answerStart);
    assert.ok(answerEnd > answerStart, `${question} has a visible answer`);
    assert.equal(
      normalize(article.slice(answerStart, answerEnd)),
      structured.acceptedAnswer.text,
      `${question} visible answer matches FAQPage JSON-LD`,
    );
  }

  assert.match(article, /https:\/\/www\.catl\.com\/en\/news\/665\.html/);
});

test("DIY safety guidance avoids universal assembly and fire-response instructions", () => {
  const safety = range(
    "<h2>Safety, installation and emergency planning</h2>",
    "<h2>Related guides</h2>",
  );

  assert.match(safety, /licensed electrician/);
  assert.match(safety, /local emergency services/);
  assert.match(safety, /off-grid status alone does not establish an exemption/i);
  assert.match(safety, /https:\/\/fsri\.org\//);
  assert.match(safety, /https:\/\/www\.nfpa\.org\/codes-and-standards\//);
  assert.match(safety, /https:\/\/www\.usfa\.fema\.gov\//);
  assert.doesNotMatch(safety, /class d|5.?7\s*nm|fused appropriately|never work alone/i);
});
