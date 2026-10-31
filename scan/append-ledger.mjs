// Append one ledger row (JSONL, one line) for the worldwide-market copy fix.
import { readFileSync, writeFileSync } from "node:fs";

const path = "C:/tmp/world-fix/docs/plan/LEDGER.jsonl";
const src = readFileSync(path, "utf8");
const eol = src.includes("\r\n") ? "\r\n" : "\n";
console.log("ledger EOL:", JSON.stringify(eol));

const row = {
  ts: "2026-10-14",
  kind: "note",
  ref: "P9.4",
  summary:
    "The worldwide surface's currency pass: the calculator was measured for eleven markets and the three defects it proved are closed (PR #223, head af64beb). MEASURED, live, against the deployed build of the tree main serves (bigenergyco.pages.dev, c76721e), driving the real calculator in Chromium at 10 kWh/day with a 60% bill-cut goal under each market's own locale: New York, London, Berlin, Tokyo, Lagos, Delhi, Santiago, Ho Chi Minh City, Suva, Papeete, Kathmandu. PASSED IN EVERY MARKET: the currency resolved and Intl formatted it to the visitor's own conventions (GBP, EUR, JPY ￥1,148,665, NGN 1,775,324.51, INR with lakh grouping 1,79,551.44, CLP 5.258.606, VND 53.618.607, FJD 24,696.67, XPF 1 182 240 FCFP, NPR 289,567.36); the rate came from that market's own tariff box in local units (Tokyo 31.66/kWh, Berlin 0.35/kWh); units were metric; payback and the 20-year figure rendered in that currency, and the chrome followed navigator.language (Papeete's visitor gets French, which is also why that market's payback line is the one thing left UNMEASURED here - my extractor looked for English labels - rather than inferred). AGAINST THE STATIC PAGES: the page's payback year sat inside the engine's payback range in all ten markets where both were readable, and the engine's PV sat inside the page's panel band in nine and under its lower edge in two (Santiago 1.69 kW against a 2 kW floor, Papeete 1.46 kW against 1.5 kW). THE DEFECT THE LAST ROW LEFT NAMED, NOW DECIDED: every city page quoted USD-normalised benchmarks under a bare dollar sign while the calculator converts to the market's currency. Baking a static FX snapshot into 66 pages would drift against the live rate, so the page names its unit and points at the currency-converting calculator instead. THE SECOND, PROVEN BY THE SAME SAMPLE: the worked example's battery column is a flat band heuristic (10 x f x 0.7) and the generator cannot run the hourly engine, while the engine sizes the bank against the location's own darkest week - it landed ABOVE the page's 3-5 kWh band top in 8 of the 11 markets (6 kWh in New York, London, Lagos, Delhi, Papeete, Kathmandu; 7 kWh in Berlin and Tokyo) and at the band's floor in the other 3 (Santiago, Ho Chi Minh City, Suva), never below. The page now says which column the simulator re-sizes, with the reason the page itself already gives: the dark week decides the battery. THE THIRD, WHICH IS R-I18N-01 AND F-42: the results card shipped broken sentences in every market - 'Your Cut my electricity bill result', 'Measured for Cut my electricity bill against of your bill removed over 20 years' - because an imperative case label sat in a possessive slot and a label-relative metric fragment sat in a prepositional slot; and the time-of-use verdict printed cash as bare USD integers ('worth about 9720 over 20 years against a 4100 battery') with no currency anywhere. The label now follows a colon in all six locales, the fragment stays under the number it labels, and the verdict's cash slots go through money() like every other amount on the page. GATES, EACH PROVED BOTH WAYS ON THE SAME RUN: tests/i18n.test.mjs and tests/city-pages-drift.test.mjs go red against the shipped text (2 failures) and green here (15 pass), and three gates in the existing time-of-use browser-smoke phase read the RENDERED card - what CI saw is 'Your result: Save with a battery on time-of-use rates ... worth about $1,294.66 over 20 years' - because the amounts exist only where a browser paints them. No harness was added: the page check rides build-city-pages.mjs --check inside npm run seo. RELEASE RULES: asset stamp 20261005h -> 20261015a, sw.js beco-v108 -> beco-v109, and evidence/advisor-and-release.json's seo_summary moved with them, which check-evidence-freshness demanded before any of this could be green. NAMED, DELIBERATELY NOT FIXED: assets/js/sizing/charts.js injects unkeyed English prose into the cumulative-savings callout ('+~... saved over 20 years', 'Break-even in year N'), so a French visitor reads English there; check-i18n.mjs's UNKEYED rule reads shipped HTML, so no rule can see runtime-injected prose, and the repo already carries a committed 51-block ceiling for that class in HTML - keying ~6 strings across 6 locales with no gate able to hold them is a P5-sized change, not a minimal close. NOT CLAIMED: P9.4 is not complete - the country pages (P9.2) are still unbuilt, as the previous row recorded.",
  evidence: {
    pr: 223,
    head: "af64beb",
    branch: "fix/worldwide-market-copy",
    base: "c76721e",
    markets_measured: 11,
    markets_unreachable: [
      "freeoffgridcalculator.com (403 cf-mitigated: challenge to every non-browser client)",
    ],
    jev: {
      job: "jev-complete",
      scope: "P9.4",
      scoped_score: "100.00/100 (target 99) PASS",
      facets_in_scope: { seo: "proven, ordinal 100 (code)" },
      whole_program_reported_only: "95.57/100 (not this run's criterion)",
      hard_gates: [
        "tests_green",
        "smoke_green",
        "ci_green",
        "prettier_clean",
        "seo_green",
        "secrets_clean",
        "tree_clean",
      ],
      run: "https://github.com/Sovereign-Communication/BigEnergyCo/actions/runs/38667494913",
    },
    pr_checks: {
      test: "pass (3m31s)",
      "web-smoke": "pass (8m33s), including the three new use-case card gates",
      "quality-lab": "pass",
      lighthouse: "pass",
      coverage: "pass",
      "quality-evidence": "pass",
      "CodeQL/analyze": "pass",
    },
    local_preflight: {
      npm_run_seo: "exit 0 (city-pages --check, i18n gate, asset-token check OK at 20261015a, 46 referenced assets)",
      npm_test: "1674/1675 on this box; the one failure is tests/privacy-journeys.test.mjs reading jev-artifacts/privacy-browser.json while another test in the same run writes it (ok:false from this box's Chromium), reproduced in kind on the pristine c76721e tree, 14/14 standalone on both; CI green",
      check_chars: "pass",
      deploy_check: "pass",
      plan_check: "PLAN PIN OK",
      gate_byte_budgets: "0 regressions, 2 improvements",
      proven_both_ways: [
        "tests/i18n.test.mjs::use-case card sentences do not interpolate the metric fragment (red on c76721e, green here)",
        "tests/city-pages-drift.test.mjs::every city page names the unit of its money and labels the battery column (red on c76721e, green here)",
      ],
    },
    named_not_fixed: [
      "charts.js cumulative-savings callout ships unkeyed English prose into localised pages; invisible to check-i18n.mjs's UNKEYED rule, which reads shipped HTML",
      "Papeete's payback line went unread (French chrome, English labels); left unmeasured rather than inferred",
    ],
  },
};

writeFileSync(path, src + eol + JSON.stringify(row) + eol);
const after = readFileSync(path, "utf8");
console.log("rows now:", after.trim().split(/\r?\n/).length);
console.log(
  "last row parses:",
  JSON.parse(after.trim().split(/\r?\n/).pop()).evidence.pr,
);
