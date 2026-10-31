## Scope

P0.4 measurement evidence for Q-02 and Q-07, with P0.3(e) evidence-transport coverage. This rebased change includes homepage localization, CSS/markup cleanup, city-page and provenance checks, and refreshed Jev evidence.

Links: [Master plan](https://github.com/Sovereign-Communication/BigEnergyCo/blob/main/docs/plan/MASTER_PLAN.md) · [Pinned tracker #145](https://github.com/Sovereign-Communication/BigEnergyCo/issues/145).

## Changes

- Refresh the facet evidence from the current quality, locale, provenance, and browser-smoke measurements.
- Keep each hand-authored facet line within the 280-character transport limit, and ensure stale-stamp mutation tests still test a real claim when the summary intentionally omits static stamps.
- Preserve main’s merged off-grid behavior and the shared cross-process lock for the deployment-file tests.
- No remote staging or production deployment was made.

## Local validation

- npm test: 1,714/1,714 passed.
- npm run smoke:local: 212/212 browser gates passed, including off-grid mode chrome and generator-runtime inputs.
- node scripts/check-chars.mjs, npm run seo, npm run quality, npm run format:check, npm run deploy:check, npm run plan:check, npm run gate:byte-budgets, and Prettier 3.9.6 all passed.

Fresh required CI and the scoped P0.4 jev-complete report will run on the rebased head. Per §13.3, the full 95/95/95 exact-main report is the separate staging release gate after merge. A ledger row will record the fresh Jev result.