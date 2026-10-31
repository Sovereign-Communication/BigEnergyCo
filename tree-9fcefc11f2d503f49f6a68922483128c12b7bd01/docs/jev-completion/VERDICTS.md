# Phase A Iteration — Verdicts (Jev re-judged until clarity)

Cost-no-object iteration round: every queue was re-judged with expanded context until each item landed in exactly one of execution-ready (>=0.95 or double-confirmed >=0.80), lane-review (specific question stated), or dispositioned/exonerated (reason recorded).

## Deepen-all (298 critical/important context-need functions)

- Round 1: 207 re-judged, mean residual need 1.4, 113 clear (<1.5)
- Round 2: 178 re-judged, mean residual need 1.82, 35 clear (<1.5)
- Prescription re-run: 352 (key, facet) pairs, 201 flips, mean confidence delta 0.15

## Fail-closed dispositions (121 battery items -> verdicts)

- acceptable-fail-open: 55
- must-fix: 51
- needs-human-look: 15

Top must-fix items:

- `tests/weather-persistence.test.mjs:110` `put` (security-bypass, conf 0.86)
- `assets/js/sizing/ui.js:5015` `purchasePaths` (silent-wrong-output, conf 0.85)
- `tests/weather-persistence.test.mjs:116` `delete` (silent-wrong-output, conf 0.85)
- `tests/jev-sanitize.test.mjs:360` `fetch` (silent-wrong-output, conf 0.76)
- `scripts/smoke/advisor-fallbacks.mjs:209` `fetch` (security-bypass, conf 0.73)
- `tests/perf-budget.test.mjs:247` `stubPowerFetch` (ui-crash-freeze, conf 0.73)
- `scripts/smoke/lifecycle.js:7` `runLifecycleFlow` (ui-crash-freeze, conf 0.66)
- `scripts/serve-static.mjs:91` `applyPolicy` (security-bypass, conf 0.65)
- `scripts/smoke/privacy.mjs:57` `runPrivacyFlow` (security-bypass, conf 0.65)
- `tests/consistency.test.mjs:182` `stubPowerFetch` (ui-crash-freeze, conf 0.64)
- `tests/ci-resilience.test.mjs:829` `runVerifier` (silent-wrong-output, conf 0.62)
- `tests/nasa-timeout.test.mjs:38` `stub` (ui-crash-freeze, conf 0.61)
- `tests/turnstile-client-lifecycle.test.mjs:178` `doc.head.appendChild` (ui-crash-freeze, conf 0.61)
- `assets/js/sizing/location-picker.js:25` `el` (ui-crash-freeze, conf 0.57)
- `scripts/lib/gates.mjs:184` `aimsOutsideSite` (security-bypass, conf 0.57)

## Wiring noise battery (1,527 -> verdicts)

- ambiguous: 95
- confirmed broken: 4
- noise (Jev-exonerated): 201
- noise (rank-exonerated, below top-300): 1227

## Concurrency second opinions

- `assets/js/chat.js:347` `sendChatMsg`: p_real=0.54 (race-stale-state) -> **AMBIGUOUS**
- `assets/js/sizing/location-picker.js:39` `setupCitySearch`: p_real=0.55 (race-stale-state) -> **AMBIGUOUS**
- `scripts/smoke/resilience.mjs:133` `installNasaInterceptor`: p_real=0.54 (race-stale-state) -> **AMBIGUOUS**
- `scripts/smoke/runtime.mjs:199` `send`: p_real=0.57 (unhandled-rejection) -> **AMBIGUOUS**

## Confirm-or-kill (production suspects)

- confirmed: 14
- killed: 20
- refined: 8

Killed (false positives):

- `assets/js/sizing/frontier.js:56` `isBoundLimited` (was: validate-early)
- `assets/js/sizing/ui.js:3451` `previewCurvePoint` (was: validate-guard)
- `assets/js/sizing/ui.js:6170` `applyGenRate` (was: validate-guard)
- `assets/js/sizing/ui.js:1319` `applianceState` (was: validate-guard)
- `assets/js/sizing/run.js:417` `runSizingUncached` (was: validate-guard)
- `assets/js/sizing/ui.js:5059` `band` (was: validate-guard)
- `assets/js/sizing/ui.js:6939` `monthName` (was: validate-guard)
- `assets/js/sizing/tilt-harvest.js:19` `deg2rad` (was: validate-early)
- `assets/js/sizing/frontier.js:238` `thinFront` (was: validate-early)
- `assets/js/sizing/run.js:793` `toPct` (was: validate-early)
- `assets/js/sizing/ui.js:1307` `setLoadPanel` (was: validate-guard)
- `assets/js/sizing/charts.js:999` `drawSocChartForEntry` (was: validate-guard)
- `assets/js/sizing/bom.js:90` `nextControllerSize` (was: validate-early)
- `assets/js/sizing/charts.js:700` `X` (was: validate-early)
- `assets/js/sizing/charts.js:701` `Y` (was: validate-early)
- `assets/js/sizing/ui.js:5015` `purchasePaths` (was: validate-guard)
- `assets/js/sizing/bom.js:164` `retailConfig` (was: validate-early)
- `assets/js/sizing/charts.js:1136` `X` (was: validate-early)
- `assets/js/sizing/location-picker.js:25` `el` (was: escape-output)
- `assets/js/sizing/nasa.js:115` `buildUrl` (was: validate-guard)

Refined:

- `assets/js/sizing/frontier.js:90` `battLadder`: validate-early -> **fallback-default**
- `assets/js/sizing/charts.js:1435` `findWorstStreak`: validate-early -> **fallback-default**
- `assets/js/sizing/money.js:70` `laborMidPerKwh`: validate-early -> **fallback-default**
- `assets/js/sizing/ui.js:6939` `monthName`: validate-early -> **sink-avoidance**
- `assets/js/sizing/frontier.js:72` `pvLadder`: validate-early -> **fallback-default**
- `assets/js/sizing/money.js:116` `swapSchedule`: validate-early -> **fallback-default**
- `assets/js/sizing/run.js:247` `siteMemoKey`: validate-early -> **fallback-default**
- `assets/js/sizing/ui.js:4492` `fmtDelta`: validate-early -> **fallback-default**

## Dispositioned / exonerated summary

- Prescriptions killed as false positives: 20
- Fail-open items dispositioned acceptable: 55
- Wiring flags Jev-exonerated as noise: 201
- Wiring flags rank-exonerated (below top-300): 1227
