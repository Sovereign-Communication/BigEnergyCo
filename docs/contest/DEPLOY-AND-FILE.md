# Cold Start — deploy and file, in order

Everything below needs a human with Cloudflare dashboard access. It is written
so it can be followed start to finish without re-deriving the reasoning.

**Two standing constraints hold throughout:**

- **Isolation.** A concurrent session owns the sibling checkout
  `.../BigEnergyCo/BigEnergyCo` and `.worktrees/slider-canonical`. Never `git
  add`, `stash`, `checkout`, `worktree`, `clean`, `reset` or `restore` there.
  Its ground, not this branch's.
- **One submission.** Official Rules §4. There is no second attempt, and
  automated entry is barred. The application is filled in by a person, by hand,
  from `docs/contest/APPLICATION.md`.

---

## Where things are

| Thing | Value |
| ----- | ----- |
| Branch | `contest/cold-start` |
| Fork | `Treystu/BigEnergyCo` |
| Showcase Pages site | `bigenergyco-showcase.pages.dev` |
| Showcase worker | `bigenergyco-api-showcase` (workers.dev: `bigenergyco-api-showcase.bigenergyco.workers.dev`) |
| Production (do not touch) | `freeoffgridcalculator.com`, worker `bigenergyco-api` |

The `-showcase` suffix on the worker name is what makes promotion structurally
impossible by accident: `wrangler deploy` from `worker/` can never overwrite
production `bigenergyco-api`.

---

## Step 1 — land the fixes (done, needs a PR)

The five defects are fixed and tested on this branch. Open a PR against `main`,
per `AGENTS.md` §1. Nothing in the demo depends on the merge, only on the
branch being pushed.

## Step 2 — Pages project (the demo URL)

Dashboard → Workers & Pages → Create → Pages → Connect to Git → select
**`Treystu/BigEnergyCo`** (the fork) → production branch `main`.

Then add the Turnstile site key as a meta tag **only if** Step 4 provisions
Turnstile:

```html
<meta name="bec-turnstile-site-key" content="<site key>">
```

Until then, omit it. `assets/js/turnstile-client.js` resolves `null` for a
missing key and the advisor posts without a token, which is exactly the
pre-existing behaviour.

## Step 3 — worker bindings

```bash
cd worker

npx wrangler kv namespace create SHARE_KV
npx wrangler kv namespace create SHARE_KV --preview
# paste both ids into worker/wrangler.json

# R2 binds by name; create it in the dashboard, no id to paste:
#   bigenergyco-evidence-showcase

npx wrangler d1 create bigenergyco-usage-showcase
# paste database_id (+ preview id) into worker/wrangler.json
npx wrangler d1 execute bigenergyco-usage-showcase --file d1-schema.sql

npx wrangler secret put GROQ_API_KEY
npx wrangler secret put TYPESAFE_API_KEY
```

`npm run cf:check` fails while any `REPLACE_WITH_*` placeholder remains, and it
now names all three required secrets.

## Step 4 — the cookie gate, BEFORE Turnstile

This ordering is the whole point of §9, and it is the one step most likely to
be skipped by someone in a hurry. **Do not create the Turnstile site until this
has run.**

```bash
node scripts/cold-start-preflight.mjs \
  --chat https://bigenergyco-api-showcase.bigenergyco.workers.dev \
  --page https://bigenergyco-showcase.pages.dev \
  --cookies --json
```

(Needs the worker deployed first for the `--chat` half; the cookie half only
needs the Pages site up.)

Read `cookieGate`, then act on it:

- **`provision: true`** → create the Turnstile site for
  `bigenergyco-showcase.pages.dev`, add the site-key meta (Step 2), and only
  then `npx wrangler secret put TURNSTILE_SECRET_KEY`. Server and client ship
  together (R-CF-02); shipping the secret first is what 403'd the advisor.
- **`provision: false`** → do **not** set the secret. The advisor runs
  unguarded on the showcase, and the application describes Turnstile as
  *shipping*, not *shipped*.
- **Not measured** → also do not set it, and re-run until it is. An unmeasured
  risk is not a passed gate.

Whichever way it goes, record it in the ledger.

## Step 5 — deploy the worker

```bash
cd worker && npx wrangler deploy
npm run cf:check
```

## Step 6 — WAF, cache rules, bot management

Per `docs/cloudflare-showcase.md` §2 and §3. The one thing to get right:

- **Bot Fight Mode: OFF.** Verified Bots: **Allow**. Turning Bot Fight Mode on
  re-creates this repo's own finding **F-44**, where the domain 403s verified
  crawlers. It is governed by R-SEO-07 and closed by owner action O-09, and
  R-CF-07 carries the same rule onto the showcase hostname.

## Step 7 — verify in a real browser, not just curl

The §5 curls all pass against the configuration that was broken, so they prove
nothing on their own. Drive the page:

1. Advisor answers — or degrades with its visible **"offline answer, not the
   live AI"** label.
2. Calculator sizes a system end to end.
3. Share-link round trip returns the same numbers.
4. An evidence upload succeeds.
5. A usage event posts.
6. `/api/health` shows all four showcase flags true.

Then capture the demo URL and a short screen recording.

**Anything on this list you did not watch working is described in the
application as *shipping*, never as *shipped*.**

## Step 8 — file, by hand

Open `docs/contest/APPLICATION.md`. Fill the form yourself:

- [ ] 300-word description, demo URL substituted
- [ ] Traction figures **measured now**, each with its window
- [ ] **Repository URL** — required by Official Rules §5
- [ ] Repository is public and readable — Cloudflare reads it
- [ ] Only verified Cloudflare products listed as shipped
- [ ] No competitor named anywhere
- [ ] Submitted by a person, by hand

## Step 9 — record it

Append rows to `docs/plan/LEDGER.jsonl` with the SHA that was actually
measured:

- `gate-run` — the preflight's JSON output (advisor state, Jev state, cookie
  count, and the §9 decision it forced)
- `note` — anything that could not be verified, named as such

The ledger records what was measured, not what was hoped. A gate nobody records
is indistinguishable from a gate that was never run.
