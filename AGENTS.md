# Agent & Contributor Guidelines for BigEnergyCo

## 0. The Master Plan Governs All Product Work

- `docs/plan/MASTER_PLAN.md` is the single, immutable plan (hash-pinned; `npm run plan:check`). It supersedes every other plan or roadmap document in the repo.
- Every PR names the plan items and requirement IDs it delivers and follows the plan's per-PR definition of done (§9). The PR template carries the checklist.
- The plan changes only through an owner-approved, append-only amendment in `docs/plan/AMENDMENTS.md`. Progress goes in `docs/plan/LEDGER.jsonl` and the pinned tracking issue, never in the plan itself.

## 1. Golden Rule: Always Push to `main` Through a Pull Request (PR)

- **Never push commits directly to `main`**.
- Always create a dedicated, descriptively named branch for any feature, fix, or refactor (e.g. `feat/...`, `fix/...`, `refactor/...`, `chore/...`).
- Open a Pull Request against `main` using `gh pr create`.
- Only merge into `main` after CI checks (Tests, CodeQL, Lint) have completed and passed.

## 2. Regression Prevention & Test Discipline

- Every new feature, heuristic, formula, UI control, or bug fix **must** have corresponding automated tests added or updated in `tests/*.test.mjs`.
- Never decrease test coverage or delete regression tests.
- Verify the local test suite prior to opening or updating a PR:
  ```bash
  # Run full offline test suite
  npm test

  # Character encoding check (no illegal characters or corrupt UTF-8)
  node scripts/check-chars.mjs

  # SEO, sitemap, JSON-LD, and token validation
  npm run seo

  # Code style check (the runner's view: tracked files, git's line endings)
  npm run format:check

  # Deployment staging check
  npm run deploy:check
  ```

## 3. Core Architectural Principles

- **Permanently Free & Public**: No paywalls, no lead collection forms, no commercial sales pitches.
- **Zero Runtime Dependencies**: The calculator runs 100% client-side with pure vanilla JavaScript and Web Workers.
- **Named carve-out — D-21 (isolated platform surface)**: Cloudflare bindings on the _showcase_ surface are optional, presence-gated, and structurally incapable of promoting. A missing binding fails loud and named (HTTP 503 naming the provisioning step), the showcase worker is separately named so `wrangler deploy` cannot reach production, and the calculator and sizing engine stay 100% client-side. This is a declared exception to the zero-dependency doctrine, not a violation smuggled through it — the exception is written down here and in the master plan (D-21, R-CF-01..10) so both governing documents agree.
- **Physics & Determinism First**: All sizing calculations derive deterministically from hourly NASA POWER solar irradiance and temperature data.
- **Educational Mission**: Provide transparent, plain-English breakdowns (ELI5) of system components, physical footprints, and honest DIY/wholesale equipment costs vs. high-markup turnkey installer quotes.

## LANE PROTOCOL - all agent lanes, all sessions (added 2026-10-29)

1. ONE BRANCH, ONE CLONE. Work in the canonical clone only. Never create worktrees or scratch/backup branches. Your lane branch (THIS REPO line below) is the only branch you work on; it carries ONE standing DRAFT PR into the base - oversight's live view of all your work, WIP included.
2. PUSH MANDATE. If it isn't pushed, it doesn't exist. Commit + push incomplete work (prefix "wip:" + what state it's in) at every turn end, every sub-step, before any risky operation, and at least every 20 minutes. Never end a session unpushed. Before every push: git status - never commit secrets, API keys, .env files, private keys, credentials, build output, or binaries; if a file matters but can't be committed, leave it untracked and name it in your status comment. Never push main or the base directly. No force-push except --force-with-lease on your own lane branch, and never rewrite a commit a comment already references.
3. STEERING LOOP. At every turn start, and again after every push: read new comments on your draft PR, on every open PR you own, and on every issue you're working, plus newly filed issues. Comments from Treystu are authoritative directives (the owner and his oversight agent): they outrank your prompt and your plan; newest wins. Acknowledge each in-thread, do it, then reply with evidence (SHA, check-runs, test results). If one is ambiguous, ask ONE clarifying question in-thread and keep working on everything else.
4. STATUS + RESUME. End every turn with a status comment on the draft PR (mirror to the tracker in the THIS REPO line): DONE / WIP / NEXT / BLOCKERS / DIRECTIVES, with SHAs. Resume from GitHub alone: fetch, read the latest status comment + every newer Treystu comment, verify lane-branch HEAD matches the status SHA. GitHub beats local state and local notes, always.
5. LANDING + GATES. Work reaches the base only under your tasking's merge rules (green + verified + non-destructive; CI from check-runs, never the combined status; revert first if a landing turns the base red). WIP on the lane branch may be red - say so in the commit message. Lucas Gate v2 first, Jev for decisions/dispositions, on every comment, review, and disposition you post. No emoji in repo content.
   THIS REPO: lane branch lane/finish; base main; standing draft PR lane/finish -> main; tracker issue #145 - mirror status comments there.
6. GATE-FAIL GOES ASYNC — NEVER STOP-AND-ASK. If the Lucas Gate or a Jev gate comes back below bar on an item (a comment, review, disposition, or a merge's gate pair), you do NOT stop the lane and you do NOT prompt the owner in chat. You: (a) post the gate result ON the item's PR/issue — scores, the specific categories/aspects below bar, what you already investigated, and what would cure it — as a GATE-PARKED note; (b) park THAT ITEM ONLY and continue all unaffected work; (c) re-check for a Treystu reply at every steering loop — a Treystu comment on a gate-parked item is a directive like any other: act on it, reply with evidence. An item stays parked until a Treystu reply lands or new evidence lets you re-gate it honestly (never re-run a gate to shop a verdict). Owner-reserved items follow the same path: the reservation is recorded ON the issue/PR, with the evidence the owner needs, and the lane moves on. Chat escalation is only for: destructive or irreversible action, a merge outside the standing policy, payment/commitment, public claims or a submission, real-money risk — and only after the GitHub post exists. KILL SWITCH: a Treystu comment saying STOP on the draft PR or tracker halts you immediately; resume only on a Treystu comment. If you are blocked before your draft PR exists (including a gate-blocked protocol PR), post your status — DONE/WIP/NEXT/BLOCKERS/DIRECTIVES — on the protocol PR (or tracker issue) instead, and keep doing every piece of work the block does not cover.
