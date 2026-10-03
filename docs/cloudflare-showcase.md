# Cloudflare Showcase — provisioning & configuration guide

Repository: `Sovereign-Communication/BigEnergyCo`. Current submission lane:
PR #182; see `docs/contest/DEPLOY-AND-FILE.md` for the evidence record. The
verified showcase deployment is source commit `19d5c378a1883901c5754df4566ad2bbbad2bd89`,
Pages deployment `70d5c3f9.bigenergyco-showcase.pages.dev` (stamp `20261003e`),
and Worker version `8b371a06-1f75-470c-8fe9-36de3927f7ca`. This documentation
revision records that deployed source and is being prepared for commit; it does
not change the deployed artifact. All four health flags were true, and KV, D1,
R2, and the browser flow were independently exercised. The corrected
owner-approved security gate is Turnstile plus the Worker 8/minute rate limit,
with no site-wide challenge and Bot Fight Mode off where applicable. The Jev
advisory CI step was red because its title lacked the plan item ID, scope
selection failed, and the live call was skipped. The Worker Jev sanity flag was
false; these are distinct findings, and neither establishes an independent Jev
result.
Purpose: document the Cloudflare showcase integrations and related setup
guidance for the Cold Start pitch competition. The current deployment evidence
is summarized above; remaining dashboard recipes below are proposals, not
claims that those optional Cloudflare products are configured.

**Nothing here touches production.** The showcase worker is named
`bigenergyco-api-showcase` (wrangler.json), so deploying it can never
clobber the production `bigenergyco-api` worker. The showcase Pages project
(see §1) is a separate site from the staging site `bigenergyco.pages.dev`.

## 1. Provisioning checklist

These steps document how to provision a fresh showcase environment. The
recorded deployment is already provisioned and verified as summarized above;
do not repeat creation steps against it. The worker returns a 503 naming a
missing piece; `npm run cf:check` (see §8) checks local placeholders.

### 1a. Separate Pages project for the org repository

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. Select **`Sovereign-Communication/BigEnergyCo`**.
3. Stage committed bytes from the repository root with
   `node scripts/stage-showcase.mjs --output _pages_showcase --turnstile-site-key <public-key>`.
   The helper runs the local builder in check mode with the fixed showcase API
   target and writes the Pages advanced-mode `/api/*` proxy. Deploy the staged
   `_pages_showcase` output through the Pages project. This does not deploy it.
4. Name it `bigenergyco-showcase`. This yields
   `bigenergyco-showcase.pages.dev` — the secondary link for testing the
   submission version, fully isolated from staging (`bigenergyco.pages.dev`)
   and production (`freeoffgridcalculator.com`).
5. Verify the actual Pages build/deployment and proxy in a browser; do not
   infer deployment success from a staged directory.

### 1b. KV namespace (share-link edge cache)

```bash
npx wrangler kv namespace create SHARE_KV
npx wrangler kv namespace create SHARE_KV --preview
```

Paste both ids into `worker/wrangler.json` (`kv_namespaces`).

### 1c. R2 bucket (quality-evidence artifacts)

The Cloudflare account is activated and bucket
**`bigenergyco-evidence-showcase`** is bound as `EVIDENCE_BUCKET`. The deployed
showcase accepted an evidence upload and returned the stored object on
readback. R2 binds by name, with no id to paste.

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

The deployed client and Worker have been exercised together: the browser
obtained a Turnstile token, and the advisor returned a real online response.
The owner-approved security gate is Turnstile plus the Worker 8-requests-per-
minute limit. No site-wide challenge is enabled; Bot Fight Mode is off where
applicable. Q-15 remains a separate zero-cookie gate: the pre-provisioning
HTTP probe observed zero `Set-Cookie` headers, so the secret was provisioned.
This does not verify browser third-party cookie behavior; no `cf_clearance`
cookie was observed in the widget flow. Do not claim WAF configuration from
this evidence.

Client integration: **in this branch** — `assets/js/chat.js` renders the
widget explicitly and sends the token as `turnstileToken` in the `/api/chat`
POST body. The site key reaches the client via
`<meta name="bec-turnstile-site-key" content="...">` on the showcase Pages
project (or `window.BEC_TURNSTILE_SITE_KEY`); the secret never does.

**Server and client ship as one item (R-CF-02).** Do not run
`wrangler secret put TURNSTILE_SECRET_KEY` until the site key meta is live
on the showcase host, or every advisor call 403s with no client recovery — the
exact defect B1 records. The deployed client and Worker have since passed a
real browser challenge-and-response flow.

### 1f. Secrets on the showcase worker

```bash
npx wrangler secret put GROQ_API_KEY          # advisor provider credential
npx wrangler secret put TURNSTILE_SECRET_KEY  # §1e
npx wrangler secret put EVIDENCE_UPLOAD_TOKEN # authorizes POST /api/evidence uploads
```

`TYPESAFE_API_KEY` supports the independent Jev advisory check. The recorded
CI job did not call it: the title lacked the plan item ID and scope selection
failed. Separately, the deployed Worker Jev sanity flag was false. No
independent Jev result is established by these facts.

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

## 2. Rate limiting and site-wide challenge posture

The deployed Worker has an 8-requests-per-minute advisor limit. This is the
verified rate limit for the showcase. No WAF rate-limiting rules have been
verified or are claimed. The dashboard instructions below are optional
proposals only and must not be described as deployed configuration.

### Rule 1 — hard rate limit on the AI advisor (scope must be verified)

Before configuring these custom WAF rules, verify that the hostname is served
through a zone where this account can apply them. A `pages.dev` hostname does
not by itself establish that this project's customer-zone custom rules own the
traffic. Treat the rules below as conditional instructions until their scope
is confirmed; do not claim them as configured based on the Pages hostname.

Security → WAF → Rate limiting rules → Create rule:

- Rule name: `chat-api-hard-limit`
- If incoming requests match: Custom filter expression
  ```
  (http.request.uri.path eq "/api/chat" and http.request.method eq "POST")
  ```
- With the following traffic: IP (characteristics) — note: prefer
  `CF-Connecting-IP`-derived IP; the dashboard default is correct.
- Proposed rate: **8 requests per 1 minute** (mirrors the worker's
  `RATE_PER_IP_PER_MIN`; if configured in an eligible zone, a WAF rule could
  enforce this at the edge while the Worker limiter remains the verified
  showcase control).
- When rate exceeds: Block, for 60 seconds.

### Rule 2 — evidence and event endpoints

- Rule name: `showcase-write-apis`
- Expression:
  ```
  (http.request.uri.path in {"/api/share" "/api/evidence" "/api/events"} and http.request.method eq "POST")
  ```
- Rate: **20 requests per 1 minute** per IP. Action: Block 60 s.
- Proposed rationale: these write to KV/R2/D1; an eligible-zone WAF rule could
  filter requests before they reach the Worker.

### Rule 3 — verified-bot allowance, NOT Bot Fight Mode

**Do not enable Bot Fight Mode on this hostname.** An earlier draft of this
document told operators to turn it on. That was wrong, and it re-creates this
repo's own open finding **F-44**: the production domain returns
`HTTP 403 cf-mitigated: challenge` to non-browser clients and to verified
crawlers, which is what F-44 records. Bot Fight Mode is that same class of
challenge applied to everyone.

F-44 is closed by owner action **O-09** — turning managed challenges off for
real visitors and allowing verified bots — and is governed by **R-SEO-07**.
R-CF-07 carries the same rule onto the showcase surface: no hostname carrying
R-SEO-07 may serve a managed challenge or Bot Fight Mode to verified crawlers.

What to configure instead:

- Security → Bots → **Bot Fight Mode: Off** for the showcase hostname.
- Security → Bots → **Verified Bots: Allow**, where an applicable customer
  zone exposes this setting. This is the required posture for those zones; no
  such zone setting is claimed for the Cloudflare-owned `pages.dev` hostname.
- Any older PR checkbox or guidance that proposed Bot Fight Mode ON is
  superseded by the owner-approved posture above. Current PR state was not
  checked as part of this evidence update.
- The Worker limiter is the verified advisor protection. The WAF rules below
  remain unconfigured proposals.

The advisor protection addresses abuse of a paid upstream while preserving
access to the calculator. There is no lead capture here; D-18 and the master
plan's §14 non-goals rule out accounts, lead forms and sales.

### Managed ruleset

Optional, unverified proposal: Security → WAF → Managed rulesets → Cloudflare
Managed Ruleset: On, sensitivity Medium. The API surface is JSON-only; OWASP
paranoia above Medium risks false positives on calculator payloads. This is
not part of the verified deployed configuration.

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

## 4a. Verifying BEFORE the demo: a real browser, not just curl

The curls in §5 are necessary and **not sufficient**. They would all have passed
against the configuration that shipped broken: a `/api/chat` curl without a
token _expects_ a 403, so a worker whose client can never produce one looks
perfect to curl. Drive the real page.

```bash
node scripts/cold-start-preflight.mjs --chat <worker-url> --cookies --json
```

Then, in a browser against `bigenergyco-showcase.pages.dev`:

1. **The advisor answers** — or degrades with its visible "offline answer, not
   the live AI" label. A blank box or a silent failure is a failed demo.
2. **The calculator sizes a system end to end** — bill in, sized system out.
3. **The share-link round trip** — share, open the returned link, same numbers.
4. **An evidence upload** succeeds.
5. **A usage event posts.**
6. `/api/health` reports the four showcase flags. They show binding/config
   presence only; they do not prove the APIs work.

Capture the demo URL and a short screen recording. Anything on that list you did
not watch working is described in the application as _shipping_, never as
_shipped_.

## 5. Verifying the showcase (after provisioning)

```bash
# 1. bindings present?
curl -s https://bigenergyco-api-showcase.bigenergyco.workers.dev/api/health | jq .showcase
# These are presence flags only; complete the operational checks below.

# 2. share round-trip (use any #s= hash from the live site)
curl -s -X POST .../api/share -H 'Content-Type: application/json' \
  -d '{"hash":"#s=..."}'
curl -s ".../api/share?id=<id>"

# 3. evidence upload. Set EVIDENCE_UPLOAD_TOKEN in your shell from the
#    Worker secret value; never put a real token in docs or command history.
curl -i -X POST https://bigenergyco-api-showcase.bigenergyco.workers.dev/api/evidence \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $EVIDENCE_UPLOAD_TOKEN" \
  -d '{"kind":"lighthouse","name":"run-label","contentType":"application/json","data":"{}"}'
# Read the resulting object back from R2 and verify its contents.

# 4. anonymized event (country auto-filled from cf-ipcountry)
curl -s -X POST .../api/events -H 'Content-Type: application/json' \
  -d '{"event":"page_view","page":"/solar-calculator/"}'

# 5. Turnstile enforced?
curl -s -X POST .../api/chat -H 'Content-Type: application/json' \
  -d '{"message":"hi"}'
# expect HTTP 403 turnstile failure (no token), not a Groq call
```

## 6. The cookie gate — decide BEFORE provisioning, not after

Q-15 demands **0 cookies**. Cloudflare Turnstile's cookie behaviour in managed
mode is unverified. So it is measured, and the measurement decides — before the
secret exists, not after.

```bash
# Measures cookies AND whether the advisor is actually answering right now.
node scripts/cold-start-preflight.mjs \
  --chat https://bigenergyco-api-showcase.bigenergyco.workers.dev \
  --cookies --json
```

The decision function is `cookieGateDecision()` in
`scripts/cold-start-preflight.mjs`, pinned by
`tests/cold-start-preflight.test.mjs` so this section cannot drift from it:

| Measurement                             | Action                                                                                                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0 cookies**                           | Provision `TURNSTILE_SECRET_KEY`. Record the measurement as evidence.                                                                                                   |
| **≥ 1 cookie**                          | Do **not** provision. Switch Turnstile to a non-cookie mode and re-measure, or ship the advisor unguarded and describe Turnstile honestly as _shipping_, not _shipped_. |
| **Not measured** (fetch failed, no URL) | Do **not** provision. An unmeasured risk is not a passed gate.                                                                                                          |

That last row is the one that matters. The judge who reviewed this repo scored
Q-15 at 45 % with the finding _"named as a risk with no owner and no gate"_ —
naming the risk without a gate is the same as not naming it. So a missing
measurement resolves to **no**, deterministically, in code.

Q-15 is never silently broken. If an exception is ever taken it is a named owner
action with a name attached, recorded in `docs/plan/LEDGER.jsonl`.

Whichever way it goes, record the outcome in the ledger — the cookies measured
and the decision they forced. A gate nobody records is indistinguishable from a
gate that was never run.

**Recorded result:** the pre-provisioning HTTP response probe observed zero
`Set-Cookie` headers, so the secret was provisioned. This measures response
headers from that HTTP probe only; it does not establish browser third-party
cookie behavior. In the observed widget flow, no `cf_clearance` cookie was set.
Third-party cookie behavior in the browser remains unverified.

## 7. Promoting to production (later, explicitly)

This branch never auto-promotes. Promotion is a deliberate, separate PR
against the org repo with its own review, and only after the showcase
proves out on `bigenergyco-showcase.pages.dev`. The worker rename
(`bigenergyco-api-showcase`) guarantees promotion cannot happen by
accident via `wrangler deploy`.
