## Summary

- Reframes the off-grid solar sizing article around measured load, site weather, battery dispatch, and the household's backup policy; removes universal yield bands, coverage percentages, a fixed autonomy multiplier, generic location examples, and price bands.
- Aligns the visible FAQs and FAQPage data, Article/BlogPosting metadata, blog card, review date, RSS, and sitemap.
- Adds an article audit test and preserves the shared byte-identical inline style block.

## Sources

- NREL PVWatts: https://pvwatts.nrel.gov/ (grid-connected estimate, not an off-grid guarantee)
- NREL System Advisor Model battery storage: https://sam.nrel.gov/battery-storage/
- U.S. Department of Energy Homeowner's Guide to Solar: https://www.energy.gov/cmei/systems/homeowners-guide-solar

## Local verification

- `npm test`: 1774/1774
- `node scripts/check-chars.mjs`: pass
- `npm run seo`: pass
- `npm run format:check`: pass
- `npm run deploy:check`: staged local build only
- `npm run plan:check`: pass
- `npx --yes prettier@3.9.6 --check .`: pass
- `node scripts/check-byte-budgets.mjs`: 0 regressions, 2 improvements; existing over-limit categories reported
