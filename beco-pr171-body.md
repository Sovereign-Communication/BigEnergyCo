## Scope

This PR fixes the sizing workflow tracked by F-20 / R-FLOW-04:

- Keep the bill-cut and budget constraints independent while keeping both slider views consistent.
- Ignore stale run replies after a slider change and reconcile the displayed state before scheduling the next slice.
- Add canonical slider and stale-run coverage.

It also carries the surviving work from the original branch: a PWA install surface, shared DOM helpers, compare-before-write i18n, code-hygiene checks, translation coverage for all use-case verdict keys, and run-derived accessibility and quality evidence.

## Rebase disposition

- Rebased onto `main` at `53888bf` (13 commits beyond the base; 67 files, +4,455 / -384).
- Preserved the current `main` heatmap's image-first and lazy-data path. The former 39,707-dot canvas rewrite and binary dataset conversion were dropped during the rebase; this PR makes no heatmap performance claim.
- Kept the existing plan byte limits. This branch does not edit `MASTER_PLAN.md`, `AMENDMENTS.md`, or `LEDGER.jsonl`.
- Updated immutable asset URLs to stamp `20261023a` and advanced the service-worker cache version to `beco-v141` for this branch's shipped asset changes.

## Validation on the rebased branch

- `npm test`: 1,862 / 1,862 passed.
- `npm run seo`: passed, including the asset-token freshness check.
- `npm run format:check`, `npm run deploy:check`, and `npm run plan:check`: passed.
- `node scripts/check-chars.mjs`, `node scripts/check-facet-evidence.mjs`, and `node scripts/check-code-hygiene.mjs`: passed; the guard covers 21 / 21 facets and code hygiene reports zero dead files, unreferenced exports, or duplicate blocks.

CI must rerun on the rebased head. Merge only after all required checks pass on that exact SHA.