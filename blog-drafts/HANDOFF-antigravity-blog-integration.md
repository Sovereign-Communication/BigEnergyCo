# Handoff: Blog Integration for SEO Content Generation

**To:** Antigravity / Gemini (site build owner)
**From:** Qwen Code (content pipeline)
**Date:** 2026-08-20
**Status:** Ready for integration

## 1. What this is

The first article of BigEnergyCo's SEO content pipeline has been generated, QA-verified, and is ready to be integrated into the site. The content was produced by a smaller model (`qwen3.6-flash`) via a repeatable delegation script, and passed an 11-point automated compliance check (word count, title tag, meta description, keyword placement, URL CTAs, tables, FAQ, structure).

**Primary article to integrate:**

```
blog-drafts/diy-vs-prebuilt-sodium-ion-lifepo4-battery-storage.qwen3.6-flash.md
```

- 4,952-word body, YAML frontmatter carries: `title` (49 chars), `meta_description` (155 chars), `slug`, `date`, `keywords` — use these verbatim for the page's `<title>`, meta tags, and URL.
- Structure: 1 H1, 12 H2 sections ending at the conclusion; two Markdown tables (LFP vs Na-ion chemistry comparison; DIY vs pre-bought); 8-question FAQ written as search queries.

Other files in `blog-drafts/` are superseded drafts (`.v1`, `.v2`) or an alternate longer version (`.qwen3.7-plus.md`, 5,952 words — good material but its final 4 sections currently sit after the conclusion and would need reordering). Ignore unless you want extra source material.

## 2. Positioning rules (non-negotiable, apply to all pages)

BigEnergyCo is a **free, educational, worldwide solar & battery estimator**. On every content page:

- Nothing is for sale; no signup; no specific products, Ah ratings, cell models, or manufacturers are offered. Specific cells (e.g., "314Ah LFP prismatic", "210Ah sodium-ion") appear only as **illustrative calculation examples**.
- Keep the disclaimer stance visible: *"Educational estimates only — verify with a licensed professional."*
- CTAs point only to the free estimator at `https://bigenergyco.github.io`.

## 3. Integration requirements

The site is a static GitHub Pages deployment (currently `index.html` + `app.js`). There is no blog engine yet — please create the minimal blog infrastructure in the same static style:

1. **URL structure:** `/blog/` listing page + article at `/blog/diy-vs-prebuilt-sodium-ion-lifepo4-battery-storage/` (or `.html` — match whatever GitHub Pages serves cleanest for the existing site).
2. **Styling:** match the existing site's CSS/visual language from `index.html`; no new frameworks or build steps.
3. **Markdown → HTML:** convert the article faithfully, preserving both tables, the FAQ section, and the Markdown links (estimator URLs must remain clickable).
4. **Head tags from frontmatter:** `<title>`, `<meta name="description">`, canonical URL, Open Graph + Twitter card tags.
5. **Structured data:** add `FAQPage` JSON-LD generated from the FAQ section (this targets featured snippets) and `Article` JSON-LD for the post.
6. **Navigation:** add a visible link to the blog from the main site (header or footer) and a link back to the estimator from the blog pages.
7. **Estimator untouched:** do not modify `index.html`'s estimator functionality beyond adding the nav link.
8. **Sitemap/robots:** if a sitemap exists, add the blog URLs; if not, consider creating `sitemap.xml` covering the estimator + blog.

## 4. SEO checklist for this article

- [ ] Title tag and meta description exactly as in frontmatter
- [ ] Single H1 matching the article's H1; H2/H3 hierarchy preserved
- [ ] Canonical + OG tags set
- [ ] FAQPage + Article JSON-LD valid (test with Google's Rich Results Test)
- [ ] Internal links to the estimator present (article already contains two `https://bigenergyco.github.io` CTAs)
- [ ] Mobile-friendly tables (horizontal scroll container is fine)
- [ ] Page loads as static HTML with no required JS

## 5. Content accuracy notes

- Cycle-life and chemistry figures are educational ballpark values consistent with 2026 market understanding; no brand-specific claims are made.
- The article intentionally avoids step-by-step build instructions and includes safety disclaimers — keep them intact.
- Nothing in the article should be read as product advice for a specific cell model.

## 6. The ongoing pipeline (FYI)

- `delegate_blog_post.py` (repo root) generates future articles: set `MODEL` and adapt `BRIEF`, then run. It self-repairs (word-count shortfalls, missing URL CTAs, oversized title tags) and prints a PASS/FAIL QA report — an article is ready for integration when the verdict is `READY`.
- `check_token_plan_models.py` probes which models are currently reachable on the plan.
- Suggested next topics that pair with this article's keywords: sodium-ion vs LFP cost-per-kWh deep dive; DIY home battery backup sizing guide; off-grid battery storage cost breakdown; "is it cheaper to build your own battery" data piece — each linking back to the estimator and to this article.
