## Summary
- Localize chart reader-visible copy across English, Spanish, Portuguese, French, German, and Arabic.
- Correct the battery state-of-charge usable-window captions to match the sizing model: LFP 20–100%, sodium-ion 15–100%, and AGM 50–100%, with localized regression coverage.
- Make PR Jev evidence visible/advisory so the approved staging sequencing can proceed; require a successful full Jev run for the exact main SHA before forward production promotion.
- Record owner-approved staging/release sequencing in the plan while retaining the 95/95/95 gates.

## Validation
- `npm test`: 1,698 passed, 0 failed.
- `npm run format:check`, focused chart/regression tests, i18n and character checks, evidence freshness, plan-pin validation, `npm run deploy:check`, and `npm run seo`: passed.
- Native-speaker review and Chrome DevTools trace were unavailable; translation changes were checked against the sizing source and rendered six-locale regression. Full main Jev and CI Lighthouse remain the live verification for staging.

This PR does not deploy to production.
