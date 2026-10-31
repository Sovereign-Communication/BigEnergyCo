// What the judge actually reads: the record is clipped per part on the way to
// the judge (scripts/lib/jev-complete.mjs). A corrected sentence that overflows
// its clip never arrives, so this measures each part against its own bound.
import { readFileSync } from "node:fs";

const ROOT = "C:/tmp/gate-freshness";
const {
  COMPLETE_FACET_CLIP,
  buildStateText,
  stateTextBudget,
} = await import(`file:///${ROOT}/scripts/lib/jev-complete.mjs`);

const file = process.argv[2] || `${ROOT}/evidence/advisor-and-release.json`;
const ev = JSON.parse(readFileSync(file, "utf8"));
const pack = JSON.parse(
  readFileSync(`${ROOT}/scripts/lib/jev-complete.pack.json`, "utf8"),
);
const axes = Object.keys(pack.axes || {}).length
  ? Object.keys(pack.axes)
  : Object.keys(ev.facet_evidence || {});

const CLIPS = {
  tests_summary: 300,
  ci_summary: 320,
  smoke_note: 460,
  seo_summary: 260,
  advisor_audit: 480,
  prettier_clean_summary: null,
};

console.log("file:", file);
for (const [field, clip] of Object.entries(CLIPS)) {
  const text = ev[field];
  if (typeof text !== "string") continue;
  const over = clip && text.length > clip;
  console.log(
    `${field.padEnd(24)} ${String(text.length).padStart(5)} chars` +
      (clip ? ` / ${clip} clip` : "") +
      (over ? "   <-- OVER: the judge reads only the first " + clip : "   ok"),
  );
}
let overFacets = 0;
for (const [axis, line] of Object.entries(ev.facet_evidence || {})) {
  const len = String(line).length;
  if (len > COMPLETE_FACET_CLIP) {
    overFacets += 1;
    console.log(
      `facet ${axis.padEnd(18)} ${String(len).padStart(5)} / ${COMPLETE_FACET_CLIP}   <-- OVER: cut mid-sentence`,
    );
  }
}
const text = buildStateText(ev, { target: "local", sha: "0".repeat(40) }, axes);
console.log(
  `\naxes declared: ${axes.length}` +
    `\ntransport: ${text.length} / ${stateTextBudget(axes)} chars` +
    ` (${stateTextBudget(axes) - text.length} headroom)`,
);
console.log(
  `facets over their ${COMPLETE_FACET_CLIP}-char clip: ${overFacets}` +
    `\nnotes carried: ${(ev.notes || []).length}, notes chars: ` +
    `${(ev.notes || []).join(" | ").length}`,
);
