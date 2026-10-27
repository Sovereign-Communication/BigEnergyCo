// Follow-up curation: the curate3 bound was honest but too large for the
// record's headroom. Compress the bound and free the rest from the older
// notes' verbosity. Every fact stays; only repeated framing goes.
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "evidence/advisor-and-release.json";
const j = JSON.parse(readFileSync(PATH, "utf8"));
const notes = j.notes;

const edits = {
  3: [
    [
      "field, and is deliberately not replaced by a typed line. It was the only axis whose proof line was a hand-typed PROXY ('eager first-load JS is 786,390 bytes against the 790,000 budget') describing bytes rather than a measured first paint, and it went unread while a real Lighthouse measurement existed as a CI artifact.",
      "field, deliberately not replaced by a typed line. It was the only axis whose proof line was a hand-typed PROXY ('eager first-load JS is 786,390 bytes against the 790,000 budget') — bytes, not a measured first paint — and it went unread while a real Lighthouse measurement sat in a CI artifact.",
    ],
  ],
  4: [
    [
      "a true fact about this repo and a statement about nothing a visitor ever touches.",
      "a true fact about this repo, about nothing a visitor touches.",
    ],
  ],
  5: [
    [
      "field, and the axis now belongs to scripts/check-experience.mjs, which composes it from the run.",
      "field; the axis now belongs to scripts/check-experience.mjs, composed from the run.",
    ],
    [
      "the judge read its first clause about key parity, cut mid-sentence,",
      "the judge read its first clause, cut mid-sentence,",
    ],
    [
      "(still inside npm run seo, still gating both-direction parity and placeholder integrity); the composed line names it rather than claiming it.",
      "(still inside npm run seo, gating both-direction parity and placeholder integrity); the composed line names it, not claims it.",
    ],
    [
      "NOW EVIDENCED IN ITS OWN FORM (owner-directed 2026-10-25, #287 Phase 4 path): the work order's remediation — back-translate the rendered strings, read them for meaning, fix what is not actually readable — is complete.",
      "NOW EVIDENCED IN ITS OWN FORM (owner-directed 2026-10-25, #287 Phase 4): the work order's remediation — back-translate the rendered strings, read for meaning, fix what is not actually readable — is complete.",
    ],
    [
      "read every divergent string against the English source, and fixed and pinned what it found",
      "read every divergent string against English, and fixed and pinned what it found",
    ],
    [
      "GAPS BOUNDED, so the line's short names cannot read as open holes: `engine` = the ~6 callout variants the sizing engine composes inside the Web Worker (engine.js/rescale.js/charts.js), English in all 7 by construction — the worker cannot carry the dictionary; closing it is the codes-to-keys migration (P5-sized), and the three keys drafted for it (oversizeCheaper, swapsCheaper, swapsNatural) were removed again rather than left unwired. `F-42` = the hand-built number remnants left after the TOU cash slots went through money() (2026-10-14). ",
      "GAPS BOUNDED (the line's short names, sized here): `engine` = the ~6 callout variants the engine composes in the Worker (engine.js/rescale.js/charts.js), English in all 7 — the worker cannot carry the dictionary; close = codes-to-keys (P5); drafted keys oversizeCheaper/swapsCheaper/swapsNatural removed as unwired. `F-42` = hand-built number remnants post-TOU-cash fix. ",
    ],
  ],
  7: [
    [
      "against English in Spanish, Portuguese, French, German, Dutch, and Arabic.",
      "against English in all six translated locales.",
    ],
    [
      "the disposition of that clause is in the 2026-10-25 back-translation record (TRANSLATION_BACKTRANSLATION_2026-10-25.md), method in",
      "the 2026-10-25 back-translation record (TRANSLATION_BACKTRANSLATION_2026-10-25.md) disposes that clause; method in",
    ],
  ],
};

let delta = 0;
for (const [idx, pairs] of Object.entries(edits)) {
  const i = Number(idx);
  const before = notes[i].length;
  let s = notes[i];
  for (const [from, to] of pairs) {
    if (!s.includes(from)) {
      console.error("MISS note" + i + ":", from.slice(0, 70));
      process.exit(1);
    }
    s = s.replace(from, to);
  }
  notes[i] = s;
  delta += s.length - before;
  console.log("note", i, before, "->", s.length);
}

writeFileSync(PATH, JSON.stringify(j, null, 2) + "\n");
console.log("net delta:", delta);
