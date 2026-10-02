# Mission — drive the Cloudflare Cold Start entry to a filed submission

Read `docs/contest/COLD-START-PLAN.md` first, in full. It is the plan. This file is how to
run it.

## The goal

Produce a **filed** Cold Start application with a working live demo, the
repository URL, and a repository that holds up when Cloudflare reads it —
because the rules require them to receive the repo.

Deadline: **October 2, 2026, 11:59 PM PDT**, about 31 hours from when the plan
was written. Verified against `cloudflare.com/connect/cold-start/terms`.

## The ordering that matters

Fix before deploy. Deploy before file. **File early enough that the entry is
safe**, then keep improving. A submission beats a perfect branch, and there is
exactly one submission per entrant.

1. **B1–B5** — the five defects, in the plan's order. B1 first: as shipped,
   provisioning Turnstile 403s the advisor on the live demo.
2. **Deploy** the isolated surface. Never the cookie decision to later — run the
   gate, let it decide.
3. **Verify in a real browser**, not just the §5 curls. Those pass on the broken
   configuration.
4. **FILE**, by hand, on what is verified. Then keep going.
5. Only then: the pitch narrative, the breadth additions, and A-003.

## Two standing constraints

**Isolation.** A concurrent session owns
`C:/Users/SCM/Documents/GitHub/BigEnergyCo/BigEnergyCo` and
`.worktrees/slider-canonical`. Never `git add`, `stash`, `checkout`, `worktree`,
`clean`, `reset` or `restore` there. It has uncommitted in-flight work and
builds its staged Lighthouse tree from `git ls-files` in that checkout. Its
ground, not ours.

**CPU embargo.** Until that session reports final numbers or is parked, do not
run `gate:lighthouse`, `gate:byte-budgets`, `deploy:check`, `smoke:local`, any
browser or Lighthouse session, or `wrangler deploy`. It is deciding a merge on a
noisy three-run distribution and load has already misled it once here. `npm
test`, reading, writing and drafting are always fine.

## How to work

- Drive it all in one pass. Only stop early for something that genuinely needs
  the owner's decision.
- Measure, do not assume. Every claim in this repo has to be backed by a number
  or a test, and the ledger records what was measured, not what was hoped.
- Report what is over as over, with the number. Do not trim a measurement or
  relax a ceiling to look better.
- Every change gets tests. No exceptions, and do not weaken an existing test to
  make something pass.
- One concern per commit; never commit a temporary diagnostic.

## Never

Production promotion. Merging or re-basing PR #171. Any git write in the other
checkout. Moving a ratchet baseline. Chasing the whole-program Jev score.
Web Analytics on the production domain. **Automated filing** — the rules bar it.
Weakening any gate. Naming a competitor product. Deciding the home/desktop
content cut; that is the owner's.

## Definition of done

- [ ] B1–B5 fixed, each with a test
- [ ] Showcase deployed and isolated; `npm run cf:check` green
- [ ] Cookie gate run and its result recorded either way
- [ ] Advisor verified answering live in a real browser
- [ ] Demo URL captured
- [ ] **Application filed by hand**, repository URL included
- [ ] Full local preflight green: `npm test`, `check-chars`, `seo`,
      `format:check`, `deploy:check`, `plan:check`, `gate:byte-budgets`
- [ ] Ledger rows appended with the SHA the gate actually measured
- [ ] Any unverified piece described as shipping, not shipped

## Owner decisions still open

1. **The breadth additions** (§6 of the plan) — they trade against D-04 and
   product quality. Recommended: Browser Rendering, Cron Triggers, AI Gateway,
   Analytics Engine, each tied to a real requirement.
2. **Approving A-003 as `@Treystu`** — §16 requires it. It can be written and
   opened now; the merge is gated on PR #171.