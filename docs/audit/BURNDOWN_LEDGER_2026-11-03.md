# Burndown ledger — 2026-11-03 (completion burndown mission)

Live GitHub is the source. Everything below was re-queried this session; nothing
is carried from memory. Where a prior record's claim was checked, the check is
named.

**Snapshot at enumeration**

| surface           | value                                                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `main`            | `029235319` (after landing #336 this session; was `34b4c77e`)                                                                 |
| `lane/finish`     | `27cba50e3`                                                                                                                   |
| open PRs          | 4 → #336 (landed this session), #331 (closed this session), #330 (standing draft), #321 (cured: branch-forwarded, CI running) |
| open issues       | 3 → #145 (tracker), #328 (owner), #332 (closed this session)                                                                  |
| live remote heads | 165                                                                                                                           |

**Classes.** CURABLE NOW = code/text/tests/evidence/dispatch in this lane's scope.
EVIDENCE ONLY = work exists, the record that closes it does not; the record is
named. OWNER-RESERVED = the ledger list (Cloudflare change, temp purge approval,
site-frame call, protocol acts) plus the owner-physical attribute halves.

---

## A. Open pull requests

| id  | item                        | verified state                                                                                                                                                                                                             | class                             | evidence handle                                                   | next action                                                                           |
| --- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| A1  | #336 deps bump              | **LANDED** `02923531` (squash). Latest check-run per name on head `0460ccae`: 9/9 success, `jev-complete` at 2026-11-03T11:10:59Z                                                                                          | done                              | `gh api .../commits/0460ccae/check-runs`; merge commit `02923531` | none                                                                                  |
| A2  | #331 preservation-only P9.5 | **CLOSED as dispositioned.** Ref `mission/p95-offgrid-gridtie-20261023` = PR head `c4b890f7`; 4 of 5 files blob-identical to `main`, the fifth a strict superset (title fix); #324 merge `342fafd8` is an ancestor of main | done                              | this PR's disposition comment                                     | none — branch retained                                                                |
| A3  | #330 standing draft         | open, `lane/finish`                                                                                                                                                                                                        | n/a (vehicle)                     | —                                                                 | mirrors this ledger                                                                   |
| A4  | #321 oversize callouts      | **CURED — branch-forwarded** to `5ed9e5a27`; all 20 conflicts were version-stamp lines; re-prove caught and fixed the pre-#322 `setGoal` writer. MERGEABLE                                                                 | CURABLE NOW (CI evidence pending) | run `41739863010`; comment on #321                                | read the scoped `jev-complete` verdict; land on green, record the parked facet if not |

## B. Open issues

| id  | item                     | verified state                                                                                                                                   | class          | evidence handle                                         | next action                                                        |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | ------------------------------------------------------- | ------------------------------------------------------------------ |
| B1  | #145 tracker             | live checklist; **P1.1/P1.2 boxes still unticked and no LEDGER rows** although P1.2's implementation is on `main` and P1.1's is on `lane/finish` | EVIDENCE ONLY  | `docs/plan/LEDGER.jsonl` (122 rows, none for P1.1/P1.2) | append `item-done` rows **after** the landing, then tick the boxes |
| B2  | #328 apex 403 challenge  | reproduced class unchanged; unblock is the owner's Cloudflare change                                                                             | OWNER-RESERVED | #328 acceptance matrix                                  | verification fires when the owner's change lands                   |
| B3  | #332 stale-branch report | **CLOSED as dispositioned.** 68/68 listed refs still live (0 gone), 9 tips already ancestors of main, 58 unmerged and sole copies                | done           | issue comment                                           | the weekly workflow files a fresh report                           |

## C. Defects on the record (2026-11-01 site audit)

The audit drove **Cloudflare Pages staging + production**. A finding that changes
every entry below: **the deployed artifact is stale.**

| artifact                                 | asset stamp                                     | deployed from                                          | note                        |
| ---------------------------------------- | ----------------------------------------------- | ------------------------------------------------------ | --------------------------- |
| `bigenergyco.pages.dev` (staging)        | `ui.js?v=20261025b` (read live in this session) | CF Pages run `40237275856`, 2026-10-25, sha `4145aef5` | **5 days behind main**      |
| `freeoffgridcalculator.com` (production) | same class                                      | same workflow, manual                                  | manual-promotion, unchanged |
| GitHub Pages mirror                      | current with main                               | deploy run `40815564829` on `abb508e06`                | not the audited surface     |

Cause: `cf-pages-deploy.yml` is `workflow_dispatch` only. Main has moved
(`#320`→`#336`, plus #322, #323, #326) and no CF Pages deploy has run since
2026-10-25. So several audit findings are **already cured in code that never
reached the surface the audit measured** — and one is not.

| id  | defect                                         | verified state (this session)                                                                                                                                                                                                                                                                                                                                                                                                           | class                                                                | evidence handle                                                                                        | next action                                                                                                                                   |
| --- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | off-grid renders the grid-tied bill model      | **partly stale-deployment.** Code on `main` already selects the off-grid money-bar sentence (`ui.js` `tariffSpendOffgrid`) and hides the cut row (`mode-chrome.js`). Live FR off-grid run today still printed the grid-tie sentence, because the live bundle predates it. Driving `lane/finish` off-grid (Phoenix, 20 kWh/day): no bill block, no "you still pay", no grid-only 20-yr line, no grid-tied card — all absent from the DOM | CURABLE NOW (dispatch staging deploy) + OWNER (production promotion) | live FR run; local off-grid DOM dump; `cf-pages-deploy` run list                                       | dispatch `cf-pages-deploy` target=staging, then re-run the audit's own off-grid assertions against staging; production promotion stays manual |
| C2  | invalid values pass silently (price −5)        | **CURED on `lane/finish`** `27cba50e3`: run blocked, aria-invalid set, localized message next to the field, cleared on correction. Verified by driving EN and FR. 6 regression tests                                                                                                                                                                                                                                                    | done (needs landing)                                                 | `tests/tariff-field-validation.test.mjs`; FR drive shows `Saisissez un prix supérieur à 0.01 par kWh…` | land with A4-class PR flow                                                                                                                    |
| C3  | ES/FR controls untranslated                    | **CURED on `lane/finish`** `27cba50e3`: goal selector, both mode buttons, BOM + FAQ headings, the three result actions and the two SoC zoom labels keyed in 7 locales. Verified by driving FR                                                                                                                                                                                                                                           | done (needs landing)                                                 | FR drive: `🏠 Réduire ma facture d'électricité`, `🌲 Autonome / Secours`, `Questions fréquentes`       | land                                                                                                                                          |
| C4  | engine callouts unlocalized                    | **partial.** #321 carries the two oversize callout keys (`engineOversizedCheaper`, `engineSwapsCheaper`) and its wiring, absent from `main`; the wider engine/`rescale`/`charts` prose migration is unchanged (`check-i18n`: 376 unkeyed prose blocks under the 485 ceiling)                                                                                                                                                            | CURABLE NOW (in progress via A4)                                     | #321 head `5ed9e5a27`; `npm run quality` output                                                        | land A4, then take the next unkeyed class as its own slice                                                                                    |
| C5  | site frame is bill-first for an off-grid brand | `og:site_name` "Free Off-Grid Calculator", H1 "Cut your electricity bill."                                                                                                                                                                                                                                                                                                                                                              | OWNER-RESERVED (positioning call)                                    | audit comment                                                                                          | owner decision                                                                                                                                |

## D. Preservation and ALL-CLEAR receipts

Each was verified tip-for-tip from the remote **this session**, not accepted from
the earlier comment.

| id  | receipt                                  | verified                                                                                                                              | class                  | evidence                                      |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------- |
| D1  | 47 `mission/branch-tips-20261101/*` refs | **47 of 47 equal, 0 differ, 0 unmapped** (local and remote both compared against `ls-remote`)                                         | done                   | this session's loop over `git ls-remote`      |
| D2  | ledger-p1-3 substance branch             | `mission/preserve-ledger-p1-3-substance-20261103` = `99e932e18` — matches the receipt                                                 | done                   | `git ls-remote`                               |
| D3  | stash `82b70c8f` converted               | `mission/preserve-stash-82b70c8f-20261010` = `2f18b5a0b` — matches                                                                    | done                   | `git ls-remote`                               |
| D4  | PR #171 worktree WIP                     | `mission/preserve-beco-pr171-squash-worktree-20261103` = `fbb6f1aa0` — matches                                                        | done                   | `git ls-remote`                               |
| D5  | `.claude/settings.local.json`            | archived to `claude-config-archive/` (manifest + scan), git-excluded, **not** pushed by design                                        | done                   | archive dir + manifest                        |
| D6  | whole-disk sweep statement / ALL-CLEAR   | `docs/lane/allclear-2026-11-03.md` on `lane/finish` (86 lines: locations, three-class disposition, holds table, stated boundary)      | done                   | file at `a99d8668e`, formatted at `61b6dee5b` |
| D7  | the 7 owner-staged holds                 | stated in the ALL-CLEAR doc; `_inline.js` was the one with no tracked copy and is now at `docs/preserve/ctmp-owner-staged/_inline.js` | OWNER-RESERVED (holds) | ALL-CLEAR doc holds table                     |
| D8  | temp purge approval                      | pending in the main thread                                                                                                            | OWNER-RESERVED         | #145                                          |

## E. #145 plan items

| id  | item                                  | verified state                                                                                                                                    | class                          | next action                               |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------- |
| E1  | P0.5 O-02 (Web Analytics)             | open                                                                                                                                              | OWNER-RESERVED                 | owner setup                               |
| E2  | P0.5 O-04 (Search Console)            | open                                                                                                                                              | OWNER-RESERVED                 | owner setup                               |
| E3  | P0.5 O-05 (Code Owner review)         | open, pending owner decision                                                                                                                      | OWNER-RESERVED                 | owner decision                            |
| E4  | P0.5 O-09 (Cloudflare challenge)      | same as B2                                                                                                                                        | OWNER-RESERVED                 | fires on the owner's change               |
| E5  | P1.1 turnkey multiplier               | **delivered on `lane/finish`** (`6468ffbf0`: grade D + `benchmarkMissing` + all-7-locale disclosure + weaker-basis lease grading), **not landed** | CURABLE NOW                    | land, then LEDGER row + tracker tick (B1) |
| E6  | P1.2 region-scaled electrician labour | implementation already on `main` (`paths.js` `elec*` columns); the lane adds the pinning test (`ec63d2bd7`)                                       | EVIDENCE ONLY → land the test  | land, then LEDGER row + tick              |
| E7  | P1.4 stale-FX notice                  | open; `fxActive()` exists, no as-of/source line on screen                                                                                         | CURABLE NOW                    | next unblocked slice                      |
| E8  | P1.5 heatmap self-host + guard        | open (Leaflet vendored under `assets/vendor`; guard/greeting states unverified this pass)                                                         | CURABLE NOW                    | slice after E7                            |
| E9  | P1.6 assumption disclosures           | open; the three lines are not on screen                                                                                                           | CURABLE NOW                    | slice                                     |
| E10 | P2.1–P2.7 registry & provenance       | open, unstarted                                                                                                                                   | CURABLE NOW (program)          | plan order                                |
| E11 | P3.1–P3.8 economics engine            | open, unstarted                                                                                                                                   | CURABLE NOW (program)          | plan order                                |
| E12 | P4.1–P4.6 use-case engines            | open (P4.5 shipped earlier; the rest open)                                                                                                        | CURABLE NOW (program)          | plan order                                |
| E13 | P5.1–P5.4 design system & i18n        | 5.5 done; this session delivered a P5.4 slice (C3)                                                                                                | CURABLE NOW                    | continue the unkeyed-prose class          |
| E14 | P6.1–P6.9 `/next/` app                | open, unstarted                                                                                                                                   | CURABLE NOW (program)          | plan order                                |
| E15 | P7.1–P7.4 Advisor 2.0                 | open, unstarted                                                                                                                                   | CURABLE NOW (program)          | plan order                                |
| E16 | P8.1–P8.5 swap                        | open, unstarted                                                                                                                                   | CURABLE NOW (program)          | plan order                                |
| E17 | P9.1–P9.6 reach                       | open, unstarted                                                                                                                                   | CURABLE NOW (program)          | plan order                                |
| E18 | P10.1–P10.4 exit gate                 | open; the facet-proof tail is the P10 tail (see F)                                                                                                | CURABLE NOW (evidence program) | judge facets one at a time                |
| E19 | P11.1–P11.4 continuous                | open, unstarted                                                                                                                                   | CURABLE NOW (program)          | plan order                                |

## F. The P10 tail (facet-proof, from #145's own status block)

`P10 exit: false by design. Fresh main report has 6/21 facets at ordinal 100;
15/21 remain short of proven.` Every unproven facet is an **EVIDENCE ONLY** entry
whose closing record is a fresh `jev-complete` full report on the merged SHA, and
whose producer is the lane's CI run — except the two owner-physical halves:
gq10's human-behaviour session and gq09/gq17's real-device confirmations, which
are OWNER-RESERVED and cannot be produced by any lane drive.

## G. New findings this pass

| id  | finding                                                                                                                                       | class                                 | next action                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------- |
| G1  | **staging deployment drift**: CF Pages staging is 5 days behind main; the audit measured a stale artifact                                     | CURABLE NOW (dispatch staging deploy) | dispatch, then re-assert C1/C2/C3 against staging                                       |
| G2  | `cf-pages-deploy.yml` has no drift alarm — nothing files an issue when staging falls behind main                                              | CURABLE NOW (text/workflow)           | propose a staleness check; owner decides if it runs on a schedule                       |
| G3  | a merge commit cannot be the asset-stamp commit (`git log -S` skips merges), so a merge-based landing fails `stampCommit()` on a correct tree | CURABLE NOW (documented in #321)      | follow every merge-based landing with a non-merge stamp commit; consider a script guard |
| G4  | `robots.txt` shows as locally modified (line-endings only) in the canonical clone                                                             | CURABLE NOW (hygiene)                 | not committed; named here so it is not mistaken for content                             |

---

## Work this session (with SHAs)

1. **#336 landed** — `main` `34b4c77e` → `02923531`.
2. **#331 closed as dispositioned** — receipts verified, branch retained.
3. **#332 closed as dispositioned** — 68/68 refs verified live, classes recorded.
4. **C2 + C3 cured** on `lane/finish` `27cba50e3` — localized controls and a
   visible, blocking price error; 6 new tests; driven in EN and FR.
5. **#321 branch-forwarded** to `5ed9e5a27` — 20 conflicts resolved (all
   version-stamp lines), the pre-#322 single-writer regression caught by the
   re-prove and fixed, stamp carried by a non-merge commit (`20261103b`).
6. **All preservation receipts re-verified** from the remote (D1–D6).

## What this ledger does not claim

- No `jev-complete` verdict is claimed for any lane commit; the gate's verdict is
  the CI run, and #321's scoped run is still in flight at the time of writing.
- No live-surface claim is made for the cures until the staging deploy in G1
  carries them; they are verified on `lane/finish` by driving the real page.
- The P2–P11 programs are enumerated, not delivered.
