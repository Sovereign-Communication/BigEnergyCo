## Scope

Draft proposal for issue #287 Phase 5. It records the B1 wording and the three decisions that need the owner's explicit approval before implementation. **Not mergeable until that approval is recorded.**

No gate code, threshold, approved amendment, plan hash, or CI behaviour changes here. The draft file is corrected in this PR: one new file (108 lines) at `docs/plan/PROPOSED-AMENDMENT-P0.3-JEV-STAGING-GATE.md`.

## Decisions requested

1. **Staging ordinal floor.** Every facet ≥ 85 with named exceptions, a flat ≥ 60 floor, or leave the contract unchanged. *Recommended: ≥ 85, with `translation` named at 60 until native review and `advisor` named at 60 until the advisor audit the gate already asks for is run.*
2. **Staging confidence.** Record facet confidence as telemetry with a documented investigation trigger, or keep `COMPLETE_MIN_CONFIDENCE = 0.95` as a hard pass condition. *Recommended: telemetry, matching Jev Gate Policy v1.*
3. **P10 boundary.** Confirm 95/95/95 binds at program exit rather than on every push to `main`. *Recommended: exit only.*

Each is a policy call; none can be settled by more evidence work. What follows is the measurement behind them, then what each decision actually changes in the code.

## What the gate requires today

The draft file now states this table. Its previous revision listed 95 as the whole-program rule; that is the scoped rule, and it is not the one that binds `main`, which the file now records.

| path | code | ordinal rule | confidence rule | when it binds |
| --- | --- | --- | --- | --- |
| whole-program | `jev-complete.mjs` `pass` | **all 21 at 100** (`COMPLETE_EXIT_FACET_INDEX = 4`) | all 21 ≥ 0.95 | **every push to `main`**, unconditionally |
| scoped verdict | `jev-verdict.mjs` | in-scope facets ≥ 95 (`COMPLETE_FACET_MIN_ORDINAL`) | in-scope ≥ 0.95 | only when `exitRuleBinds`: scope at or after `P0.4`, and not `P0.6` |
| bootstrap | same | none | none | P0.3 sub-PRs and `P0.6` (owner ruling, plan §9 rule 6) |

The whole-program predicate is:

```js
pass = allHard && combined >= target && blocking.length === 0
       && notProven.length === 0 && lowConfidence.length === 0;

const blocking       = facets.filter(f => f.index <= doc.sentiment.blocking_max_index);   // ordinal 0
const notProven      = facets.filter(f => f.index <  COMPLETE_EXIT_FACET_INDEX);         // 4 == ordinal 100
const lowConfidence  = facets.filter(f => !(f.confidence >= COMPLETE_MIN_CONFIDENCE));   // 0.95
```

`improve_below_index` (85) does not appear in that predicate. It populates `required_work`, which is why 85 looks like a threshold when it is only a reporting boundary.

This also explains the asymmetry that has been visible all along: a `P0.6`-scoped evidence PR (for example #302) runs on the bootstrap and its `jev-complete` check is green in seconds, while the same gate on `main` is red, because the whole-program path has no bootstrap and no scope.

**So a staging floor of 85 cannot be a threshold edit.** It needs a run-scoped exit index in `jev-complete.mjs` (new code), a pack that can express "staging", and tests for both. That is decision 1's real size, and decision 3 is what authorises it.

## Evidence from merged `main`

Seven merged-main `Tests` runs recorded for this program, pinned model `jev-1.14.0`, same gate, same evidence pipeline. 147 facet-confidence samples:

| run | SHA | score | facets at 100 | facets ≥ 0.95 confidence | max confidence |
| --- | --- | --- | --- | --- | --- |
| 39897213677 | `6c5d4511` | 97.36 | 11/21 | 0/21 | 0.85 |
| 39907675713 | `0df93c36` | 97.71 | 12/21 | 0/21 | 0.90 |
| 39912153709 | `7537336c` | 97.50 | 12/21 | 0/21 | 0.88 |
| 39914620664 | `53888bfb` | 97.50 | 11/21 | 0/21 | 0.88 |
| 39947674004 | `4a5a6689` | 97.50 | 11/21 | 0/21 | 0.86 |
| 39955130960 | `43f5378b` | 95.50 | 5/21 | 0/21 | 0.87 |
| **39989962080** | **`551ce8f`** | **96.07** | **6/21** | **0/21** | **0.86** |

None at or above 0.95. Maximum observed across the series: 0.90.

### The current run, facet by facet

`main` at `551ce8f`, run `39989962080`: `score 96.07`, `pass false`, `blockers []`, live call 6,688 input tokens, $0.0000028.

| ordinal 100 | ordinal 85 | ordinal 60 |
| --- | --- | --- |
| seo 0.83, docs 0.40, testing 0.67, comparison 0.57, usecases 0.57, privacy 0.57 | accessibility 0.86, design 0.62, correctness 0.57, security 0.57, i18n 0.57, performance 0.56, physics 0.52, provenance 0.48, spec 0.45, quality 0.43, resilience 0.42, experience 0.42, release 0.06 | **translation 0.54, advisor 0.43** |

The run fails on `notProven` (15 facets below 100) and `lowConfidence` (21 below 0.95). It does not fail on the score, and nothing sits at ordinal 0.

Note for decision 1: **two** facets are at 60, not one. The draft recommends 85 with `translation` exempt; `advisor` would still hold `main` red, and the gate's own `required_work` line for it is "run the advisor audit against the real chat and worker paths". Either `advisor` is named as a second exception, or that audit is done.

## Correction: confidence is telemetry, not an impossibility

The previous revision said the confidence clause "is unreachable by any evidence improvement". **That is withdrawn**, in the file and below, on the strength of a counter-measurement.

Running the same gate on the same tree with **no** evidence record attached -- every run record defaulting red, `evidence_source_kind: none` -- the live judge returned:

- **6 of 21 facets at confidence ≥ 0.95**, maximum **0.97 on `design`**, while rating `design` **mixed (60)**.
- `advisor` 0.43 → 0.88 and `translation` 0.54 → 0.84, the two facets CI rated most uncertain.

Nothing about the product changed between those calls. What changed was the state text the judge was shown. The clause is therefore reachable, and that is worse than unreachable: a 0.97-confidence verdict of "mixed" shows confidence is not a quality signal, and the number rises when the evidence is thinner. A pass condition that a thinner bundle satisfies more easily rewards framing.

What survives is a measured argument for decision 2, not an impossibility argument: **facet confidence tracks how the evidence is presented, so it belongs in telemetry with an investigation trigger, not in `pass`.** (Jev Gate Policy v1, ratified 2026-10-21, already replaced the absolute 0.95 Choice-confidence bar; the gate code does not implement that yet. The `P0.6` bootstrap in `jev-verdict.mjs` is an earlier owner ruling made for this same reason.)

The file now carries the retraction and the counter-measurement, so the text the owner would approve does not contain a withdrawn claim.

## The aggregate is not the gate

`combined = 0.7 * mechanical + 0.3 * semantic`, and `mechanical` is 100 whenever the hard gates pass, so the score clears 95 at an average facet ordinal of just **83.3**. One facet falling from 100 to 60 costs 0.57 points (`0.3 * 40 / 21`).

Today's run: thirteen facets at 85 cost 2.79, two at 60 cost 1.14 -- 3.93 off, which is exactly the 96.07 it reports, with 15 facets unproven. Below all-100, the printed score is decoration, and the ordinal clause is what decides.

## Why phases 2, 3 and 4 did not close it

- **Phase 2** (quality, performance, i18n evidence, #289-#291): zero targeted-facet movement.
- **Phase 3** (facet-specific "proven" criteria, #293): generic labels produced 13 proven facets, specialised labels 10, an instruction-only variant 9. It made the measurement worse.
- **Phase 4** (translation, #294): deterministic term anchors (56 checks, found a German `Batteri` truncation) and a material-quantity guard (found two dropped German figures). The semantic instrument failed its own controls -- questionnaire 1/18, direct-pair 16/18 -- so it cannot certify translations. Native meaning review is the only remaining evidence, and there is no reviewer on this program.

Judge variance compounds this: on `43f5378b` six facets fell 15 points on byte-identical evidence, and `translation` fell 60 → 35 on 261 characters that did not change. Any policy built on "reach the number" is partly reading rerun noise.

## What each decision unlocks

| decision | what it changes in the code | effect on `main` at `551ce8f` | needs |
| --- | --- | --- | --- |
| 1 written as a threshold edit (85, `translation` exempt) | `improve_below_index` only | **none** -- still red on 15 `notProven` | -- |
| 1' run-scoped staging ordinal | a scoped exit index in `jev-complete.mjs`, new pack field, tests | green **only if** the floor is ≤ 60, or 85 with `translation` **and** `advisor` named | decision 3 |
| 2 confidence as telemetry | `lowConfidence` removed from `pass` for staging runs, kept for exit | required for **any** green: 21/21 fail it today | -- |
| 3 exit-only 95/95/95 | the same scoping as 1', scoped PR reports stay advisory | makes 1' an exit/staging split rather than a threshold cut | -- |

If all three are approved as recommended, `main` turns green on the current evidence at 96.07: 6 facets proven, 13 at 85, and 2 named at 60 (15 unproven, none below 60). If the ordinal clause stays at 100, `main` stays red whatever is decided about confidence -- which is the clearest statement of what is actually being asked.

## Unchanged safeguards

Hard gates, current-revision evidence, pinned live-model requirements, fail-closed handling of missing or malformed results, and the all-facet ratchet all stay exactly as they are. B1 lowers only the staging ordinal floor and the staging confidence treatment.

## Adoption boundary

The owner must explicitly approve the floor, the confidence treatment, and the retained P10/production boundary before implementation. No approval is recorded in this draft.

After approval: append the agreed text as the next unused approved amendment, rebuild the hash chain, and implement the gate change with regression tests in a separate PR, then re-measure on a merged-main run so the effect is a number rather than an argument.

## Validation

`jev-complete` on this head is **green**, and what that means is worth stating precisely. #303 taught `resolveCiScope` the proposal convention, and this file now follows it (`PROPOSED-AMENDMENT-P0.3-JEV-STAGING-GATE.md`), so the job resolved `scope: P0.3` and ran the scoped path instead of exiting at scope resolution:

```
scope: P0.3 — THIS RUN'S VERDICT IS THE SCOPED ONE below.
scoped (P0.3): 96.63 / 100  (target 95)  [PASS]
  facets in scope (4): correctness, docs, security, testing
    ✓ hard gates passed
    ✓ ratchet met
whole program (reported only — NOT this run's exit criterion): 96.21 / 100  [FAIL]
```

That green is the **P0.3 bootstrap** (owner ruling, plan §9 rule 6): a gate-building PR merges on green CI plus no ratchet regression, even below the bar, and the report records `bootstrap_applies: true`. It is not a judgment that B1 is correct: the four in-scope facets are 85, 85, 85 and 100, none at 0.95 confidence, and the whole-program figure is 96.21 with `translation` still at 60 -- the same failure this proposal exists to surface.

Documentation-only change. Prettier applied. `npm run plan:check` and the plan-pin tests are re-run by CI on this head; no plan, amendment chain, or ledger row is touched.
