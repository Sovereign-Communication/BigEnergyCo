## Plan scope
- P9.5 / R-CONT-05: claim, source, metadata, and reader-safety audit for the Hawaii solar-warning article.
- Tracking issue: #194. Plan: [MASTER_PLAN.md](docs/plan/MASTER_PLAN.md).

## Changes
- Attribute the reported door-to-door claims to Hawaii DCCA and remove unsupported categorical wording.
- Correct the cancellation guidance to distinguish DCCA's warning from the FTC Cooling-Off Rule's limited coverage and exclusions.
- Replace unsupported licensing and HGIA contact guidance with official registry and complaint resources.
- Qualify the calculator as an estimate, add the NASA POWER source, synchronize the visible card and structured metadata, and display the review date.
- Add focused regression coverage and a source-linked audit record.

## Evidence
- Audit: [HAWAII_SOLAR_SCAMS_AUDIT_2026-10-22.md](docs/jev-completion/HAWAII_SOLAR_SCAMS_AUDIT_2026-10-22.md).
- Primary references: Hawaii DCCA, FTC, and NASA POWER are linked from the audit.
- Focused test: 3/3. Full suite: 1,748/1,748.
- Local preflight passed: `npm test`, `node scripts/check-chars.mjs`, `npm run seo`, `npm run format:check`, `npm run deploy:check`, `npm run plan:check`, and `npx --yes prettier@3.9.6 --check .`.
- The audit report does not invent or substitute Jev scores; the exact-head required CI gate remains authoritative. P9.5 remains open for the other blog articles.
