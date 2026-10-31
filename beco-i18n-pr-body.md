## Scope
Back-reads the 43 chart, state-of-charge, and cumulative-cost strings against English across Spanish, Portuguese, French, German, Dutch, and Arabic. Clarifies that the SOC chart is modeled with five years of weather data and replaces English "derated" jargon in the Dutch lead-acid caption. Adds regression coverage and a review record. The evidence line preserves the remaining unkeyed-prose and native-speaker review gaps.

## Validation
- `npm test` (1,745 passed)
- `node scripts/check-chars.mjs`
- `npm run seo` (asset graph `20261022k`, service worker `beco-v136`)
- `npm run format:check`
- `npm run deploy:check`
- `npm run plan:check`

Native-speaker review of broader translated-page prose remains open.
