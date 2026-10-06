# BigEnergyCo Phase-2 Prescriptions — Jev-selected implementation patterns

Full Jev audit of the BigEnergyCo codebase (1,986 functions, 21 questions each, model `jev-1.13.0`), followed by phase 2: 760 implementation-pattern prescription judgments, 649 context-needs judgments, contextual re-judging of 88 critical-context functions, and security/testplan/concurrency batteries. 0 API errors.
Tables `prescriptions`, `context_needs`, `battery_security`, `battery_testplan`, `battery_concurrency`, `pattern_fits`, `pinpoints` in `audit.db`. Per-function CSVs: `prescriptions.csv`, `context-needs.csv`.

## Calibration — read first

Prescription confidence runs **0.39–0.66**, nowhere near the 0.95 gate. The granularity pass scores every pattern's fit per function: fit-argmax agrees with the prescription choice only **4%** of the time, and `no-change` is the top fit in **59%** of functions. **Prescriptions are a ranked suspect list, not work orders.** Only items at >=0.95 confidence are execution-ready; everything below needs lane review against the granularity fits in `prescriptions.csv` before any code changes.

## Execution-ready (>=0.95, production only)

- **0.98** `mergeReSlice` (`assets/js/sizing/ui.js:3018`) [security] -> **validate-guard** (pinpoint: `multiple-sites`)
- **0.96** `populatePrintSheet` (`assets/js/sizing/ui.js:7705`) [security] -> **escape-output** (pinpoint: `footprintText`)
- **0.95** `clearCompactCache` (`assets/js/sizing/nasa.js:280`) [security] -> **validate-guard** (pinpoint: `idbDelete`)

## Strong signal (0.80-0.95, production only) — lane review required

- 0.94 `isBoundLimited` (`assets/js/sizing/frontier.js:56`) [errors] -> validate-early
- 0.94 `paretoFront` (`assets/js/sizing/frontier.js:219`) [errors] -> validate-early
- 0.94 `previewCurvePoint` (`assets/js/sizing/ui.js:3451`) [security] -> validate-guard
- 0.94 `applyGenRate` (`assets/js/sizing/ui.js:6170`) [security] -> validate-guard
- 0.93 `applianceState` (`assets/js/sizing/ui.js:1319`) [security] -> validate-guard
- 0.92 `flatProfile` (`assets/js/sizing/engine.js:184`) [errors] -> validate-early
- 0.92 `textWidth` (`assets/js/sizing/frontier-chart.js:62`) [errors] -> validate-early
- 0.92 `runSizingUncached` (`assets/js/sizing/run.js:417`) [security] -> validate-guard
- 0.91 `band` (`assets/js/sizing/ui.js:5059`) [security] -> validate-guard
- 0.91 `monthName` (`assets/js/sizing/ui.js:6939`) [security] -> validate-guard
- 0.89 `downsampleEnvelope` (`assets/js/sizing/engine.js:470`) [errors] -> validate-early
- 0.89 `battLadder` (`assets/js/sizing/frontier.js:90`) [errors] -> validate-early
- 0.88 `findWorstStreak` (`assets/js/sizing/charts.js:1435`) [errors] -> validate-early
- 0.88 `deg2rad` (`assets/js/sizing/tilt-harvest.js:19`) [errors] -> validate-early
- 0.87 `thinFront` (`assets/js/sizing/frontier.js:238`) [errors] -> validate-early
- 0.86 `laborMidPerKwh` (`assets/js/sizing/money.js:70`) [errors] -> validate-early
- 0.86 `toPct` (`assets/js/sizing/run.js:793`) [errors] -> validate-early
- 0.86 `declination` (`assets/js/sizing/tilt-harvest.js:24`) [errors] -> validate-early
- 0.86 `renderRelativeOptions` (`assets/js/sizing/ui.js:4361`) [security] -> escape-output
- 0.85 `setGeocodeFetchImpl` (`assets/js/sizing/cities.js:257`) [wiring] -> state-store
- 0.85 `renderInfeasibleBanner` (`assets/js/sizing/ui.js:1230`) [security] -> escape-output
- 0.85 `setLoadPanel` (`assets/js/sizing/ui.js:1307`) [security] -> validate-guard
- 0.85 `monthName` (`assets/js/sizing/ui.js:6939`) [errors] -> validate-early
- 0.84 `drawSocChartForEntry` (`assets/js/sizing/charts.js:999`) [security] -> validate-guard
- 0.83 `money` (`assets/js/chat.js:828`) [errors] -> validate-early
- 0.83 `nextControllerSize` (`assets/js/sizing/bom.js:90`) [errors] -> validate-early
- 0.83 `pvLadder` (`assets/js/sizing/frontier.js:72`) [errors] -> validate-early
- 0.83 `swapSchedule` (`assets/js/sizing/money.js:116`) [errors] -> validate-early
- 0.82 `drawSunStrip` (`assets/js/sizing/charts.js:81`) [errors] -> validate-early
- 0.82 `X` (`assets/js/sizing/charts.js:700`) [errors] -> validate-early
- 0.82 `Y` (`assets/js/sizing/charts.js:701`) [errors] -> validate-early
- 0.82 `linearCapex` (`assets/js/sizing/frontier.js:487`) [errors] -> validate-early
- 0.82 `addTo` (`assets/js/sizing/paths.js:526`) [errors] -> validate-early
- 0.82 `purchasePaths` (`assets/js/sizing/ui.js:5015`) [security] -> validate-guard
- 0.81 `retailConfig` (`assets/js/sizing/bom.js:164`) [errors] -> validate-early
- 0.81 `placeLabel` (`assets/js/sizing/frontier-chart.js:71`) [errors] -> validate-early
- 0.80 `X` (`assets/js/sizing/charts.js:1136`) [errors] -> validate-early
- 0.80 `el` (`assets/js/sizing/location-picker.js:25`) [security] -> escape-output
- 0.80 `buildUrl` (`assets/js/sizing/nasa.js:115`) [security] -> validate-guard
- 0.80 `siteMemoKey` (`assets/js/sizing/run.js:247`) [errors] -> validate-early

(45 total at >=0.80 in production excluding no-change; top 40 shown.)

## Prescriptions by pattern (production, non-no-change)

- validate-early: 145 functions (avg conf 0.6)
- try-catch-local: 44 functions (avg conf 0.41)
- validate-guard: 29 functions (avg conf 0.72)
- escape-output: 29 functions (avg conf 0.67)
- error-boundary: 20 functions (avg conf 0.48)
- result-object: 12 functions (avg conf 0.33)
- propagate-reject: 12 functions (avg conf 0.35)
- fallback-default: 7 functions (avg conf 0.26)
- unhandled-guard: 4 functions (avg conf 0.45)
- catch-log-rethrow: 4 functions (avg conf 0.28)
- state-store: 3 functions (avg conf 0.64)
- sink-avoidance: 3 functions (avg conf 0.36)
- url-whitelist: 2 functions (avg conf 0.61)
- throw-domain-error: 2 functions (avg conf 0.4)
- listener-cleanup: 2 functions (avg conf 0.39)
- await-chain: 2 functions (avg conf 0.48)
- token-not-in-url: 1 functions (avg conf 0.27)
- split-function: 1 functions (avg conf 0.43)
- return-promise: 1 functions (avg conf 0.71)
- least-privilege-fetch: 1 functions (avg conf 0.28)
- guard-clause: 1 functions (avg conf 0.45)
- fail-closed: 1 functions (avg conf 0.53)
- delegate-up: 1 functions (avg conf 0.52)

## Battery headlines

- Security: input not validated (<0.5): 136
- Security: fail-open risk (<0.5): 121
- Security: secrets handling fail (<0.5): 9
- Security: randomness fail (<0.5): 4
- Testplan: unit strategy: 202
- Testplan: integration strategy: 6
- Concurrency: bug likely+ (>=2.0): 4
- Context: critical need (>2.25): 75
- Dead/experimental functions: 1

