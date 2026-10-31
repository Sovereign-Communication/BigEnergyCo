## Plan item

- P9.5: continue the audit of blog claims against current source material, remove unsupported figures, and show the last-reviewed date.

## Changes

- Replaced universal solar bill-cut, payback, regional-rate, and component-cost claims with a scenario-based guide that explains the assumptions a reader must verify.
- Added DOE, NASA POWER, and NREL source links; refreshed the visible FAQs and FAQPage data together.
- Added a scoped comparison table, visible review date, synchronized BlogPosting/card metadata, and sitemap lastmod.
- Added regression checks for the removed claims, FAQ parity, review dates, card/schema parity, and sitemap date.
- Preserved the shared inline article style block.

## Validation

- `npm test`: 1761/1761
- `node scripts/check-chars.mjs`: pass
- `npm run seo`: pass
- `npm run format:check`: pass
- `npm run deploy:check`: pass
- `npm run plan:check`: pass
- `npx --yes prettier@3.9.6 --check .`: pass
- `node scripts/check-byte-budgets.mjs`: 0 regressions; 2 improvements, 3 pre-existing reported breaches
- Focused article/style/table tests: 33/33
