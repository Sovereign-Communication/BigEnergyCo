## Scope

Audit the off-grid battery-bank sizing guide for P9.5 / R-CONT-05. Replaces unsupported chemistry defaults, universal capacity tiers, stale component price ranges, and prescriptive wiring guidance with a load-and-backup method tied to the exact product specification and local installation rules.

Synchronizes the Article and FAQPage JSON-LD, visible FAQs, review date, blog card, RSS entry, and sitemap. Adds NREL, product-manual, NFPA, and UL source links. Keeps the shared inline style block unchanged.

## Validation

- `npm test`: 1,775/1,775
- Article FAQ/source/metadata audit and JSON-LD validation passed.
- `npm run seo`, `npm run format:check`, `npm run deploy:check`, `npm run plan:check`, repository Prettier, and the byte-budget check passed.
- Byte budgets: zero regressions, two improvements; three existing over-limit metrics remain reported under the plan's baseline rules.