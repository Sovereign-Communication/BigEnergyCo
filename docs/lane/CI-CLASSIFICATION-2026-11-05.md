# CI classification - the nine failing check-runs on `main` `7b3c108b6`

Recorded 2026-11-05 under LANE PROTOCOL point 5. Method: each of the nine
**check-runs was read on its own record** - its annotations endpoint, and its
Actions job with a fetch of its own log - plus one job from a run created today,
so the classification rests on the job's refusal record rather than on an
earlier lane note or on a run-level conclusion.

`main` is at `7b3c108b69cb59095fdd43d669ac3b5870b624fa`; nothing in this lane
changes it.

## Verdict

**Nine of nine are billing-lock residue. Zero are genuine.** The evidence for
each is the same three-part read, taken per job:

1. the job's own **failure annotation** says the job never started
   (`The job was not started because your account is locked due to a billing issue.`);
2. the job's own **record** shows `runner_name` empty and **zero steps** - no
   runner was ever assigned;
3. an attempt to fetch the job's **own log** returns HTTP 404 with
   `BlobNotFound` ("The specified blob does not exist"), which is what a job
   that produced no log leaves behind.

Point 3 is why the logs are unavailable: there are none to read. That is stated
here rather than worked around - a job that never ran cannot have its failure
line quoted, and this record does not invent one.

## Per job (read: check-run annotations + Actions job + job log attempt, 2026-11-05T13:58Z)

| Job                | Check-run / job id | Conclusion | Started (UTC)        | Own log            | Annotation (verbatim)                                                            | Verdict              |
| ------------------ | ------------------ | ---------- | -------------------- | ------------------ | -------------------------------------------------------------------------------- | -------------------- |
| `static`           | 126654311459       | failure    | 2026-11-04T14:59:25Z | 404 `BlobNotFound` | "The job was not started because your account is locked due to a billing issue." | billing-lock residue |
| `jev-complete`     | 126387738411       | failure    | 2026-11-04T04:27:15Z | 404 `BlobNotFound` | same                                                                             | billing-lock residue |
| `analyze`          | 126387737951       | failure    | 2026-11-04T04:27:15Z | 404 `BlobNotFound` | same                                                                             | billing-lock residue |
| `quality-lab`      | 126387723162       | failure    | 2026-11-04T04:27:12Z | 404 `BlobNotFound` | same                                                                             | billing-lock residue |
| `lighthouse`       | 126387723146       | failure    | 2026-11-04T04:27:12Z | 404 `BlobNotFound` | same                                                                             | billing-lock residue |
| `quality-evidence` | 126387723105       | failure    | 2026-11-04T04:27:12Z | 404 `BlobNotFound` | same                                                                             | billing-lock residue |
| `coverage`         | 126387723072       | failure    | 2026-11-04T04:27:12Z | 404 `BlobNotFound` | same                                                                             | billing-lock residue |
| `test`             | 126387723067       | failure    | 2026-11-04T04:27:12Z | 404 `BlobNotFound` | same                                                                             | billing-lock residue |
| `web-smoke`        | 126387722747       | failure    | 2026-11-04T04:27:12Z | 404 `BlobNotFound` | same                                                                             | billing-lock residue |

Each of the nine also carries a second annotation, a `notice` that the
`ubuntu-latest` label migrates to Ubuntu 26 from 2026-10-19. It is a runner-image
notice with no bearing on the conclusion and is not a failure line.

`static` differs from the other eight only in time: it ran in its own workflow
run at 14:59:25Z, five hours after the rest, and carries the identical refusal.

## The lock is still live, read today rather than inherited

A lane push at 2026-11-05T13:55:20Z produced run **42040077832**. Its `analyze`
job **127288264677** records `started_at = 2026-11-05T13:55:21Z`, `runner_name`
empty, zero steps, the same failure annotation, and its log attempt returns the
same 404 `BlobNotFound` (read: run/jobs + check-run annotations + job log,
2026-11-05T13:59Z).

So the lock is **live now**, not a stale conclusion from yesterday's runs.

## What this classification does and does not establish

It establishes **why each job failed**: the runner was told not to start it,
which is an account-billing condition and not a code defect.

It does **not** establish that the code would pass if CI ran. There is no log to
contradict that, and equally none to confirm it. The only evidence the lane has
about the code is its own local battery, which passes on the pushed head - and a
local run is not the CI gate. Nobody should read "billing-lock residue" as "green
once unblocked"; the first real run after the lock lifts is the only read that
will say.

## jev-complete disposition - re-read against current secrets and CI configuration

Read now, not carried forward:

- **Secrets:** the repository has exactly one Actions secret, `TYPESAFE_API_KEY`,
  last updated 2026-10-19T19:07:44Z (read: `GET /repos/.../actions/secrets`,
  2026-11-05T13:58Z). The secret the job needs **is present**.
- **The job's own configuration:** `.github/workflows/test.yml` runs
  `node scripts/validate-jev-complete.mjs ... --require-live` with
  `TYPESAFE_API_KEY` from secrets, and uploads `jev-complete-report` always.
- **A dependency the earlier disposition did not name:** `jev-complete` declares
  `needs: [test, web-smoke, quality-lab, lighthouse, coverage, quality-evidence]`
  and builds its evidence from those jobs' `jev-results-*` artifacts via
  `scripts/build-jev-evidence.mjs`, which fails closed when an artifact is
  missing (the file's own header: "the evidence could not be completed: an
  artifact is missing, a job did not finish...").
  **Consequence: `jev-complete` cannot be the first green job after the lock
  lifts.** Its six dependencies must run and upload artifacts in the same run
  first, so it is the last link in the chain, not the first thing to check.
- **It has gone green before, end to end:** `jev-complete` concluded **success**
  on `21fac5f2e` at 2026-11-04T04:01:56Z (read: check-runs on that commit,
  2026-11-05T13:58Z), which proves the secret-plus-artifacts path works when the
  dependencies run.
- **On `7b3c108b6`:** the job never started, so its inputs never existed either.

**Outcome: the earlier disposition is CONFIRMED and sharpened, not overturned.**
The secret is not the blocker; the billing lock is. The refinement is that the
lock is not the only thing standing between a green CI and a Jev report - the
six dependency jobs have to run green in the same attempt to produce the
artifacts, and the gate then spends one live TypeSafe request.

**Not exercised:** the lane did not make a live TypeSafe request. No
`TYPESAFE_API_KEY` is set in the lane's environment (a `~/.config/harness/jev.env`
file exists on the machine, but reading or spending it is not this lane's call),
and a judge call on an unmerged branch would not be the gate anyway. So the
disposition above is a read of configuration and history, not a live judgment.
