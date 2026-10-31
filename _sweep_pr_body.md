## Summary

Sweep-import of two verified items from the primary clone's working tree, plus the written import-or-discard record for every remaining sweep item of the burndown.

### Imported by this PR

**1. Localized accessible names for the chart canvases** (`charts.js`, `locales.js`, `tests/charts.test.mjs`)

`drawSocChart`, `drawCumCostChart` and `drawAutoChart` now set `aria-label` + canvas `textContent` through `updateCanvasCopy()`. The scratch version hardcoded English; this version assembles every label from the dictionary (six new keys x 7 locales: en, es, pt, fr, de, nl, ar), chemistry names go through the existing `localizedChemistry()` path, and the solar/battery-only qualifier has its own keys.

Tests: `setAttribute` added to the DOM fake, plus 4 locale-loop assertions (SOC, comparison, cumulative-cost solar, cumulative-cost battery-only). Mutation-proofed: wiring the wrong key into `drawAutoChart` fails with `the comparison canvas must carry a localized accessible name`, then passes again on restore.

**2. Rooted `verify-staging.mjs` reads** (script + stamp)

Path-relative reads are now rooted at the repository root derived from `import.meta.url` (the gate can spawn the script from another working directory), and the asset stamp comes from the git index (`git show :index.html`), declaring the bytes that ship.

Honest scope note: the scratch version also read every parity target via `git show`. That measured ~350 extra processes per run and pushed this budget-bound verifier past its own watchdog in the full suite (observed failing `a source that fails under a spent budget returns a verdict, not a kill`, then reverted). Parity bytes stay a rooted local read; concurrent deletion remains covered by the mutation lock.

## Sweep disposition record (import-or-discard, evidence-based)

| Item | Decision | Evidence |
| --- | --- | --- |
| p95 push + PR | **Imported** | PR #324, head verified unpushed + valuable (blog rewrite + 68-line regression test); all 9 checks pass |
| 7 handoff notes | **Imported** | PR #325 — confirmed set = exactly 7 note-named files, none previously in repo |
| squash 31 files (`codex/pr171-squash-20261023`) | **Discard** | Zero commits ahead of main, zero diff; #171 landed as `43f5378b` |
| `_inline.js` | **Discard** | Kalshi trader-dashboard mockup; `kalshi`/`selectedLedger` appear nowhere in origin/main |
| `car2-bak/cities.js`, `car4-bak/frontier.js` | **Discard** | Both exist in main (`assets/js/sizing/cities.js`, `assets/js/sizing/frontier-chart.js`) |
| v0.5.0 release notes | **Imported** | Carried into `docs/notes/` by PR #325 as history (no v0.5.0 release exists) |
| post-rebase patch (`beco-pr171-post-rebase-fixes.patch`) | **Discard** | Superseded: main's engine.js no longer has the re-export block; main's tests have 0 references to `LEAFLET_STYLE_URL` |
| i18n-noop scripts (`codex/p0_4-i18n-noop-20261022`) | **Discard** | Branch has zero diff vs origin/main — landed |
| canonical: `charts.js` + `tests/charts.test.mjs` | **Imported (as rewritten)** | Scratch test file was NOT taken: it deleted regression pins (export-surface, ownership, boundary) and is 227 lines vs main's 559 — importing it would decrease coverage. Addeditive assertions used instead |
| canonical: `scripts/verify-staging.mjs` | **Imported** | Rooting fix addresses a real spawn-cwd defect; validated by promote-gates 21/21, deploy-manifest 9/9, ci-resilience 46/46 standalone and 1986/1986 in the full suite |
| canonical: `sitemap.xml` | **Discard** | Main already carries `2026-10-22` for that URL (superseded) |
| canonical: `robots.txt` | **Discard** | Byte-identical to main (CRLF-only working noise) |
| canonical: `.github/workflows/test.yml` (Blacksmith runner) | **Held — owner question** | Requires the org-level Blacksmith GitHub App; the change's own comment says the job queues (CI hang) if it is not installed. Infra decision is owner-only — see questions |
| 103 x `_*.ps1` + `.tmp-compare-real.mjs` | **Discard** | One-off scratch tooling targeting `.worktrees/feature-preflight` and `.tmp-*` files; their product is `_inline.js` |
| `dummy_key.pem` | **Reference check only (done)** | 0 references in both worktrees, never tracked in any git history (`git log --all --diff-filter=A -- '*dummy_key*'` empty). Left untouched — this lane never deletes |

## Questions log

1. **Blacksmith runner pilot (test.yml):** import the `runs-on: blacksmith-2vcpu-ubuntu-2404` change once the Blacksmith GitHub App is installed org-wide, or drop it? Until confirmed, importing would risk queueing every test job indefinitely. Held out of this PR.
2. **Google-quality gate (4c):** the Jev waive-vs-fix call on the 99/100 bar returned **fix** over waive (recorded in the lane log); no waiver was taken.

## Gates (local, on head of this branch)

| Gate | Result |
| --- | --- |
| `npm test` | PASS — 1986/1986 |
| `node scripts/check-chars.mjs` | PASS |
| `npm run seo` | PASS |
| `npm run format:check` | PASS |
| `npm run deploy:check` | PASS |
| `npm run plan:check` | PASS |
