## Summary

Fixes the actual P0.4 accessibility regression in the comparison matrix and narrows the dependency group to compatible accessibility tooling.

- Selectable matrix cells now include their complete visible value summary in the accessible name, as WCAG 2.5.3 requires.
- Adds a source contract test so the label and rendered summary stay aligned.
- Keeps axe-core 4.14, chrome-launcher 1.2.2, and Playwright 1.64.1; excludes the TypeScript 7 upgrade because the installed `tsconfck` peer requires TypeScript 5.
- Bumps the immutable asset graph to `20261022g` and the service-worker cache to `beco-v132` for the shipped `ui.js` change.

The original CI failure was in the two result-matrix cells (LTR and RTL): `label-content-name-mismatch` because the aria-label named only the row and column while the cell displayed system size, battery, cost, lifetime cost, and savings/offset.

## Verification

- `npm test`
- `node scripts/check-chars.mjs`
- `npm run seo`
- `npm run format:check`
- `npm run deploy:check`
- `npm run plan:check`
- `npm run gate:a11y-matrix`
