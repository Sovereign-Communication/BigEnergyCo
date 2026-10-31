## Scope

This is a P9.5 blog-audit cohort covering the DIY battery storage guide and three related articles. It updates stale pricing and chemistry claims, clarifies the DIY materials estimate and its exclusions, improves article metadata and structured data, and adds review dates and accessibility fixes where applicable. It does not claim the full blog audit is complete.

The DIY estimate of $80–$120 per usable kWh is an owner-supplied planning range, not a market quote. The cited example uses 16 REPT cells at $60 each plus a $365 JK kit: $1,325 before tax. At 14.34 kWh nameplate and 80% depth of discharge, that is 11.47 usable kWh, or about $116 per usable kWh before freight and tax. Sodium-ion pricing is left without a product example because the audit found no current quote. The DIY estimate is for battery materials; the installed-system reference has a different scope.

## Regression coverage

`tests/blog-diy-price-override.test.mjs` checks the source arithmetic, scope language, visible-only word-count change derived from the PR base/head, CTA, and Article/FAQ JSON-LD.

## Local checks

- `npm test`: 1,723/1,723 passed
- `node scripts/check-chars.mjs`: passed
- `npm run seo`: passed
- `npm run format:check`: passed (744 tracked files)
- `npm run deploy:check`: passed; staging build only
- `npm run plan:check`: passed; `MASTER_PLAN.md` hash unchanged

Exact-head CI and the live Jev result are pending. The native repository 95/95/95 gate remains unchanged. No deployment is part of this PR.