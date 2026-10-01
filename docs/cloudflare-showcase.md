# Cloudflare Showcase — provisioning & configuration guide

Branch: `showcase/cold-start` (fork `Treystu/BigEnergyCo`).
Purpose: make the Cloudflare developer platform a first-class, demonstrable
part of the stack for the Cold Start pitch competition. Every integration
below is genuine: the worker code is written, tested, and fails loudly when
its Cloudflare-side counterpart is not provisioned yet.

**Nothing here touches production.** The showcase worker is named
`bigenergyco-api-showcase` (wrangler.json), so deploying it can never
clobber the production `bigenergyco-api` worker. The showcase Pages project
(see §1) is a separate site from the staging site `bigenergyco.pages.dev`.

## 1. Provisioning checklist

Do these once, in order. The worker returns a 503 naming the missing piece
(plus this document) until each is done; `npm run cf:check` (see §8) fails
locally on any remaining `REPLACE_WITH_*` placeholder.

### 1a. Separate Pages project for the fork (the secondary test link)

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. Select the **`Treystu/BigEnergyCo`** repo (the fork, not the org repo).
3. Production branch: `main`. Build command: none (static output is built by
   `scripts/deploy-pages-local.mjs`; use output directory `_pages`).
4. Name it `bigenergyco-showcase`. This yields
   `bigenergyco-showcase.pages.dev` — the secondary link for testing the
   submission version, fully isolated from staging (`bigenergyco.pages.dev`)
   and production (`freeoffgridcalculator.com`).
5. Every branch push then gets its own `*.bigenergyco-showcase.pages.dev`
   preview URL automatically.

### 1b. KV namespace (share-link edge cache)

```bash
npx wrangler kv namespace create SHARE_KV
npx wrangler kv namespace create SHARE_KV --preview
```

Paste both ids into `worker/wrangler.json` (`kv_namespaces`).

### 1c. R2 bucket (quality-evidence artifacts)

Dashboard → R2 → Create bucket → **`bigenergyco-evidence-showcase`**.
The bucket name is already wired in `worker/wrangler.json`; no id to paste
(R2 binds by name).

Upload path: `POST /api/evidence` with JSON
`{kind, name, contentType, data}`. `kind` ∈ `lighthouse|axe|jev|smoke`,
`name` is a run label (`2026-09-28T120000Z`), content types limited to
JSON/HTML/CSV, 5 MB cap. Objects land at `evidence/<kind>/<name>.json`.

### 1d. D1 database (anonymized usage-event ledger)

```bash
npx wrangler d1 create bigenergyco-usage-showcase
```

Paste the `database_id` (and preview id) into `worker/wrangler.json`,
then apply the schema:

```bash
npx wrangler d1 execute bigenergyco-usage-showcase --file worker/d1-schema.sql
```

The schema and its privacy contract live in `worker/usage-ledger.mjs`:
closed event enum, validated page paths, country from Cloudflare's own
`cf-ipcountry` header only. No IPs, user agents, emails, coordinates, or
free-form client fields are ever stored.

### 1e. Turnstile (bot protection on the AI advisor)

Dashboard → Turnstile → Add site → hostname
`bigenergyco-showcase.pages.dev` (add the brand domain later when this
promotes). Then:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY   # the Turnstile *secret* key
```

Paste the _site_ key into `worker/wrangler.json` (`vars.TURNSTILE_SITE_KEY`).

Behavior: the moment `TURNSTILE_SECRET_KEY` exists, `POST /api/chat`
requires a valid `turnstileToken` in the body and rejects without one
(HTTP 403, fail-closed). Unprovisioned, the endpoint keeps its current
behavior and `/api/health` reports `"turnstile": false`.

Client integration (follow-up, not in this branch): render the Turnstile
widget in `assets/js/chat.js` and include the token as `turnstileToken` in
the `/api/chat` POST body. Site key is available to the client via the
worker or a Pages env var — never the secret.

### 1f. Secrets on the showcase worker

```bash
npx wrangler secret put GROQ_API_KEY          # same value as production
npx wrangler secret put TYPESAFE_API_KEY      # same value as production
npx wrangler secret put TURNSTILE_SECRET_KEY  # §1e
```

### 1g. Web Analytics token

Dashboard → the showcase Pages project → Settings → Web Analytics
(or dash.cloudflare.com → Analytics & Logs → Web Analytics → Add site).
Copy the 32-char hex token and expose it to the site as ONE of:

- `<meta name="cf-beacon-token" content="<token>">` in the showcase
  Pages project's HTML, or
- `window.BEC_CF_BEACON_TOKEN = "<token>"` before `assets/js/cf-beacon.js`
  loads.

`assets/js/cf-beacon.js` injects `beacon.min.js` only when the token is a
real 32-char hex value; the placeholder is never sent to the network.
CSP already allows `https://static.cloudflareinsights.com` (see `_headers`).

## 2. WAF configuration (dashboard steps with exact rules)

These pair with the worker's in-isolate limiter. The worker comment has
asked for the WAF rate-limiting rule since the beginning; this is that rule.

### Rule 1 — hard rate limit on the AI advisor (the rule the code asks for)

Security → WAF → Rate limiting rules → Create rule:

- Rule name: `chat-api-hard-limit`
- If incoming requests match: Custom filter expression
  ```
  (http.request.uri.path eq "/api/chat" and http.request.method eq "POST")
  ```
- With the following traffic: IP (characteristics) — note: prefer
  `CF-Connecting-IP`-derived IP; the dashboard default is correct.
- Rate: **8 requests per 1 minute** (mirrors the worker's
  `RATE_PER_IP_PER_MIN`; the WAF is the hard enforcement that survives
  isolate eviction, the worker limiter is the burst brake).
- When rate exceeds: Block, for 60 seconds.

### Rule 2 — evidence and event endpoints

- Rule name: `showcase-write-apis`
- Expression:
  ```
  (http.request.uri.path in {"/api/share" "/api/evidence" "/api/events"} and http.request.method eq "POST")
  ```
- Rate: **20 requests per 1 minute** per IP. Action: Block 60 s.
- Rationale: these write to KV/R2/D1; the worker also rate-limits them,
  but the WAF keeps junk from ever reaching the isolate.

### Rule 3 — Bot Fight Mode

Security → Bots → **Bot Fight Mode: On** for the showcase hostname.

Business reason (this is the pitch story, not just hygiene): the free
calculator feeds a verified-electrician lead funnel. Bot traffic burns paid
Groq tokens and — worse — fake chat sessions and junk share links poison
lead quality, which is what the paying electricians buy. Bot management
protects revenue, not just uptime.

### Managed ruleset

Security → WAF → Managed rulesets → Cloudflare Managed Ruleset: **On**,
sensitivity Medium. The API surface is JSON-only; OWASP paranoia above
Medium risks false positives on calculator payloads.

## 3. Cache Rules (tie-in to the byte-budget performance story)

The repo's Master Plan §3.1 sets brotli-compressed byte budgets (HTML ≤ 30 KB,
CSS ≤ 20 KB, pre-interaction JS ≤ 35 KB, first-result JS ≤ 200 KB). Cache
Rules make those budgets _hold at the edge_ instead of just in CI:

Caching → Cache Rules → Create rule (apply to the showcase hostname):

- Rule name: `immutable-versioned-assets`
- Expression:
  ```
  (http.request.uri.path starts_with "/assets/")
  ```
- Cache: Eligible for cache, **Edge TTL: 1 year**, "Ignore cache-control
  header and use this TTL".
- Rationale: every asset ships with a `?v=` content token
  (`bump-asset-tokens.mjs`), so immutable caching is safe; the byte
  budgets are measured on exactly these files.

- Rule name: `html-must-revalidate`
- Expression:
  ```
  (http.request.uri.path ends_with ".html" or http.request.uri.path eq "/")
  ```
- Cache: Eligible for cache, **Edge TTL: 5 minutes**, "Respect origin
  cache-control" off. Mirrors `_headers` (`/*.html: max-age=0,
must-revalidate`) while still letting the edge absorb traffic spikes.

Also enable **Tiered Cache** (Caching → Tiered Cache → On): the calculator
is read-heavy worldwide; tiering keeps a warm copy near every visitor and
is the honest version of "served from 300+ cities" in the pitch.

## 4. What the worker exposes (all live after `wrangler deploy`)

| Endpoint         | Method | Needs                          | Behavior                                                                        |
| ---------------- | ------ | ------------------------------ | ------------------------------------------------------------------------------- |
| `/api/health`    | GET    | —                              | adds `showcase: {turnstile, kv, r2, d1}` presence flags                         |
| `/api/chat`      | POST   | Turnstile token iff secret set | 403 fail-closed once provisioned                                                |
| `/api/share`     | POST   | `SHARE_KV`                     | validates `#s=` hash with the canonical codec, stores 7-day TTL, returns `{id}` |
| `/api/share?id=` | GET    | `SHARE_KV`                     | returns the cached payload (re-validated on read)                               |
| `/api/evidence`  | POST   | `EVIDENCE_BUCKET`              | validated upload, 5 MB cap, allowlisted types                                   |
| `/api/events`    | POST   | `USAGE_DB`                     | closed-enum anonymized event, country from `cf-ipcountry`                       |

Unprovisioned bindings return HTTP 503 with this document's name — never a
bare TypeError.

## 5. Verifying the showcase (after provisioning)

```bash
# 1. bindings present?
curl -s https://bigenergyco-api-showcase.bigenergyco.workers.dev/api/health | jq .showcase
# expect: {"turnstile":true,"kv":true,"r2":true,"d1":true}

# 2. share round-trip (use any #s= hash from the live site)
curl -s -X POST .../api/share -H 'Content-Type: application/json' \
  -d '{"hash":"#s=..."}'
curl -s ".../api/share?id=<id>"

# 3. evidence upload
curl -s -X POST .../api/evidence -H 'Content-Type: application/json' \
  -d '{"kind":"lighthouse","name":"2026-09-28T120000Z","contentType":"application/json","data":"{}"}'

# 4. anonymized event (country auto-filled from cf-ipcountry)
curl -s -X POST .../api/events -H 'Content-Type: application/json' \
  -d '{"event":"page_view","page":"/solar-calculator/"}'

# 5. Turnstile enforced?
curl -s -X POST .../api/chat -H 'Content-Type: application/json' \
  -d '{"message":"hi"}'
# expect HTTP 403 turnstile failure (no token), not a Groq call
```

## 6. Promoting to production (later, explicitly)

This branch never auto-promotes. Promotion is a deliberate, separate PR
against the org repo with its own review, and only after the showcase
proves out on `bigenergyco-showcase.pages.dev`. The worker rename
(`bigenergyco-api-showcase`) guarantees promotion cannot happen by
accident via `wrangler deploy`.
