## Plan items
P0.4 — Q-02 and Q-07 measurement evidence. The 280-character regression supports P0.3(e)'s evidence transport contract.

## What changed and why
- Replaced stale staging, quality, accessibility, security, i18n, SEO, testing, and provenance proof lines with current, source-verifiable CI measurements.
- Preserved pricing/comparison evidence, SEO claims, and all 95/95 thresholds.
- Kept the regression that rejects clipped hand-authored evidence and the Windows-safe committed-blob staging assertion.
- No runtime or deployable site files changed.

## Definition of done
- [x] Tests updated; full CI on the prior head passed 1693/1693, and focused regressions on this diff pass 5/5.
- [x] Local checks pass: `npm run seo`, `npm run quality`, `npm run format:check`, `npx --yes prettier@3.9.6 --check .`, `npm run deploy:check`, and `npm run plan:check`.
- [ ] Scoped Jev on this new head must satisfy the user's 95/95 thresholds; pending.
- [ ] Full Jev report must score at least 95 with every facet proven and every confidence at least 95%; pending.
- [ ] Append the final ledger row and update the tracker after the gate result.
- [x] Release rules: n/a; deployable bytes are unchanged.
