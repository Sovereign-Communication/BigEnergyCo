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

## A-002: the scoped exit composes with §3.2, and the showcase carve-out is recorded

- Date: 2026-10-06
- Approved-by: @Treystu
- Plan-SHA256-before: c8271d11df9ca811036131a6b616ce305c5d0188da794eff18e1be881c9cee5a
- Plan-SHA256-after: da9d4095c2deccfb9783ba9f82ea8f11d7cfa351b96597e9b8741681d956d9bc
- Sections: §5 (D-21, new); §6.16 (R-CF-01..10, new); §3.2 (Projection); §9 rule 6; P0.6 (new)
- Rationale: Two corrections the owner approved in chat on 2026-10-06. Both are cases of a governing document asserting something the plan did not contain.
  1. **The scoped exit rule contradicted the enforcement schedule.** §3.2 phases every measurement gate — regression-blocking first, absolute from a named phase — while §9 rule 6 binds the scoped ≥ 99 / all-proven rule from P0.4. The Jev `performance` and `accessibility` facets are _derived_ from the Lighthouse report and the §3.1 budgets, so requiring them at `proven` at P0.4 made Q-02 and the byte budgets absolute five phases early, which is the opposite of §3.2 and of P0.4's own row ("measurement gates (**ratchet mode**)"). The new §3.2 Projection clause states how the rows compose: a facet that projects a gate still in regression-only mode is held to the ratchet and is not required at `proven`, and the ≥ 99 scoped threshold is computed over the facets whose gates are absolute at that item's phase. Nothing about the bar moved — the 99 threshold, the facet ordinals, the rubric and `COMPLETE_FACET_CLIP` are unchanged — and only _when_ a projected facet is required at `proven` changes, and only to the phase §3.2 already named. The ratchet still binds every facet, in and out of scope, exactly as before.
  2. **AGENTS.md asserted a carve-out the plan did not contain.** AGENTS.md §3 says the D-21 showcase exception "is written down here and in the master plan (D-21, R-CF-01..10) so both governing documents agree". The plan defined D-01..D-20 only, named no R-CF requirement, and contained no item for the showcase surface or for a record that depends on it — which is why the Cold Start lane had no plan item to name and could not satisfy §9 rule 1. D-21, §6.16's ten requirements and item P0.6 are now recorded, so the two governing documents agree and a filing or record for that surface has an item to name. P0.6 governs the surface; it does not re-open the contest, whose entry period closed 2026-10-02.
  3. **Preamble correction.** The line above A-001 — "No amendments yet: the plan is at its genesis hash." — was true when written and cannot be removed: this file is append-only and `npm run plan:check` enforces that as a prefix (`isAppendOnly`). It is superseded by this entry: the plan has not been at its genesis hash since 2026-09-26, and `PLAN.lock.json` now pins `current_sha256` to A-002's after-hash. A future reader should treat that sentence as the historical note it is, not as the current state.
