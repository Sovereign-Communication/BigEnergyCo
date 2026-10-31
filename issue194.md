## #287 progress — verified from check-runs and merged PRs (2026-10-23)

**Phase 1 (evidence stability) — DONE, merged.** #288 moved the 21-facet evidence map into `scripts/lib/jev-facet-evidence.mjs` with a CI guard that accounts for all 21 axes and a negative test that removes `quality` by name.

**Phase 2 (targeted evidence) — DONE, merged, zero movement.** #290 (quality: 63 repeated homepage style attributes consolidated, 298→235 site-wide), #289 (performance: each timing now travels with its ceiling), #291 (i18n: rendered locale snapshots at three re-entry points). Go/No-Go measured: quality, performance and i18n stayed at 85; translation stayed at 60.

**Phase 3 (facet-specific proof criteria) — MEASURED AND CLOSED.** #293 ran the same archived main evidence through three question sets on pinned `jev-1.14.0`: generic labels 13 proven facets, specialized proof labels 10, criteria-in-instructions 9. No targeted facet moved and three others fell. Closed with the record; the parser round-trip fix survives on the branch.

**Phase 4 (translation) — deterministic evidence shipped in #294; semantic path documented as a gap.** 56 term anchors (found and fixed a German `Batteri` truncation) and 12 material-quantity checks (found and fixed two dropped German figures). The bilingual semantic probe failed its own controls in both forms — 1/18 questionnaire, 16/18 direct pair — so no semantic evidence is claimed and no gate was lowered.

**Phase 5 (policy) — #292 draft, owner decision required.** New, decisive evidence: four consecutive merged-main runs give 84 facet-confidence samples, none at or above 0.95, so `COMPLETE_MIN_CONFIDENCE` is unreachable by evidence work. B1 now lists three explicit decisions — floor, confidence treatment, scope — with recommendations. It stays draft until approval is recorded.

**Phase 6 (stability) — BLOCKED on Phase 5.** The gate cannot go green on main until the confidence clause and the ten sub-proven facets are resolved, so green-once plus three consecutive content merges cannot start yet.

## Live gate state

Main `53888bfb`: `jev-complete` failure, 97.50/100, hard gates green, 11/21 facets proven, 0/21 at the 0.95 confidence bar. Every other check on that run passed.

## Open PR queue

- **#292** — B1 draft, draft state, owner approval pending. No code or threshold change inside.
- **#294** — Phase 4 deterministic translation evidence. CI running.
- **#171** — repaired at `6e02d1af` (pinned-budget reset on the cut preview; missing `gatesSince` import that killed the a11y flow). CI running. Recommend keep-and-merge on green, not close: rebased on `53888bfb`, unit/coverage/Lighthouse/quality already passed at the prior head, and it edits no plan, amendment or ledger file.

Closed since the last update: #293 (Phase 3, superseded by its own measurement).
