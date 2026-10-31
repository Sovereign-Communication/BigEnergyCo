## Scope

This change is limited to P0.4:

- Q-05 raises the first-load HTML guard to 132,000 bytes, the owner-approved 2 KB allowance over the former 130,000-byte limit. The budget includes the generator-runtime question already added by the off-grid mode fix.
- Q-07 exports one `window.scrollBehavior()` policy from the classic chat script and routes sizing and chat scrolls through it. It selects instant scrolling for `prefers-reduced-motion: reduce` and smooth scrolling otherwise.
- The reduced-motion regression test checks the helper contract and every `scrollIntoView` call. The browser accessibility smoke exercises four real controls across normal and reduced-motion settings and verifies the emulation resets.

## Verification

The rebased head `972ab8dda8be104b41491d63b3919459e83238b8` passed locally:

- `npm test`: 1,718/1,718
- `node scripts/check-chars.mjs`
- `npm run seo`
- `npm run format:check`
- `npm run deploy:check`
- `npm run plan:check`
- Focused first-load budget and reduced-motion tests: 7/7

Exact-head GitHub checks are running.