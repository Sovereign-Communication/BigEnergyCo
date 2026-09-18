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

| Gate                                                                                            | Runs where                                | Can it block a merge?                                                    |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------ |
| `check-syntax`, `npm run seo`, prettier, secret scan, `deploy:check`, `verify:flow`, `npm test` | PR + `main` (`Tests` workflow)            | Yes — required checks `test`, `coverage`                                 |
| Real-browser smoke on the staged artifact (`smoke:local`)                                       | PR + `main` (`Tests` workflow)            | Yes — required check `web-smoke`                                         |
| Offline coverage floor                                                                          | PR + `main` (`Tests` workflow)            | Yes — required check `coverage`                                          |
| CodeQL analysis (`analyze`)                                                                     | PR + `main` + weekly (`CodeQL`)           | Yes — required check `analyze` (a failing run blocks)                    |
| **CodeQL findings** (the `code_scanning` rule)                                                  | The ruleset itself                        | Yes — new alerts at `errors` / security `high_or_higher` block the PR    |
| Deployed-staging verification (`npm run verify:staging`)                                        | `main` (`Verify staging` workflow)        | No — it is a post-merge alarm, and the promote refuses to run without it |
| Source-drift audit / docs-only push policy (`npm run audit:main`)                               | `main` (`Main audit`)                     | No — post-merge alarm                                                    |
| `live-sanity` + `check-staging-drift`                                                           | Weekly (`Prod smoke`)                     | No — non-blocking drift alarm                                            |
| `npm run verify:live` — `validate-modes.mjs`, `validate-soc-pipeline.mjs`                       | Weekly (`Prod smoke` → job `live-models`) | No — needs the live NASA API, so it can never join the offline PR suite  |
| Homepage + API health curl probes                                                               | Daily (`Daily static check`)              | No — non-blocking                                                        |

**Manual by design** (nothing can run these for you, so they are not gates):

| Check                                | Why it cannot run in CI                                                                                                                                               |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/validate-live.mjs`          | Live sweep of the deployed API + NASA endpoints; needs the network and tolerates upstream slowness.                                                                   |
| `scripts/validate-against-sheet.mjs` | Blocked on the owner's spreadsheet export (`PHASE2_PLAN.md` tracks it as ⏳). Run it by hand against a CSV; it exits non-zero with a usage error when given no input. |
| `npm run protect:check`              | Reads the live GitHub ruleset, which needs admin read on the repository. Run it after any ruleset change.                                                             |
| `npm run smoke`                      | Real-browser smoke against the **brand domain** — the promote runs this for you; run it by hand to check production without releasing.                                |

**Retired:** `verify-polish.mjs` (crashed, stale contract) → `tests/run`, `contract`, `rescale`, `breakeven`, `consistency` + `npm run verify:staging`; `verify-chart-contract.mjs` (checked a payload the worker no longer builds) → `tests/run`. `tests/gate-net.test.mjs` enforces this section.

## Release

1. Commit only the intended source and runbook changes.
2. If the catalog price stamps (`POWMR_CATALOG.checkedDate`, `PRICES_CHECKED`)
   are near a year old, re-verify against the PowMr catalog and bump them —
   `tests/pricing.test.mjs` fails past 366 days.
3. Push to `main`.
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
heatmap page (Leaflet/tiles), an explicit no-CSP-violations gate, and a
general console/page-error gate. Exit 0 required.

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
