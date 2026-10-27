// Scratch instrument for the 2026-10-25 back-translation pass (NOT committed;
// per ISSUE_287_TRANSLATION_PATH.md §3, experiment tooling with live payloads or
// seeded answers stays on the working machine; the record documents the method).
//
// Generates one worksheet per locale: every rendered dictionary key (LOCALES +
// HOME_COPY) as `key<TAB>en-source<TAB>locale-value`, with 6 SEEDED CONTROL ROWS
// mixed in at random positions (3 corrupted: figure-drop / truncation /
// english-passthrough; 3 verbatim known-good). The answers are sealed in
// bt-answers.json and are not shown to the reader.
import { writeFileSync } from "node:fs";
import { LOCALES } from "../assets/js/shared/locales.js";
import { HOME_COPY } from "../assets/js/shared/home-copy.js";

const LOCS = ["es", "pt", "fr", "de", "nl", "ar"];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const answers = {};

for (const loc of LOCS) {
  const rows = [];
  // HOME_COPY keys are spread into LOCALES for every locale (incl. nl), so the
  // LOCALES object alone is the complete rendered corpus.
  for (const key of Object.keys(LOCALES[loc])) {
    if (!(key in LOCALES.en)) continue;
    rows.push({ key, en: LOCALES.en[key], loc: LOCALES[loc][key], seed: null });
  }

  // --- seeded corruptions: one per class, from eligible strings only ---
  const withFig = rows.filter((r) => /\d/.test(r.loc) && /\d/.test(r.en));
  const withCut = rows.filter((r) => /(?<=[.!?])\s+\S/.test(r.loc.trim()));
  const fig = pick(withFig);
  const cut = pick(withCut.filter((r) => r !== fig));
  const pass = pick(rows.filter((r) => r !== fig && r !== cut && r.loc !== r.en));

  const figRow = { ...fig, seed: "figure-drop" };
  figRow.loc = fig.loc.replace(/\d[\d.,]*(?=\D|$)/g, "").replace(/\s{2,}/g, " ");
  const cutRow = { ...cut, seed: "meaning-drop" };
  cutRow.loc = cut.loc.trim().split(/(?<=[.!?])\s+/)[0];
  const passRow = { ...pass, seed: "untranslated-english" };
  passRow.loc = passRow.en;

  const goods = shuffle(rows.filter((r) => ![fig, cut, pass].includes(r))).slice(0, 3);
  const seeded = shuffle([
    figRow,
    cutRow,
    passRow,
    ...goods.map((r) => ({ ...r, seed: "known-good" })),
  ]);
  const all = shuffle([...rows, ...seeded]);
  all.forEach((r, i) => (r.id = "R" + String(i + 1).padStart(3, "0")));

  const esc = (s) => String(s).replace(/\r/g, "").replace(/\n/g, "\\n");
  writeFileSync(
    `tmp/bt-${loc}.txt`,
    all.map((r) => [r.id, r.key, esc(r.en), esc(r.loc)].join("\t")).join("\n"),
    "utf8",
  );
  answers[loc] = all
    .filter((r) => r.seed)
    .map((r) => ({ id: r.id, key: r.key, seed: r.seed }));
  console.log(loc, "rows:", all.length, "seeded:", answers[loc].length);
}

writeFileSync("tmp/bt-answers.json", JSON.stringify(answers, null, 1), "utf8");
console.log("sealed answers -> tmp/bt-answers.json");
