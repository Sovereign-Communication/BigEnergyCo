## Summary

- Captures rendered `data-i18n` text, translated placeholders, and translated aria labels at first paint, after rerun, and after locale switch.
- Independently checks the rendered values against each locale dictionary; unique dictionary-backed runtime status overrides are reported, and unmapped values or missing hooks become named holes.
- Publishes a run-derived `i18n` facet line and adds the DOM match counts to translation evidence, replacing the stale static i18n line.
- Adds mutation and wiring coverage for stale text/attributes, missing hooks, runtime overrides, and unknown runtime copy.

LoC: 399 changed lines, within the PR limit.

## Verification

- Full local preflight passed on the rebased commit: `npm run deploy:check`, `npm test`, `node scripts/check-chars.mjs`, `npm run seo`, `npm run format:check`, `npm run plan:check`, Prettier check, `git diff --check`, and `node scripts/check-facet-evidence.mjs`.
- Live local Chrome sweep: 2,961/2,961 DOM fields and 42/42 runtime surfaces match; zero regressions or holes.

Part of #287 Phase 2. No production logic changes.
