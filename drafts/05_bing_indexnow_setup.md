# Draft: Bing Webmaster Tools + IndexNow Setup

## Step 1 — Bing Webmaster Tools (10 minutes)

1. Go to bing.com/webmasters → Sign in (Microsoft account or Google SSO import).
2. **Import from Google Search Console** — auto-imports site + sitemap + verified ownership. Fastest path.
   - Manual alternative: add property `https://bigenergyco.pages.dev/`, verify via XML file or CNAME.
3. Submit `https://bigenergyco.pages.dev/sitemap.xml` in Bing → Sitemaps.
4. Use **URL Submission** for the root + top 10 blog posts (Bing allows more per day than Google).

## Step 2 — IndexNow (immediate pinging, no approval needed)

IndexNow is open — no verification wait. Two ways:

### Option A: Cloudflare Pages (if deployed there — easiest)
- Cloudflare Dashboard → the project → Settings → **IndexNow** (or "Crawler Hints") → enable.
- Cloudflare automatically pings IndexNow on every deploy/content change. Zero code.

### Option B: Manual ping (works on any host)
1. Generate an API key: any random 32-char hex string, e.g. `openssl rand -hex 16`.
2. Host the key at `https://bigenergyco.pages.dev/{key}.txt` (plain text file containing just the key).
3. Ping:
   ```
   GET https://api.indexnow.org/indexnow?url=https://bigenergyco.pages.dev/&key=YOUR_KEY
   ```
   Or batch-submit the sitemap URLs (up to 10,000 per request):
   ```
   POST https://api.indexnow.org/indexnow
   Host: api.indexnow.org
   Content-Type: application/json; charset=utf-8
   {
     "host": "bigenergyco.pages.dev",
     "key": "YOUR_KEY",
     "keyLocation": "https://bigenergyco.pages.dev/YOUR_KEY.txt",
     "urlList": ["https://bigenergyco.pages.dev/", "..."]
   }
   ```
4. Verify: Bing should show the URLs as "submitted" within hours.

## Step 3 — Other engines (bonus)

- **Yandex Webmaster** — separate submission, indexes pages.dev sites reasonably fast.
- **Seznam (Czech)** — minor traffic, optional.
- **Brave Search** — crawls Bing's index; covered automatically once Bing indexes you.

## Notes
- IndexNow pings are idempotent — pinging the same URLs repeatedly is fine but unnecessary; ping on content changes only.
- Don't ping all 70 city pages at once on day 1 — a brand-new site submitting 70 URLs in one burst can look spammy. Ping the root + sitemap first, then trickle city pages over a week or two.
