# Domain migration: bigenergyco.pages.dev → freeoffgridcalculator.com

**Status:** Plan only — do not execute without walking the phases in order.
**New domain:** `freeoffgridcalculator.com` (owned)
**Current brand host:** `https://bigenergyco.pages.dev` (Cloudflare Pages project `bigenergyco`)
**Legacy mirror:** `https://sovereign-communication.github.io/BigEnergyCo/`
**API:** `https://bigenergyco-api.bigenergyco.workers.dev` (Cloudflare Worker)

This plan is additive-first: the old host keeps working until the new host is proven.
Nothing is deleted until Phase 4.

---

## Why migrate

1. **SEO.** The site already treats custom-domain cutover as the known fix for stuck
   `pages.dev` indexing (`drafts/01_ACTION_PLAN.md` Day 14 decision point).
2. **Brand fit.** `freeoffgridcalculator.com` matches the product keyword cluster
   (off-grid solar calculator) far better than `bigenergyco.pages.dev`.
3. **API hardening.** An owned zone unlocks Worker routes + WAF rate-limit rules
   that `workers.dev` cannot attach to (see `docs/DEPLOY_RUNBOOK.md`).

**Brand/title decision (locked):** public SEO identity moves to the domain.
Title/H1/meta lean into **Free Off-Grid Calculator**. Legal/about copy may still
credit **BigEnergyCo / Lucas Ballek** as the maker — product name ≠ corporate name.

---

## Live DNS snapshot (verified 2026-09)

| Item | Value | Meaning |
| --- | --- | --- |
| Registrar / DNS host | **IONOS (1&1)** `ns1017.ui-dns.biz` / `ns1037.ui-dns.com` / `ns1042.ui-dns.org` / `ns1089.ui-dns.de` | Zone is **not** on Cloudflare yet |
| SOA | `hostmaster.1und1.com`, serial `2017060110` | Domain has existed since ~2017 (likely long-parked) |
| A | `74.208.236.241` | IONOS default hosting / parking |
| AAAA | `2607:f1c0:100f:f000::200` | Same parking stack |
| MX | `mx00.ionos.com`, `mx01.ionos.com` (prio 10) | **IONOS email is configured** |
| TXT | `v=spf1 include:_spf-us.ionos.com ~all` | SPF for IONOS mail |
| www | No records | www currently dead |
| HTTPS | Broken / not the product | `http://` serves IONOS product parking HTML |
| Live site | `bigenergyco.pages.dev` → Cloudflare anycast | Unchanged |

**Implication:** this is a clean slate for web, but **not** a clean DNS slate —
mail records must be preserved or deliberately dropped when nameservers move.

---

## DNS hosting plan (Phase 0A)

### Recommended: move authoritative DNS to Cloudflare

Pages custom domains, Worker routes (`/api/*`), zone Redirect Rules, and WAF
rate-limit rules all want an **owned Cloudflare zone**. Staying on IONOS DNS
blocks Phase 3 and makes apex-primary fragile.

**Steps (order matters):**

1. Cloudflare dashboard → **Add a site** → `freeoffgridcalculator.com` (Free plan).
2. Let Cloudflare scan existing records. Confirm it imported:
   - `MX` → `mx00.ionos.com`, `mx01.ionos.com` (proxied **off** / DNS only)
   - `TXT` SPF → keep if you still want IONOS mail
   - Drop the parking `A`/`AAAA` (do **not** point them at IONOS forever)
3. If you **do not** use email on this domain: you may delete MX/SPF now.
   If unsure, keep them DNS-only through the soak.
4. Cloudflare assigns two nameservers (e.g. `*.ns.cloudflare.com`).
5. At **IONOS registrar** (Domains → Nameservers → Custom):
   replace the four `ui-dns.*` nameservers with the two Cloudflare ones.
6. Wait for NS propagation (usually minutes–24h; often <1h at IONOS).
7. In Cloudflare: SSL/TLS → **Full (strict)** (Pages will terminate itself).
8. Only after the zone shows **Active**, attach the domain to Pages (Phase 1).

**Fallback if NS change fails or is delayed:**

| Option | Works for apex? | Blocks |
| --- | --- | --- |
| Stay on IONOS + CNAME `www` → `bigenergyco.pages.dev` | No (apex CNAME unsafe) | Apex-primary decision |
| Stay on IONOS + their ALIAS/ANAME if offered | Maybe | Worker routes / WAF still unavailable |
| Point A/AAAA at parking and wait | No | Nothing productive |

**Decision:** pursue Cloudflare NS. Do not attach Pages custom domains until
`Resolve-DnsName freeoffgridcalculator.com -Type NS` returns `*.ns.cloudflare.com`.

### Automation note (2026-09-10)

Wrangler OAuth for this account lists **`zone:read` only** — there is no
`zone:write` OAuth scope (`wrangler login --scopes-list`). API
`POST /client/v4/zones` returns 403
`Requires permission "com.cloudflare.api.account.zone.create"`.
Re-running `wrangler login` **cannot** grant zone-create.

**Required human step:** Cloudflare dashboard → **Add a site** →
`freeoffgridcalculator.com` (Free plan). Keep MX/SPF as DNS-only if IONOS mail
is used. An API token with Zone:Edit + DNS:Edit is only needed if we later want
zone automation; Pages attach can use the existing Pages write scope once the
zone exists.

### Do not do yet

- Do not delete IONOS MX until you know whether `@freeoffgridcalculator.com` mail exists.
- Do not enable Cloudflare email routing in the same hour as NS cutover.
- Do not set `Always Use HTTPS` until Pages custom domain is active (otherwise
  a broken parking HTTPS is what users hit).

---

## Target architecture (end state)

```
User
  │
  ├─► https://freeoffgridcalculator.com/          Cloudflare Pages (custom domain)
  │         │
  │         └─► /api/*  ──► Cloudflare Worker ──► Groq
  │              (same-origin route on the zone; preferred)
  │
  ├─► https://bigenergyco.pages.dev/*             301 → freeoffgridcalculator.com/*
  │
  └─► https://sovereign-communication.github.io/BigEnergyCo/*
            200 mirror, canonical → freeoffgridcalculator.com
```

### Recommended decisions (defaults)

| Decision | Recommendation | Why |
| --- | --- | --- |
| Apex vs www | **Apex primary** `https://freeoffgridcalculator.com` + `www` 301 → apex | Locked by you |
| API host | **Phase 3 after soak:** Worker route `freeoffgridcalculator.com/api/*` | See same-origin tradeoffs below |
| API interim | Keep `bigenergyco-api.bigenergyco.workers.dev` through Phase 2 | Zero-risk dual serve |
| pages.dev | Keep forever as 301 redirect | Preserve any existing links/bookmarks |
| GitHub mirror | Keep as 200 mirror, canonical → new domain | Existing runbook + offline fallback |
| Title / H1 | **Free Off-Grid Calculator** (+ short differentiator) | Locked by you — SEO identity follows domain |

### Same-origin `/api/*` — pros and cons

| | Same-origin (`freeoffgridcalculator.com/api/chat`) | Stay on `workers.dev` |
| --- | --- | --- |
| CORS | Not needed for the main site | Must maintain allowlist forever |
| CSP | `connect-src 'self'` for the advisor | Keep explicit workers.dev host |
| WAF / zone rate limits | Available (closes runbook gap) | Impossible on workers.dev zone |
| Cookie / credentialed fetch | Cleaner if ever needed | Still cross-origin |
| Deploy coupling | Worker route must not shadow Pages assets | Fully independent deploy |
| Rollback | Remove route or point `CF_API_URL` back | Already the status quo |
| Risk now | Extra Phase-3 change surface | None |

**Recommendation:** stay on `workers.dev` through Phase 2 + indexing soak;
switch to same-origin in Phase 3 once the custom domain is boringly stable.
The calculator math never depends on the Worker — only the AI advisor does.

---

## Title / brand migration (locked direction)

Public-facing SEO strings move to the domain. Maker credit stays in legal/about.

| Field | From | To |
| --- | --- | --- |
| `<title>` | `BigEnergyCo - Free Worldwide Solar and Battery Estimator` | `Free Off-Grid Calculator — Solar & Battery Sizer` |
| `og:title` / `twitter:title` | same as title | same as new title |
| `og:site_name` | `BigEnergyCo` | `Free Off-Grid Calculator` |
| JSON-LD `WebApplication.name` | `BigEnergyCo - Free Off-Grid Energy Estimator` | `Free Off-Grid Calculator` |
| JSON-LD `Organization.name` | `BigEnergyCo` | Keep **or** dual: product name + org credit |
| H1 | (see live page) | Keyword-aligned H1, not the corporate name |
| Install prompt / AI modal chrome | `BigEnergyCo …` | `Free Off-Grid Calculator …` where it is user-visible product name |
| Blog RSS title | `BigEnergyCo Blog` | `Free Off-Grid Calculator Blog` |
| About / LIABILITY / footer | BigEnergyCo / Lucas Ballek | **Keep** — maker identity |

Do this in the **same Phase 2 commit family** as the URL rewrite so title and
canonical never disagree for crawlers. Update `scripts/check-seo.mjs` expectations
if they assert the old title/brand string.

---

## Phase inventory (what already hardcodes the old origin)

Count is approximate; treat as the change surface, not a punch list.

| Area | Path(s) | Role |
| --- | --- | --- |
| Home SEO | `index.html` | canonical, OG, hreflang, JSON-LD, `google-site-verification` |
| Blog posts | `blog/**/index.html` | canonical, OG, JSON-LD |
| Heatmap | `solar-heatmap/index.html` | canonical, OG, JSON-LD |
| About | `about/index.html` | canonical/OG if present |
| City pages source | `scripts/build-city-pages.mjs` | **regenerates** absolute URLs — fix the generator, not only outputs |
| Sitemap / robots | `sitemap.xml`, `robots.txt` | discovery |
| Headers | `_headers` | CSP `connect-src` (API host) |
| Redirects | `_redirects` | old → new consolidation |
| API CORS | `worker/index.js` `ALLOWED_ORIGINS` | must **add** new origin before cutover |
| Frontend API URL | `assets/js/chat.js` `CF_API_URL` | point at new API path in Phase 3 |
| SEO gates | `scripts/check-seo.mjs`, `validate-jsonld.mjs` | hard-fail if canonical ≠ expected origin |
| Live gates | `scripts/live-sanity.mjs`, `browser-smoke.mjs` | default BASE must become the new host |
| Docs | `README.md`, `docs/DEPLOY_RUNBOOK.md`, `worker/README.md` | operator truth |

Do **not** hand-edit generated city pages until the generator is updated and rebuilt.

---

## Phase 0 — Preconditions (DNS host move; site unchanged)

Goal: authoritative DNS on Cloudflare; inventory frozen; production site still
only on `pages.dev`. The public web for this domain may briefly show parking —
that is fine and is not a regression.

- [ ] **0A.** Execute the DNS hosting plan above (Cloudflare zone + NS cutover).
- [ ] Confirm `Resolve-DnsName freeoffgridcalculator.com -Type NS` → Cloudflare.
- [ ] Confirm mail: either MX/SPF copied as DNS-only, or consciously removed.
- [ ] Do **not** attach Pages custom domain until NS + zone Active (Phase 1).
- [ ] Snapshot current production evidence (for rollback baseline):
  ```bash
  node scripts/deploy-pages-local.mjs --check
  curl -sI https://bigenergyco.pages.dev/ | head -20
  curl -s https://bigenergyco.pages.dev/sitemap.xml | head -20
  curl -s https://bigenergyco-api.bigenergyco.workers.dev/api/health
  ```
- [ ] Create a new **Google Search Console** URL-prefix property
      `https://freeoffgridcalculator.com/` (do not touch the pages.dev property yet).
- [ ] Create the matching **Bing Webmaster Tools** property (import later or add sitemap manually).

**Exit criteria:** zone active in Cloudflare dashboard; Search Console property created; baseline curl results saved.

**Do not** attach the custom domain to Pages yet if nameservers are still propagating.

---

## Phase 1 — Infrastructure dual-serve (old + new both work)

Goal: `https://freeoffgridcalculator.com` serves the **same** build as `pages.dev`,
with **no content rewrite yet**. Rollback = remove the custom domain.

### 1A. Attach custom domain to Pages

1. Cloudflare Dashboard → Workers & Pages → project `bigenergyco` → **Custom domains**.
2. Add `freeoffgridcalculator.com` and `www.freeoffgridcalculator.com`.
3. Wait for DNS + cert (usually minutes after zone is active).
4. Set apex as primary; confirm www redirects if the UI offers that; otherwise add a
   **Redirect Rule** (zone): `www.freeoffgridcalculator.com/*` → `https://freeoffgridcalculator.com/:splat` 301.

### 1B. Worker CORS — additive only

Edit `worker/index.js` `ALLOWED_ORIGINS`:

```js
"https://freeoffgridcalculator.com",
"https://www.freeoffgridcalculator.com",
```

Keep **all** existing origins (`pages.dev`, both `github.io`, localhost).

Deploy worker (only this file changed):

```bash
cd worker && npx wrangler deploy
```

### 1C. Prove dual-serve

```bash
# both hosts must serve the same shell + same sitemap paths
curl -sI https://freeoffgridcalculator.com/ 
curl -sI https://bigenergyco.pages.dev/
curl -s https://freeoffgridcalculator.com/sitemap.xml | head -5
curl -s https://bigenergyco.pages.dev/sitemap.xml | head -5

# API accepts the new Origin
curl -sI -H "Origin: https://freeoffgridcalculator.com" \
  https://bigenergyco-api.bigenergyco.workers.dev/api/health | findstr /i access-control
```

Manual browser check on the **new** host (same checklist as runbook smoke):
city → 10 kWh/day → grid-tie → Show my options → totals + AI advisor reply.

**Exit criteria:** new host loads calculator end-to-end; AI chat works; old host unchanged.

**Rollback:** Pages project → Custom domains → remove both hostnames. Worker CORS can stay.

---

## Phase 2 — Content/SEO cut (canonical moves; redirects not yet)

Goal: every public absolute URL points at `freeoffgridcalculator.com`.
`pages.dev` still serves the site (no 301 yet) so nothing breaks mid-deploy.

### 2A. Single source of truth for the origin

Introduce one constant (or env in scripts) used by validators:

- `scripts/validate-jsonld.mjs` → `ORIGIN`
- `scripts/check-seo.mjs` → canonical regex
- `scripts/build-city-pages.mjs` → base URL template
- `scripts/live-sanity.mjs` / `scripts/browser-smoke.mjs` → default `BASE`

Suggested value: `https://freeoffgridcalculator.com` (no trailing slash).

### 2B. Rewrite surface (ordered)

1. Generator: `scripts/build-city-pages.mjs`
2. Regenerated city/sitemap artifacts via the project's normal build/allowlist path
   (`scripts/deploy-pages-local.mjs`)
3. Hand-authored: `index.html`, `blog/**`, `solar-heatmap/`, `about/`, `robots.txt`, `sitemap.xml`
4. `_redirects` (still redirect **legacy github.io** to the **new** host):
   ```
   https://sovereign-communication.github.io/BigEnergyCo/*  https://freeoffgridcalculator.com/:splat  301
   https://sovereign-communication.github.io/BigEnergyCo    https://freeoffgridcalculator.com/        301
   ```
5. Docs: README, runbook, worker README.

**Do not** change `assets/js/chat.js` yet (API stays on workers.dev through Phase 2).

### 2C. Ship through the normal gate (mandatory)

`main` → green tests → GH Pages → then CF Pages. Same as `README.md` runbook.

```bash
npm test
node scripts/validate-jsonld.mjs
node scripts/check-chars.mjs
node scripts/check-seo.mjs
node scripts/bump-asset-tokens.mjs
node scripts/deploy-pages-local.mjs --check
git add -A && git commit -m "Point canonical URLs at freeoffgridcalculator.com" && git push origin main
# wait for GH Actions green, then:
npx wrangler pages deploy _pages_staging --project-name bigenergyco --branch main
```

### 2D. Search engines

- GSC new property → submit `https://freeoffgridcalculator.com/sitemap.xml`
- Bing → same sitemap
- Keep the **old** pages.dev GSC property open for 60–90 days (monitor only)
- Update any `google-site-verification` meta if the new property needs a new token
  (keep the pages.dev token until its property is retired)

**Exit criteria:** live-sanity + browser smoke pass **against the new host**;
sitemap URLs all start with the new origin; canonical tags match.

**Rollback:** revert the URL commit on `main`, redeploy both GH + CF. Hostnames still dual-serve.

---

## Phase 3 — API same-origin + WAF (optional but recommended)

Goal: production frontend calls `/api/*` on the site origin.

### 3A. Bind Worker to the zone

Cloudflare Dashboard → Workers → `bigenergyco-api` → Triggers / Custom Domains:

- Route: `freeoffgridcalculator.com/api/*`

Confirm Pages still owns `/` (static) and Worker owns only `/api/*`.

### 3B. Frontend + CSP

- `assets/js/chat.js` → `CF_API_URL = "/api"` (or `""` + path — keep one style)
- `_headers` CSP `connect-src`:
  - add `https://freeoffgridcalculator.com` if still absolute during transition
  - end state: `connect-src 'self' https://power.larc.nasa.gov https://open.er-api.com https://nominatim.openstreetmap.org`
  - keep `https://bigenergyco-api.bigenergyco.workers.dev` until Phase 4 (rollback path)

### 3C. Zone WAF (now possible)

Create rate-limit rule on the zone for `POST /api/chat`:
- 8 requests / 60 s / IP
- 150 requests / 24 h / IP (if supported by your plan; otherwise keep Worker soft daily cap)

This closes the `workers.dev` limitation called out in `DEPLOY_RUNBOOK.md`.

### 3D. Worker CORS cleanup (still keep old)

After same-origin works, production browsers no longer need CORS for the main site.
**Still keep** `pages.dev` + github.io + localhost until Phase 4 soak.

### 3E. Verify

```bash
npm test
node scripts/browser-smoke.mjs https://freeoffgridcalculator.com/
curl -s https://freeoffgridcalculator.com/api/health
```

**Exit criteria:** AI advisor works on new host with no CORS errors in DevTools.

**Rollback:** point `CF_API_URL` back to the workers.dev absolute URL and redeploy;
remove the `/api/*` route if needed. Site calc (client-side) never depended on this.

---

## Phase 4 — Cut old host to 301 + soak

Goal: `pages.dev` permanently forwards; SEO equity consolidates on the new domain.

### 4A. Bulk redirect pages.dev → custom domain

Cloudflare zone for `pages.dev` is not yours — use **Redirect Rules on the Pages project**
or a `_redirects` entry **only works if pages.dev still serves files**.

**Preferred:** Cloudflare **Bulk Redirects / Redirect Rules** at the account or via
Pages "Redirects" if available for your setup. If Pages custom-domain redirect is
offered when you set the custom domain as the primary host, enable it.

If dashboard bulk redirect is unavailable, add a temporary Pages `_redirects`
**only after** confirming Pages still evaluates it on the `*.pages.dev` hostname:

```
https://bigenergyco.pages.dev/*  https://freeoffgridcalculator.com/:splat  301
```

Then redeploy. Verify:

```bash
curl -sI https://bigenergyco.pages.dev/ | findstr /i "HTTP location"
curl -sI https://bigenergyco.pages.dev/blog/ | findstr /i "HTTP location"
```

Must be **301** with `location: https://freeoffgridcalculator.com/...`.

### 4B. CORS retirement window

Wait **≥ 30 days** of clean analytics/health, then remove from `ALLOWED_ORIGINS`:

- `https://bigenergyco.pages.dev` (after 301 proven)
- optionally the old github.io origins if the mirror canonicalizes fully

Keep localhost entries forever.

### 4C. Docs + Search Console

- README / runbook: brand domain = `https://freeoffgridcalculator.com`
- GSC: use Change of Address tool **only if** you treat pages.dev as a property you own
  and are moving off it; many teams skip it for `*.pages.dev` and just submit the new
  sitemap + monitor. Prefer: new sitemap live, old property watch-only.
- Remove obsolete verification tags for hosts you no longer index.

**Exit criteria:** old URLs 301; new domain indexed; no CORS failures for 30 days.

---

## Fallback & rollback matrix

| Failure | Symptom | Action | Blast radius |
| --- | --- | --- | --- |
| DNS / nameservers wrong | New host unreachable | Fix NS at registrar; do not remove pages.dev | None — old host untouched |
| Pages cert not ready | HTTPS error on new host | Wait or re-issue custom domain in Pages | Old host works |
| Phase 2 URL rewrite mistake | Wrong canonical / missing pages | `git revert` URL commit → redeploy GH+CF | Temporary SEO inconsistency |
| Phase 3 API route breaks chat | AI advisor 404/CORS | Point `CF_API_URL` back to workers.dev absolute; redeploy | AI only; sizer still works |
| Phase 4 301 loop / wrong target | Infinite redirect | Remove redirect rule immediately; pages.dev serves again | Minutes of confusion |
| Indexing regression | New domain not crawled | Keep dual-serve; do not 301 pages.dev yet; re-submit sitemap | None if Phase 4 delayed |
| Emergency total revert | New domain toxic / mis-sold | Remove custom domains from Pages; revert URL commit; keep worker CORS | Site returns to pages.dev as primary |

### Hard safety rules

1. **Never** remove `pages.dev` (or GH mirror) before the new host passes
   `scripts/live-sanity.mjs` + `scripts/browser-smoke.mjs`.
2. **Never** remove old CORS origins in the same deploy that first publishes
   the new origin.
3. **Never** flip Phase 4 301 in the same window as a Phase 3 API change.
4. Frontend calculator math is client-side — domain bugs must not block sizing.
   AI chat is the only production path that needs the Worker.
5. Service worker (`sw.js`) is origin-scoped. Clients on `pages.dev` keep a
   separate cache from `freeoffgridcalculator.com`. After Phase 2, bump
   `CACHE_VERSION` + asset tokens via `node scripts/bump-asset-tokens.mjs`
   so **both** origins refresh cleanly. Do not assume one SW cache migrates.

---

## Suggested timeline

| Day | Work |
| --- | --- |
| 0 | Phase 0 (zone, GSC, baseline) |
| 1 | Phase 1 dual-serve + smoke on new host |
| 2–3 | Phase 2 URL rewrite on a branch; full test matrix; merge; deploy |
| 4–7 | SEO submit; watch crawl; **no 301 yet** |
| 8–14 | Phase 3 same-origin API + WAF; smoke |
| 15–45 | Soak on new domain; monitor GSC |
| 46+ | Phase 4 301 pages.dev; CORS retire after extra 30 days |

Skipping the soak is how SEO migrations go wrong. Delay Phase 4 freely —
dual-serve is a valid long-term state.

---

## Verification checklist (every phase)

```bash
# local gates
npm test
node scripts/validate-jsonld.mjs
node scripts/check-seo.mjs
node scripts/bump-asset-tokens.mjs --check
node scripts/deploy-pages-local.mjs --check

# live (replace HOST)
node scripts/live-sanity.mjs
node scripts/browser-smoke.mjs https://HOST/
curl -s https://HOST/sitemap.xml | head -5
curl -sI https://HOST/ | findstr /i "content-security-policy strict-transport"
```

Record in release notes: commit SHA, CF deployment URL, which phase landed,
smoke result, and whether pages.dev still 200s or 301s.

---

## Locked decisions

| Item | Decision |
| --- | --- |
| www | Apex primary; www 301 → apex |
| Brand/title | Public SEO = Free Off-Grid Calculator; maker credit stays in about/legal |
| Same-origin API | After Phase 2 soak (Phase 3) — not day one |
| DNS hosting | Move NS IONOS → Cloudflare (Phase 0A) |

Execution starts at Phase 0A and never skips the dual-serve gate.
