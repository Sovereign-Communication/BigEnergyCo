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
node --check assets/js/sizing/ui.js
node --check assets/js/sizing/run.js
node --check assets/js/sizing/sizing-worker.js
node --test
git diff --check
node scripts/deploy-pages-local.mjs --check
node scripts/verify-cumulative-flow.mjs
```

Do not deploy if any command fails.

## Release

1. Commit only the intended source and runbook changes.
2. Push to `main`.
3. Wait for both GitHub Actions workflows for the exact pushed SHA:

```bash
gh run list --branch main --limit 2 --json workflowName,status,conclusion,headSha,url
```

4. Build the allowlisted artifact and deploy that artifact to the actual Cloudflare Pages project:

```bash
node scripts/deploy-pages-local.mjs --check
npx --yes wrangler pages deploy _pages_staging --project-name bigenergyco --branch main
```

Record the deployment URL printed by Wrangler.

## Production verification

Run the live sweep. It must use `https://bigenergyco.pages.dev/`, never a GitHub Pages fallback URL:

```bash
node scripts/live-sanity.mjs
```

Then verify deployed source matches the checkout, bypassing immutable asset caching with a query string:

```bash
curl -sS 'https://bigenergyco.pages.dev/assets/js/sizing/run.js?verify=SHA' | sha256sum
sha256sum assets/js/sizing/run.js
curl -sS 'https://bigenergyco.pages.dev/assets/js/sizing/ui.js?verify=SHA' | sha256sum
sha256sum assets/js/sizing/ui.js
```

The hashes must match. Also verify `sw.js` serves the new cache version.

## Required browser smoke test

A release is not verified until a real browser run against `https://bigenergyco.pages.dev/` has completed:

1. Open the public URL in a clean desktop context.
2. Choose a city, use **I know my kWh/day**, enter `10`, keep **Cut my bill, stay connected**, and leave the estimated/entered grid price positive.
3. Click **Show my options**.
4. Confirm the result card has **Total 20-year cost** and the page contains **What does solar really save you?**.
5. Confirm the savings box does **not** say `Savings data unavailable for this result`.
6. Confirm `cumCostCanvas` has a non-zero width/height and `cumCostCaption` contains the running-cost explanation.
7. Capture the browser console and network log; there must be no worker/module errors.

If browser automation is unavailable, do not claim browser verification. Install/use the project's approved browser tooling or have an operator perform the exact smoke test and attach evidence.

## Troubleshooting checklist

- If the fallback message appears while **Total 20-year cost** is present, inspect the worker payload: every solvable result with a valid grid baseline must carry `cumCostSeries`.
- If production source differs from local source, the wrong artifact was deployed or an immutable asset URL was reused. Rebuild the allowlist and redeploy.
- If only one device type is stale, an asset URL was reused across deploys: run `node scripts/bump-asset-tokens.mjs`, deploy, close all site tabs, and repeat the clean browser test.
- Verify tokens are unified: `node scripts/bump-asset-tokens.mjs --check` must pass (it is also a CI gate).
- Verify no changed asset still carries an old `?v=` token: `git diff db73ee4..HEAD --name-only -- 'assets/*' 'index.html'` must be covered by new tokens.
- Do not report “live” based only on HTML markers, HTTP 200, GitHub Actions, or a local preview.

## Release evidence

Record the commit SHA, workflow URLs, Cloudflare deployment URL, test count, live-sanity result, source hashes, service-worker cache version, and browser smoke-test result in the release note or issue.
