# Master plan amendments

Append-only log of changes to `docs/plan/MASTER_PLAN.md` (see §16 of the
plan). Each entry chains the plan's SHA-256 from the adopted genesis hash to
the hash pinned in `docs/plan/PLAN.lock.json`; `npm run plan:check` rejects a
broken chain, a missing approver, or any rewrite of an earlier entry.

No amendments yet: the plan is at its genesis hash.

## A-001: Carry-forward from the P0.2 review, and current-state gaps

- Date: 2026-09-26
- Approved-by: @Treystu
- Plan-SHA256-before: ee27dbd42166352f4dcda832e611c9dc5c7fa4759f332a0d3a91319f18003ec6
- Plan-SHA256-after: c8271d11df9ca811036131a6b616ce305c5d0188da794eff18e1be881c9cee5a
- Sections: §9 rule 6 (P0.3 bootstrap); §7 test-retirement rule; Q-07; §6.2 Step 5; §6.4 recommended system; R-AI-02a (new); R-DS-03; F-44, F-45 (new); R-SEO-07 (new); §7 (map-provider.js); P0.3(e); P0.5; P6.1; P6.7; P8.3; P10.3; O-09 (new); §13.3; §14
- Rationale: The P0.2 carry-forward review (PR #146) found four shipped behaviours the plan did not pin. The owner approved in chat on 2026-09-26: (a) race safety for Jev/advisor requests (new R-AI-02a); (b) touch targets raised from 44 px to the 48 px already shipped; (c) muted/secondary text contrast of at least 5.5:1; (d) Simple/Technical mode kept. On the roof-drawing map the owner chose to retire roof limits entirely: the roof-space input, the roof-drawing map (`map-provider.js`, which loads Leaflet from a CDN) and the roof constraint on the recommended system are removed, and the footprint stays informational. The current-state review also found two gaps: F-44, the production domain returns HTTP 403 with a Cloudflare challenge (verified 2026-09-26; release ledger probes agree), closed by new R-SEO-07 and owner action O-09; and F-45, hand-maintained, stale live-Jev evidence (reported in PR #149), closed in P0.3(e). §13.3 now names `SCOPE_FACETS` as the scope map, requires fresh evidence, and judges a change rather than its merge state. That closes the self-judging deadlock the P0.3(c) work found. The owner's P0.3 bootstrap ruling (P0.3 exempt from the scoped ≥ 99 and all-proven rules, which bind from P0.4) is now written into §9 rule 6. F-44 records that the brand-domain CSP conflict comes from an inline challenge script that CSP cannot allow, so the fix is O-09.

## A-002: P0.6 — Jev completion-program evidence plan item

- Date: 2026-10-06
- Approved-by: @Treystu
- Plan-SHA256-before: c8271d11df9ca811036131a6b616ce305c5d0188da794eff18e1be881c9cee5a
- Plan-SHA256-after: 307738296920d7d18b741ea1ffe5e7812cb1c8637f00b6f14af10a8c734a5ac7
- Sections: P0 (new item P0.6)
- Rationale: The full-codebase Jev audit produces evidence PRs (docs/jev-completion/) that the jev-complete gate cannot scope — §9 rule 1 requires every PR title to name a plan item, and no P-item covered audit evidence, so the gate failed closed at scope resolution (seen on PR #193). The owner approved adding P0.6 in chat on 2026-10-06. Facets ["docs"] follow the P0.2 precedent (docs-only). The SCOPE_FACETS entry lands in the same change; tests/jev-scope.test.mjs enforces the plan↔scope mapping in both directions.
