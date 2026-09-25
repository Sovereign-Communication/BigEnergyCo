# Architecture map

What owns what, as of the #116–#127 sequence (run channel → location picker
→ charts → a11y flow → run deadline → share-link codec). Read this before
changing sizing behavior or the smoke harness; update it when the structure
changes.

## Run lifecycle (the part that deadlocks if done wrong)

- `assets/js/sizing/run-coordinator.js` — **single owner** of the full-run
  channel: `createRunChannel()` holds busy / retire-sequence / collapsed
  replacement; `staleRunAction()` and `errorReleasesRunChannel()` are the pure
  policy. Every full-run reply is released through one funnel
  (`flushPendingRun()` → `settle()`); the two historical stale-reply leaks
  (#113 ok path, #114 error path) are structurally closed by that funnel.
- `assets/js/sizing/ui.js` consumes the channel and keeps only what is
  genuinely its own: the consent gate (`runAuthorized`, `precalcDirty`), the
  350 ms debounce (`runTimer`), payload identity (`payloadEpoch`, shared with
  slices), the slice channel (`sliceToken`/`sliceBusy`/`pendingSlice` — a
  simpler machine on purpose), the three-minute worker-reply timer, and all
  DOM feedback. The deadline constant and generation token live with the run
  channel; on expiry the UI terminates the silent worker, reports a retryable
  error only for the still-current request, and releases any collapsed run
  through the same settle funnel. An explicit retry therefore creates a fresh
  worker without weakening the production timeout.

## Data flow

inputs → `run()` (consent + validation) → channel claim → worker → reply →
`staleRunAction` verdict → render (current) or funnel release + flush
(collapsed). Pre-calc edits call `runChannel.invalidate()` (retire, no
replacement); invalid direct requests call `runChannel.dropPending()`.

## Smoke harness

`scripts/browser-smoke.mjs` is a small sequencer; behavior lives in
`scripts/smoke/`: `runtime.mjs` (launch, CDP wire, error collectors, gate
reporter), `actions.mjs` (navigate, Jev stub, form input), and one module per
product flow (`weather`, `gridtie`, `lifecycle`, `jev`, `share`, `results`,
`a11y`, `closing`, `deadline`). The deadline flow holds one worker reply,
shortens only the exact production timeout in its isolated browser context,
then proves an explicit fresh-worker retry succeeds. Gates are defined where
the behavior lives; the orchestrator only orders them.

## Tests that guard ownership

- `tests/ui-race.test.mjs` — state-machine behavior (collapse precedence,
  invalidate/dropPending, double-settle inert) + the ui.js wiring pin (no
  loose flags, funnel present).
- `scripts/smoke/lifecycle.js` — the held-response race in a real browser:
  a genuine engine reply held, made stale, released, and the next explicit
  click recovering.
- `scripts/smoke/deadline.js` + `tests/run-deadline.test.mjs` — a silent worker
  times out, releases the run channel, preserves newer status, and recovers on
  an explicit fresh-worker retry.
- `scripts/smoke/a11y.js` + `tests/reduced-motion.test.mjs` — keyboard reach
  and role=button operability, the accessible-name union across states, WCAG
  AA contrast, and the reduced-motion scroll contract (instant under
  `prefers-reduced-motion`, animated without it) at all three scroll sites.

## Location picking (extracted from ui.js)- `assets/js/sizing/location-picker.js` — owns the **widgets only**: the city

combobox (suggestions, keyboard nav, the 2s hands-free auto-resolve, and
the resolve-time guard that stops the picker re-resolving the very label it
just wrote — otherwise a keyboard Tab re-picked identical coordinates and
invalidated a fresh result), and the geolocation "locate me" flow. Every
location decision funnels through the injected
`onPick(lat, lon, label, region?, country?)`; status feedback goes
through the injected `setStatus`. No location state lives here.

- `assets/js/sizing/cities.js` — owns the **domain layer**: search, catalogs,
  partitions, online lookups. Its geocoder HTTP runs through one seam
  (`setGeocodeFetchImpl`) so tests stay offline-deterministic.
- `ui.js` keeps only `setCoords` (run-state consent: a pick is location
  consent, never calculation consent) and the single wiring line
  `setupCitySearch({ onPick: setCoords, setStatus })`.
- `tests/location-picker.test.mjs` — behavioral contract of the real module
  (combobox full-arg funnel, Enter path, the label no-op, no-match ladder,
  legacy-cache purge, geolocation errors and the two-stage GPS pick). It imports the SAME stamped
  cities instance the picker imports — a bare import would patch the wrong
  module (Node treats the `?v=` specifier as a distinct instance).
- `tests/cities.test.mjs` — the hands-free auto-resolve cadence, proven
  behaviorally (nothing before 2s, full-contract pick after).

## Chart rendering (extracted from ui.js)

- `assets/js/sizing/charts.js` — **single owner** of canvas chart rendering
  (reliability/SOC, cumulative cost, auto comparison, the sun-harvest strip)
  and of chart state (`socZoomRange`, `cachedChartState`). Rendering only;
  every decision arrives as arguments. Injected boundary:
  `initCharts({ $, el, t, fmt, money })` — nothing the module calls may live
  only in ui.js (pinned in `tests/charts.test.mjs`).
- `TIER_COLORS`/`TIER_NAMES` live here as the palette's one home (chart
  legends are their only consumers; ui.js's former import was dead and went).
- Pure seams `computeZoomSpan` (zoom math) and `findWorstStreak` (worst
  30-day window) are exported for `tests/charts.test.mjs`, which also pins
  the module graph: every name ui.js imports exists, the export surface is
  exactly its consumers, and the palette stays out of ui.js.

## Share-link codec (extracted from ui.js)

- `assets/js/sizing/share-codec.js` — **single owner** of what a share link
  is: the `#s=` + base64url JSON format, encode/decode, and the validation
  gate (`parseShareHash`) every incoming link must pass (version and the
  la/lo/kw bounds) before it is allowed to touch the form. Pure policy, no
  DOM; `tests/share-codec.test.mjs` pins the round trip and the refusal
  cases — the same malformed links the share smoke gates reject live.
- `ui.js` keeps only the DOM application: writing a validated state into
  inputs (`restoreFromShare`) and serializing the current form
  (`updateShareHash`).

## Infeasible-reason copy (extracted from ui.js)

- `assets/js/sizing/infeasible-copy.js` — **single owner of which reason code
  maps to which locale keys**. The engine decides the code
  (`infeasibleReason`, plus the two search-limit codes `run.js` adds),
  `locales.js` owns the copy in six languages, and this module owns the
  mapping between them — a value a test can call. It used to be a table
  inside `ui.js`, reachable only by regexing that file's source, so a code
  with no reviewed copy could ship as a generic message nobody had read.
- `ui.js` keeps only `renderInfeasibleBanner`: the banner DOM and the sr-only
  live region that mirrors it for assistive tech.
  `tests/infeasible-copy.test.mjs` proves every code the engine can emit has
  copy, that the search-limit codes keep their own wording, and that all six
  locales carry every pair.

## Parts-list export (extracted from ui.js)

- `assets/js/sizing/parts-csv.js` — **single owner of the spreadsheet**: the
  field escaping (`csvField`), the document framing (`csvDocument`: UTF-8 BOM
  plus CRLF, which is what makes a spreadsheet read the non-ASCII notes
  correctly) and the row assembly (`partsListRows`), which is pure — a
  hardware list, the selected system, a site and a date in; rows out. Every
  section is optional by design: battery-only, solar-only, cable-less, and
  either hemisphere.
- `ui.js` keeps the download mechanics only: build the list, make a blob,
  click a link. `tests/parts-csv.test.mjs` pins a byte-exact golden captured
  from the pre-extraction implementation, so the move is proven to change
  nothing a visitor downloads.

## Generator fuel helper (extracted from ui.js)

- `assets/js/sizing/fuel-units.js` — **single owner of the fuel rules**: the
  litres-per-kWh burn table and its US-gallon twin, the three boxes that buy
  fuel by the gallon (mainland US, Hawaii, Alaska), the coordinate predicate
  (`isImperialLocation`), the burn lookup with its petrol fallback
  (`fuelBurnPerKwh`), the typed local-price -> USD/kWh conversion
  (`fuelRateUsd`) and the five display facts the page writes — label key,
  example price, unit suffix, and the two footnote figures (`fuelDisplay`).
  The footnote figures are derived from the burn table instead of typed in, so
  editing the table can no longer leave the paragraph disagreeing with the
  maths it describes.
- `ui.js` keeps the input plumbing: read the coordinates and the price fields,
  write the label, the example, the unit spans and the readout sentence.
- `tests/fuel-units.test.mjs` freezes what the pre-extraction implementation
  produced — every box boundary, the price/FX matrix, and the readout
  sentences under both unit systems — and pins that the controller delegates
  rather than duplicating. `scripts/smoke/location.js` checks the same five
  slots in a real browser, switching Honolulu -> gallons and Paris -> litres.

## Internationalization (translation ownership)

- `assets/js/shared/locales.js` — **single owner** of every user-visible
  string, in all six locales (`en`, `es`, `pt`, `fr`, `de`, `ar` with RTL).
  There is no second copy. Three readers share one implementation of the
  contract: `i18n.js`'s `translate()`/`applyI18n()` (the `data-i18n`,
  `data-i18n-placeholder`, `data-i18n-aria-label` hooks), the sizing
  controller (which binds `translate as t`), and the classic `chat.js` bridge
  (`window.becoT`/`window.becoLang`).
- `assets/js/shared/interpolate.js` — **single owner of the string contract**:
  `pickString` (locale, then English, then the raw key) and `interpolate`
  (`{placeholder}` substitution). This was implemented twice, once for the
  markup pass and once for runtime copy, so the same replacement defect had
  to be found and fixed in each; there is one loop now.
- **Interpolation is `{placeholder}`, applied with a function replacer.** A
  pre-translated fragment glued together in code cannot be reordered by a
  translator, and a string replacer reads `$&`/`$n` inside the value as a
  pattern — so a formatted money figure (`$200`) would silently lose its
  dollars. Names are matched literally, never as a pattern, so a placeholder
  is only ever filled by its own exact name. All three traps are pinned in
  `tests/interpolate.test.mjs`, with the money case also pinned end to end in
  `tests/i18n.test.mjs`.
- Runtime copy is composed from keys, never literals: the pipeline stepper,
  speed notes, infeasibility banners, appliance and slider readouts, the
  share-restore label, the init-failure status, and the advisor modal's
  loading/error/retry text.
- **Boundary (deliberate):** the long-form static sections — hero, FAQ,
  parts list, support, legal — are English-only documentation, and that is
  visible as the absence of a `data-i18n` hook on those elements. The
  translated surface is the calculator itself plus its advisor.
- Gates: `scripts/check-i18n.mjs` (parity, hook coverage, placeholder
  parity, no key-name leaks, RTL, runtime-composed families, and no key that
  shipped code or markup never renders) and `tests/i18n.test.mjs` (corruption
  such as a lost byte, split sentences, the placeholder contract,
  interpolation safety).

## Known remaining debt (deliberate, not forgotten)

- `ui.js` is still ~8.0k lines (7,999 at this writing): form state, rendering
  glue, Jev badge lifecycle, sliders, modals. Seven extraction seams are done
  (run channel, location picking, chart rendering, share-link codec,
  infeasible-reason copy, parts-list export, generator fuel helper) and the
  string contract now has one owner in `shared/interpolate.js`; each further
  seam should follow the same pattern (policy in a pure module, mechanics stay
  with the DOM, tests first).
- The two display-currency clusters are the next obvious seam: `fxActive` /
  `money` / `localRate` / `energyRate` / `gridRate` / `moneyRange` all read the
  same two inputs and the same rate table, and the tariff, export and fuel
  fields each convert with it by hand.
- The hero, FAQ, parts list, support and legal sections are still
  English-only static markup. Translating them is an editorial pass (six
  locales of long-form prose), not a code change, and nothing in the
  calculator depends on it.
- The live Jev path now runs directly against TypeSafe
  (`provider=typesafe fallback=false`, recorded across the complete-gate
  runs); OpenRouter stays configured as the rate-limit backup, and the
  deterministic stub still serves the dedicated smoke gates.
