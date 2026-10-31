## Scope
Completes one article audit under MASTER_PLAN P9.5. Corrects the Hawaii 2026 hurricane-season backup-power article using NWS, state, county, utility, DOE, CPSC, and FDA sources. Updates the matching blog card and structured metadata, and adds regression checks for sourced facts, safety guidance, FAQ parity, and review dates.

## Validation
- `npm test` (1,744 passed)
- `node scripts/check-chars.mjs`
- `npm run seo`
- `npm run format:check`
- `npm run deploy:check`
- `npm run plan:check`

The change is 400 lines including deletions, within the plan's PR-size target. The P9.5 ledger proof will be appended after the PR number is assigned.
