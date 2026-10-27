import { readFileSync } from "node:fs";
let allClean = true;
// Every file that ships user-facing non-ASCII text. Corruption (a UTF-8 byte
// pair read back as Latin-1, or a byte lost to U+FFFD) surfaces here first:
// the locales file carried a corrupted Arabic string that no other gate could
// see, because it was not in this list.
for (const f of [
  "assets/js/sizing/ui.js",
  "index.html",
  "assets/js/sizing/sizing-worker.js",
  "assets/js/sizing/run.js",
  "assets/i18n/en.json",
  "assets/i18n/es.json",
  "assets/i18n/pt.json",
  "assets/i18n/fr.json",
  "assets/i18n/de.json",
  "assets/i18n/ar.json",
  "assets/js/shared/i18n.js",
  "assets/js/chat.js",
  "worker/index.js",
]) {
  const t = readFileSync(f, "utf8");
  const bad =
    /(\u00e2\u20ac|\u00c3[\u0080-\u00ff]|\u00f0\u0178|\uFFFD)/.test(t) ||
    // CP1252 maps some UTF-8 continuation bytes to punctuation outside Latin-1.
    // The following check covers those forms that the Latin-1 range misses.
    /\u00c3[\u0152\u0160\u0178\u017d\u017e\u0192\u02c6\u02dc\u2013-\u2014\u2018-\u201e\u2020-\u2021\u2022\u2026\u2030\u2039\u203a\u2122]/.test(
      t,
    ) ||
    // Arabic UTF-8 bytes D8/D9 can be misread as Latin letters plus CP1252 bytes.
    (f === "assets/i18n/ar.json" &&
      /[\u00d8\u00d9][\u0080-\u00bf\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u017e\u0178]/.test(
        t,
      ));
  if (bad) allClean = false;
  console.log(f, bad ? "STILL CORRUPT" : "CLEAN");
}
const ui = readFileSync("assets/js/sizing/ui.js", "utf8");
// moneyRange joins two money() figures with an en dash — accepted either as
// the literal character or as a \u2013 escape in source.
const m = ui.match(/return money\(lo\) \+ "(.)"/);
const mEsc = ui.includes('return money(lo) + "\\u2013"');
const sep = m ? m[1] : mEsc ? "– (\\u2013 escape)" : "NOT FOUND";
console.log(
  "moneyRange separator:",
  JSON.stringify(sep),
  m ? "U+" + m[1].codePointAt(0).toString(16) : "",
);
if (!m && !mEsc) allClean = false;
// Stale ?v= stamps anywhere in the browser graph: every first-party token
// must equal the single current stamp (see bump-asset-tokens.mjs --check).
const stamps = [
  ...ui.matchAll(/\?v=([\w]+)/g),
  ...readFileSync("index.html", "utf8").matchAll(/\?v=([\w]+)/g),
].map((x) => x[1]);
const distinct = [...new Set(stamps)];
console.log("graph ?v= stamps:", distinct.join(", ") || "(none)");
if (distinct.length !== 1) allClean = false;
const html = readFileSync("index.html", "utf8");
console.log("page loads ui at:", html.match(/ui\.js\?v=(\w+)/)?.[1]);
console.log("hero CTA intact:", html.includes("Start a Free Estimate"));
if (!html.includes("Start a Free Estimate")) allClean = false;
process.exit(allClean ? 0 : 1);
