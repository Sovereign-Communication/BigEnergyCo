# BigEnergyCo — free worldwide solar & battery estimator

A free, no-signup AI tool for roughly sizing off-grid solar and battery systems.
Built and given away by Lucas Ballek. Nothing for sale.

## Project status

BigEnergyCo is permanently free and donation-supported. It sells no products or services, accepts no leads, and has no commercial files or procurement workflow.

## Where it runs

| Piece | Where | Notes |
|---|---|---|
| **Public site (brand)** | `bigenergyco.pages.dev` (Cloudflare Pages) | Primary brand domain. Same allowlisted build, deployed to the `bigenergyco` Pages project per the runbook below (`node scripts/deploy-pages-local.mjs --check` + `npx wrangler pages deploy`). Served with `_headers`/`_redirects` for caching and legacy-domain consolidation. |
| **Public site (legacy)** | `sovereign-communication.github.io/BigEnergyCo/` | Legacy GitHub Pages URL — 301 redirects to brand domain via `_redirects` (Cloudflare Pages). Deploys via the allowlist workflow (`.github/workflows/deploy.yml`). The old `treystu.github.io/BigEnergyCo/` URL also redirects here; both remain on the API's CORS allowlist for cached clients. |
| **AI API** | Cloudflare Worker (`bigenergyco-api.bigenergyco.workers.dev`) | Proxies Groq. CORS-locked to the Pages origins + localhost, rate-limited, payload-capped. Deploy with `deploy_worker.bat` (or `npx wrangler deploy` in `worker/`). |
| **Local/dev** | Any static HTTP server | The public site is a static Pages build; no local tunnel or alternate runtime is required.

## Deploy runbook — GitHub first, then Cloudflare

**Rule: `main` first — always, no exceptions.** Every change — even a one-word
copy tweak — ships to `main` and passes the GitHub `Tests` workflow before the
brand domain is touched. GitHub is the source of truth and the gatekeeper;
Cloudflare (`bigenergyco.pages.dev`) is the last-mile copy of the *same* build.

> ❗ Never deploy straight to Cloudflare from a working tree, and never skip the
> GitHub step to "save time" or because "it's just copy". If a change hasn't
> gone through `main` and come out green, the brand domain does not ship it.
> Getting burned once (a fix deployed to the brand domain without the GitHub
> gate) is exactly why this rule is absolute.

1. **Run the checks locally** (what CI runs):
   ```bash
   npm test
   node scripts/validate-jsonld.mjs
   node scripts/check-chars.mjs
   node scripts/deploy-pages-local.mjs --check
   ```
2. **Commit everything on `main`, then push** — this triggers the `Tests`
   workflow (matching the local checks above) and the `Deploy to GitHub Pages`
   allowlist workflow (`.github/workflows/deploy.yml`) which publishes the
   legacy URL `sovereign-communication.github.io/BigEnergyCo/`.
   ```bash
   git add -A
   git commit -m "..."
   git push origin main
   ```
3. **Verify GitHub is green** before proceeding — watch both runs to completion:
   ```bash
   gh run list
   gh run watch <test-run-id> --exit-status
   gh run watch <deploy-run-id> --exit-status
   ```
4. **Only now publish the brand domain** to Cloudflare Pages. Build the exact
   same allowlisted staging output (`--check` builds staging without touching
   the `gh-pages` branch — GitHub Actions already handled that), then deploy it
   to the `bigenergyco` Pages project:
   ```bash
   node scripts/deploy-pages-local.mjs --check   # builds _pages_staging/
   npx wrangler pages deploy _pages_staging --project-name bigenergyco
   ```
   Verify at `https://bigenergyco.pages.dev`.

   > The API Worker is a separate concern: only redeploy it
   > (`cd worker && npx wrangler deploy`) when `worker/index.js` actually
   > changed. Front-end site changes never require a Worker deploy.

## How it's put together

```
Browser ──► GitHub Pages (static: index.html, blog/, assets/)
                │
                └──► /api/chat ──► Cloudflare Worker ──► Groq API
                          (CORS allowlist · rate limits · payload caps)

```

**Two versions, one goal:**
- **Internet (`index.html`):** Deterministic sizer (off-grid tiers + grid-tie bill-cutting), the plausibility frontier (spend-vs-coverage curve with the knee and the site's ceiling marked), payback/LCOE money story, best-pick ladder + full 3×3 options matrix (chemistry × reliability), hardware parts list with CSV export, generator-fuel price helper, share links, printable summary, AI advisor, EN/ES/PT/FR/AR chrome. Requires internet for weather + Groq.

| File | Purpose |
|---|---|
| `index.html` | Public site with sizer + AI advisor (CSS and JS inlined) |
| `assets/js/sizing/engine.js` | Pure sizing math: derates, SOC sim, tier search, grid-tie offset sim + bill-cut search |
| `assets/js/sizing/money.js` | Payback, battery-replacement cadence, LCOE |
| `assets/js/sizing/pricing.js` | Scoped price ranges (ex-factory → landed → budget retail), sodium premium, tariff estimator |
| `assets/js/sizing/frontier.js` | Pure Pareto sweep: every (PV, battery) pair on a coarse lattice, the cheapest system for each coverage level, knee detection, reach verdict |
| `assets/js/sizing/frontier-chart.js` | Responsive SVG for that curve (sized to its container), legend, accessible data table, verdict sentence |
| `assets/js/sizing/bom.js` | Pure parts-list math: panel count/area, system voltage, bank series/parallel (DIY cells + retail modules), inverter class from load peak, controller amps, fuse/breaker ratings, cable gauge |
| `assets/js/shared/content.js` | Canonical BOM prices + donation links |
| `assets/js/shared/i18n.js` + `locales.js` | UI-chrome translations (es/pt/fr/ar) + RTL |
| `scripts/validate-modes.mjs` | Live end-to-end check of both sizing modes vs real NASA data |
| `worker/index.js` | Cloudflare Worker: `/api/chat`, `/api/health`. CORS allowlist, rate limits, input caps |
| `.github/workflows/deploy.yml` | Pages deploy from an explicit allowlist |
| `launcher.py` / `server.py` | Local-only dev servers (untracked, never deployed — see `.gitignore`), driven by the `.bat` files |
| `PLAN.md` | Roadmap |
| `PHASE2_PLAN.md` | Sizing engine plan + shipped-status ledger |
| `PHASE3_PLAN.md` | Plausibility frontier: backlog ranking, what shipped, and the fixed-charge caveat it surfaced |
| `LAUNCH_AUDIT.md` | Pre-launch checklist. Updated 2026-08-03 |
| `LIABILITY.md` | Liability, tax, and privacy posture. Read before promoting the site |
| `legacy_scripts/`, `.backup/` | Superseded material, kept locally only (not deployed, not tracked) |

## Search Console & indexing

The site verifies via the `google-site-verification` meta tag in `index.html`. To keep indexing healthy:

1. **Google Search Console** — open [search.google.com/search-console](https://search.google.com/search-console), select the verified property for `bigenergyco.pages.dev`, then **Sitemaps → submit** `https://bigenergyco.pages.dev/sitemap.xml` (re-submit after any new page ships).
2. **URL Inspection** → "Request indexing" after publishing a new blog post.
3. **Bing Webmaster Tools** — import from Google Search Console (one click); same sitemap applies.
4. Structured data is embedded on-page: `WebApplication` + `FAQPage` (home), `Article` + `FAQPage` (each post). Validate changes at [validator.schema.org](https://validator.schema.org) before deploying.

## Abuse limits

`/api/chat` is public and unauthenticated, so the **Cloudflare Worker enforces**: 8/min and
150/day per IP, 3000/day overall, 4 KB message cap, ~20 KB body cap. The per-minute
cap is a hard rate-limiting binding (`RL_CHAT_PER_MIN`); the daily/global counters are
in-isolate (best-effort against bursts). For a hard daily guarantee add the WAF rules in
`docs/DEPLOY_RUNBOOK.md` ("API abuse hardening"). Live limits are visible at `/api/health`.

The Groq key lives only in the Worker secret `GROQ_API_KEY` (`wrangler secret put`). It is never
sent to the browser. Local dev reads it from `.env` (see `.env.example`) — never commit keys.

Local dev servers (`server.py`/`launcher.py`) are untracked and never deployed. If revived,
they must mirror the Worker: same-origin/CORS allowlist only (never `*`), no `/api/lead`,
and no reflected JSONP callbacks.

## Ground rules baked into the site

These aren't cosmetic — see `LIABILITY.md` for why each one matters.

- Nothing is for sale. The AI is instructed never to sell, source, quote, or procure. No lead capture exists anywhere (the old `/api/lead` endpoint was removed).
- Donations unlock **nothing**. Same tool for everyone. Never tie a contribution to a feature, a result, or answer quality.
- Every AI reply carries a disclaimer, at the point of output.
- No personal data is collected. No accounts, no lead forms, no analytics profile. Don't add one without re-reading `LIABILITY.md` §6.
- Prices shown are dated, scope-labeled (ex-factory vs landed), and marked indicative. Keep them that way, or remove them.
