# Cloudflare Cold Start — entry plan

Repo-wide plan for entering [The Cold Start](https://www.cloudflare.com/connect/cold-start),
Cloudflare's live startup pitch competition, using the `contest/cold-start` branch.

Every rule and date below was read from the official rules at
`https://www.cloudflare.com/connect/cold-start/terms`. Do not work from a
remembered version of them; re-read that page if anything here is contradicted.

---

## 1. The contest, verified

| Fact | Value | Source |
| --- | --- | --- |
| Contest period ends | **October 2, 2026 at 11:59 PM PDT** | Official Rules §2 |
| Start time | September 10, 2026 at 9:00 AM PDT | Official Rules §2 |
| Finalists | 5, each given **10 minutes on stage** | Official Rules §6 |
| Where | Moscone West, San Francisco, **October 19, 2026** | Official Rules §6 |
| Grand Prize | $500,000 Cloudflare credits + an SF billboard + VIP dinner (judges' choice) | Official Rules §8 |
| Secondary Prize | $100,000 Cloudflare credits (live audience vote) | Official Rules §8 |
| Application form | `https://forms.gle/oBoBwUD5CVhqXqRu6` | Official Rules §4 |

Official Rules §2 verbatim: *"The Contest will begin on September 10, 2026 at
9:00 AM PDT ('Start Time') and end on October 2, 2026 at 11:59 PM PDT ('Contest
Period')."*

**The deadline is ~31 hours out. It is not 7 hours.** Any earlier assumption of
7 hours was wrong and was corrected against the official rules. Plan against the
real deadline, but keep the ordering below anyway — it front-loads the filing so
a late surprise cannot cost the entry.

### 1.1 Judging criteria — each worth 20%

Official Rules §6. Scored 1–5; ties broken on **product quality**.

1. **Product quality**
2. **Market opportunity and traction**
3. **Team and pitch strength**
4. **The range of Cloudflare products and services used**
5. **Variety of industries represented**

Criterion 4 is a real scoring axis, not a formality. See §6 below for the
honest way to move it.

### 1.2 Rules that change how the work is done

- **The showcase is mandatory.** Official Rules §4: *"Submissions must describe
  how Cloudflare fits into the Entrant's stack and use Cloudflare's developer
  platform to build their application."* The Cloudflare integration is not
  decoration; failing it voids the submission.
- **Cloudflare receives the repository.** §5: *"the Entrant agrees to provide
  the Sponsor with the GitHub repository or URL of their Submission."* Everything
  in this repo is judge-visible — source comments, docs, the plan, the ledger.
- **One submission per entrant.** §4. There is no second attempt.
- **No automated entry.** §4: *"Persons may not enter using robotic, programmed,
  or any other automated means of entry."* The application is filled in by a
  person, by hand. See `docs/contest/MISSION.md` — this constrains the agent too.
- **No competitor products named.** §4. This is also the project's own D-05.
- **Must be a real product or working prototype**, not stealth / waitlist-only /
  idea-only. §3. BigEnergyCo qualifies.
- **Eligibility:** US or Canada resident, 18+, under USD $10,000,000 total
  funding, not sanctioned. §3.
- **Physical presence required to win.** §7: winners *"must be physically present
  at Cloudflare Connect."* That constrains the Grand Prize, not finalist status.
- **Void outside the US and Canada.** Header.

---

## 2. Isolation — do not touch the other checkout

This clone lives at `C:/Users/SCM/Documents/GitHub/BigEnergyCo/BigEnergyCo-showcase`.
It is a **plain clone with its own `.git`**, which is deliberate.

There is a concurrent session (thread "Drive PR 165 to Completion") working PR
#171 in `C:/Users/SCM/Documents/GitHub/BigEnergyCo/BigEnergyCo`. That checkout
carries that session's **uncommitted work** — `assets/js/heatmap.js` (~1,211
lines) and `docs/plan/LEDGER.jsonl` — and that session has stated in its own
transcript: *"The write went to the main checkout again"* and *"an earlier
`git reset` unstaged the new data files, so the stage lost them again — deploy
reads `git ls-files`."*

So that session writes to the main checkout **and** builds its staged Lighthouse
tree from `git ls-files` **there**. A single `git add`, `stash`, `checkout` or
`commit` in that checkout would change what its `deploy:check` measures while it
is deciding whether to merge a branch sitting below the owner's 95 bar.

**Therefore, from this clone: never `git add`, `stash`, `checkout`, `worktree`,
`clean`, `reset` or `restore` anything in the main checkout.** Do not read from
`.worktrees/slider-canonical`. Its ground, not ours. Nothing in this plan
requires it.

Branch base: `contest/cold-start`, forked from `showcase/cold-start`
(`8d768db`), which is 1 commit ahead of `main` (`61ebcd0`) and **0 behind**. It
does not depend on PR #171.

---

## 3. CPU embargo

While the #171 session is running, **do not run** anything CPU-heavy:

- `npm run gate:lighthouse`
- `npm run gate:byte-budgets`
- `npm run deploy:check`
- `npm run smoke:local`
- any browser or Lighthouse session
- `wrangler deploy`

Reason: that session is deciding a merge on a three-run distribution where
desktop TBT measured 89 / 145 / 93 ms — it explicitly refused to call that
closed. The machine is already carrying 18 node processes and 66 listening
ports. That session has already been misled once by load here (a 445 ms TBT on a
byte-identical run, correctly diagnosed as machine load rather than product).
Running Lighthouse or a staged build alongside it corrupts the exact number it is
deciding on.

Always safe, and the default until told otherwise: `npm test` (deterministic, no
browser), reading, writing code, writing tests, drafting documents.

Lift the embargo once that session reports its final numbers, or is parked.

---

## 4. Defects to fix first — in this order

The judge run (§8) ranked this phase highest at 77%.

### B1 — Turnstile will 403 the advisor on the live demo

- `worker/index.js:557` gates `POST /api/chat` on `env.TURNSTILE_SECRET_KEY`.
  Once the secret exists, every advisor call must carry `body.turnstileToken`.
- `docs/cloudflare-showcase.md` §1e says the client integration is *"a
  follow-up, not in this branch"*.
- PR #172 Phase 3 instructs `wrangler secret put TURNSTILE_SECRET_KEY`.

So following the deploy tracker as written **kills the AI advisor on the demo
with HTTP 403**, and no client can recover, because `assets/js/chat.js` is not
in the branch. The advisor is a locked centrepiece feature (D-11).

**Fix:** wire the Turnstile widget into `assets/js/chat.js` — explicit render,
token captured and sent as `turnstileToken`, non-fatal when no site key is
present. Add a test asserting the client sends the token.

### B2 — No advisor fallback

The judge's largest unflagged risk (45%). The advisor depends on Groq and Jev,
both third parties that can rate-limit or fail mid-demo. Add a deterministic,
pre-written fallback reply with a visible "degraded" label when either is
unavailable, so a failure never presents as a dead chat box. This is Q-14
resilience, which the master plan already names. Add a pre-filing smoke test that
calls both and reports which answered.

### B3 — The lead-funnel framing contradicts the project

`worker/turnstile.mjs` (header comment) and `docs/cloudflare-showcase.md` §2
Rule 3 both describe the product as *"the top of a verified-electrician lead
funnel"* and *"what the paying electricians buy."*

That contradicts D-18 (*"no trackers, no ads, no lead capture"*), §14 non-goals
(*"No accounts, lead forms, quotes marketplace, affiliate links, ads, paywalls
or sales"*), and the `AGENTS.md` golden rule. It ships in worker source, and
§1.2 above means Cloudflare reads this repo. Remove it.

Keep the genuine rationale — protecting paid Groq tokens and a free public tool
from automated abuse. Drop the revenue-funnel claim that does not exist and that
the plan forbids.

### B4 — Bot Fight Mode re-creates F-44

`docs/cloudflare-showcase.md` §2 Rule 3 instructs **Bot Fight Mode: On**. That is
the exact mechanism behind the repo's own open finding **F-44**, where the
production domain returns `HTTP 403 cf-mitigated: challenge` to non-browser
clients and verified crawlers. F-44 is closed by owner action **O-09** — by
turning that class of challenge *off* for real visitors and allowing verified
bots.

Realign the guidance: verified-bot allowance, with an exemption for verified
search crawlers, citing F-44 / R-SEO-07 / O-09. Isolated on the showcase hostname
it breaks nothing today; shipping guidance that re-creates a known open finding
is what costs later.

### B5 — Missing secret in the provision check

`scripts/cf-provision-check.mjs` lists `TURNSTILE_SECRET_KEY` and `GROQ_API_KEY`
but omits `TYPESAFE_API_KEY`, which PR #172 Phase 3 requires. Add it.

---

## 5. Application narrative

"Team and pitch strength" is 20% of the score and a **10-minute live pitch**,
filed as a written application.

Deliverables:

- The 10-minute spoken narrative, structured to the five judging criteria.
- The ~300-word form copy for the application itself.
- The Cloudflare-integration section (a stated Submission Criterion — §1.2).
- Traction numbers, captured live before filing, not estimated.
- A 300-word description of what the product is for someone who has never seen it.

Constraints that apply to the writing:

- **Human-authored and filed by a person.** The rule bars automated entry.
- **No competitor products named** (§4, and D-05).
- Original content only.
- Describe how Cloudflare fits the stack — this is scored, not boilerplate.

---

## 6. Breadth — a real scoring axis, honestly

Criterion 4 (*"the range of Cloudflare products and services used"*) is worth the
same 20% as product quality. The branch already spans **Workers, Pages, KV, R2,
D1, Turnstile, Rate Limiting, WAF, Cache Rules, Web Analytics** — ten surfaces,
which is a credible spread before anything is added.

Four additions, each tied to a real requirement rather than bolted on. The
project's D-04 is *"no change for its own sake"*, and bolting on unused products
would cost product quality (the other 20%) and read as gaming. Each of these does
real work:

| Product | What it genuinely does here |
| --- | --- |
| **Browser Rendering** | Runs the repo's **existing** `scripts/browser-smoke.mjs` against the showcase on a schedule, writing results to R2. Reuses code that already ships — the most defensible addition. |
| **Cron Triggers** | Drives the above and aggregates the D1 ledger. |
| **AI Gateway** | Observability on the Groq and Jev calls, which makes **Q-18 advisor truthfulness** measurable instead of asserted. |
| **Analytics Engine** | The right tool for the traction aggregates behind criterion 2. |

**Explicitly excluded:**

- **Email Routing** — an "email me my result" share is a lead-capture vector and
  breaks D-18.
- **Workers AI** — conflicts with D-11, which locks the advisor to Groq.

Every addition needs tests. None ship untested.

---

## 7. Deploy

Isolated by construction. The worker is named `bigenergyco-api-showcase`, so
`wrangler deploy` can never clobber production `bigenergyco-api`.

Order:

1. `npx wrangler login`
2. Pages project `bigenergyco-showcase`, connected to the **fork**
   (`Treystu/BigEnergyCo`), production branch `main`
3. `npx wrangler kv namespace create SHARE_KV` (+ `--preview`)
4. R2 bucket `bigenergyco-evidence-showcase`
5. `npx wrangler d1 create bigenergyco-usage-showcase`, then apply
   `worker/d1-schema.sql`
6. Turnstile site for `bigenergyco-showcase.pages.dev`
7. `wrangler secret put GROQ_API_KEY`, `TYPESAFE_API_KEY`
8. **The cookie gate decides whether `TURNSTILE_SECRET_KEY` is set at all** (§9)
9. Web Analytics token → the `cf-beacon-token` meta
10. `npm run cf:check` green
11. `cd worker && npx wrangler deploy`
12. WAF rate-limit rules `chat-api-hard-limit` and `showcase-write-apis`; cache
    rules per `docs/cloudflare-showcase.md` §3. **Bot Fight Mode not enabled as
    written** (B4).

**Traction is time-sensitive.** The D1 ledger and Analytics Engine exist partly
to answer criterion 2, and they need real numbers *before* the filing, not after.

---

## 8. The judge run behind this plan

The plan was checked against the project's own Jev gate before execution, using
`scripts/lib/jev-live.mjs` (the repo's sanctioned wire, direct TypeSafe, model
`jev-1.13.0`, no fallback).

| Question | Score /5 | Where it landed |
| --- | --- | --- |
| Contest completeness | 2.77 | 39% *exemplary*, 23% *contest-ready*, **18% *serious gaps*** |
| Plan integrity | 3.26 | 55% *exemplary*, 23% *fully evidenced* |
| Server-side-state reconciliation | 0.88 | **79% — "prose only, no governance for the new datastores"** |
| Cookie bar protection | 1.77 | **45% — "named as a risk with no owner and no gate"** |

Choices: biggest gap = **fix the defects (77%)**; worst misalignment =
**zero-dependency doctrine (61%)**; largest unflagged risk =
**advisor downtime (45%)**; deadline handling = **sequence so the first hours
already produce a filed entry (44%)**.

Three things changed as a result: the datastore governance in §10 (R-CF-09), the
cookie gate in §9, and filing early rather than last.

---

## 9. The cookie gate — decide before provisioning, not after

Q-15 demands **0 cookies**. Cloudflare Turnstile's cookie behaviour in managed
mode is unverified.

Run a measurement **before** `TURNSTILE_SECRET_KEY` is set, and let the result
decide in advance:

- **0 cookies** → provision it. Record the measurement as evidence in the ledger.
- **≥1 cookie** → either switch Turnstile to a non-cookie mode, **or do not
  provision it**: ship the advisor unguarded on the showcase and describe
  Turnstile honestly as shipping rather than shipped.

Q-15 is never silently broken. If an exception is ever taken it is a named owner
action with a name attached, recorded in the ledger.

The judge's wording on this was exact: naming the risk without an owner and a
gate is the same as not naming it.

---

## 10. Amendment A-003 — written now, merges after #171

**A-002 is already taken.** PR #171 carries an owner-approved amendment dated
2026-09-29 that re-pins the plan from `c8271d11…` to `8c47fc79…`, and it is
still open. Ours is **A-003**.

Because `npm run plan:check --base` verifies the SHA chain, **A-003 cannot
validate until #171 merges** — the amendments are strictly sequential. Write it
and open the PR early; gate the merge. Nothing in the deploy or the filing
depends on it.

### D-21 — Isolated platform surface

Cloudflare bindings are optional, presence-gated, and structurally incapable of
promoting. The calculator and the sizing engine remain 100% client-side; this is
a **named carve-out** to the zero-runtime-dependency doctrine, not an exception
smuggled through it. Add the matching sentence to `AGENTS.md` so both governing
documents agree.

### R-CF-01 .. R-CF-10

| ID | Requirement |
| --- | --- |
| 01 | Every binding is presence-gated. Unprovisioned returns HTTP 503 naming the missing step, never a bare `TypeError`. |
| 02 | Turnstile is provisioned **only when the client can produce a token**. Server and client are one item, never a follow-up. *(Makes B1 structural.)* |
| 03 | The D1 ledger stores no IP, user agent, email, coordinates or free-form client field. Country only from `cf-ipcountry`. |
| 04 | R2 evidence uploads are kind-allowlisted, content-type allowlisted, 5 MB capped. |
| 05 | KV share payloads are re-validated on read and expire in 7 days. |
| 06 | The showcase surface cannot mutate production. Asserted by test. |
| 07 | No hostname carrying R-SEO-07 may serve a managed challenge or Bot Fight Mode to verified crawlers. *(Closes the F-44 recurrence path.)* |
| 08 | Web Analytics stays cookieless per D-18 and R-PRIV-05. |
| 09 | **Every showcase datastore — `SHARE_KV`, `EVIDENCE_BUCKET`, `USAGE_DB` — gets a registry entry with source, grade and `review_by`, covered by `data:check`, with retention stated**, exactly like every P2 registry entry under Q-10. |
| 10 | The advisor degrades to a labelled deterministic fallback when Groq or Jev is unavailable, never a blank or broken UI. *(B2)* |

R-CF-09 is the direct answer to the judge's lowest score. Without it the new
server-side state is ungoverned, which is the single thing Q-10 exists to
prevent.

### Also added

- **Q-19 — Cloudflare platform integrity.** Every showcase endpoint fails loud
  and named; no silent degradation; no cookie regression; no managed challenge on
  an indexed surface. Ratchets from P0.6, absolute at P10. Add the `cf:check`
  row to §3.2 on the same schedule.
- **P0.6 — Cloudflare platform integration (isolated surface).** In P0, so the
  P1→P11 dependency graph is untouched. Exit: R-CF gate green, a `baseline`
  ledger row, a live showcase URL.
- **V-12** — Turnstile cookie behaviour (now gated by §9, not merely recorded).
- **V-13** — the judging criteria. **Answered above in §1.1**; close it with a
  citation to the Official Rules.
- **O-10** — provision the showcase surface and file the application.
- **§7** module disposition — place `turnstile.mjs`, `share-cache.mjs`,
  `evidence.mjs`, `usage-ledger.mjs`, `cf-provision-check.mjs`.

---

## 11. Verify, then file

**Real browser, not just curl.** The `docs/cloudflare-showcase.md` §5 checks
would *not* have caught B1, because the `/api/chat` curl expects a 403 — it
passes on the broken configuration. Drive the real showcase URL and confirm:

- the advisor answers, or degrades visibly with its label
- the calculator sizes a system end to end
- the share-link round trip
- an evidence upload
- a usage event posted
- `/api/health` shows all four showcase flags

Capture the demo URL and a short screen recording.

Then, once, under embargo lifted: `gate:byte-budgets`, `deploy:check`,
`smoke:local`, `format:check`, `plan:check`, `npm test`.

Note on byte budgets: this branch merges against `main`, where A-002's interim
limits do not exist, so `cf-beacon.js` (48 lines) is measured against the
un-relaxed §3.1 table. It is token-gated and never ships on a placeholder, but
report the number either way.

**Then file, by hand**, on what is verified, describing anything unverified as
shipping rather than shipped. Include the repository URL — Cloudflare requires
it. Remember: **one submission**, and no automated entry.

---

## 12. What is never done in this effort

- No promotion to production. Nothing touches `/` or `freeoffgridcalculator.com`.
- No merge, rebase, or staging of PR #171. It is below the owner's 95 bar and
  owned by a live session.
- No git write in the main checkout, ever (§2).
- No moving any ratchet baseline.
- No chasing the whole-program Jev 99.
- No Web Analytics on the production domain (O-02 stays open).
- No automated filing.
- No weakening, skipping, or re-baselining any existing gate.
- No competitor names (D-05, and Official Rules §4).
- No decision on the home/desktop content cut — that is the owner's.

---

## 13. Canonical roadmap after this

- **P0.4 is not done.** PR #171 sits at 92.88 against the owner's 95 bar. Home
  and desktop LCP (2.8 s against a 1.0 s ceiling) is a content-cut decision on a
  917-element document. Measured and reported, not decided.
- **P0.5 is all owner actions and all cheap**: O-01 (`TYPESAFE_API_KEY` — still
  why `jev-complete` is red), O-03, O-05, and **O-09**, the Cloudflare zone fix
  for F-44. O-09 is worth doing *because* of this entry — the same dashboard, the
  same bot-mitigation surface.
- **Then P1.1–P1.6**, the live truth fixes. P1.1 (the ×10/×5 turnkey
  multiplier) and P1.3 (coordinate rounding) are the most judge-visible truth
  defects on a live demo.
- **A-003 merges after #171**, chaining from `8c47fc79…`.

---

## 14. Fallbacks

| If | Then |
| --- | --- |
| The #171 session runs long | Stay on embargo-safe phases. File on the Pages-only demo if the worker is not up. The calculator is the product; the bindings are the pitch layer. |
| #171 does not merge | The entry is unaffected. A-003 stays open and chained, recorded as pending in the ledger. |
| Turnstile unverified, or the cookie gate fails | Do not set the secret. The advisor behaves exactly as today. |
| Groq or Jev is down at filing | B2's fallback carries the demo, and the application says so. |
| Fork-account Cloudflare access fails | File on the Pages demo without the worker, describing the bindings as shipping. |
| A PR does not merge in time | File anyway with the demo URL and repository URL. A submission beats a perfect branch. |