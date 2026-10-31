## Defect (owner-reported 2026-10-28, use-case differentiation)

The two-button goal picker and the share-link restore wrote the legacy `systemGoal` enum **directly**, bypassing the six-case registry, so the highlighted button and the reader-visible use-case chooser could disagree about which case the visitor is in.

## Diagnosis (primary sources, `assets/js/sizing/ui.js` on 050b70d1)

Writer map for the `systemGoal` scope:

| line (before) | write | enclosing function | verdict |
| --- | --- | --- | --- |
| 864 | `goal.value = next` | `applyUseCase` | allowed (sole owner) |
| 3349 / 3359 | `sysGoal.value = "gridtie"/"offgrid"` | `setupGoalControls` -> `setGoal` | **bypass** |
| 7760 | `$("systemGoal").value = ...` | `restoreFromShare` | **bypass** |

Gate clause 6 of `scripts/check-usecases.mjs` only asserted that `ui.js` calls `deriveLegacy(` somewhere, which passed because `applyUseCase` does, while a second writer bypassed it entirely.

## Change

1. **Test first** (`4c3da3e4`): a new clause 6b in `scripts/check-usecases.mjs` fails on any direct `systemGoal` write outside `applyUseCase`, naming each bypass writer by function and line. Committed red before the fix, green after.
2. **Fix the rule, not strings** (`091471a0`): `setGoal` and `restoreFromShare` now route through `applyUseCase`, which derives the enum from the registry. The buttons choose a case by derived mode, so `backup` keeps its essentials-only sizing when the off-grid button is pressed while already off-grid-derived.
3. **Re-entry guard** (`6035e050`): the guard compares the goal against the same two-value mapping `applyUseCase` derives. Portable declares no legacy enum pair (mode `portable`), so comparing its mode directly re-entered `setGoal` from `applyUseCase`'s own change event and flipped the chooser back to bill-cut. The first version of this guard reproduced that bug in the browser smoke (3 of 232 gates, all portable); the revision makes the re-entry a no-op by construction. Caught by `npm run smoke:local`, not by the unit suite — recorded here so the reasoning is reviewable.

No display strings or locale keys changed.

## Verification (local runs, this branch at 4ec2894f)

- `npm test` — 1983/1983 (includes the new clause 6b)
- `node scripts/check-chars.mjs` — exit 0
- `npm run seo` — exit 0 (includes `check-i18n`: es/pt/fr/de/nl/ar, 100% of HTML hooks; no new keys)
- `npm run format:check` — exit 0 (831 files)
- `npm run deploy:check` — exit 0
- `npm run plan:check` — exit 0 (MASTER_PLAN sha256 e89ebe0bbbe99cefbc3b547902457e2d196f71d81b27ce0e36ce00ea023b6609)
- `npm run smoke:local` — **232/232 gates** in real Chrome, twice (after the guard fix and after the final stamp bump): six use-case flows, off-grid chrome repro (goal buttons both directions), share restore, a11y

Asset stamps bumped to 20261028b per the immutable-asset rule (`bump-asset-tokens.mjs`).

## Plan items

D-16 (use cases, one unified tool), D-17 (flow order, choose a use case), R-UC-01..06 (use-case matrix surfaces). Progress: `docs/plan/LEDGER.jsonl` entry follows on merge; no plan change.

## Questions

1. When a visitor on the `portable` case presses the Off-grid button, this PR switches the chooser to the `offgrid` case (portable has no legacy enum pair, so leaving the chooser on portable while the button and enum say off-grid would recreate the desync). Confirm this is the intended owner behavior.
