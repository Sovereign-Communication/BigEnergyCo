[Treystu 2026-10-23T11:31:18Z] ## Status after Phases 3 and 4 (2026-10-23)

Phase 1 and 2 were already merged (#288, #290, #289, #291) with zero targeted-facet movement on the Go/No-Go.

**Phase 3 — measured, not adopted.** #293 compared three question sets on the same archived main evidence and pinned `jev-1.14.0`: generic labels 13 proven facets, facet-specific proof criteria 10, criteria-in-instructions 9. The specialized labels did not move quality, performance, i18n or translation, and moved correctness, docs and provenance down. Closed with the record.

**Phase 4 — deterministic evidence shipped in #294, semantic path documented as a gap.** 56 term anchors across seven locales found a shipped German truncation (`Batteri` for `Batterie`); 12 material-quantity checks found two dropped German figures (the ~2 MB download size and the 5-yr simulation note), both fixed. The semantic spot-check was tried in two forms and rejected as evidence: questionnaire 1/18 controls, direct pair 16/18, both below their own 0.95 positive cutoff. The report is at `docs/jev-completion/ISSUE_287_TRANSLATION_PATH.md` and states the remaining option (native review) rather than claiming translation is proven.

**Phase 5 — one new fact changes the shape of the decision.** Across four consecutive merged-main runs (84 facet-confidence samples, pinned `jev-1.14.0`), the judge never emitted a facet confidence at or above 0.95; the maximum observed was 0.90. `COMPLETE_MIN_CONFIDENCE` is therefore a hard pass condition that no evidence improvement can satisfy. #292's draft now states this with the run table and asks for three decisions: the staging facet floor, whether confidence is telemetry plus investigation (as ratified Jev Gate Policy v1 already says for Choice confidence) or a hard block, and the P10 boundary. It remains draft; no gate code, threshold, or amendment chain is touched.

**Phase 6 cannot start until that decision lands.** Green-once requires the confidence clause and the ten sub-proven facets to be resolved first. As soon as main turns green from the check-runs API, the three-merge stability check runs and will be reported here.

Nothing in Phases 3 or 4 lowered a gate. Both measured what they could and recorded what they could not.

[Treystu 2026-10-23T11:35:29Z] ## Driving comment — reverification sweep 2026-10-23 ~01:30 HST

**Current verified status** (fresh pull, main `53888bfb`):
- `jev-complete`: FAILED — 10/21 facets not proven
- 11 at proven/100: design, correctness, security, seo, experience, docs, testing, release, comparison, usecases, privacy
- 9 at ordinal 85: spec, quality, performance, accessibility, i18n, resilience, advisor, physics, provenance
- 1 at ordinal 60: translation (judge confidence 0.57 < 0.95 bar)
- Regression noted: accessibility dropped 100→85 (judge volatility)

**What remains:**
- Phase 5: Owner decision on #292 (B1 policy clarification)
- Phase 6: Stability verification (3-merge green check) — blocked until gate goes green

**What blocks it:**
1. **Structural:** Across 4 merged-main runs (84 samples, pinned jev-1.14.0), judge never emitted confidence ≥0.95 (max 0.90). The 0.95 bar cannot be met by evidence improvements.
2. **Decision:** #292 asks three questions — staging facet floor, confidence-as-telemetry vs hard block, P10 boundary. Needs owner approval.

**What unblocks it:** Owner decision on #292. If approved, implement policy clarification → gate green → Phase 6.

**Verification required:** Gate green from check-runs API (not combined status), then green across 3 consecutive merges.

**Next step:** Owner reviews #292 and decides. Lane implements the decision. Owner: Lucas. No lane action until decision lands.

**Dependencies:** Phase 6 depends on Phase 5 decision. #294 (Phase 4) can merge independently.

[Treystu 2026-10-23T20:59:19Z] ## Status update — 2026-10-23 (burndown prep)

**Phases 1-4 complete.** #294 (translation evidence) merged. #293 measured prompt options (not adopted — specialized labels hurt).

**Current:** Main `23188e04`, jev-complete still red (10/21 not proven). #303 (scope resolver fix) merged.

**Remaining:** Phase 5 (owner decision on #292) → Phase 6 (3-merge stability).

**Blocker:** The #292 decision. Confidence data shows 0.95 is structurally unachievable (max 0.90 across 84 samples). This is now the critical path for the entire burndown — the gate blocks production promotion.

**Next:** Owner decides on #292. Lane stands by for implementation.
[Treystu 2026-10-24T13:23:42Z] ## Translation gap — OPEN, not proven (resume note)

Latest merged-main reading: `b8d6ba0c`, run 40097125711, `jev-complete-report` artifact.

- **Ordinal 60, confidence 0.63** (0.61 on the previous run at `f19c3d50`) — "mixed — partial or unverified evidence", P(proven) = 0.00. **Delta 25 points to the ≥85 staging floor**; score 96.07 with all hard gates green, so this facet is what keeps the gate red (this run also shows resilience dipped 85→60 — judge volatility of the recorded kind, to be re-read on the next run, not part of this note).
- **What the judge requires, verbatim** (its `suggested_next_action`): *"Gate each locale on parity in both directions, placeholder integrity, no English leakage and no raw key name reaching a visitor, **then back-translate the rendered strings and read them for meaning: fix any string that is technically present and not actually readable.**"* The first clause is technical parity and is green (DOM 2982/2982, JS 42/42, glossary 56/56, figures 12/12); the operative remainder is **native/fluent meaning-review of the rendered strings** for es/pt/fr/de/nl/ar.
- **Not proven, not substituted.** No fluent/native review has been obtained. The Phase-4 semantic spot-check failed its own 0.95 controls (questionnaire 1/18, direct-pair 16/18) and is not evidence; prompt/evidence work (#288–#291, #293) produced zero movement on this facet. This facet is **not** marked proven anywhere, and a model spot-check must never be used in its place.
- **Resume point:** obtain fluent reviewer coverage for the seven locales, or an owner-approved staging amendment. Until one of those lands, the merged-main gate stays red on this facet.
[Treystu 2026-10-24T20:19:34Z] ## Driving note — updated: B1 landed, gate now red on one facet; parked on the owner decision

**Verified state (this supersedes my 2026-10-23 driving comment, written when 10/21 facets were unproven):** B1 landed via #305 (`aa817547`, amendment A-007). The old 0.95-confidence blocker is gone. Main `eabb378c`: score 96.64, all 7 hard gates green, `blocking_facets: []` — the single blocker is "staging facet below ordinal 85: translation" (ordinal 60, confidence 0.67; 0.63 on `b8d6ba0c`). Phases 1–4 done; #304, #310, #311, #312, #313 landed since the last driving comment.

**Why held:** translation ≥85 needs fluent reviewer coverage for es/pt/fr/de/nl/ar — owner decision (a): human review time, no repo or CI change. The alternative is an owner-approved staging amendment. Model spot-checks are explicitly not a substitute (Phase-4 controls failed 1/18 and 16/18). Resilience is not a blocker: re-read verdict is judge volatility (byte-identical evidence moved 60→85 on this run), no code change indicated — keep it flagged and re-read on each main run.

**Unblocker:** (a) fluent coverage lands, or an owner-approved staging amendment lands.

**Required verification, then close:** translation ≥85 on a merged-main run (or amendment landed) → gate green on main → still green across 3 consecutive content merges → close #287.

**Next step + owner:** owner decides (a) or amendment. Lane keeps the gap explicitly open in #287/#145, re-reads resilience on every main run, and does not mark translation proven without coverage.

**Dependencies:** #287 gates #314's merge; #194/#145 track it.

[Treystu 2026-10-26T00:08:01Z] PR #319 lands the unblocker this issue's Phase 2/6 need: the advisor audit the gate already asks for (advisor_gap bucket), run against the real chat and worker paths per #292's applied B1 disposition.

- **Adversarial pins** (`tests/advisor-audit.test.mjs`): prompt-injection isolation (user content never reaches the system message; spoof labels cannot override the deterministic calculator), single-flight sends (a stale reply cannot interleave), and record-stability (Phase 1 applied to `advisor_audit`: it can no longer be silently dropped or overflow past its 480-char transport clip by a merge).
- **Live samples** through the deployed page's own chat flow in English and Spanish: the brief answered with the run's own computed figures kept authoritative over prose; a spoof-label override demand refused; the Spanish session followed the selected interface language with the canonical safety line plus the localized AI caveat. Recorded in `docs/jev-completion/ADVISOR_AUDIT_2026-10-25.md`.
- **Evidence rewritten to the rubric's shape** (the P1.3 lesson): the facet line anchors each of the seven rubric clauses to its instrument; `advisor_audit` records the samples and their honest limits instead of the self-disqualifying 'the provider is stubbed… not answer quality' caveat.

Measurement: on the CI-judged scoped run (P0.6, report attached to the PR) the advisor facet reads **85 'confident — solid with minor gaps' at 0.67 confidence** (was 60 at 0.49 on main's HEAD), ratchet met with 0 regressions. 9/9 diagnostic judge draws on the final material land ≥85; p(mixed) fell 0.45 → 0.06–0.10. No gate script, threshold, rubric or amendment was touched.
