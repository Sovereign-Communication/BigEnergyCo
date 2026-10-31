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
    /https:\/\/www\.docanpower\.com\/china-stock\/catl-280ah-prismatic-cell/,
  );
  assert.match(
    article,
    /https:\/\/www\.docanpower\.com\/s3-diy-box-jk-bms-v19/,
  );
  assert.match(articleText, /both ex tax: 16 cells plus the kit total \$1,261/);
  assert.match(articleText, /11\.47 usable kWh at 80% depth of discharge/);
  assert.match(articleText, /not a landed quote/);

  const listedSubtotal = 16 * 56 + 365;
  const usableKwh = (16 * 280 * 3.2 * 0.8) / 1000;
  assert.equal(listedSubtotal, 1261);
  assert.equal(Math.round(listedSubtotal / usableKwh), 110);
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
    /https:\/\/atb\.nrel\.gov\/electricity\/2024\/residential_battery_storage/,
  );
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
