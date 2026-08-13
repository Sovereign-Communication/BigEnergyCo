# BigEnergyCo — free worldwide solar & battery estimator

A free, no-signup AI tool for roughly sizing off-grid solar and battery systems.
Built and given away by Lucas Ballek. Nothing for sale.

## Running it

| Double-click | What it does |
|---|---|
| **`START.bat`** | Starts everything. Leave the window open. |
| **`STOP.bat`** | Stops everything. |
| **`LINK.bat`** | Opens the **current** public link in your browser. |

`START.bat` clears anything left over from a previous run, starts the local server, opens a public
Cloudflare link, patches that link into the page, and syncs `freenet_web_dist/`.

> ⚠️ **The public link changes every single restart.** Free `trycloudflare` tunnels hand out a new
> random hostname each time, so any link you shared earlier is dead as soon as you restart. **Never
> bookmark it** — run `LINK.bat` to get the current one. The permanent fix is a domain plus a named
> Cloudflare tunnel; see `PLAN.md` §2.

### Options

```bash
python launcher.py --no-tunnel
```

| Flag | What it does |
|---|---|
| *(none)* | Server + public tunnel. The normal case. |
| `--no-tunnel` | Local only, no public link. |
| `--publish` | Also republish the Freenet contract via `fdev`. |
| `--stop` | Stop everything and exit. |

> **`--publish` is deliberately off by default.** Freenet publishing is effectively permanent —
> you can't reliably retract a version once it's out. Only publish when you're happy with the
> terms and disclaimers as they stand.

## URLs

| Where | Address |
|---|---|
| This computer | `http://127.0.0.1:7510/` |
| Public | printed at startup, **changes every restart** |
| Freenet | `http://127.0.0.1:7509/v1/contract/web/AMGUd3Y8HCGNz56vourLiVWNTy9LhHiXjdGtMpEDs3ov/` |

The public link is a free `trycloudflare` quick tunnel, so it gets a new random hostname on every
launch. The launcher rewrites `CF_API_URL` in `index.html` each time so nothing breaks — but any
link you shared previously will be dead. A real domain with a named tunnel is the fix when you want
a stable address.

## How it's put together

```
Internet:
  Browser ──► cloudflared tunnel ──► proxy_server.py (7510) ──┬──► serves index.html (full AI + cost calc)
                                                              ├──► /api/chat ──► Groq API
                                                              └──► (fallback via Freenet for offline users)

Freenet:
  Freenet Browser ──► local Freenet contract ──► serves index-freenet.html (static cost calc, no AI)
                                                 (works offline, no API calls)
```

**Two versions, one goal:**
- **Internet (index.html):** Full AI advisor + cost comparison + donations. Requires internet + Groq API.
- **Freenet (index-freenet.html):** Static cost comparison + DIY reference + donations. Fully offline, works on Freenet.

Both versions show the same DIY vs. retail cost comparison and accept donations as gifts. The Freenet version
trades AI interactivity for offline reliability — users get the calculator and component reference even if
the API is down or they have no internet.

| File | Purpose |
|---|---|
| `launcher.py` | Start/stop orchestration. Driven by the `.bat` files. |
| `proxy_server.py` | Web server, Groq bridge, rate limiting, CSP rewrite. |
| `index.html` | Full site with AI advisor (internet version). CSS and JS inlined. |
| `index-freenet.html` | Static offline version (Freenet). Cost calc only, no AI. |
| `freenet_web_dist/` | Build directory for Freenet contract (contains index-freenet.html). |
| `PLAN.md` | Roadmap for the full worldwide estimator. |
| `LAUNCH_AUDIT.md` | Comprehensive pre-launch checklist. Updated 2026-08-03. |
| `LIABILITY.md` | Liability, tax, and privacy posture. Read before promoting the site. |
| `legacy_scripts/` | Superseded launchers, kept for reference. |
| `.backup/` | Pre-pivot copies of `index.html` / `proxy_server.py`, archived test leads. |

## Abuse limits

`/api/chat` is public and unauthenticated, so it's capped: **8/min and 150/day per IP, 3000/day
overall**. Counters live in memory only and reset when the server restarts — no IP is ever written
to disk. Adjust the constants at the top of `proxy_server.py` if they're too tight.

The Groq key is read from `GROQ_API_KEY`, falling back to `~/.config/scmorc/groq.env`. It is never
sent to the browser.

## Ground rules baked into the site

These aren't cosmetic — see `LIABILITY.md` for why each one matters.

- Nothing is for sale. The AI is instructed never to sell, source, quote, or procure.
- Donations unlock **nothing**. Same tool for everyone. Never tie a contribution to a feature,
  a result, or answer quality.
- Every AI reply carries a disclaimer, at the point of output.
- No personal data is collected. No accounts, no lead forms. Don't add one without re-reading
  `LIABILITY.md` §6.
- Prices shown are dated and marked indicative. Keep them that way, or remove them.
