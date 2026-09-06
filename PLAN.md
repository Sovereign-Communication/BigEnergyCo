# BigEnergyCo → Free Worldwide Solar & Storage Estimator

**Roadmap.** Updated 2026-08-22. Complete rewrite from paid procurement agency to free donation-supported educational tool.

**Status:** Public site runs on GitHub Pages + Cloudflare Worker (permanent URLs — the old trycloudflare rotation blocker is resolved). P0 hardening complete 2026-08-22: Worker rate limiting + CORS allowlist + payload caps, `/api/lead` removed, Pages deploy allowlist, price-scope reconciliation. Next: deterministic sizing core and 5-year hourly simulation — see [`PHASE2_PLAN.md`](PHASE2_PLAN.md).

**Key references:**

- Liability, tax, privacy: [`LIABILITY.md`](LIABILITY.md)
- How to run it: [`README.md`](README.md)
- Pre-launch audit & checklist: [`LAUNCH_AUDIT.md`](LAUNCH_AUDIT.md)

---

## 0. What this is now — settled decisions

These are decided, not open questions. Don't reopen them.

|                          | Decision                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Entity**               | **None, ever.** This is Lucas Ballek personally, as a sole proprietor. No LLC, no nonprofit, no incorporation.                                               |
| **Price**                | **Free.** Totally, permanently, for everyone. Nothing is for sale.                                                                                           |
| **Money**                | **Optional donations to personal accounts** — PayPal, Venmo `@lucas-ballek`, Cash App `$luball`. Taxable personal income, never described as tax-deductible. |
| **Donations buy**        | **Nothing.** No tier, no feature, no priority, no better answers. Identical service for everyone. This is load-bearing — see LIABILITY.md §2.                |
| **Contact**              | `lucasballek@gmail.com`, published, framed as a favor with no obligation.                                                                                    |
| **Data collected**       | **None.** No accounts, no lead forms, no analytics profile.                                                                                                  |
| **Procurement business** | **Retired.** The $5k advisory fee, sourcing agency, and MPECA/Schedule A/B contracts are gone.                                                               |

The old entity-based analysis in earlier revisions of this file is superseded by `LIABILITY.md`.

---

## 0.5. What's MVP (Ready to Test)

> Historical snapshot (Aug 2026, pre-deterministic-engine). The shipped
> system is described in `README.md` and `docs/DEPLOY_RUNBOOK.md`; model
> names and integration notes below are stale by design.

**Feature-complete and tested:**

- ✅ Cost comparison calculator (interactive slider, component breakdown)
- ✅ AI advisor (Groq Llama-3.3-70b, refuses to sell/source, shows assumptions)
- ✅ Intake form (bill/kWh/region, inverter Yes/No with optional details)
- ✅ Rate limiting (8/min per IP, 150/day, 3000/day global)
- ✅ CORS security (locked to localhost)
- ✅ Input validation (message/history capped, server-side checks)
- ✅ Two versions (internet with AI, Freenet offline static)
- ✅ Disclaimers (attached to every AI reply, Terms of Use, privacy)
- ✅ Donations (personal accounts, no feature unlock, not tax-deductible)
- ✅ Operations (START.bat/STOP.bat/LINK.bat, launcher.py orchestration)

**Regression-tested (2026-08-03):** Groq quality verified. No hallucinations. All guardrails firing. Rate limiter working exactly at threshold.

**NOT MVP (future):**

- ❌ Deterministic calculator core (still LLM-based, works but not failsafe)
- ❌ NASA POWER API (solar irradiance data integration)
- ❌ Appliance builder (load via itemized appliances)
- ❌ Internationalization (multilingual UI, units, grid standards)
- ❌ Shareable results (URL with stored calculation)
- ❌ Domain + named tunnel (URL rotation workaround is LINK.bat)

**What this means for launch:**

- **Closed beta (week 1):** Test with ~10 real users. Use rotating URL (they understand it's temp). Get feedback on AI accuracy, UX, donation flow.
- **Public launch (week 2+):** Get domain + named tunnel first. Then open to all. Calculator is usable but not bulletproof yet (LLM can still hallucinate). That's OK; disclaimers cover it. Deterministic core is roadmap item, not blocker.

---

## 0.6. Comprehensive Pre-Launch Audit

**See [`LAUNCH_AUDIT.md`](LAUNCH_AUDIT.md)** (11 sections, ~800 lines) for exhaustive coverage of:

- Infrastructure reliability (tunnel uptime, proxy health, Groq quota)
- API robustness (rate limiting, error handling, input validation)
- Security & abuse resistance (CORS, API key handling, rate-limit bypass detection)
- Liability & legal (entity, donations, AI disclaimers, email, data privacy)
- Monitoring & alerting (what's missing, how to set up minimal monitoring)
- Operations procedures (start/stop/restart, troubleshooting, Freenet republish)
- Feature scope vs launch readiness (MVP vs future roadmap)
- Known risks & mitigations (tunnel crashes, quota exhaustion, URL rotation, unl icensed engineering)
- Launch readiness checklist (pre-beta, pre-public, ongoing)
- Success criteria for closed beta and public launch

**Updated 2026-08-03** after discovering and recovering from tunnel crash, regression-testing Groq, verifying rate limiter, and branching versions.

**TL;DR:** MVP is feature-complete and tested. Only blocker for public traffic: domain + named tunnel (stops URL rotation). Safe to start closed beta this week with rotating URL.

## 1. Done

### Positioning & Liability

**Retired the procurement funnel end to end:** the $5,000 advisory fee, "0% hardware markup" framing, MPECA/Schedule A/B contracts, and "Zero-Liability Procurement Architecture" section. Hero, nav, footer rewritten as a free personal tool. All procurement language removed from AI system prompt and UI.

**Liability claims deleted:** Removed express warranties ("6,000+ Cycles / 80% DoD **Guarantee**"), bare cost claims ("88.3% Cheaper"), and overconfident figures. Cost comparison now explicitly notes it's component cost only, excludes freight/duty/labor, and is marked "indicative, Aug 2026." Cycle life is "manufacturer-rated."

**Lead capture eliminated:** Name/email/phone/location collection deleted. Form, `/api/lead` endpoint, and all client code removed. Six stored test entries archived to `.backup/`. This was the single largest liability exposure.

**Disclaimers visible at point of use:** Every AI reply carries a non-reliance notice below the message. Modal header states plainly "you're talking to an AI — educational estimates only." Real Terms of Use (9 sections) replaced procurement contracts. Privacy notice added.

### AI Quality & Guardrails

**Stopped inventing numbers:** System prompt rewritten to forbid fabricated figures. Tested extensively (2026-08-03):

- ✅ Refuses to sell/source (returns "I'm not a sourcing agent")
- ✅ Refuses to invent prices (returns "I don't have real-time access...")
- ✅ Shows assumptions inline (tariff ranges, derates, autonomy calculations)
- ✅ Asks clarifying questions instead of guessing
- ✅ Math verified correct (30 kWh/day × 3 days ÷ 80% DoD calculation accurate)
- ✅ Multi-turn context tracking works (history sent server-side)
- Response time: 0.8–2.6s (Groq typical). Zero hallucinations in test suite.

**Inverter intake redesigned:** Four hardcoded brands → Yes/No radio + optional text box. `inverterDetailIsUseful()` detects concrete signals (make/model, power specs, phase/topology). When vague, request includes instruction to ask follow-ups instead of inventing an inverter.

**Calculate button fixed:** Was a no-op. Now assembles structured intake brief from form fields; user-typed questions take precedence.

### Infrastructure & Operations

**Rate limiting verified working (2026-08-03):**

- ✅ 8/min per IP: requests 1–8 succeed, #9 returns 429
- ✅ 150/day per IP + 3000/day global counters in-memory
- ✅ Retry-After header returned on 429
- JSONP bridge removed (was bypassing limiter)

**CORS hardened:** Changed from `*` to origin-check (localhost/127.0.0.1 only). Freenet CSP header rewrite still works.

**Input validation server-side:** Message capped at 4000 chars, history at 6 turns, both re-validated on server.

**Operationally transferred:** AntiGravity's two supervised processes torn down (one had duplicate port binds). Replaced with `START.bat` / `STOP.bat` / `LINK.bat` driving `launcher.py`. Freenet publishing opt-in via `--publish` (can't be reliably retracted).

### Two-Version Strategy (NEW)

**Internet version (`index.html`):**

- Full AI advisor (Groq Llama-3.3-70b)
- Interactive cost comparison slider
- Component reference
- All 3 donation accounts
- Requires: internet + Groq API

**Freenet version (`index-freenet.html`):**

- Static offline cost comparison (no API calls)
- DIY component reference + prices
- All 3 donation accounts
- Works on Freenet, no internet needed
- Launcher syncs this version to `freenet_web_dist/index.html`

Both versions have identical disclaimer/terms/privacy/donation framing. Users on Freenet get a working calculator even if API is down.

### Donations & Tax

**Framing:** Donations are **gifts to Lucas Ballek personally** (not tax-deductible, not tied to features). Links verified live:

- PayPal: `paypal.me/LBallek`
- Venmo: `@lucas-ballek`
- Cash App: `$luball`

**Tax treatment:** Donations are taxable personal income. Keep records; report on tax return. Not a liability issue if framed honestly (which they are).

---

## 2. Blockers & High-Priority Infrastructure

### BLOCKER: URL Rotation (CRITICAL for public traffic)

**Current state:** Free Cloudflare quick tunnels get a new random hostname on every restart.

- Every shared link dies when launcher restarts
- Cannot drive sustainable public traffic
- Users cannot bookmark the URL
- **Impact:** Makes public launch impossible; closed beta OK (testers understand LINK.bat)

**Fix:** Domain + named Cloudflare tunnel (keeps one hostname forever).

- **Cost:** ~$12/year for domain (any registrar) + free named tunnel (Cloudflare)
- **Effort:** 1–2 hours setup
- **Blocker status:** **MUST DO before public launch.** Safe to skip for closed beta.
- **Also fixes:** Freenet `CF_API_URL` no longer goes stale on each restart

**Workaround (closed beta only):** Run `LINK.bat` to get current URL from `tunnel_url.txt`. Print prominently in launcher output.

### High Priority (do before sustained public use)

- **Groq spend/quota alert:** Query Groq API daily, alert at 80% of daily budget. You'll find out before quota dies instead of after.
- **Move API key to env var:** Remove `groq.env` fallback. Require `GROQ_API_KEY` set before launch. (Security)
- **Tunnel monitoring:** Check if tunnel PID is still alive; auto-restart on crash. (Reliability)

### Optional (not blocking launch)

- **Run on non-desktop:** Until then, honest framing ("this runs on one person's machine, it's not up 24/7") is fine and is already on the site.
- **Backup / DR:** Document Groq account recovery, tunnel account recovery. (Robustness)

---

## 3. The Estimator: Current vs. Deterministic (Roadmap)

### Current State (MVP — works, tested, shipped)

**Groq AI does the sizing:** Takes load basis (bill/kWh) and inverter details, returns kWh battery recommendation + explanation.

- ✅ Works today. Tested end-to-end (0.8–2.6s response time).
- ✅ Shows assumptions (tariff ranges, derates, autonomy calc).
- ✅ Refuses to invent numbers (returns "I don't have access to real-time prices").
- ⚠️ Still vulnerable to LLM hallucination on edge cases (mitigated by disclaimers).

**Freenet offline version:** Static cost comparison (no AI). Works without internet.

### The Rule That Matters Most (Roadmap)

**The LLM must never produce a number.** This is the long-term architecture: compute everything in deterministic, testable code; hand the result to the model; let it explain and translate. The Hawaii error ($0.13/kWh vs actual $0.42) is exactly what happens when LLM generates numbers from scratch. Prompting reduced it; only real code eliminates it.

**Benefits of deterministic core:**

- Zero API cost for core calculation (only explanations use LLM)
- Works offline, under rate limiting, inside Freenet
- Fully testable (unit tests verify every derate)
- No hallucination on key outputs (kWh, panel count, fuse rating)
- Accessible (no API dependency for calculation)

### Calculator core (pure functions, unit-tested)

- **Location** → lat/long via map picker or city search.
- **Solar resource** → **NASA POWER API** (free, global, no key) as primary; **PVGIS** as
  cross-check. Cache by rounded lat/long — irradiance doesn't change hour to hour.
- **Load input, three ways:** monthly bill + tariff, daily kWh, or an appliance builder
  (watts × hours × count). The appliance builder is what makes this usable where metered billing
  isn't the norm.
- **Sizing with every derate visible:** peak sun hours by month (size for the worst month, not the
  average), panel temperature derate, soiling, wiring and inverter efficiency, battery round-trip
  efficiency, depth of discharge, days of autonomy, low-temperature capacity loss.
- **Outputs:** PV array kW and panel count; battery kWh and series/parallel configuration; inverter
  continuous and surge kW; charge controller amps; fuse and breaker ratings; cable gauge with
  temperature and distance derate; seasonal coverage chart; payback range.
- **Chemistry:** LFP, NMC, sodium-ion, **and lead-acid** — still what most of the world can actually
  buy, and omitting it makes "worldwide" untrue.
- **Show the arithmetic.** An expandable "how this was calculated" panel with every assumption and
  its source. Best trust feature and best liability defense in one: you published the method, the
  user chose the inputs.

### Worldwide, meaningfully

- Metric and imperial; user-selected currency; user-entered local tariff (no free global tariff
  dataset is reliable enough to hardcode).
- Grid standards by country — 230 V/50 Hz vs 120 V/60 Hz, single vs split vs three phase. These
  change the inverter recommendation completely.
- Multilingual: the model already answers in the user's language at no extra cost. Localize the
  static UI strings for the top ~10 languages.
- Regional code _pointers_, never certifications: NEC 706 / NFPA 855 (US), BS 7671 (UK),
  IEC 62109 / EN 50549 (EU), AS/NZS 5139 (AU), CSA C22.1 §64 (CA). Framed as "here's what applies
  where you are — talk to a local professional."
- Mobile-first and low-bandwidth. Much of the audience is on a phone on a slow connection. A
  client-side deterministic core means a result even when the API is unreachable or rate-limited.
- Shareable result links and a printable summary, so users can take it to an installer.

### Guardrails to keep

- Disclaimer travels **with** the result. Already done — don't regress it.
- Ranges, not false precision. "48–62 kWh," not "54.7 kWh."
- Always close with: verify with a licensed electrician or engineer before energizing.
- The model declines rather than guesses outside its competence.

---

## 6. Status & Timeline

### Right Now (2026-08-03)

- ✅ MVP feature-complete and regression-tested
- ✅ Groq quality verified (zero hallucinations in test suite)
- ✅ Rate limiting working at exact threshold
- ✅ Two versions built and synced (internet AI + Freenet offline)
- ✅ Donation accounts verified and linked
- ✅ Documentation complete (README, LIABILITY, LAUNCH_AUDIT, this PLAN)
- 🔴 URL rotation blocker prevents public traffic
- ⚠️ Tunnel crashed once; no monitoring yet

### This Week (Closed Beta Phase)

- Run closed beta with ~10 testers (they use LINK.bat to get current URL)
- Add Groq quota alert + move API key to env var
- Gather feedback on AI accuracy, UX, donation flow
- Verify uptime (restart stability)

### Next 1–2 Weeks (Public Launch Prep)

- Get domain + named Cloudflare tunnel (stop URL rotation)
- Get insurance quote + answer from carrier
- Set up tunnel/proxy monitoring
- Deploy with new stable URL

### Month 1+ (Product Development)

- Deterministic calculator core (eliminate LLM hallucination)
- NASA POWER API (location-aware solar resource)
- Appliance builder (load input for non-metered regions)
- Monitoring + alerting dashboard

### Months 2–3+ (Scale & Contribution)

- i18n + units + grid standards (true "worldwide")
- Open-source repo (MIT/Apache-2.0)
- Shareable results + export (email/print estimates)

---

## References

- **Liability & Tax:** [`LIABILITY.md`](LIABILITY.md)
- **Operations & Startup:** [`README.md`](README.md)
- **Pre-Launch Checklist:** [`LAUNCH_AUDIT.md`](LAUNCH_AUDIT.md)

---

## 4. Pre-Launch Actions (Not Blocking)

From [`LIABILITY.md`](LIABILITY.md):

1. **Insurance inquiry (10 min):** Email your homeowners/renters carrier asking if "free donation-supported website" falls under "business pursuits" exclusion. Get sole-proprietor tech E&O quote. This is the only thing between a claim and your personal assets.
2. **Payment account security:** Review Venmo/Cash App personal-account terms. Consider Ko-fi or Stripe link as backup (account freeze is more realistic risk than lawsuit).
3. **Open-sourcing (optional):** Publish under MIT/Apache-2.0. Reframes you as code publisher, not advisor. "AS IS, WITHOUT WARRANTY" is the most tested disclaimer in software.
4. **Groq account security:** Document recovery procedure (lost key, frozen account, quota reset). Same for Cloudflare tunnel account.

---

## 5. Suggested Roadmap (Priority Order)

### Phase 1: Closed Beta (This week, ~3–5 days)

| Work                             | Why                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Closed beta with ~10 testers** | Real user feedback. Test with rotating URL (testers use LINK.bat). Verify AI quality, accuracy, donation flow. |
| **Groq spend/quota alert**       | Know before quota dies. 1–2 hours, high value.                                                                 |
| **Move API key to env var**      | Security hardening. 15 min.                                                                                    |

### Phase 2: Public Launch Prep (After beta feedback, ~1–2 weeks)

| Work                                   | Why                                                                |
| -------------------------------------- | ------------------------------------------------------------------ |
| **Domain + named tunnel**              | Fixes URL rotation forever. Prerequisite for public traffic.       |
| **Insurance answer in writing**        | Cheapest real protection. Email homeowners carrier; get E&O quote. |
| **Tunnel monitoring + Freenet health** | Reliability. Know if tunnel/proxy crashes.                         |
| **Groq quota + logging setup**         | Track daily spend, log errors to file for debugging.               |

### Phase 3: Deterministic Calculator (Month 1+, ongoing)

| Work                                      | Why                                                                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Calculator core (client-side, no API)** | Eliminates LLM hallucination for good. Enables offline use, rate-limit resilience, Freenet-only mode. Use pure math. |
| **NASA POWER API integration**            | Makes location-aware solar sizing real. Keyless (no API key needed).                                                 |
| **Appliance-based load builder**          | Makes tool usable outside metered-billing countries. "What appliances do you have?" UI.                              |

### Phase 4: Global & Contribution (Months 2–3+)

| Work                              | Why                                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **i18n + units + grid standards** | Makes "worldwide" actually true. Top ~10 languages, metric/imperial, country-specific voltage/phase. |
| **Open-source repo**              | Liability posture + community contributions. MIT/Apache-2.0.                                         |
| **Shareable results + export**    | Users can email/print estimates to show installers.                                                  |

### Rationale

- **Phase 1 (beta):** MVP is feature-complete. Get real feedback before investing in domain/tunnel.
- **Phase 2 (public):** Fix URL rotation (blocker) and get insurance (protection). Then you can drive traffic.
- **Phase 3 (product):** Move calculations to code. This is the real product. LLM is now just translator/advisor, not calculator.
- **Phase 4 (scale):** Internationalization and polish. Open-source for trust + contributions.
