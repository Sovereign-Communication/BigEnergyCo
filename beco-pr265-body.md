## Scope

Audit the battery guide’s visible sodium-ion, AGM, and oversizing FAQs. Replace chemistry-wide discharge and inverter-capacity assertions and universal AGM life and savings claims with product-specific guidance. Keep the FAQPage JSON-LD answers aligned with visible copy and add a regression test for parity and removed claims.

Sources used:
- [CATL TENER Sodium system description](https://www.catl.com/en/news/6861.html), which describes dedicated voltage regulation and sodium-specific battery management for that system.
- [Discover Standard AGM Performance data sheet](https://assets.discoverbattery.com/documents/07_sla/885_product_literature/standard-agm-battery-performance.pdf), which states the operating conditions used for its AGM life guidance.

This is one partial P9.5 article slice. The section 7 setup checklist, the rest of the reference list, and 12 other posts remain open.

## Validation

All six required local checks passed on the tested tree:
- `npm test` (1,730/1,730)
- `node scripts/check-chars.mjs`
- `npm run seo`
- `npm run format:check`
- `npm run deploy:check`
- `npm run plan:check`

This PR is stacked on #264. Merge after its base chain lands and exact-head required checks and Jev satisfy policy v1.
