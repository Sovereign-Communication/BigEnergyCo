# Promotion prep addendum - 2026-11-07

Adds to `docs/lane/PROMOTION-READINESS-2026-11-06.md`; it does not replace or
reword it. Two things the 2026-11-06 packet could not know, because nobody had
run the promote tool yet: its default staging origin is dead, and its `--apply`
gate was blocked by the lane's own untracked scratch.

## 1. The promote dry run's default staging origin is 404 - it points at the retired GitHub Pages site

`scripts/promote.mjs:87-91` defaults `STAGING_BASE` to
`https://sovereign-communication.github.io/BigEnergyCo/`. That is the old org's
GitHub Pages origin, and the repository has since moved (`git push` reports the
new location `https://github.com/Treystu/BigEnergyCo.git`). Read directly:

| URL                                                      | Read (2026-11-07, `curl -s -o /dev/null --max-time 20 -w`) |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| `https://sovereign-communication.github.io/BigEnergyCo/` | **HTTP 404**, 9,115 B, 0.698s                              |
| `https://bigenergyco.pages.dev/`                         | **HTTP 200**, 124,463 B, 0.595s                            |
| `https://bigenergyco.pages.dev/index.html`               | HTTP 308, 0 B, 0.365s (Pages normalises to `/`)            |

So the dry run's refusal is not a statement about staging at all:

```
PROMOTE WARN  working tree is dirty; --apply would refuse.
PROMOTE REFUSED (1): staging did not verify - refusing to promote 20fb4fd
  staging ? vs checkout 20261105c; failures: staging serves a page - HTTP 404 ;
  parity index.html - missing: HTTP 404 ; parity 404.html - missing: HTTP 404 ;
  parity robots.txt - missing: HTTP 404
```

Every one of those four failures is the 404 above. **This is evidence for P3, not
a resolution of it.** P3 asks which origin "staging" means, and the lane still
does not get to answer that. What the read does add: the origin the tool defaults
to is not a candidate at all, because it does not serve, and the mission-named
surface serves 200 with 124,463 B - byte-identical to the 2026-11-06 packet's
read, so staging has not drifted while this has been parked.

## 2. `--base https://bigenergyco.pages.dev/` stalls, and I could not establish why

Run against the surface that actually serves, the dry run produced **one** line
(the dirty-tree warning) and then nothing for over seven minutes; I stopped it
rather than leave it running. It is not merely slow output - the log stayed at 59
bytes with an unchanged mtime.

I am not going to guess at the cause and record the guess as a finding. The two
candidates worth checking next, in this order:

1. `https://bigenergyco.pages.dev/index.html` answers **308** (read above). If the
   parity check requests that path and follows the redirect back to `/`, the
   comparison can loop or wait on a response it will never get.
2. No per-request timeout: the default run failed fast only because a 404 returns
   immediately. A hang needs a bounded fetch to distinguish "slow" from "stuck".

Cure before the next attempt: run the verification with a request timeout and a
single named origin, and treat "no output for N seconds" as a failure rather than
as patience. Nothing was deployed, and `--apply` was never invoked.

## 3. The lane's own scratch was blocking `--apply` (now cured)

`scripts/promote.mjs:349-351` refuses `--apply` on a dirty working tree
(`git status --porcelain`). `shorts/` (93 MB of render output) and `nul` (a
42,868-byte Windows `> nul` redirect artifact) were untracked, so **every**
promote read reported dirty and `--apply` would have refused regardless of
content. Cured at `37dd15a25` by ignoring both in `.gitignore`, with the reason
written at each rule. Ignored rather than deleted: each is a single-machine copy,
and the file's existing rule already says a committed stale copy is worse than a
local one. `git status --short` is now empty.

## 4. What is still open, unchanged

- **P-1 (recorded Jev vision-audit PASS)** - still absent, still nothing to
  manufacture. This remains the first precondition on any promotion.
- **P-2 (rollback target named)** - still unnamed, and still not the lane's to
  name: A-13's verified candidate is `bigenergyco-prod` @ `f833c02d`.
- **P3 (which staging origin)** - now has the reads above, and still needs the
  owner's one-word answer.
- **P6 (no rail verdict on `main`)** - unchanged and still true: the rail is green
  on `lane/finish` (pipeline 8 at `20fb4fd35`), but `main` carries no
  `.circleci/config.yml` until this PR lands, so `main` remains unverifiable.

## 5. What this addendum does not claim

It does not claim promotion is ready. It does not name the rollback target, pick
the staging origin, or treat a dry run as a vision audit. It records no deploy:
`--apply` was never run, and nothing here reaches production.

GATE: local pass (decision-signal) - promotion prep: stale base read, stall
recorded as unexplained rather than guessed, apply-blocking dirt cured - checks
1-5 clean
