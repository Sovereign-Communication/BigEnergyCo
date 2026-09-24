# Architecture map

What owns what, as of #116–#123 (run channel → location picker → charts →
a11y flow). Read this before
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

## Known remaining debt (deliberate, not forgotten)

- `ui.js` is still ~7.9k lines: form state, rendering, Jev, sliders,
  sharing, modals. Three extractions are done (run channel, location picking,
  chart rendering); each further one should follow the same pattern (policy in
  a pure module, mechanics stay with the DOM, tests first).
- The live Jev path now runs directly against TypeSafe
  (`provider=typesafe fallback=false`, recorded across the complete-gate
  runs); OpenRouter stays configured as the rate-limit backup, and the
  deterministic stub still serves the dedicated smoke gates.
