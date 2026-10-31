## Summary

- Replaces 63 repeated homepage inline style attributes with 11 named CSS rules and removes three repeated close-button cursor attributes by using the shared rule.
- Updates code-owned quality evidence to the measured 85-page / 235-of-318 inline-style baseline and records the specific consolidation.
- Adds regression tests for class counts, declarations, close-button rules, and evidence accuracy.

LoC: ~204 added, within the Phase 2 quality estimate.

## Verification

- `npm run deploy:check`
- `npm test`
- `node scripts/check-chars.mjs`
- `npm run seo`
- `npm run format:check`
- `npm run plan:check`
- `npx --yes prettier@3.9.6 --check .`
- `git diff --check`

All passed locally on the committed branch.

Part of #287 Phase 2. No production behavior changes.
