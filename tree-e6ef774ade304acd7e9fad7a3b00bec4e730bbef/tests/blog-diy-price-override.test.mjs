import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { COMPLETE_FACET_CLIP } from "../scripts/lib/jev-complete.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const articlePath = join(
  ROOT,
  "blog/diy-vs-prebuilt-sodium-ion-lifepo4-battery-storage/index.html",
);
const article = readFileSync(articlePath, "utf8");
const articleText = article
  .replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/\s+/g, " ");
const comparisonTable = article.match(
  /<h2>LFP vs Sodium-Ion: Current Pricing Evidence \(2026\)<\/h2>\s*<table>([\s\S]*?)<\/table>/,
)?.[1];
const qualityEvidence = JSON.parse(
  readFileSync(join(ROOT, "evidence/advisor-and-release.json"), "utf8"),
).facet_evidence.quality;

test("DIY price override remains an explicitly scoped planning estimate", () => {
  assert.match(articleText, /\$80–\$120 per usable kWh/);
  assert.match(
    articleText,
    /DIY battery materials planning estimate \(before delivery and tax\)[\s\S]*?\$80–\$120 \(planning estimate\)[\s\S]*?\$800–\$1,200 \(planning estimate\)/,
  );
  assert.match(articleText, /battery components listed below at source prices/);
  assert.match(
    articleText,
    /10× comparison is between source-price DIY materials and an installed project, not a like-for-like battery-pack comparison/,
  );
  assert.doesNotMatch(
    articleText,
    /landed DIY|landed battery materials|included in the landed|\$300\s*[–-]\s*\$?500|\$80\s*[–-]\s*\$?125|40-60% cheaper|\$120\s*[–-]\s*430 saving/i,
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
  assert.match(articleText, /at \$60 each and its[\s\S]*at \$365, both ex tax/);
  assert.match(articleText, /kit fits 16 cells of 280–330Ah/);
  assert.match(
    articleText,
    /14\.34 kWh nameplate, 11\.47 kWh usable at 80% DoD/,
  );
  assert.match(
    articleText,
    /\$1,325, or about \$116\/usable kWh before tax\/freight/,
  );
  assert.match(
    articleText,
    /Cell DDP\/CIF and kit DDP freight are excluded and quoted by destination/,
  );
  assert.match(
    articleText,
    /not proof of the \$80–\$120\/kWh manual planning range's endpoints or a delivered price/,
  );
  assert.match(
    article,
    /https:\/\/atb\.nlr\.gov\/electricity\/2025\/residential_battery_storage/,
  );
  assert.match(
    articleText,
    /2024 residential LFP system \(5 kW\/12\.5 kWh\) at \$885\/nameplate kWh in 2023 dollars/,
  );
  assert.match(
    articleText,
    /\$37\/kWh sales tax, labor, inverter, balance of system, permitting and interconnection/,
  );
  assert.match(articleText, /about \$1,106\/usable kWh/);
  assert.match(articleText, /model, not a quote; shipping is not itemized/);
  assert.match(articleText, /planning-band endpoints/);

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
  const comparisonText = comparisonTable
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
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
    articleText,
    /The sourced pricing example below is LFP; sodium-ion needs a current supplier quote/,
  );
  assert.doesNotMatch(
    articleText,
    /4,000.*cycles|2,000.*cycles|20–30% lower|charges at −20°C|0V storage|sodium-ion is generally considered safer/i,
  );
});

test("Jev quality evidence fits its clip and preserves the remaining evidence gaps", () => {
  assert.ok(qualityEvidence.length <= COMPLETE_FACET_CLIP);
  assert.match(qualityEvidence, /Docan LFP: \$1,325 pre-tax materials/);
  assert.match(qualityEvidence, /14\.34 kWh×80%=11\.47 usable kWh/);
  assert.match(qualityEvidence, /Planning estimate: \$80–\$120\/kWh/);
  assert.match(qualityEvidence, /no sodium-ion example/);
  assert.match(
    qualityEvidence,
<<<<<<< HEAD
    /Cell and kit freight is destination-quoted and excluded/,
=======
    /^P9\.5 article \(blog\/diy-vs-prebuilt-sodium-ion-lifepo4-battery-storage\/index\.html\): 327 lines added, 659 removed \(332 net fewer\); focused test tests\/blog-diy-price-override\.test\.mjs: 4\/4 pass\.$/,
  );
  assert.doesNotMatch(qualityEvidence, /Docan|freight|\$\d/);

  assert.ok(provenanceEvidence.length <= COMPLETE_FACET_CLIP);
  assert.match(
    provenanceEvidence,
    /^Docan: 16×\$60 cells\+\$365 kit=\$1,325 pre-tax; 14\.34 kWh×80%=11\.47 usable kWh\. \$80–\$120\/kWh: estimate only; no sodium-ion example; cell\/kit freight excluded, destination-quoted\./,
>>>>>>> 467aa140 (docs(evidence): clarify P9.5 quality proof)
  );
  assert.match(
    qualityEvidence,
    /https:\/\/docanpower\.com\/rept-280ah-prismatic-cell/,
  );
  assert.match(qualityEvidence, /\/s3-diy-box-jk-bms-v19/);
});
