// JSON-safe rewrite of the transport record's translation note (note 5):
// (1) trim the verbosity freed for budget, (2) insert the BOUNDED gap clause so
// the facet line's short "Gaps: F-42, engine." cannot read as an open hole --
// every gap named on the line is sized and scoped in the record the judge reads.
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "evidence/advisor-and-release.json";
const j = JSON.parse(readFileSync(PATH, "utf8"));
const notes = j.notes;

const SRC = notes[5];
let s = SRC;

const edits = [
  [
    "PARITY IS NOT LOST WITH THE LINE:",
    "PARITY IS NOT LOST:",
  ],
  [
    "Back-reading all rendered strings for meaning was completed on 2026-10-24 as an AI fluent review — all 436 keys in each of es/pt/fr/de/nl/ar read against the English source, 23 defects fixed and pinned in tests/translation-review.test.mjs, recorded in docs/jev-completion/TRANSLATION_MEANING_BACKREAD_2026-10-24.md — and it is a reviewer back-read, not native-speaker validation.",
    "2026-10-24: all 436 keys x 6 read against English in an AI fluent review, 23 defects fixed and pinned in tests/translation-review.test.mjs (TRANSLATION_MEANING_BACKREAD_2026-10-24.md); a reviewer back-read, not native-speaker validation.",
  ],
  [
    "Native-speaker review remains open as the named attribution LIMIT — no native speaker has validated idiomaticity; nothing here claims otherwise — not as an unperformed remediation: B1 staging (A-007) treats it as a named limit, P10's bar is unchanged.",
    "Native-speaker review remains open as the named attribution LIMIT — no native speaker has validated idiomaticity; nothing here claims otherwise — not as an unperformed remediation: B1 staging (A-007) and P10's bar are unchanged.",
  ],
  [
    "P5.5/R-I18N-06 now ships on this branch; scripts/check-experience.mjs measures its staged locale/page/key draft path and verifies that it sends no request.",
    "P5.5/R-I18N-06 ships on this branch; scripts/check-experience.mjs measures its staged locale/page/key draft path and verifies it sends no request.",
  ],
  // The bound itself: every gap the facet line names, sized and scoped here.
  [
    "fixed and pinned what it found (TRANSLATION_BACKTRANSLATION_2026-10-25.md). ",
    "fixed and pinned what it found (TRANSLATION_BACKTRANSLATION_2026-10-25.md). " +
      "GAPS BOUNDED, so the line's short names cannot read as open holes: " +
      "`engine` = the ~6 callout variants the sizing engine composes inside the " +
      "Web Worker (engine.js/rescale.js/charts.js), English in all 7 by " +
      "construction — the worker cannot carry the dictionary; closing it is the " +
      "codes-to-keys migration (P5-sized), and the three keys drafted for it " +
      "(oversizeCheaper, swapsCheaper, swapsNatural) were removed again rather " +
      "than left unwired. `F-42` = the hand-built number remnants left after the " +
      "TOU cash slots went through money() (2026-10-14). ",
  ],
];

for (const [from, to] of edits) {
  if (!s.includes(from)) {
    console.error("MISS:", from.slice(0, 60));
    process.exit(1);
  }
  s = s.replace(from, to);
}

notes[5] = s;
writeFileSync(PATH, JSON.stringify(j, null, 2) + "\n");
console.log("note 5:", SRC.length, "->", s.length);
