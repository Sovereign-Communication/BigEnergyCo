import { readFileSync } from "node:fs";
let allClean = true;
for (const f of [
  "assets/js/sizing/ui.js",
  "index.html",
  "assets/js/sizing/sizing-worker.js",
  "assets/js/sizing/run.js",
]) {
  const t = readFileSync(f, "utf8");
  const bad = /(\u00e2\u20ac|\u00c3[\u0080-\u00ff]|\u00f0\u0178|\uFFFD)/.test(
    t,
  );
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
