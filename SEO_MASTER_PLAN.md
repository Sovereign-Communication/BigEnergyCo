# BigEnergyCo — SEO Master Plan

**Mission:** make BigEnergyCo the #1 free answer for "can solar + battery cut my bill / get me off-grid?" and drive real people to the estimator.
**House rule (from `LIABILITY.md`):** nothing for sale, no lead capture, no dark patterns. Every SEO action must match that — trust-first, tool-first.

---

## 1. Who this tool helps → keyword universe

| #   | Audience                                                                     | Pain / intent                      | Example queries                                                                                   | ROI                                                    |
| --- | ---------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| A   | **Homeowner with expensive bill** (Brazil, Europe, Australia, India)         | "My bill doubled — what do I do?"  | `como reduzir a conta de luz`, `cut electricity bill with solar`, `cuanto ahorra paneles solares` | 🔥 highest volume                                      |
| B   | **TOU / tariff-shock victim** (California, Australia, UK, Portugal)          | Battery to dodge peak pricing      | `time of use battery savings`, `is a home battery worth it`, `bateria para tarifa ponta`          | 🔥 high intent — **grid-tie mode already solves this** |
| C   | **Off-grid dreamer** (rural, van/RV, homestead)                              | Size a system that survives winter | `off grid solar calculator`, `what size battery for off grid`, `battery bank sizing`              | 🔥 evergreen; calculator is the hook                   |
| D   | **DIY builder**                                                              | Chemistry, BMS, cost per kWh       | `DIY LiFePO4 battery`, `sodium ion vs lifepo4`                                                    | ✅ blog already covers; keep feeding                   |
| E   | **Blackout-prone regions** (Nigeria, Lebanon, South Africa, Cuba, Venezuela) | "Generator fuel is killing me"     | `solar vs generator cost`, `load shedding solutions solar`                                        | 🔥 killer ROI stories, low competition in ES/FR        |
| F   | **Small farm / remote business**                                             | Pumps, fridges, freezers           | `solar para fazenda`, `bombeo solar dimensionamiento`                                             | medium volume, high conversion                         |
| G   | **Curious searchers**                                                        | "Is solar worth it in [my city]?"  | `solar calculator [city]`, `horas de sol [cidade]`                                                | programmatic gold (§4, Cluster 4)                      |

**Core message (use everywhere — Reddit, HN, video, blog):**

> "Free calculator that simulates YOUR city's real weather (5 years of NASA satellite data) and tells you honestly what solar + battery would cost and save — no signup, nothing for sale."

That honesty + real-weather-data angle is the differentiator against every installer's "get a quote" page.

---

## 2. Technical SEO — ship TODAY (~120 LOC)

Site base is already strong (canonicals, OG/Twitter, JSON-LD `WebApplication`+`FAQPage` on home, `Article`+`FAQPage` on posts, sitemap, robots, RSS, GSC verified). Confirmed gaps:

| #   | Task                                                                                                                                                                                        | Where                                           | ~LOC            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------- |
| T1  | **SEO CI check script** — h1 uniqueness, canonical present, OG completeness, JSON-LD parses, sitemap URLs ↔ real files, robots OK. Wire into `.github/workflows/test.yml`                   | `scripts/check-seo.mjs` (new) + 1 workflow line | 45              |
| T2  | **hreflang**: site ships EN/ES/PT/FR/AR chrome but zero hreflang tags. Add `en` + `x-default` now; full cluster only when localized pages exist                                             | `index.html`, blog heads                        | 10              |
| T3  | **BreadcrumbList JSON-LD** on both posts (Home → Blog → Post)                                                                                                                               | 2 posts                                         | 12              |
| T4  | **404 recovery links** — add nav links (Estimator / Blog / Hardware) so soft-404 equity recovers                                                                                            | `404.html`                                      | 8               |
| T5  | **og:locale + article:modified_time** on both posts                                                                                                                                         | 2 blog heads                                    | 6               |
| T6  | **Defer non-critical JS** in 3.3k-line home page; verify LCP < 2.5s mobile (PageSpeed)                                                                                                      | `index.html`                                    | 10              |
| T7  | **Unique OG image per post** (1200×630, headline-on-image)                                                                                                                                  | `assets/`                                       | 0 code (design) |
| T8  | **Deploy allowlist sync** — both `.github/workflows/deploy.yml` and `scripts/deploy-pages-local.mjs` hardcode the file list; every new page MUST be added to both or it silently won't ship | 2 files                                         | 4               |

**Ship-today total: ≈ 95–120 LOC**

---

## 3. Content engine — "calculator + answer page" pairs (~300–600 LOC/post)

Existing: home + 2 posts. Cadence: **1 post/week** (sustained beats burst). Each post: 1200+ words, one table, one worked example, `Article`+`FAQPage` JSON-LD (template exists), unique OG image, CTA = "run the free simulation" (never "get a quote").

### Cluster 1 — "Cut my bill" (audiences A+B) — priority 1

| Page                                            | Target query                             |
| ----------------------------------------------- | ---------------------------------------- |
| `/blog/how-to-cut-electricity-bill-with-solar/` | "how to cut electricity bill with solar" |
| `/blog/is-a-home-battery-worth-it/`             | "is a home battery worth it"             |
| `/blog/time-of-use-tariffs-battery/`            | "time of use battery savings"            |

### Cluster 2 — Off-grid sizing (audience C) — priority 1

| Page                                         | Target query                                |
| -------------------------------------------- | ------------------------------------------- |
| `/blog/what-size-solar-system-for-off-grid/` | "what size solar system do I need off grid" |
| `/blog/off-grid-battery-bank-sizing/`        | "battery bank sizing calculator"            |

### Cluster 3 — Solar vs generator (audience E) — priority 2, highest story potential

| Page                             | Target query                                    |
| -------------------------------- | ----------------------------------------------- |
| `/blog/solar-vs-generator-cost/` | "solar vs generator running cost"               |
| `/blog/escape-load-shedding/`    | "load shedding solutions solar" (ZA/NG/Lebanon) |

### Cluster 4 — Programmatic city pages (audience G) — the long game

`/solar-calculator/{city}/` for the **66 reference cities** already in `CITY_CATALOG` (`assets/js/sizing/cities.js` — names, countries, lat/lon all present). Each page: city coordinates, sun-context, a worked 10 kWh/day example, "run the exact simulation for your address" CTA. 66 honest, data-rich pages Google can't call thin.

- Template page (~120) + build script rendering from the catalog (~80) + sitemap regen (~20) ≈ **220 LOC once**, then near-zero per city.
- Add a "solar savings by region" hub linking all city pages (silo structure).

---

## 4. Distribution — spreading the message (0 LOC, ongoing)

| Channel                     | Action                                                                                                                                           | Cadence                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| **Reddit**                  | r/solar, r/OffGrid, r/diySolar: genuinely answer sizing questions, link the calculator. The "no signup, nothing for sale" angle lands well there | 2–3 answers/week           |
| **Hacker News**             | "Show HN: Free solar/battery sizer using 5 years of NASA satellite data" — the NASA hook                                                         | once, when city pages ship |
| **YouTube Shorts / TikTok** | 30s screen-record: type city → see payback curve. No voiceover needed                                                                            | 1–2/week                   |
| **ES/PT communities**       | foros de energía solar, Telegram/Discord groups (BR/PT)                                                                                          | same as Reddit             |
| **Directories**             | AlternativeTo, Product Hunt, awesome-lists                                                                                                       | one-time                   |
| **Outreach**                | energy bloggers/newsletters covering free tools — offer the NASA-weather angle                                                                   | 5 emails/month             |
| **Search Console**          | after each post: URL Inspection → Request indexing; monthly: re-submit sitemap. Bing WMT: one-click import                                       | per post                   |

---

## 5. Long-term plan — page 1 on Google

**Phase 1 (weeks 1–2): foundations.** Ship §2 fixes + CI check. GSC + Bing healthy. First 2 Cluster-1 posts.
_Metric: all pages indexed, zero coverage errors._

**Phase 2 (months 1–2): calculator-led clusters.** Clusters 1+2 complete (5 posts). Add related-posts internal-linking block (~20 LOC). Start Reddit cadence.
_Metric: impressions up on "off grid calculator" cluster; first page-10 rankings._

**Phase 3 (months 2–4): programmatic scale.** Ship `/solar-calculator/{city}/` (66 cities) + hub page. Show HN launch.
_Metric: long-tail impressions ("solar calculator [city]"), 20+ pages with traffic._

**Phase 4 (months 4–8): authority compounding.** Cluster 3 + outreach. Quarterly data refreshes (`dateModified`). Translate the 3 best posts to ES/PT (i18n chrome already exists).
_Metric: top-10 for 5+ head terms ("off grid solar calculator", "is a home battery worth it")._

**Phase 5 (month 8+): defend & expand.** Annual "State of Solar Payback" data study using the site's own simulation outputs — data studies earn backlinks organically. Keep 1 post/week. Refresh FAQs to capture new People-Also-Ask boxes.

---

## 6. LOC budget summary

| Workstream                           | LOC                                   |
| ------------------------------------ | ------------------------------------- |
| Technical fixes today (§2)           | ~95–120                               |
| Blog posts (per post, HTML)          | ~300–600                              |
| Programmatic city pages (one-time)   | ~220                                  |
| Related-posts internal-linking block | ~20                                   |
| **Total to full rollout**            | **≈ 700–1,000 LOC + ongoing content** |

## 7. Next-session commit order

1. `scripts/check-seo.mjs` + wire into `Tests` workflow (~45 LOC)
2. hreflang/canonical/OG gaps on home + 2 posts (~20 LOC)
3. BreadcrumbList JSON-LD on posts (~12 LOC)
4. 404 nav links (~8 LOC)
5. First Cluster-1 post: "How to cut your electricity bill with solar (honest math)"
6. City-page template + generator (the 220-LOC multiplier)
