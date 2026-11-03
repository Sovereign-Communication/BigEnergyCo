# Indexing Recovery Action Plan

## Do today (Day 0)

### 1. Submit the sitemap (highest priority, zero quota cost)
- Search Console → Sitemaps → enter `sitemap.xml` → Submit.
- If already submitted, resubmit anyway (free re-ping).
- Verify it shows "Discovered URLs: 70+" with no errors/warnings.

### 2. Request indexing for ONLY the root URL — once
- One attempt on `https://bigenergyco.pages.dev/` today.
- If it fails with quota again: **do not retry.** Stop for the day.

### 3. Verify Bing coverage (5 minutes, often faster than Google)
- Bing Webmaster Tools → import site from Search Console.
- Submit sitemap there too. Bing indexes new sites faster and its success confirms the site itself is crawlable.

### 4. Check Pagespeed / renderability once
- PageSpeed Insights on the root URL: confirm the content isn't client-rendered-only. If Googlebot gets an empty shell, no amount of quota fixes indexing.

## Days 1–7: build discovery paths (this is the real fix)

### Backlinks — pick 2–3 of these:
- [ ] GitHub profile/repo README linking to the site (indexes fast, free)
- [ ] One relevant subreddit or forum post where the calculator genuinely answers a question
- [ ] Hacker News "Show HN" (if the tool has a shareable angle)
- [ ] One directory listing (e.g., free tools / developer tools directories)
- [ ] A partner or friend's established site

### Internal signals:
- [ ] Confirm all 70 calculator pages are linked from the sitemap AND reachable in ≤3 clicks from the homepage
- [ ] Add internal links between related calculator pages (city → state → neighboring cities)

## Days 7–14: monitor, don't poke

- [ ] Search Console → Pages report: watch "Discovered / Crawled / Indexed" counts
- [ ] Zero manual "Request Indexing" attempts this week
- [ ] If nothing by Day 14: inspect crawl stats (Crawl Stats report) for crawl attempts/errors

## Decision point (Day 14)

If still 0 indexed pages with sitemap submitted + ≥2 backlinks:
- Register a custom domain and 301 the pages.dev site to it. This is the known fix for stuck pages.dev properties.

## Explicitly do NOT
- ❌ Retry "Request Indexing" more than once per day (accelerates throttling)
- ❌ Buy "instant indexing" services (mostly scam, some harmful)
- ❌ Mass-submit all 70 URLs daily (guarantees sustained throttling)
