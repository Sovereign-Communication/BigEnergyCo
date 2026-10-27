# Issue #287 Phase 4 — translation path

Status: deterministic checks shipped; semantic verification rejected by its own
controls; the remaining gap is recorded for the owner's policy decision.

All work is non-destructive. No release gate was lowered, and no judgment was
selected from repeated live calls: each variant was called once and is reported
in full, including the result that argues against it.

## 1. Deterministic terminology consistency (shipped)

`scripts/lib/translation-terminology.mjs` + `scripts/check-i18n.mjs`.

- Three term families (battery, bill, off-grid) anchored against eight label
  keys in the seven shipped locales: **56/56 checks**.
- Checks are lexical, not semantic: a stem must appear in the locale's own
  glossary spelling. Natural compounds and inflections pass.
- Found and fixed a shipped German truncation — `reserveLabel` ended in
  "Batteri" while every other German battery label uses "Batterie". The
  regression test re-injects the truncated string and requires the failure.
- A locale with no glossary entry fails all eight of its checks rather than
  passing silently, so adding a locale cannot bypass the anchor.

## 2. Deterministic material quantities (shipped)

`checkMaterialQuantities` in the same module, wired into `npm run seo`.

The glossary cannot see the defect the semantic probe found next: a translation
that keeps the term but drops the figure beside it. Two keys carry a figure the
reader can see in English (`firstRunNote` → "~2 MB", `runBtn` → "5-yr
simulation"); across 12 locale/key pairs the check requires every English
numeral to survive as a digit or as the locale's spelled-out form.

It found two shipped German omissions, both now fixed:

| key            | English                                     | German before         | German after                   |
| -------------- | ------------------------------------------- | --------------------- | ------------------------------ |
| `firstRunNote` | "downloads ~2 MB of satellite weather data" | size omitted          | "~2 MB Satelliten-Wetterdaten" |
| `runBtn`       | "Size My System (5-yr simulation)"          | parenthetical omitted | "(5-Jahres-Simulation)"        |

Eastern Arabic digits and the Arabic spelling "خمس" are accepted rather than
being reported as dropped, so the check does not mistake a legitimate numeral
style for a missing figure. The check is deliberately narrow (two keys): it is
proof that those figures survive, not proof of meaning.

## 3. Semantic spot-check (rejected as evidence)

Two variants, both against the pinned model `jev-1.14.0`, both scored on the
same 36 samples and 18 controls (a known-good pair, a wrong-year pair, and a
swapped-component pair per locale).

| variant                                                     | controls | samples ≥ 0.95 |
| ----------------------------------------------------------- | -------- | -------------- |
| questionnaire (labels + back-translation)                   | 1/18     | 4/36           |
| direct pair (source and translation quoted in the question) | 16/18    | 9/36           |

Control cutoffs were 0.95 for a known-good pair and 0.05 for a corrupted one. A
measuring instrument that misses its own controls cannot certify translations,
so **neither variant is admissible as gate evidence** and neither is cited as
one.

The direct-pair variant failed its controls on the two locales whose script the
judge cannot verify at the token level: `nl` positive pair 0.83 and `ar`
positive pair 0.21, while both locales' corrupted pairs scored correctly at
0.01–0.02. That signature — correct on corruption, unsure on correctness — is
instability, not a translation defect.

The probe was still useful as a bug-finder: the two German omissions in §2 came
from its low-scoring samples, and both were confirmed by reading the strings
rather than by trusting the score.

Raw experiment records (not committed; they contain live-call payloads):
`beco-translation-semantic-experiment.json` and the two driver scripts on the
working machine.

## 4. What this leaves

Translation now has deterministic proof of: key parity in both directions,
placeholder parity, rendered-locale snapshots, term-anchor consistency, and
figure preservation. It does **not** have native-level meaning review, which is
the form the judge explicitly asked for ("back-reading translated strings for
meaning (native judgement)").

That gap cannot be closed by more automation this program can run: the one
available instrument failed its own controls. The remaining options are human
native review (no reviewer on this program) or the owner-approved staging
policy in PR #292 (B1), which keeps P10's 95/95/95 program-exit bar intact.
This document is the recorded path forward required by the issue's Phase 4
step 3; the decision is the owner's, not this PR's.
