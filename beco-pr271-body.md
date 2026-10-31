## Scope

Audits the DIY battery article's cost-comparison section for unsupported current prices and prohibited retailer attribution. Removes the retailer and product-brand snapshot, fixed materials figures, and savings framing. Replaces them with a same-capacity written-quote checklist and synchronizes the article description, blog card, visible FAQ, and FAQPage JSON-LD.

This is one partial P9.5 article audit. It does not mark the article reviewed; its visible review date and the remaining blog posts are still open.

## Evidence and validation

- Adds the P9.5 progress row to `docs/plan/LEDGER.jsonl`, keyed to code commit `bcab3c61d010a62f28d325dda548dc9aaf8d044f`.
- Focused test: `tests/blog-diy-price-override.test.mjs`, 2/2.
- `npm test`: 1736/1736.
- `node scripts/check-chars.mjs`: passed.
- `npm run seo`: passed.
- `npm run format:check`: passed.
- `npm run deploy:check`: passed.
- `npm run plan:check`: passed.

The body and test are limited to the cost guidance, its metadata, and FAQ parity. Jev's PR report will be reviewed under `docs/JEV_GATE_POLICY_V1.md`; a below-bar report will receive claim-level investigation against this scope.
