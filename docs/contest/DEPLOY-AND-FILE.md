# Cold Start — deploy and file, in order

This is the manual runbook and evidence record for the contest showcase. The
deployed artifact was built from source commit
`19d5c378a1883901c5754df4566ad2bbbad2bd89`. The documentation revision being
prepared for commit records this deployment; it does not change the deployed
source revision. PR #182 is the sole gated merge lane. PR #172 is a draft
tracker and must never be merged. Follow the recorded [submission gate](https://github.com/Sovereign-Communication/BigEnergyCo/pull/182#issuecomment-5965638088).

The required eight CI checks were green at source commit `19d5c37`:
test, coverage, web-smoke, Lighthouse, quality-lab, quality-evidence, analyze,
and CodeQL. The separate Jev advisory check was red because its title lacked
the plan item ID; scope selection failed, so its live call was skipped. This
CI failure is distinct from the Worker Jev sanity flag, which was false. No
independent Jev result is claimed. Owner approval resolved
the security gate to verified Turnstile plus the deployed Worker limit of 8
requests/minute, with no site-wide challenge and Bot Fight Mode off where
applicable. This does not claim WAF configuration.
Q-15 remains a separate gate: the pre-provisioning HTTP probe returned zero
`Set-Cookie` headers, so the Turnstile secret was provisioned. That probe does
not verify browser third-party cookies; no `cf_clearance` cookie was observed
in the widget flow.

The filing deadline is **20:59 HST on October 2, 2026**; target filing by
20:20 HST to leave time for a manual review. Once the checks are green, freeze
the candidate. There is no automated entry: a person completes and submits the
application by hand.

## Current targets and status

| Item              | Verified fact                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Org repository    | `Sovereign-Communication/BigEnergyCo`                                                                                                                         |
| Deployment source | `19d5c378a1883901c5754df4566ad2bbbad2bd89` (deployed artifact)                                                                                                |
| Pages             | [stable](https://bigenergyco-showcase.pages.dev) · [immutable deployment](https://70d5c3f9.bigenergyco-showcase.pages.dev) · stamp `20261003e`                |
| Showcase Worker   | [API](https://bigenergyco-api-showcase.bigenergyco.workers.dev) · version `8b371a06-1f75-470c-8fe9-36de3927f7ca`                                              |
| Health            | Pages and Worker HTTP 200; all four flags true                                                                                                                |
| KV / D1 / R2      | Seven-day KV share round trip; D1 event write/query; R2 evidence upload/readback all succeeded                                                                |
| Browser           | Honolulu NASA 2021–2025 simulation completed for 3.8 kW PV + 10 kWh LFP; advisor returned a live online response through Turnstile, confirmed in rendered DOM |
| Security gate     | Owner-approved: Turnstile and Worker 8 requests/minute limit; no site-wide challenge; Bot Fight Mode off where applicable; no WAF claim                       |
| Production        | `freeoffgridcalculator.com`, Worker `bigenergyco-api`; do not deploy to it                                                                                    |

The recorded showcase is already deployed. For a future rebuild, stage
committed bytes from the repository root with the public Turnstile site key:

```bash
node scripts/stage-showcase.mjs --output _pages_showcase --turnstile-site-key <public-key>
```

This runs the local Pages builder in check mode with the fixed showcase API
target, injects the public key, and writes the Pages advanced-mode `/api/*`
proxy files. The output is local and is not deployed by this command. Do not
put a Turnstile secret or any other secret in the site key argument.

## Provision and deploy (fresh environment or later candidate)

1. The recorded candidate is deployed at
   `https://70d5c3f9.bigenergyco-showcase.pages.dev` from source
   `19d5c378a1883901c5754df4566ad2bbbad2bd89`. For a fresh environment, create
   the separate Pages project for the org repository and showcase hostname,
   then deploy `_pages_showcase` only after the submission gate permits it.
2. The showcase KV, D1 and R2 bindings are provisioned. Their required
   round-trip checks passed: KV share create/read (seven-day TTL), D1 event
   write/query, and R2 evidence upload/readback.
3. For a fresh environment, set `GROQ_API_KEY`, `TYPESAFE_API_KEY`,
   `TURNSTILE_SECRET_KEY`, and `EVIDENCE_UPLOAD_TOKEN` in the showcase Worker.
   The recorded Jev advisory CI call was skipped after its scope-selection
   failure, and the Worker Jev sanity flag was false. Keep secret values out
   of commands, docs, and output.
4. The deployed public site key and secret were exercised in a browser: a
   Turnstile-guarded advisor request returned a real online answer. The
   showcase Worker enforces a limit of 8 requests per minute.
5. The owner approved the corrected security gate: use verified Turnstile and
   the Worker rate limit; do not enable a site-wide challenge, and keep Bot
   Fight Mode off where applicable. This supersedes the interim Bot Fight
   Mode-on proposal. No WAF configuration is claimed.

## Verify the four gates and live behavior

`/api/health`'s four flags (`turnstile`, `kv`, `r2`, `d1`) report binding or
configuration presence only. Four `true` values do not establish operation.
The recorded candidate meets the four-check operational gate and has the
following evidence:

- KV: seven-day share link created and read back.
- R2: evidence uploaded and read back.
- D1: event written and queried.
- Turnstile/chat: valid browser token accepted; advisor returned a live answer.
- Browser: Honolulu NASA 2021–2025 sizing simulation completed for 3.8 kW PV
  and 10 kWh LFP; advisor result was confirmed in the rendered DOM.
- CI: all eight required checks green at `19d5c37`; the separate Jev advisory
  check was red because its title lacked the plan item ID, scope selection
  failed, and the live call was skipped. The Worker Jev sanity flag was false.

Example authorized R2 upload (set `EVIDENCE_UPLOAD_TOKEN` in the shell from the
Worker secret value; never substitute a real secret into this document):

```bash
curl -i -X POST https://bigenergyco-api-showcase.bigenergyco.workers.dev/api/evidence \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $EVIDENCE_UPLOAD_TOKEN" \
  -d '{"kind":"smoke","name":"run-label","contentType":"application/json","data":"{}"}'
```

These results establish the recorded deployment only. Do not transfer them to
a later build without rerunning the checks. No independent Jev result is
established by the skipped CI call or the false Worker sanity flag.

## File by hand

After the gate is green, freeze the candidate and have a person complete
`docs/contest/APPLICATION.md` and submit before the deadline. Confirm the
repository URL is the org repo and publicly readable, use only verified
product claims and measured traction, and name no competitor. If any required
check is not API 200, the outcome is **NOsubmission**; do not file.
