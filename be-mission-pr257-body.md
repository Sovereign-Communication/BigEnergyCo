## Scope: Jev evidence integrity

The derived-facet tests require `performance`, `experience`, and `translation` evidence to come from the current CI reports. This update removes the stale hand-authored entries from `facet_evidence`; CI-generated reports remain responsible for those axes. The explanatory audit notes remain, and this change does not lower any score bar or mark a plan item complete.

Plan: [MASTER_PLAN.md, per-PR definition of done](https://github.com/Sovereign-Communication/BigEnergyCo/blob/main/docs/plan/MASTER_PLAN.md#L690). Tracking issue: [#194](https://github.com/Sovereign-Communication/BigEnergyCo/issues/194).

Local preflight on this candidate passed: `npm test` (1719/1719), `node scripts/check-chars.mjs`, `npm run seo`, `npm run format:check`, `npm run deploy:check`, and `npm run plan:check`.
