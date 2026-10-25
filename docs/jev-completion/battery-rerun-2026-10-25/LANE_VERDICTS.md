# Lane verdicts — battery re-run, 2026-10-25

Owner-authorized re-run (~US$0.01 authorized, US$0.00081522 spent) to source the
audit data that `audit.db` alone held. Population: 1,454 extracted functions;
726 flagged fail-open (fail-closed < 0.5); 400 with no direct test.

This file is the narrative record. The per-function record is machine-readable:

- `battery-security.csv` / `battery-testplan.csv` — the judge's pass-1 rows
  (scores, blast radius, failure modes, strategies).
- `dispositions-failopen.csv` / `dispositions-testplan.csv` — **the disposition
  record**: every function, its bucket, the reason, the code evidence, and —
  where one remains — the question for the owner.
- `dispositions-summary.json` — the counts.
- `tested.json` / `hardened.json` — what this pass actually tested and
  hardened. A bucket claims a test only when its key is in `tested.json`;
  the record never claims a harden that did not happen.

## Method

1. **Extraction** (brace/regex heuristic over tracked `.js`/`/.mjs` in
   `assets/js`, `worker`, `scripts`, `tests`). Counts differ from the
   historical tree-sitter extraction and are this run's own.
2. **Pass 1** — judge (`jev-1.13.0`) scored every function on fail-closed,
   blast radius, failure mode and test strategy, function-only context.
3. **Pass 2** — expanded-context re-judgment of all 726 flagged functions with
   the sites' source. Verdicts: 725 `needs-human-look`, 1 `must-fix`.
4. **Mechanical rule** (`scripts/jev-dispositions.mjs`, documented in-code):
   fail-closed signals in the body, marked/degraded-in-code fallbacks,
   documented assumptions in the comment window, tooling surfaces, loud or
   bounded failure modes — each exonerates with a cited fact.
5. **Lane review** (this pass) — every site the mechanical rule could not
   settle was read in context and decided against the CARs' single question:
   *can this fallback present a wrong result as fact?* Decisions and their
   evidence live in the `LANE` table in `scripts/jev-dispositions.mjs` and
   travel with each CSV row.

## Judge pass-2's lone must-fix, reviewed

`assets/js/shared/escape.js:6` `escapeHtml` (conf 0.23; probabilities 0.49
must-fix / 0.46 needs-human-look — a coin flip). **Verdict: exonerated.**
Every return path passes through the full escape chain; missing input renders
empty — the fail-*closed* direction. `tests/escape.test.mjs` pins
`escapeHtml(null) === ""`. No hardening possible without making the escaper
throw on missing data, which would be strictly worse.

## CAR #197 named production must-fix (11) — verdicts

| Site | Verdict | Evidence |
| --- | --- | --- |
| `ui.js::purchasePaths` | hardened (prior pass), guard-tested now | fail-closed guards + fix comments at site; `tests/audit-rerun-dispositions.test.mjs` pins the refusal to price a non-finite baseline |
| `location-picker.js::el` | covered | `tests/audit-car5-wiring.test.mjs`, `tests/audit-top10-failclosed.test.mjs` |
| `worker/index.js::callGroq` | covered | `tests/worker-upstream-failures.test.mjs`; `doFetch` parameter is the documented production seam (comment at site) |
| `run.js::runSizingUncached` | covered | fail-fast `msg` guard at site; `tests/audit-rerun-dispositions.test.mjs` pins the boundary through `runSizing` |
| `nasa.js::buildUrl` | covered | `tests/privacy.test.mjs` (the round-at-egress fix); `tests/audit-rerun-dispositions.test.mjs` pins the parser contract + `roundCoord`'s fail-closed non-finite → null |
| `ui.js::setCoords` | covered | `tests/consumer-usecases.test.mjs`, `tests/playtest-guards.test.mjs`; stale-payload teardown at site (>0.05° drift) |
| `ui.js::mergeReSlice` | hardened (prior pass), covered | non-object result guard + fix comment at site; `tests/audit-car1-guards.test.mjs`, `tests/audit-top10-failclosed.test.mjs` |
| `ui.js::renderRelativeOptions` | hardened (prior pass), covered | the battery-only honesty fix documented at site; `tests/relative-options.test.mjs` |
| `ui.js::applyGenRate` | covered | `tests/issue196-input-validation.test.mjs`; invalid input leaves the previous tariff applied — nothing is overwritten and the typed value stays in the field |
| `ui.js::markPrecalcDirty` | covered | `tests/issue196-input-validation.test.mjs`; the function IS the staleness teardown (invalidates in-flight runs, clears the payload) |
| `run.js::fetchWeatherWithFallback` | fail-open-by-design, correct | the fallback is labeled in the data the UI renders (`meta.offline: true`, `source: "… (OFFLINE MODE)"`); `tests/audit-top10-failclosed.test.mjs` |

## CAR #197 named needs-human-look (production) — decisions

- **`ui.js` `band` (inside `turnkeyQuoteText`)** — exonerated. The formatter it
  calls (`money`) renders an explicit unknown marker `"–"` for every non-finite
  amount, so a missing year0 can never surface as a price. Pinned by
  `tests/audit-rerun-dispositions.test.mjs` (which also pins the one coercion,
  `money(null) → "$0"`).
- **`ui.js::applianceState`** — exonerated. Double-gated per row (validity gate
  + accumulation finiteness gate): invalid rows are skipped, never summed.
  Surge defaults to running watts only for rows with no surge spec (the
  physical minimum). Pinned by `tests/audit-car6-integration.test.mjs` and
  `tests/issue196-input-validation.test.mjs`.
- **`run.js::runSizingCore`** — exonerated. The only invented values are the
  cache's copies, and both cache bugs are fixed with comments at site
  (`__useCaseContext` re-attachment); failures propagate to `runSizing`'s
  error surface.
- **`run.js::fetchWeatherOnce`** — exonerated. The memo stores only a
  completed series; failures propagate to `fetchWeatherWithFallback`'s
  labeled offline story.

## CAR #201 named gaps

`readInputs`, `setLevel`, `syncCutControls` were executed directly by
`tests/audit-car6-integration.test.mjs` in a prior batch; `run`'s boundary is
pinned through `runSizing` in `tests/audit-rerun-dispositions.test.mjs`;
`location-picker.js::el` and `pipelineEl` are covered by the wiring suites.

## What this pass added

`tests/audit-rerun-dispositions.test.mjs` — 23 tests:

- the nine owed `needs-test` functions: heatmap math
  (`annualYieldKwhPerKwp`, `nearestProfile`, `systemCostMid`, `computePayback`,
  `computeBreakeven`, `computeLcoe`, `estimateTariffBlended`), NASA's
  `parseHourly`, and `workedExample` — all previously never executed;
- the named CAR sites without executed coverage: `purchasePaths` guards,
  `money`'s unknown marker (behind `band`), `markerOffCurveNote`, the tiny
  helpers `el` / `modeLabel` / `verdictKeys` / `usStateCode`, and `runSizing`'s
  message boundary.

One confirmed defect hardened: **`haversineKm`** (scripts/generate-heatmap-data.mjs)
— antipodal floating-point overshoot could NaN the distance and silently empty
the nearest-profile search. Clamped; pinned by the new suite.

## Disposition counts (final)

| Queue | Total | Disposition |
| --- | --- | --- |
| Fail-open (fail-closed < 0.5) | 726 | 725 fail-open-by-design with reason + evidence, 1 hardened-with-test (`haversineKm`) |
| Test gaps | 400 | 15 tested this pass, 227 covered-transitively (project precedent: the tested entry points re-enter them), 158 dispositioned with reason |

Every one of the 71 sites the mechanical rule escalated to needs-human-look was
lane-reviewed and decided; the reasons are per-row in
`dispositions-failopen.csv` and source-checked in the `LANE` table.

## Watch items for the owner (verdicts recorded, product intent confirmable)

1. `ui.js::refreshFxRates` — FX rates age silently until the next refresh;
   the applied rate is always the one shown in the `fxRate` input. Worth a
   stale-rate badge after some age?
2. `paths.js::leaseSchedule` — an instrument other than `ppa`/`lease` would
   silently price as a PPA. Worth an explicit throw when the registry is
   extended?
3. `chem-model.js::cycleLifeForDoD` — an unknown chemistry silently degrades
   to the default 4000-cycle curve. Acceptable, or refuse unknown chemistries?

These are the only open product questions in the record; everything else is
either tested, hardened, or exonerated with a cited code fact.
