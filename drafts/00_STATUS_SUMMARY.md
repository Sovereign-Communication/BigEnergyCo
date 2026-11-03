# BigEnergyCo — Indexing Status Summary

## Current state (verified 2026-08-31)

| Check | Result |
|---|---|
| `site:bigenergyco.pages.dev` | **0 results — nothing indexed** |
| robots.txt | ✅ live, allows all, points to sitemap.xml |
| sitemap.xml | ✅ live, ~70+ URLs (root, blog posts, 70 solar-calculator city pages) |
| Search Console "Request Indexing" | ❌ "Quota Exceeded" — repeatedly, for days |
| Canonical/OG/Twitter meta + JSON-LD | ✅ present and correct |

## Diagnosis

1. **The quota error is not a scheduling problem.** The "Request Indexing" quota is ~10–20 URLs/day, resetting midnight Pacific. A *persistent* "Quota Exceeded" with no requests being made is a known Google-side behavior: for new, low-authority domains it effectively means "this URL is deprioritized." Google's own support forums have multi-week threads of this. **There is no reliable "come back tomorrow."**

2. **The real blocker is discovery + authority, not technicals.** A bare `*.pages.dev` subdomain with zero backlinks is the lowest crawl-priority class Google has. The site's on-page SEO is already good (canonicals, hreflang, JSON-LD, sitemap all verified) — so more on-page tweaks won't move the needle.

3. **What actually moves the needle** (in order of leverage):
   - Sitemap submission via Search Console → Sitemaps (bulk queue, no per-URL quota)
   - 1–3 real backlinks from already-indexed sites (bypasses the quota system entirely)
   - Custom domain (pages.dev subdomains are chronically slow to index)

## Prognosis

- With sitemap + first backlink today: **first pages typically indexed in 1–2 weeks.**
- Retrying the button only: unpredictable, often weeks, and repeated attempts while throttled can keep the property in the penalty box.
- Recommendation: **stop clicking Request Indexing for a few days** and run the plan in `01_ACTION_PLAN.md`.
