## Scope

This PR is scoped to one immutable plan item: **P0.4**.

- **Q-05 — byte budgets:** set the first-load HTML test guard to the owner-approved +2 KB allowance (130,000 to 132,000 bytes).
- **Q-07 — accessibility, reduced motion:** strengthen the regression test to require the shared scroll helper to choose instant scrolling under `prefers-reduced-motion: reduce` and smooth scrolling otherwise.

The change is limited to these two regression tests; it does not alter runtime code or other plan items.

## Local verification

- `node --test tests/perf-budget.test.mjs tests/reduced-motion.test.mjs` — 6/6 passed.
- `npm run smoke:local` — all 169 real-browser gates passed, including both scroll sites with reduced motion enabled and disabled.

Fresh hosted CI and the PR-triggered scoped Jev judgment are pending on this exact head.
