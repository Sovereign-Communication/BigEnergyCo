# Promotion readiness - 2026-11-06

Lane `lane/finish` (standing draft PR #330, tracker #145). This is the
promotion-prep packet the 2026-11-05 round-2 mission asks for: everything up to
the production-replication step, prepared and read, with the parts that are not
the lane's to do named as gaps rather than filled in.

**No promotion was performed. No promotion is proposed by this document.** Its
whole purpose is that the first promotion, when it happens, happens on a
recorded gate rather than on momentum.

Reads below are `(read: <method>, <timestamp>)`, per lane protocol point 9.

## 1. What the state is, as read

| Surface                                  | Read (2026-11-06)                                            | What it means                                                         |
| ---------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------- |
| `https://bigenergyco.pages.dev/`         | `200`, 124,463 B (`curl -o /dev/null -w`, 2026-11-06)        | Serves. It is the alias the round-2 mission calls the staging surface |
| `https://staging.bigenergyco.pages.dev/` | `200`, 125,986 B (`curl -o /dev/null -w`, 2026-11-06)        | Also serves - and serves **different bytes** from the host above      |
| `https://freeoffgridcalculator.com/`     | `403`, 5,477 B (`curl -o /dev/null -w`, 2026-11-06)          | The apex challenge of #328, the owner's Cloudflare act                |
| `main`                                   | `7b3c108b69cb59095fdd43d669ac3b5870b624fa` (`git ls-remote`) | Unchanged; no rail verdict has ever been produced on it               |

Two hosts serving two byte counts is not a detail to smooth over: "staging" has
to name one origin before a promote can be verified against it. See gap P3.

## 2. What is ready now

1. **The gates that must be green are named and runnable.** `npm test`,
   `npm run seo`, `npm run format:check`, `node scripts/check-chars.mjs`,
   `npm run deploy:check`, `npm run verify:staging`, `npm run gate:byte-budgets`,
   `npm run gate:a11y-matrix` - the table in `docs/DEPLOY_RUNBOOK.md` (§ "Which
   gate runs where") is the register, and it is the same list this lane's
   checkpoints actually run.
2. **The promote tool is refusal-first.** `scripts/promote.mjs` re-runs staging
   verification, refuses on a dirty tree, refuses when `HEAD !== origin/main`,
   refuses when its subprocess cap stops fitting the budget, and records every
   apply to `docs/release-ledger.jsonl` with the promoted SHA, both stamps and
   the rollback command. `npm run promote` (dry run) prints the plan and the
   record without deploying.
3. **A rollback path exists and is reversible in one command** - `npm run
rollback -- <sha> --apply`, implemented as `scripts/promote.mjs --to` (read:
   `package.json:53`, 2026-11-06). It rebuilds from a recorded commit, so it does
   not depend on any artifact being still cached anywhere.
4. **A candidate rollback target is verified, not assumed.** Register row
   **A-13**: `bigenergyco-prod` was built from `4145aef` and deployed as
   `f833c02d`, and 4 of 411 objects were compared byte-for-byte against the
   current production surface and matched (index `258062371d...`, stamp
   `20261025b`). Its verify-by date is **2026-11-12**; a promotion after that
   date must re-take the read before the target can be named.
5. **Production replication is provably non-user-visible today.** Register row
   **A-14**: `bigenergyco-prod` has no custom domains attached, while
   `bigenergyco` holds `bigenergyco.pages.dev`, `freeoffgridcalculator.com` and
   `www.freeoffgridcalculator.com` (read: `wrangler pages project list`,
   2026-11-05T09:50Z). A-14's verification point is _immediately before and after
   the replication deploy_ - so it is re-read at the moment of the act, not here.
6. **Asset-stamp discipline is enforced, not remembered.** A release that
   changes a shipped file without a unified stamp bump fails
   `bump-asset-tokens.mjs --check`, which is inside `npm run seo`.

## 3. The two preconditions on the first promotion

Both are stated in the mission's own words, and neither is the lane's to supply.

**P-1. A recorded Jev vision-audit PASS.** No such record exists in this
repository: a content search of `docs/` and `jev-artifacts/` for "vision audit"
/ "vision-audit" returns **0 matches** (read: `grep -rlni`, 2026-11-06). The
`jev-complete` gate is a different instrument - it scores the tree and needs CI
execution - and it is not this precondition. **Gap, not assumed.**

**P-2. The rollback target named, in the record, before the deploy.** A-13 gives
the lane a verified _candidate_ (`bigenergyco-prod` @ `f833c02d`); nobody has
named it as _the_ rollback target for the first promotion. Naming it is part of
the same recorded decision that carries P-1. The lane does not name it on the
owner's behalf - a promotion whose rollback target was chosen by the promoting
lane is exactly the arrangement the gate exists to prevent.

Both preconditions are therefore **unmet as of 2026-11-06**, and their status is
the reason no promotion step is prepared beyond the point where they would be
consumed.

## 4. Prep gaps (the honest list)

| ID  | Gap                                                                                   | State                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | No recorded Jev vision-audit PASS anywhere in `docs/` or `jev-artifacts/`             | **OPEN** - record absent, searched 2026-11-06; nothing to manufacture                                                                                                                                                                                                                                       |
| P2  | Rollback target not named for the first promotion                                     | **OPEN** - verified candidate exists (A-13), naming does not                                                                                                                                                                                                                                                |
| P3  | "Staging" names two origins that serve different bytes                                | **OPEN** - owner call: `bigenergyco.pages.dev` or `staging.bigenergyco.pages.dev`. The round-2 mission text and the 2026-11-05T09:31Z promotion policy disagree; the mission is newer, so the mission's reading governs the lane's work, but a promote verifies against one origin and must not guess which |
| P4  | Production replication to `bigenergyco-prod` parked on the owner's custom-domain move | **PARKED BY DESIGN** - A-14 re-read is the pre/post check at the moment of the act                                                                                                                                                                                                                          |
| P5  | `#328` apex `403` blocks verification against the brand domain                        | **OWNER ACT** - lane reads filed; not re-asked                                                                                                                                                                                                                                                              |
| P6  | No rail verdict on `main`                                                             | **OPEN, owner-side** - the CircleCI verify-job port is ordered on #330 and unlanded; `main` is UNVERIFIABLE until a pipeline reports `steps > 0`                                                                                                                                                            |

P3 deserves one more line because it is the kind of gap that gets discovered
mid-promote. The lane's job is not to pick the origin; it is to make sure the
choice is taken before the promote starts, from the record, and that the promote
then verifies against the origin the record named.

## 5. The sequence that would run, when P-1 and P-2 are satisfied

Staging on `main` is the landing surface; production replication is the step that
waits. In order, and stopping at the parked step:

1. Confirm `main` is the tree being promoted and that staging serves it:
   `npm run verify:staging` against the **named** staging origin (P3).
2. Re-read A-14 (`wrangler pages project list`): `bigenergyco-prod` still has no
   custom domains. If this fails, stop - the replication would become
   user-visible.
3. Re-read A-13 if past 2026-11-12, and record the rollback target from P-2 in
   the promotion record.
4. `npm run promote` (dry run) and attach its printed plan, stamps and record to
   the promotion comment.
5. `npm run promote:apply` (or `:oauth`) - this is the step **parked on the
   owner's custom-domain move**, and it is not run by this lane.
6. Post-deploy read: both stamps, `docs/release-ledger.jsonl`'s new line, and
   `verify-staging.mjs` against the surface the promote actually wrote.
7. Rollback stays one command away for the whole window: `npm run rollback --
<sha> --apply`.

Steps 1-4 are prepared. Steps 5-7 are the owner's act, in the owner's order.

## 6. What this packet does not claim

- It does not claim a promotion is ready to run. Two preconditions are unmet and
  three prep gaps are open.
- It does not treat `jev-complete` as the vision audit, and does not treat a
  green dry run as a vision PASS.
- It does not name the rollback target, or pick the staging origin.
- It records no deployment, and nothing in this document reaches production.

GATE: local pass (decision-signal) - promotion-prep scope (prepare to the parked
step; preconditions recorded as gaps rather than manufactured) - checks 1-5 clean
