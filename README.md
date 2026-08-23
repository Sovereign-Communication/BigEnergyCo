# BigEnergyCo — free worldwide solar & battery estimator

A free, no-signup AI tool for roughly sizing off-grid solar and battery systems.
Built and given away by Lucas Ballek. Nothing for sale.

## Where it runs

| Piece | Where | Notes |
|---|---|---|
| **Public site** | GitHub Pages (`treystu.github.io/BigEnergyCo/`) | Deploys automatically on push to `main`, from an explicit file allowlist in `.github/workflows/deploy.yml`. Nothing outside the allowlist is ever published. |
| **AI API** | Cloudflare Worker (`bigenergyco-api.bigenergyco.workers.dev`) | Proxies Groq. CORS-locked to the Pages origin + localhost, rate-limited, payload-capped. Deploy with `deploy_worker.bat` (or `npx wrangler deploy` in `worker/`). |
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
- **Internet (`index.html`):** Full AI advisor + cost comparison. Requires internet + Groq API.
- **Freenet (`index-freenet.html`):** Static cost comparison + DIY reference. Fully offline; launcher syncs it into `freenet_web_dist/`.

| File | Purpose |
|---|---|
| `index.html` | Public site with AI advisor (CSS and JS inlined) |
| `index-freenet.html` | Static offline version (Freenet). Cost calc only, no AI |
| `worker/index.js` | Cloudflare Worker: `/api/chat`, `/api/health`. CORS allowlist, rate limits, input caps |
| `.github/workflows/deploy.yml` | Pages deploy from an explicit allowlist |
| `launcher.py` | Local start/stop orchestration (dev only), driven by the `.bat` files |
| `proxy_server.py` | Local web server + Freenet CSP bridge with its own rate limiter (dev only) |
| `PLAN.md` | Roadmap |
| `PHASE2_PLAN.md` | Deterministic sizing core + 5-year hourly solar simulation plan |
| `LAUNCH_AUDIT.md` | Pre-launch checklist. Updated 2026-08-03 |
| `LIABILITY.md` | Liability, tax, and privacy posture. Read before promoting the site |
| `legacy_scripts/`, `.backup/` | Superseded material, kept locally only (not deployed, not tracked) |

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
