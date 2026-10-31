## Summary

- Restrict governance scope precedence to `MASTER_PLAN.md`, `AMENDMENTS.md`, and `PLAN.lock.json`.
- Let append-only `LEDGER.jsonl` progress rows follow the explicit plan item named by the PR.
- Add resolver coverage for both cases and clarify the CI scope comment.

## Verification

- `npm test`
- `node scripts/check-chars.mjs`
- `npm run seo`
- `npm run format:check`
- `npm run deploy:check`
- `npm run plan:check`

This addresses the observed false P0.1 classification on P9.5 work that correctly appends its required ledger row. The canonical plan documents retain P0.1 governance precedence.
