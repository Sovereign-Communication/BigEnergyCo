## Summary

- Keep the visitor's up-front budget independent from the bill-cut target across slider changes, frontier selections, and share links.
- Select the best affordable frontier point and prevent a fractional minimum price from exposing a budget that cannot select a system.
- Add focused coverage for target/budget independence and selection boundaries.

This is the scoped F-20 / R-FLOW-04 implementation (221 added, 116 removed across the feature and generated asset-token graph), based on current main at `c2119175`.

## Validation

- `npm test` — 1,766/1,766
- `node scripts/check-chars.mjs`
- `npm run seo`
- `npm run format:check`
- `npm run deploy:check`
- `npm run plan:check`
- `node scripts/check-byte-budgets.mjs` — no declared-baseline regression; 2 improvements
- `npx --yes prettier@3.9.6 --check .`
- Local browser: Honolulu five-year run completes; budget adjustment keeps target at 80%.
