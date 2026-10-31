## Summary
- Add a localized translation-suggestion link to the home page and generated HTML pages, with lazy loaders for the calculator and heatmap.
- Build a draft issue URL containing the page, locale, translation key, and selected text; no request is sent until the visitor submits through GitHub.
- Add focused tests and real-browser coverage for locale, selection preservation, empty/long input, and deploy-stage injection.
- Trim measured shipped comments and refresh asset tokens to keep this candidate within the regression budget.

## Validation on commit `a8041a6`
- Format, i18n, and focused tests: passed (82/82 focused tests).
- Deploy stage: passed; 413 files staged, suggestion link injected on 85 HTML pages, and both loader modules included.
- Real experience walk: passed with 0 regressions / 0 holes; 9/9 first-run steps, 42/42 locale runtime readings, 2,982/2,982 DOM fields, axe 0 violations.
- Byte budgets: 0 regressions, 1 improvement; three absolute P6/P8 limits remain over budget and are reported as non-blocking by the current plan policy.
- Fresh pre-CI Jev run: not passing. No CI run-record artifact was supplied, so tests/smoke/CI/SEO gates defaulted red; translation was judged mixed (ordinal 60, confidence 0.83). No translation-facet pass is claimed. The experience report still says meaning/naturalness and native review remain open.
- A separate fresh review of the six new localized link labels against the English CTA found no supported defect, so those strings were not changed.
