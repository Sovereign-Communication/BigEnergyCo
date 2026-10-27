// Scratch: assemble the diagnostic-draw evidence — the failing main run's
// record (tmp/jev-report-main/jev-evidence.json) with ONLY the translation
// material replaced: the newly composed facet line (the composer's real-run
// state) and the restructured notes from evidence/advisor-and-release.json.
// Everything else is byte-identical to the run where translation read 60, so
// each draw measures the material change and nothing else. Draws are
// diagnostics (P0.3c precedent), never recorded verdicts.
import { readFileSync, writeFileSync } from "node:fs";

const base = JSON.parse(
  readFileSync("tmp/jev-report-main/jev-evidence.json", "utf8"),
);
const prose = JSON.parse(
  readFileSync("evidence/advisor-and-release.json", "utf8"),
);

// The line in the state CI composes: sweep measured + anchors + suggestion.
const LINE =
  "7 locales x3 re-entry: keys 0/22, JS 42/42, DOM 3003/3003=dict. " +
  "Parity+ph check-i18n.mjs. Intl N/C/D+plurals. RTL ar; check-chars. " +
  "read 436x6 + back-tr. 466x6 (MT ctl 36/36): 23 fixes. " +
  "Gloss 56/56. Figs 12/12. Fix link: no send. " +
  "Gaps: F-42, engine. Limit: no native review.";

base.facet_evidence.translation = LINE;
base.notes = prose.notes;
if (Array.isArray(base.derived_facet_lines)) {
  for (const d of base.derived_facet_lines) {
    if (d.axis === "translation") d.chars = LINE.length;
  }
}
writeFileSync(
  process.argv[2] || "tmp/jev-draw-evidence.json",
  JSON.stringify(base, null, 1),
  "utf8",
);
console.log(
  "draw evidence written; translation line",
  LINE.length,
  "chars; notes",
  base.notes.length,
);
