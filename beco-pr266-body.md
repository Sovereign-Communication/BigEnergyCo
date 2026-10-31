## Scope

Replace the battery guide’s fixed LFP/sodium DoD multipliers and model-independent inverter voltage presets with a site-specific checklist. The copy now directs readers to characterize the load, use the exact battery’s usable capacity and limits, verify battery/inverter compatibility, and follow product and local installation requirements. Remove the unsupported zero-swap claim from the CTA and describe the calculator output as an estimate. Add a regression test for the removed universal presets.

This is a partial P9.5 audit slice. Remaining battery references and 12 other blog posts are still open.

## Validation

All six required local checks passed on the tested tree:
- `npm test` (1,731/1,731)
- `node scripts/check-chars.mjs`
- `npm run seo`
- `npm run format:check`
- `npm run deploy:check`
- `npm run plan:check`

This PR is stacked on #265. Merge after the base chain lands and exact-head required checks and Jev satisfy policy v1.
