# Prod state + Google-bar audit — 2026-10-13

Scope: verify what production actually serves after the "muse lane" hurricane
post, find every aspect still below the plan's quality bar, cross-reference the
recent Jev audit work, and state which gaps the canonical plan already covers
versus which need an amendment.

Read-only. Nothing here is committed, and `docs/plan/**` was not touched.

---

## A. Current production state (verified in a real browser, 2026-10-13)

Prod = `freeoffgridcalculator.com` (behind Cloudflare's managed challenge for
non-browser clients) and `bigenergyco.pages.dev`. Staging = gh-pages.

| Surface                     | Prod          | `origin/main` (0454e74) | This branch (`docs/ledger-p1-3`, 5d002fd) |
| --------------------------- | ------------- | ----------------------- | ----------------------------------------- |
| `assets/site.css?v=`        | `20261005h`   | `20261005h`             | `20261012a`                               |
| `sw.js CACHE_VERSION`       | `beco-v108`   | `beco-v108`             | `beco-v109`                               |
| `sitemap.xml` `<loc>` count | 82            | 82                      | 81                                        |
| `rss.xml` `<item>` count    | 11            | 11                      | 10                                        |
| blog pages (hub + posts)    | 12            | 12                      | 11                                        |
| hurricane post served       | yes, HTTP 200 | yes                     | absent                                    |

**Verdict: production matches `origin/main`.** The new post is live, canonical
(`…/blog/hawaii-2026-hurricane-season-backup-power/`), has valid `Article` +
`BreadcrumbList` + `FAQPage` JSON-LD, a unique title (43 chars) and description,
`og:image`, one `h1`, and every internal link returns 200. It is in the sitemap
(82 locs, all with `<lastmod>`, the post at `2026-10-12`), in `rss.xml` (newest
first), `llms.txt`, the blog hub card list, and the deploy allowlist
(`scripts/lib/deploy-manifest.mjs`).

**Local branch note:** `docs/ledger-p1-3` is **59 commits behind main** (1 commit
ahead: the unmerged evidence stamp refresh to `20261012a`/`beco-v109`). Its
sitemap/rss/blog counts are therefore stale, not a prod defect.

### How the post shipped

It used the PR path, so AGENTS.md §1 was honored:

- **PR #209** (merged 2026-10-13T18:53Z, squash → `2f73a06`): carried **only
  `blog/SEO-DOCTRINE.md`** (1 file, +52). The post body was lost in that merge.
- **PR #213** (merged 2026-10-13T21:08Z → `b1dc77a`): "re-land Hawaii 2026
  hurricane post + unified blog headers" — 18 files, +1353/−89: the post,
  12-page header unification, `llms.txt`/`sitemap.xml`/`rss.xml` parity, allowlist.
- **PR #214** (merged 2026-10-13T22:13Z → `0454e74`): adds
  `.github/workflows/cf-pages-deploy.yml` — a **manual `workflow_dispatch`** that
  builds `_pages` via `deploy-pages-local.mjs --check --stage _pages` and runs
  `wrangler pages deploy _pages --project-name=bigenergyco --branch=main`.

---

## B. Aspects below the Google bar (all verified live)

### B1. Content truth and substance — the sharpest exposures

1. **Live, wrong battery prices on the DIY post.** The page states, verbatim
   (byte-identical in `origin/main` and on `bigenergyco.pages.dev`): "you might
   see prices ranging from **$800 to $1,200 per kWh** depending on brand prestige
   and features" and "a DIY build using Grade A cells can often achieve a cost
   per kWh of **$300 to $500**, excluding labor and enclosure costs." Open
   **PR #212** states the real 2026 bands are `$110–165/kWh` retail and
   `$80–125/kWh` DIY. The internal contradiction is verifiable without relying on
   that PR: the calculator's own registry holds
   `battPerKwhUsable: [110, 165]` with hardware rows at `perKwh: 111, 117, 130,
207` ([assets/js/sizing/pricing.js:28-43](assets/js/sizing/pricing.js#L28-L43)).
   So the post quotes **$800–1,200** and **$300–500** against an engine that says
   **$110–165**: roughly 3–10× apart, in shipped copy, on a page Google is
   crawling. Truth defect under Q-10/D-05 culture, live on production.
2. **Duplicate content between two live posts.** Measured on prod:
   `off-grid-vs-grid-tie-payback` vs `how-to-cut-electricity-bill-with-solar`
   share **68.9%** of their 5+ character vocabulary (Jaccard). PR #212 reports the
   long-form section similarity at 93.6%. This is the cannibalization the new
   doctrine itself warns about (Gate 5).
3. **No citations anywhere in the blog.** Zero external `href`s across the
   hurricane post and the three pages PR #212 touches. Concrete numeric claims
   (HECO `$400/kW` + `$400/kW` LMI adder, "92% of Kaua'i", "2–4 kWh/day",
   "1.5–2 kW with 5 kWh") carry no source, grade or date — and "HECO" is named
   **13 times**. Q-10 demands displayed assumptions resolve to a registry entry
   with source/grade/date; R-CONT-05 asks the blog be audited "against … sources".
   Neither is satisfied, and nothing gates it.
4. **Thin by its own standard.** The hurricane post is ~575 words. The doctrine
   it introduced (below) exists precisely to avoid thin content.
5. **No "last reviewed" date on any post.** 0 hits across all blog pages.
   R-CONT-05 explicitly requires "each post shows 'last reviewed'". Unimplemented
   and unenforced.

### B2. SEO / technical

6. **Stale sitemap `<lastmod>` on the blog hub.** Prod's `/blog/` entry reads
   `2026-08-30` although the hub was rewritten on 2026-10-12 (the post's own entry
   is correct). `check-seo` only requires a `<lastmod>` to exist and be ≤366 days
   old, so it passes. Gate gap, not a data-entry slip.
7. **F-44 is still open.** The brand domain still answers non-browser clients with
   the Cloudflare interstitial (re-verified today). Per the plan this blocks the
   `release` facet and program exit, and makes Q-17 (Search Console indexing) and
   the release-ledger probe unverifiable.
8. **FAQPage markup is decorative.** Google restricted FAQ rich results in
   Aug 2023 to authoritative gov/health sites. The markup is valid, so it is not a
   structured-data _error_, but R-SEO-02/Q-17 have no position on it.

### B3. Gate integrity — two ceilings were raised in the blog commit

Both are in `b1dc77a`, and both move enforcement in the wrong direction:

9. **`scripts/check-i18n.mjs`: `PROSE_CEILING` 51 → 422.** Cause: unifying headers
   added `data-i18n` hooks to nav on 12 blog pages, so the detector now treats
   those pages as "translated" and flags 371 English-only article bodies. The
   right fix is to **scope the detector** (a blog article body is not a translated
   UI string), not to lift a global ceiling by 371 — as written, the main page may
   now carry 371 more un-hooked prose blocks without failing.
10. **`scripts/check-quality.mjs`: `inlineStyleAttributes` ratchet 574 → 633**
    (+59) because header unification copied the main header's inline styles onto
    11 blog pages. That is the opposite of Q-09 ("0 raw colour, spacing or font
    values outside the token file") and of F-27 / R-DS-05 ("no per-page inline
    style systems"). The blog hub still ships with no external stylesheet at all.

### B4. Release and ledger integrity

11. **Release ledger is behind prod.** `docs/release-ledger.jsonl` (main) ends at
    `2026-10-02`, stamp `20261002a`. Prod serves `20261005h` **plus** the Oct 12
    post. The new CF Pages workflow writes no ledger row.
12. **Plan ledger is behind the work.** `docs/plan/LEDGER.jsonl` (main) ends at
    `2026-10-06` (P1.3), 61 rows. Nothing records P0.6 (merged 2026-10-08), the
    blog lane (2026-10-13), or the CI changes. §9 rule 7 requires an `item-done`
    row per PR.
13. **Stale claim inside the evidence record.** `evidence/advisor-and-release.json`
    on main still says "PRODUCTION IS BEHIND THIS TREE … deployed build is at
    servedStamp 20260925c and this tree ships 20261005c". Prod is at `20261005h`.
    `check-evidence-freshness.mjs` checks the `seo_summary` stamp/cache but not this
    field, so an untrue statement survives in the record.

---

## C. The recent Jev audit work, and the current bar

- **Program state** (`.jev-p04c-report.json`): 88.43 / 99, **19 facets not
  proven**. Latest scoped run (`jev-artifacts/_last/jev-report.json`, scope P1.3):
  **95.29 / 99**, 17 not proven, with `translation` **35**, `performance` **60**,
  and every other facet at **85** except `seo`, `docs`, `testing`, `usecases`
  (100). Hard gates all green.
- **A-003 ruling:** P0.6 evidence PRs are permitted to merge below 99 because the
  judge's confidence calibration cannot read audit docs as `proven` (docs facet 85
  @ conf 0.57). The hard gates and ratchet are never relaxed.
- **P0.6 completion-program audit** (`docs/jev-completion/`, PR #193):
  1,986 functions × 21 questions; 760 prescription judgments at confidence
  0.39–0.66 (the 0.95 gate is unreachable and fit-argmax agrees only 4% — it is a
  "ranked suspect list, not work orders"); 649 context-needs; batteries report
  **136 input-not-validated**, **121 fail-open**, 51 must-fix, 4 confirmed broken
  wiring, 4 AMBIGUOUS concurrency findings.
- **2026-10-13 Jev UX audit** (open **PR #215**, 90 files, BLOCKED): P0-1 Simple
  mode default, P0-2 defer install prompt, P0-3 example prefill; P1-1 heatmap
  noscript/WebGL fallback, P1-2 blog level tags, P1-4 city yield context; P2 FAQ
  5→8. Note it raises `PROSE_CEILING` again (422 → 426).
- **Other open, blocked PRs:** #217 (heatmap 6.66 MB JSON → 4.72 MB + lazy load =
  F-33 / R-PERF-04), #212 (blog SEO remediation), #210 (this branch), #206
  (Blacksmith pilot), #204/#205 (Dependabot).

---

## D. Canonical coverage vs what must be amended

### D1. Already in canonical (execution, no amendment)

The plan on main owns 45 findings (F-01..F-45), 89 requirement IDs, and phases
P0–P11. Everything in §B1–B2 above maps onto an existing item:

- B1.1/1.2 → F-08/R-DATA-05 (price sources), R-CONT-05, `P9.5` blog audit.
- B1.5 → R-CONT-05 ("each post shows 'last reviewed'").
- B2.6 → Q-17, R-SEO-04 (sitemap).
- B2.7 → **F-44**, R-SEO-07, O-09 (blocks `release` + program exit).
- B2.8 → R-SEO-02.
- Heatmap perf → F-33, R-PERF-04, §3.1 budget (300 KB).
- Flow/desktop/a11y findings the UX PR touches → F-18..F-30.
- Program exit → Q-01 full, P10.1–P10.4.

### D2. Not covered by canonical — amendments required

| #        | Gap                                                                                                                                                                                                                                                                                                             | Why it needs an amendment                                                                                                                                                                                       |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A-01** | `blog/SEO-DOCTRINE.md` is a new **"standing lane policy … mandatory, not aspirational"** living outside the hash-pinned plan.                                                                                                                                                                                   | AGENTS.md §0 says the plan supersedes every other plan/roadmap document. Today the binding content bar is an unmanaged file. Fold into the plan as `R-CONT-06` (blog content bar) or explicitly subordinate it. |
| **A-02** | **AGENTS.md declares D-21 / R-CF-01..10 "written down here and in the master plan"**, but the plan on main contains **0** occurrences of `D-21` and `R-CF-0`, and **0** of `Q-19`. The staged text at `docs/contest/AMENDMENT-A-003.md` is a _second_ A-003 — the number already landed (P0.6 evidence ruling). | The two governing documents disagree today, which is exactly what the AGENTS.md carve-out claims they don't. Land the platform-surface amendment (renumbered **A-004**) or stop asserting the plan contains it. |
| **A-03** | **Blog figures have no provenance path.** Q-10 covers "displayed assumptions"; R-CONT-05 says "audited against … sources" but neither requires an on-page citation nor a substance floor.                                                                                                                       | The post names HECO and its rates with zero citations, legally. Needs: blog figures resolve to the provenance registry (or carry a citation block) + a thin-content floor.                                      |
| **A-04** | **"Last reviewed" is stated but has no gate and no implementation** (0/11 posts).                                                                                                                                                                                                                               | R-CONT-05 needs an enforceable form (visible, parseable date) and a check, or it will stay aspirational.                                                                                                        |
| **A-05** | **Prod-equals-tree parity is not gated.** The plan has promote/verify (§9 rule 8, P8.4) and the release ledger, but nothing requires the ledger to track every prod deploy, and the new CF Pages workflow bypasses it (B4.11–12).                                                                               | Add: any prod deploy writes a release-ledger row, and a scheduled probe fails when prod's content set ≠ main's deployable set.                                                                                  |
| **A-06** | **Sitemap `<lastmod>` freshness is not gated** (B2.6).                                                                                                                                                                                                                                                          | Extend `check-seo`: `lastmod` must be ≥ the page's git commit date.                                                                                                                                             |
| **A-07** | **FAQPage / rich-result eligibility has no position** (B2.8).                                                                                                                                                                                                                                                   | Add a decision + requirement, or state FAQPage is retained for non-rich-result reasons.                                                                                                                         |
| **A-08** | **D-05 does not enumerate utilities or incentive programs.** The post names HECO + "BYOD Plus" rates 13×.                                                                                                                                                                                                       | Clarify D-05: utilities/incentive programs may be named only with a citation, or not at all.                                                                                                                    |
| **A-09** | **Nothing forbids raising a gate ceiling to absorb content** (B3). §3.1 allows byte-budget relaxation only by measured amendment; the same discipline is absent for the i18n prose ceiling and the inline-style ratchet.                                                                                        | Add a rule: a ceiling/ratchet may not be raised to make content pass; fix the scope or the content.                                                                                                             |
| **A-10** | **Sequencing.** §4's baseline says "10 blog posts"; P9.5 puts the blog audit at P9, but blog content is shipping now (11+ posts, more in open PRs).                                                                                                                                                             | Acknowledge the blog lane moved ahead of P9.5, or fold the doctrine in as the interim governing bar.                                                                                                            |

---

## E. Comprehensive remaining work

**Truth and safety on the live site**

1. Fix the two ~10×-wrong battery prices (`$800–1,200/kWh` prebuilt and
   `$300–500/kWh` DIY) on the DIY post (PR #212) and land it.
2. Add citations to the blog's numeric claims; reconcile HECO figures with a source (A-03).
3. Add "last reviewed" to every post (A-04 / R-CONT-05).

**Content / Google bar** 4. De-duplicate the off-grid ↔ bill-cut pair (PR #212, 68.9% overlap measured). 5. Enforce sitemap/llms/RSS/hub/allowlist parity and real `lastmod` (A-06). 6. Decide FAQPage policy (A-07). 7. Fold `SEO-DOCTRINE.md` into canonical (A-01, A-10).

**Performance / accessibility / UX** 8. Heatmap payload + lazy load (PR #217 → F-33, R-PERF-04, 300 KB budget). 9. Jev UX P0/P1 remediation (PR #215), including the heatmap noscript/WebGL hole. 10. Close the remaining JEV facets below 99: `translation` (35), `performance`
(60), and the 15 facets at 85 — the plan's P3–P8 work. 11. Restore the i18n prose detector and the inline-style ratchet rather than the
raised ceilings (B3).

**Governance / canonical** 12. Amend the plan (A-01…A-10). 13. Land the platform-surface amendment as A-004 (A-02); reconcile AGENTS.md. 14. Backfill the plan ledger for P0.6 + the blog lane (§9 rule 7). 15. Make prod deploys write the release ledger and add the prod-parity probe (A-05). 16. Fix the stale `smoke_note` claim on main (B4.13).

**Program-exit blockers** 17. F-44 / O-09 — stop the Cloudflare challenge for crawlers (blocks `release`). 18. O-01 — `TYPESAFE_API_KEY` so `jev-complete` can run live and become required. 19. Q-01 full: every facet `proven`, overall ≥ 99 (P10.1) — the whole P1–P11 arc.

---

## F. Limitations of this audit

- I did not read Search Console (no access), so Q-17 indexing claims are
  unverified here.
- I did not run Lighthouse/axe on production; Q-02/Q-07 status is taken from the
  plan's phases, not re-measured.
- I did not verify whether the Cloudflare Pages project also has a Git integration
  in addition to the manual workflow; only the workflow file was inspected.
- The JEV numbers above are from the newest local reports (2026-10-05/10-06) plus
  the P0.6 docs; no live JEV run was made (no `TYPESAFE_API_KEY`).
- Uncommitted working-tree changes I did **not** make and did **not** touch:
  `.github/workflows/test.yml` (Blacksmith pilot), `scripts/verify-staging.mjs`,
  `robots.txt`.
