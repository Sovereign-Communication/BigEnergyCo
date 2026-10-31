## Scope

Extracts PR #171's i18n compare-before-write improvement into a small P0.4 change. Reapplying the same locale now skips unchanged text, placeholder, and aria-label assignments; switching from English to Spanish still updates all three. The focused DOM mock test verifies both cases.

The change also refreshes the required immutable asset tokens from `20261022h` to `20261022i` and the service-worker cache key from `beco-v133` to `beco-v134`.

## Evidence and validation

- Adds the P0.4 progress row to `docs/plan/LEDGER.jsonl`.
- Focused i18n checks: 17/17; no-op regression test: 1/1.
- `npm test`: 1728/1728.
- `node scripts/check-chars.mjs`: passed.
- `npm run seo`: passed.
- `npm run format:check`: passed.
- `npm run deploy:check`: passed.
- `npm run plan:check`: passed.

The PR is limited to translation DOM writes, their regression test, and cache-token references. Jev's exact-head report will be reviewed under `docs/JEV_GATE_POLICY_V1.md`; any below-bar result will receive claim-level investigation.
