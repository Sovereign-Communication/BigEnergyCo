# Cold Start — Exact Submission Field Spec

> AUTHORITATIVE. Read top to bottom, copy each answer verbatim into the Google Form.
> Filed manually by Lucas — automated entry is prohibited.
> Deadline: October 2, 2026 at 11:59 PM PDT.
> Form: https://docs.google.com/forms/d/e/1FAIpQLScuHP2eHguH7EAQaCDpO402MHL5Sk7x_mCn7BqU0EG9WcUI-A/viewform

## Critical distinction — read first (corrected 19:46 HST Oct 2)

- **Company website** = https://freeoffgridcalculator.com (the real live company/product site)
- **Demo / product URL** = https://bigenergyco-showcase.pages.dev (the Cloudflare showcase)
- Do NOT swap these. Do NOT put the showcase URL as the company website.

API state at spec time (19:38 HST Oct 2, independently verified): `/api/health`
returns HTTP 200 with all four showcase flags true (turnstile, kv, r2, d1).
Claim the full showcase as live.

## 1. Company name

BigEnergyCo

## 2. Company website

https://freeoffgridcalculator.com

## 3. One-line pitch

We give away professional-grade solar design to build the highest-intent lead flow in residential energy, then route those homeowners to verified electricians who pay for the work.

## 4. What are you building, and why?

A free, professional-grade off-grid solar + battery sizing calculator — live at
freeoffgridcalculator.com. Real physics, not a marketing quiz: hourly simulation,
NASA POWER weather data, degradation and cycle-life modeling. No account, no
paywall, no lead form.

Why: residential installers overpay brutally for customer acquisition, and
homeowners get funnels instead of tools. A homeowner who just sized their own
system is the highest-intent lead in residential energy. We acquire that customer
for free with a tool they'd use anyway, then monetize the routing: verified
electricians pay to receive those homeowners as lined-up clients.

Honest current state: the calculator is live and free today. The verified-pro
marketplace is the business being built on top of it.

## 5. Business model

The free calculator is the acquisition wedge. Revenue comes from electricians
paying to be routed/recommended to homeowners who need installation — a
verified-pro lead-gen marketplace.

## 6. Funding stage

Bootstrapped, $0 raised (under $10M total).

## 7. Revenue stage

$0 revenue to date — pre-revenue.

## 8. How Cloudflare fits into our stack

Cloudflare is why the free model works economically — serving a free global tool
is only viable when marginal cost per user is ~zero, and that's what the edge
gives us.

- **Pages** — live product plus a fully separate showcase Pages project
  (bigenergyco-showcase.pages.dev), so contest work never touches production traffic.
- **Workers** — our API layer: the AI system-design advisor (POST /api/chat),
  share-link and evidence endpoints, health checks. In-isolate rate limiting
  paired with WAF rules; strict payload caps before any paid upstream call.
- **Turnstile** — guards the advisor API. This is a *revenue* story, not infra:
  lead-gen marketplaces die on fake leads, and paying electricians churn on the
  first batch of junk. Bot protection is lead-quality protection, and lead quality
  is the entire business.
- **KV** — edge cache for share-link calculation payloads.
- **R2** — durable storage for quality-evidence artifacts outside the repo.
- **D1** — anonymized usage-event ledger (no PII, ever).
- **Web Analytics** — privacy-friendly traction measurement, no cookies,
  consistent with our no-tracking posture.
- **WAF + Cache Rules** — Bot Fight Mode, API rate limiting, and edge caching
  tuned to our byte-budget performance program.

All of the above is live on the showcase URL (verified 19:38 HST Oct 2).

## 9. Traction

Early — free public tool, traction measured in completed system designs;
analytics beacon shipping with the showcase deployment. No revenue yet.
(Never invent metrics.)

## 10. Market opportunity

US residential solar + storage: every installer overpays for customer acquisition.
We acquire the customer for free with a tool they'd use anyway, then monetize the
routing. The wedge is defensible because the calculator itself is genuinely
good — physics, not a funnel page.

## 11. Team

Lucas Edward Ballek, founder, based in Pahoa, Hawaii — plus an AI-agent
engineering workforce: frontier models for planning, cheaper capable models for
implementation, running parallel lanes with serialized integration.

## 12. Demo / product URL

https://bigenergyco-showcase.pages.dev

## 13. Why we should win

We're the public-good entry: a free tool that makes clean energy accessible, made
economically possible by Cloudflare's developer platform. The $500,000 in
Cloudflare credits doesn't fund a burn rate — it permanently endows the free
tier, so the calculator stays free forever while the marketplace grows on top
of it.

## 14. Contact info

- Name: Lucas Edward Ballek
- Email: lucasballek@gmail.com
- Phone: 808-765-2912

## Filing notes

- File MANUALLY. Automated/robotic entry is prohibited.
- Agree to the Terms and Conditions on the form.
- One submission per entrant — confirm none has been filed yet.
- Prizes are Cloudflare credits, not cash. Taxes are the winner's responsibility.
- Five finalists pitch in person at Moscone West, San Francisco, on October 19,
  2026, 4:00–5:00 PM PDT — physical presence required to win.
