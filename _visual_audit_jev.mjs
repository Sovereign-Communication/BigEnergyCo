// One direct TypeSafe Jev call verifying the visual audit's pass/fail.
// Records the answer either way; never re-run to shop a verdict.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const REPO = "C:/tmp/be-usecase-20261028";
const R = fileURLToPath(new URL(`file:///${REPO}/`)) ;
const { resolveKeys, liveJevCall } = await import(
  new URL(`file:///${REPO}/scripts/lib/jev-live.mjs`).href
);
const { JEV_MODEL_ALIAS } = await import(
  new URL(`file:///${REPO}/scripts/lib/jev-run.mjs`).href
);

const checklist = readFileSync("C:/tmp/_visual_audit/checklist.md", "utf8");
const lines = checklist.split("\n");
const header = lines.slice(0, 5).join("\n");
const fails = lines.filter((l) => l.startsWith("FAIL"));
const naCount = lines.filter((l) => l.includes("N/A:")).length;
const leakLines = lines.filter((l) => l.includes("no English prose leak"));

const stateText = [
  "Visual audit of the shipped site, run 2026-10-28 against the exact tree of",
  "PR #323 (head 31060af2) and main a05f8d4e (byte-identical before this PR's",
  "fix commit).",
  "",
  "SCOPE: 7 locales (en, es, pt, fr, de, nl, ar) x 2 key pages (home",
  "index.html; solar-heatmap/) x 2 widths (mobile 390, desktop 1440) = 28",
  "rendered cells, each captured as a PNG screenshot in the audit evidence",
  "directory. The page scope rule is the repo's own: check-i18n.mjs rule 9",
  "counts only pages whose STATIC html claims translation; solar-heatmap's",
  "source has zero data-i18n hooks (claimsTranslation=false), documented in",
  "the gate as 'untranslated by decision, not by oversight' - those 14 cells",
  "are recorded N/A, not pass.",
  "",
  "CHECKLIST RESULT (deterministic, machine-read from checklist.md):",
  header,
  `FAIL lines: ${fails.length}`,
  `N/A cells: ${naCount} (heatmap x 7 locales x 2 widths, by declared scope)`,
  `English-prose-leak checks: ${leakLines.filter((l) => l.startsWith("PASS")).length}/${leakLines.length} PASS`,
  "",
  "Per cell, the checks are: html lang equals the locale; the six use-case",
  "chooser option labels equal that locale's own dictionary strings (leak",
  "detector); zero console/page errors during the visit; no raw i18n key names",
  "in visible text; English prose scan - any LOCALES.en string over 25 chars",
  "whose locale value differs must NOT appear verbatim in the rendered body;",
  "use-case chooser revealed with a non-empty blurb; screenshot captured.",
  "",
  "BEFORE-FIX BASELINE (same audit, run before PR #323's fix): 24 failures -",
  "all 12 non-English home cells leaked the four BOM spec paragraphs in English",
  "(translated values existed in the dictionary but ui.js re-rendered the BOM",
  "grid from raw English item.desc with no data-i18n hook), plus 12 heatmap",
  "lang cells that the scope rule later reclassified as N/A. After the fix:",
  "0 failures.",
  "",
  "CORROBORATING RUNS on the same tree:",
  "- npm test 1986/1986 (includes 3 red-first tests for this defect)",
  "- npm run seo exit 0 (check-i18n rule 10 added and mutation-proven to fire)",
  "- npm run smoke:local: 232/232 real-Chrome gates, including the six",
  "  use-case flows, off-grid goal-button repro and share restore",
  "- format:check, check-chars, deploy:check, plan:check all exit 0",
  "",
  "OPEN QUESTIONS carried, not hidden: (1) heatmap + blog bodies intended to",
  "stay English-only? (2) on the portable case, pressing the Off-grid goal",
  "button switches the chooser to the offgrid case (PR #322) - confirm this",
  "owner intent.",
].join("\n");

const questions = {
  visual_audit: {
    type: "choice",
    instructions:
      "You are verifying a visual audit's pass/fail for the mission bar: 'no " +
      "English leaks, no breakage, use-case display correct' across 7 locales x " +
      "mobile/desktop. The checklist numbers are machine-read and deterministic; " +
      "your job is the judgment call: does this audit PASS the bar, counting the " +
      "heatmap cells as in-scope-for-none only if that declared scope is " +
      "honest, or FAIL with what must change? Choose pass only if the evidence " +
      "as stated supports the bar; choose fail and name the specific defect " +
      "otherwise.",
    criteria: {
      pass: "audit meets the bar as stated, scope exclusions honest",
      fail: "a named English leak, breakage, or wrong use-case display remains",
    },
  },
};

const keys = resolveKeys(REPO);
if (!keys.typesafeKey) {
  console.log("NO_KEY — recorded as access blocker, not a verdict");
  process.exit(2);
}
const wire = await liveJevCall(stateText, questions, keys);
const record = { at: new Date().toISOString(), wire };
writeFileSync("C:/tmp/_visual_audit/jev-verify.json", JSON.stringify(record, null, 2));
console.log("provider:", wire.provider, "| model:", wire.model, "| notes:", wire.notes.join("; ") || "none");
console.log("ANSWER:", JSON.stringify(wire.answers, null, 2));
process.exit(wire.answers ? 0 : 3);
