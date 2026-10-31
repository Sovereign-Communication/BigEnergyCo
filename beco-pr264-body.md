## Scope

Remove the unsupported 20-year battery price and replacement-savings scenario from the battery guide. Replace it with a keyboard-reachable, captioned cost-input checklist that asks readers to disclose product model, usable capacity, dated price and installation scope, operating/test conditions, sourced replacement assumptions, comparison method, and uncertainty. Add a regression test against the invented totals.

This is a partial P9.5 audit slice. It does not complete the battery article audit or the remaining blog posts.

## Validation

All required local checks passed on this head:
- `npm test` (1,729/1,729)
- `node scripts/check-chars.mjs`
- `npm run seo`
- `npm run format:check`
- `npm run deploy:check`
- `npm run plan:check`

This PR is stacked on #263; merge after its base PR lands and the exact-head required checks and Jev gate satisfy policy v1.
