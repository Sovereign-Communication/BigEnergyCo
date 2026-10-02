# Cold Start — application narrative

Everything a human needs to file the entry by hand, and nothing that files it
for them.

**The rules bar automated entry** (Official Rules §4: *"Persons may not enter
using robotic, programmed, or any other automated means of entry."*). So this
document is copy and structure, ready to paste. No script in this repo submits
anything, and `tests/cold-start-preflight.test.mjs` asserts that the pre-flight
contains no `forms.gle` and no `execSync` for exactly that reason.

**Placeholders are marked `[ ... ]` and are not optional to leave as-is.**
`[REPO URL]`, `[DEMO URL]` and every traction figure must be replaced with a
measured value before filing. Per §11 of the contest plan, anything not verified
in a browser is described as *shipping*, never as *shipped*.

---

## 1. The 300-word description (for someone who has never seen it)

> **BigEnergyCo is a free, account-free calculator that sizes an off-grid battery
> and solar system for your actual location, and shows you what it would really
> cost.**
>
> Most people sizing a home battery are guessing. They read a manufacturer's
> capacity number, or an influencer's anecdote, and buy something that does not
> fit. The honest answer depends on where you are, how much you actually use,
> how cold it gets, and what your local electricity costs — and nobody has
> usually done that arithmetic for them.
>
> This does. You enter your monthly bill or your daily kWh and your location.
> The calculator pulls that location's real hourly solar irradiance and
> temperature from NASA POWER data, then computes your array size, your battery
> capacity, your inverter, and your expected payback — deterministically, in your
> browser, with the same inputs giving the same answer every time. It compares
> four honest paths to owning a system: turnkey, buy the hardware yourself and
> pay a tradesperson, build it yourself, or lease. It shows the real cost of the
> battery, and it shows you what your electricity costs if you do nothing.
>
> Every number links to its source and its grade, and an independent model
> checks each result for physical plausibility. If a result is questionable, the
> page says so instead of presenting it as fact.
>
> There is no account, no paywall, no lead form, and no advertising. It is
> free and it stays free. It exists because the people who need this most are
> the ones least able to afford being misled about it.
>
> Try it: `[DEMO URL]`

*(261 words of body copy, excluding the "Try it" line — measured with `wc -w`
on this file, not asserted from memory. Comfortably inside a 300-word field
either way.)*

---

## 2. Application form copy (~300 words)

**One-line description:** A free, account-free calculator that sizes an off-grid
battery and solar system for your real location and shows what it would honestly
cost.

**What it does:** Visitors enter a monthly bill or daily kWh use plus a location.
The calculator fetches that location's hourly solar irradiance and temperature
from NASA POWER, then deterministically computes array size, battery capacity,
inverter sizing, energy yield, and payback for four ownership paths — turnkey,
self-purchase plus a tradesperson, DIY, and lease. It shows the honest
do-nothing baseline: what the electricity costs if you change nothing. Every
figure carries its source, its uncertainty range, and a quality grade, and an
independent model verifies each result for physical plausibility rather than
endorsing it.

**Who it's for:** Homeowners and small installers deciding whether a battery is
worth it, before they spend money and after a sales conversation they do not
trust. It is deliberately free and account-free, with no advertising and no lead
capture.

**Traction:** `[N]` — measured figures only. Do not estimate. If a number is not
measured, leave it out rather than approximating it; see §5.

**Repository:** `[REPO URL]` — required by Official Rules §5. Cloudflare
receives this repository, so it is written to be read.

---

## 3. Cloudflare integration — a stated submission criterion

Official Rules §4 makes this a requirement, not a flourish: submissions must
describe how Cloudflare fits the stack and use the platform to build the
application. Here is that description, in the order the criteria reward.

> The calculator itself is pure client-side JavaScript with zero runtime
> dependencies — that is deliberate, because it is what makes it free to run and
> impossible to break with a bad backend day. Cloudflare is the layer around it,
> and every part earns its place:
>
> - **Workers** run the advisor API and the showcase endpoints. The worker is
>   named `-showcase`, so a deploy can never touch production.
> - **Pages** serves the static site with branch preview URLs, so each change
>   gets its own reviewable link.
> - **D1** stores an anonymised usage ledger — a closed enum of events, validated
>   page paths, and country only from Cloudflare's own `cf-ipcountry` header. No
>   IPs, no user agents, no emails, no coordinates, no free-form fields.
> - **R2** stores quality-evidence artifacts (Lighthouse and axe runs) with an
>   allowlisted kind, an allowlisted content type, and a 5 MB cap.
> - **KV** caches share-link payloads at the edge, re-validated on read, expiring
>   in 7 days.
> - **Turnstile** guards the advisor endpoint so automated sessions cannot burn
>   a paid upstream token.
> - **Rate Limiting** and **WAF** rules enforce the advisor's per-IP budget
>   outside the isolate, so eviction cannot reset it.
> - **Cache Rules** make the byte budgets hold at the edge rather than only in
>   CI: immutable one-year TTL on versioned assets, short TTL on HTML.
> - **Web Analytics** stays cookieless, matching a project that requires zero
>   cookies.
>
> Bot management is configured as verified-bot allowance rather than Bot Fight
> Mode, deliberately: a blanket challenge is exactly what caused this project's
> own open finding F-44, where the production domain returned HTTP 403 to
> verified crawlers.

**Ten surfaces today.** The four additions in §6 of the contest plan (Browser
Rendering, Cron Triggers, AI Gateway, Analytics Engine) are **only** described
in the application once they are deployed and verified. An integration that is
described as shipped and is not is the single fastest way to lose the trust the
other twenty percent of the score depends on.

---

## 4. The 10-minute spoken pitch

Structured against the five judging criteria, each worth 20 %. Ties break on
product quality, so the opening and closing minutes are spent on the product,
not the stack.

### 0:00–1:30 — The problem (feeds criterion 1)

"Australians will spend billions on home batteries over the next decade. Almost
none of them will know whether the one they are being sold actually fits.

The number on the front of a battery is a nameplate capacity measured in ideal
laboratory conditions at twenty-five degrees. Your roof in Wagga is not
laboratory conditions. The honest answer depends on where you are, how much you
actually use, how cold it gets, and what your power costs — and the person
selling the system has a commercial interest in the answer being different.

I could not find a tool that would do that arithmetic honestly, so I built one."

### 1:30–4:00 — The product (criterion 1 — the tie-breaker)

Live demo: enter a bill, pick a location, get a system.

"The calculation is deterministic. Same inputs, same answer, every time, in your
browser. That is not a limitation, it is the point — a tool that sizes your
system should be reproducible and it should work with no server at all.

Three things make it honest rather than merely impressive.

**One.** Every number carries its source, its range, and a grade. When the grade
is low, the page says so instead of rounding it into confidence.

**Two.** An independent model — not us, not the same code path — checks each
result for physical plausibility. It can flag a result as suspicious. It can
never change a number. I want a tool that is able to tell you it does not
believe its own answer.

**Three.** It shows you the four real ways to own a system, including the one
where you do nothing, priced honestly. Most calculators only show you the most
expensive option. This one is not a sales funnel — there is no lead form, no
account, no advertising, and no way for anyone to pay me for this. If it were
commercial, this would be a different product, and I would not trust it either."

### 4:00–5:30 — Why it holds up (criterion 1, continued)

"It is open source and it is gated like an engineering project. There is a
performance budget in CI, so a change that makes it slower fails the build
rather than shipping and being noticed later. There is a test suite that runs on
every change. The source is written for the people who will read it — including
the Cloudflare judges, who will find the reasoning behind the decisions in the
commit history rather than only the outcomes."

### 5:30–7:30 — Cloudflare (criterion 4)

"Cloudflare is what makes it possible to be free.

The calculator is client-side and dependency-free, so the marginal cost of a
visitor is a CDN hit. Cloudflare is the entire business model. Workers run the
advisor. Pages serves the site. D1 keeps an anonymised usage ledger — country
only, from Cloudflare's own header, never from the client. R2 holds the quality
evidence. KV caches share links at the edge. Turnstile and Rate Limiting protect
a paid upstream so a bot cannot cost us money. Cache Rules hold the byte budgets
at the edge. Web Analytics stays cookieless, which matters for a project whose
rule is zero cookies.

One thing I got wrong and fixed: my first bot-mitigation configuration would
have served a challenge to verified search crawlers and 403'd them — which is
this project's own logged finding, F-44. That shipped in my own documentation
before it shipped in code. It is now verified-bot allowance instead, and there
is a test that fails if anyone reintroduces the blanket challenge. The rule I
settled on: the gate that protects the paid API must not be the same gate that
hides the site from search engines."

### 7:30–9:00 — Traction and team (criteria 2 and 3)

Live figures, measured immediately before filing: `[N]` — insert real numbers
only, with what they measure and over what window. If a figure is not measured,
it does not go in the form. See §5.

On the team: `[ONE OR TWO SENTENCES, TRUE, NO INFLATION]` — who built this, what
they do, and why they are the ones to build it.

### 9:00–10:00 — Close

"It is free, it is account-free, and it tells you when to do nothing. That is
the whole idea. Thank you."

---

## 5. Rules for the numbers

- **Every figure is measured, never estimated.** If it is not measured, it is
  left out of the form entirely — an omitted number cannot be wrong.
- **Traction is time-sensitive.** The D1 ledger and Analytics Engine exist
  partly to answer criterion 2, so capture the figures shortly before filing,
  not from memory.
- **State the window.** "N sessions since D" is a fact. "N sessions" is a claim
  about the present tense that a judge cannot check.
- **No competitor products are named**, anywhere, including in conversation on
  stage. Official Rules §4 forbids it, and it is the project's own D-05.

## 6. Filing checklist

- [ ] Demo URL verified working in a real browser, not by curl alone
- [ ] `[REPO URL]` inserted — **required**, Official Rules §5
- [ ] Repository is public and readable
- [ ] Traction figures measured and their windows stated
- [ ] Every Cloudflare product listed is actually deployed and verified
- [ ] Anything unverified is described as *shipping*, never *shipped*
- [ ] No competitor named
- [ ] No account, paywall, or lead capture anywhere in the product
- [ ] Entered **by hand**, by a person
- [ ] **One submission only** — there is no second attempt
