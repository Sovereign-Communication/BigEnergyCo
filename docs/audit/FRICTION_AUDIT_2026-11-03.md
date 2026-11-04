# Friction audit — 2026-11-03 (last 48 hours, this lane)

Sources: every status comment on #330 and #145 (timestamps in UTC), `git log`
with timestamps (local, UTC−10), and this session's own command record. Nothing
here is estimated from memory; where a cause is inferred rather than observed it
says so.

## Tally

| class                               | count in window           | time lost (est.)             | cure                                           | owner |
| ----------------------------------- | ------------------------- | ---------------------------- | ---------------------------------------------- | ----- |
| GATE_LOOP                           | 2                         | ~30 min (two CI round trips) | applied — see G-1                              | lane  |
| OTHER: premature rule-out           | 1                         | ~9 h of lane idle            | applied — see O-1                              | lane  |
| SESSION_DEATH / TRUNCATION          | 1 recorded resumption     | ~5 h                         | applied — see S-1                              | lane  |
| STEERING_LATENCY / WAITING_RESERVED | 3 gaps                    | ~42 h elapsed, not lost work | recorded — not a defect                        | owner |
| INFRA: command time cap             | 1 (this session, 2 calls) | ~8 min                       | applied — see I-1                              | lane  |
| CONTENTION                          | 0 observed                | —                            | —                                              | —     |
| DISK                                | 0                         | —                            | 13 GB free at pre-flight, above the 5 GB floor | —     |

## The stops, one by one

**G-1 · Format gate failed twice on a lane-introduced file (2026-11-03).**
`a99d8668e` (01:19) committed `docs/lane/allclear-2026-11-03.md` unformatted
because `npm run format:check` was run while the file was still untracked — the
check walks tracked files, so it never saw it. CI failed `test` at the Prettier
step; `61b6dee5b` (01:32) fixed it. The same class had already occurred once
before on the two temp-verify documents. **Cure applied:** format checks are only
evidence when run against the index that will be committed — i.e. `git add`
first, then check. **Lane habit for every future slice:** `git add` → `format`
→ `format:check` → commit.

**O-1 · Session 1 closed by declaring "no unblocked item left" (11:22).**
The claim was false: P1.1, P1.2, P1.4, P1.5, P1.6 and P2–P11 were open, and only
P0.5's sub-items were owner-reserved. The next session (12:41) corrected it and
delivered P1.1. Cost: the lane sat idle from 11:42 until the next steering at
22:28. **Cure applied:** the burndown ledger now enumerates every open item with
its class, so "nothing left" can only be claimed by walking a list, never by
recall. **Proposal (oversight):** a stop reason of `WAITING_RESERVED` is only
admissible with a ledger line count of zero for CURABLE NOW.

**S-1 · The 2026-11-01 temp-verification sessions died mid-census.**
Evidence: `9e5c8b68d` is literally titled "STATE 2026-11-01 — unified temp
verification resumption checkpoint", and the two commits after it re-add "the
executed evidence logs the STATE checkpoint cites". The lane resumed from that
checkpoint on 11-03 at 01:12. **Cure applied:** the checkpoint-before-long-run
rule (protocol point 6) is what made the resume cheap; it stays.

**I-1 · This session: the shell tool refuses a single command over 300 s.**
`npm test` takes ~4.5 min here, so two calls were rejected outright before the
run was moved to a background process with a log and polled. **Cure applied:**
long suites run as `(npm test > log 2>&1; echo EXIT=$? >> log) &` then poll —
which also gives the real exit status, keeping the "never report a pass you did
not see" rule intact.

**W-1 · Three long silences (23:22→01:12, 03:03→09:36, 12:41→22:28).**
These are owner/oversight gaps, not lane stalls: each one ends with a steering
comment, and the lane's last action before each was a pushed checkpoint plus a
status comment. Recorded for completeness; **no cure proposed** — a lane cannot
invent steering, and protocol already forbids idling on a blocked item.

## The costly discovery of this pass (not a stop, but the biggest time sink)

The 2026-11-01 audit measured **Cloudflare Pages staging**, which has not been
deployed since 2026-10-25 (`ui.js?v=20261025b` read live today, while `main`
carries `20261029a` and the lane `20261103c`). Two of the four recorded defects
are already cured in code that never reached that surface, and one is not. Every
hour spent reproducing "off-grid renders the bill model" was spent on a stale
artifact. **Cure applied:** deployment drift is now a first-class ledger entry
(G1) with a `cf-pages-deploy` dispatch as its closing act, and the finding is
recorded on #330/#145. **Proposal:** a staging-staleness check attached to
`cf-pages-deploy.yml` (compare the live asset stamp against `main`'s), so a
five-day drift can never again present itself as a product defect.

## What this audit does not claim

- No count of session deaths beyond the one that left a committed checkpoint —
  a stop that leaves no record cannot be counted from GitHub, and inventing a
  count would be worse than leaving it out.
- Time-lost figures are elapsed windows between recorded events, not measured
  work interruption.
