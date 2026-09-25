# Canonical production deployment runbook

This is the only supported release path for the public calculator.

## Why this exists

The site has two delivery paths: GitHub Actions publishes the GitHub Pages artifact, while Cloudflare Pages serves `bigenergyco.pages.dev`. The public domain must be checked explicitly. A green GitHub workflow or a static marker in HTML alone is not proof that the browser is running the current sizing worker and its imported modules.

The service worker also caches assets, and Cloudflare serves `assets/*` with `Cache-Control: public, max-age=31536000, immutable` (one year). Any change to JavaScript, HTML, or worker imports therefore requires BOTH:

1. A `CACHE_VERSION` bump in `sw.js` (e.g. `beco-v17`), so installed desktop clients activate a fresh cache.
2. A new `?v=` token on every asset URL in the browser module graph (static/dynamic imports, `new Worker()` URLs, `<script src>`, `/assets` data fetches).

Do NOT hand-edit tokens — one stamp covers the whole graph atomically (mixed stamps let clients mix module versions):

```bash
node scripts/bump-asset-tokens.mjs   # unified stamp + CACHE_VERSION bump
```

CI (`node scripts/bump-asset-tokens.mjs --check`) fails on token-less references or mixed stamps.

These are separate cache layers. A `CACHE_VERSION` bump alone is not enough: the worker's stale-while-revalidate refresh re-fetches through the same immutable HTTP cache, so an unchanged asset URL can never heal. Changing the URL is what makes both the HTTP cache and the service-worker cache miss.

## Preflight

From the repository root:

```bash
node scripts/check-syntax.mjs   # every shipped JS file parses
npm test                        # offline unit + contract suite
npm run seo                     # JSON-LD, chars, SEO, quality, i18n, headers/CSP, asset tokens
npm run deploy:check            # deploy allowlist is complete and staged exactly
npm run verify:flow             # cumulative-series engine flow through the real entry point
git diff --check                # local hygiene: no whitespace-damaged patch (not a CI gate)
```

Do not deploy if any command fails. Every one of these except `git diff --check`
also runs on every PR in `.github/workflows/test.yml`, so a green PR already
means they pass; run them locally when you have touched a file they cover.

## Which gate runs where

The rule this section exists to protect: **a check the docs call mandatory must
actually run, and must be able to fail.** Nothing belongs here that no automation
and no human runs — and nothing that runs may be missing from here.

| Gate                                                                                                           | Runs where                                | Can it block a merge?                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `check-syntax`, `npm run seo`, prettier, secret scan, `deploy:check`, `verify:flow`, `npm test`                | PR + `main` (`Tests` workflow)            | Yes — required checks `test`, `coverage`                                                                                                                                       |
| Real-browser smoke on the staged artifact (`smoke:local`), including silent-worker deadline and retry recovery | PR + `main` (`Tests` workflow)            | Yes — required check `web-smoke`                                                                                                                                               |
| Offline coverage floor                                                                                         | PR + `main` (`Tests` workflow)            | Yes — required check `coverage`                                                                                                                                                |
| CodeQL analysis (`analyze`)                                                                                    | PR + `main` + weekly (`CodeQL`)           | Yes — required check `analyze` (a failing run blocks)                                                                                                                          |
| **CodeQL findings** (the `code_scanning` rule)                                                                 | The ruleset itself                        | Yes — new alerts at `errors` / security `high_or_higher` block the PR                                                                                                          |
| Deployed-staging verification (`npm run verify:staging`)                                                       | `main` (`Verify staging` workflow)        | No — it is a post-merge alarm, and the promote refuses to run without it. Skipped when a merge changed no deployable file (see CI budget)                                      |
| Source-drift audit / docs-only push policy (`npm run audit:main`)                                              | `main` (`Main audit`)                     | No — post-merge alarm                                                                                                                                                          |
| `live-sanity` + `check-staging-drift`                                                                          | Weekly (`Prod smoke`)                     | No — non-blocking drift alarm                                                                                                                                                  |
| `npm run verify:live` — `validate-modes.mjs`, `validate-soc-pipeline.mjs`                                      | Weekly (`Prod smoke` → job `live-models`) | No — needs the live NASA API, so it can never join the offline PR suite                                                                                                        |
| Homepage content (Pages origin) + custom-domain + API health probes                                            | Daily (`Daily static check`)              | No — non-blocking. The custom-domain probe accepts the Cloudflare managed challenge (403 interstitial) as "up"; content drift is asserted from the challenge-free Pages origin |

**Manual by design** (nothing can run these for you, so they are not gates):

| Check                                                         | Why it cannot run in CI                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/validate-live.mjs`                                   | Live sweep of the deployed API + NASA endpoints; needs the network and tolerates upstream slowness.                                                                                                                                                                                                                               |
| `scripts/validate-against-sheet.mjs`                          | Blocked on the owner's spreadsheet export (`PHASE2_PLAN.md` tracks it as ⏳). Run it by hand against a CSV; it exits non-zero with a usage error when given no input.                                                                                                                                                             |
| `scripts/validate-jev-complete.mjs` (`npm run gate:complete`) | The Jev complete gate: scores the current tree 0-100 against the 95 (9.5/10) target across every facet, buckets the required work, and groups actions by work type. Needs the direct provider key + network for live judgment; offline it still scores deterministically from auto-collected repo facts. Run it before a promote. |
| `npm run protect:check`                                       | Reads the live GitHub ruleset, which needs admin read on the repository. Run it after any ruleset change.                                                                                                                                                                                                                         |
| `npm run smoke`                                               | Real-browser smoke against the **brand domain** — the promote runs this for you; run it by hand to check production without releasing.                                                                                                                                                                                            |

**Retired:** `verify-polish.mjs` (crashed, stale contract) → `tests/run`, `contract`, `rescale`, `breakeven`, `consistency` + `npm run verify:staging`; `verify-chart-contract.mjs` (checked a payload the worker no longer builds) → `tests/run`. `tests/gate-net.test.mjs` enforces this section.

## CI budget (free-tier runners)

CI runs on a free GitHub account, so runs are an exhaustible shared budget, not
infinite machinery. Three consequences are policy here.

**A merge costs a fan-out, not a run.** Every push to `main` starts `Tests`
(test + web-smoke + coverage), `CodeQL`, `Main audit`, `Deploy to GitHub
Pages`, and then `Verify staging` behind the deploy. So the economy is: batch
several related changes into one PR rather than opening one per edit, and keep
one PR in flight at a time. A stack of simultaneous PRs multiplies both the
fan-out and the chance of a collision — and it buys no extra safety.

**A merge that cannot change the site does not deploy or verify one.**
`Deploy to GitHub Pages` carries a `paths-ignore` list for the paths that churn
without ever being published — `docs/`, `scripts/`, `tests/`, `.github/`,
`.githooks/`, `worker/`, markdown, `package.json`. Because `Verify staging`
fires on that workflow completing, both are skipped together, and a docs-only
ledger commit stops costing a build, a publish and a full browser smoke for
byte-identical output. The list is a denylist, so anything not named still
deploys, and `tests/ci-resilience.test.mjs` checks every entry against the real
deploy allowlist — an entry that would cover a deployable file fails the suite
rather than quietly skipping a release. Nothing is left unverified by this:
when a release actually happens, `scripts/promote.mjs` runs the same verifier
itself, and the weekly `Prod smoke` still checks staging drift.

**Every job declares its own cap.** A job without `timeout-minutes` inherits
GitHub's 6-hour default, and one hung step occupying a runner that long is how
a queue backlog compounds. Measured durations on 2026-09-19: Tests ~5m, web-smoke
~1m, coverage ~1.5m, CodeQL ~1m, Deploy ~13s, Main audit ~6s, daily static ~5s,
weekly smoke ~16s, live-models ~10s, Verify staging ~1m — each cap sits well
above its measured duration with room for a runner-cold start, and
`tests/ci-resilience.test.mjs` fails the suite if any workflow job ever drops
its cap again.

**Supersede, do not stack.** `Tests`, `CodeQL`, `Main audit` and `Deploy` all
carry concurrency groups that cancel a superseded run for the same ref, so a
fast merge train keeps only the newest. `Verify staging` deliberately does _not_
cancel in progress: each of its runs is evidence about one deployed stamp, and
cancelling it would throw away evidence the promote path reads.

**Never cancel a `pull_request` run to free capacity.** A cancelled check run
shadows a passing one for required-status purposes — that is how a PR ends up
BLOCKED with every check green, the trap documented in
`.github/workflows/test.yml`. Queued `main` runs _are_ safe to cancel, which is
why the remedy below is `main`-scoped by construction.

### Resilience to the failure modes that have cost real time

One is automatic, the other is deliberately on demand — and the second is a
retirement, not an omission. A scheduled `workflow-watchdog.yml` existed to
cancel-and-requeue stalls unattended. It produced **zero** runs, and measuring
why showed the premise was wrong for this account: every scheduled run it is
possible to observe fires **hours late** — the `0 7 * * *` daily check has run
at 11:24–13:32 on eight consecutive days (4.4–6.5 h late) and the `0 8 * * 1`
weekly sweep at 13:44–14:30 (5.7–6.5 h late). An hourly cron here cannot
deliver timely unattended remediation, so the component was removed rather than
left unprovable; it also held a cancelling act path that cannot be exercised
without manufacturing the load it was meant to protect. What is left is the
tool, run when a stall is actually noticed — which is when it matters, since
nothing user-facing waits on a stalled run and `promote` runs its own staging
verification.

| Failure mode                                                          | Observed                                                                                                                                                                                                  | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A run sits `queued` for tens of minutes with no runner ever allocated | 2026-09-19 — ~45 min, unstuck by hand with cancel + rerun                                                                                                                                                 | **On demand:** `node scripts/unstick-queued-runs.mjs` (`--dry-run` to preview). Start with `--check-permissions`, a side-effect-free probe that answers "may this token cancel?": it aims a cancel at a run id that cannot exist, so 404 means authorised and 403 means not — the probe exists because an operator's `gh` login is a different credential from a run's token. Selection guards are enforced in `scripts/lib/stuck-runs.mjs` and pinned by `tests/ci-resilience.test.mjs`: only `main` runs are candidates (a cancelled PR check run would shadow a passing one), only runs queued past 20 minutes, never a run whose own workflow has one in progress (legitimate concurrency queueing, not a stall), at most 3 per pass, and a full stand-down above 8 stuck runs because that is a platform incident where cancelling would amplify the load instead of clearing it.                                                              |
| A step fails on a transient transport error                           | `ERR_CERT_VERIFIER_CHANGED` loading `chat.js` from Pages in the post-merge `Verify staging` run; it passed on rerun and passes locally                                                                    | `scripts/verify-staging.mjs` retries **only** transport-class failures (`scripts/lib/transient-retry.mjs`): three attempts, linear backoff, and every retry is recorded in the console and under `transientRetries` in the JSON verdict. The rule covers the wording the browser actually emits, not just `fetch`'s: Chrome's `the server responded with a status of 503` (a navigation 5xx is the case that once turned a flake into a red run while parity absorbed it), its `net::ERR_*` network family, and the smoke's own CDP timeout — each copied from a captured string, each pinned by a fixture. `net::ERR_ABORTED` and `net::ERR_BLOCKED_BY_*` are deliberately excluded: those mean the page cancelled the request, which is an assertion about the artifact. A 404, a changed byte, a stale stamp, a dropped header, a missing element or a page exception is never retried, so a deterministic regression still fails every attempt. |
| A run is killed by an outer timeout before it can report a verdict    | three smoke attempts allowed 3 × 15 min of browser smoke inside a 25-min job and a 20-min promote cap, so a slow transport failure was killed mid-retry — and "killed" is indistinguishable from "passed" | **A total wall-clock deadline, enforced in code.** The retry loop stops at a deadline rather than spending attempts; see the budget algebra below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

None of these can turn a red gate green: the remedy only re-queues work
that was already going to run, a retry re-runs the same assertions, and a run
that exhausts its budget **fails** rather than reporting success.

**The budget algebra.** `scripts/lib/budgets.mjs` is the one owner of these
numbers, and `tests/ci-resilience.test.mjs` pins them _and_ the workflow literal
together, so editing one alone fails the suite instead of reopening the hole:

| Limit                                      | Value  |
| ------------------------------------------ | ------ |
| verifier's total budget (retries included) | 15 min |
| plus room for startup and reporting        | 2 min  |
| promote's subprocess cap                   | 20 min |
| `Verify staging` job (`timeout-minutes`)   | 25 min |

The verifier clamps every request — and the browser smoke's own timeout — to
`min(ceiling, budget left)`, so 15 + 2 minutes is the true worst case, not three
attempts times fifteen. When the budget runs out the report says so: it names
the step that did not run, reports the retries it did make, and counts files it
never fetched as **not checked** rather than claiming they match or differ.
`promote` refuses at startup if its cap ever stops fitting the budget, and
reports a genuine kill as a kill rather than as a verification failure.
A proof can compress the budget (`VERIFY_BUDGET_MS=8000 node
scripts/verify-staging.mjs …`); it is clamped to the declared budget, so it can
only make a run fail sooner, never last longer.

## Release

1. Commit only the intended source and runbook changes.
2. If the catalog price stamps (`POWMR_CATALOG.checkedDate`, `PRICES_CHECKED`)
   are near a year old, re-verify against the PowMr catalog and bump them —
   `tests/pricing.test.mjs` fails past 366 days.
3. Ship the source changes through the protected PR path: create a dedicated
   branch, open a PR against `main`, and merge only after required CI checks
   pass. Never push a commit directly to `main`.
4. Wait for both GitHub Actions workflows for the exact pushed SHA:

```bash
gh run list --branch main --limit 2 --json workflowName,status,conclusion,headSha,url
```

5. Verify what staging actually SERVES (not a localhost copy): one asset stamp
   matching the checkout, byte parity for every file in the deploy allowlist,
   platform surface rules, and a real-browser smoke against that URL. CI runs
   the same verifier automatically after `Deploy to GitHub Pages`.

```bash
npm run verify:staging
```

6. Promote with the gated tool. It re-runs the verification above against the
   staging URL and refuses to deploy if any of it fails, if the tree is dirty,
   or if HEAD is not `origin/main`:

```bash
npm run promote                 # dry run (default): prints the plan, the stamps and the record
npm run promote:apply           # deploy (needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)
npm run promote:apply:oauth     # deploy using an existing `npx wrangler login` session
```

The deploy runs wrangler through `scripts/lib/npx.mjs`, which executes npm's
npx CLI with the current node binary. Do not replace that with a bare
`execFileSync("npx", ...)`: on Windows the shim is `npx.cmd`, the bare name
raises `ENOENT`, and the tool would refuse after building the artifact but
before deploying it.

Record the deployment URL printed by Wrangler. Every apply appends a record to
`docs/release-ledger.jsonl`: the promoted SHA and stamp, the pre-promote and
post-promote stamps of both production surfaces, and the rollback command.
To undo a release:

```bash
npm run rollback -- <sha> --apply
```

7. Prove the security policy landed on the **Cloudflare** surface. `_headers` is
   Cloudflare-only — GitHub Pages serves the artifact verbatim — so CSP,
   X-Frame-Options, nosniff and COOP/CORP can only be asserted there:

```bash
node scripts/verify-staging.mjs --base https://freeoffgridcalculator.com/
node scripts/verify-staging.mjs --base https://bigenergyco.pages.dev/
```

Without Cloudflare credentials the promote stops before the deploy step and
prints the exact command to run; it never reports a release it did not make.

## API abuse hardening (Worker + WAF)

`/api/chat` is public and unauthenticated. Enforcement is layered:

1. **Per-minute cap** — the `RL_CHAT_PER_MIN` rate-limiting binding in
   `worker/wrangler.json` (8 req/min per IP), checked before any paid Groq call.
   This is Cloudflare's GA rate-limiting infrastructure (the recommended
   enforcement), but counters are **per Cloudflare location and eventually
   consistent** — a distributed flood slightly exceeds 8/min before converging.
2. **Soft in-isolate caps** — 150/day per IP + 3000/day global in
   `worker/index.js` (`checkRateLimit`). These reset on isolate eviction, so
   they brake bursts but are not hard guarantees. (The binding API supports
   only 10 s / 60 s periods, so daily caps cannot be bindings.)
3. **No dashboard WAF rule** — WAF rate-limiting rulesets attach to zones in
   this account, but the API hostname lives on Cloudflare's `workers.dev`
   zone, so there is nothing to attach them to. If abuse ever outgrows layers
   1–2, the fix is a custom domain for the Worker on an owned zone (then add
   zone rate-limiting rules for `POST /api/chat`: 8/60 s per IP, 150/24 h per
   IP) — not a dashboard tweak that exists today. Do not document one.

Verify limits live via `/api/health` (returns the enforced numbers and the
`promptVersion` now pinned there) and `tests/worker.test.mjs` (runs in CI).

## Zone settings (dashboard-only; no API credentials in this repo)

The wrangler OAuth used for Pages deploys carries `zone:read` only and the
Cloudflare API rejects even settings reads for the brand zone, so these four
toggles are deliberate dashboard actions (freeoffgridcalculator.com → the
listed screen). Each was verified live on 2026-09-18:

| Setting                       | Where                         | Status     | Why                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------- | ----------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `always_use_https`            | SSL/TLS → Edge Certificates   | confirm ON | http:// already 301s; the toggle makes it authoritative for every edge PoP                                                                                                                                                                                                                                                                                                                                                              |
| **Cache Rule: cache `.json`** | Rules → Cache Rules           | **create** | `.json` is not in Cloudflare's default cacheable-extension list, so `/assets/**.json` served `DYNAMIC` even with the immutable `_headers` rule. Rule: `http.request.uri.path matches "^/assets/.*\\.json$"` → Eligible for cache, Edge TTL: respect origin (the immutable `_headers` value). Then verify `curl -sI https://freeoffgridcalculator.com/assets/js/sizing/city-data/DE.json` twice → second response `cf-cache-status: HIT` |
| Early Hints                   | Speed → Optimization          | confirm ON | `index.html` now preloads site.css and module-preloads ui.js; Early Hints turns them into a 103                                                                                                                                                                                                                                                                                                                                         |
| WAF block `/wp-admin`         | Security → WAF → Custom rules | create     | Bot scanners; expression `(http.request.uri.path contains "/wp-admin")` → Block, so the junk never reaches Pages origin                                                                                                                                                                                                                                                                                                                 |

Auto Minify was retired by Cloudflare (dashboard sunsetting 2024–2025) and is
not pursued; content is already hand-minified where it matters, and zone
minification would break the byte-parity release gate in
`scripts/verify-staging.mjs`.

Do not mistake first-`MISS` on `.js` assets after a deploy for the old
"everything is dynamic" state: repeat requests are `HIT` (immutable 1-year
`_headers` rule). The analytics regression to fix is the `.json` Cache Rule.

## Content-Security-Policy endpoint registry

`_headers` ships a CSP. Every third-party endpoint the app touches at runtime
must be listed there AND probed by `scripts/browser-smoke.mjs` — the smoke
run is what catches a missing entry (currency/geocoder/map silently break
otherwise). Current registry:

| Use                | Endpoint                                                            | CSP directive          |
| ------------------ | ------------------------------------------------------------------- | ---------------------- |
| Weather            | `power.larc.nasa.gov`                                               | connect-src            |
| AI advisor         | `bigenergyco-api.bigenergyco.workers.dev` (+ `*.workers.dev` spare) | connect-src            |
| FX rates           | `open.er-api.com`                                                   | connect-src            |
| Online city lookup | `nominatim.openstreetmap.org`                                       | connect-src            |
| Heatmap library    | `unpkg.com` (SRI-pinned)                                            | script-src + style-src |
| Heatmap tiles      | `*.basemaps.cartocdn.com`                                           | img-src                |

Adding a new external call = update `_headers` + the smoke probes + this table.

## Production verification

Run the live sweep. It must use `https://freeoffgridcalculator.com/`, never a GitHub Pages fallback URL:

```bash
node scripts/live-sanity.mjs
```

Then verify what the brand domain actually serves. The automated form is
`node scripts/verify-staging.mjs --base https://freeoffgridcalculator.com/`
(byte parity over the whole deploy allowlist, the served asset stamp, platform
surface rules, and a real-browser smoke). The by-hand spot check, which bypasses
immutable asset caching with a query string, is:

```bash
curl -sS 'https://freeoffgridcalculator.com/assets/js/sizing/run.js?verify=SHA' | sha256sum
sha256sum assets/js/sizing/run.js
curl -sS 'https://freeoffgridcalculator.com/assets/js/sizing/ui.js?verify=SHA' | sha256sum
sha256sum assets/js/sizing/ui.js
```

The hashes must match. Also verify `sw.js` serves the new cache version.

## Required browser smoke test

The approved tooling is `scripts/browser-smoke.mjs` (zero dependencies —
drives the installed Chrome/Edge over CDP with Node built-ins only):

```bash
npm run smoke
# or: node scripts/browser-smoke.mjs https://freeoffgridcalculator.com/
```

It performs the flow below verbatim (Honolulu, kWh/day mode, 10 kWh,
grid-tie, positive tariff) plus the custom-cut slider re-slice, an off-grid
run, external-integration probes (FX, NASA, geocoder, API health), the
heatmap page (Leaflet/tiles), a silent sizing-worker deadline followed by a
successful explicit retry, an explicit no-CSP-violations gate, and a general
console/page-error gate. Exit 0 required.

A release is not verified until a real browser run against `https://freeoffgridcalculator.com/` has completed:

1. Open the public URL in a clean desktop context.
2. Choose a city, use **I know my kWh/day**, enter `10`, keep **Cut my bill, stay connected**, and leave the estimated/entered grid price positive.
3. Click **Show my options**.
4. Confirm the result card has **Total 20-year cost** and the page contains **What does solar really save you?**.
5. Confirm the savings box does **not** say `Savings data unavailable for this result`.
6. Confirm `cumCostCanvas` has a non-zero width/height and `cumCostCaption` contains the running-cost explanation.
7. Capture the browser console and network log; there must be no worker/module errors.

If browser automation is unavailable, do not claim browser verification. Run `npm run smoke` on any machine with Chrome/Edge installed, or have an operator perform the exact smoke test and attach evidence.

## Troubleshooting checklist

- If the fallback message appears while **Total 20-year cost** is present, inspect the worker payload: every solvable result with a valid grid baseline must carry `cumCostSeries`.
- If production source differs from local source, the wrong artifact was deployed or an immutable asset URL was reused. Rebuild the allowlist and redeploy.
- If only one device type is stale, an asset URL was reused across deploys: run `node scripts/bump-asset-tokens.mjs`, deploy, close all site tabs, and repeat the clean browser test.
- Verify tokens are unified: `node scripts/bump-asset-tokens.mjs --check` must pass (it is also a CI gate).
- Verify no changed asset still carries an old `?v=` token: `git diff db73ee4..HEAD --name-only -- 'assets/*' 'index.html'` must be covered by new tokens.
- Do not report “live” based only on HTML markers, HTTP 200, GitHub Actions, or a local preview.

## Offline scope (what the service worker actually guarantees)

The precache shell is `index.html`, manifest, icon, blog hub, and the
calculator hub (`sw.js` SHELL). City partitions, bundled profiles, and
heatmap tiles are fetched on demand and cached per visited site — deep
offline works for visited locations, not the whole world. Do not precache
the ~11 MB data set blindly; if offline scope ever changes, update this
section, the SHELL list, and the smoke SW gate together.

## Release evidence

Record the commit SHA, workflow URLs, Cloudflare deployment URL, test count, live-sanity result, source hashes, service-worker cache version, and browser smoke-test result in the release note or issue.
