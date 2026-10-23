# Proposed Amendment B1: Staging Jev Gate

**Status:** Draft for review. Not approved or adopted.

**Amends:** P0.3 (Jev gate to spec, bullet (c): the pass predicate) -- the plan
item this proposal would change, and the item its filename names.

This is a proposal only. It does not amend `MASTER_PLAN.md`, append to the approved amendment chain, or change any gate code or CI threshold. Explicit owner approval is required before implementation.

## What changed in this revision

Three corrections, all against the shipped code and the recorded runs:

- The confidence clause is **not** unreachable. The previous revision said it was; a measured counter-example appears below and the claim is withdrawn.
- The previous table said every facet must reach 95. That is the scoped rule. The rule that binds `main` requires **100** (`COMPLETE_EXIT_FACET_INDEX = 4`).
- Two facets sit at 60, not one: `translation` and `advisor`. A staging floor that names only `translation` leaves `main` red.

## What the gate requires today

`scripts/lib/jev-complete.mjs` and `scripts/lib/jev-verdict.mjs` implement two different paths, and the one that binds `main` is the stricter:

| path           | code               | ordinal rule                                        | confidence rule | when it binds                                                   |
| -------------- | ------------------ | --------------------------------------------------- | --------------- | --------------------------------------------------------------- |
| whole-program  | `jev-complete.mjs` | **all 21 at 100** (`COMPLETE_EXIT_FACET_INDEX = 4`) | all 21 ≥ 0.95   | **every push to `main`**, unconditionally                       |
| scoped verdict | `jev-verdict.mjs`  | in-scope ≥ 95 (`COMPLETE_FACET_MIN_ORDINAL`)        | in-scope ≥ 0.95 | only when `exitRuleBinds`: scope at or after P0.4, and not P0.6 |
| bootstrap      | `jev-verdict.mjs`  | none                                                | none            | P0.3 sub-PRs and P0.6 (owner ruling, plan §9 rule 6)            |

The whole-program predicate is:

```js
pass =
  allHard &&
  combined >= target &&
  blocking.length === 0 &&
  notProven.length === 0 &&
  lowConfidence.length === 0;
// notProven     : facet.index <  COMPLETE_EXIT_FACET_INDEX  (4 == ordinal 100)
// lowConfidence : facet.confidence < COMPLETE_MIN_CONFIDENCE (0.95)
```

`improve_below_index` (85) does not appear in that predicate. It populates `required_work`; it decides what the report asks for, not whether the gate passes. A staging floor of 85 therefore **is new gate code** — a run-scoped exit index plus a pack that can express "staging", with tests for both — not a threshold edit and not a pack constant alone.

This is also the asymmetry that explains the observed CI behaviour: a P0.6-scoped evidence PR runs on the bootstrap and its `jev-complete` check is green in seconds, while the same gate on `main` is red, because the whole-program path has no bootstrap and no scope.

## Evidence from merged main

Seven merged-main `Tests` runs, pinned model `jev-1.14.0`, same gate and evidence pipeline. 147 facet-confidence samples:

| run         | SHA        | score | facets at 100 | facets ≥ 0.95 confidence | max confidence |
| ----------- | ---------- | ----- | ------------- | ------------------------ | -------------- |
| 39897213677 | `6c5d4511` | 97.36 | 11/21         | 0/21                     | 0.85           |
| 39907675713 | `0df93c36` | 97.71 | 12/21         | 0/21                     | 0.90           |
| 39912153709 | `7537336c` | 97.50 | 12/21         | 0/21                     | 0.88           |
| 39914620664 | `53888bfb` | 97.50 | 11/21         | 0/21                     | 0.88           |
| 39947674004 | `4a5a6689` | 97.50 | 11/21         | 0/21                     | 0.86           |
| 39955130960 | `43f5378b` | 95.50 | 5/21          | 0/21                     | 0.87           |
| 39989962080 | `551ce8f`  | 96.07 | 6/21          | 0/21                     | 0.86           |

None at or above 0.95; the maximum observed across the series is 0.90. On the latest run (`551ce8f`) the facets are:

- **100 (6):** seo 0.83, docs 0.40, testing 0.67, comparison 0.57, usecases 0.57, privacy 0.57
- **85 (13):** accessibility 0.86, design 0.62, correctness 0.57, security 0.57, i18n 0.57, performance 0.56, physics 0.52, provenance 0.48, spec 0.45, quality 0.43, resilience 0.42, experience 0.42, release 0.06
- **60 (2):** translation 0.54, advisor 0.43

The run reports `score: 96.07`, `pass: false`, `blockers: []`. It fails on `notProven` (15 facets below 100) and `lowConfidence` (21 below 0.95), not on the score, and nothing sits at ordinal 0.

## Correction: confidence moves with the prompt

The previous revision said the confidence clause "is unreachable by any evidence improvement". **That is withdrawn.** It was measured against the CI evidence pipeline only.

Running the same gate on the same tree with **no** evidence record attached — every run record defaulting red, `evidence_source_kind: none` — the live judge returned:

- **6 of 21 facets at confidence ≥ 0.95**, maximum **0.97 on `design`**, while rating `design` **mixed (60)**.
- `advisor` 0.43 → 0.88 and `translation` 0.54 → 0.84, the two facets the CI run rated most uncertain.

Nothing about the product changed between those calls. What changed was the text the judge was shown. The clause is reachable, and that is worse than unreachable: a 0.97-confidence verdict of "mixed" shows confidence is not a quality signal, and it rises when the evidence is thinner. A pass condition that a thinner bundle satisfies more easily rewards framing.

The argument for decision 2 below is therefore measured rather than absolute: facet confidence tracks how evidence is presented, so it belongs in telemetry with an investigation trigger, not in `pass`.

## The score is not the gate

`combined = 0.7 * mechanical + 0.3 * semantic`, and `mechanical` is 100 whenever the hard gates pass, so the score clears 95 at an average facet ordinal of just 83.3. One facet falling from 100 to 60 costs 0.57 points (`0.3 * 40 / 21`).

On `551ce8f`, thirteen facets at 85 cost 2.79 and two at 60 cost 1.14 — 3.93 off, which is exactly the 96.07 reported, with 15 facets unproven. Below all-100, the printed score does not decide the run; the ordinal clause does.

## Why phases 2, 3 and 4 did not close it

- **Phase 2** (quality, performance, i18n evidence, #289–#291): zero targeted-facet movement.
- **Phase 3** (facet-specific "proven" criteria, #293): generic labels produced 13 proven facets, specialised labels 10, an instruction-only variant 9. The change made the measurement worse.
- **Phase 4** (translation, #294): deterministic term anchors (56 checks, found and fixed a German `Batteri` truncation) and a material-quantity guard (found and fixed two dropped German figures). Its semantic instrument failed its own controls — questionnaire 1/18, direct-pair 16/18 — so it cannot certify translations. Native meaning review is the only remaining evidence, and there is no reviewer on this program.

Judge variance compounds this: on `43f5378b`, six facets fell 15 points on byte-identical evidence, and `translation` fell 60 → 35 on 261 characters that did not change. A policy built on "reach the number" reads rerun noise as progress.

## Points needing the owner's decision

1. **Staging facet floor.** Recommended: every facet ≥ 85, with **two** named exceptions at 60 — `translation` (exit condition: native meaning review before P10) and `advisor` (exit condition: the advisor audit the gate's own `required_work` already asks for, against the real chat and worker paths). Alternative: a flat ≥ 60 floor for every facet, simpler but it lets any facet sit at `mixed`. A flat ≥ 85 floor is not viable: neither exception can reach it with automation this program has. Implementing this requires the run-scoped exit index described above.
2. **Staging confidence.** Recommended: confidence is recorded as telemetry, and a facet below 0.95 triggers a documented investigation rather than an automatic block. Jev Gate Policy v1 (ratified 2026-10-21, "Replaces the absolute 0.95 Choice-confidence bar") already says this; the gate code has not implemented it. Issue #255's ratified reading kept the 95/95/95 CI rule as a separate program gate, so this needs the owner's explicit word rather than an agent's inference. Note that without this decision no ordinal floor can turn `main` green, because `lowConfidence` is 21/21 today.
3. **Scope and P10.** Recommended: B1 applies only to the staging check on an exact merged-main revision; scoped PR reports stay advisory. P10 and any promotion retain combined ≥ 95, every facet ≥ 95, and every facet at 0.95 confidence. The confidence question should be decided before P10 rather than at it: the measurement above is about the instrument, not about the phase, and the same conflict will recur at the exit bar. Nothing in this draft relaxes the exit rule.

## Unchanged safeguards

Hard gates, current-revision evidence, pinned live-model requirements, fail-closed handling of missing or malformed results, and the all-facet ratchet all stay exactly as they are. B1 lowers only the staging ordinal floor and the staging confidence treatment.

## Adoption boundary

The owner must explicitly approve the floor, the confidence treatment, and the retained P10/production boundary before implementation. No approval is recorded in this draft.

After approval: append the agreed text as the next unused approved amendment, rebuild the hash chain, and implement the corresponding gate change and regression tests in a separate PR. Re-measure on a merged-main run so the effect is recorded as a number rather than an argument.
