## Blocker report 2026-10-28 — merge withheld on Rule 8; PR left open

Measured fresh from primary sources. Nothing in this comment changes a bar, a threshold, a rubric or an amendment.

### 1. The CodeQL merge blocker is cleared (new verified outcome)

The PR was in `mergeStateStatus=blocked` while all nine checks were green. Cause, confirmed against the ruleset rather than inferred from the red: the `main-protection` ruleset carries a `code_scanning` rule with `alerts_threshold: "errors"`, and this PR's own analysis introduced one new alert at that threshold.

- **New alert:** `js/bad-code-sanitization`, displayed severity `error`, `tests/mutation-lock.test.mjs:55` — "Code construction depends on an improperly sanitized value", on `refs/pull/321/merge`, reported by CodeQL as "1 new alert including 1 medium severity security vulnerability".
- **Cause, not the display:** the child source string was built by interpolating `JSON.stringify`'d values and then handed to `node -e` for evaluation. Computed values reached evaluated code.
- **Fix:** `ae3074ca` — the child source is now a constant in each helper, and the module path, lock root, events path and borrower name travel as `argv`. Fixed at the reported site and at the sibling helper (lines 124-136) carrying the identical pattern, so the alert cannot reappear one line further down. Assertions, timeouts and the ordering expectation are unchanged; all 4 tests in the file pass.
- **Verified after the push:** CodeQL now reports **"No new alerts in code changed by this pull request"**; open alerts on `refs/pull/321/merge` = **0**; `mergeStateStatus` = **CLEAN**.

Local gates run before the push, all exit 0: `npm test` **1988/1988**, `check-chars`, `npm run seo` (includes `check-i18n`), `format:check` (832 tracked files), `deploy:check`, `plan:check`.

### 2. Checks on the exact head

Head `ae3074ca`, all nine required checks green, no push since:

| check | conclusion |
| --- | --- |
| analyze, test, coverage, quality-lab, quality-evidence, web-smoke, lighthouse, jev-complete, CodeQL | success |

Run IDs: Tests `40707420651`, CodeQL `40707420672`.

### 3. The unmet element — Rule 8 needs two independent non-author Jev PASSes

| judgment | instrument | result |
| --- | --- | --- |
| 1 | CI `jev-complete` on `ae3074ca`, artifact `jev-complete-report` (id 12825875336) | **PASS** — score **96.57 / 95**, `pass: true`, `blocking_facets: []`, `facets_below_staging_minimum: []`, live `provider=typesafe`, `fallback=false`, model `jev-1.14.0` (`jev-latest`), `accepted: true` |
| 2 | independent local live run of the same gate on the same head and the same CI evidence file, `--require-live` | **not a PASS** — score 96.64 (target 95) but exit 1, blocker `staging facet below ordinal 85: translation`, translation ordinal **60** at confidence **0.5** |

The second call was live and not a fallback: `provider=typesafe fallback=false cost=$0.000003`.

Both judgments saw identical evidence; only the judge's translation reading differed (**85 vs 60**). That is the behaviour already recorded in `docs/plan/LEDGER.jsonl` under `P0.3c-ratchet-instability`, where repeated live runs on one unchanged tree flipped a facet 85 → 60 and the entry states the clause was being compared "against a stochastic measurement".

**Why no third call was made.** Rule 17 forbids re-running to shop a verdict: a re-run needs new evidence or a changed action. The investigation was done without spending another call, and it found no actual defect:

- `node scripts/check-i18n.mjs` → exit 0, `I18N OK`; 468 keys at 100% of HTML hooks in all 7 locales (es, pt, fr, de, nl, ar).
- `node scripts/check-chars.mjs` → exit 0.
- static unkeyed class reads **371/485**, the baseline recorded at #317.

So the sub-85 reading is confidence-driven (the gate's own text: "the judgment is not certain enough to pass"), not a regression. Re-running the same state would be the coin flip the ledger already says is "luck, not a gate".

### 4. Disposition

**Held open on Rule 8 alone: one of the two required independent PASSes exists.** Head, checks and merge state are otherwise clean, so nothing is blocked except the review bar itself. Not merged, not forced, no bypass used.

**Decision needed from the owner:** how Rule 8's two-PASS bar should treat a stochastic gate reading — either accept two PASSes obtained by bounded re-assessment after recorded investigation, or treat a split as a hold until the measurement is made stable. The bar itself is not changed here either way.

Questions logged against this item in the lane report: (a) that owner decision; (b) the mechanism for recording a non-author Jev PASS as a GitHub review, given this repository has never carried a review and GitHub refuses self-approval by the PR author.
