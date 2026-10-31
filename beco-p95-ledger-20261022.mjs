import fs from "node:fs";
const path = "docs/plan/LEDGER.jsonl";
const row = {
  ts: "2026-10-22",
  kind: "note",
  ref: "P9.5",
  summary: "PR #282 audits the solar bill-savings guide: removes unsupported universal bill-cut, payback, regional-rate, and component-price claims; adds DOE, NASA POWER, and NREL references; and synchronizes visible copy, FAQs, Article/BlogPosting data, the blog card, review date, and sitemap. P9.5 remains open for the other articles.",
  evidence: {
    pr: 282,
    sha: "41735762d3bddedee9e971670939f8b2879344fa",
    requirement: "R-CONT-05",
    scope: "one article claim audit with visible/structured parity, source links, review date, and regression coverage",
    sources: [
      "https://www.energy.gov/cmei/systems/homeowners-guide-solar",
      "https://power.larc.nasa.gov/docs/services/api/temporal/hourly/",
      "https://pvwatts.nrel.gov/"
    ],
    focused_test: "tests/blog-solar-bill-claims.test.mjs; 4/4",
    full_test: "npm test; 1761/1761",
    preflight: [
      "npm test",
      "node scripts/check-chars.mjs",
      "npm run seo",
      "npm run format:check",
      "npm run deploy:check",
      "npm run plan:check",
      "npx --yes prettier@3.9.6 --check ."
    ],
    byte_budgets: "0 regressions, 2 improvements, 3 pre-existing reported breaches",
    jev: {
      run: "https://github.com/Sovereign-Communication/BigEnergyCo/actions/runs/39877973809",
      report: {
        scope: "P9.5",
        score: 97.36,
        semantic_score: 91.19,
        pass: false,
        hard_gates_passed: true
      },
      scoped: {
        score: 97.75,
        semantic_score: 92.5,
        pass: false,
        ratchet: "met",
        facets_short_of_proven: ["quality"],
        quality_ordinal: 85,
        quality_confidence: 0.34,
        seo_ordinal: 100,
        seo_confidence: 0.82
      },
      v1_investigation: "Reviewed the exact article diff, the linked DOE/NASA/NREL sources, visible FAQs against FAQPage data, title and dates against Article/BlogPosting/card metadata, the accessible comparison table, and the focused plus full test suites. Found no concrete factual, product, accessibility, parity, or regression risk. Quality is ordinal 85 (the policy's lowest clearable band), SEO is proven, and the all-facet ratchet is met. Under Jev Gate Policy v1, the below-bar signal was investigated and cleared for this scoped change; the full-main 95/95/95 release gate remains a separate blocker."
    }
  }
};
const text = fs.readFileSync(path, "utf8");
if (!text.endsWith("\n")) throw new Error("LEDGER.jsonl must end in a newline");
if (text.includes('"pr":282')) throw new Error("PR #282 ledger row already exists");
fs.appendFileSync(path, JSON.stringify(row) + "\n", "utf8");
