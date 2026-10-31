## What this imports

`b972c3d5` — "content(P9.5): qualify off-grid payback comparison" — a completed content fix from the P9.5 lane that was **never pushed** (verified: existed only on the local branch `mission/p95-offgrid-gridtie-20261023`, no remote contained it). It qualifies the off-grid vs grid-tie payback blog post (305-line rewrite), updates the blog hub listing, `rss.xml` and `sitemap.xml`, and carries its own **68-line regression test** (`tests/blog-off-grid-gridtie-audit.test.mjs`) — verified valuable before import, per the sweep reconciliation.

The four files it touches were **untouched on main** since the commit's original base (`59a3f52f`), so the cherry-pick applied clean.

## Adaptation commit (5cebc552)

The Oct-22 content pre-dates two current gates:

1. **Title 67 chars > 60** (fails `check-seo` and `tests/seo-contract.test.mjs`). Shortened to `Off-Grid vs. Grid-Tied Solar: Payback and Resilience (2026)` (59) in `<title>` and `og:title`; headline/JSON-LD untouched.
2. **`dateModified` pin** — the content edit correctly moved `dateModified` to `2026-10-22`, while `tests/polish-pass1.test.mjs` pinned the old `2026-08-23`. The pin now asserts the current date; every other assertion unchanged.

## Verification (local, head 5cebc552)

- `npm test` — **1984/1984**
- `npm run seo` — exit 0 (title rule, sitemap, i18n, provenance)
- `node scripts/check-chars.mjs`, `npm run format:check`, `npm run deploy:check`, `npm run plan:check` — all exit 0
- Secret scan of the diff — clean

## Plan items

P9.5 (off-grid vs grid-tie payback comparison content). No plan change.
