# Proposed Amendment B1: Staging Jev Gate

**Status:** Draft for Lucas's review. Not approved or adopted.

This is a proposal only. It does not amend `MASTER_PLAN.md`, append to the approved amendment chain, or change any gate code or CI threshold. Lucas's explicit approval is required before implementation.

## What the gate requires today

`scripts/lib/jev-complete.mjs` passes only when all of these hold:

| clause                 | constant                     | requirement               |
| ---------------------- | ---------------------------- | ------------------------- |
| combined score         | `COMPLETE_MIN_SCORE`         | ≥ 95.0                    |
| every facet ordinal    | `COMPLETE_FACET_MIN_ORDINAL` | ≥ 95 (the `proven` level) |
| every facet confidence | `COMPLETE_MIN_CONFIDENCE`    | ≥ 0.95                    |
| hard gates             | —                            | all green                 |

The confidence clause is a hard pass condition (`pass` includes `lowConfidence.length === 0`), not telemetry.

## Evidence from merged main

Four consecutive `Tests` runs on merged main, pinned model `jev-1.14.0`, same gate, same evidence pipeline:

| main run    | SHA        | score | facets proven | facets ≥ 0.95 confidence | max facet confidence |
| ----------- | ---------- | ----- | ------------- | ------------------------ | -------------------- |
| 39897213677 | `6c5d4511` | 97.36 | 11/21         | 0/21                     | 0.85                 |
| 39907675713 | `0df93c36` | 97.71 | 12/21         | 0/21                     | 0.90                 |
| 39912153709 | `7537336c` | 97.50 | 12/21         | 0/21                     | 0.88                 |
| 39914620664 | `53888bfb` | 97.50 | 11/21         | 0/21                     | 0.88                 |

84 facet-confidence samples, **none ≥ 0.95**. The clause is not difficult; it is unreachable by any evidence improvement, because the judge emits calibrated confidence, not a pass signal.

The ten facets below `proven` on the latest run are `accessibility, advisor, i18n, performance, physics, provenance, quality, resilience, spec, translation` (translation at 60, the rest at 85). Accessibility has moved 100 → 85 → 100 → 85 across runs with identical evidence and 40/40 browser cells green, so part of the distance is judge variance rather than product state.

## Why Phase 3 and Phase 4 did not close it

- **Phase 2** (quality, performance, i18n evidence) landed in #290, #289, #291: zero targeted-facet movement.
- **Phase 3** (facet-specific "proven" criteria, #293) was measured against archived main evidence: generic labels produced 13 proven facets, specialized labels 10, an instruction-only variant 9. The change made the measurement worse, so it is not a path to green.
- **Phase 4** (translation, #TBD) shipped deterministic term anchors (56 checks, found and fixed a German `Batteri` truncation) and a material-quantity guard (found and fixed two dropped German figures). Its semantic instrument failed its own controls — questionnaire form 1/18, direct-pair form 16/18 — so it cannot certify translations. Native meaning review is the only remaining evidence, and there is no reviewer on this program.

## Points needing Lucas's decision

1. **Staging facet floor.** Recommended: every facet ≥ 85 with translation held at its measured 60 and named as an explicit staging exception whose exit condition is native review before P10. Alternative: a flat ≥ 60 floor for every facet, which is simpler but lets any facet sit at `mixed`. A flat ≥ 85 floor is not viable: translation cannot reach it with automation this program has.
2. **Staging confidence.** Recommended: confidence is recorded as telemetry and a facet below 0.95 triggers a documented investigation, never an automatic block. This is what Jev Gate Policy v1 (ratified 2026-10-21, "Replaces the absolute 0.95 Choice-confidence bar") already says; the gate code has not implemented it. Issue #255's ratified reading kept the 95/95/95 CI rule as a separate program gate, so this needs Lucas's explicit word rather than an agent's inference.
3. **Scope and P10.** Recommended: B1 applies only to the staging check on an exact merged-main revision; scoped PR reports stay advisory. P10 and any promotion retain combined ≥ 95, every facet ≥ 95, every facet confidence ≥ 0.95. Note for the record: the confidence half of that retained P10 clause is also unreachable at the observed 0.88–0.90 maximum, so P10 will need the same decision, before P10 rather than at it.

## Unchanged safeguards

Hard gates, current-revision evidence, pinned live-model requirements, fail-closed handling of missing or malformed results, and the all-facet ratchet binding all stay as they are. B1 lowers only the staging ordinal floor and the staging confidence treatment.

## Adoption boundary

Lucas must explicitly approve the floor, the confidence treatment, and the retained P10/production boundary before implementation. No approval is recorded in this draft.

After approval: append the agreed text as the next unused approved amendment, rebuild the hash chain, and implement the corresponding gate change and regression tests in a separate PR. This draft changes no approved amendment, plan hash, gate code, or threshold.
