import { readFileSync } from "node:fs";
let allClean = true;
for (const f of ["assets/js/sizing/ui.js", "index.html", "assets/js/sizing/sizing-worker.js", "assets/js/sizing/run.js"]) {
  const t = readFileSync(f, "utf8");
  const bad = /(\u00e2\u20ac|\u00c3[\u0080-\u00ff]|\u00f0\u0178|\uFFFD)/.test(t);
  if (bad) allClean = false;
  console.log(f, bad ? "STILL CORRUPT" : "CLEAN");
}
const ui = readFileSync("assets/js/sizing/ui.js", "utf8");
const m = ui.match(/moneyRange\(lo, hi\) \{ return money\(lo\) \+ "(.)"/);
console.log("moneyRange separator:", JSON.stringify(m ? m[1] : "NOT FOUND"), m ? "U+" + m[1].codePointAt(0).toString(16) : "");
console.log("ui refs at 20260824a:", (ui.match(/\?v=20260824a/g) || []).length);
const html = readFileSync("index.html", "utf8");
console.log("page loads ui at:", html.match(/ui\.js\?v=(\w+)/)?.[1]);
console.log("robot emoji intact:", html.includes("\u{1F916} Start a Free Estimate"));
process.exit(allClean ? 0 : 1);
