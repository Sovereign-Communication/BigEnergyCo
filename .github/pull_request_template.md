<!-- Master plan: docs/plan/MASTER_PLAN.md · tracker: the pinned "Master plan tracker" issue -->

## Plan items

<!-- e.g. P1.2 — closes F-02 via R-PATH-03. Release chores: write "n/a (release)". -->

## What changed and why

## Definition of done (plan §9)

- [ ] Tests added/updated for every change; coverage not lowered
- [ ] Local preflight: `npm test` · `node scripts/check-chars.mjs` · `npm run seo` · `npx --yes prettier@3.9.6 --check .` · `npm run deploy:check` · `npm run plan:check`
- [ ] No metric regressed vs the latest ledger baseline; phase absolute thresholds met
- [ ] Scoped live Jev report attached (score ≥ 99.0, no facet regression)
- [ ] `docs/plan/LEDGER.jsonl` row appended (`item-done`, PR, SHA, gates, Jev)
- [ ] Release rules followed if shipping (SW `CACHE_VERSION` + asset tokens)
- [ ] Tracking issue ticked
