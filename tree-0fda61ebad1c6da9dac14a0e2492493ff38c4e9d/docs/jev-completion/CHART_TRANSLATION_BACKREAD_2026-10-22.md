# Chart translation back-read — 2026-10-22

## Scope

Reviewed the 43 chart, state-of-charge, and cumulative-cost keys added by PR #248. Each English source was compared with its Spanish, Portuguese, French, German, Dutch, and Arabic rendering in `LOCALES`. The review checked the reader-visible meaning of chemistry labels, units, state-of-charge limits, replacement counts, grid and generator roles, feed-in and bill credits, tariff prompts, and cost horizons.

The review found no material numeric, operational, or grid-versus-generator meaning reversals. It found two clarity issues:

- The SOC legend phrase “across five real-weather years” could read as battery age or an observed battery lifetime. The label now says the battery is modeled with five years of observed weather data in all seven locales.
- The Dutch lead-acid caption used the English jargon “derated.” It now explains that usable capacity falls under heavy discharge.

Regression coverage in `tests/charts.test.mjs` checks the clarified meaning in every locale and guards the Dutch wording. Existing `check-i18n` checks continue to cover key parity, placeholders, and raw-key leakage.

## Remaining review

This semantic back-read is not a native-speaker review. Native-speaker review of translated-page prose remains open; the automatic i18n checks do not prove that prose is idiomatic.
