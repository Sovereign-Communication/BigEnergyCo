const fs = require("node:fs");
const path = "evidence/advisor-and-release.json";
const p = JSON.parse(fs.readFileSync(path, "utf8"));
Object.assign(p.facet_evidence, {
  correctness: "Grid-tie shows the bill-cut row; Off-grid hides it and shows 0%/1%/2%+ generator runtime (default 1%). Local Chrome smoke passed 212/212 gates on asset 20261022b and SW beco-v126.",
  quality: "npm run quality passes on 84 pages: 302/318 inline styles, no inline scripts or handlers, and all page labels, buttons, links and headings validate. CSS and markup consolidation keeps the homepage below its byte ceiling.",
  accessibility: "Chrome smoke: keyboard reaches and wraps result, quick, manual and kWh controls; all visible controls have names, AA contrast passes, and normal/reduced motion behavior passes.",
  i18n: "npm run quality: 436 keys across 6 locales; 135 hooks translate in each, placeholders match, Arabic alone flips direction. Homepage prose is keyed; tracked unkeyed prose remains 394/445.",
  seo: "npm run seo and check-chars pass sitemap, JSON-LD, metadata, i18n, CSP/headers and country pages. Asset 20261022b and SW beco-v126 match shipped bytes.",
  testing: "Freshness mutation tests inject the current tree stamp/cache before testing stale claims. Shared file-mutation locking prevents test-file races; browser smoke covers reader-visible results and recovery.",
  release: "No remote deployment is claimed. The local staged build uses asset 20261022b and SW beco-v126; release remains gated on full-head CI and the 95/95/95 promotion gate."
});
p.seo_summary = "npm run seo and check-chars validate localized homepage and chart copy, provenance, country pages, metadata and headers. Asset/cache versions are checked against shipped bytes; the rebase preserves main off-grid behavior.";
fs.writeFileSync(path, JSON.stringify(p, null, 2) + "\n");