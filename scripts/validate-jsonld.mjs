// Validate JSON-LD blocks on all public pages. Run: node scripts/validate-jsonld.mjs
import { readFileSync } from "node:fs";

const pages = [
  "index.html",
  "blog/index.html",
  "blog/off-grid-vs-grid-tie-payback/index.html",
  "blog/diy-vs-prebuilt-sodium-ion-lifepo4-battery-storage/index.html",
];

let failures = 0;
for (const page of pages) {
  const html = readFileSync(page, "utf8");
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!blocks.length) { console.log(`${page}: NO JSON-LD (ok only for utility pages)`); continue; }
  for (const [i, m] of blocks.entries()) {
    try {
      const data = JSON.parse(m[1]);
      const types = (data["@graph"] ? data["@graph"] : [data]).map((n) => n["@type"]).flat();
      console.log(`OK   ${page} [block ${i + 1}]: ${types.join(", ")}`);
    } catch (e) {
      console.error(`FAIL ${page} [block ${i + 1}]: ${e.message}`);
      failures++;
    }
  }
}
process.exit(failures ? 1 : 0);
