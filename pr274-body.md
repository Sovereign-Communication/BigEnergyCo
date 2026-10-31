## Scope
Carry the battery article work from stacked PRs #265, #266, and #267 into `main` as one P9.5 article-audit cluster. The merged stack branch has the same tree as the green #267 exact head, and its aggregate diff is 378 changed lines, within the plan's 400-line ceiling.

## Changes
- Replace battery-longevity FAQ claims with product-specific, source-aligned guidance.
- Replace universal setup multipliers and inverter setpoints with a model-specific checklist.
- Align cited references with the sources and visible FAQ metadata.
- Preserve append-only ledger entries for the three slices.

## Validation
The exact tree passed `npm test` (1,735/1,735), `node scripts/check-chars.mjs`, `npm run seo`, `npm run format:check`, `npm run deploy:check`, and `npm run plan:check`; the original exact-head CI for #267 passed all required checks including Jev. This new main-target PR will rerun its checks against current main.

This closes only the battery-longevity article slice of P9.5. Remaining posts and the broader P9.5 audit stay open.
