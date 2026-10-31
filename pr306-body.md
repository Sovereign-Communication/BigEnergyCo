## Plan items

**P0.6 — completion-program evidence** (Car 4, tracked by #199).

## What changed and why

`flatProfile` is an exported production helper. Its callers validate the visitor's load, but a direct malformed value could still create a 24-hour array of `NaN` or negative energy. It now rejects non-finite and negative kWh at the helper boundary; zero remains valid. Regression tests cover missing, null, string, NaN, both infinities, negative and zero inputs.

The seven original Scope A items, in confidence order, were reviewed against the current tree:

| Confidence | Item | Result |
| --- | --- | --- |
| 0.96 | `smoke-local.mjs::run` | Fixed in merged #299 via shared `runChild`; missing-executable, child-status and signal tests cover the failure path. |
| 0.95 | `relativeLuminance` | Dispositioned: private helper called only after foreground and effective background both parse; null color is skipped before the call. |
| 0.94 | `isBoundLimited` | Dispositioned: the empty-front guard is present, and its only production caller supplies arrays from the frontier sweep. The earlier confirm/kill audit also killed this prescription at 0.44. |
| 0.94 | `paretoFront` | Fixed in merged #299; regression tests cover absent/null and unpriced points. |
| 0.94 | `check-privacy-browser.mjs::run` | Fixed in merged #299 by the same `runChild`; the shared missing-executable test pins it. |
| 0.92 | `flatProfile` | Fixed here; malformed values reject before producing an invalid load array. |
| 0.92 | `textWidth` | Already guarded for non-finite/non-positive sizes; existing tests cover those error inputs. |

No prescription was forced where the caller contract already prevents the reported condition or the function was already guarded. The prior #299 issue comment records the wider Car 4 dispositions.

The shipped asset graph now uses stamp 20261023m and service-worker cache beco-v152 after the adversarial follow-up.

## Definition of done (plan §9)

- [x] Regression tests added for this change; `npm test` passes (1,918/1,918).
- [x] Local preflight: `node scripts/check-chars.mjs`, `npm run seo`, `npm run format:check`, `npm run deploy:check`, and `npm run plan:check` all pass.
- [ ] Scoped live Jev report: the CI `jev-complete` job will attach it; no local `TYPESAFE_API_KEY` is configured.
- [x] Release asset tokens and service-worker cache version refreshed.
- [ ] Tracking issue #199 updated after the PR's green checks.

Closes #199

## Adversarial follow-up

- flatProfile now also throws RangeError when a finite daily-kWh value overflows the hourly calculation.
- Focused engine suite: 24/24. The asset-token check verified all 58 references at 20261023m; all PR checks passed, including Lighthouse and browser smoke.

<!-- codesmith:footer -->
---
<a href="https://app.blacksmith.sh/Sovereign-Communication/codesmith/BigEnergyCo/pr/306?autoLogin=true&ref=codesmith_pr_footer"><picture><source media="(prefers-color-scheme: dark)" srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v3.svg"><source media="(prefers-color-scheme: light)" srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-light-v3.svg"><img alt="View with [code]smith" src="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v3-3x.png" width="162" height="28"></picture></a> <a href="https://backend.blacksmith.sh/track/enable-autofix?expires=1795384351&installation_model_id=441926&pr_number=306&ref=codesmith_pr_footer&repository=Sovereign-Communication%2FBigEnergyCo&return_to=https%3A%2F%2Fgithub.com%2FSovereign-Communication%2FBigEnergyCo%2Fpull%2F306&signature=1c54301a81f868544536098e1069fb226f94067c5fce357376760598f598f784"><picture><source media="(prefers-color-scheme: dark)" srcset="https://pr-comments-assets.blacksmith.sh/codesmith/autofix-with-codesmith-dark.svg"><source media="(prefers-color-scheme: light)" srcset="https://pr-comments-assets.blacksmith.sh/codesmith/autofix-with-codesmith-light.svg"><img alt="Autofix with [code]smith" src="https://pr-comments-assets.blacksmith.sh/codesmith/autofix-with-codesmith-dark-3x.png" width="190" height="28"></picture></a>
<sup>Need help on this PR? Tag <code>@codesmith-bot</code> with what you need.</sup>

<!-- codesmith:autofix:disabled -->
<!-- /codesmith:footer -->