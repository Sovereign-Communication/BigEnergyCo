// Grades the BLIND review against the sealed seeded controls.
// Run only AFTER tmp/bt-dispositions.json is written (the review is done with
// the answers unopened), so the control score cannot be fitted to the reading.
//
// Dispositions format: { "<loc>": { "<rowId>": { "verdict": "defect" |
//   "dismissed", "class": "<seed-class-if-defect>", "note": "..." } } }
// Verdict semantics for seeded rows:
//   - a corrupted seed is CAUGHT when its disposition is "defect" and its
//     class names the right corruption class;
//   - a known-good seed is CLEARED when its disposition is "dismissed".
// Non-seeded rows dispositioned "defect" are the pass's real findings.
import { readFileSync, writeFileSync } from "node:fs";

const answers = JSON.parse(readFileSync("tmp/bt-answers.json", "utf8"));
const disp = JSON.parse(readFileSync("tmp/bt-dispositions.json", "utf8"));

const CLASS_ALIAS = {
  "figure-drop": ["figure-drop", "figure", "figures", "number-drop"],
  "meaning-drop": ["meaning-drop", "truncation", "sentence-drop", "clause-drop"],
  "untranslated-english": ["untranslated-english", "untranslated", "english-passthrough", "passthrough"],
};

const classMatches = (said, truth) =>
  (CLASS_ALIAS[truth] || [truth]).some((a) => String(said || "").toLowerCase().includes(a));

const report = { control: [], real_defects: [], missed: [], false_catch: [] };
let caught = 0,
  cleared = 0,
  seeds = 0;

for (const [loc, rows] of Object.entries(answers)) {
  const d = disp[loc] || {};
  for (const r of rows) {
    seeds++;
    const got = d[r.id];
    if (r.seed === "known-good") {
      const ok = got && got.verdict === "dismissed";
      if (ok) cleared++;
      report.control.push({ loc, id: r.id, key: r.key, seed: r.seed, ok, got: got || null });
    } else {
      const ok = got && got.verdict === "defect" && classMatches(got.class, r.seed);
      if (ok) caught++;
      else report.missed.push({ loc, id: r.id, key: r.key, seed: r.seed, got: got || null });
      report.control.push({ loc, id: r.id, key: r.key, seed: r.seed, ok, got: got || null });
    }
  }
}

// Real findings: dispositions on rows that are NOT seeded.
for (const [loc, rows] of Object.entries(disp)) {
  const seededIds = new Set((answers[loc] || []).map((r) => r.id));
  for (const [id, got] of Object.entries(rows)) {
    if (seededIds.has(id)) continue;
    if (got.verdict === "defect") report.real_defects.push({ loc, id, ...got });
  }
}

const corrupted = seeds - seeds / 2; // 3 corruptions per 6 rows per locale
console.log("seeded rows:", seeds);
console.log(
  "corruptions caught:",
  caught,
  "/",
  seeds / 2,
  " known-good cleared:",
  cleared,
  "/",
  seeds / 2,
);
console.log("real defects (non-seeded, dispositioned defect):", report.real_defects.length);
for (const r of report.real_defects) console.log("  ", r.loc, r.id, r.class || "-", (r.note || "").slice(0, 70));
if (report.missed.length) {
  console.log("MISSED or misclassified controls:");
  for (const m of report.missed) console.log("  ", m.loc, m.id, m.seed, JSON.stringify(m.got));
}
writeFileSync("tmp/bt-grade-report.json", JSON.stringify(report, null, 1), "utf8");
console.log("-> tmp/bt-grade-report.json");
