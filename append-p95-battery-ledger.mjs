import fs from "node:fs";
const path = "C:/tmp/beco-p95-battery-bank-20261022/docs/plan/LEDGER.jsonl";
const row = {
  ts: "2026-10-22",
  kind: "note",
  ref: "P9.5",
  summary: "PR #286 audits the off-grid battery-bank sizing guide, removes unsupported universal chemistry, capacity, price, and wiring claims, and aligns its product-specific sizing guidance, sources, FAQ schema, visible card, RSS entry, and review date.",
  evidence: {
    pr: 286,
    sha: "0cda8636bde862220a4372f662634566db59e05f",
    scope: "blog/off-grid-battery-bank-sizing/index.html",
    sources: [
      "https://sam.nrel.gov/battery-storage/",
      "https://www.victronenergy.com/media/pg/Lithium_Battery_Smart/en/operation.html",
      "https://www.nfpa.org/codes-and-standards/nfpa-standard-development/855",
      "https://www.ul.com/resources/installation-codes-and-requirements-energy-storage-systems-ess-faqs",
    ],
    tests: {
      npm_test: "1775/1775",
      article_audit: "passed",
      blog_style: "passed",
      local_preflight: "seo, format, deploy check, plan pin, character check, Prettier, and byte budget passed",
    },
  },
};
const current = fs.readFileSync(path, "utf8");
if (!current.endsWith("\n")) fs.appendFileSync(path, "\n");
fs.appendFileSync(path, `${JSON.stringify(row)}\n`);