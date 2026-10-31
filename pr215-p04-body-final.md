## Scope

This PR is scoped to one immutable plan item: **P0.4**.

- **Q-05 — byte budgets:** set the first-load HTML test guard to the owner-approved +2 KB allowance (130,000 to 132,000 bytes).
- **Q-07 — accessibility, reduced motion:** strengthen the regression test to require the shared scroll helper to choose instant scrolling under `prefers-reduced-motion: reduce` and smooth scrolling otherwise.

The code diff is limited to these two regression tests; it does not alter runtime code or other plan items.

## Verification

- Focused local tests: 6/6 passed.
- `npm run smoke:local`: all 169 real-browser gates passed, including both scroll sites with reduced motion enabled and disabled.
- Exact-head CI for `c55e4e506b8e5046370dd86dba127a3bf7f93b88`: CodeQL and all standard Tests jobs passed (`test`, `coverage`, `web-smoke`, `quality-lab`, `quality-evidence`, and Lighthouse).
- Exact-head scoped Jev: **94.75 / 99 required** (semantic score 82.5). Hard gates passed and the ratchet is met with no regressions. Testing is proven (100); accessibility (85), performance (60), and quality (85) remain below proven, so this split is not ready to merge. The live judgment completed successfully with Jev 1.13.0; no secret/provider failure occurred.

No merge or deployment has been made.
