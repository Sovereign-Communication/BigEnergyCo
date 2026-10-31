Implements the owner-approved B1 staging policy from PR #292 on the main validator path.

- Main staging requires combined score >= 95, every facet ordinal >= 85, no facet below 60, the all-facet ratchet, and all hard gates green.
- Confidence below 0.95 remains visible as investigation telemetry and does not block main staging.
- Adds `--program-exit` for the unchanged P10/weekly P11 95/95/95 verdict; scoped PR verdicts remain unchanged.
- Records amendment A-007, re-pins the master plan and appends the amendment ledger row.
- Updates the deploy runbook and P10.1 command to select the preserved full-program verdict.

Validation: `npm test` passed 1923/1923 before the final CLI-mode regression case was added; `node --test tests/jev-complete.test.mjs` passed 30/30 with that case. `npm run format:check`, `npm run plan:check`, `node scripts/check-plan-pin.mjs --base origin/main`, `npm run deploy:check`, and `npm run seo` passed.

Supersedes the proposal draft in #292. References #287; Phase 6 stability and issue closure remain pending the merged main gate and three consecutive content merges.

## Final follow-up

- P10 mode now carries and prints its own blockers, including confidence failures; it no longer shows staging blockers or says "required work: none" for a failed P10 verdict.
- Focused gate/report suites passed 73/73; all current PR checks passed, including jev-complete and browser smoke.

<!-- codesmith:footer -->
---
<a href="https://app.blacksmith.sh/Sovereign-Communication/codesmith/BigEnergyCo/pr/305?autoLogin=true&ref=codesmith_pr_footer"><picture><source media="(prefers-color-scheme: dark)" srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v3.svg"><source media="(prefers-color-scheme: light)" srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-light-v3.svg"><img alt="View with [code]smith" src="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v3-3x.png" width="162" height="28"></picture></a> <a href="https://backend.blacksmith.sh/track/enable-autofix?expires=1795383437&installation_model_id=441926&pr_number=305&ref=codesmith_pr_footer&repository=Sovereign-Communication%2FBigEnergyCo&return_to=https%3A%2F%2Fgithub.com%2FSovereign-Communication%2FBigEnergyCo%2Fpull%2F305&signature=485a82ee3668fb90b8548c3f65387d46a6fd5f0d8cabd7ad02e9494a4e10e3a0"><picture><source media="(prefers-color-scheme: dark)" srcset="https://pr-comments-assets.blacksmith.sh/codesmith/autofix-with-codesmith-dark.svg"><source media="(prefers-color-scheme: light)" srcset="https://pr-comments-assets.blacksmith.sh/codesmith/autofix-with-codesmith-light.svg"><img alt="Autofix with [code]smith" src="https://pr-comments-assets.blacksmith.sh/codesmith/autofix-with-codesmith-dark-3x.png" width="190" height="28"></picture></a>
<sup>Need help on this PR? Tag <code>@codesmith-bot</code> with what you need.</sup>

<!-- codesmith:autofix:disabled -->
<!-- /codesmith:footer -->