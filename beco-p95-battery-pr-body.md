## Summary

- Rewrites the home battery article as a source-grounded homeowner decision guide and removes broad, unsupported price and payback claims.
- Synchronizes the article metadata, FAQ schema and visible FAQ, blog card, RSS entry, and sitemap review date.
- Adds a focused audit test and corrects the table test so it verifies accessible markup for tables that exist without requiring every article to contain one.

Sources cited in the article: U.S. Department of Energy homeowner solar guidance, DOE solar and storage basics, DOE resilience guidance, and the EIA time-of-day glossary.

## Validation

- Full required local preflight passed on the code and test changes; the P9.5 ledger row will be added to the PR before merge.
- `npm test`: 1,772/1,772.
- `npm run deploy:check` built staging output only; no deployment was dispatched.
