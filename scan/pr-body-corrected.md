## Plan items

**P0.4** (measurement gates / CI greenness) — this repairs the required `test` job's own gates on `main`. The `ci_green` clause the Jev record reads is composed from the workflow's own job outcomes (ledger ref `P0.4c-ci-green`), and on `main`'s tip it could not be anything but false. No requirement ID is claimed as delivered: this PR repairs a defect, it does not deliver a plan bullet.

## What changed and why

One file, two characters of quoting:

```diff
--- a/.github/workflows/cf-pages-deploy.yml
+++ b/.github/workflows/cf-pages-deploy.yml
@@ -4,9 +4,9 @@ on:
   workflow_dispatch:
     inputs:
       target:
-        description: 'Deploy target (staging or production)'
+        description: "Deploy target (staging or production)"
         required: true
-        default: 'staging'
+        default: "staging"
         type: choice
```

`main`'s tip `0454e74` ("feat(ci): Cloudflare Pages deploy workflow") was pushed **directly to main** and carried this file unformatted. Prettier's YAML default is double quotes, so the file fails `npm run format:check`, which is the `test` job's **Prettier check** step (`.github/workflows/test.yml:91`) — and that step sits *before* **Unit tests (offline)** (`:114`).

Measured consequence, from `main`'s own CI run `38476326519` at head `0454e74`: the `test` job fails at "Prettier check", and the job's own recorded artifact reads

```json
{"seo":"success","prettier":"failure","unit_tests":"skipped"}
```

so the suite was **skipped, not passing** — and `jev-complete`, which needs `test`, was skipped with it.

### Reproduced on main's committed bytes, then fixed

In a clean worktree at `0454e74` (fresh checkout, zero local edits):

```
$ npm run format:check
[warn] .github/workflows/cf-pages-deploy.yml
[warn] Code style issues found in the above file. Run Prettier with --write to fix.
format: FAILED (prettier exited 1) on the tracked tree as the runner sees it.
EXIT=1
```

After running the repository's own fix command — the one the failure message names (`npm run format`):

```
format: rewrote 1 file(s) in the working tree
$ npm run format:check
All matched files use Prettier code style!
format: OK - 700 tracked file(s) formatted as the runner will read them
EXIT=0
```

`git diff --stat` after `npm run format` is **1 file changed, 2 insertions(+), 2 deletions(-)**. No unrelated file was reformatted, no ignore/exclusion was added, and the check itself was not touched or weakened.

### Unit tests, actually executed

Locally, `npm test` on the fixed tree (pristine worktree, no local edits): **1662 tests, 1661 pass, 1 fail**. The one failure is `tests/deploy-blobs.test.mjs` → "stageFromIndex writes committed bytes and excludes a local edit", a pre-existing **Windows-checkout** artifact of this change's absence: the test asserts `staged === backup`, where `staged` is written from the index (LF) and `backup = readFileSync(join(ROOT, "robots.txt"))` is the **working tree** bytes — CRLF on a machine with `core.autocrlf=true`. On the Linux runner they agree.

In CI, from this PR's own job artifact `jev-results-test`:

```json
{"job":"test","conclusion":"success","steps":{"seo":"success","prettier":"success","unit_tests":"success"},
 "measurements":{"tests_total":1662,"tests_passed":1662,"tests_failed":0,"tests_skipped":0}}
```

**1662/1662, actually run** — the step that `main` was skipping.

## Definition of done (plan §9)

- [x] Tests added/updated for every change; coverage not lowered — n/a for a formatting-only change to a workflow file that ships no artifact. The repository's own formatting gate is the test, and it now passes. No test was weakened, skipped, deleted or suppressed.
- [x] Preflight — `format:check` measured here on both sides (red on `main`'s bytes, green after the fix) and `npm test` run here (1661/1662 locally, 1662/1662 in CI); `check-chars`, `seo`, `deploy:check`, `plan:check` all ran green in this PR's `test` job.
- [x] No metric regressed vs the latest ledger baseline; phase absolute thresholds met — no shipped byte changes: `.github/**` is not in the deploy allowlist, so the served stamp, byte and request budgets, and every quality metric are untouched. The live gate's own verdict agrees: **ratchet: met**.
- [x] Scoped live Jev report: **it ran**, and this is the first PR in weeks to reach a real judgment — `jev-complete` on this PR reports `live: provider=typesafe fallback=false cost=$0.000003`, scope P0.4, **scoped 94.75/100 (target 99), whole program 95.71/100 (target 99), ratchet met**, short of proven on `accessibility`, `performance`, `quality`. The job is red on that score bar, which is genuine remaining program work (see `#189`: 17 of 21 facets unproven), not a defect of this change. The evidence build above it is green on every record it composes: `tests_green=true prettier_clean=true seo_green=true smoke_green=true ci_green=true legacy_gates_green=true`.
- [ ] `docs/plan/LEDGER.jsonl` row appended — deliberately **not** in this PR. This is a repair of a red landing target, scoped to the smallest change that makes the failing step pass; a ledger row is also the file the `docs/ledger-p1-3` branch is mid-edit on. Flagged rather than silently skipped.
- [x] Release rules followed if shipping (SW `CACHE_VERSION` + asset tokens) — nothing ships: this is a workflow definition, not a deployed byte, so no stamp or cache bump applies.
- [ ] Tracking issue ticked — same reason as the ledger row: not ticked here.

## Found while doing this (no change made)

1. **`Main audit` is red on `main` for the same commit.** Run `38476326658` fails "Direct pushes to main must be documentation-only" and prints the offending path: `.github/workflows/cf-pages-deploy.yml`. Landing subsequent work through the PR path is the cure for future pushes.
2. **`main` is not branch-protected.** `gh api repos/Sovereign-Communication/BigEnergyCo/branches/main/protection` → 404 "Branch not protected", so nothing on the server stopped the direct push that broke `main`. `npm run protect` exists for exactly this.
3. **`gh secret list` returns empty for this token** (exit 0, no error), which is *not* evidence that no secret exists — the list needs admin rights. The run above is the evidence it matters: `TYPESAFE_API_KEY` was provided to the job (masked) and a live judgment was made with it, so **O-01 has in fact landed** and the "red until O-01" comment at `.github/workflows/test.yml:600` is now stale. Whether `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` exist for `cf-pages-deploy.yml` cannot be read from here and is unverified.
