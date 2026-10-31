## Summary

Adds the P9.7 content-quality gate under amendment A-006. It adds the P9.7 plan item and `SCOPE_FACETS` entry, plus detailed criteria for article formatting, search demand, sourcing, and voice. The plan change is recorded through the append-only amendment log and hash chain. Current main already contains A-004 and A-005, so this entry uses A-006; `npm run plan:check -- --base origin/main` verifies the chain from `09f4a837...` to `c6799a47...`.

The owner-authorized bootstrap exception applies only to this gate-authoring PR. Under the policy added by #255, a below-bar scoped judgment triggers claim-level investigation, and #232 may proceed if no actual risk is found. Later P9.7 content changes remain subject to the new criteria. The native full-main 95/95/95 release gate is unchanged.

## Local verification

- `npm test`: 1,718/1,718 passed
- `node --test tests/jev-scope.test.mjs`: 34/34 passed
- `npm run plan:check -- --base origin/main`: passed
- `node scripts/check-chars.mjs`: passed
- `npm run seo`: passed
- `npm run format:check`: passed
- `npm run deploy:check`: passed; staging build only

Exact-head CI is pending.