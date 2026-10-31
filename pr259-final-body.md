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

## Jev Gate v1 review

The exact-head report is scoped to P0.4 and scores 96.63, with hard gates passed and the ratchet met (21/21 bars, no regressions). Its report-level pass remains false because accessibility, performance, quality, and testing do not all meet the global 95/95 confidence bar. I investigated the change: it modifies only scope resolution and CI comments; the new tests verify ledger rows follow an explicit phase while canonical plan-file edits still resolve to P0.1 governance. No product runtime or deployment behavior changes, and no actual risk surfaced. Following #255, proceed with this documented assessment; all required PR checks, including the `jev-complete` check, are green.
