# BigEnergyCo — free worldwide solar & battery estimator

A free, no-signup AI tool for roughly sizing off-grid solar and battery systems.
Built and given away by Lucas Ballek. Nothing for sale.

## Where it runs

| Piece | Where | Notes |
|---|---|---|
| **Public site (brand)** | `bigenergyco.pages.dev` (Cloudflare Pages) | Primary brand domain. Same allowlisted build, deployed with `node scripts/deploy-pages-local.mjs` + `npx wrangler pages deploy _pages_staging --project-name bigenergyco`. Served with `_headers`/`_redirects` for caching and legacy-domain consolidation. |
| **Public site (legacy)** | `sovereign-communication.github.io/BigEnergyCo/` | Legacy GitHub Pages URL — 301 redirects to brand domain via `_redirects` (Cloudflare Pages). Deploys via the allowlist workflow (`.github/workflows/deploy.yml`). The old `treystu.github.io/BigEnergyCo/` URL also redirects here; both remain on the API's CORS allowlist for cached clients. |
| **AI API** | Cloudflare Worker (`bigenergyco-api.bigenergyco.workers.dev`) | Proxies Groq. CORS-locked to the Pages origins + localhost, rate-limited, payload-capped. Deploy with `deploy_worker.bat` (or `npx wrangler deploy` in `worker/`). |
| **Local/dev** | `START.bat` / `STOP.bat` / `LINK.bat` | Optional local server + tunnel stack for development and the Freenet variant. Not needed for the public site. |

## How it's put together

```
Browser ──► GitHub Pages (static: index.html, blog/, assets/)
                │
                └──► /api/chat ──► Cloudflare Worker ──► Groq API
                          (CORS allowlist · rate limits · payload caps)

Freenet (offline): index-freenet.html → static cost calc, no API calls.
```

**Two versions, one goal:**
- **Internet (`index.html`):** Deterministic sizer (off-grid tiers + grid-tie bill-cutting), payback/LCOE money story, best-pick ladder + full 3×3 options matrix (chemistry × reliability), hardware parts list with CSV export, generator-fuel price helper, share links, printable summary, AI advisor, EN/ES/PT/FR/AR chrome. Requires internet for weather + Groq.
- **Freenet (`index-freenet.html`):** Static cost comparison + DIY reference. Fully offline; launcher syncs it into `freenet_web_dist/`. Shared content (prices/donations) is materialized into it by `node scripts/sync-freenet-content.mjs`.

| File | Purpose |
|---|---|
| `index.html` | Public site with sizer + AI advisor (CSS and JS inlined) |
| `index-freenet.html` | Static offline version (Freenet). Cost calc only, no AI |
| `assets/js/sizing/engine.js` | Pure sizing math: derates, SOC sim, tier search, grid-tie offset sim + bill-cut search |
| `assets/js/sizing/money.js` | Payback, battery-replacement cadence, LCOE |
| `assets/js/sizing/pricing.js` | Scoped price ranges (ex-factory → landed → budget retail), sodium premium, tariff estimator |
| `assets/js/sizing/bom.js` | Pure parts-list math: panel count/area, system voltage, bank series/parallel (DIY cells + retail modules), inverter class from load peak, controller amps, fuse/breaker ratings, cable gauge |
| `assets/js/shared/content.js` | Canonical BOM prices + donation links (synced into Freenet page) |
| `assets/js/shared/i18n.js` + `locales.js` | UI-chrome translations (es/pt/fr/ar) + RTL |
| `scripts/sync-freenet-content.mjs` | Materializes shared content into index-freenet.html SYNC markers |
| `scripts/validate-modes.mjs` | Live end-to-end check of both sizing modes vs real NASA data |
| `worker/index.js` | Cloudflare Worker: `/api/chat`, `/api/health`. CORS allowlist, rate limits, input caps |
| `.github/workflows/deploy.yml` | Pages deploy from an explicit allowlist |
| `launcher.py` | Local start/stop orchestration (dev only), driven by the `.bat` files |
| `proxy_server.py` | Local web server + Freenet CSP bridge with its own rate limiter (dev only) |
| `PLAN.md` | Roadmap |
| `PHASE2_PLAN.md` | Sizing engine plan + shipped-status ledger |
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
150/day per IP, 3000/day overall, 4 KB message cap, ~20 KB body cap. Counters are in-isolate
(best-effort against bursts); pair with a Cloudflare WAF rate-limiting rule for hard guarantees.
The local `proxy_server.py` applies the same limits for the dev/Freenet path.

The Groq key lives only in the Worker secret `GROQ_API_KEY` (`wrangler secret put`). It is never
sent to the browser.

## Ground rules baked into the site

These aren't cosmetic — see `LIABILITY.md` for why each one matters.

- Nothing is for sale. The AI is instructed never to sell, source, quote, or procure. No lead capture exists anywhere (the old `/api/lead` endpoint was removed).
- Donations unlock **nothing**. Same tool for everyone. Never tie a contribution to a feature, a result, or answer quality.
- Every AI reply carries a disclaimer, at the point of output.
- No personal data is collected. No accounts, no lead forms, no analytics profile. Don't add one without re-reading `LIABILITY.md` §6.
- Prices shown are dated, scope-labeled (ex-factory vs landed), and marked indicative. Keep them that way, or remove them.
