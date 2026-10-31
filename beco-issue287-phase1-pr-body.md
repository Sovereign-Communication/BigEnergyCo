## Scope

Implements Phase 1 of #287 only. The three Phase 2 improvements remain separate PRs as required by the issue plan.

## Changes

- Moves the 18 authored facet evidence lines from evidence/advisor-and-release.json into a frozen FACET_EVIDENCE constant in scripts/lib/jev-facet-evidence.mjs.
- Makes the evidence builder seed from code-owned lines and override any legacy JSON copy.
- Adds a CI guard covering all 21 Jev axes: 18 authored lines plus Lighthouse and experience report producers for performance, experience, and translation.
- Runs the guard at the start of the required test job and rejects a reintroduced facet_evidence JSON field.
- Adds a negative test for a removed facet and builder coverage for stale prose lines.

## Validation

- npm test: 1,779/1,779 passed.
- Focused facet and evidence tests passed. The guard was also tested with the quality definition temporarily removed and failed with the named facet.
- npm run gate:facet-evidence, npm run seo, npm run format:check, npm run deploy:check, npm run plan:check, node scripts/check-chars.mjs, and npx --yes prettier@3.9.6 --check . passed.
- node scripts/check-byte-budgets.mjs: zero regressions and two improvements; it reports three existing over-limit measurements with no blocking exit.
- The deploy check staged 406 manifest files locally and did not push or deploy.

No gate threshold or policy change is included.