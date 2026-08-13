# Liability Re-Audit — free tool, no entity, personal donations

Re-run 2026-08-01 against your actual decisions: **no LLC ever**, service **totally free**,
**optional donations to you personally**, **your personal email published** as a contact.
Supersedes the entity-based analysis in `PLAN.md` §1–2.

Not legal or tax advice. It flags where you need a real professional and where you probably don't.

---

## 1. The one thing that changed, and it's permanent

**Without an entity, you and the project are the same legal person.** There is no veil, nothing to
pierce, and no separate pool of assets. Any judgment against "BigEnergyCo" is a judgment against
Lucas Ballek and reaches your personal assets — savings, accounts, vehicle, and potentially your
home subject to whatever homestead protection your state gives.

That is the whole cost of the decision, and you've made it. Everything below is about making the
probability of ever getting there as close to zero as it can practically be — which, for a genuinely
free informational tool, is quite close.

---

## 2. What "free" actually buys you — this is the good news

Going free removed most of the real exposure, and it did so more effectively than an LLC would have:

| Theory | Before (paid advisory, $5k fee, procurement agency) | Now (free tool) |
|---|---|---|
| Breach of contract | Live — you had a contract and deliverables | **Gone.** No contract, no consideration, no promise |
| Express / implied warranty (UCC Art. 2) | Live — "Guarantee" in the hero, hardware sourcing | **Gone.** You sell no goods and make no guarantees |
| Consumer-protection / UDAP / FTC §5 | Live — price claims in commerce | **Very weak.** Deception claims need commerce; the savings claims are now dated, hedged, and sell nothing |
| Product liability | Live — you were in the supply chain as agent | **Gone.** You never touch, title, or ship hardware |
| Professional negligence | Live — held out as engineering advisory | **Weak.** You disclaim it everywhere and hold no license out |
| **Negligent misrepresentation** | Live | **The one that remains.** See below |

### The one that remains

Negligent misrepresentation is the realistic theory against a free advice site: you supplied
information, someone relied on it, they got hurt. Under Restatement (Second) of Torts § 552, the
claim generally requires the information be supplied *"in the course of his business, profession or
employment, or in any other transaction in which he has a pecuniary interest."*

A genuinely free, non-commercial tool with no pecuniary interest sits largely **outside** that rule.
Which leads to the single most important finding of this re-audit:

> **The donation link is the one thing most likely to create the "pecuniary interest" hook that
> § 552 needs.** It is also the thing you asked for. It is worth keeping — but the way it is framed
> is doing real legal work, not just being polite.

This is why the implementation deliberately keeps donations structurally decoupled from the service:

- No donation prompt appears before or attached to a result.
- Donations unlock nothing — no tier, no feature, no priority, no answer quality.
- The copy states plainly that contributions buy nothing and are not payment for a service.
- The AI is instructed never to solicit donations and never to suggest donating gets better answers.

**Keep it that way.** The moment a donation is tied to receiving anything, you've converted a gift
into a transaction and handed a plaintiff both the pecuniary interest and a consumer-protection
angle you currently don't have.

---

## 3. Your published email is now the sharpest edge

This is the newest exposure and worth being clear-eyed about.

Generic AI output broadcast to the world is weak ground for a reliance claim — it's obviously
automated, disclaimed, and not directed at anyone. **A personal reply from a named human to a
specific person about their specific system is the opposite.** That is where reliance becomes
reasonable, and it is where negligent-misrepresentation risk actually concentrates.

The page already frames it correctly: a favor, no promised response, an opinion for further
research, explicitly not professional advice, no professional relationship created. Beyond that,
three habits matter more than any disclaimer:

1. **Never give a go/no-go on someone's actual installation.** Not "that wiring is fine," not "that
   fuse is adequate," not "yes, that's safe to energize." Redirect to a local licensed professional
   every single time. A sign-off is the fact pattern that gets someone hurt and gets you sued.
2. **Never contradict a licensed local professional** who has actually seen the site. You haven't.
3. **Keep your replies general and educational**, the same register as the site. The moment you're
   designing someone's specific system by email, you're doing unlicensed engineering work for free
   with unlimited personal liability — the worst possible combination.

Practical: expect spam. Cloudflare is auto-obfuscating the address on the public page (verified),
which blocks most scrapers, but a public address still attracts volume. Consider a filter or a
dedicated alias if it becomes a problem.

---

## 4. Insurance — the part most people get wrong

**Your homeowners or renters liability policy almost certainly will not cover this.** Standard
policies exclude "business pursuits," and a public website that accepts contributions is very likely
to be classified as one — even though you make no profit and charge nothing. A personal umbrella
policy typically inherits the same exclusion.

So the intuitive protection ("I'm just a guy, my home policy covers me") is probably the one thing
that does *not* apply here.

What actually works without an entity:

- **Tech E&O / professional liability, or media liability**, written for a sole proprietor. You do
  **not** need an LLC to buy this — insurers write for individuals routinely. This is the real
  answer to "how do I protect myself without incorporating."
- **Ask your current carrier, in writing**, whether a free donation-supported informational website
  falls under the business-pursuits exclusion. Get the answer in email, not over the phone. This
  costs nothing and takes ten minutes, and it tells you exactly how exposed you are today.

Do these two things before the site gets meaningful traffic. Insurance is the only mitigation that
actually pays a lawyer if something happens; everything else just lowers the odds.

---

## 5. Donations — tax and platform reality

**Tax.** Money you receive because people found your tool useful is, in the IRS's view, very
unlikely to be an excludable gift — a gift requires "detached and disinterested generosity"
(*Duberstein*), and a thank-you for value received rarely qualifies. Expect it to be reportable
income. Whether it lands as hobby income or self-employment income on Schedule C (with SE tax)
depends on regularity and profit motive, and at small volumes the difference is minor. Keep a simple
running log of what comes in from day one; that alone solves most of the problem. Ask a tax preparer
once, at the first filing, rather than guessing annually.

You will likely receive a 1099-K if payments flow as goods-and-services. The reporting thresholds
have changed several times recently — check current IRS guidance rather than any number you
remember.

**Platform risk, and this one is concrete.** Venmo and Cash App personal accounts are, under their
own user agreements, generally for personal transactions between people who know each other.
Accepting contributions from strangers via a public website is the pattern their risk systems look
for. The realistic failure mode is not a lawsuit — it is **an account freeze with a balance in it**,
which is a genuine, common outcome and a miserable one to unwind.

Two ways to reduce that:
- Read the current Venmo and Cash App terms for personal-account use, and decide knowingly.
- Consider adding **Ko-fi, GitHub Sponsors, or a Stripe Payment Link**, which are purpose-built for
  exactly this and won't freeze you for doing what they're designed for. You can keep the personal
  handles alongside them.

**Never imply tax-deductibility.** You are not a charity and not a 501(c)(3). The page states this
explicitly. Saying "donation" near a personal brand without that disclaimer is what draws state
charitable-solicitation attention. The current wording is fine — don't soften it.

---

## 6. Privacy — now genuinely low-risk

Removing the lead form was the single largest risk reduction in this pass. You went from collecting
name, email, phone, and location from anyone in the world into a plaintext file on a home desktop,
to collecting nothing.

Current position:
- **No accounts, no PII collected, no analytics profile, no advertising cookies.**
- **IP addresses** are personal data under GDPR, and the rate limiter uses them — but only in
  memory, never written to disk, and cleared on restart. That is a defensible minimum necessary for
  abuse prevention under legitimate interest.
- **Chat text is sent to Groq** to generate replies. This is disclosed in the terms. Users are told
  not to enter sensitive information.
- The archived `leads.jsonl` contained **six entries, all test data** — no real third-party personal
  data, so there is nothing to notify anyone about. It's been moved to `.backup/`. Delete it
  whenever you like.

GDPR technically still applies to a public website serving EU visitors (the "purely personal or
household activity" exemption doesn't cover public sites). Realistic enforcement risk against an
individual running a free tool that collects nothing is very low, and collecting nothing is exactly
the right mitigation. Don't start collecting anything without revisiting this.

---

## 7. Freenet is effectively permanent — know this before publishing

Content published to a Freenet contract is distributed across a decentralized network. **You cannot
reliably retract it.** A version with a wrong number, a bad claim, or an old disclaimer can persist
after you've fixed the live site.

Practical consequence: treat every Freenet publish as permanent. Get the terms and disclaimers right
*before* republishing, not after. The launcher deliberately does **not** publish to Freenet by
default — you have to pass `--publish` on purpose.

---

## 8. Still open on the site itself

Small, worth doing:

1. **Date the prices.** The parts list still states `$43.50 / cell`, `$92.00 / unit`, etc. as bare
   facts. Add "indicative, as of August 2026" or drop the figures. Stale prices presented as current
   are the most likely remaining source of a "you misled me" complaint.
2. **Date the retail baseline.** The $851.85/kWh comparison figure needs an "as of" and a source
   note for the same reason.
3. **"6,000+ Cycles"** still appears in the chemistry dropdown. It's no longer called a guarantee,
   which was the real problem, but label it "manufacturer-rated" to be clean.
4. **Consider open-sourcing the code** under MIT or Apache-2.0. The "AS IS, WITHOUT WARRANTY OF ANY
   KIND" clause in an OSS license is the most heavily tested liability disclaimer in software, and
   it reframes you as someone who published code rather than someone who gave advice. For a free
   tool with no entity, this is cheap and genuinely useful.

---

## 9. Honest bottom line

A free, no-signup, no-data, nothing-for-sale informational tool with disclaimers at the point of
output is a **low-risk** thing for an individual to run. The realistic worst case is not a lawsuit;
it's a frozen payment account or a drained AI quota, both of which are now mitigated.

The two things that meaningfully raise your risk above that floor are **the donation link** and
**your published email** — and you want both. They're worth keeping. Just keep donations decoupled
from the service and keep email replies general and referral-oriented, and you stay near the floor.

The one action with real value that you haven't taken yet: **get the insurance answer in writing.**
Not because a claim is likely, but because without an entity, that policy is the only thing standing
between a claim and your personal assets.
