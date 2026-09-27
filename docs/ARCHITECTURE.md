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
- **Boundary (deliberate, and narrower than it looks):** the long-form static
  sections — hero, FAQ, parts list, support, legal — are English-only
  documentation, and that is visible as the absence of a `data-i18n` hook on
  those elements. The translated surface is the calculator's CONTROLS, its
  history and frontier charts, its result caption and its advisor. The
  calculator's result CARDS are not: the focus chips, the best-pick and matrix
  card rows, the hardware list, the ELI5 breakdown, the orientation guide, the
  BOS checklist, the method notes and the print sheet are literals in `ui.js`
  and `charts.js`. A non-English run therefore switches language between the
  tabs and the numbers under them. Translating that tier is an editorial pass
  (six locales of prose), not a code change; the switch itself must stay
  honest in the meantime, which is why a language change re-renders the result
  panel rather than only re-applying the markup hooks.
- **A panel-free run is not a solar run.** `hardwareConfig: "battery"` builds
  no array, and four surfaces have been caught describing one anyway (the
  frontier verdict, the auto note, the capacity-spectrum baseline, the
  cumulative caption). The rule that now holds: a string that NAMES the
  energy source is selected by the run's own hardware — `simpleWhatItMeans` /
  `simpleWhatItMeansBattery`, `frontierMethod` / `frontierMethodBattery`, the
  `cumulative legend`, the tilt guide, the BOS checklist and the parts list
  all read `pvKw`/`hardwareConfig`, and each has a smoke gate for both
  directions. Numbers never move to satisfy copy: a levelized cost that means
  "cost per shifted kWh" on a battery-only run is renamed, not recomputed.
- Gates: `scripts/check-i18n.mjs` (parity, hook coverage, placeholder
  parity, no key-name leaks, RTL, runtime-composed families, and no key that
  shipped code or markup never renders) and `tests/i18n.test.mjs` (corruption
  such as a lost byte, split sentences, the placeholder contract,
  interpolation safety).

## Jev complete gate (P0.3(c)–(e): evidence, the wire, the run, the verdict)

`scripts/validate-jev-complete.mjs` is a **pipeline and nothing else**. Each
concern below has one owner; the CLI only decides the order. Data flows one way,
left to right, and nothing points back.

| module                             | owns                                                                                                                                      | touches the network/disk? |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `scripts/lib/jev-auto-facts.mjs`   | what the checkout looks like: `tree_clean`, `secrets_clean`, `env_ignored`, `test_count`, target sha                                      | git, read-only            |
| `scripts/lib/jev-evidence.mjs`     | the **run records**: artifact in, `tests_green`/`prettier_clean`/`seo_green`/`smoke_green`/`ci_green` out, plus the evidence file's shape | no — zero imports         |
| `scripts/build-jev-evidence.mjs`   | writing that evidence file; exits non-zero when it cannot be trusted                                                                      | reads artifacts           |
| `scripts/lib/jev-live.mjs`         | the **wire**: where the key comes from, and the one TypeSafe request that spends it                                                       | yes, and the only place   |
| `scripts/lib/jev-run.mjs`          | the **live-run state**, and only it: the model pin, the record of the call, the run class, the report's run facts, the exit rule          | no                        |
| `scripts/lib/jev-complete.mjs`     | the **engine**: pack, questions, answers, facets, ordinals, ratchet comparison                                                            | reads the pack            |
| `scripts/lib/jev-verdict.mjs`      | the **scoped verdict**: §9 rule 6 bootstrap, the binding point, what makes a scoped run pass                                              | no — pure policy          |
| `scripts/lib/jev-scope.mjs`        | a PR **title** read as a plan item (imported directly by the CI job)                                                                      | no                        |
| `scripts/lib/jev-report-print.mjs` | how a report reads to a person; `--json` bypasses it                                                                                      | no                        |

Three things worth knowing before changing any of it:

- **Two report views, on purpose.** `report.live` is the **scorer's**: what the
  judge said (`primary_gap`, its notes). `report.live_jev` is the **call's**:
  provider, model, tokens, cost, blocker. They are not the same object and are
  not meant to be. The four fields they share (`is_fallback`, `accepted`,
  `model`, `model_requested`) are written from one value in `attachRunFacts`,
  because a report that says "judgment" on one field and "nothing was accepted"
  on another is the exact defect this PR cluster found twice.
- **The record is assembled in one function.** `liveRunRecord` (jev-run.mjs)
  has one branch per outcome: skipped / no answers / unpinned / unreadable /
  accepted. It used to be four object literals in the CLI, so the shape of what
  the report reads was decided by whoever was calling.
- **The gate is fail-closed on its own dirt.** It reads `git status --porcelain`
  for `tree_clean`, and `--out` writes into the working tree. A report written
  but not committed makes the _next_ run measure a dirty tree, which is a red
  hard gate and a collapsed score. The CI job therefore writes everything under
  `$RUNNER_TEMP`, never into the checkout.

Guarded by:

- `tests/jev-ci-evidence.test.mjs` — the evidence rules, the model pin, the run
  class, `--require-live`, and every branch of the live-run record.
- `tests/jev-scope.test.mjs` — the bootstrap rule and the ratchet clause, pinned
  in `jev-verdict.mjs` by source, and the declared baseline resolving.
- `tests/jev-price.test.mjs` — the D-13 rate has one owner (`worker/jev-price.mjs`)
  and the gate's modules import rather than restate it.
- `tests/jev-facets.test.mjs` — the pack's axes, buckets and derived budget.

## Byte budgets (P0.4(a): plan §3.1 measured on the staged build)

Two files, one direction of travel. `scripts/lib/byte-budgets.mjs` never touches
a filesystem: it takes a staged build described as data (a file list and a
reader) and returns one reading per §3.1 budget. The CLI supplies the disk.

| module                           | owns                                                                                                                                            | touches the network/disk?    |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `scripts/lib/byte-budgets.mjs`   | the §3.1 limits (verbatim), what each budget's **scope** is, the brotli measurement, the per-metric bar from the ledger, the ratchet comparison | no — takes `{files, read}`   |
| `scripts/check-byte-budgets.mjs` | walking a stage dir, the printed table, the exit code                                                                                           | reads the stage + the ledger |

Three things worth knowing before changing any of it:

- **The scope of a budget is a decision, not an implementation detail.**
  "JavaScript before step 1 is interactive" is the transitive module graph the
  document's scripts reach; the registry line is the **worst** country, not an
  average; the locale line is the per-locale share, with the whole file reported
  beside it. Each of those choices has a named test, because a budget measured
  over the wrong set is a number nobody can act on.
- **A subject that is not in the build reads `null`, never `0`.** A missing
  stylesheet, strings file, country file or heatmap page is `status: "not_found"`
  and compares as `unmeasured`. `0` would satisfy the budget without anything
  having been read — which is how the first run of this gate reported a
  0-byte heatmap payload and a `0.0 KB` request count, both of which looked
  like budgets met.
- **The bar is per metric and lives in the ledger.** Only a `baseline` row sets
  it, the newest declared reading of each metric wins, and a row that says
  nothing about a metric leaves that metric alone. A `gate-run` row carries the
  metrics of the run that produced it; if it could set the bar, every run would
  compare against itself.

§3.2 makes these gates **regression-blocking from P0** and absolute only from P6
(`/next/`) and P8 (all), so an over-limit reading is printed as a breach and only
getting _worse_ against the declared baseline fails. Three limits are breached at
the P0.4 baseline and stay visible rather than relaxed; §3.1 allows a relaxation
only by measured evidence plus an owner-approved amendment, and the amendment
lives in the plan.

Guarded by `tests/byte-budgets.test.mjs` — the verbatim limits, every scope, the
ratchet semantics, the absent-subject rule, the per-metric bar, and the CLI's
exit codes. Every assertion here has a proven mutation: relaxing a limit,
counting only the entry scripts, enforcing absolutely, letting an older row win,
letting a gate run set the bar, passing on a regression, dropping the tolerance,
finding no heatmap page, resolving a `fetch()` against the script instead of the
document, reading an absent subject as 0, printing a count as bytes, and
comparing an unreadable metric anyway.

## Accessibility matrix (P0.4(b): plan Q-07, axe over template × state × theme × direction)

`scripts/lib/quality-matrix.mjs` decides **what** is audited and
`scripts/check-a11y-matrix.mjs` runs it. They share no state: the library takes a
staged build as data and returns the declared dimensions, the cells, the
combinations that do not apply, and the per-cell ratchet; the driver supplies the
disk and the browser.

| module                           | owns                                                                                             | touches the network/disk?                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| `scripts/lib/quality-matrix.mjs` | the four declared dimensions, the per-cell steps, the axe tag set, the per-cell bar, the ratchet | no — takes `{files, read}`                 |
| `scripts/check-a11y-matrix.mjs`  | the stage server, one browser per cell, axe injection, the report                                | serves locally, drives the runner's Chrome |

Four things worth knowing before changing any of it:

- **A dimension the product lacks is still declared.** There is no theme in this
  build, so the theme dimension carries one value, `none`, with the evidence for
  its absence in the value itself. Dropping the dimension would shrink the cell
  count and make the matrix look smaller than it is; inventing a dark theme would
  audit something that does not exist.
- **A cell exists only where the state does.** A blog post has no result card, so
  that combination is recorded as not applicable **with a reason** — because "we
  chose not to" and "we did, and it was clean" are different answers to "why was
  this not audited?".
- **Direction follows the module graph, not the markup.** `dir` is set by
  `shared/i18n.js`, which the home page reaches through `ui.js` without ever naming
  it. The matrix walks the graph — the same walk the byte budgets own — so a
  translated page is not mistaken for an untranslated one.
- **A hole is never a pass.** A cell that cannot be audited records
  `violations: null, status: "unauditable"`, the bar reader refuses it, and the run
  exits 1. Today the heatmap cell is exactly that: axe's `best-practice` tag does
  not finish on that page (541s, then the renderer died, while every WCAG tag
  completes in 0.7–6.4s). The rule set is not narrowed to make it pass.

The driver bypasses CSP **on the audit context only**: the product ships a strict
`script-src`, which correctly refuses axe injected as an inline script — the first
version of this probe died on exactly that. The product's own policy is untouched
and stays asserted by the smoke suite's CSP gate. Each cell also gets its own
browser and a hard deadline, because a page that takes its renderer down must cost
one cell and not the run.

Guarded by `tests/quality-matrix.test.mjs` — the four dimensions, the
representative, state applicability, graph-based direction, every driven selector,
the tag set, the ratchet, the hole rule and the per-cell bar. Eleven mutations,
each caught by its named assertion.

## Known remaining debt (deliberate, not forgotten)

- **Five axe violations the P0.4(b) baseline now measures, in four cells.** Two on
  a completed run, in both text directions: `aria-required-children` (critical) at
  the cumulative-cost legend `#cumCostLegend`, and `nested-interactive` (serious) on
  the result chart's `svg`. One on the blog index (`region`, moderate), one on a
  blog post (`scrollable-region-focusable`, serious), two on 404
  (`landmark-one-main` and `region`, both moderate). Q-07's cap is 0 per cell and is
  absolute from P5/P8, so these are named debt with a measured baseline behind
  them, not a gate that was loosened.
- **The heatmap cell cannot be audited at all.** axe's `best-practice` tag does not
  finish on that page: 541 seconds, then the renderer is gone. Every WCAG tag
  completes in 0.7–6.4s, and a `wcag2aa` violation is already known on that page.
  Until the cause is found the cell is a hole, and a hole is not a pass.

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
- The live Jev path runs directly against TypeSafe and is the **only** Jev
  provider (`provider=typesafe fallback=false`, recorded across the complete-gate
  runs). The former second provider was removed in P0.3(b) under decision D-13,
  so there is no fallback and no fallback key: a TypeSafe outage yields no Jev
  verdict, which the client already treats as "hide the badge, silently". The
  deterministic stub still serves the dedicated smoke gates.
