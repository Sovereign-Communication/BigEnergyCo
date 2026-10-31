## Problem

The Netherlands is a top-five traffic country (1,406 visits in 30 days, formerly the second-largest international audience), but Dutch visitors fall back to English.

## End state in this PR

The runtime can render the calculator in Dutch, with the formal “uw” register and Dutch energy terms. The language picker and browser-language detection include Nederlands. The dictionary has 436 keys with full mechanical parity and placeholder checks against English.

Plan scope: P11.1 language wave, extending R-I18N-01 and R-I18N-07. Links: [MASTER_PLAN.md](https://github.com/Sovereign-Communication/BigEnergyCo/blob/main/docs/plan/MASTER_PLAN.md) · [Master plan tracker #145](https://github.com/Sovereign-Communication/BigEnergyCo/issues/145)

- Updates the locale-count tests, Dutch runtime chart copy, and i18n evidence.
- Records the measured P0.4 byte baseline for seven locales: 10,117 bytes per locale, 70,821 compressed bytes for the dictionary, below the unchanged 25,600-byte limit.
- Uses asset stamp 20261022f and service worker cache beco-v131.
- Enables follow-on blog PR #231 after this UI locale is available in main.

## Verification

- `node --test tests/i18n.test.mjs`: 12/12
- `npm test`: 1718/1718
- `node scripts/check-chars.mjs`: pass
- `npm run seo`: pass
- `npm run format:check`: pass
- `npm run deploy:check`: pass
- `npm run plan:check`: pass
- `npm run gate:byte-budgets -- --stage _pages_staging`: 0 regressions after the measured locale baseline was recorded

## Remaining launch gate

The Q-12 comprehension probe for Dutch has not been run, and this PR does not claim P11.1 complete or launch Dutch to production. The language stays in staging until it meets the P8.1 language bar, including Jev translation quality and the comprehension probe.
