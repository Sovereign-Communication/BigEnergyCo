## Plan items

**P0.6 — completion-program evidence**, tied to #196. No plan threshold or plan text changes.

## What changed and why

The newest #196 driving comment restated all nine original prescriptions. This PR rechecks them against the current shipped paths and adds guards only where malformed values still cross a live boundary:

- applianceState now strictly validates numeric row data, quantity (1–30), and hours (0.25–24). Invalid rows are skipped so one corrupted row cannot poison all appliance totals; valid catalog rows keep the same totals.
- applyGenRate now rejects non-finite, non-positive, or overflowing conversions before changing the tariff input or run state.
- Exported runSizing now rejects null, primitive, and array messages before object spread can turn them into empty sizing inputs. The deeper runSizingUncached object guard remains in place.

The other prescriptions are already tested or do not describe a live input boundary:

| Prescription | Current disposition |
| --- | --- |
| mergeReSlice | Already has the object guard from #171; #296 executes it against hostile primitives and pins valid merging. |
| populatePrintSheet | #296 traces the innerHTML values, verifies hash-field allowlists, and tests the permissive share codec. The flagged footprint text is computed from numeric sizing output; no untrusted string reaches that interpolation. |
| clearCompactCache | Function was removed in 43f5378b; stale compact-series cleanup now occurs inline, and idbDelete handles missing stores/errors. |
| previewCurvePoint | Only called with previewTargetAt results from the internally generated frontier; null is already accepted as the clear-preview signal. |
| applyGenRate | Hardened here and tested with non-finite/overflowing and valid converted prices. |
| applianceState | Hardened here and tested with malformed rows plus a valid row. |
| runSizingUncached | Its existing guard rejects primitives internally; this PR closes the exposed runSizing wrapper before it spreads the input. |
| band | Local formatter receives the turnkey/selfpurchase objects from the internal paths model after availability checks; no external value enters it. |
| monthName | Local formatter runs only after startDay is checked finite in renderWorstMonthCaveat; there is no independent caller-supplied date. |

The shipped asset graph now uses stamp 20261023m and service-worker cache beco-v152 after the adversarial follow-up.

## Verification

- [x] npm test — 1922/1922
- [x] node scripts/check-chars.mjs
- [x] npm run seo
- [x] npm run format:check
- [x] npm run deploy:check
- [x] npm run plan:check
- [x] node scripts/check-syntax.mjs
- [x] git diff --check
- [x] No visual behavior change for valid inputs; no preview needed
- [x] Rollback: revert commit 10d2cf4
- [ ] Scoped P0.6 Jev report and required CI checks

P0.6's own definition of done records audit evidence in the PR and issue, so this evidence-only program item does not add a LEDGER.jsonl row.

Closes #196

## Adversarial follow-up

- applianceState now skips rows whose derived or cumulative daily, running-watt, or surge totals overflow, before changing accepted-row state. Regression coverage confirms the invalid row is skipped and a later valid row still contributes.
- Focused input-validation suite: 6/6. The asset-token check verified all 58 references at 20261023m; all PR checks passed, including browser smoke.

<!-- codesmith:footer -->
---
<a href="https://app.blacksmith.sh/Sovereign-Communication/codesmith/BigEnergyCo/pr/307?autoLogin=true&ref=codesmith_pr_footer"><picture><source media="(prefers-color-scheme: dark)" srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v3.svg"><source media="(prefers-color-scheme: light)" srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-light-v3.svg"><img alt="View with [code]smith" src="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v3-3x.png" width="162" height="28"></picture></a> <a href="https://backend.blacksmith.sh/track/enable-autofix?expires=1795384363&installation_model_id=441926&pr_number=307&ref=codesmith_pr_footer&repository=Sovereign-Communication%2FBigEnergyCo&return_to=https%3A%2F%2Fgithub.com%2FSovereign-Communication%2FBigEnergyCo%2Fpull%2F307&signature=d3aaacb3f53b2dd722e9e366f94edb4de36751672140a9d3a2b14f553079e4df"><picture><source media="(prefers-color-scheme: dark)" srcset="https://pr-comments-assets.blacksmith.sh/codesmith/autofix-with-codesmith-dark.svg"><source media="(prefers-color-scheme: light)" srcset="https://pr-comments-assets.blacksmith.sh/codesmith/autofix-with-codesmith-light.svg"><img alt="Autofix with [code]smith" src="https://pr-comments-assets.blacksmith.sh/codesmith/autofix-with-codesmith-dark-3x.png" width="190" height="28"></picture></a>
<sup>Need help on this PR? Tag <code>@codesmith-bot</code> with what you need.</sup>

<!-- codesmith:autofix:disabled -->
<!-- /codesmith:footer -->