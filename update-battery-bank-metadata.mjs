import fs from "node:fs";
const root = "C:/tmp/beco-p95-battery-bank-20261022";
const read = (path) => fs.readFileSync(`${root}/${path}`, "utf8");
const write = (path, value) => fs.writeFileSync(`${root}/${path}`, value, "utf8");
const replaceOnce = (value, before, after, label) => {
  const first = value.indexOf(before);
  if (first < 0 || value.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: expected one exact match`);
  return value.slice(0, first) + after + value.slice(first + before.length);
};
const replaceRegexOnce = (value, pattern, replacement, label) => {
  const globalPattern = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  const matches = [...value.matchAll(globalPattern)];
  if (matches.length !== 1) throw new Error(`${label}: expected one regex match, found ${matches.length}`);
  return value.replace(pattern, replacement);
};
const title = "How to Size an Off-Grid Battery Bank (2026)";
const description = "Size off-grid battery storage from the loads, backup plan, usable energy, power limits, equipment compatibility, and local installation rules.";
const oldTitle = "Battery Bank Sizing Calculator: Off-Grid Guide (2026)";
let listing = read("blog/index.html").replaceAll(oldTitle, title);
listing = replaceOnce(
  listing,
  '"description": "Usable vs nominal, series parallel math, voltage choice, and 48V worked example.",',
  `"description": "${description}",`,
  "blog schema description",
);
listing = replaceRegexOnce(
  listing,
  /("@type": "BlogPosting",\s*"headline": "How to Size an Off-Grid Battery Bank \(2026\)",\s*"name": "How to Size an Off-Grid Battery Bank \(2026\)",\s*"description": "[^"]+",\s*"datePublished": "2026-09-07T00:00:00Z",\s*"dateModified": ")2026-09-07T00:00:00Z("\s*,\s*"url": "https:\/\/freeoffgridcalculator\.com\/blog\/off-grid-battery-bank-sizing\/")/,
  (_whole, prefix, suffix) => `${prefix}2026-10-22T00:00:00Z${suffix}`,
  "blog schema review date",
);
const href = './off-grid-battery-bank-sizing/';
const anchorIndex = listing.indexOf(href);
if (anchorIndex < 0) throw new Error("visible battery-bank card not found");
const cardStart = listing.lastIndexOf('<article class="article-card">', anchorIndex);
const cardEndStart = listing.indexOf("</article>", anchorIndex);
if (cardStart < 0 || cardEndStart < 0) throw new Error("battery-bank card boundaries not found");
const cardEnd = cardEndStart + "</article>".length;
let card = listing.slice(cardStart, cardEnd);
card = replaceRegexOnce(
  card,
  /(<p class="card-excerpt">\s*)Usable vs nominal, series vs parallel, voltage choice, and worked\s*10 kWh\/day Ah math at 48V\. Free simulation\.(\s*<\/p>)/,
  "$1Loads and backup duration come first. Compare usable energy, power limits, compatible equipment, and local installation rules.$2",
  "visible card excerpt",
);
card = replaceOnce(card, '<span class="card-tag">48V</span>', "", "obsolete 48V tag");
card = replaceOnce(
  card,
  `${String.fromCodePoint(0x1f4c5)} Sep 7, 2026 · 10 min read`,
  "Last reviewed: Oct 22, 2026 · 10 min read",
  "visible card review date",
);
listing = listing.slice(0, cardStart) + card + listing.slice(cardEnd);
write("blog/index.html", listing);

let rss = read("rss.xml").replaceAll(oldTitle, title);
rss = replaceOnce(
  rss,
  "Usable vs nominal, series vs parallel, voltage choice, and 48V bank ranges for 10 kWh per day. Free simulation.",
  "Battery capacity starts with the load timeline and backup plan. Compare usable energy, power limits, product instructions, and local installation rules. Free tool.",
  "RSS description",
);
write("rss.xml", rss);
let sitemap = read("sitemap.xml");
sitemap = replaceRegexOnce(
  sitemap,
  /(<loc>https:\/\/freeoffgridcalculator\.com\/blog\/off-grid-battery-bank-sizing\/<\/loc>\s*<lastmod>)(2026-09-07)(<\/lastmod>)/,
  (_whole, prefix, _oldDate, suffix) => `${prefix}2026-10-22${suffix}`,
  "sitemap lastmod",
);
write("sitemap.xml", sitemap);