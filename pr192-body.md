## Plan scope

P0.4 measurement work only. This PR makes the JavaScript needed before a visitor's first interaction measurable separately from the modules loaded to produce the first result. P0.4 remains open after this change.

## Change

- Defer the sizing engine, charts, frontier chart, and rescale UI modules from the initial UI graph.
- Load those modules together when a result is requested; initialize chart handlers only after the chart module resolves.
- Make result and selection rendering wait for that loader.
- Extend the byte-budget graph so `js_before_interactive` excludes deferred modules while `js_to_first_result` includes modules awaited before results paint.
- Keep the chart export graph and dynamic-import behavior under tests.

## Evidence

The staged allowlist measurement reports 171.6 KB before interaction and 191.6 KB through first result, versus a 197.1 KB prior baseline for both metrics. The budget gate reported zero regressions and three improvements. P0.4 evidence is appended to `docs/plan/LEDGER.jsonl`.

All six required local checks passed on the pushed tree: `npm test` (1,727/1,727), `node scripts/check-chars.mjs`, `npm run seo`, `npm run format:check`, `npm run deploy:check`, and `npm run plan:check`. The change is 395 lines, within the plan's 400-line PR limit.

## Gate status

This PR does not claim the performance facet is proven, that P0.4 is complete, or that the full release gate passes. Review the exact-head CI and Jev report before merge under Jev Gate Policy v1. No production deployment is part of this PR.