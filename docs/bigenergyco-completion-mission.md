# BigEnergyCo Completion Mission

> **STATUS (recorded 2026-10-06): this file is a HISTORICAL MISSION RECORD, not
> current state.** It was written on 2026-09-27 and is preserved as the brief
> that drove P0.3/P0.4. Work items 1 and 3 below are DONE and their branches
> are gone: the P0.4 collapse landed as **#166** on 2026-09-29, and #153/#157/
> #160/#164 were closed SUPERSEDED by it on 2026-10-06 after verifying their
> scope was already contained in `main`. Issue #156 (super-linear cycle-life)
> is implemented and recorded in `docs/plan/LEDGER.jsonl`. The "Verified
> starting state" snapshot below is nine days stale and its stated main HEAD no
> longer exists in that form.
>
> Do not execute this file as instructions. For current state read
> `docs/plan/MASTER_PLAN.md` (the immutable, hash-pinned plan — it supersedes
> every other plan document, this one included) and `docs/plan/LEDGER.jsonl`.

You are the owner of this PR and of all the work below. Read this whole file, then do everything it says. When every item is complete and Jev-confirmed, merge this PR yourself — you are authorized to.

## Your authority (granted by Lucas, the repo owner)

- You own this PR (`mission/bigenergyco-completion`) and every work item below.
- You may create implementation PRs, drive their CI green, and **merge them** when they satisfy the 100%-safe rule: latest-head CI fully green, clean merge state, not draft, no changes requested, no unresolved substantive objections. If behind main, rebase onto fresh main and re-verify before merging.
- You may **merge this mission PR** when the Definition of Done below is met.
- You may close the four P0.4 stack PRs (#153, #157, #160, #164) as SUPERSEDED once the collapse PR (item 1) has merged — record the disposition in a comment on each first, then delete only those four branches after verifying their scope is fully contained in the collapse.
- You may NOT close any other PRs, delete other unmerged branches, or take destructive actions without Lucas's explicit approval — report and wait instead.
- Never ask Lucas technical questions (merge order, rebase tactics, how to fix CI). Make those calls yourself. Escalate only: authorization needs (spend, keys, permissions), genuine end-state choices, or real ramifications.

## Verified starting state (snapshot 2026-09-27 ~19:45 HST — re-verify fresh with `git ls-remote` and the API before acting)

- Repo: Sovereign-Communication/BigEnergyCo. You commit as Treystu. Main HEAD: `ddeccbd0e842` (merge of #152).
- The full P0.3 sequence landed today, serially: #150 (A-001 plan amendment) → #149 → #151 → #152 (all 6 CI checks green including jev-complete). The drive that landed it has stopped; this lane owns everything from here.
- **P0.4 stack** (#153/#157/#160/#164): still open, untouched, based on pre-P0.3 main. Lucas approved **option B: collapse P0.4 into a single PR**.
- Open issues: **#156** (super-linear cycle-life model — no implementation PR yet), **#145** (master plan tracker).
- Watch: branch `claude/jolly-goodall-414mjl` was pushed with no PR — check it for unique work before anything gets orphaned.

## Canon

`docs/plan/MASTER_PLAN.md` is the single immutable plan (hash-pinned; `npm run plan:check`). It supersedes every other plan document — including this file. This mission executes the plan; it does not amend it. Plan changes happen only through owner-approved append-only amendments in `docs/plan/AMENDMENTS.md`. Every PR you open names the plan items and requirement IDs it delivers, per the PR template checklist.

## Work items, in order

### 1. P0.4 as one PR (option B, approved)

Collapse #153 + #157 + #160 + #164 into a **single new PR** on fresh main:

- §3.1 byte/request budgets (from #153)
- axe-core quality-lab over the Q-07 matrix (from #157)
- the a11y fixes (from #160)
- measured performance-evidence plumbing (from #164)

This dissolves the structural gate problem (every `P0.4x` title normalizing to `P0.4`, so each sub-PR was judged on all four facets). Drive the single PR to full green — **jev-complete AND quality-lab** — then merge under the 100%-safe rule. After it merges: comment SUPERSEDED dispositions on #153/#157/#160/#164, close them, verify their scope is fully contained in the collapse, then delete their four branches.

### 2. Complete the Google quality pass (the rest of P0.4 / F-38)

**Execution decision (Lucas, 2026-09-27): all Playwright-based gates run LOCALLY on your machine (the Codebuff/agent machine), NOT in GitHub Actions.** GitHub CI keeps running only what is already reliable there (Tests, CodeQL, coverage, web-smoke, jev-complete) — no browsers in CI, no CI wall-clock bloat.

- Run locally on your machine: the axe-core quality matrix script (from #157's stack), the Lighthouse script (14 targets, median of 3), cross-browser smoke, visual-regression scaffolding, RTL-visual coverage.
- **Lighthouse as a ratcheted gate.** #164 made the numbers legible to the judge but performance is explicitly NOT ratcheted. Ratchet the deterministic categories (accessibility, best-practices, SEO) and define the performance policy (median bands vs. hard gate — report calibration data before choosing).
- **Commit the machine-readable evidence to the repo** (reports JSON + the `baseline` row with every Q-metric — P0.4's exit evidence; P0.4 is not done until this row exists and is green). Evidence must be regenerable: document the exact commands in the PR.
- **Add a lightweight CI validator job (no browsers):** a small script that reads the committed evidence files and asserts schema, thresholds, and freshness. This keeps the gate enforced on every PR through the reliable CI path, with the heavy work done locally.
- `/next/` noindex removal in the lab build; npm Dependabot (R-PRIV-04).
- **Real-device gate:** assess feasibility honestly. If a device-lab/CI path exists at reasonable cost, implement it; if not, document the assessment and the exact blocker for Lucas — do not silently drop it and do not fake it.

### 3. Issue #156 — super-linear cycle-life model

After the quality pass lands: implement the reference model and revalidate the goldens, as its own focused PR with regression tests. This is new physics work — physics and determinism first, per the repo's architectural principles.

### 4. Issue #145 — master plan tracker

Keep the pinned tracking issue and `docs/plan/LEDGER.jsonl` truthful as the above lands. Progress goes there and in the tracker — never edits to `MASTER_PLAN.md` itself.

### 5. Hygiene

- Delete remote branch `chore/p0.3e-ci-evidence` once you have verified main contains #152 (auto-delete is not enabled; it is merged and safe).
- Resolve the `claude/jolly-goodall-414mjl` branch: land its unique work if genuine, otherwise report it for Lucas — do not silently orphan it.

## Jev protocol (mandatory)

- `jev-complete` is the quality gate; treat its verdicts as binding unless Lucas overrides.
- Use Jev (TypeSafe System One) to triage any candidate finding (KEEP/DROP + severity) before implementing, and to gate every merge decision. Anything under the confidence bar gets fixed or escalated, never merged on a shrug.
- Key: `TYPESAFE_API_KEY` env or the `custom.typesafe` connector. If Jev is unreachable, say so explicitly in the relevant PR — do not silently skip the gate.
- Jev advises; it never bypasses authorization. Merges still need the 100%-safe rule satisfied.

## Definition of Done — merge this PR only when ALL of these hold

1. Items 1–5 are complete: P0.4 collapse merged green, the full Google quality pass landed (Lighthouse ratcheted, cross-browser, visual-regression, RTL-visual, noindex removal, Dependabot, baseline Q-metric row green), #156 implemented with goldens revalidated, tracker/ledger truthful, hygiene done.
2. Every implementation PR you created is merged, CI green at merge, branches deleted, main verified green after each.
3. A final Jev decision-gate judgment confirms the mission complete (PROCEED at high confidence).
4. This PR's branch is rebased onto fresh main, CI green at latest head, and the PR names the plan items it delivers per the template.
5. Your merge commit message summarizes what landed.

Then merge this PR. That merge is the seal: BigEnergyCo's remaining work is comprehensively complete and confirmed.

## Standing rules

- Never push directly to `main` — every change lands through a PR with green CI (Tests, CodeQL, Lint, jev-complete, quality-lab where applicable).
- Test discipline per repo guidelines: every feature/fix ships with regression tests; never decrease coverage; run `npm test`, `node scripts/check-chars.mjs`, `npm run seo`, `npx prettier --check .` before opening or updating a PR.
- One PR merging at a time; rebase when behind; verify main/CI between merges.
- Narrate before any network/upload/push action: what, where, why.
- No emoji in repo content. One worktree per lane; never edit another lane's files.
- Trust `origin/main` over any cached state, including this file's snapshot — re-verify at every step.
