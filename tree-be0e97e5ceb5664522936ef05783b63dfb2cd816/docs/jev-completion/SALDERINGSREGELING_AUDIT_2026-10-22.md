# P9.5 audit: Dutch net-metering article

**Requirement:** P9.5 / R-CONT-05. The post was reviewed on 2026-10-22 against current Dutch rules and its worked example.

## Findings and corrections

- The legal date remains 1 January 2027. The article now explains the minimum feed-in payment through 1 January 2030 and directs readers to the live government and ACM guidance.
- The 30% direct-use share and €0.30 / €0.12 rates are identified as example inputs, not national averages or current offers.
- Corrected the arithmetic: the 50% direct-use case is €630/year under the stated inputs; each additional ten percentage points changes this example by €84/year before feed-in fees.
- Removed generic battery self-consumption, efficiency, and lifetime claims. The page no longer treats the example as a panel or battery payback estimate.
- Removed unrelated visitor-ranking claims and emoji; replaced the calculator CTA with a description of what the tool estimates.
- Added a visible review date and synchronized Article, BlogPosting, card, and FAQPage content. The shared inline style block was left unchanged.

## Primary sources checked 2026-10-22

- [Rijksoverheid: Salderingsregeling stopt in 2027](https://www.rijksoverheid.nl/themas/klimaat-milieu-en-natuur/energie-thuis/salderingsregeling)
- [ACM ConsuWijzer: Salderen en terugleveren](https://consument.acm.nl/elektriciteit-en-gas/duurzame-energie/wat-is-salderen)
- [Staatscourant 2025, 43817](https://zoek.officielebekendmakingen.nl/stcrt-2025-43817.html): no negative weighted monthly average of the feed-in compensation.

This article audit does not assign a Jev score. The exact-head `jev-complete` result is recorded with the PR evidence after CI runs.
