## What
Audits the Dutch salderingsregeling article against current official Dutch government and ACM sources. The article now identifies its worked example as assumptions, corrects the arithmetic, separates export value from variable supplier fees and fixed charges, removes unsupported battery-life and market-average claims, and synchronizes review dates and structured data.

## Evidence
- Added focused regression coverage and the source-by-source findings in `docs/jev-completion/SALDERINGSREGELING_AUDIT_2026-10-22.md`.
- Added the P9.5 ledger note in `docs/plan/LEDGER.jsonl`; it explicitly records that P9.5 remains partial.
- Local preflight on the current head: `npm test` (1,751/1,751), `node scripts/check-chars.mjs`, `npm run seo`, `npm run format:check`, `npm run deploy:check`, `npm run plan:check`, and `npx --yes prettier@3.9.6 --check .` all passed.
- Jev v1 investigation: exact-run full report 96.93 (strict pass=false), P9.5 scoped report 97.75 / semantic 92.5 (strict pass=false), ratchet met, hard gates passed, no blockers. Quality=85 is the article-specific weak facet; performance=60 and translation=60 describe unrelated open work. The article corrections are supported by the cited government/ACM sources and the example is explicitly conditional, so no actual risk from this change was found. Proceed with this note under the risk-first policy; this is not a P9.5 completion claim.

<!-- codesmith:footer -->
---
<a href="https://app.blacksmith.sh/Sovereign-Communication/codesmith/BigEnergyCo/pr/278?autoLogin=true&ref=codesmith_pr_footer"><picture><source media="(prefers-color-scheme: dark)" srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v3.svg"><source media="(prefers-color-scheme: light)" srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-light-v3.svg"><img alt="View with [code]smith" src="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v3-3x.png" width="162" height="28"></picture></a>
<!-- /codesmith:footer -->