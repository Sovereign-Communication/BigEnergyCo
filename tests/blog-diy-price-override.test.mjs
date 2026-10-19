import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { COMPLETE_FACET_CLIP } from "../scripts/lib/jev-complete.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const qualityEvidence = JSON.parse(
  readFileSync(join(ROOT, "evidence/advisor-and-release.json"), "utf8"),
).facet_evidence.quality;
const articlePath = join(
  ROOT,
  "blog/diy-vs-prebuilt-sodium-ion-lifepo4-battery-storage/index.html",
);
const article = readFileSync(articlePath, "utf8");
const articleText = article
  .replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/\s+/g, " ");

test("DIY battery article keeps the manual $80–$120/kWh materials range", () => {
  assert.match(articleText, /\$80–\$120 per usable kWh/);
  assert.match(articleText, /the \$80–\$120\/kWh manual planning range/);
  assert.match(
    articleText,
    /battery materials at source:[\s\S]*before delivery and tax/,
  );
  assert.match(articleText, /\$800–\$1,200 in DIY materials for 10 usable kWh/);
  assert.doesNotMatch(
    articleText,
    /landed DIY|landed battery materials|included in the landed/i,
  );
  assert.doesNotMatch(articleText, /\$300\s*[–-]\s*\$?500/);
  assert.doesNotMatch(articleText, /\$80\s*[–-]\s*\$?125/);
  assert.doesNotMatch(articleText, /40-60% cheaper/);
  assert.doesNotMatch(articleText, /\$120\s*[–-]\s*430 saving/);
});

test("DIY price example links and calculates a source-priced 16S build", () => {
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
    /continental U\.S\. online orders; kit DDP freight is destination-quoted/,
  );
  assert.match(
    articleText,
    /not proof of the \$80–\$120\/kWh manual planning range's endpoints or a delivered price/,
  );

  const listedSubtotal = 16 * 60 + 365;
  const nominalKwh = (16 * 280 * 3.2) / 1000;
  const usableKwh = nominalKwh * 0.8;
  assert.deepEqual(
    [
      listedSubtotal,
      Math.round(nominalKwh * 100) / 100,
      Math.round(usableKwh * 100) / 100,
      Math.round(listedSubtotal / usableKwh),
    ],
    [1325, 14.34, 11.47, 116],
  );
});

test("Jev quality evidence fits its clip and keeps the endpoint gap explicit", () => {
  assert.ok(qualityEvidence.length <= COMPLETE_FACET_CLIP);
  assert.match(qualityEvidence, /No quotes for \$80\/\$120 endpoints/);
  assert.match(qualityEvidence, /\$80–\$120 as manual estimate/);
  assert.match(
    qualityEvidence,
    /NLR 2025 ATB: \$885\/nameplate kWh.*\$1,106\/usable/,
  );
});

test("10× statement distinguishes DIY materials from installed project costs", () => {
  assert.match(articleText, /\$800–\$1,200 per usable kWh/);
  assert.match(
    articleText,
    /10× comparison is between source-price DIY materials and an installed project, not a like-for-like battery-pack comparison/,
  );
  assert.deepEqual([800 / 80, 1200 / 120], [10, 10]);
  assert.match(
    articleText,
    /budget retail battery packs remain a separate \$110–\$165\/kWh reference/i,
  );
});

test("price article has source links and a current visible review date", () => {
  assert.match(article, /article:modified_time" content="2026-10-19"/);
  assert.match(article, /"dateModified": "2026-10-19T00:00:00Z"/);
  assert.match(article, /Last reviewed[\s\S]*?19 October 2026/);
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

  const modeledPerRatedKwh = 885;
  const modeledUsableFraction = 0.8;
  assert.equal(Math.round(modeledPerRatedKwh / modeledUsableFraction), 1106);
  assert.match(
    article,
    /https:\/\/powmr\.com\/collections\/48v-lithium-battery/,
  );

  const sitemap = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
  assert.match(
    sitemap,
    /<loc>https:\/\/freeoffgridcalculator\.com\/blog\/diy-vs-prebuilt-sodium-ion-lifepo4-battery-storage\/<\/loc>\s*<lastmod>2026-10-19<\/lastmod>/,
  );
});
