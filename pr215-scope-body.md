## Canonical scope on current main

This PR is cross-scope. The entries below distinguish delivered behavior from partial touches and do not claim that every referenced plan item is complete.

- **P0.4 / Q-05 — first-load HTML budget:** the owner-approved allowance is up to 2 KB. The committed Brotli q11 measurement is 19,426 bytes, +529 bytes from the prior 18,897-byte baseline, below the 30,720-byte cap. The local byte-budget gate reports no regressions.
- **P0.4 / Q-07 — reduced-motion scrolling:** both user-triggered scroll sites use the shared motion preference. Real-browser checks confirm instant scrolling with reduced motion and animated scrolling without it.
- **P6.1 / R-FLOW-01..05 — partial:** first-run example, simple-mode default, delayed install prompt, and synchronized sizing controls are implemented on /. The canonical plan assigns this flow to /next/; the intended route is an owner decision.
- **P9.3 — partial:** generated city pages include yield context. The planned new economics and shared shell are not delivered.
- **P9.5 / R-CONT-05 — partial touch:** blog cards have reading-level labels and a pinned introduction. The required audit of stale figures, sources, and review dates is not delivered.
- **R-OFF-02 / F-28 — partial touch; phase mapping unknown:** the heatmap has no-JavaScript and WebGL fallback copy. Leaflet still loads from a third-party CDN, so R-OFF-02 is not satisfied.
- **No exact current canonical item identified:** the FAQ cross-links and Camper Van preset coherence fix. The Camper Van path now keeps 2.5 kWh/day and $37/month consistent across preset, controls, labels, and worker input; the real-browser regression passed. R-UC-05 and R-UC-06 describe different off-grid use cases, so neither is claimed for this fix.

### Local validation

The behavioral changes are on rebased head ff9cb7b; commit 65a6874 only corrects the release evidence text to match the current gates and asset stamp.

- npm run deploy:check, npm run seo, npm run format:check, and npm run plan:check: pass.
- npm run smoke:local: all 173 browser gates pass, including the Camper Van worker round trip and both reduced-motion scroll sites; no CSP or other console/page errors.
- node --test tests/reduced-motion.test.mjs: 2/2 pass; node --test tests/jev-scope.test.mjs: 32/32 pass.
- npm run gate:byte-budgets: exit 0, zero regressions and three improvements. It still reports three plan §3.1 limit breaches: js_before_interactive 190.9/35 KB, registry_country 75.1/6 KB, and heatmap_initial 402.5/300 KB.
- The first aggregate local npm test run had one privacy-artifact assertion failure; the isolated privacy test passed 14/14. The fresh hosted suite below passes 1690/1690.

### Fresh hosted checks on PR head 65a6874951bc15dba151f1bb33e3058fdc216cf5

Pull-request run 39023567166 used this head and refs/pull/215/merge. Passed: CodeQL, analyze, coverage, Lighthouse, quality-evidence, quality-lab, test (1690/1690), and web-smoke (173/173), including privacy, resilience, and first-run browser journeys.

The PR-triggered jev-complete job failed at “Which plan item is this PR about?” with: “the title names more than one plan item (P0.4, P6.1, P9.3, P9.5). A scoped run judges one item's facets; split the PR, or set the scope explicitly.” The uploaded artifact is jev-evidence.json only; it records CI, tests, and smoke as green, but there is no Jev score or jev-report.json because the live judgment step was skipped.

### Remaining owner gates

- The Jev resolver accepts one plan item per PR. Owner action: split this change by canonical item or approve a canonical multi-item scope and corresponding gate change. The title names all four touched plan items instead of claiming only one.
- The repository-level secret listing does not contain TYPESAFE_API_KEY. Organization-level secret availability is unknown because the available org-secret query was denied. The scope failure occurred before the live step could confirm secret availability, so no live Jev judgment is claimed.
- P6.1 currently places the first-run flow on / while the plan assigns it to /next/; owner decision needed on target route.
- Current GitHub merge state is UNSTABLE because jev-complete fails. The PR has not been merged; no deployment was made.