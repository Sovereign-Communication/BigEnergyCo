## What
Audits the Dutch salderingsregeling article against current official Dutch government and ACM sources. The article now identifies its worked example as assumptions, corrects the arithmetic, separates export value from variable supplier fees and fixed charges, removes unsupported battery-life and market-average claims, and synchronizes review dates and structured data.

## Evidence
- Added focused regression coverage and the source-by-source findings in the audit report.
- Local preflight on the rebased branch: `npm test` (1,748/1,748), `node scripts/check-chars.mjs`, `npm run seo`, `npm run format:check`, `npm run deploy:check`, `npm run plan:check`, and `npx --yes prettier@3.9.6 --check .` all passed.
- Tracks P9.5 under issue #194; this is an individual article audit, not the phase completion claim.
