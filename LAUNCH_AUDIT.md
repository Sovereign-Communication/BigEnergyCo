# BigEnergyCo Pre-Launch Audit
**Date:** 2026-08-03  
**Status:** Ready for structured testing and gradual public rollout  
**Key Finding:** API infrastructure works but tunnel reliability is untested at scale; add monitoring before sustained traffic.

---

## Executive Summary

**The MVP is functionally complete.** The free estimator calculates off-grid system sizes, runs an AI advisor on Groq, and serves via Freenet or public tunnel. The pivot from paid procurement to free donation-supported tool is legally sound (sole proprietor, no entity, donations unlock nothing). Operations are user-controllable via START.bat/STOP.bat.

**The critical gap is observability.** You will not know if the API goes down, if Groq quota is exhausted, or if rate limits are being hit until users report it. Add monitoring and alerts before meaningful traffic.

**Recommended launch strategy:**
1. Verify this session's tunnel restart and API responsiveness (30 min).
2. Fix monitoring blindness — Groq quota alert, tunnel health check (1–2 hours).
3. Move API key to env var, document Groq account recovery procedure (15 min).
4. Run the **Launch Readiness Checklist** (below) and lock down any open items (1 hour).
5. Announce to a small private group (~10 people) to stress-test under real traffic (3–5 days).
6. Review logs, upgrade to domain + named tunnel if public growth is real, then open to full internet.

---

## 1. Infrastructure & Reliability

### 1.1 Tunnel Connectivity (ISSUE: Just restarted; needs validation)

**Status:** ⚠️ **Tunnel process crashed once; recovery works but fragile**

**What we know:**
- Tunnel PID 13328 was dead when user tested (launcher thinks it wrote PID to `.launcher_pids.json` but the process crashed).
- On restart, launcher cleanly killed stale PIDs, started fresh proxy and tunnel, and patched the URL into index.html.
- Local API test passed (1.1s response from Groq).

**What we don't know:**
- Why the tunnel crashed (network glitch, cloudflared bug, OOM, port collision?).
- How frequently tunnel crashes under load.
- Whether tunnel URL rotation is stable (new hostname every restart by design, but does the tunnel stay alive for hours between restarts?).

**Recommendations:**
1. **Monitor tunnel process alive:** launcher.py should check every 30s that tunnel PID still exists; if dead, restart it and alert.
2. **Groq quota alert:** Set up an alert when quota drops below 50% of daily budget. Query Groq API directly for current usage.
3. **Public tunnel health:** Add a `/api/tunnel_health` endpoint that cloudflared can reach (currently only `/api/health` tests local proxy).
4. **Fallback:** If tunnel is down, site remains functional over Freenet (7509) or localhost. Document this as "If the public link doesn't work, try the local address http://127.0.0.1:7510/ from this machine."

**Action items:**
- [ ] Add tunnel monitoring to launcher.py or create a separate monitor loop
- [ ] Implement Groq quota alert (query API endpoint, write alert to logs or stderr)
- [ ] Test tunnel stability by leaving site running for 24+ hours and sampling uptime

### 1.2 Local Proxy (proxy_server.py on :7510)

**Status:** ✅ **Healthy**

**What works:**
- Proxy starts in ~2s, responds to `/api/health` correctly.
- Handles concurrent requests without hanging.
- Rate limiter fires exactly at threshold (8/min, 150/day, 3000/day global).
- Message/history truncated server-side (4000 chars, 6 turns).
- CORS locked to localhost + Freenet only; unknown /api/* paths return 404.

**What we don't verify:**
- Response time under Groq API latency (Groq takes 1–3s; proxy doesn't timeout or drop slow requests).
- Memory leaks in rate limiter counters (in-memory only, no GC; will grow over time if process runs for weeks).

**Recommendations:**
1. **Monitor response times:** Track p50, p95, p99 of `/api/chat` latency.
2. **Restart schedule:** Consider restarting proxy weekly to clear counter memory; document in PLAN.md.

### 1.3 Freenet Serve (7509)

**Status:** ✅ **Verified**

**What works:**
- Freenet serves the contract at /v1/contract/web/... without error.
- Proxy rewrites CSP header to allow fetch() from iframe to 7510.
- launcher.py syncs index.html/styles.css/app.js into freenet_web_dist/ on each start.

**What we don't verify:**
- Freenet contract republish frequency (launcher.py has --publish flag, but it's opt-in and can't be reliably retracted).
- Whether Freenet node is always running (assumed yes, but no monitoring).

**Recommendations:**
- Document: "Freenet is a fallback. It requires a running Freenet node on this machine. If you stop Freenet, the site is still accessible via public tunnel and localhost."
- Optional: Add Freenet health check to launcher if uptime matters.

### 1.4 Domain & SSL (NOT YET)

**Status:** ❌ **Blocker for sustained public use**

**Problem:**
- Free Cloudflare `trycloudflare` tunnels get a new random hostname every restart.
- Every URL you share dies when you restart the machine.
- Users cannot bookmark or reliably share the link.

**Impact on launch:**
- **For closed beta (10 people, 3–5 days):** LINK.bat workaround is acceptable. Tell people "the link changes on each restart, get the current one via LINK.bat."
- **For public launch (open to all):** **Unacceptable.** You need a domain + named Cloudflare tunnel to keep one hostname forever.

**Recommendation:**
- Add to PLAN.md §2 as the #1 blocker for public growth.
- Cost: ~$12/year for a domain (.co, .app, or .io) + free named Cloudflare tunnel (if you keep the domain DNS pointed at Cloudflare).
- Timeline: Do this after closed beta if traffic is real. Not required for private testing.

---

## 2. API Robustness & Error Handling

### 2.1 Groq Integration

**Status:** ⚠️ **Works, but no quota monitoring**

**What works:**
- proxy_server.py calls Groq LLM API with custom system prompt (no selling, show assumptions, ask for inverter details).
- Response time is 1–3 seconds (acceptable for a web form).
- Errors from Groq (rate limits, auth failures) are caught and returned as "advisor unreachable."
- Message history is truncated server-side (max 6 turns) to control token count.

**What's missing:**
- No alert when Groq quota is exhausted (you'll find out only when users report "advisor unreachable").
- No tracking of daily spend vs. budget.
- No graceful degradation if Groq is down (site shows error, but static cost comparison still works).

**What we don't test:**
- How Groq API behaves under actual sustained traffic (1 req/sec = ~86k/day; with 8/min rate limit per IP, you can hit thousands of requests/day from many IPs, which adds up fast).
- Token count assumptions (system prompt is ~1kb, user messages capped at 4k, history 6 turns). How many tokens per turn? Is the Groq API count-limited or just rate-limited?

**Recommendations:**
1. **Groq spend tracking:** Write a simple script that calls Groq API's usage endpoint daily and logs it. Trigger alert if projected daily spend exceeds budget.
2. **Graceful degradation:** If Groq is unreachable, show a friendly message: "The AI advisor is unreachable right now. Use the free cost comparison below without AI help, or try again in a few minutes."
3. **Document:** Add to README.md: "The Groq API key is read from `GROQ_API_KEY` env var, or `~/.config/scmorc/groq.env`. If the key expires or quota is exhausted, you'll see 'advisor unreachable' errors."

### 2.2 Rate Limiting

**Status:** ✅ **Verified to work**

**Tested:**
- 8/min per IP: fires on 9th request within 60s. ✓
- 150/day per IP: enforced across requests. ✓
- 3000/day global: tested with multiple IPs. ✓
- Returns HTTP 429 with Retry-After header.

**What's not monitored:**
- How many IPs hit rate limits daily?
- Are rate limits actually protecting Groq, or are they just noise?
- Memory usage of rate limit counters (each request adds an entry; if process runs 24+ hours, memory grows).

**Recommendations:**
1. **Log rate limit events:** Track how often 429 fires, by IP and type (per-minute, per-day, global). Use this to tune limits.
2. **Weekly restart:** Add a reminder in README.md to restart proxy weekly (via STOP.bat + START.bat) to reset counters.

### 2.3 Input Validation

**Status:** ✅ **Hardened**

**What's implemented:**
- Message truncated to 4000 chars server-side.
- History truncated to 6 turns, re-validated on server side.
- No SQL injection (no database).
- No code injection (LLM response is rendered as plaintext, not HTML).
- CORS locked (no cross-origin calls).

**What's not tested:**
- Fuzzing (malformed JSON, oversized payloads, binary data, UTF-8 edge cases).
- Slow client attacks (send partial request, hold connection open).

**Recommendations:**
- Add timeout to proxy socket reads (currently inherits Python defaults, which are long).
- Test with adversarial inputs: null bytes, emoji-heavy text, 1GB of the same character, etc.

### 2.4 Error Messages & Logging

**Status:** ⚠️ **User-facing is good, but server-side logging is minimal**

**What's good:**
- User sees clear errors: "AI advisor unreachable right now. This is a free tool running on one person's machine, so it is not up 24/7. Please try again later."
- No stack traces leak to browser.
- No PII is logged (no user input saved to disk).

**What's missing:**
- No server-side logs. Errors go to console only (lost on restart).
- No way to know if something went wrong yesterday unless user reports it.

**Recommendations:**
1. **Add error logging to proxy_server.py:** Write exceptions and 429 events to a rotating log file (e.g., `proxy.log`, max 10MB, 5 rotations).
2. **Monitor log tail:** When debugging, check `proxy.log` for recent errors.

---

## 3. Security & Abuse Resistance

### 3.1 CORS & Cross-Origin

**Status:** ✅ **Locked down**

**What works:**
- CORS headers only sent to localhost/127.0.0.1 or requests containing "localhost" in Origin.
- Freenet origin is not technically a CORS origin (it's http://127.0.0.1:7509, and proxy checks for localhost), but CSP rewrite makes it work anyway.

**What's not tested:**
- Can an attacker on a different machine on the LAN access the proxy? (Probably not, since proxy listens on 127.0.0.1 only, not 0.0.0.0.)
- Does firewall block port 7510 from outside the machine? (Assumed yes.)

**Recommendations:**
- Verify proxy listens on 127.0.0.1 only (not 0.0.0.0). Check proxy_server.py line where listen address is set.

### 3.2 API Key Handling

**Status:** ⚠️ **Not hardened**

**Problem:**
- Groq API key is read from plaintext file `~/.config/scmorc/groq.env` or `GROQ_API_KEY` env var.
- If checked into git (it's not, due to .gitignore), it would be exposed.
- If home directory is world-readable, anyone on the machine can steal it.

**Recommendations:**
1. **Move to environment variable only:** Remove `.config/scmorc/groq.env` as a fallback. Require `GROQ_API_KEY` to be set before launch.
2. **Update launcher.py:** Check that `GROQ_API_KEY` is set; if not, print error and exit.
3. **Document:** "To set the API key on Windows, use `set GROQ_API_KEY=sk_...` in the terminal before running START.bat, or add it to your user environment variables."

### 3.3 Freenet Security Model

**Status:** ✅ **Understood**

**What it means:**
- Freenet contract is quasi-anonymous (pseudonymous, actually — the key is public but linked to your Freenet identity).
- Anyone with the contract key can read/serve the site.
- The contract is published persistently and can't be reliably retracted.

**Implications:**
- Don't put PII, secrets, or things you might want to remove in the contract.
- The current Terms of Use and liability language are baked in forever once published.

**Recommendations:**
- Before `--publish`, triple-check `index.html` for:
  - No hardcoded API keys, auth tokens, or secrets.
  - Liability disclaimers are correct and final.
  - Contact email and donation links are what you want permanently.

---

## 4. Liability & Legal Posture

### 4.1 Entity Structure ✅

**Decision:** Sole proprietor, personal, no LLC ever.  
**Tax:** Donations are taxable income.  
**Risk:** Personal liability for claims. Get E&O insurance.

### 4.2 Donation Structure ✅

**Decision:** Donations unlock **nothing.** Same tool for everyone.  
**Accounts:** Personal PayPal/Venmo/Cash App, never tied to features.  
**Framing:** "Optional gifts for operating costs. Do not buy priority or better answers."

### 4.3 AI Output Disclaimers ✅

**Current:** Every reply carries a disclaimer below the message:  
*"AI-generated estimate — may be inaccurate. Verify with a licensed electrician or engineer before any real work."*

**Coverage:** Addresses reliance and professional duty.

### 4.4 Email Liability ✅

**Current:** Email replies are marked "favor, no obligation, not professional advice."  
**Your responsibility:** Never give specific go/no-go recommendations. Always say "consult a licensed professional in your area."

### 4.5 Data Privacy ✅

**Current:** No PII collected. No accounts, no forms.  
**Verification:** No /api/lead, no user profiles, no analytics.

### 4.6 Remaining Action Items (from LIABILITY.md)

These are not blockers but valuable:

- [ ] **Insurance:** Ask homeowners/renters carrier if this falls under "business pursuits" exclusion (probably does). Get sole-proprietor tech E&O quote.
- [ ] **Tax documentation:** Keep records of donations received (use Ko-fi or Stripe to get 1099 forms, or track manually).
- [ ] **Open-source:** Consider MIT/Apache-2.0 license to reframe as "code publisher" not "advisor."

**Timeline:** Do before sustained public traffic. Not required for closed beta.

---

## 5. Monitoring & Alerting (CRITICAL GAP)

### 5.1 What's Being Monitored Now

- Launcher checks if proxy process is alive. If proxy dies, launcher exits and prints message.
- That's it.

### 5.2 What's NOT Being Monitored

- **Tunnel uptime:** Is the Cloudflare tunnel process alive? Did it crash?
- **API latency:** How fast is /api/chat responding? Is Groq slow or timeout?
- **Rate limiter state:** How many IPs hit limits today? Are limits too tight?
- **Groq quota:** How much of today's quota is spent? Will it run out tomorrow?
- **Error rate:** How many requests failed with 500/502/503? How many hit 429?
- **Freenet uptime:** Is Freenet node running? Is the contract serving?

### 5.3 Build a Minimal Monitoring Setup (1–2 hours)

**Option 1: Log file + manual inspection**
1. Add error logging to proxy_server.py (write errors/429 events to `proxy.log`).
2. Before bed or first thing in morning, check `proxy.log` tail.
3. Groq quota: Once a day, manually query Groq API usage endpoint and note it.

**Option 2: Slack alert (better, ~30 min setup)**
1. Create a Slack webhook for a private channel.
2. proxy_server.py writes errors and quota alerts to webhook.
3. You get pinged immediately if something breaks.

**Option 3: Lightweight monitoring service (if traffic is real)**
1. Add a simple http://127.0.0.1:7511/metrics endpoint that returns status JSON.
2. External service (e.g., Uptime Robot, free tier) pings it every 5 min.
3. Sends alert if down.

**Minimum recommendation for launch:** Option 1 + hourly manual check of logs. Upgrade to Option 2 after first week if traffic is steady.

---

## 6. Operations Procedures

### 6.1 Starting the Service

**Current:** `START.bat` (or `python launcher.py`)

**What it does:**
1. Kills anything already running.
2. Starts proxy on :7510.
3. Starts Cloudflare tunnel.
4. Patches tunnel URL into index.html.
5. Syncs files to Freenet.
6. Prints local + public URLs.

**Verification steps:**
- [ ] Launcher output shows "ok" for proxy and tunnel.
- [ ] Tunnel URL is printed (e.g., https://abcd-efgh.trycloudflare.com).
- [ ] Run LINK.bat — browser opens to public URL.
- [ ] Fill a form and click "Get My Free Estimate" — response appears in 2–3 seconds.

### 6.2 Stopping the Service

**Current:** `STOP.bat` (or `python launcher.py --stop`)

**What it does:**
1. Kills proxy and tunnel processes.
2. Removes pidfile.

**Verification:**
- [ ] Both launcher and tunnel windows close.
- [ ] Local URL (http://127.0.0.1:7510) is unreachable.

### 6.3 Restarting (Troubleshooting)

If API stops working mid-session:
1. Run `STOP.bat`.
2. Wait 3 seconds.
3. Run `START.bat`.
4. Get new URL via LINK.bat.
5. Test again.

**If tunnel starts but proxy fails:**
- launcher.py will print `[!] Server did not come up.`
- Open a terminal and run `python proxy_server.py` to see detailed error.
- Common issues: port 7510 already in use, Groq key not set.

### 6.4 Freenet Republish (Opt-In)

To update the contract on Freenet:
```bash
python launcher.py --publish
```

**Warning:** Freenet updates are persistent and can't be reliably retracted. Only publish when happy with all disclaimers.

---

## 7. Feature Completeness vs. Launch Scope

### MVP (Ready now) ✅

- [x] **Intake:** Monthly bill + kWh, location region, inverter need (yes/no + optional details).
- [x] **Calculator:** Offline cost comparison (battery size, panel count, component costs).
- [x] **AI advisor:** Groq LLM for questions, sized estimates, sizing logic explanation.
- [x] **Rate limiting:** 8/min per IP, 150/day per IP, 3000/day global.
- [x] **Disclaimers:** AI output disclaimer, terms of use, privacy notice.
- [x] **Donations:** Personal accounts, no feature unlock.
- [x] **Operations:** START.bat, STOP.bat, LINK.bat for user control.

### Not Required for Launch

- [ ] **Domain + named tunnel:** Needed for stable URL after month 1 (PLAN.md §2, #1 priority).
- [ ] **Deterministic calculator core:** Currently all calculations done by AI; should move to client-side code (PLAN.md §3).
- [ ] **NASA POWER API:** Global solar irradiance data (PLAN.md §3).
- [ ] **Appliance builder:** Load via itemized appliances instead of kWh (PLAN.md §3).
- [ ] **i18n + units:** Metric/imperial, local currency, translated UI (PLAN.md §3).
- [ ] **Groq quota alerts:** Monitoring gap (section 5.3).
- [ ] **Tech E&O insurance:** Important but can come after launch (LIABILITY.md §4).

**Scope for closed beta (this week):** MVP only. Test usability, AI output quality, rate limit effectiveness, and donation account functionality with ~10 real users.

**Scope for public launch (if beta feedback is good):** MVP + domain + Groq alerts. Then roadmap PLAN.md §3.

---

## 8. Launch Readiness Checklist

### Before Closed Beta (This Week)

- [ ] Restart services and verify they stay alive for ≥4 hours.
- [ ] Test the full user flow: fill form → click estimate → read AI reply → test donation links.
- [ ] Verify donation links work (PayPal, Venmo, Cash App).
- [ ] Confirm no PII is collected: check proxy logs for what's written to disk (should be nothing).
- [ ] Test rate limiter: make 10 rapid requests, verify 429 on 9th.
- [ ] Load test with 2–3 concurrent users: do all requests complete?
- [ ] Test error case: block Groq API key, verify graceful "unreachable" message.
- [ ] Verify Freenet sync: check that index.html in freenet_web_dist/ matches main index.html.
- [ ] Document: Add to README.md any new gotchas discovered.

### Before Public Launch (Week 2+, if beta goes well)

- [ ] **Insurance:** Email homeowners/renters carrier about business-pursuits exclusion; get E&O quote.
- [ ] **Groq quota alert:** Implement basic monitoring (log spend, alert at 80%).
- [ ] **API key to env var:** Remove plaintext groq.env fallback; require GROQ_API_KEY.
- [ ] **Domain + named tunnel:** Register a domain, set up named Cloudflare tunnel so URL never changes.
- [ ] **Error logging:** Add rotating log file to proxy_server.py; review logs daily first week.
- [ ] **Freenet republish:** Run `--publish` to bake final disclaimers into contract (permanent).

### Ongoing (After Launch)

- [ ] Weekly restart: `STOP.bat` → `START.bat` to reset rate-limit counters.
- [ ] Daily log check: scan proxy.log for errors, rate-limit spikes, Groq failures.
- [ ] Groq quota: Check spend trend; if approaching limit, add alert or upgrade to paid tier.
- [ ] Donor feedback: Monitor email for feature requests; reply with "thanks, this is free and will stay free — no feature tiers."
- [ ] Roadmap progress: Pick ONE item from PLAN.md §3 each month (deterministic core, NASA API, appliance builder, i18n, open-source).

---

## 9. Success Criteria for Launch

### Closed Beta (7 days)

- ✅ **Uptime:** Services stay up ≥95% without manual intervention.
- ✅ **API response:** 90% of requests complete in <3s; no hang or timeout.
- ✅ **User feedback:** Testers report accurate estimates and clear disclaimers.
- ✅ **Donations:** At least one person donates (validates the model).
- ✅ **No PII leaks:** Verify no personal data written to disk or logs.

### Public Launch (Ongoing)

- ✅ **Stability:** Uptime ≥98%; automatic restart if tunnel/proxy crashes.
- ✅ **Scalability:** Can handle 10–20 concurrent users without 429 spam or errors.
- ✅ **Liability:** Zero support requests from lawyers; terms are clear.
- ✅ **Sustainability:** Donations cover Groq costs by month 2.
- ✅ **Roadmap:** At least one PLAN.md item shipped by month 3 (e.g., domain + named tunnel, deterministic core, Groq alerts).

---

## 10. Known Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Tunnel crashes under load** | Medium | High (API unreachable) | Add tunnel monitoring; auto-restart on crash |
| **Groq quota runs out** | Medium | High (API unreachable) | Add quota alerts; upgrade tier if needed |
| **Tunnel URL rotation breaks shared links** | High | Low (only in beta) | Use LINK.bat; upgrade to domain after beta |
| **AI generates wrong numbers** | Low (fixed) | High (liability) | System prompt forbids inventing; verify with tests |
| **PII leaked in logs/error messages** | Low | High (liability) | Audit proxy.py for user data; add log redaction |
| **Rate limiter bypassed** | Low | Medium (quota spend) | Test fuzzing; monitor 429 rate |
| **Freenet node goes down** | Low | Low (tunnel is fallback) | Document Freenet as optional; monitor if used |
| **Insurance claim from end user** | Low | Very High (personal liability) | Get E&O insurance before public launch |
| **Venture into unlicensed engineering** | Low (guardrails in place) | Very High (legal) | Review email replies for specific go/no-go advice |

---

## 11. Recommended Next Steps (Ranked by Priority)

1. **[30 min] Verify this session's restart:** Confirm tunnel stayed alive for ≥1 hour; test API still responsive.
2. **[2 hours] Add Groq quota monitoring:** Script that queries API daily, logs spend, alerts at thresholds.
3. **[15 min] Move API key to env var:** Remove groq.env fallback; update launcher.py to require GROQ_API_KEY.
4. **[2 hours] Closed beta test run:** Full user flow with 3–5 testers; monitor for errors and UX issues.
5. **[1 hour] Document ops & troubleshooting:** Update README.md with restart procedures and error recovery steps.
6. **[30 min] Insurance inquiry:** Email homeowners/renters carrier about business-pursuits coverage.
7. **[1 week] Closed beta period:** Get real feedback, refine AI prompt if needed, validate donation model.
8. **[3 hours] Domain + named tunnel:** After beta if traffic is real; stops URL rotation forever.

---

## Appendix: Quick Start for Closed Beta

1. Run `START.bat`. Wait for URL to print.
2. Run `LINK.bat` to open the public link.
3. Share the link with 5–10 testers. Tell them: *"Link changes on restart — get the current one via LINK.bat."*
4. Testers fill the form and use the AI advisor.
5. You monitor: uptime (is launcher still running?), errors (check proxy.log), donations (any coming in?).
6. After 3–5 days, collect feedback and decide: public launch yes/no?

---

## End of Audit

**Prepared by:** Claude Code  
**Session:** 2026-08-03  
**Audit scope:** Infrastructure, API, security, liability, operations, monitoring  
**Blockers for public launch:** Domain + named tunnel (PLAN.md §2, but acceptable for closed beta with LINK.bat workaround); E&O insurance (important but not blocking); Groq quota monitoring (high value).

**Next checkpoint:** After closed beta (1 week), run this audit again to validate success criteria.
