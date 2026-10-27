// Final note-5 clause: state the graded outcome exactly. The pass found NO
// shipped defect (every material divergence was a seeded control the review
// caught); the old phrasing "fixed and pinned what it found" would imply fixes
// this pass never made. The 23 fixes stay attributed to the 2026-10-24 pass.
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "evidence/advisor-and-release.json";
const j = JSON.parse(readFileSync(PATH, "utf8"));
const notes = j.notes;

const FROM =
  "read every divergent string against English, and fixed and pinned what it found (TRANSLATION_BACKTRANSLATION_2026-10-25.md). ";
const TO =
  "read every divergent string against English and dispositioned all 185 " +
  "divergences blind (every material one a caught seeded control; the rest " +
  "documented false positives or lexicalizations; no shipped string needed a " +
  "fix beyond the 23 above) (TRANSLATION_BACKTRANSLATION_2026-10-25.md). ";

const before = notes[5].length;
let s = notes[5];
if (!s.includes(FROM)) {
  console.error("MISS: pass-result clause");
  process.exit(1);
}
s = s.replace(FROM, TO);
notes[5] = s;
writeFileSync(PATH, JSON.stringify(j, null, 2) + "\n");
console.log("note 5:", before, "->", s.length);
