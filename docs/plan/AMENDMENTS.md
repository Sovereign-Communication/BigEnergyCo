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

## A-003: P0.6 evidence ruling — the gate cannot judge audit evidence at 99

- Date: 2026-10-06
- Approved-by: @Treystu
- Plan-SHA256-before: 307738296920d7d18b741ea1ffe5e7812cb1c8637f00b6f14af10a8c734a5ac7
- Plan-SHA256-after: 6f9c8c7e7d33140fb6ec5ef36848f27d0387a5ab0501985df71dba77b20279cf
- Sections: §9 rule 6 (P0.6 evidence ruling)
- Rationale: PR #193 (docs/jev-completion/, scoped P0.6) got the scope fix but the live gate still failed: 95.5 < 99, docs facet at ordinal 85 ("solid with minor gaps") with Jev confidence 0.57. The scoped score is 0.7*mechanical + 0.3*docs, so reaching 99 needs the docs facet near 97 and proven — unreachable at Jev's confidence calibration. The owner ruled in chat on 2026-10-06, following the P0.3 bootstrap precedent (§9 rule 6, 2026-09-26): P0.6 evidence PRs merge on green CI plus an attached scoped report with no ratchet regression, even below 99. The hard gates and the ratchet bind throughout and are never relaxed. scripts/lib/jev-verdict.mjs implements the exemption (P0.6 bypasses the exit rule only).

## A-004: The gate bar is 95/95/95 (owner ruling 2026-10-19)

- Date: 2026-10-19
- Approved-by: @Treystu
- Plan-SHA256-before: 6f9c8c7e7d33140fb6ec5ef36848f27d0387a5ab0501985df71dba77b20279cf
- Plan-SHA256-after: 745332cc842baafce64b5793a4be65c728c220de7d2905f014b683a2a36efe96
- Sections: §0 rule 2, Q-01, P10.1, §13.3
- Rationale: D-03 set the bar at a combined 99 with every facet proven, and the P0.6 history (A-003) showed the binding constraint was never the average — it was Jev's confidence calibration: PR #193 scored 95.5 with the docs facet at 0.57 confidence, a shape no amount of workmanship could push to 99-proven. The owner ruled in chat on 2026-10-19: "Go 95 but require confidence and all aspects to be 95. So loosen complete to 95 but tighten the confidence to 95." The combined bar is therefore 95.0 (COMPLETE_MIN_SCORE), every facet must individually reach ordinal 95 — proven (COMPLETE_FACET_MIN_ORDINAL) — and every facet's Jev confidence must be at least 0.95 (COMPLETE_MIN_CONFIDENCE); a missing confidence counts as below the bar. The hard gates and the ratchet bind throughout and are never relaxed. The P0.3/P0.6 bootstrap exemptions are untouched. This amendment takes number A-004 because it lands before the P9.7 content-quality amendment (drafted as A-004 on its branch); that amendment renumbers to A-005 when it lands.

## A-005: Post-merge Jev release gate with main as staging

- Date: 2026-10-20
- Approved-by: @Treystu
- Plan-SHA256-before: 745332cc842baafce64b5793a4be65c728c220de7d2905f014b683a2a36efe96
- Plan-SHA256-after: 09f4a8379da73b95c97e9a3930565516d106ce61443569036488b3e1d16d3ee7
- Sections: D-03, Q-01, Section 13.2, Section 13.3
- Rationale: The owner approved amending sequencing after the pre-merge Jev judgment deadlocked on confidence. Main is the staging surface; scoped PR Jev reports remain attached and use the existing 95/95/95 bar, but are advisory. A full run on the exact merged main SHA is the blocking production-promotion gate and must pass the same score, per-facet ordinal, per-facet confidence, all-facet ratchet, and hard-gate requirements. Staging remains available for review while the release gate is red; no threshold is lowered.

## A-006: P9.7 content-quality gate and bootstrap exception

- Date: 2026-10-21
- Approved-by: @Treystu
- Plan-SHA256-before: 09f4a8379da73b95c97e9a3930565516d106ce61443569036488b3e1d16d3ee7
- Plan-SHA256-after: cfd4af76b4c4a29305a2c6d3ceae91e83ce43d22e4fa8c52f1e115a67847f59a
- Sections: P9 (new item P9.7)
- Rationale: The owner’s 2026-10-21 canonical completion directive authorizes the P9.7 content-quality gate and its bootstrap exception. PR #232 establishes the scope and quality criteria that would otherwise judge the same scaffolding change. Under Jev Gate Policy v1, #232 proceeds after claim-level investigation finds no actual risk; this exception applies to the gate-authoring PR only. All required CI, hard gates, and ratchets remain binding, and later P9.7 content changes remain subject to the new bar. The native full-main 95/95/95 release gate is unchanged. A-004 and A-005 are already present in the current amendment log, so this entry is A-006.
