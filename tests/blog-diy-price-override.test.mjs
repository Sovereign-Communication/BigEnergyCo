import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { COMPLETE_FACET_CLIP } from "../scripts/lib/jev-complete.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const articleRepoPath =
  "blog/diy-vs-prebuilt-sodium-ion-lifepo4-battery-storage/index.html";
const articlePath = join(ROOT, articleRepoPath);
const article = readFileSync(articlePath, "utf8");
const articleBody = article.match(
  /<article\b[^>]*>([\s\S]*?)<\/article>/i,
)?.[1];
assert.ok(articleBody, "reader-visible article body is present");

function visibleText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(
      /<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      " ",
    )
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(?:x([\da-f]+)|(\d+));/gi, (_, hex, decimal) => {
      const codePoint = Number.parseInt(hex ?? decimal, hex ? 16 : 10);
      return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : " ";
    })
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function gitText(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
}

function readerVisibleWordCount(html) {
  const body = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  assert.ok(
    body,
    "reader-visible article body is present in compared revision",
  );
  return (
    visibleText(body).match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []
  ).length;
}

const event = process.env.GITHUB_EVENT_PATH
  ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"))
  : {};
const baseSha =
  event.pull_request?.base?.sha ??
  process.env.PR_BASE_SHA ??
  gitText(["rev-parse", "origin/HEAD"]).trim();
const headSha =
  event.pull_request?.head?.sha ??
  process.env.PR_HEAD_SHA ??
  gitText(["rev-parse", "HEAD"]).trim();
const baseArticle = gitText(["show", `${baseSha}:${articleRepoPath}`]);
const headArticle = gitText(["show", `${headSha}:${articleRepoPath}`]);
const baseArticleWordCount = readerVisibleWordCount(baseArticle);
const headArticleWordCount = readerVisibleWordCount(headArticle);
const readerVisibleArticleText = visibleText(articleBody);
const jsonLd = [
  ...article.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi,
  ),
].map(([, source]) => JSON.parse(source));
const comparisonTable = article.match(
  /<h2>LFP vs Sodium-Ion: Current Pricing Evidence \(2026\)<\/h2>\s*<table>([\s\S]*?)<\/table>/,
)?.[1];
const finalCta = articleBody.match(
  /<div class="cta-box">([\s\S]*?)<\/div>/,
)?.[1];
const facetEvidence = JSON.parse(
  readFileSync(join(ROOT, "evidence/advisor-and-release.json"), "utf8"),
).facet_evidence;
const qualityEvidence = facetEvidence.quality;
const provenanceEvidence = facetEvidence.provenance;
const seoEvidence = facetEvidence.seo;

test("DIY price override remains an explicitly scoped planning estimate", () => {
  assert.equal(
    visibleText(
      '<p>Visible article copy.</p><script type="application/ld+json">{"price":"hidden schema copy"}</script>',
    ),
    "Visible article copy.",
  );
  assert.match(readerVisibleArticleText, /\$80–\$120 per usable kWh/);
  assert.match(
    readerVisibleArticleText,
    /DIY battery materials planning estimate \(before delivery and tax\)[\s\S]*?\$80–\$120 \(planning estimate\)[\s\S]*?\$800–\$1,200 \(planning estimate\)/,
  );
  assert.match(
    readerVisibleArticleText,
    /battery components listed below at source prices/,
  );
  assert.match(
    readerVisibleArticleText,
    /10× comparison is between source-price DIY materials and an installed project, not a like-for-like battery-pack comparison/,
  );
  assert.doesNotMatch(
    readerVisibleArticleText,
    /landed DIY|landed battery materials|included in the landed|\$300\s*[–-]\s*\$?500|\$80\s*[–-]\s*\$?125|40-60% cheaper|\$120\s*[–-]\s*430 saving/i,
  );
});

test(`PR base-to-head reader-visible article words decrease (${baseArticleWordCount} to ${headArticleWordCount})`, () => {
  assert.ok(
    baseArticleWordCount > headArticleWordCount,
    `expected fewer reader-visible article words at ${headSha} than ${baseSha}`,
  );
  assert.equal(
    readerVisibleWordCount(
      '<article><p>Reader’s visible words: $60–$120/kWh &#128242;.</p><script type="application/ld+json">{"description":"hidden schema words"}</script></article>',
    ),
    6,
    "word count excludes hidden schema text and does not count a rendered emoji entity",
  );
});

test("current LFP and installed examples state their capacity and cost scope", () => {
  assert.match(
    article,
    /https:\/\/www\.docanpower\.com\/rept-280ah-prismatic-cell/,
  );
  assert.match(
    article,
    /https:\/\/www\.docanpower\.com\/s3-diy-box-jk-bms-v19/,
  );
  assert.match(
    readerVisibleArticleText,
    /at \$60 each and its[\s\S]*at \$365, both ex tax/,
  );
  assert.match(readerVisibleArticleText, /kit fits 16 cells of 280–330Ah/);
  assert.match(
    readerVisibleArticleText,
    /14\.34 kWh nameplate, 11\.47 kWh usable at 80% DoD/,
  );
  assert.match(
    readerVisibleArticleText,
    /\$1,325, or about \$116\/usable kWh before tax\/freight/,
  );
  assert.match(
    readerVisibleArticleText,
    /Cell DDP\/CIF and kit DDP freight are excluded and quoted by destination/,
  );
  assert.match(
    readerVisibleArticleText,
    /not proof of the \$80–\$120\/kWh manual planning range's endpoints or a delivered price/,
  );
  assert.match(
    article,
    /https:\/\/atb\.nlr\.gov\/electricity\/2025\/residential_battery_storage/,
  );
  assert.match(
    readerVisibleArticleText,
    /2024 residential LFP system \(5 kW\/12\.5 kWh\) at \$885\/nameplate kWh in 2023 dollars/,
  );
  assert.match(
    readerVisibleArticleText,
    /\$37\/kWh sales tax, labor, inverter, balance of system, permitting and interconnection/,
  );
  assert.match(readerVisibleArticleText, /about \$1,106\/usable kWh/);
  assert.match(
    readerVisibleArticleText,
    /model, not a quote; shipping is not itemized/,
  );
  assert.match(readerVisibleArticleText, /planning-band endpoints/);

  const supplierTotal = 16 * 60 + 365;
  const usableKwh = (16 * 280 * 3.2 * 0.8) / 1000;
  assert.deepEqual(
    [
      supplierTotal,
      Math.round(usableKwh * 100) / 100,
      Math.round(supplierTotal / usableKwh),
      Math.round(885 / 0.8),
    ],
    [1325, 11.47, 116, 1106],
  );
});

test("chemistry comparison and CTA show only the available pricing evidence", () => {
  assert.ok(comparisonTable, "pricing comparison table is present");
  const comparisonText = visibleText(comparisonTable);
  assert.equal((comparisonTable.match(/<tr>/g) ?? []).length, 4);
  assert.match(
    comparisonText,
    /\$80–\$120\/usable kWh; planning estimate, not sourced endpoints/,
  );
  assert.match(
    comparisonText,
    /About \$116\/usable kWh; 11\.47 usable kWh, before tax and freight/,
  );
  assert.match(
    comparisonText,
    /About \$1,106\/usable kWh in the NLR 2025 ATB model/,
  );
  assert.match(
    comparisonText,
    /No sourced example; obtain a current supplier quote/,
  );
  assert.match(
    readerVisibleArticleText,
    /The sourced pricing example below is LFP; sodium-ion needs a current supplier quote/,
  );
  assert.doesNotMatch(
    readerVisibleArticleText,
    /4,000.*cycles|2,000.*cycles|20–30% lower|charges at −20°C|0V storage|sodium-ion is generally considered safer/i,
  );
  assert.ok(finalCta, "closing estimator CTA is present");
  assert.match(
    visibleText(finalCta),
    /storage capacity, solar array sizing, and raw hardware component costs/,
  );
  assert.match(visibleText(finalCta), /100% free, no signup, nothing for sale/);
  assert.doesNotMatch(
    readerVisibleArticleText,
    /Regardless of your choice, accurate planning is essential/,
  );
});

test("Jev evidence, SEO proof and JSON-LD assertions stay separately scoped", () => {
  assert.ok(qualityEvidence.length <= COMPLETE_FACET_CLIP);
  assert.match(
    qualityEvidence,
    /^P9\.5 pricing audit: tests\/blog-diy-price-override\.test\.mjs derives visible-word delta from PR base\/head; verifies source prices, scope limits, CTA and Article\/FAQ JSON-LD; 5\/5 pass\.$/,
  );
  assert.doesNotMatch(qualityEvidence, /Docan|freight|\$\d/);

  assert.ok(provenanceEvidence.length <= COMPLETE_FACET_CLIP);
  assert.match(
    provenanceEvidence,
    /^Docan: 16\u00d7\$60 REPT cells \+ \$365 JK kit = \$1,325 pre-tax; 14\.34 kWh\u00d780%=11\.47 usable kWh; \$80\u2013\$120\/kWh is a planning estimate; no sodium-ion example; freight excluded and destination-quoted\.$/,
  );

  assert.match(seoEvidence, /Asset stamp 20261022f and SW cache beco-v131/);

  const schemaNodes = jsonLd.flatMap(({ ["@graph"]: graph, ...node }) =>
    Array.isArray(graph) ? graph : [node],
  );
  const articleSchema = schemaNodes.find((node) => node["@type"] === "Article");
  const faqSchema = schemaNodes.find((node) => node["@type"] === "FAQPage");
  assert.equal(articleSchema?.dateModified, "2026-10-19T00:00:00Z");
  const pricingFaq = faqSchema?.mainEntity?.find(
    ({ name }) => name === "Is it cheaper to build your own LiFePO4 battery?",
  );
  assert.match(
    pricingFaq?.acceptedAnswer?.text ?? "",
    /\$80-\$120 per usable kWh is a DIY materials planning estimate before delivery and tax, not a sourced endpoint range/,
  );
});
