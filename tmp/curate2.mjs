// Scratch: second curation pass — free transport budget without losing facts.
import { readFileSync, writeFileSync } from "node:fs";

const P = "evidence/advisor-and-release.json";
const ev = JSON.parse(readFileSync(P, "utf8"));
const n = ev.notes;

n[5] = n[5]
  .replace(
    "The typed line was 1233 characters against the 280-character transport clip:",
    "The typed line was 1233 characters against the 280-char clip:",
  )
  .replace(
    "sat unread under the `experience` heading.",
    "sat unread under `experience`.",
  )
  .replace(
    "back-translate the rendered strings and read them for meaning: fix any string that is technically present and not actually readable — is complete.",
    "back-translate the rendered strings, read them for meaning, fix what is not actually readable — is complete.",
  )
  .replace(
    "(36/36: figure-drop, meaning-drop and untranslated-English corruptions caught; verbatim pairs cleared)",
    "(36/36: every seeded corruption caught, every verbatim pair cleared)",
  )
  .replace(
    "(docs/jev-completion/TRANSLATION_BACKTRANSLATION_2026-10-25.md)",
    "(TRANSLATION_BACKTRANSLATION_2026-10-25.md)",
  )
  .replace(
    "Native-speaker review remains open as the named attribution LIMIT — no native speaker has validated idiomaticity, and nothing here claims otherwise — not as an unperformed remediation; B1 staging (A-007) treats it as a named limit on the evidence, and P10's program-exit bar is unchanged.",
    "Native-speaker review remains open as the named attribution LIMIT — no native speaker has validated idiomaticity; nothing here claims otherwise — not as an unperformed remediation: B1 staging (A-007) treats it as a named limit, P10's bar is unchanged.",
  );

n[3] = n[3].replace(
  "the report declares facet_axes and carries a composed facet_line, and build-jev-evidence.mjs derives the axis from the gate reports in the artifacts directory, so the numbers on the judge's record and the numbers in the report cannot drift apart.",
  "the report declares facet_axes and a composed facet_line, and build-jev-evidence.mjs derives the axis from the gate reports, so the judge's numbers and the report's cannot drift apart.",
);

n[6] =
  "Back-read the PR #309 suggestion CTA against its English source in all seven locales. " +
  "One supported defect in Dutch: the old label implied improving the translation directly instead of proposing a correction; the Dutch CTA was clarified and a focused test pins the reviewed values. " +
  "A semantic spot-check of the new CTA only — not whole-site meaning/naturalness or native-speaker review; see docs/jev-completion/TRANSLATION_SUGGESTION_LABEL_BACKREAD_2026-10-24.md.";

n[7] =
  "Back-read the 43 chart localization keys introduced by PR #248 against English in Spanish, Portuguese, French, German, Dutch, and Arabic. " +
  "No material numeric or grid/generator meaning reversal; the five-year weather-data labels were clarified and Dutch derating jargon replaced. " +
  "This semantic review is not native-speaker review; the disposition of that clause is in the 2026-10-25 back-translation record (TRANSLATION_BACKTRANSLATION_2026-10-25.md), method in docs/jev-completion/CHART_TRANSLATION_BACKREAD_2026-10-22.md.";

writeFileSync(P, JSON.stringify(ev, null, 2) + "\r\n", "utf8");
console.log(
  "notes:",
  n.map((x) => x.length).join(", "),
  "total:",
  n.reduce((s, x) => s + x.length + 3, 0),
);
