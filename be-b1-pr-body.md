Implements the owner-approved B1 staging policy from PR #292 on the main validator path.

- Main staging requires combined score >= 95, every facet ordinal >= 85, no facet below 60, the all-facet ratchet, and all hard gates green.
- Confidence below 0.95 remains visible as investigation telemetry and does not block main staging.
- Adds `--program-exit` for the unchanged P10/weekly P11 95/95/95 verdict; scoped PR verdicts remain unchanged.
- Records amendment A-007, re-pins the master plan and appends the amendment ledger row.
- Updates the deploy runbook and P10.1 command to select the preserved full-program verdict.

Validation: `npm test` passed 1923/1923 before the final CLI-mode regression case was added; `node --test tests/jev-complete.test.mjs` passed 30/30 with that case. `npm run format:check`, `npm run plan:check`, `node scripts/check-plan-pin.mjs --base origin/main`, `npm run deploy:check`, and `npm run seo` passed.

Supersedes the proposal draft in #292. References #287; Phase 6 stability and issue closure remain pending the merged main gate and three consecutive content merges.
