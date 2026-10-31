# P0.4 real-browser performance evidence

- **Head:** `db5d9b8b3c5d84cbd130f09a84c8220a37fe4afe`
- **Surface:** allowlisted staged build with production `_headers`, served locally with the project Worker mounted; headless Chrome, 2 worker sessions observed.
- **Cold sizing interaction:** 5,326 ms to result card; completed and issued 3 NASA weather requests.
- **Same-location warm repeat:** 50 ms; 0 requests and 0 NASA pulls.
- **Warm reload:** 4,284 ms including boot; 0 NASA pulls. The measured window had 107 same-origin requests (83 before the run, 24 during it), including one `/api/health` probe; these are not counted as weather pulls.
- **Three follow-up adjustments:** previews rendered in 15, 7, and 6 ms (7 ms median). Authoritative re-slices completed in 2,269, 2,140, and 1,862 ms (2,140 ms median); all three moved the budget to the selected result.
- **Gate evidence:** 0 performance regressions, 0 holes; focused `tests/performance-playtest.test.mjs` passed 29/29.
- **Lighthouse context:** one mobile sample was 61 (LCP 6.375 s, CLS 0.136, TBT 26 ms). This is one non-ratcheted Lighthouse sample, not a Jev judgment.

The interaction playtest passes its declared P0.4 budgets. The immediate cached preview is measured separately from the slower authoritative re-slice. The full raw report is in [p04-performance-run.json](p04-performance-run.json). The prior accepted Jev report prohibits rerunning; the PR owner must attach/share this evidence and request a new allowed Jev judgment through the normal owner path.
