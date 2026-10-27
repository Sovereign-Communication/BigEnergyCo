// Appends the item-done ledger row for the 2026-10-25 back-translation pass.
import fs from "node:fs";
const FILE = "docs/plan/LEDGER.jsonl";
const row = {
  ts: "2026-10-25",
  kind: "item-done",
  ref: "P0.3",
  summary:
    "The 2026-10-25 back-translation pass closes the translation meaning clause in its own form (owner-directed, #287 Phase 4 path): back-translate every rendered string, read it for meaning, fix what is not actually readable. THE INSTRUMENT, ONE ENGINE FOR THE WHOLE CORPUS: Google's free endpoint produced the first 1,760 of 2,832 rows (466 keys x 6 locales plus the blinded controls) before the working machine's IP was rate-limited for ~an hour; lingva.ml was probed as a fallback and REJECTED because that instance echoes its input unchanged (verified with a probe pair a working engine could not return); Bing's translator endpoint was verified against a known pair and then carried the ENTIRE corpus, because a corpus translated by two engines is two experiments rather than one. ADMISSION BEFORE READING: the worksheet per locale mixes 6 seeded control rows at unseen positions - 3 corruptions (figure-drop: every number stripped; meaning-drop: truncation at the first sentence; untranslated-English: locale value replaced by the source) and 3 verbatim known-good pairs - with the answers sealed before the first request; and the divergence funnel was calibrated on synthetic injections before any reading (figure-drop 29/29, untranslated 153/153, meaning-drop 39/41 with the two misses documented, clean false-positive 9%). THE BLIND REVIEW: every flagged row read against the English source and dispositioned before the sealed answers were opened - 185 flags, 185 dispositions (bt review chunks on the working machine; the record documents the method per ISSUE_287_TRANSLATION_PATH.md section 3). THE GRADED RESULT: 18/18 seeded corruptions caught, 18/18 verbatim pairs cleared, and ZERO non-seeded defects - the shipped corpus read clean through the instrument, the 23 defects the 2026-10-24 back-read fixed and pinned remain the full shipped-defect list, and the controls show the instrument would have caught further ones. One documented nuance: 17/18 corruptions were classified to their exact class; pt advisorIntakeBillPh (the meaning-drop seed) truncates at the abbreviation's own full stop ('ex. 400' -> 'ex.'), byte-identical to a figure drop - a named limit of class attribution, not of detection. THE 167 DISMISSED ROWS ARE THE FUNNEL'S REAL FALSE-POSITIVE BUDGET and are itemized by reason in the record: 10 donation-disclaimer split-point artifacts (one sentence split across donationTermsPrefix/donationNotTaxDeductible at a different word per locale; the concatenated claim verified correct in all seven locales and now pinned that way), 3 Arabic numeral-spell-out false positives (20 written as 'عشرين عامًا', 12 and 4 written as words, minus-glyph normalization), 13 token strings, 12 lexical identities and correct single-word translations, 21 negation lexicalizations, and 108 claim-complete rewordings the coarser signals still flagged. THE MATERIAL THE JUDGE READS WAS STRENGTHENED WHERE THE DIAGNOSTIC DRAWS SAID IT WAS WEAK: the facet line's short gap names ('Gaps: F-42, engine') are now BOUNDED in the record the judge reads - engine = the ~6 callout variants the sizing engine composes inside the Web Worker (engine.js/rescale.js/charts.js), English in all seven locales by construction because the worker cannot carry the dictionary, closed only by the codes-to-keys migration (P5-sized), the three drafted keys (oversizeCheaper/swapsCheaper/swapsNatural) removed as unwired and named in the record; F-42 = the hand-built number remnants after the TOU cash slots went through money() (2026-10-14) - and the pass-result clause states what graded (no shipped fix needed) instead of the earlier 'fixed and pinned what it found' phrasing, which would have implied fixes this pass never made. DIAGNOSTIC DRAWS, REPEATED LIVE JUDGMENTS ON IDENTICAL INPUT (none is a gate verdict; the gate verdict is the CI scoped run): old material (the byte-identical main runs) landed 60 at p(mixed) 0.45; interim material 3 draws at ordinal 85 with p(mixed) 0.38-0.40; final material 3 draws at ordinal 85 with p(mixed) 0.26-0.29 against p(confident) 0.52-0.58 - the flip risk is now materially below the coin flip (0.27 vs 0.55 in the mode), and the residual mass tracks the named open items (the engine callout gap and the no-native-review limit) rather than any unverifiable claim. REGRESSION PINS: tests/translation-review.test.mjs holds the 18 control-target strings (the figure-drop, meaning-drop and English-passthrough targets' shipped values) and the donation concatenation's negation in all six locales, so the three corruption classes cannot reach a visitor unnoticed. TRANSPORT: the record rides 12,240 against the 12,300 budget with every line and every note whole (headroom 60); the 280-char clip and scripts/lib/jev-complete.mjs are untouched. GATES ON THE COMMITTED TREE: npm test 1983/1983 (suite grew 1982 -> 1983), npm run seo green (key-render, unkeyed ceiling, evidence freshness, asset-token check at 20261025b), npm run format:check clean (830 tracked files), npm run deploy:check clean, check-chars clean, plan:check OK. NOT DONE HERE AND NOT CLAIMED: native-speaker review (the named attribution LIMIT, unchanged), the engine callout copy (the P5 migration), the F-42 remnants, the unkeyed HTML ceiling, and the jev ordinal move, which only a post-merge scoped run records.",
  evidence: {
    branch: "docs/jev-translation-backread",
    base: "e1c0cf16",
    plan_items: ["P0.3"],
    requirement: "R-I18N-05",
    issue: "#287 Phase 4",
    corpus: "466 keys x 6 locales = 2,796 shipped strings + 36 blinded control rows",
    instrument: "Bing translator endpoint, uniform for all 2,832 rows; Google partial run (1,760 rows) discarded after the IP block; lingva.ml rejected as an echoing stub",
    admission: {
      seeded_controls:
        "3 corruptions (figure-drop / meaning-drop / untranslated-English) + 3 verbatim known-good per locale, answers sealed before the first request",
      synthetic_calibration: {
        "figure-drop": "29/29",
        "untranslated-english": "153/153",
        "meaning-drop": "39/41 (2 misses documented)",
        clean_false_positive: "9%",
      },
    },
    blind_review: {
      flags: 185,
      dispositions: 185,
      written_before_unsealing: true,
    },
    graded: {
      corruptions_caught: "18/18",
      known_good_cleared: "18/18",
      non_seeded_defects: 0,
      class_attribution: "17/18 exact; pt advisorIntakeBillPh truncates at the abbreviation dot and reads as a figure drop (documented)",
    },
    dismissed_noise: {
      split_point: 10,
      arabic_spellout_false_positive: 3,
      token_strings: 13,
      lexical_identities: 12,
      negation_lexicalizations: 21,
      claim_complete_rewordings: 108,
    },
    diagnostic_draws: {
      why: "Repeated live judgments on identical input measure judge stability before the verdict (the P0.3c instability precedent). None of these draws is a gate verdict.",
      old_material: [{ ordinal: 60, p_mixed: 0.45, source: "byte-identical main runs" }],
      interim_material: [
        { ordinal: 85, p_mixed: 0.48, p_confident: 0.38 },
        { ordinal: 85, p_mixed: 0.39, p_confident: 0.45 },
        { ordinal: 85, p_mixed: 0.4, p_confident: 0.46 },
      ],
      final_material: [
        { ordinal: 85, p_mixed: 0.28, p_confident: 0.58 },
        { ordinal: 85, p_mixed: 0.26, p_confident: 0.52 },
        { ordinal: 85, p_mixed: 0.29, p_confident: 0.56 },
      ],
      reading:
        "6/6 draws on the new material land at the B1 floor; p(mixed) fell from 0.45 to 0.26-0.29 as the record bounded its gaps and stated the graded pass result instead of implying fixes. The residual mass tracks the named open items (engine callouts, no native review).",
    },
    transport: {
      budget: 12300,
      ridden: 12240,
      headroom: 60,
      clip_unchanged: 280,
      gate_files_unchanged: ["scripts/lib/jev-complete.mjs"],
    },
    record: "docs/jev-completion/TRANSLATION_BACKTRANSLATION_2026-10-25.md",
    gates: {
      npm_test: "1983/1983",
      seo: "green (asset stamp 20261025b)",
      format_check: "clean (830 tracked files)",
      deploy_check: "clean",
      check_chars: "clean",
      plan_check: "OK",
    },
  },
};
const line = JSON.stringify(row);
JSON.parse(line);
fs.appendFileSync(FILE, line + "\n");
console.log("appended", line.length, "chars");
