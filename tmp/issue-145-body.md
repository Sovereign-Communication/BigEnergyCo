This is the live checklist for [`docs/plan/MASTER_PLAN.md`](https://github.com/Sovereign-Communication/BigEnergyCo/blob/main/docs/plan/MASTER_PLAN.md), adopted by Sovereign-Communication/BigEnergyCo#144. Evidence goes in `docs/plan/LEDGER.jsonl`, and every phase PR links this issue and follows plan §9. Owner action O-03 complete: this issue was pinned on 2026-10-19.

**Order rules:** P0.1 and P0.2 are exempt from the Jev report. All five P0.3 sub-PRs, (a) through (e), must merge before any P1 or later PR (plan §9 rule 6).

**Amendment A-001** (landed 2026-09-26 — `docs/plan/AMENDMENTS.md` A-001, `docs/plan/PLAN.lock.json` `current_sha256` = A-001 `Plan-SHA256-after`) adds R-AI-02a, R-SEO-07, F-44, F-45 and O-09, and retires roof limits.
**Amendment A-002** (landed 2026-10-06) adds P0.6, the full-codebase Jev completion-program evidence work. **Amendment A-003** (landed 2026-10-06) records the P0.6 evidence ruling. Both are canonical in docs/plan/AMENDMENTS.md; neither adds a Cloudflare D-21 or R-CF requirement.

### P0: Governance, baseline and gates
- [x] P0.1 Adopt the plan (Sovereign-Communication/BigEnergyCo#144)
- [x] P0.2 Archive legacy docs and do the carry-forward review (Sovereign-Communication/BigEnergyCo#146), leading to amendment A-001
- [x] P0.3a Jev price constant 0.00042 (Sovereign-Communication/BigEnergyCo#147)
- [x] P0.3b Remove the second Jev provider (Sovereign-Communication/BigEnergyCo#148)
- [x] P0.3c Target 99, all-proven exit, `--scope` (#149, merged 2026-09-28; ledger `P0.3c` item-done rows)
- [x] P0.3d New pack facets (#151, merged 2026-09-28; ledger `P0.3d` item-done row)
- [x] P0.3e CI-generated evidence (F-45) plus the `jev-complete` CI job (#152, merged 2026-09-28; ledger `P0.3e` gate-run row)
- [x] P0.4 Measurement gates (quality-lab, Lighthouse, axe, cross-browser, budgets, visual) — ledger item-done recorded 2026-10-05.
- [ ] P0.5 Owner setup — O-01 complete (GitHub Actions and production Worker secrets confirmed; `jev-complete` is now a required main-protection check). The current P9.5 Jev result is a technical gate failure at 97.75/100, not a missing-secret blocker. O-02 Web Analytics open · O-03 issue pin complete · O-04 Search Console open · O-05 Code Owner review open pending owner decision · O-09 Cloudflare challenge open.
- [ ] P0.6 Completion-program evidence: full-codebase Jev prescriptions, verdicts, queue issues and green-only merge train (live CI is now unblocked by credentials).

### P1: Live truth fixes
- [ ] P1.1 Remove the ×10/×5 turnkey multiplier · [ ] P1.2 Region-scaled electrician labour · [x] P1.3 Round coordinates (#188, merged 2026-10-06; ledger `P1.3` item-done row) · [ ] P1.4 Stale-FX notice · [ ] P1.5 Heatmap self-hosted and guarded · [ ] P1.6 Assumption disclosures

### P2: Registry and provenance
- [ ] P2.1 · [ ] P2.2 · [ ] P2.3 (per-region queue) · [ ] P2.4 · [ ] P2.5 · [ ] P2.6 · [ ] P2.7

### P3: Economics engine
- [ ] P3.1 · [ ] P3.2 · [ ] P3.3 · [ ] P3.4 · [ ] P3.5 · [ ] P3.6 · [ ] P3.7 · [ ] P3.8

### P4: Use-case engines
- [ ] P4.1 · [ ] P4.2 · [ ] P4.3 · [ ] P4.4 · [ ] P4.5 · [ ] P4.6

### P5: Design system, shell and i18n infrastructure
- [ ] P5.1 · [ ] P5.2 · [ ] P5.3 · [ ] P5.4 · [x] P5.5

### P6: New app at `/next/`
- [ ] P6.1 · [ ] P6.2 · [ ] P6.3 · [ ] P6.4 · [ ] P6.5 · [ ] P6.6 · [ ] P6.7 · [ ] P6.8 · [ ] P6.9

### P7: Advisor 2.0
- [ ] P7.1 · [ ] P7.2 · [ ] P7.3 · [ ] P7.4

### P8: Swap
- [ ] P8.1 · [ ] P8.2 · [ ] P8.3 · [ ] P8.4 · [ ] P8.5

### P9: Reach
- [ ] P9.1 · [ ] P9.2 · [ ] P9.3 · [ ] P9.4 · [ ] P9.5 · [ ] P9.6

### P10: Exit gate
- [ ] P10.1 · [ ] P10.2 · [ ] P10.3 (F-01..F-45) · [ ] P10.4

### P11: Continuous
- [ ] P11.1 · [ ] P11.2 · [ ] P11.3 · [ ] P11.4

### Canonical plan status — 2026-10-24

Main is pinned to amendment A-007 (`e89ebe0bbbe99cefbc3b547902457e2d196f71d81b27ce0e36ce00ea023b6609`, verified in `docs/plan/PLAN.lock.json`). PR #232 merged on 2026-10-22; A-004 (the full program-exit bar), A-005, A-006 (P9.7), and A-007 (B1 staging policy) are canonical. The P9.7 checklist below tracks A-006.

### Completion-lane status — 2026-10-24

- **Main / Jev:** `eabb378c`, run `40106777172`, score 96.64; all 7 hard gates green and `blocking_facets` empty. The B1 staging gate is red only because translation is ordinal 60 against the 85 floor (confidence 0.67). Resilience is not a blocker on this run; re-read it on each main run.
- **Policy:** A-007's owner-approved B1 staging rule applies. P10/P11 keep the full 95/100/0.95 program-exit verdict. No threshold is changed by this status update.
- **Recent landings:** #304 city-search listener cleanup; #305 B1/A-007; #310 defer translation-suggestion loader; #311 top-10 fail-closed dispositions; #312 wiring dispositions; #313 byte-budget ENOENT race.
- **Staging:** workflow run `40130276552` built main `eabb378c` and deployed to `https://staging.bigenergyco.pages.dev`. The alias returns the current asset stamp `20261024p`, page and sitemap both return 200, the calculator renders, and browser console/network logs are clean. The root `https://bigenergyco.pages.dev` still serves stamp `20261016l` / `beco-v120` and its older sitemap.
- **Production:** `https://freeoffgridcalculator.com/` and `/sitemap.xml` both return Cloudflare 403 (Ray `a4fbbfa80b58c41e-HNL`), matching open owner action O-09. No production dispatch was run. Cloudflare Pages maps the production branch to the project root `*.pages.dev` URL and custom domains; non-production branches receive branch aliases (see [Preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/)).
- **Open work:** #287 still needs fluent meaning-review evidence for all 436 keys in es/pt/fr/de/nl/ar. The packet tied to `eabb378c` has all 436 keys per locale marked `UNREVIEWED`, with all six signoff rows blank, so it supplies no review evidence. #197 current-main investigation found no unsafe fail-open in the exercised paths (79 focused checks passed), but its historical `battery_security` source and dispositions remain unavailable. #201’s six integration items and six named unit candidates were handled by #302; the remaining ~196 historical identities were not recovered from the issue, PR #193, reachable history, or workflow artifacts. Both battery issues remain open pending publication of original battery data or an authorized rerun; #201 also has the recorded owner option to accept the 248-name derived queue. #314 remains gated on main Jev green; #200 and #202 are closed completed.

### P9.7 burndown — A-006 (PR #232 merged)

- [ ] **Scope and routing:** `(P9.7)` resolves to the correct facets; public content pages and governed user-facing sources activate content criteria; internal, template, generated, and 404 files do not get judged as published copy. Infrastructure-only changes are judged against the gate and its representative fixture.
- [ ] **Complete candidate evidence:** use the A-006's R-CONT-01..05 requirements and actual diff; carry a full base snapshot for deletions and full head snapshot for every changed governed file; missing or truncated content evidence fails closed; redact credential-shaped data before transport.
- [ ] **Canonical structure:** shared inline style blocks are byte-identical across posts; header, footer, and CTA structure is uniform; title/H1 alignment and metadata/JSON-LD parity hold.
- [ ] **Search intent and technical SEO:** each URL has distinct, evidence-backed search intent; sitemap and structured data validate; no cannibalization; E-E-A-T/source/date surfaces meet R-SEO-05.
- [ ] **Claims and sourcing:** claims are verifiable and cited; news hooks use official sources; stale figures are fixed or removed and posts show a current review date.
- [ ] **Voice, terminology, safety, and numbers:** R-CONT-01..04 hold (plain second-person language, English reading grade ≤ 8, no hype/fear/sales language); every technical term is explained; display precision follows the 2–3 significant-figure and currency/percentage rules; legal and DIY safety language matches R-CONT-04/R-RES-07.
- [ ] **Exact-snapshot gates:** freeze one candidate snapshot; run the required release checks with CI-pinned Node 22, including full tests, plan/diff checks, formatting, secret scan, browser gates, and per-job evidence generation. The evidence builder must accept genuine artifacts from that snapshot.
- [ ] **Live judgment:** make one fresh TypeSafe Jev judgment against that exact snapshot. Require score ≥ 99, full plan-stage confidence, all hard gates green, and zero ratchet regressions. Do not retry a judgment or lower the threshold; record any failed facet as remaining work.
- [ ] **Post-merge verification:** browser-verify the shipped implementation against the same P9.7 criteria and record the result in the ledger; do not claim this complete before merge and live verification.

### Linked PR sequence and current blockers (reviewed 2026-10-18)

- #215 is owner-cleared after its rebase; current standard checks pass and `jev-complete` remains red. No merge was made here.
- #230 remains blocked by `test`: its latest comment identifies the locale-count assertion in `tests/fuel-units.test.mjs` that must include `nl`; then it must rebase after #215.
- #231 remains blocked by `test` and depends on #230. Its title must include `(P9.7)` after #232 lands; merge follows #230.
- #232 remains open with `jev-complete` red. Its other current required checks pass. The exact updated candidate still needs the full evidence and fresh ≥99 judgment above before any merge decision.
## P9.7 exact-snapshot burndown (2026-10-18)

- **Merged implementation:** PR #232 merged on 2026-10-22 (merge commit `f8cf63c5487f005dca34cc7f2b71d6276f3be664`); the A-006 checklist below remains active until its own release evidence is complete.
- **Direction review:** rechecked comments/reviews across all 13 open issues and 12 open PRs (44 discussion entries). The stated sequence remains #215 -> #230 -> #231; #230 still needs the nl locale expectation fixed, #231 depends on #230 and needs (P9.7) in its title after #232 lands, and #232 still requires a green exact-snapshot Jev gate. The full open-thread review found no direction that changes A-004 scope.
- **P9.7 and planning checks:** focused scope tests 11/11 pass; A-004 plan pin, diff check, formatting (734 tracked files), SEO, secret scan, deploy allowlist, and cumulative-flow checks pass. The plan lock/hash remains unchanged.
- **Release jobs on this snapshot:** quality-lab, lighthouse, quality-evidence, and coverage pass. The first web-smoke run recorded 168/169; a standalone rerun against the same snapshot passed 169/169. npm test recorded 1,699/1,701. Its deploy-blob test fails on this Windows checkout because staged LF bytes are compared with CRLF working-tree bytes; the same failure reproduces on the base snapshot and the relevant deploy test/code files are unchanged. The other full-suite failure, the privacy-browser verdict marker, passed when rerun on the candidate; the base also passed it. No gate or rubric was weakened.
- **Evidence and Jev:** the evidence builder rejected the measured run because the test and first web-smoke jobs concluded failure. No live Jev judgment was submitted. The 99-point threshold and ratchet remain unchanged.

### Remaining burndown

1. Run the full required suite and release jobs for this exact tree on CI's pinned Linux/Node 22 environment (or an approved equivalent), retaining per-job artifacts tied to this tree. The current Windows host has no WSL or Docker; the configured Oracle Run Command route is unavailable for this image.
2. Run the evidence builder on those genuine exact-tree job artifacts. It must accept them before any live Jev call.
3. If accepted, run one fresh Jev judgment at the existing 99 bar, with full plan-stage confidence and zero ratchet regressions. If rejected or below bar, record the failing facet and fix only that facet before a new fixed snapshot.
4. After the required checks and Jev pass, continue the reviewed merge sequence and perform the specified post-merge browser verification before marking P9.7 complete.
