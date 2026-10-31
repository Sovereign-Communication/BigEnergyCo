## Plan items

P9.5 — partial audit of the battery cycle-life article. This chemistry-specific slice is stacked on PR #262; P9.5 remains open.

## What changed and why

- Replaced the LFP, sodium-ion, and AGM sections that asserted universal cycle-life numbers, zero-volt discharge safety, calendar-life ceilings, and guaranteed replacement schedules.
- Added product-specific comparison guidance. It cites the Sandia/OSTI commercial lithium-ion study and Discover's AGM performance sheet, including their stated limits.
- Added a regression test for the claims and source links.

The article's worked-cost example, configuration checklist, remaining FAQs, citations list, and the other 12 posts still require audit. This PR does not claim P9.5 completion.

## Definition of done (plan §9)

- [x] Tests added/updated for this slice; full suite passes at 1,728/1,728.
- [x] Local preflight: node scripts/check-chars.mjs, npm run seo, npm run format:check, npm run deploy:check, and npm run plan:check all pass.
- [ ] No metric regressed vs the latest baseline; scoped Jev assessment is pending.
- [ ] Scoped live Jev report attached after this PR's ledger row is appended.
- [ ] Append a partial P9.5 ledger row with the PR number and exact SHA.
- [ ] No release/deployment in this PR.
- [ ] Update the master-plan tracker after the final P9.5 audit is complete.