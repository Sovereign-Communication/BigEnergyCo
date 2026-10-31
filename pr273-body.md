## Summary
- Extract the duplicated `byId` and `el` DOM helpers from the sizing UI and location picker into `assets/js/shared/dom.js`.
- Add shared DOM helper coverage and retain existing location picker behavior.
- Refresh immutable asset tokens and append the plan ledger row.

This is a scoped extraction of importable shared code from PR #171. It is stacked on PR #272 because the sizing UI source includes #272's i18n guards.

## Validation
All six required local gates passed on the committed tree: `npm test` (1729/1729), `node scripts/check-chars.mjs`, `npm run seo`, `npm run format:check`, `npm run deploy:check`, and `npm run plan:check`.