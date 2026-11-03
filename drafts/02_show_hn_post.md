# Draft: Show HN Post

## Title (pick one)

1. Show HN: BigEnergyCo – free solar & battery payback estimator, 70 cities, no signup
2. Show HN: I built a free tool that estimates solar payback using 5 years of NASA satellite weather
3. Show HN: BigEnergyCo – honest solar/battery ROI math for 70 cities worldwide

Recommendation: #2 — "I built" framing performs best on Show HN, and the NASA weather data angle is a concrete, interesting detail.

## First comment (post immediately after submitting)

Hi HN — I built BigEnergyCo, a free tool that estimates whether solar panels (and battery storage) are worth it for your specific location.

It uses 5 years of NASA satellite weather data (NSRDB) to simulate actual production for 70 cities worldwide, then runs the payback math: system cost, local electricity prices, degradation, and incentive programs.

Why I built it: every "solar calculator" I found was a lead-gen form for installers. I wanted honest numbers with no signup and no sales pitch — including the cases where solar *doesn't* pay off.

Technical notes:
- Static site (HTML/CSS/vanilla JS), hosted on Cloudflare Pages — no backend, no tracking
- Weather data from NSRDB via PVWatts-style simulation, precomputed per city
- The interesting part was the payback model: electricity price inflation vs. panel degradation crossover is very sensitive to assumptions, and most calculators hand-wave it

Happy to answer questions about the modeling. Roast the assumptions — that's why I posted.

## Timing tips
- Post Tue–Thu, 8–10am ET (best Show HN traffic)
- Have the site fast and mobile-clean before posting (HN traffic can kill a small static site — it should be fine on Cloudflare Pages)
- Reply to every early comment quickly; early engagement determines whether it hits the front page

## If it doesn't take off
- Don't repost the same URL; wait ~6 months or change the title substantially
- A quiet post still earns a permanent backlink, which is what we need for indexing anyway
