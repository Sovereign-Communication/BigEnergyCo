import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

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
  assert.match(articleText, /at \$60 each ex tax/);
  assert.match(articleText, /at \$365 ex tax/);
  assert.match(articleText, /specified for 16 cells of 280–330Ah/);
  assert.match(articleText, /Sixteen cells plus the kit total \$1,325/);
  assert.match(
    articleText,
    /14\.34 kWh nominal capacity and provides 11\.47 usable kWh at 80% depth of discharge/,
  );
  assert.match(
    articleText,
    /about \$116\/usable kWh before tax and destination freight/,
  );
  assert.match(
    articleText,
    /online-order listing to the continental United States/,
  );
  assert.match(articleText, /DDP shipping cost is quoted by destination/);
  assert.match(articleText, /not a delivered price/);
  assert.match(articleText, /does not substantiate the range endpoints/);

  const listedSubtotal = 16 * 60 + 365;
  const nominalKwh = (16 * 280 * 3.2) / 1000;
  const usableKwh = nominalKwh * 0.8;
  assert.equal(listedSubtotal, 1325);
  assert.equal(Math.round(nominalKwh * 100) / 100, 14.34);
  assert.equal(Math.round(usableKwh * 100) / 100, 11.47);
  assert.equal(Math.round(listedSubtotal / usableKwh), 116);
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
    /2024 5-kW\/12\.5-kWh LFP system at \$885\/nameplate kWh in 2023 dollars/,
  );
  assert.match(articleText, /about \$1,106\/usable kWh/);
  assert.match(articleText, /sales tax/);
  assert.match(articleText, /shipping is not separately itemized/);
  assert.match(
    articleText,
    /band remains a planning estimate rather than source-quoted endpoints/,
  );

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
