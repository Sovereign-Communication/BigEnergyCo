const fs = require("node:fs");
const row = {
  ts: "2026-10-22",
  kind: "note",
  ref: "P9.5",
  summary: "PR #277 audits the Hawaii 2026 solar-warning article against DCCA, FTC, and NASA primary sources, corrects cancellation and licensing guidance, and synchronizes the article, blog card, metadata, and review date. P9.5 remains open for the other posts.",
  evidence: {
    pr: 277,
    sha: "82657bdc3a2cec65d1072c129326002300175e21",
    scope: "Hawaii solar-warning article, source-backed reader guidance, card/schema parity, and focused regression test",
    audit: "docs/jev-completion/HAWAII_SOLAR_SCAMS_AUDIT_2026-10-22.md",
    sources: [
      "https://cca.hawaii.gov/ocp/state-warns-public-about-misleading-door-to-door-solar-sales/",
      "https://consumer.ftc.gov/articles/buyers-remorse-ftcs-cooling-rule-may-help",
      "https://power.larc.nasa.gov/docs/"
    ],
    focused_test: "tests/blog-hawaii-solar-scams-audit.test.mjs; 3/3",
    full_test: "npm test 1748/1748",
    preflight: ["npm test", "node scripts/check-chars.mjs", "npm run seo", "npm run format:check", "npm run deploy:check", "npm run plan:check", "npx --yes prettier@3.9.6 --check ."],
    required_ci: "CodeQL, analyze, test, web-smoke, quality-lab, lighthouse, quality-evidence, coverage, and jev-complete all succeeded on the code SHA.",
    jev: {
      run: "https://github.com/Sovereign-Communication/BigEnergyCo/actions/runs/39847628385",
      report_job: 120069612720,
      evidence_artifact: 12455728699,
      workflow_check: "success; scoped pull_request report is advisory",
      scoped_scope: "P9.5",
      scoped_score: 97.75,
      scoped_semantic_score: 92.5,
      scoped_report_pass: false,
      scoped_facets: { quality: { ordinal: 85, confidence: 0.27 }, seo: { ordinal: 100, confidence: 0.88 } },
      full_report_score: 96.57,
      full_report_pass: false,
      ratchet: "full report marked experience 85 to 35 against P9.4-baseline-2; confidence 0.00. Translation 60 is outside this English article diff.",
      v1_investigation: "Proceed after investigation: the PR changes only article/card/schema content and its regression test; DCCA, FTC, and NASA sources support the corrections; test and browser runs pass (1748/1748 and 232/232); exact-run first-run evidence records 9/9 acknowledgement steps, 3/3 actionable errors, 3 inviting empty states, 0 raw keys on 22 pages, 42/42 dictionary surfaces, and 0 axe violations. No actual risk from this change was found. The full-main score remains below the production exit bar and P9.5 remains partial."
    }
  }
};
fs.appendFileSync("docs/plan/LEDGER.jsonl", JSON.stringify(row) + "\n", "utf8");
const note = [
  "",
  "",
  "## Jev v1 investigation",
  "",
  "- On exact source SHA 82657bd, the pull-request workflow reported all required checks successful. Its `jev-complete` job is advisory for pull requests; the attached P9.5 report is not a score pass: scoped score 97.75 (semantic 92.5), with quality 85 at confidence 0.27 and SEO 100 at confidence 0.88. The report's scoped `pass` is false against the plan's 99/proven bar.",
  "- The full report is also below the production exit bar (96.57; `pass` false). It records an experience ratchet change from 85 to 35 at confidence 0.00 and translation 60 at confidence 0.62. The PR changes only article content, card/schema metadata, and a focused test; it does not change the calculator UI or translated UI strings.",
  "- Exact-run measurements show 232/232 browser-smoke gates, 9/9 acknowledgement steps, 3/3 actionable errors, 3 inviting empty states, zero raw keys on 22 pages, 42/42 dictionary surfaces, and zero axe violations. Source-backed article claims and all 1,748 tests pass. Under Jev Gate Policy v1, investigation found no actual risk from this article change, so the scoped PR proceeds with this note. This does not declare P9.5 complete or the production exit gate passed.",
  ""
].join("\n");fs.appendFileSync("docs/jev-completion/HAWAII_SOLAR_SCAMS_AUDIT_2026-10-22.md", note, "utf8");