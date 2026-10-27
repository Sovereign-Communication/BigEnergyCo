[Treystu 2026-10-06T21:51:32Z] ## PR green-path sequencing (from live gate reports + audit correlation, 2026-10-06)

**BLUF: The five red PRs have five different diseases. Here is the order that unblocks the train.**

### Sequence
1. **#193 first** — only blocker is experience-ratchet noise (85→35, conf 0.11, zero product code). Iteration: add an AT (screen-reader) pass to close the one stated evidence gap, push for a fresh judgment. Carries P0.6 + A-002 + A-003 to main — **#185 cannot resolve scope until this merges.**
2. **#185 second** — rebase onto main after #193, scope P0.6 resolves, A-003 bootstrap applies. Same ratchet lottery as #193 thereafter.
3. **#171 third** — the audit-backed PR. 156 actionable findings on its 31 files map to the quality gap: 10 must-fix dispositions + top-10 test gaps fix the quality ratchet (85→60); 8 refined prescriptions + 30 escape-output items build quality toward proven. A11y needs PR-side a11y-matrix work (no audit signal). Per-file item list posted on the PR.
4. **#192 fourth** — the breach is real (first paint 189KB vs 35KB, 5.4x). Green needs the bundle diet (code-split, lazy-load, dead code) or an owner amendment of the §3.1 budget if 35KB is unattainable. Plus AT pass + quality to proven.
5. **#165 last** — blocked on product work it cannot do itself: 5 facets at 0 (comparison, privacy, provenance, translation, usecases) need P1.3/P2.x/D-01/D-16 product PRs. Re-run after #171/#192 and those land; or close as blocked/superseded.

### Issue → PR unblock map
- #195 (dead code) → #192 (marginal)
- #196 (validation) → #171 quality
- #197 (fail-closed) → #171 quality ratchet
- #198 (concurrency) → none (no confirmed bugs)
- #199 (error discipline) → #171 quality
- #200 (wiring) → #171 verification only
- #201 (test gaps) → #171 quality ratchet
- #202 (escape-output) → #171 quality/security

Each car issue now carries its "Unblocks" line in its body. Per-PR diagnosis comments are posted on all five PRs.
[Treystu 2026-10-21T08:28:27Z] ## Closure sweep — Jev cars #196–#202 need a re-run

The 7 Jev audit cars (#196–#202) have not had an audit re-run since 2026-10-06. Their Scope sections pin specific functions to Oct 6 line numbers, which are likely stale after two weeks of merges.

**What is missing:** fresh data, not planning. The cars are well-structured (Scope + Acceptance criteria present and actionable). What the lane needs is a re-run of the 7 Jev batteries (input validation, fail-closed, concurrency, error discipline, wiring, test gaps, secrets/randomness) against current main to refresh the findings — or an explicit disposition if the program is superseded.

No other planning gaps found in this sweep.
[Treystu 2026-10-23T11:31:08Z] ## #287 progress — verified from check-runs and merged PRs (2026-10-23)

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

[Treystu 2026-10-23T12:41:21Z] ## Queue cleared — #171 merged, #292 is the only open PR

- **#171 merged** as `43f5378b` (squash, 2026-10-23 12:40Z) after every required check passed on `61806cd4`, including `jev-complete`, `web-smoke` (8m40s) and Lighthouse. The two failures on the prior head were real: the cut preview overwrote a pinned budget, and the a11y flow used `gatesSince`/`reportCheckpoint` without defining them. Both fixed, with the pinned-budget probe now green in CI's own run.
- **#294 merged** as `4a5a6689`. Deterministic translation evidence; semantic probe rejected by its own controls.
- **#292 remains open and draft.** It is the only open PR. It cannot merge without the owner's recorded approval, so "zero open PRs" now depends on that decision, not on unlanded work.

## Gate measurement after #294 (main `4a5a6689`, run `39947674004`)

97.50/100, hard gates green, **11/21 facets proven**, **21/21 facets below 0.95 confidence**, max facet confidence 0.86, `translation` still 60 with its confidence at 0.55. Five consecutive merged-main runs now give 105 facet-confidence samples with none at or above 0.95.

## Phase 6

Not started, and it cannot start: green-once requires the confidence clause and the ten sub-proven facets to be resolved first. When #292's decision lands and the gate turns green on a merged-main SHA, the three-consecutive-merge stability check runs and is reported here.

[Treystu 2026-10-23T12:55:47Z] ## Post-#171 gate measurement on main `43f5378b` — the score moved, the evidence did not

Main `43f5378b` (Tests run `39955130960`) is green on every check except `jev-complete`: 95.50/100, hard gates green, 5/21 facets proven, 0/21 at the 0.95 confidence bar, max confidence 0.87.

Compared with the immediately preceding main (`4a5a6689`): design, correctness, security, docs and release each fell 100 → 85 on byte-identical evidence; translation fell 60 → 35 on a byte-identical 261-character line; experience fell 100 → 85 where the only text difference was a measured timing digit (83ms → 82ms). #171 changed composed lines only for accessibility (more detailed, and still 85), experience (same content), privacy, performance and quality.

So the 2-point score drop and the six-ordinal drop are judge variance, not a product regression. That is now recorded with the paired table in #292, which is the vehicle for the decision it implies: an all-facets-proven staging rule is partly adjudicating noise, and the 0.95 confidence clause cannot be met at all.

[Treystu 2026-10-23T13:28:39Z] ## Audit burndown — car 3 closed, and the exact state of the other six

**Merged:** #295 (squash `14144bd1`), from Jev car 3 (#198). Two real defects, both a promise path with no owner: two concurrent chat sends shared the single `#loadingMsg` node (first reply removed the second's spinner, replies could land out of order, and the refusal swallowed the typed text), and the smoke runtime's CDP `close()` left in-flight requests pending so each rejected 30s later with no handler — an unhandled rejection that killed the run with a bare stack instead of the stage it was on. Both are covered by executed tests; the chat one fails on the pre-fix tree. Asset tokens moved `20261023e → 20261023f` (`sw.js` `beco-v144 → beco-v145`) because `chat.js` is a served asset. Full suite 1,873/1,873; every CI check green including `jev-complete` and `web-smoke`.

Car 3's other two suspects were exonerated with the guard named, not asserted: `setupCitySearch` is generation- and query-stamped at three landing sites with two regression tests, and `installNasaInterceptor` releases under `finally` and restores `onmessage`. Details on #198.

### What each remaining car actually needs

| car | issue | items after its own Phase A | what is left |
| --- | --- | --- | --- |
| 1 | #196 | **3** execution-ready (0.95–0.98) | `mergeReSlice` validate-guard (0.98), `populatePrintSheet` escape-output (0.96), `clearCompactCache` validate-guard (0.95). First-pass check today: `clearCompactCache` **no longer exists** in the tree — it appears only in `PRESCRIPTIONS.md`, so that item is obsolete rather than unfixed. The other two need the sink traced before any change. |
| 2 | #197 | 51 must-fix, 11 production | disposition battery; production items are all ≤0.85 confidence, so each needs its own behaviour read. Largest single body of work. |
| 3 | #198 | 4 | **closed** by #295. |
| 4 | #199 | ~8 reclassified | validate-early → fallback-default reclassifications; URL/sink hygiene (Scope B) untouched. |
| 5 | #200 | 4 confirmed + 15 ambiguous | the 4 confirmed are all in `tests/` tooling; the 15 need facet-seam reads. |
| 6 | #201 | 6 integration + 202 unit gaps | test-writing, no verdicts to clear; the top six are named by function. |
| 7 | #202 | 13 fails, all tooling | none in shipped `assets/` code. |

### Still blocked on the owner

#292 is the only other open PR and stays draft: it needs Lucas's recorded approval on the staging floor, the confidence treatment, and the P10 boundary. Nothing in this session changed that, and no new comment from the owner has appeared on any thread.

[Treystu 2026-10-23T14:15:32Z] ## Burndown table update — car 1 closed (#296)

Car 1 (#196) is done: `1fe37e6e`, one test file, no shipped-code change. Three execution-ready items resolved as **one guard confirmed** (`mergeReSlice`, fixed in #171 with no test — now executed under test and failing on the reverted guard), **one prescription that does not reproduce** (`populatePrintSheet` has an `innerHTML` sink, but `basis` is literal-only and every hash-originated string field is whitelisted before it can set a control; the permissive codec is now pinned by test so the whitelists cannot be quietly removed), and **one function that no longer exists** (`clearCompactCache`, removed in `43f5378b`).

| car | issue | remaining after its own Phase A | state |
| --- | --- | --- | --- |
| 1 | #196 | 3 execution-ready (0.95–0.98) | **closed** — 1 pinned, 1 does not reproduce, 1 obsolete (#296) |
| 2 | #197 | 51 must-fix, 11 production | open; largest body of work |
| 3 | #198 | 4 | **closed** — 2 fixed with executed tests, 2 exonerated with the guard named (#295) |
| 4 | #199 | ~8 reclassified | open |
| 5 | #200 | 4 confirmed + 15 ambiguous | open; the 4 confirmed are `tests/` tooling |
| 6 | #201 | 6 integration + 202 unit gaps | open; test writing, no verdicts to clear |
| 7 | #202 | 13 fails, all tooling | open; none in shipped `assets/` |

Next in the queue by size: car 5's four confirmed tooling items (`hangingFetch`, `sleep`, `tx.objectStore`, `open`), then car 7's 13 tooling fails. Both are confined to `tests/`/`scripts/`, so they carry the same low blast radius as car 1 and can land the same way.

Two process facts learned here, so the next car does not lose a cycle: `npm run format`/`format:check` only see **tracked** files, so a new test file must be committed before the format gate can pass on it; and `jev-complete` resolves its scope from the plan item in the PR title **as captured in the triggering event**, so a title fix needs a push, not a job re-run. Audit evidence PRs name P0.6 — the plan says so, and without it the gate cannot scope a test-only diff.

[Treystu 2026-10-23T14:37:54Z] ## Burndown table update — car 5's confirmed items closed (#297)

`b899b46`. The four confirmed tooling items resolved to **one real defect and three fixtures**: `tx.objectStore` pointed at an IndexedDB double, and behind that double `idbPut`/`idbDelete` awaited the *transaction* with `idbReq` — a handler a transaction never fires — so the promise never settled in a browser and `db.close()` never ran. One open connection leaked per cold fetch, in the shipped client, with nine green tests around it because the double exposed `complete: Promise.resolve()` and thus agreed with the bug. Fixed with `txDone(tx)` on `oncomplete`/`onerror`/`onabort` plus a `finally` close on every exit; the double now models the platform, and three tests count opens against closes and fail on the unfixed tree.

| car | issue | remaining after its own Phase A | state |
| --- | --- | --- | --- |
| 1 | #196 | 3 execution-ready | **closed** — 1 pinned, 1 does not reproduce, 1 obsolete (#296) |
| 2 | #197 | 51 must-fix, 11 production | open; largest body of work |
| 3 | #198 | 4 | **closed** — 2 fixed with executed tests, 2 exonerated (#295) |
| 4 | #199 | ~8 reclassified | open |
| 5 | #200 | 4 confirmed + 15 ambiguous | **4 confirmed closed** (#297); 15 ambiguous open — two of them already answered on #198/#196 |
| 6 | #201 | 6 integration + 202 unit gaps | open; test writing, no verdicts to clear |
| 7 | #202 | 13 fails, all tooling | open; none in shipped `assets/` |

The pattern across three cars is now clear enough to say plainly: these prescriptions name a *symptom site*, and the site is often a test double rather than the defect. Car 3's two real bugs were one indirection away from the flagged lines; car 5's single real bug was behind the flagged mock. So the cheap-looking tooling cars are not always cosmetic — car 5's fix was in served code that ships to every visitor.

Next by size: car 7 (#202), 13 tooling fails, none in shipped `assets/` — same inspection method, and it will likely resolve the same way, but the IndexedDB lesson says to read the code the fixture stands for before accepting the "it's only tooling" framing.

[Treystu 2026-10-23T14:57:04Z] ## Burndown table update — car 7 closed (#298)

`feb5c25`. All 13 storage/randomness suspects dispositioned: twelve are test doubles making the platform call the test is about, and two of them (`runtime.mjs::send`, `weather-persistence::put`) were already reworked by #295 and #297. The trace found the rest of the value one layer down — `setSimpleMode`, `persistWizard` and the country-partition cache all guard their storage writes with `try/catch`, all correct, **none tested**, and the doubles in the suite are the one kind of storage that never throws. Four tests now use a throwing storage and assert the behaviour survives; each fails when its guard is stripped.

| car | issue | remaining after its own Phase A | state |
| --- | --- | --- | --- |
| 1 | #196 | 3 execution-ready | **closed** — 1 pinned, 1 does not reproduce, 1 obsolete (#296) |
| 2 | #197 | 51 must-fix, 11 production | open; largest body of work, every item ≤0.85 |
| 3 | #198 | 4 | **closed** — 2 fixed with executed tests, 2 exonerated (#295) |
| 4 | #199 | ~8 reclassified | open; validate-early → fallback-default reclassifications |
| 5 | #200 | 4 confirmed + 15 ambiguous | **4 confirmed closed** (#297); 15 ambiguous open |
| 6 | #201 | 6 integration + 202 unit gaps | open; test writing, no verdicts to clear |
| 7 | #202 | 13 tooling fails | **closed** — 13 dispositioned, 4 guard tests added (#298) |

Four cars are now closed. Five PRs (#295, #296, #297, #298) landed this session, each with the plan's own P0.6 scope, and two of them fixed real defects in served code — the chat send path and the IndexedDB connection leak — that no failing test had ever pointed at.

What remains is qualitatively different from what is done. Cars 1, 3, 5 (confirmed), and 7 were *suspect lists*, where the work was reading and proving. Cars 2, 4, 6 are *volume*: 51 must-fix items, ~8 reclassifications, and 6 integration plus 202 unit test gaps, all at confidences below the 0.85 gate, so each needs its own behaviour read rather than a batch edit. Car 5's 15 ambiguous production items are the same shape at a smaller scale. None of it is blocked on the owner; only #292 is.

[Treystu 2026-10-23T15:20:40Z] ## Burndown table update — car 4 closed (#299)

`737a0fd`. 42 suspects, three real defects:

- **both staging gates could not report a failed spawn.** They listened only for `"exit"`, which `spawn` never emits when the executable or cwd is missing — it emits `"error"`, and an unhandled EventEmitter error is a throw. The gate died with a raw stack before its `finally` closed the server and removed the staging directory. `scripts/lib/run-child.mjs` now resolves a non-zero code so the caller's message and cleanup both run;
- **`laborMidPerKwh(null)` threw** inside the cost model, because a default parameter only covers `undefined`;
- **`paretoFront(undefined)` / `[null]` threw**, and unpriced points sorted among priced ones.

The other 39 are dispositioned with the deciding code: already guarded (`textWidth`, `findWorstStreak`, `swapSchedule`, `relativeLuminance` at its caller), caller-clamped and deliberately unchanged (`pvLadder`, `battLadder`, `flatProfile`, `siteMemoKey` — a helper default would invent an envelope or a load, which is a product decision), obsolete (`monthName`, `fmtDelta`), and 31 URL/sink calls whose input is a constant, a validated number, or a base URL already constrained by `normalizeBase` and the origin gate.

| car | issue | remaining after its own Phase A | state |
| --- | --- | --- | --- |
| 1 | #196 | 3 execution-ready | **closed** — 1 pinned, 1 does not reproduce, 1 obsolete (#296) |
| 2 | #197 | 51 must-fix, 11 production | open; largest body of work, every item ≤0.85 |
| 3 | #198 | 4 | **closed** — 2 fixed with executed tests, 2 exonerated (#295) |
| 4 | #199 | ~8 reclassified + 3 standing + 31 URL/sink | **closed** — 3 fixed, 39 dispositioned (#299) |
| 5 | #200 | 4 confirmed + 15 ambiguous | **4 confirmed closed** (#297); 15 ambiguous open |
| 6 | #201 | 6 integration + 202 unit gaps | open; test writing, no verdicts to clear |
| 7 | #202 | 13 tooling fails | **closed** — 13 dispositioned, 4 guard tests (#298) |

Five cars are closed, six PRs landed (#295–#299), and **five real defects in served code or its gates** have been fixed along the way: the concurrent chat send, the IndexedDB connection leak, the two spawn-blind staging gates, the null labor range, and the throwing Pareto input. None of those had a failing test pointing at them; each came from reading a low-confidence prescription against the code.

What is left is volume, and it is honest volume: car 2's 51 must-fix items plus car 2's 11 production entries, car 6's 6 integration and 202 unit gaps, and car 5's 15 ambiguous production items. Every one sits below the 0.85 confidence gate, so each needs its own behaviour read — roughly the work of four more cars at this session's pace, with no owner input required. Only #292 is blocked, and only on Lucas.

[Treystu 2026-10-23T16:08:24Z] ## Burndown table update — car 2 partially closed (#300)

`a40d589`. Car 2 is the largest queue and the first one that did not close. Three real defects fixed (the unguarded Groq body read, `Number("")` → 0,0 coordinates in both city parsers, and the privacy gate measuring a coordinate's magnitude instead of its precision), 24 of the 51 must-fix items dispositioned individually, **27 unidentified**.

**Why 27 cannot be dispositioned:** the issue's own pointer is `audit.db` table `dispositions`. That file is not in the repository — not tracked, not in `jev-artifacts/`, not in the merged phase-2 PR (#193), which carried `prescriptions.csv`, `context-needs.csv` and `VERDICTS.md` only. `VERDICTS.md` names the top 15 of the 51. The remaining 27 were never written down anywhere a repo reader can reach, so no amount of code reading can enumerate them. Recorded as open rather than counted as done.

| car | issue | remaining after its own Phase A | state |
| --- | --- | --- | --- |
| 1 | #196 | 3 execution-ready | **closed** — 1 pinned, 1 does not reproduce, 1 obsolete (#296) |
| 2 | #197 | 51 must-fix, 11 production | **partial** — 3 defects fixed, 24 dispositioned, 27 unidentified pending the audit DB or a battery re-run (#300) |
| 3 | #198 | 4 | **closed** — 2 fixed with executed tests, 2 exonerated (#295) |
| 4 | #199 | ~8 reclassified + 3 standing + 31 URL/sink | **closed** — 3 fixed, 39 dispositioned (#299) |
| 5 | #200 | 4 confirmed + 15 ambiguous | **4 confirmed closed** (#297); 15 ambiguous open |
| 6 | #201 | 6 integration + 202 unit gaps | open; test writing, no verdicts to clear |
| 7 | #202 | 13 tooling fails | **closed** — 13 dispositioned, 4 guard tests (#298) |

Six cars are closed, seven PRs landed (#295–#300), and **eight real defects** have been fixed: the concurrent chat send, the IndexedDB connection leak, the two spawn-blind staging gates, the null labor range, the throwing Pareto input, the unguarded upstream body read, blank coordinates resolving to 0,0, and a privacy precision check that was blind where it mattered most. None had a failing test pointing at it; each came from reading a low-confidence prescription against the code.

Two of the seven queues are now blocked on something a code read cannot supply: car 6's 202 unit gaps are test writing (volume, not inference), and car 2's remaining 27 items need the source list before they can be read at all. Car 5's 15 ambiguous production items remain the largest open judgement queue that is actually workable.

[Treystu 2026-10-23T16:29:06Z] ## Burndown table update — car 5 closed (#301)

`c48cf8a`. Fifteen ambiguous production items, one real contract violation (`createMapProviderRegistry` installed a provider before `init()` could reject), fourteen guards named, three prior verdicts confirmed rather than re-derived.

| car | issue | remaining after its own Phase A | state |
| --- | --- | --- | --- |
| 1 | #196 | 3 execution-ready | **closed** — 1 pinned, 1 does not reproduce, 1 obsolete (#296) |
| 2 | #197 | 51 must-fix, 11 production | **partial** — 3 defects fixed, 24 dispositioned, 27 unidentified pending the audit DB or a battery re-run (#300) |
| 3 | #198 | 4 | **closed** — 2 fixed with executed tests, 2 exonerated (#295) |
| 4 | #199 | ~8 reclassified + 3 standing + 31 URL/sink | **closed** — 3 fixed, 39 dispositioned (#299) |
| 5 | #200 | 4 confirmed + 15 ambiguous | **closed** — 2 fixed (#297, #301); the other 17 are fixtures or already guarded |
| 6 | #201 | 6 integration + 202 unit gaps | open; test writing, no verdicts to clear |
| 7 | #202 | 13 tooling fails | **closed** — 13 dispositioned, 4 guard tests (#298) |

Six cars closed, one partial, one open on volume alone. Eight PRs landed (#295–#301), and the defect count is now **nine**: the concurrent chat send, the IndexedDB connection leak, the two spawn-blind staging gates, the null labor range, the throwing Pareto input, the unguarded upstream body read, blank coordinates resolving to 0,0, a privacy precision check blind where it mattered most, and a map registry that advertised a surface it never created.

Worth noting what this car looked like from the outside: fifteen items the judge scored 0.30–0.70 for brokenness, and fourteen of them were already guarded — several by guards nothing tested. The one that was real was a two-line ordering bug in an optional feature, invisible in production precisely because its only caller compensates. That is the honest yield of a sub-gate queue, and it is why the dispositions matter as much as the fix: a burndown that only counts fixes would have called this car closed eight PRs ago.
[Treystu 2026-10-23T16:52:14Z] ## Burndown table update — car 6 closed on the testable half (#302)

`551ce8f`. Six integration gaps and 202 unit gaps. Four integration items now execute shipped code; two are dispositioned with the reason; six named unit gaps turned out to be covered through their public callers; ~196 remain unidentified because `audit.db` is not in the repository.

| car | issue | remaining after its own Phase A | state |
| --- | --- | --- | --- |
| 1 | #196 | 3 execution-ready | **closed** — 1 pinned, 1 does not reproduce, 1 obsolete (#296) |
| 2 | #197 | 51 must-fix, 11 production | **partial** — 3 defects fixed, 24 dispositioned, 27 unidentified pending the audit DB or a battery re-run (#300) |
| 3 | #198 | 4 | **closed** — 2 fixed with executed tests, 2 exonerated (#295) |
| 4 | #199 | ~8 reclassified + 3 standing + 31 URL/sink | **closed** — 3 fixed, 39 dispositioned (#299) |
| 5 | #200 | 4 confirmed + 15 ambiguous | **closed** — 2 fixed (#297, #301); the other 17 are fixtures or already guarded |
| 6 | #201 | 6 integration + 202 unit gaps | **partial** — 4 integration tested, 2 dispositioned, 6 unit gaps already covered; ~196 unidentified (#302) |
| 7 | #202 | 13 tooling fails | **closed** — 13 dispositioned, 4 guard tests (#298) |

Five cars closed, two partial. Nine PRs landed (#295–#302).

Car 6 is the clearest example of why the dispositions carry as much weight as the fixes. Its headline number — 208 missing tests — collapsed on inspection into 4 real gaps, 8 items already covered by tests under other names, 2 that no meaningful test could improve, and 196 that cannot be named. Writing 208 tests to satisfy the count would have added thousands of lines asserting that stubs return what they were told, and would have made the suite slower and less informative at the same time.

The two partial cars now fail for the same external reason: the audit database that holds `dispositions` (car 2) and `battery_testplan` (car 6) was never committed, so the specific items exist only in a run that is gone. Either the battery is re-run or `audit.db` is published; until then those two rows cannot honestly move.

[Treystu 2026-10-23T17:06:56Z] ## Handback: merged main proved once, and its only red check is the exit rule on #292

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


[Treystu 2026-10-23T21:00:02Z] ## Burndown status — 2026-10-23

**Gate track:** #287 Phases 1-4 complete. #292 (B1 policy) awaiting owner decision. Gate still red on main `23188e04`.

**Car track burndown (all now have driving comments):**
- #198 (concurrency, shipped bug) — HIGHEST PRIORITY, ~80 LoC
- #196 (input validation) — HIGH, ~150 LoC
- #197 (fail-closed, triage top 20) — ~300 LoC
- #199 (error discipline) — ~120 LoC
- #200 (wiring) — ~200 LoC
- #201 (test gaps, 6 integration first) — ~400 LoC
- #202 (secrets, tooling only) — LOWEST, ~80 LoC

**Total car-track:** ~1,330 LoC. All parallelizable. Gate decision (#292) is the critical path.
[Treystu 2026-10-24T13:23:06Z] ## Landed: #197 top-10 fail-closed pass — PR #311 (squash `b8d6ba0c`)

- **#197 (fail-closed): top 10 by blast radius now 10/10 dispositioned.** The five that had no verdict are settled in #311 — `applyI18n` **hardened** (its dictionary-failure path no longer claims `lang`/`dir` it cannot back; one behavior change, failure path only), `handleWorkerRequest`, `fetchHourlyCached`, `refreshSelectionOutputs`, `reset` dispositioned fail-closed/fail-open-by-design with reasons, each pinned by a test that fails if the guard is removed (verified by in-place revert, restored after).
- Gates on the PR head: suite **1,951/1,951** (7 new tests), `seo`/`format:check`/`plan:check`/`deploy:check`/`coverage`/facet-evidence green, byte ratchet **0 regressions, 1 improvement** (`js_to_first_result` 197.2 KB / 200 KB), stamp `20261024o → 20261024p`, `sw.js` `beco-v164`. All 9 required checks green on the head; scoped P0.6 report attached (96.07, hard gates green, A-003 rule).
- Post-merge main `b8d6ba0c`: all required checks green except `jev-complete` (96.07, hard gates green; blockers: translation ordinal 60, resilience dipped 85→60 this run — judge volatility, flagged not absorbed).
- **Not landed / still blocked:** ranks 11–20 of #197's blast-radius order and the 27 unidentified must-fix items — they exist only in `audit.db`, never committed. Owner decision needed: publish `dispositions` or authorize the battery re-run (recorded on #197). No ranking invented, no gate loosened.

Plan item: P0.6.
[Treystu 2026-10-24T14:11:25Z] ## Landed: #200 car-5 wiring prescriptions — PR #312 (squash `31341fc6`)

- **P0.6 / #200: all 20 return-promise/delegate-up prescriptions dispositioned.** 1 applied — `worker-bridge.mjs::waitUntil` now takes the promise it is given, returns an awaitable, and swallows a rejection the way the runtime does (the old `() => {}` dropped both halves; pinned by a test that fails on the old stub with `unhandledRejection: Error: bg task died`); 18 dispositioned with reasons recorded on #200 and in `tests/audit-car5-wiring.test.mjs`; `triggerInstall` skipped per the issue (dies in car 0); the 51 `no-change` fits untouched.
- Gates on the PR head: suite **1,952/1,952** (+1 test), `seo`/`format:check`/`plan:check`/`deploy:check`/`coverage` green, byte budgets **0 regressions, 1 improvement**, shipped bytes unchanged (stamp stays `20261024p`), all 9 required checks green, scoped P0.6 report attached (96.29, hard gates green, A-003 rule).
- With #297 (4 confirmed) and #301 (15 ambiguous) already closed, car 5's acceptance is complete; close decision left to the owner.
- Post-merge main `31341fc6`: `jev-complete` red at 95.86 with all hard gates green — blocked by translation (owner gap) and resilience (re-read recorded on #145).

Plan item: P0.6.
[Treystu 2026-10-24T14:36:14Z] ## Mission step 4 named list — fully processed (0 lines landed this update)

- **Landed:** #197 top-10 (PR #311, `b8d6ba0c`), #200 car-5 wiring (PR #312, `31341fc6`).
- **Verified already-closed, nothing open in spec:** #201 (unit+integration surface closed by #302 `551ce8f9`, status recorded on the issue) and #202 car 7 (all 13 dispositions from #298 `feb5c25b` re-verified live on `31341fc6`, status recorded on the issue).

Both closures were stale-driving-comment cases: the comment asking for the work postdated the PR that had already closed it (#201 by 4 h, #202 by 6 h). Battery re-ranks for #197's ranks 11–20 and #201's ~196-name unit queue remain on the same owner decision (publish the battery table or authorize the re-run).
[Treystu 2026-10-24T15:35:01Z] ## Burndown resume note — 2026-10-24 · final main SHA `eabb378c2900d4e315eb97845cffef0f5d822ba8`

One place to restart. Everything below was checked this session, not recalled.

### Verified

**Steps 1–2 (repo hygiene):** #304 merged (`f19c3d50`, city-search listener cleanup); #310 loader deferral landed (`65e402f5`, translation-suggestion loader out of the first-result graph); B1 main-staging gate confirmed landed via #305 (`aa817547`, A-007 policy row in the ledger).

**Step 3 (three content merges, each checked via the check-runs API):** #304 (`f19c3d50`), #311 (`b8d6ba0c`), #312 (`31341fc6`) — web-smoke green on each, byte ratchet 0 regressions on each.

**Step 4 (mission-step-4 named list — complete):**
- #197 top-10 fail-closed pass → PR #311 (`b8d6ba0c`), 5 verdicts + 1 harden, 7 new tests.
- #200 car-5 wiring → PR #312 (`31341fc6`), 1 applied (`waitUntil`) + 18 dispositioned + 1 skipped per spec.
- #201 → verified already-closed (unit+integration surface closed by #302 `551ce8f9`; status on the issue). #202 → verified already-closed (all 13 dispositions from #298 `feb5c25b` re-verified live on `31341fc6`; status on the issue). Both driving comments were stale — written 4 h / 6 h *after* the PR that closed them.
- **Flake fix → PR #313 (`eabb378c`, this SHA):** the GRAPH walk in `tests/byte-budgets.test.mjs` raced deploy-manifest's mutation teeth (ENOENT on a stray vanishing mid-scan, failing 1951/1952 in 2 of 3 full-suite runs on pure main). Walk now tolerates ENOENT only at readdir/stat; missing modules/exports still fail hard; 1 deterministic teeth test added (revert-verified). Proof: **4 consecutive green full-suite runs (1953/1953 ×4; 7/8 green overall — the one failure was a different, pre-existing Windows-only `EPERM` in the mutation-lock helper, out of scope)**. All 9 checks green on the PR head incl. scoped `jev-complete` (P0.4: score 96.63, 7/7 hard gates, ratchet 0 regressions); A-003 report on the PR. Battery: format 813 files, plan pin, deploy, seo + stamp `20261024p` unchanged (test-only diff, 0 shipped bytes), byte budgets 0 regressions / 1 improvement.

### Not verified

**Merged-main `jev-complete` is red on `eabb378c`** (run 40106777172): score 96.64, all 7 hard gates green, `blocking_facets: []` — the single blocker is **"staging facet below ordinal 85: translation"** (ordinal 60, conf 0.67). **Closing #287 remains blocked** by that facet. All other required checks on `eabb378c` are green: test, coverage, analyze, audit, lighthouse, quality-evidence, quality-lab, web-smoke.

### The three owner decisions, with exact costs

**(a) Fluent reviewer coverage for es/pt/fr/de/nl/ar** — the only path to translation ≥ 85, and thus to closing #287. Gap stays open in #287/#145 at ordinal 60; the Phase-4 model spot-checks failed their own 0.95 controls (1/18, 16/18) and are explicitly **not** a substitute. Cost: human review time; no repo or CI change.

**(b) Publish the battery tables (`battery_security` ranks/dispositions, `battery_testplan`) *or* authorize one re-run** — ~US$0.01 judge spend + ~200-line driver, ~30 min at 12-way. One authorization unblocks, in a single call: #197's blast-radius ranks 11–20 (only the published top-10 exists today), #197's 27 unidentified must-fix tooling items, and #201's ~196 named testplan items. No table was ever committed to the repo (verified: zero `battery_*.csv` in all history), so without this those queues stay unrankable.

**(c) Resilience facet — re-read done, verdict: judge volatility.** The 60-era run and this run carry the **byte-identical** evidence line: *"ADVERSARIAL, 1 Chrome, 1 city: 5 failures degrade alike, control clean; silent worker trips the page deadline; inner budgets fit their outer caps (tightest slack 135s). Budget arithmetic is source-level: worker-realm timers cannot be shortened from the page. No device matrix."* On unchanged evidence the ordinal moved **60 → 85** (conf 0.41) on this very run — and the scoped PR judgment also read 85. No code change is indicated; keep it flagged for re-read on the next main run.

*Residual, out of scope this pass:* the mutation-lock helper (`acquireMutationLock`) retries only `EEXIST`, so on Windows a sharing violation surfaces as `EPERM` and fails the robots.txt tooth — seen once in 8 full-suite runs locally, never in Linux CI (unchanged since #173). Not a #194 blocker; recorded here so the next lane does not rediscover it blind.
[Treystu 2026-10-24T20:19:46Z] ## Driving note — program now down to owner decisions + gate-green + #314

**Verified state:** the lane's 2026-10-24 resume note is the current status record (main `eabb378c`; #304, B1 via #305/A-007, #310, #311, #312, #313 landed; #201/#202 verified already-closed; main `jev-complete` red on translation only). My 2026-10-23 driving comment on this tracker predates all of that and is superseded by this note.

**What remains for the program:**
- (a) Fluent reviewer coverage for es/pt/fr/de/nl/ar, or an owner-approved staging amendment → closes #287.
- (b) Publish the battery tables, or authorize one re-run → unblocks #197 ranks 11–20 + 27 items and #201's ~196 queue.
- (c) Resilience = judge volatility, re-read on each main run (no code change).
- #314 (dependabot bump) gated on the main gate going green.

**This tracker's close criteria:** #287 closed + #314 landed + #197/#201 dispositioned (closed, or parked on an owner decision with the gap recorded).

**Next step + owner:** lane updates this tracker on each trigger — (a) or (b) landing, main gate green, #314 merging, any car issue closing — and does not let driving comments go stale against landings again (the #201/#202 pattern: comments written hours after the closing PR).

**Dependencies:** #287, #197, #201, #314.

[Treystu 2026-10-24T21:25:16Z] ## Evidence refresh — current main and owner actions (2026-10-24)

Applied Jev Gate Policy v1. Current `main` is `eabb378c`; run [40106777172](https://github.com/Sovereign-Communication/BigEnergyCo/actions/runs/40106777172) failed `jev-complete` with score 96.64. All seven hard gates pass and `blocking_facets` is empty. The failing staging minimum is translation ordinal 60 versus 85; confidence 0.67 is investigation telemetry and does not block under the approved B1 rule. A-007 is already approved and on main. P10/P11 retain the full 95/100/0.95 program-exit bar; this update changes no threshold.

**Correction to the 20:19 driving note:** #201 is still open. #302 handled its six integration targets and six named unit candidates; the remaining ~196 identities remain unrecovered after the issue/PR/history/workflow-artifact search documented in [#201](https://github.com/Sovereign-Communication/BigEnergyCo/issues/201#issuecomment-6389652869). #202 is closed; #201 is not.

**Current car findings:** [#197](https://github.com/Sovereign-Communication/BigEnergyCo/issues/197#issuecomment-6389525651) found no unsafe fail-open in the exercised current-main paths (79 focused existing checks passed), but the historical battery and disposition records are missing, so the queue is not cleared. #201 likewise remains an evidence gap, not a claim of coverage.

**Translation packet:** the packet prepared from `eabb378c` contains 436 keys in each of es/pt/fr/de/nl/ar. Every key remains `UNREVIEWED`; all six signoffs are blank and no corrections or reviewer notes are recorded. It is not fluent-review evidence.

**Owner actions still needed:** obtain fluent-human review/signoff for every key in all six locales against the packet’s exact source revision; and choose the battery path—publish the original `battery_security` / `battery_testplan` source and disposition data, or authorize one shared rerun (the recorded estimate is about US$0.01 plus a ~200-line driver). For #201, the already-proposed alternative is to accept the 248-name mechanically derived working queue; no owner choice is recorded. After valid translation evidence and a passing main gate, the lane can merge #314. The battery issue dispositions still depend on the owner-selected evidence path and item-level verification; neither battery is closed before its evidence or an explicit owner disposition exists.
[Treystu 2026-10-25T12:19:43Z] ## Completion lane status — 2026-10-25

**Translation facet moved 60 → 85, resilience 85** on the full gate over clean main (run `40190813818`, squash `494697ee`, PR #317): the translation/resilience proof lines are recomposed against the rubric dimensions, the runtime English-leak classes a dictionary can reach are closed (~30 call sites), and the engine-emitted callout prose is a **named gap** (`engine` in the line's gaps clause, pinned; full record in the back-read doc's named-gap section) rather than an unclaimed silence. Release moved 35 → 85 on the same run. The full gate's remaining blocker is **advisor (60)** — this program's lane.

**#314 merged** (`9e0f2bf1`): its "gated on main Jev green" state resolved itself via the #316 maintenance scope route — the old block was the plan-item inference rejecting a `build(deps)` title, and a branch update onto post-#316 main turned `jev-complete` green (scoped run, all 9 checks pass). Three consecutive green merges now stand: #315 → #316 → #317.

**CAR state — unchanged, and deliberately not invented:**
- **#197**: top 10 by blast radius 10/10 dispositioned (PR #311). Remaining: ranks 11–20 (unrankable), 27 unidentified must-fix (of 51; 24 dispositioned), 15 needs-human-look. The 2026-10-24 current-main investigation stands: no demonstrated unsafe fail-open in the reviewed paths; the remainder is an **evidence gap**, not proven-safe.
- **#201**: integration-test findings covered by #302; the ~196-item unit queue is the same evidence gap.
- **Unblocker, shared and still pending owner decision (b):** publish the `battery_security` / `dispositions` / `battery_testplan` tables (never committed; no CSV in any history, no workflow artifact), **or** authorize one battery re-run (~US$0.01 judge spend + a ~200-line driver). Note the re-run maps to the *current* tree, which the historical tables cannot. No ranks were invented; no gate loosened.

**Advisor (60) is the one facet now standing between the full gate and green** — it is the `advisor_gap` required work ("run the advisor audit against the real chat and worker paths…"), i.e. this program's CAR queue plus the audit runs.
[Treystu 2026-10-25T21:13:46Z] **CAR #197 + CAR #201 closed via PR #318 (merge `4145aef5)** — the fail-closed and test-gap queues are fully dispositioned on owner-authorized battery re-run data.

The audit.db-only queue problem is resolved: the re-run ($0.00081522 of the authorized ~$0.01, through the repo's own `liveJevCall` path, rubric frozen before the first call) sourced 1,454 functions / 726 fail-open / 400 test gaps into git. **Every queue is terminal** — fail-open 726/726 (725 fail-open-by-design with per-row reason + code evidence, 1 hardened-with-test), test gaps 400/400 (15 tested in this pass, 227 covered-transitively, 158 dispositioned with reason). The 71 escalated sites each got a lane review against the CARs' question; judge pass 2's lone must-fix (`escapeHtml`, conf 0.23) was exonerated against the code. One confirmed defect hardened (`haversineKm` antipodal fp overshoot); three watch items recorded for the owner in `docs/jev-completion/battery-rerun-2026-10-25/LANE_VERDICTS.md`.

Scoped Jev gate on the PR: `P0.6 95.50/100 [PASS]`, hard gates green. Remaining CARs in the program unaffected; this closes the fail-closed/test-gap pair (#197, #201) and their 171 ratchet dependency.
