# Cold Start — deploy and file, in order

This is the current manual runbook for the contest showcase. The repository is
`Sovereign-Communication/BigEnergyCo`; latest `main` is `d7665c9` (PR #184).
PR #182 is the sole gated merge lane. PR #172 is a draft tracker only and must
never be merged. Follow the newest Lucas comment on #182:
[submission gate](https://github.com/Sovereign-Communication/BigEnergyCo/pull/182#issuecomment-5965638088).
The outcome is either **API 200 on all four required checks** or
**NOsubmission**.

The filing deadline is **20:59 HST on October 2, 2026**; target filing by
20:20 HST to leave time for a manual review. Once the checks are green, freeze
the candidate. There is no automated entry: a person completes and submits the
application by hand.

## Current targets and status

| Item             | Current fact                                                                          |
| ---------------- | ------------------------------------------------------------------------------------- |
| Org repository   | `Sovereign-Communication/BigEnergyCo`                                                 |
| `main`           | `d7665c9` (PR #184)                                                                   |
| Gated merge lane | PR #182 only                                                                          |
| PR #172          | Draft tracker; never merge                                                            |
| Pages            | `bigenergyco-showcase.pages.dev`                                                      |
| Showcase Worker  | `bigenergyco-api-showcase.bigenergyco.workers.dev`                                    |
| R2               | Account activated; `bigenergyco-evidence-showcase` created; binding still being added |
| Production       | `freeoffgridcalculator.com`, Worker `bigenergyco-api`; do not deploy to it            |

The showcase Pages build is staged from committed bytes. From the repository
root, with the public Turnstile site key available:

```bash
node scripts/stage-showcase.mjs --output _pages_showcase --turnstile-site-key <public-key>
```

This runs the local Pages builder in check mode with the fixed showcase API
target, injects the public key, and writes the Pages advanced-mode `/api/*`
proxy files. The output is local and is not deployed by this command. Do not
put a Turnstile secret or any other secret in the site key argument.

## Provision and deploy

1. Create/configure the separate Pages project for the org repository and
   showcase hostname. Use `_pages_showcase` as the output directory and deploy
   the staged output only after the submission gate permits it.
2. Create the showcase KV namespaces, D1 database and schema, and R2 bucket;
   bind them to the showcase Worker. R2 account activation and bucket creation
   are complete, but its binding is still in progress. Do not call R2 ready
   until the Worker binding and readback work.
3. Set the showcase Worker secrets using Wrangler: `GROQ_API_KEY`,
   `TYPESAFE_API_KEY`, `TURNSTILE_SECRET_KEY`, and `EVIDENCE_UPLOAD_TOKEN`.
   The latter is required for evidence uploads. Keep secret values out of
   commands, docs, and output.
4. Configure the site's public Turnstile key through the stage helper, deploy
   the matching Worker/client, and verify the advisor in a browser. The
   presence of a Turnstile key or secret alone is not proof of a working
   challenge flow.
5. Keep **Bot Fight Mode OFF** and **Verified Bots: Allow**. This is a required
   regression check because enabling Bot Fight Mode previously challenged
   verified crawlers (F-44). PR #182's checkbox currently says ON; that
   conflict is unresolved and must be resolved under its gated review before
   treating configuration as approved.
6. Do not assume custom WAF rules on `pages.dev` are owned by this project's
   customer zone. Verify the actual account/hostname scope before claiming
   such rules are configured; use the Worker protections where applicable.

## Verify the four gates and live behavior

`/api/health`'s four flags (`turnstile`, `kv`, `r2`, `d1`) report binding or
configuration presence only. Four `true` values do not establish operation.
Meet the #182 requirement with API 200 on all four required checks, then
complete the following read/write and browser checks before calling the
showcase ready:

- KV: create a share link and read it back with the same values.
- R2: upload with bearer authorization and read the stored object back.
- D1: post a usage event and verify the resulting row.
- Turnstile/chat: browser obtains a valid token and advisor request succeeds;
  a tokenless request returns 403 when the secret is configured.
- Browser: calculator completes a sizing flow; advisor answers or clearly
  shows its offline fallback; share round trip works; evidence upload and usage
  event work.

Example authorized R2 upload (set `EVIDENCE_UPLOAD_TOKEN` in the shell from the
Worker secret value; never substitute a real secret into this document):

```bash
curl -i -X POST https://bigenergyco-api-showcase.bigenergyco.workers.dev/api/evidence \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $EVIDENCE_UPLOAD_TOKEN" \
  -d '{"kind":"smoke","name":"run-label","contentType":"application/json","data":"{}"}'
```

Do not mark Turnstile or deployment verification complete until these checks
have actually passed. Unobserved behavior remains unverified in the
application.

## File by hand

After the gate is green, freeze the candidate and have a person complete
`docs/contest/APPLICATION.md` and submit before the deadline. Confirm the
repository URL is the org repo and publicly readable, use only verified
product claims and measured traction, and name no competitor. If any required
check is not API 200, the outcome is **NOsubmission**; do not file.
