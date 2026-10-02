# A-003 — drafted, ready to append to `docs/plan/AMENDMENTS.md`

**This file is a staging area, not the ledger of record.** A-003 belongs in
`docs/plan/AMENDMENTS.md`, and it is written here first because appending it
today would break `npm run plan:check` — deliberately.

## Why it is not in AMENDMENTS.md yet

The pin validator (`scripts/lib/plan-pin.mjs`) enforces a strictly sequential
chain: every entry must start where the previous one ended, every entry needs
64-hex before/after hashes, and the last entry must end at the hash
`PLAN.lock.json` pins. This branch is at `c8271d11…` (A-001 applied).

**A-002 is taken and is still open in PR #171**, which re-pins the plan to
`8c47fc79…`. So:

- There is no legal slot for A-003 until A-002 lands. Adding A-003 now would
  make it start from `c8271d11…` and collide with A-002's claim on the next
  number.
- Its `Plan-SHA256-before` is not knowable from this checkout, and its `after` is
  not knowable until the plan text it describes actually exists.

Appending a placeholder would have made `plan:check` fail on six counts, which
is the gate doing its job. The honest sequencing is: merge #171, then append
A-002's real hashes, then append this entry with its own, then merge A-003.

**Verified:** `npm run plan:check` on this branch with A-003 parked here reads
`PLAN PIN OK` at `c8271d11…`.

## How to land it

1. Merge PR #171. That appends A-002's real entry and re-pins the lock to
   `8c47fc79…`.
2. On a branch off that merge, edit `docs/plan/MASTER_PLAN.md` with the sections
   listed below.
3. `node scripts/check-plan-pin.mjs --print-sha` for the new hash, then set
   `Plan-SHA256-after` in the appended entry and `current_sha256` in
   `docs/plan/PLAN.lock.json`.
4. Append the entry below verbatim, substituting the two hashes.
5. Owner approves as `@Treystu`. Merge.

Nothing in the deploy, the demo, or the Cold Start filing depends on A-003
merging. It is governance for work already done, not a gate on it.

---

## The entry to append

```markdown
## A-003: Cloudflare platform surface, isolated (D-21, R-CF-01..10, Q-19, P0.6, V-12, V-13, O-10)

- Date: <YYYY-MM-DD>
- Approved-by: @Treystu
- Plan-SHA256-before: <the A-002 after-hash, 64 hex>
- Plan-SHA256-after: <the new hash, 64 hex>
- Sections: §0 doctrine (zero-runtime-dependency carve-out); §3.2 (add the cf:check row); §5 (F-44 cross-reference); §7 (module disposition for the five showcase modules); §9 (Q-19); §12 (P0.6); §14 (non-goals); §15 (V-12, V-13); §16 (O-10); decisions D-21; requirements R-CF-01..R-CF-10
- Rationale: <the Rationale section below>
```

### D-21 — Isolated platform surface (new decision)

Cloudflare bindings are **optional, presence-gated, and structurally incapable
of promoting.** The calculator and the sizing engine remain 100 % client-side;
this is a **named carve-out** to the zero-runtime-dependency doctrine, not an
exception smuggled through it.

Concretely: a missing binding returns HTTP 503 naming the missing provisioning
step, never a bare `TypeError`; the showcase worker is named
`bigenergyco-api-showcase`, so `wrangler deploy` cannot reach production
`bigenergyco-api`; and no showcase endpoint can mutate production state, which
is asserted by test (R-CF-06).

The matching sentence goes into `AGENTS.md` §3, so both governing documents
agree on the carve-out rather than one of them being quietly wrong.

### R-CF-01 .. R-CF-10 (new requirements)

| ID        | Requirement |
| --------- | ----------- |
| **R-CF-01** | Every Cloudflare binding is **presence-gated**. Unprovisioned returns HTTP 503 naming the exact missing step — never a bare `TypeError`, never a silent empty response. |
| **R-CF-02** | Turnstile is provisioned **only when the client can produce a token**. Server and client are one item, never a follow-up. |
| **R-CF-03** | The D1 ledger stores **no** IP, user agent, email, coordinates, or free-form client field. Country only, from `cf-ipcountry`. |
| **R-CF-04** | R2 evidence uploads are kind-allowlisted, content-type allowlisted, and capped at 5 MB. |
| **R-CF-05** | KV share payloads are re-validated on read and expire in 7 days. |
| **R-CF-06** | The showcase surface **cannot mutate production**. Asserted by test. |
| **R-CF-07** | No hostname carrying R-SEO-07 may serve a managed challenge or Bot Fight Mode to verified crawlers. Closes the F-44 recurrence path. |
| **R-CF-08** | Web Analytics stays cookieless, per D-18 and R-PRIV-05. |
| **R-CF-09** | **Every showcase datastore — `SHARE_KV`, `EVIDENCE_BUCKET`, `USAGE_DB` — gets a registry entry with source, grade and `review_by`, covered by `data:check`, with retention stated**, exactly like every P2 registry entry under Q-10. |
| **R-CF-10** | The advisor degrades to a **labelled deterministic fallback** when Groq or Jev is unavailable — never a blank or broken UI. |

**R-CF-09 is the direct answer to the judge's lowest score.** Run against the
plan before any of this was written, server-side-state reconciliation scored
**0.88/5**, with 79 % reading *"prose only, no governance for the new
datastores"*. Q-10's entire mechanism is "every value resolves to a registry
entry with source, grade and date", and three new datastores with no such entry
is exactly the failure mode it exists to prevent.

**R-CF-02 makes B1 structurally inexpressible.** The defect was that
`TURNSTILE_SECRET_KEY` could be provisioned while the client integration was
absent — which 403'd the live advisor with no client recovery. A requirement
binding server and client into one item removes that configuration from the
space of things someone can express.

### Also added

- **Q-19 — Cloudflare platform integrity** (new quality attribute). Every
  showcase endpoint fails loud and named; no silent degradation; no cookie
  regression; no managed challenge on an indexed surface. Ratchets from P0.6,
  absolute at P10. The `cf:check` row joins the §3.2 schedule on the same
  cadence as the other gates.
- **P0.6 — Cloudflare platform integration (isolated surface)** (new P0 item, so
  the P1→P11 dependency graph is untouched). Exit: R-CF gate green, a
  `baseline` ledger row, a live showcase URL.
- **V-12 — Turnstile cookie behaviour** (new verified-against item). Closed by a
  gate that decides provisioning *before* the secret is set.
- **V-13 — the judging criteria** (new verified-against item). **Answered** in
  §1.1 of the contest plan, which maps each of the five criteria to where it is
  addressed and cites Official Rules §6.
- **O-10 — provision the showcase surface and file the application** (new owner
  action): wrangler provisioning, the §9 cookie gate, real-browser
  verification, and the by-hand filing.
- **§7 module disposition** — where `turnstile.mjs`, `share-cache.mjs`,
  `evidence.mjs`, `usage-ledger.mjs` and `cf-provision-check.mjs` live and why.

### Rationale

The Cold Start entry adds three server-side datastores and a bot gate to a
project whose governing doctrine is "100 % client-side, zero runtime
dependencies". Scored against the plan before any of it was written: 0.88/5 on
server-side-state reconciliation (79 % *"prose only, no governance for the new
datastores"*), 1.77/5 on cookie-bar protection (45 % *"named as a risk with no
owner and no gate"*), 3.26/5 on plan integrity, 2.77/5 on contest completeness
(18 % *"serious gaps"*).

Each addition answers one of those findings rather than restating the plan:

- **D-21** names the carve-out rather than leaving it implicit. The alternative
  was to let "zero runtime dependencies" read as a prohibition and quietly break
  it, which is worse than a declared exception.
- **R-CF-09** is the fix for the lowest score, and it is the requirement that
  keeps being true after the contest.
- **V-12** converts a named risk into a **gate with an owner and a
  precondition**: the §9 cookie gate runs before provisioning and decides it,
  and an unmeasured result resolves to "do not provision" — in code, pinned by
  test. That is the direct answer to the 45 % finding, whose wording was that
  naming a risk without a gate is the same as not naming it.
- **R-CF-02** makes the B1 defect structurally impossible.
- **R-CF-07**, with the Bot Fight Mode guidance correction, closes the F-44
  recurrence path — so this entry cannot ship documentation that re-creates a
  known open finding.
- **P0.6** sits in P0 so the P1→P11 dependency graph is untouched: the platform
  work must not reorder the roadmap it sits next to.
- **O-10** gives provisioning and filing one named owner action, instead of
  leaving them as prose in a branch README.

Nothing here moves a ratchet baseline, reorders an existing phase, or relaxes a
gate. The four breadth additions in §6 of the contest plan (Browser Rendering,
Cron Triggers, AI Gateway, Analytics Engine) are deliberately **not** in this
amendment: each is an owner decision with a real trade against D-04, and none of
them is load-bearing for the requirements above.
