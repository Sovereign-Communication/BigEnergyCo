# Draft: Reddit Posts

## Subreddit targets (in order of fit)
1. r/solar — largest, tool-relevant, but check self-promo rules (usually fine if you engage in comments and don't spam)
2. r/Frugal — angle: "free tool to check if solar actually saves you money"
3. r/PersonalFinance — angle: payback math / is solar worth it financially
4. r/energy or r/RenewableEnergy — angle: honest ROI math, chemistry comparisons

## Title options

1. I built a free solar payback calculator that uses real NASA weather data for 70 cities — no signup, no lead-gen
2. Most "solar savings calculators" are just lead-gen forms for installers. I made one that just does the honest math.
3. Is solar actually worth it where you live? I made a free tool to check (uses NASA weather data, 70 cities)

Recommendation: #2 — self-aware framing about the lead-gen problem tends to land well on Reddit.

## Post body (r/solar version)

I got tired of solar calculators that exist only to harvest your phone number for installers, so I built one that just does the math.

**What it does:**
- Pick your city (70 cities across the US and world) — it uses 5 years of NASA satellite weather data to estimate actual production at your location
- Enter your roof size, panel choice, and electricity rate
- It shows payback period, 25-year cumulative cost vs. staying on the grid, and whether the numbers actually work — including when they don't

**What it deliberately doesn't do:**
- No signup, no email gate, no installer referrals, no "get a quote" spam

The chemistry comparison (LFP vs sodium-ion vs lead-acid) is where it gets nerdy — the break-even math is very sensitive to degradation rates and price inflation assumptions, and most calculators just ignore that.

Site: https://bigenergyco.pages.dev

Happy to answer questions about the modeling. If you spot a bad assumption, tell me — that's exactly why I'm posting.

## Comment replies to have ready

**"How is this different from PVWatts?"**
PVWatts gives you production. This adds the financial layer on top — payback period, cumulative cost vs. staying on the grid, chemistry comparison — with the assumptions stated explicitly instead of hidden.

**"Where does the weather data come from?"**
NASA's NSRDB satellite-derived irradiance, 5 years per city, precomputed into the production estimates.

**"What's the catch?"**
No catch — it's free, no signup, nothing for sale. If solar doesn't pay off in your city, it'll tell you that too.

## Rules to check first (per subreddit)
- Many subs require 9:1 or 10:1 participation ratio — engage in other threads before posting
- Some subs require mod approval for links — message mods first
- r/PersonalFinance bans self-promo in some threads — read sidebar before posting there
