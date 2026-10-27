// Pay for the honest pass-result clause. All pinned phrases stay verbatim:
// "Back-reading all rendered strings for meaning was completed", "not
// native-speaker validation", "native-speaker review remains open",
// "P5.5/R-I18N-06 now ships ... check-experience.mjs measures its staged
// locale/page/key draft path", "`translation` facet line was REMOVED".
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "evidence/advisor-and-release.json";
const j = JSON.parse(readFileSync(PATH, "utf8"));
const notes = j.notes;

const edits = [
  [
    "read every divergent string against English and dispositioned all 185 divergences blind (every material one a caught seeded control; the rest documented false positives or lexicalizations; no shipped string needed a fix beyond the 23 above) (TRANSLATION_BACKTRANSLATION_2026-10-25.md). ",
    "read every divergent string against English, dispositioned all 185 divergences blind (every material one a caught seeded control; the rest documented noise; no shipped fix beyond the 23 above) (TRANSLATION_BACKTRANSLATION_2026-10-25.md). ",
  ],
  [
    "NOW EVIDENCED IN ITS OWN FORM (owner-directed 2026-10-25, #287 Phase 4):",
    "NOW EVIDENCED (owner-directed 2026-10-25, #287 Phase 4):",
  ],
  [
    "admitted FIRST by blinded seeded controls (36/36: every seeded corruption caught, every verbatim pair cleared),",
    "admitted FIRST by blinded seeded controls (36/36: corruptions caught, verbatim pairs cleared),",
  ],
  [
    "close = codes-to-keys (P5); drafted keys oversizeCheaper/swapsCheaper/swapsNatural removed as unwired.",
    "close = codes-to-keys (P5); drafted keys removed as unwired (named in the record).",
  ],
  [
    "(436 keys x 6 against English; 23 defects fixed and pinned in tests/translation-review.test.mjs, TRANSLATION_MEANING_BACKREAD_2026-10-24.md)",
    "(436x6 against English; 23 fixes pinned in tests/translation-review.test.mjs, TRANSLATION_MEANING_BACKREAD_2026-10-24.md)",
  ],
  [
    "(still inside npm run seo, gating both-direction parity and placeholder integrity); the composed line names it, not claims it.",
    "(still inside npm run seo, gating two-direction parity and placeholder integrity); the composed line names it.",
  ],
];

const before = notes[5].length;
let s = notes[5];
for (const [from, to] of edits) {
  if (!s.includes(from)) {
    console.error("MISS:", from.slice(0, 70));
    process.exit(1);
  }
  s = s.replace(from, to);
}
notes[5] = s;
writeFileSync(PATH, JSON.stringify(j, null, 2) + "\n");
console.log("note 5:", before, "->", s.length);
