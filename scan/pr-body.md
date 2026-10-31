## Plan items

P9.4 (the city-page surface, and the copy decision its audit named rather than guessed) — delivers **R-I18N-01** for the time-of-use verdict (numbers and currency through `Intl`, no hand-built number strings in the UI; closes F-42's "numbers are formatted by hand in places" at that surface) and the worked-example copy of **R-SEO-01**'s city pages. No plan item is completed here.

## What changed and why

Measured 2026-10-14 by driving the deployed calculator (`bigenergyco.pages.dev`, built from the tree main serves, `c76721e`) for eleven markets across regions — New York, London, Berlin, Tokyo, Lagos, Delhi, Santiago, Ho Chi Minh City, Suva, Papeete, Kathmandu — at 10 kWh/day and a 60% bill-cut goal, then reading each market's committed page for the same inputs.

**Reachable:** all eleven served and ran. `freeoffgridcalculator.com` is unreachable from this environment (403 `cf-mitigated: challenge` to every non-browser client), so the sample is the Pages host. One label set could not be read rather than rounded: Papeete renders French chrome (the app follows `navigator.language`, here `fr-PF`) while my extractor looked for English labels, so its currency, engine sizes and 20-year figure were read and its payback line was left unmeasured.

**What passed, in the visitor's own currency:** the currency resolved in every market and the formatting followed the visitor's own conventions — `£`, `€`, `￥`, `₦`, `₹` with lakh grouping (`₹1,79,551.44`), CLP `$5.258.606`, `₫53.618.607`, `$24,696.67` FJD, `1 182 240 FCFP`, `NPR 289,567.36`; the rate came from that market's own tariff box in local units (Tokyo `¥31.66/kWh`, Berlin `0.35 €/kWh`); units were metric; the payback and 20-year figures rendered in that currency. Against the static pages: the page's payback year sat inside the engine's payback range in all ten markets where both were readable, and the engine's PV sat inside the page's panel band in nine and just under its lower edge in two (Santiago 1.69 kW against a 2 kW floor, Papeete 1.46 kW against 1.5 kW — inside the band's 0.5 kW step). Both recorded, not rounded.

**Three things a visitor reads were wrong. Two of them are the page-versus-calculator disagreement this closes.**

The 60%-cut row, page against the calculator for the same inputs:

| markets | page battery column | calculator's own recommendation |
| --- | --- | --- |
| New York, London, Lagos, Delhi, Papeete, Kathmandu | 3–5 kWh | 6 kWh |
| Berlin, Tokyo | 3–5 kWh | 7 kWh |
| Santiago, Ho Chi Minh City, Suva | 3–5 kWh | 3 kWh (the band's floor) |

1. **Every page quoted US-dollar benchmarks under a bare `$`.** A Tokyo reader was shown `$0.20/kWh` while the calculator they are invited to run shows `¥31.66/kWh`. Baking a static FX snapshot into 66 pages would drift silently against live rates, so the page names its unit and says the calculator converts instead.
2. **The battery column read as the sizing answer the simulator contradicts.** The generator's band is a flat heuristic (`10 × f × 0.7`) and cannot run the hourly engine, while the engine sizes the bank against the location's own darkest week: it landed above the page's band top in **8 of 11** markets and at its floor in the other 3, never below. No band the generator computes can promise the engine's number, so the page stops implying it: the battery column is named as the one the simulator re-sizes, which is the page's own "why simulate instead of estimate" argument applied where it was missing.
3. **The results card shipped broken sentences in every market** — `Your Cut my electricity bill result`, `Measured for Cut my electricity bill against of your bill removed over 20 years` — and the time-of-use verdict printed cash as bare USD integers (`worth about 9720 over 20 years against a 4100 battery`). The first two interpolate an imperative case label into a possessive slot and a label-relative metric fragment into a prepositional slot; the label now sits where it reads as a sentence (after a colon) and the fragment stays under the number it labels. The third is R-I18N-01: the verdict's cash slots go through `money()` like every other amount on the page.

**Named, not guessed, and deliberately not fixed here:** `assets/js/sizing/charts.js` injects unkeyed English prose into the cumulative-savings callout (`+~… saved over 20 years`, `Break-even in year N …`), so a French visitor reads English there. `check-i18n.mjs`'s UNKEYED rule reads shipped *HTML*, so no rule sees runtime-injected prose, and this repo already carries a committed 51-block ceiling for that class in HTML; keying ~6 strings across 6 locales with no gate able to hold them is a P5-sized change, not a minimal close, so it is recorded here rather than half-done.

Release rules: asset stamp `20261005h → 20261015a`, `sw.js` `beco-v108 → beco-v109`, and the committed evidence record moves with them (its `seo_summary` now names the build it describes and which bytes this branch changed).

## Definition of done (plan §9)

- [x] Tests added/updated for every change; coverage not lowered
- [x] Local preflight: `npm test` · `node scripts/check-chars.mjs` · `npm run seo` · prettier `--check` · `npm run deploy:check` · `npm run plan:check`
  - `npm run seo` exit 0, including the city-pages `--check`, the i18n gate, and `asset-token check OK (stamp 20261015a, 46 referenced assets verified against the stamp commit)`.
  - `npm test` **1674/1675** on this box: the one failure is `tests/privacy-journeys.test.mjs`'s "the committed privacy artifact records journeys" reading `jev-artifacts/privacy-browser.json` while another test in the same run writes it (this box's Chromium run leaves `ok:false`). The pristine `c76721e` tree recorded a failure in its own full run too, and that file is 14/14 standalone on both trees — environmental, not this change. The CI run below is the authoritative reading.
- [x] No metric regressed vs the latest ledger baseline; phase absolute thresholds met
- [ ] Scoped live Jev report attached (score ≥ 99.0, no facet regression) — the `jev-complete` job on this PR's own run is that report (main skips the job); its result and score are read back into the ledger row
- [ ] `docs/plan/LEDGER.jsonl` row appended (`item-done`, PR, SHA, gates, Jev) — appended in a follow-up commit once this PR's number and gate verdict exist
- [x] Release rules followed (SW `CACHE_VERSION` + asset tokens)
- [ ] Tracking issue ticked

## Checks, proved both ways

- `tests/i18n.test.mjs` ⇢ `use-case card sentences do not interpolate the metric fragment`: **red** against the shipped text, green here.
- `tests/city-pages-drift.test.mjs` ⇢ `every city page names the unit of its money and labels the battery column`: **red** against the shipped pages, green here. It rides the existing city-pages gate (`build-city-pages.mjs --check` inside `npm run seo`), so no new harness.
- `scripts/smoke/gridtie.js`, time-of-use phase ⇢ three gates read the rendered card: no unresolved placeholder, `worth about <digits>` refused, `spread here is <digits>` refused — the amounts can only be seen where a browser renders them.

🤖 Generated with Codebuff
