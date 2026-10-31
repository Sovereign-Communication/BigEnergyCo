## Plan items

**P0.1** — the item that put the push guards in place ("`docs/plan/**` made PR-only in the push guards"), whose server-side half is `.github/workflows/main-audit.yml` + [scripts/direct-push-audit.mjs](scripts/direct-push-audit.mjs). This repairs that guard's judgement; it delivers no new requirement ID and closes nothing.

## What changed and why

`Main audit` inspects **every commit in a pushed range, one at a time**, and its only signal was the commit's own subject. A PR merged with a merge commit puts the PR's own branch commits in that range — and those commits carry no PR trailer, because a trailer is exactly what a branch commit cannot have. So every non-documentation PR landed by merge commit was reported as a violation. Measured on `main` before this change: **4 of the last 10 `Main audit` runs are red** for that reason, including the run for `fece02c`, which says

```
FAIL 960cdb81 "chore(format): prettier the Cloudflare Pages deploy workflow" reached main without a PR and touched:
     - .github/workflows/cf-pages-deploy.yml
MAIN AUDIT: 2 commit(s) — 1 via PR, 0 docs-only, 1 violation(s)
```

The deliverable PR #220's own commit is described there as having reached `main` "without a PR" — which is false, and the check's own wording says so.

The fix asks a second question, of the graph: **which commits did that merge bring in?** `prDeliveredShas()` ([scripts/lib/release.mjs](scripts/lib/release.mjs)) answers it — for each merge commit whose subject names a PR, the commits reachable from its non-first parents but not from its first. Those are delivered by the PR that landed them and are no longer judged as direct pushes. Every commit with no such delivery is judged exactly as before, so the check is narrowed to its claim, not weakened:

- a direct push of a non-documentation commit still fails;
- a range containing a merge **plus** a commit typed on top of it still fails, and blames only the direct commit;
- a merge that names no PR still fails, and launders nothing;
- the docs-only exemption is untouched (no new patterns, no widened forgiveness).

### Proven both ways, in a throwaway clone, with real git operations

Direct fast-forward commit onto `main`, then the range audited as the workflow would audit it:

```
FAIL b588e491 "chore: a direct commit" reached main without a PR and touched:
     - scripts/direct-push.mjs
MAIN AUDIT: 1 commit(s) — 0 via PR, 0 docs-only, 1 violation(s)     exit 1
BLOCKED: refusing a direct push to main with non-documentation changes.   (pre-push guard, exit 1)
```

Reverted (`git reset --hard`, clean tree), then the PR-merge shape — a branch commit with no trailer of its own, landed by a merge that names its PR:

```
MAIN AUDIT: 2 commit(s) — 2 via PR, 0 docs-only, 0 violation(s)     exit 0
```

And on the real range that failed on `main` (`0454e74..fece02c`, the PR #220 push):

```
MAIN AUDIT: 2 commit(s) — 2 via PR, 0 docs-only, 0 violation(s)     exit 0
```

Seven new tests in [tests/release-safety.test.mjs](tests/release-safety.test.mjs) run the **real script** over real throwaway repositories: direct push (violation), PR-merge delivery (pass), merge without a PR trailer (violation), direct commit alongside a merge (violation, blaming the direct commit alone), docs-only (pass), `prDeliveredShas` naming only the merge's own side, and the limit below.

### The limit, recorded rather than hidden

A merge commit **created locally** with a fabricated `Merge pull request #N` subject is indistinguishable from a GitHub merge on the evidence available here — the object graph and the commit message. That ambiguity is older than this function: the merge commit itself has always been forgiven by `hasPrReference`. Settling it needs `/commits/{sha}/pulls`, i.e. a token and a network call inside the audit; that trade was not taken, and the cost is bounded to commits under a fabricated trailer. It is written into `prDeliveredShas` and asserted by a test named `LIMIT: a locally fabricated PR merge cannot be told from a real one`, so the hole is visible instead of implied.

## Definition of done (plan §9)

- [x] Tests added/updated for every change; coverage not lowered — 7 new gates, all exercising the real script; no existing test or assertion changed.
- [x] Preflight — `npm run format:check` green, `node scripts/check-syntax.mjs` green (296 files), `node scripts/check-plan-pin.mjs` PLAN PIN OK; `npm test` locally **1668/1669**, the single failure being the pre-existing Windows-only `stageFromIndex` CRLF assertion that passes on the Linux runner (the same one PR #220 ran into). `seo`, `deploy:check` and the rest of the `test` job run on this PR.
- [x] No metric regressed vs the latest ledger baseline; phase absolute thresholds met — no shipped byte changes; `scripts/**` and `tests/**` are not in the deploy allowlist, so the served stamp and every quality metric are untouched.
- [ ] Scoped live Jev report attached — this PR's `jev-complete` run will report its own numbers (the gate is unchanged by this PR; the program sits short of 99 per `#189`, and that is program-wide work).
- [ ] `docs/plan/LEDGER.jsonl` row appended — deliberately omitted: this repairs a guard rather than delivering a plan item, and the ledger's rows are for plan items. Flagged, not silently skipped.
- [x] Release rules followed if shipping — nothing ships: no deployable path is touched, so no `CACHE_VERSION` or asset-token bump applies.
- [ ] Tracking issue ticked — same reason as the ledger row.

## Separately, a finding from the earlier recon (no change made here)

`Prod smoke` (`.github/workflows/scheduled-smoke.yml` → [scripts/live-sanity.mjs](scripts/live-sanity.mjs)) has been red since 2026-09-28. That is reported in full in its own comment below; it is not this PR's business and is not touched by it.
