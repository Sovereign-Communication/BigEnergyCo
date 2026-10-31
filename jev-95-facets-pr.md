## Plan items
P0.3(e) / Q-01; F-45 — make facet evidence survive Jev’s 280-character transport clip and keep its evidence regression-tested.

## What changed and why
- Shortened the comparison, security, use-case, and privacy proof lines to fit the transport limit while preserving their key claims and gate references.
- Added a regression requiring every hand-authored facet line to fit the limit.
- Made staged-blob assertions compare bytes with the committed blob, avoiding a Windows CRLF false failure.
- No runtime or deployable site files changed.

## Definition of done
- [x] Tests added/updated; coverage not lowered.
- [x] Local preflight passed: `npm test` (1693/1693), `check-chars` via `npm run seo`, `npm run seo`, `npx --yes prettier@3.9.6 --check .`, `npm run deploy:check`, and `npm run plan:check`.
- [ ] No metric regressed vs the latest ledger baseline; scoped Jev report pending.
- [ ] Scoped live Jev report attached and Q-01 gate met; pending CI.
- [ ] Append ledger row with final run and gate evidence after CI.
- [x] Release rules: n/a; deployable bytes are unchanged.
- [ ] Tracking issue update: pending final Jev result.
