# SEO Doctrine for freeoffgridcalculator.com Blog

**Standing lane policy** (2026-10-13). Every future post must conform. This is mandatory, not aspirational.

## BLUF

There is no post-count quota, but Google's scaled-content-abuse spam policy (March 2024) judges the whole domain — large volumes of thin posts can poison the calculator's own rankings.

## 1. Why this doctrine exists

- The helpful-content classifier is site-wide. Thin content at scale drags down good pages too, including the calculator itself.
- Google indexes selectively; thin pages on small domains rot as "Crawled — currently not indexed." 20,000 thin posts ≈ 20,000 unindexed pages plus a damaged domain.
- Crawl budget is finite per site; junk slows discovery of the good pages.
- This niche has a natural ceiling (~50–150 topics with real search demand). Past that, posts dilute topical authority instead of building it.

## 2. Quality gates — every post passes ALL before its PR

1. **Real search demand**: targets something people actually search for, not an invented topic.
2. **Genuinely useful**: first-hand experience, real simulator numbers, worked examples — the standard the hurricane post set.
3. **Calculator tie-in**: every post links into the calculator flow (CTA + internal links). The blog serves the calculator; it is not a standalone content farm.
4. **Verifiable claims**: figures (incentives, costs, specs) reverified before publish; sources cited.
5. **Unique intent per URL**: no two posts chasing the same query, no keyword cannibalization.

## 3. Architecture

- Topic clusters around the six use cases (bill cut, TOU, outage backup, emergency reserve, off-grid, portable), hub-and-spoke with internal linking into calculator flows.
- **sitemap.xml / llms.txt parity on every publish** — the #209 lesson; the test enforces it and it is correct to enforce.
- Header, JSON-LD, and RSS uniformity on every new page (the header-parity work continues).

## 4. Scale plan

- Target 30–100 excellent posts, not thousands. Publish in clusters, measure in Search Console, scale only what earns impressions. No post ships to chase a number.

## 5. Maintenance

- Freshness reviews on a cadence: incentive figures, product specs, and storm references go stale — reverify.
- Thin or dead posts get improved or removed, never left to rot.

## Publishing checklist

Before opening a PR for a new post:

- [ ] Gates 1–5 above all satisfied
- [ ] `sitemap.xml` entry added
- [ ] `llms.txt` entry added (test: `llms.txt lists every sitemap guide`)
- [ ] `rss.xml` item added (newest first)
- [ ] `blog/index.html` card added (top, newest first) + JSON-LD `blogPost` entry
- [ ] Header matches main-page structure (logo, i18n nav, CTA) with correct relative paths
- [ ] JSON-LD `Article` block valid (headline, description, dates, author, image)
- [ ] Title ≤60 chars, meta description ≤155 chars (`npm run seo` enforces)
- [ ] CTA links into calculator (`../../#sizing` or appropriate anchor)
- [ ] `npm run seo` clean, `npm run format:check` clean
