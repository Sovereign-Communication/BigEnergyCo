## Plan items

P9.5 — partial audit of the battery cycle-life article. This PR is one scoped slice; P9.5 remains open.

## What changed and why

- Rewrote the article title, summary, opening, and sections 1–2 to explain how to compare cycle-life ratings without presenting cycle count as a universal life guarantee.
- Aligned the visible blog card and BlogPosting metadata.
- Added a regression test for the audited claim boundaries and metadata parity.
- Grounded the revised claims in the Sandia/OSTI commercial-cell study and made its limits explicit.

Sections 3–9 and the sodium-ion, AGM, and long-horizon FAQs still require audit, as do the other 12 articles. This PR does not claim P9.5 completion.

## Definition of done (plan §9)

- [x] Tests added/updated for this change; coverage not lowered.
- [x] Local preflight: npm test (1,727/1,727), node scripts/check-chars.mjs, npm run seo, npm run format:check, npm run deploy:check, and npm run plan:check all pass on the rebased tree.
- [ ] No metric regressed vs the latest ledger baseline; scoped Jev assessment is pending.
- [ ] Scoped live Jev report attached after this PR's ledger row is appended.
- [ ] Append a partial P9.5 ledger row with this PR number and exact SHA.
- [ ] No release/deployment in this PR. Preview/production release gates remain for the unified mission.
- [ ] Update the master-plan tracker after the final P9.5 audit is complete.