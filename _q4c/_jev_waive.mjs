// One direct TypeSafe Jev call: waive-vs-fix verification for the google-quality
// gate at the 99/100 standard. Records the answer either way.
import { writeFileSync } from "node:fs";

const REPO = "C:/tmp/be-usecase-20261028";
const { resolveKeys, liveJevCall } = await import(
  new URL(`file:///${REPO}/scripts/lib/jev-live.mjs`).href
);

const stateText = [
  "Google-quality gate assessment at the owner's 99/100 bar (plan section 3:",
  "'a metric scored out of 100 must reach >= 99; anything else must meet the",
  "numeric threshold below'). Evidence: CI run 40759020223 on PR #323 head",
  "31060af2, plus the local gate set on the byte-identical tree.",
  "",
  "GATE RESULTS AT THE STANDARD:",
  "- seo (site integrity suite): PASS, exit 0. check-i18n: I18N OK, 466 keys x",
  "  100% of HTML hooks in es/pt/fr/de/nl/ar; provenance OK (17 assumption",
  "  families, 7 sources); asset-token stamp 20261028c verified; 66 city pages",
  "  match generator output.",
  "- lighthouse (Q-02, mobile + desktop, 14 targets x3): accessibility",
  "  100/100/100 (min/median/max) both viewports; seo 100/100/100 both;",
  "  best-practices 100 (ratcheted). 'no regression against the declared",
  "  floor'. Performance: mobile 61-73 (median 64), desktop 56-75 (median 56).",
  "- quality-evidence: PASS - committed evidence files asserted in their bar",
  "  (a11y_matrix Q-07, etc.).",
  "- quality-lab: PASS - a11y-matrix and lab steps green.",
  "- web-smoke: PASS - 232/232 real-Chrome gates (CI) and 232/232 locally.",
  "- test: 1986/1986 (100%), includes red-first i18n and usecase tests.",
  "- coverage: lines 69.12 (floor 66), branches 79.91 (floor 76), functions",
  "  64.55 (floor 60) - all above declared numeric thresholds.",
  "",
  "WAIVERS RECORDED WITH REASONS (each printed by its own gate):",
  "W1. Lighthouse performance is REPORTED, not ratcheted. Reason in-gate: on an",
  "  unchanged tree the composite is bimodal over 21 runs (home/mobile 61-73,",
  "  heatmap/desktop 40-76) because it is dominated by Lighthouse's SIMULATED",
  "  throttling model; the bootstrapped median is still 18 points wide at k=21,",
  "  so no affordable run count makes a floor reproducible, and a floor that",
  "  wide would not catch a real regression. Reading reported with its spread.",
  "W2. Unkeyed prose ceiling 485, current 371/485 on translated pages. Reason",
  "  in-gate: blog article bodies are English-only by product decision (nav",
  "  hooks claim translation), with measured raises for header unification",
  "  (51->422), a new blog card (422->423), a new blog post (423->445) and two",
  "  deliberate Dutch exceptions (445->485). The home page itself is at zero",
  "  unkeyed prose (strict check). Flagged 'known, tracked, must fall'.",
  "W3. Translation facet reads ordinal 85 (confidence 0.38-0.43), not proven/100.",
  "  This is NOT a waiver: staging policy min is 85 with confidence as",
  "  telemetry; program exit (95/95/95) reports it REMAINING, never passed.",
  "  Gate score 96.79 >= 95 staging bar.",
  "",
  "RECENT FIX DIRECTION (suggests 'fix' is working where cheap): this PR fixed",
  "the runtime-rendered BOM English leak with existing translations (rule 10",
  "added), and PR #322 fixed the use-case single-writer defect - both red-first.",
].join("\n");

const questions = {
  waive_vs_fix: {
    type: "choice",
    instructions:
      "For each recorded waiver W1-W3, judge whether keeping the WAIVER is " +
      "honest at the 99/100 standard or whether it should be a FIX instead. " +
      "Choose 'waive' only when the reason is measured and a fix would be " +
      "theater; choose 'fix' and name the concrete fix when the standard is " +
      "actually unmet for a closable reason. Also answer overall: is the " +
      "google-quality gate green at the standard as reported?",
    criteria: {
      waive: "reason measured, fix would be theater or impossible",
      fix: "standard unmet for a closable reason; name the fix",
    },
  },
  gate_green: {
    type: "choice",
    instructions:
      "Is the seven-gate google-quality set (seo, lighthouse, quality-evidence,",
    criteria: {},
  },
};

// Second question written fully (the truncated one above is replaced here).
questions.gate_green = {
  type: "choice",
  instructions:
    "Is the seven-gate google-quality set (seo, lighthouse, quality-evidence, " +
    "quality-lab, web-smoke, test, coverage) green at the 99/100 standard as " +
    "reported above? Choose green only if the numbers as stated support it.",
  criteria: {
    green: "all seven green at the standard, waivers honest",
    not_green: "a named gate or number is below the standard",
  },
};

const keys = resolveKeys(REPO);
if (!keys.typesafeKey) {
  console.log("NO_KEY — access blocker recorded");
  process.exit(2);
}
const wire = await liveJevCall(stateText, questions, keys);
writeFileSync(
  "C:/tmp/_q4c/jev-waive-vs-fix.json",
  JSON.stringify({ at: new Date().toISOString(), wire }, null, 2),
);
console.log("provider:", wire.provider, "| model:", wire.model, "| notes:", wire.notes.join("; ") || "none");
console.log("ANSWERS:", JSON.stringify(wire.answers, null, 2));
process.exit(wire.answers ? 0 : 3);
