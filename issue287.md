## Status after Phases 3 and 4 (2026-10-23)

Phase 1 and 2 were already merged (#288, #290, #289, #291) with zero targeted-facet movement on the Go/No-Go.

**Phase 3 — measured, not adopted.** #293 compared three question sets on the same archived main evidence and pinned `jev-1.14.0`: generic labels 13 proven facets, facet-specific proof criteria 10, criteria-in-instructions 9. The specialized labels did not move quality, performance, i18n or translation, and moved correctness, docs and provenance down. Closed with the record.

**Phase 4 — deterministic evidence shipped in #294, semantic path documented as a gap.** 56 term anchors across seven locales found a shipped German truncation (`Batteri` for `Batterie`); 12 material-quantity checks found two dropped German figures (the ~2 MB download size and the 5-yr simulation note), both fixed. The semantic spot-check was tried in two forms and rejected as evidence: questionnaire 1/18 controls, direct pair 16/18, both below their own 0.95 positive cutoff. The report is at `docs/jev-completion/ISSUE_287_TRANSLATION_PATH.md` and states the remaining option (native review) rather than claiming translation is proven.

**Phase 5 — one new fact changes the shape of the decision.** Across four consecutive merged-main runs (84 facet-confidence samples, pinned `jev-1.14.0`), the judge never emitted a facet confidence at or above 0.95; the maximum observed was 0.90. `COMPLETE_MIN_CONFIDENCE` is therefore a hard pass condition that no evidence improvement can satisfy. #292's draft now states this with the run table and asks for three decisions: the staging facet floor, whether confidence is telemetry plus investigation (as ratified Jev Gate Policy v1 already says for Choice confidence) or a hard block, and the P10 boundary. It remains draft; no gate code, threshold, or amendment chain is touched.

**Phase 6 cannot start until that decision lands.** Green-once requires the confidence clause and the ten sub-proven facets to be resolved first. As soon as main turns green from the check-runs API, the three-merge stability check runs and will be reported here.

Nothing in Phases 3 or 4 lowered a gate. Both measured what they could and recorded what they could not.
