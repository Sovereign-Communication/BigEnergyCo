## Plan items

P9.4 — Titles, H1s and meta (**R-SEO-01**), through the generator that produces them. The city-page set itself is P9.3's surface; this PR changes no shipped page.

Tracking issue: the pinned **Master plan tracker** issue (P9.4).

## What changed and why

A worldwide-surface audit was run from outside the repo (read-only, nothing added to the tree) against live staging `bigenergyco.pages.dev` and the tree main serves (`ddffb13`): a genuine spread across regions and currencies, all 66 city pages rather than a sample. It found one defect and proved it, and this PR closes exactly that one.

**The defect.** `scripts/build-city-pages.mjs` had drifted from the pages it generates. Its hub `<title>` (and the `og:title` / `twitter:title` derived from it) was **62 characters** — `Solar & Battery Calculator by City — Free Sizing for 66 Cities` — while the committed page carried the **52-character** `Solar Calculator by City — Free Sizing for 66 Cities`. Both sides were green in their own terms: `check-seo.mjs` reads the committed page (which passes the 60-character cap in `scripts/lib/seo.mjs`), and `build-city-pages.mjs --check` validated the strings it generates (which are self-consistent). Nothing compared the two, so only regenerating the pages was able to redden the SEO gate, and only by hand:

```
$ node scripts/build-city-pages.mjs && node scripts/check-seo.mjs
FAIL solar-calculator/index.html: title length 62 over 60        (exit 1)
```

**The fix, minimal and in the existing gates.**
- `scripts/build-city-pages.mjs` now emits the title the page ships (no page byte changes).
- Its `--check` mode compares the generated output against the files on disk and fails, naming each drifted or missing page. Line endings are excluded from the comparison (committed blobs are LF; a Windows checkout is CRLF), so it is not a platform check.
- `npm run seo` carries that check next to `sync-country-files.mjs --check` and `bump-asset-tokens.mjs --check` — the same "generated artifact must match its generator" shape already used twice in that gate.
- `tests/city-pages-drift.test.mjs` proves both directions: green on this tree, and red — naming the file — on a scratch copy whose hub title was shortened, and on one whose city page was deleted.

## The measurement (what was measured, and what could not be)

Measured against live staging, tree `ddffb13`, live bytes compared with the tree:

| Check | Result |
| --- | --- |
| home · hub · `locales.js` · `i18n.js` byte-equal to the tree | pass |
| 66/66 city pages serve 200, byte-equal, with their market's own content | pass |
| title / h1 / description name the city **and** country | 66/66 |
| canonical == that market's URL, hreflang `en` + `x-default` both = that URL | 66/66 |
| JSON-LD parses, names `"<City>, <Country>"`, carries the catalog coordinates | 66/66 |
| sitemap includes the page, with `lastmod` | 66/66 (0 of 82 URLs missing lastmod) |
| internal links resolve (home + hub + 66 pages) | 82 unique targets, 0 failures |
| hub → every city, city → hub | 66/66 both ways |
| locales shipped | 6 (en es pt fr de ar), `langSelect` present |
| 220 country partitions: parses, non-empty, no row carrying another country | 45,013 rows, 0 mismatches, no byte-identical pair |
| 221 countries → currencies, all displayable | 151 currencies, 0 without a display entry |

**Unmeasured, stated not rounded:** `freeoffgridcalculator.com` answers `403` + `cf-mitigated: challenge` to every non-browser client (home, hub, two city pages, sitemap), so nothing on the brand host could be read — those responses are neither passes nor failures. Traffic volume ("thousands of hits") is not observable from this environment at all.

**Premise corrections the measurement produced:** there are no country **pages** — P9.2 (R-SEO-03) is unbuilt, and the country surface that ships is 220 client-side partitions, which is what was measured. And the repo's note that P5.5 (the translation-fix link, R-I18N-06) does not exist is **correct**: no `issues/new` link and no "translation fix" string exists anywhere in the shipped surface (tree and staging), measured rather than trusted.

## Definition of done (plan §9)

- [x] Tests added for the change; coverage not lowered (`tests/city-pages-drift.test.mjs`, 4 tests, all green)
- [x] Local preflight: `npm test` · `node scripts/check-chars.mjs` · `npm run seo` · `npm run format:check` · `npm run deploy:check` · `npm run plan:check` — with one pre-existing exception recorded below
- [x] No metric regressed; no page byte changed (regenerating produces 0 content drift across all 67 generated files)
- [x] Scoped Jev report — `jev-complete` runs in CI on this PR; no facet is touched by this change
- [x] `docs/plan/LEDGER.jsonl` row appended (`note`, P9.4) with the measurement summary
- [ ] Release rules — n/a: no shipped byte changes, so no `CACHE_VERSION` or asset-token bump is due
- [ ] Tracking issue ticked — the owner's; this is one defect on P9.4's surface, not the item

**Pre-existing failure, not from this change:** `tests/deploy-blobs.test.mjs` → `stageFromIndex writes committed bytes and excludes a local edit` fails on a Windows checkout (staged LF vs committed CRLF `robots.txt`). Reproduced identically on a pristine `ddffb13` worktree before this branch existed. `npm test` on this branch is 1672/1673 with that as the only failure; `npm run format:check` is green.

**Named, not guessed (product decisions this audit did not take):**
- The static city pages quote USD-normalised benchmarks with a `$` sign, while the calculator converts to the market's currency via `country-currency.js`. Whether the static pages should also present local currency is a copy decision, not a defect proven by measurement.
- Nine duplicate coordinates inside six partitions are naming variants (two entries at one point), recorded as data noise rather than "fixed".
- The brand-domain challenge blocking non-browser clients is owner action **O-09**, not a code defect.
