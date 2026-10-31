## Evidence attached per the cure path — plus a merge-timeline disclosure

**Disclosure first, before the evidence.** The split verdict above was posted at 21:23:52Z; the squash merge of this PR executed at 21:26:02Z. The merge used a different Rule-8 instrument than the review pair above — the gate pair used on #321: (1) CI `jev-complete` on head `d3c1bb9e`, run **40767879110**, `pass: true`, score **97/95**, live `jev-1.14.0` not fallback; (2) an independent live run of the same gate with `--require-live` against that head's own evidence, exit **0**, score **96.79/95**, `provider: typesafe`. All 9 check-runs were green and `mergeStateStatus` was CLEAN at merge time. No head changed between the split verdict and the merge. Both records stand as written: Review B's block was on **evidence quality, not a defect in the diff**, and this comment is the cure it named — new evidence, same head, no review re-run to shop a verdict.

### 1. Red-run log for the failing-first test commit (Review B's first driver)

Reproduced deterministically in a detached worktree at `4c1d8854` (the red-first commit: test present, fix absent):

```
$ git -C <worktree> log --oneline -1
4c1d8854 test(i18n): fail on runtime-rendered BOM copy that bypasses the dictionary

$ node --test tests/i18n-bom-copy.test.mjs
✖ BOM cards: every runtime-rendered description names a locale key
✖ BOM cards: the desc key resolves in all seven locales
✖ BOM cards: the render asks the dictionary and keeps the i18n hook
ℹ pass 0
ℹ fail 3
```

The test is red on the pre-fix tree and green (3/3) after `9e7d8391`, which is the red-first property asserted in the PR body.

### 2. Visual-audit output (Review B's second driver)

Machine-read from `checklist.md`, run 2026-10-28T19:53:25Z against head `d3c1bb9e` (the tree that merged):

```
Cells: 7 locales x 2 pages x 2 widths = 28
Checks: 138 | failed: 0
English-prose-leak checks: 12/12 PASS
N/A cells: 14 (heatmap x 7 locales x 2 widths; claimsTranslation=false on the
  static source — the gate's own "untranslated by decision" scope)
FAIL lines: 0
```

28 PNG screenshots were captured (one per cell). Before the fix, the same audit reported 12 leak failures (all six non-English home cells at both widths). The audit's own single Jev verification (direct TypeSafe, recorded either way): **pass**, `jev-1.14.0`, confidence 0.8 (`C:/tmp/_visual_audit/jev-verify.json`).

### 3. Rule-10 mutation proof (the "proven to fire" claim)

Run on the fixed tree at `d3c1bb9e`: mutate the render back to the anti-pattern `el("p", {}, item.desc)`, run `node scripts/check-i18n.mjs`:

```
FAIL ui.js builds the BOM description from the raw English item.desc instead of the dictionary (runtime copy bypasses every rule above)
FAIL ui.js renders the BOM description without a data-i18n hook, so a language switch cannot re-apply it
2 I18N FAILURE(S)
exit 1
```

Restore the real render: `I18N OK`, exit 0, working tree clean.

No review above is re-run by this comment; the evidence simply exists on the record now, as the cure path specified.
