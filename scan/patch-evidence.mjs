// The evidence record's seo_summary names the shipped asset stamp and SW cache
// version; scripts/check-evidence-freshness.mjs compares both against the tree,
// so a stamp bump without this edit is a red gate (and it was, twice).
import { readFileSync, writeFileSync } from "node:fs";

const path = "C:/tmp/world-fix/evidence/advisor-and-release.json";
const src = readFileSync(path, "utf8");
const OLD =
  "country files, asset token 20261005h, SW cache beco-v108. The stamp and cache version are asserted against the shipped bytes by scripts/check-evidence-freshness.mjs, so this line cannot name a build other than the one being shipped. This branch does touch allowlisted files (index.html's title and social descriptions), which the previous version of this line denied.";
const NEW =
  "country files, asset token 20261015a, SW cache beco-v109. The stamp and cache version are asserted against the shipped bytes by scripts/check-evidence-freshness.mjs, so this line cannot name a build other than the one being shipped. This branch does change shipped bytes — assets/js/shared/locales.js, assets/js/sizing/ui.js and all 66 generated city pages — so the stamp moved with them rather than being left standing for bytes that changed.";

const n = src.split(OLD).length - 1;
if (n !== 1) {
  console.error(`FAIL ${n} occurrences of the seo_summary tail`);
  process.exit(1);
}
writeFileSync(path, src.replace(OLD, NEW));
console.log("OK   seo_summary now names 20261015a / beco-v109");
console.log(
  JSON.parse(readFileSync(path, "utf8"))
    .seo_summary.split(": ")[1]
    .slice(0, 200),
);
