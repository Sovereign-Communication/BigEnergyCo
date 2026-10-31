## Handback: merged main proved once, and its only red check is the exit rule on #292

### Sweep first

Every comment on #189, #194, #196-#202, #287 and #292 since 2026-10-21 is mine. The owner has not replied to any thread in this program. **#292 remains the single blocking decision**, and nothing else in the queue can move until it is answered.

### Merged main, proved with no edits

Fresh clone of `origin/main` at `551ce8f`, working tree clean, nothing touched:

| check | result |
| --- | --- |
| `npm test` | **1,915 / 1,915**, 0 fail, 0 skipped |
| `check-chars`, `seo`, `format:check`, `plan:check`, `deploy:check`, `gate:facet-evidence` | all **pass** (21/21 facets covered) |
| CI run `39989962080`, 7 jobs | 6 green, 1 red |

The red job is `jev-complete`, and **it does not fail on score**:

```
score: 96.07 / 100  (target 95)  [FAIL]
6/21 proven · 13 facets at 85 (confident) · 2 facets at 60 (mixed)
  advisor      ordinal 60, confidence 0.43
  translation  ordinal 60, confidence 0.54
0/21 facets at the 0.95 confidence bar
```

`scripts/lib/jev-complete.mjs` says why, and it is stricter than the printed summary suggests:

```js
pass = allHard && combined >= target && blocking.length === 0
       && notProven.length === 0 && lowConfidence.length === 0;
//   notProven     = facet.index < COMPLETE_EXIT_FACET_INDEX   // 4 == ordinal 100
//   lowConfidence = facet.confidence < COMPLETE_MIN_CONFIDENCE // 0.95
```

So the run fails on `notProven` (15 facets below 100) and `lowConfidence` (21 facets below 0.95). It does **not** fail on `blocking` (nothing at ordinal 0) and does not fail on score. **The gate on `main` is the P0.3(c)/A-004 program-exit rule**, not a staging floor: every one of the 21 facets must be at 100 *and* at 0.95 confidence.

That reframes #292's three questions. A staging floor anywhere between 60 and 100 cannot green `main`, because nothing in that range satisfies `COMPLETE_EXIT_FACET_INDEX = 4`. Only an all-100 run does. The confidence half has never been met in the CI configuration: 147 facet-confidence samples across seven merged-main runs, none at or above 0.95 (this run: maximum 0.86, median 0.56; series maximum 0.90). It is not unreachable, which is worse -- a no-evidence live run measured today put 6 facets above 0.95, including 0.97 on a verdict of "mixed". Confidence moves with how the evidence is framed, not with whether the code works; measured counter-example in #292.

So merged main is red by construction under the current rule and the current evidence bundle -- not by defect, and not by anything this program's evidence work has moved. **The only red check on `main` is the rule the owner is being asked to change.**

One causal step worth keeping: the only change between `43f5378b` (`testing` at 85) and this tip is #302, a test-only PR. `testing` is now proven at 100, code-defined. I do not claim the rest of the +0.57 is anything but judge variance.

### Is the audit battery re-runnable? Yes for every input that costs money. No for the one file that is the artifact.

Measured today, not inferred from the absent database.

**The transport, model and key all work.** `scripts/lib/jev-live.mjs` resolves `TYPESAFE_API_KEY` / `HARNESS_JEV_KEY` / `JEV_API_KEY` from the environment, this repo's `.env`, or `~/.config/harness/jev.env`. A live call from this checkout returned **HTTP 200**, `model: jev-latest`, and `usage: {input_tokens: 2025, output_tokens: 32}` for a 5,200-character state with two questions -- **$0.00000085** at the repo's own canonical rate (`worker/jev-price.mjs`, US$0.00042 per million).

**The whole run is small.** `docs/jev-completion/PRESCRIPTIONS.md` records 1,986 functions x 21 questions, plus 760 prescriptions, 649 context-needs, 88 contextual re-judgments and the security/testplan/concurrency batteries: about **4,300 calls**. At ~3.5k tokens per 21-question call that is **~15M tokens, roughly one US cent**; at 5-8 s per call (the CI gate's full 21-facet call took 8 s end to end) it is **~7 h serial, ~30 min at 12-way**. The original run reported `0 API errors`, so there is no retry tax to budget.

**The driver is gone.** No commit in this repository's history ever added `audit.db` or any `battery_*.csv` (`git log --all` finds neither). The `harness` repo runs the same program on its own corpus and publishes the same file family -- `docs/jev-completion/battery_testplan.csv` (562 rows), `prescriptions.csv`, `veto_context.csv`, `CONCURRENCY_AND_TESTGAP_DISPOSITIONS.md` -- but not the driver either. The question bank, the literal 21 per-function prompts, is not written down anywhere in this repo; only the count is.

**So the battery is reproducible, not restorable.** About 200 lines of driver (AST walk -> function list -> per-function state slice -> 21 questions -> rows) plus a key regenerates a *comparable* audit. It cannot return the *same* rows: different rubric wording, a different tree, a different sample.

### The two partial cars, stated exactly

**#197 -- "27 of 51 with no recoverable identity" is only half right.** `docs/jev-completion/prescriptions.csv` *is* committed (761 rows), and **754 of 761 still name a construct that exists** in today's tree; the 7 exceptions are listed on #197. What is genuinely missing is the `dispositions` table, which turned 121 battery suspects into 51 must-fix. Those 27 identities are in no artifact. They are **replaceable** -- a re-run recomputes the fail-closed queue against today's code, which is what such a queue should describe anyway -- but not recoverable.

**#201 -- same shape.** `battery_testplan` rows are recomputable, and the mechanical half needs no judge at all. Measured now on `551ce8f`: **248 of 729** declared functions in `assets/js` + `worker` are named in no test or smoke file. That is a name-presence lower bound, not coverage -- transitive coverage counts as covered, which is why it comes out below 196+.

### What the owner must decide

Three policy questions, all in #292. None is settleable by more evidence; seven merged-main runs and 147 facet-confidence samples never produced a 0.95.

1. **Does `main` run the program-exit rule, or is there a staging mode?** Today `COMPLETE_EXIT_FACET_INDEX = 4` binds every push: all 21 facets at 100. A staging floor of 85 is not a threshold tweak, it is new gate code plus a pack that can express "staging".
2. **Facet confidence:** telemetry plus documented investigation, or the hard 0.95 block no run has ever met.
3. **P10 boundary:** confirm 95/95/95 binds at program exit rather than on every push to `main` -- which is what question 1 implements.

Program state: five cars closed (#196, #198, #199, #200, #202), two partial (#197 needs a re-run or the dispositions; #201 needs a re-run or the testplan rows), #292 awaiting this decision.

