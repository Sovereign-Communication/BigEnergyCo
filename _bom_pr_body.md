## Defect found by the visual audit (queue 5)

The visual audit of key pages x 7 locales x mobile/desktop found all four BOM spec paragraphs rendering **in English on every translated locale** (measured: `esPresent: false` on the Spanish home page — the translated value existed in the dictionary but never reached the DOM), while the static i18n gate stayed green.

## Diagnosis (primary sources)

- `index.html` carries the right hooks: `<p data-i18n="lfpCells">` etc.
- `ui.js:8284-8291` re-builds the whole BOM grid from `BOM_ITEMS` after the markup pass, as `el("p", {}, item.desc)` — raw English, **no hook**. The applier therefore could not translate it at first paint nor re-apply it on a language switch.
- `check-i18n.mjs` rules 1-9 read the dictionary and the static markup; neither can see the render path. Rule 9 measures unkeyed prose in static HTML, where the keys were present.

## Change (test first)

1. `4c1d8854` — `tests/i18n-bom-copy.test.mjs`, committed **red** (3/3 failing): every BOM item must name a locale key, the key must resolve in all seven locales, and the render must ask the dictionary and keep the `data-i18n` hook.
2. `9e7d8391` — the fix: each `BOM_ITEMS` entry gains its already-existing `descKey` (`lfpCells`, `batteryManagementSpec`, `breakerSpec`, `endplateSpec` — all four already translated in all 7 locales), and the render becomes `el("p", { "data-i18n": item.descKey }, t(item.descKey))`: resolved string for first paint, hook for every language switch, matching the contract `repaintRuntimeCopy()` states for JS-built surfaces. New rule 10 in `check-i18n.mjs` enforces it; the rule is proven to fire by mutating the render back (2 named failures, exit 1) and restoring.
3. `31060af2` — asset stamp `20261028c` per the immutable-asset rule.

No locale string was added or edited; the translations already existed.

## Verification (local, branch at 31060af2)

- `npm test` — **1986/1986** (includes the 3 new red-first tests)
- `node scripts/check-chars.mjs` — exit 0
- `npm run seo` — exit 0 (includes `check-i18n` rule 10: `runtime-rendered BOM copy resolves through the dictionary in all locales`)
- `npm run format:check` — exit 0 · `npm run deploy:check` — exit 0 · `npm run plan:check` — exit 0
- `npm run smoke:local` — **232/232** real-Chrome gates
- Visual audit (7 locales x home + heatmap x 390/1440, 28 screenshots): **0 failures / 138 checks**, 12/12 English-prose-leak checks PASS (0/12 before the fix: all six non-English locales leaked at both widths), 14 cells N/A because the heatmap's static source claims no translation (`claimsTranslation` = false), the repo's own "untranslated by decision" scope from check-i18n rule 9.

## Plan items

D-16 (one unified tool), i18n parity obligations under P0.3 / #287's translation clause. No plan change; no threshold touched.

## Questions

1. The heatmap page (source `solar-heatmap/index.html`, 0 hooks, `claimsTranslation` = false) renders fully English — including its JS-injected nav — for every locale, and its `html lang` stays `en`. The repo documents this class as "untranslated by decision", so this PR treats it as in-scope-for-none. Confirm the heatmap (and the blog bodies sharing the pattern) are intended to stay English-only.
