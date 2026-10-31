## Summary

Fixes #250. `facetScoreReasons` now explains confidence values from 0.5 up to the native `COMPLETE_MIN_CONFIDENCE` threshold, including why the judgment cannot pass. Values below 0.5 keep the existing low-confidence explanation; confidence at or above the threshold does not receive a shortfall reason.

This explanation uses the same threshold as the repository-native `jev-complete` gate. Agent-level decisions continue to follow Jev Gate Policy v1 from #255.

## Regression coverage

The new test checks the lower boundary (0.5), a middle value (0.7), a value just below the gate (0.949), and the passing boundary (0.95).

## Local verification

- `npm test`: 1,719/1,719 passed
- `node --test tests/jev-explain.test.mjs`: 7/7 passed
- `node scripts/check-chars.mjs`: passed
- `npm run seo`: passed
- `npm run format:check`: passed (743 tracked files)
- `npm run deploy:check`: passed; staging build only
- `npm run plan:check`: passed; plan hash unchanged

Exact-head CI is pending.