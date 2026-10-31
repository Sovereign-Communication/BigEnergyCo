## Scope: Jev evidence integrity

The derived-facet tests require performance, experience, and translation evidence to come from current CI reports. This update removes stale hand-authored entries from facet_evidence; CI-generated reports remain responsible for those axes. The explanatory audit notes remain, and this change does not lower a score bar or mark a plan item complete.

The i18n evidence now matches the current check output: 436 keys across seven locales, 135 HTML hooks and placeholder parity, Arabic RTL, a known 434/485 ceiling for unkeyed prose on translated pages that must fall, and native-speaker meaning review still open. The runtime audit currently finds zero raw keys on 22 pages.

Plan: [MASTER_PLAN.md, per-PR definition of done](https://github.com/Sovereign-Communication/BigEnergyCo/blob/main/docs/plan/MASTER_PLAN.md#L690). Tracking issue: [#194](https://github.com/Sovereign-Communication/BigEnergyCo/issues/194).

Local preflight on the rebased candidate passed: `npm run deploy:check`, `npm test` (1720/1720), `node scripts/check-chars.mjs`, `npm run seo`, `npm run format:check`, and `npm run plan:check`.
