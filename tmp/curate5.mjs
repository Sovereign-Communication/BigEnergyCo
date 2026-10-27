// Restore the two pinned phrases my curation clipped (tests/jev-derived-facets.
// test.mjs holds them on the removal note) and free the same bytes elsewhere.
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "evidence/advisor-and-release.json";
const j = JSON.parse(readFileSync(PATH, "utf8"));
const notes = j.notes;

const edits = [
  [
    "2026-10-24: all 436 keys x 6 read against English in an AI fluent review, 23 defects fixed and pinned in tests/translation-review.test.mjs (TRANSLATION_MEANING_BACKREAD_2026-10-24.md); a reviewer back-read, not native-speaker validation.",
    "Back-reading all rendered strings for meaning was completed 2026-10-24 as an AI fluent review (436 keys x 6 against English; 23 defects fixed and pinned in tests/translation-review.test.mjs, TRANSLATION_MEANING_BACKREAD_2026-10-24.md); a reviewer back-read, not native-speaker validation.",
  ],
  [
    "P5.5/R-I18N-06 ships on this branch;",
    "P5.5/R-I18N-06 now ships on this branch;",
  ],
  [
    "GAPS BOUNDED (the line's short names, sized here):",
    "GAPS BOUNDED:",
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
