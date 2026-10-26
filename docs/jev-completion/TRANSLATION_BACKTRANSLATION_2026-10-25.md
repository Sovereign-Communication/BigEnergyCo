# 2026-10-25 back-translation pass — full-corpus meaning read

**Owner-directed 2026-10-25, Issue #287 Phase 4 path.** The work order's
remediation is: *back-translate the rendered strings, read them for meaning,
fix what is not actually readable.* This record is that pass, done in its own
form. It disposes the meaning clause and the native-speaker clause of the
translation axis; it does not touch any other facet.

Scope: every rendered dictionary string — 466 keys × 6 locales
(es, pt, fr, de, nl, ar) = 2,796 shipped strings, plus blinded control rows
(§2). The `en` source is the English dictionary. Nothing outside the
translation facet's evidence was changed.

Companion records: the 2026-10-24 AI fluent back-read
(`TRANSLATION_MEANING_BACKREAD_2026-10-24.md`, 436 keys × 6, 23 defects fixed
and pinned in `tests/translation-review.test.mjs`), the chart-key back-read
(`CHART_TRANSLATION_BACKREAD_2026-10-22.md`), the suggestion-CTA back-read
(`TRANSLATION_SUGGESTION_LABEL_BACKREAD_2026-10-24.md`), and the program-level
disposition (`ISSUE_287_TRANSLATION_PATH.md`).

## 1. Why a second pass

The 2026-10-24 read compared each locale string against its English source
directly. This pass asks the question in the other direction: take the string
a visitor actually receives, translate it back to English with an independent
engine, and read the two English texts against each other. A locale string can
be fluent, correctly terminated, and still have dropped a figure, a clause, or
a negation that the source carried — and a direct comparison of two different
languages is weak at catching exactly that. The back-translation converts the
question into a same-language comparison.

## 2. The worksheet and its blinded controls

One worksheet per locale (scratch instrument, not committed — per
`ISSUE_287_TRANSLATION_PATH.md` §3, experiment tooling with live payloads or
seeded answers stays on the working machine; the method is documented here and
the committed tests pin the shipped strings):

- **Rows:** every rendered `LOCALES` key present in `en` — 466 real keys, in
  worksheet order, as `id <TAB> key <TAB> en-source <TAB> locale-value`.
  (`HOME_COPY` keys spread into `LOCALES` for every locale including `nl`, so
  `LOCALES` alone is the complete rendered corpus.)
- **Seeded controls:** 6 rows mixed in at random, unseen positions per locale
  (36 across the corpus), generated before any translation was requested and
  sealed offline:
  - 3 corruptions, one per class — **figure-drop** (every number stripped from
    an otherwise valid locale string), **meaning-drop** (the string truncated
    to its first sentence), **untranslated-English** (the locale value
    replaced by the English source);
  - 3 **known-good** verbatim locale strings, which must come back clean.
- The answers (`key`, `row id`, `seed class`) were sealed before the first
  request and were not consulted during translation or review. They were
  opened only after every flagged row had been dispositioned (§5).

The controls are the instrument's admission ticket: a machine engine is
evidence only if it can be shown to catch the corruptions a human reviewer
would catch and to clear pairs that need no reading.

## 3. The instrument, and why it is one engine

- **First instrument — Google's free translation endpoint** (the same
  `translate.googleapis.com` route `scripts/smoke/experience.mjs` already
  exercises). It produced the first 1,760 rows, then the working machine's IP
  was rate-limited (HTTP 429) for roughly an hour. A marker-batching resumer
  was written (≈7× fewer requests) and kept for the block's duration.
- **`lingva.ml` was probed as a fallback and REJECTED:** its instance returns
  the source string unchanged — verified with a probe pair whose translation
  would be unrecognizable if it worked. A stub that echoes input is invisible
  to a naïve reader and would have poisoned the corpus.
- **Bing's translator endpoint** (token + `translator` web route) answered and
  was verified against a known pair before adoption. Because a corpus
  translated by two engines is two experiments rather than one, **Bing
  translated the entire corpus** — all 2,832 rows (472 × 6) — and the Google
  partial run was discarded, not merged.

## 4. Instrument admission — calibrated before any reading

The divergence funnel (§5) was calibrated on **synthetic injections**, made
before the corpus was read so the sensitivity numbers cannot be fitted to the
findings, and the seeded controls were graded only after the review (§2):

| corruption injected into the simulated back-translation | caught |
| ------------------------------------------------------- | ------ |
| figure-drop (numbers removed)                           | 29/29  |
| untranslated-English (back = source)                    | 153/153|
| meaning-drop (sentence/clause removed)                  | 39/41  |
| clean strings falsely flagged                           | 9%     |

The two meaning-drop misses are documented, not hidden: both were single
subordinate clauses whose removal left a fluent sentence with a barely moved
number multiset. The control score on the real corpus is in §6.

## 5. The divergence funnel and the review

For each row, the locale string is machine-translated back to English and the
back-translation is compared against the English source on four deterministic
signals, each calibrated on the synthetic injections above:

1. **numbers** — normalized number multisets (the figures both texts carry);
2. **sentences** — sentence counts;
3. **overlap** — calibrated word-overlap (Jaccard on content words, with a
   short-string floor so labels and one-word values cannot be noise);
4. **untranslated** — the back-translation identical to the source.

Every flagged row was read by a human reviewer against the English source and
dispositioned — `defect` (naming the corruption class) or `dismissed` (with
the reason: lexicalization, split-point artifact, token string, Arabic
numeral spell-out, or a documented false positive). The review was completed
**before** the sealed answers were opened, so no flag could be waved off as
"probably a control".

## 6. Findings and the control score

**185 flagged rows, 185 dispositions, written blind.** The sealed answers were
opened only after the disposition file was complete. Graded result:

| control class            | count | outcome                                                       |
| ------------------------ | ----- | ------------------------------------------------------------- |
| seeded corruptions       | 18    | **18/18 caught** — every one dispositioned `defect`            |
| seeded known-good pairs  | 18    | **18/18 cleared** — none dispositioned `defect`                |
| non-seeded `defect` rows | 0     | **no shipped string needed a fix**                             |

Every one of the 185 flags was therefore either a seeded control or a
dismissed noise row. The shipped corpus read **clean** through the
back-translation instrument: the 23 defects this record's companion
(2026-10-24) fixed and pinned remain the full shipped-defect list, and the
controls above show the instrument would have caught further ones.

**One documented nuance in the control score:** 17/18 seeded corruptions were
also classified to their exact class. The exception is pt
`advisorIntakeBillPh`, the meaning-drop seed: its source `ex. 400` truncates at
the abbreviation's own full stop, so the artifact (`ex.`) is byte-identical to
a figure drop. The review caught the row and called it a figure drop. Both
descriptions are true of the artifact; the mechanism was truncation. This is a
named limit of class-attribution (not of detection): a meaning-drop inside an
abbreviation-bearing string is indistinguishable from a figure drop.

**The 167 dismissed rows, by reason** (this is the funnel's false-positive budget,
measured on real rows rather than synthetic ones):

- **split-point artifacts (10 rows):** `donationTermsPrefix` /
  `donationNotTaxDeductible` split one sentence across two keys at a different
  word per locale (the negation rides the prefix in es/pt/fr/de/ar, the
  deductible key in nl). The funnel reads each key alone; the concatenation was
  verified correct in all seven locales.
- **Arabic numeral spell-outs (3 rows):** `frontierMarkerOffCurve` ("عشرين
  عامًا" for 20 years), `simpleAdvisorStyle` (12 and 4 written as words), and
  `invalidCoordinates` (minus-glyph normalization) — figures present in
  meaning, absent from the digit multiset.
- **lexical identities and correct single-word translations (12 rows):**
  `Blog`, `LFP`, `Sodium-ion`, `Terms`→`Conditions`, `Support`→`Assistance`,
  `cached`→`in cache`, `Lease of PPA` (Dutch "of" = "or").
- **negation lexicalizations (21 rows):** the `failed to load` →
  `no pudo cargarse` / `konnte nicht laden` / `تعذّر تحميل` family,
  `unavailable` → `No hay` / `Indisponível` / `niet beschikbaar`, etc. — the
  same claim carried by different words.
- **token strings (13 rows):** `~{w} W`, `{pv} kW + {batt} kWh · {pct}% ·
  {cost}`, `/kWh, diesel` — identical by construction.
- **claim-complete rows the funnel's coarser signals still flagged (108
  rows):** sentence-style splits (EN 2 sentences → 3 in the locale), label
  compressions and expanded renderings — e.g. `frontierLegendBand` expands
  "DIY sourcing to shipped retail" into a full clause per locale;
  `cumSavingsBreakEven` renders "puts money back in your pocket" as "saves
  money". Claims and figures intact; the overlap and length signals fired on
  rewording, not on loss.

The synthetic-injection calibration (§4) and this real-row false-positive
budget together bound the instrument: it catches every figure drop and
English passthrough it was shown (29/29, 153/153, 18/18 real seeds) and it
misses roughly 5% of injected meaning drops (2/41) — the documented class of
"fluent sentence, subordinate clause gone, numbers unmoved".

## 7. What this pass does not establish

- **Native-speaker idiomaticity** remains open as the named attribution
  **LIMIT** — no native speaker has validated how any locale reads. Nothing
  here claims otherwise. Per A-007's B1 staging it is a named limit, not an
  unperformed remediation; P10's bar is unchanged. This is a limit on
  *attribution* (what this evidence may claim), not an open repair.
- **The gaps the facet line names, bounded** so the line's short names cannot
  read as open holes:
  - **`engine`** — the ~6 callout variants the sizing engine composes *inside
    the Web Worker* (`engine.js`/`rescale.js`/`charts.js`, including
    `oversizeCallout`'s prose-parsing pair and the cumulative-savings
    callout). These stay English in all seven locales **by construction**: the
    worker cannot carry the seven-locale dictionary. Closing this is the
    codes-to-keys migration (the engine returns scenario codes and numbers,
    the page composes the localized copy) — a P5-sized change, deliberately
    not smuggled into an evidence pass. The three keys drafted for it
    (`oversizeCheaper`, `swapsCheaper`, `swapsNatural`) were removed again
    rather than left unwired: `check-i18n.mjs` refuses keys no shipped code
    renders, and an unwired key is a claim the page cannot keep.
  - **`F-42`** — the master-plan defect's hand-built number remnants after the
    TOU cash slots went through `money()` (2026-10-14): hand-formatted
    numerals in a small, named set of composed strings.
- The unkeyed static-HTML ceiling tracked by `check-i18n.mjs` (371/485) is
  unchanged here — it is the i18n gate's own tracked surface, not the
  dictionary corpus this pass read.

## 8. Reproducibility

Committed evidence: the fixed locale strings in `assets/js/shared/locales.js`
and the pins in `tests/translation-review.test.mjs`, plus the composed
`translation` facet line in the run (`scripts/check-experience.mjs` composes
it from the same run's measurements; `tests/privacy.test.mjs` and
`tests/experience-facet.test.mjs` hold its clauses). Scratch instruments and
the sealed answer file stay on the working machine per
`ISSUE_287_TRANSLATION_PATH.md` §3; the method above is sufficient to rebuild
them.
