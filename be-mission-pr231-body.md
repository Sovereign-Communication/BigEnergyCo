## Scope

P9.5 blog work for the Netherlands audience. This article is a country-specific editorial addition; it does not complete the full blog audit.

## Change

- Adds a Dutch article on the end of salderingsregeling, the 2027 transition, and household options, with an illustrative 10-panel example.
- Sources factual claims from Rijksoverheid and ACM ConsuWijzer.
- Adds the visible article card, BlogPosting JSON-LD, sitemap URL, `llms.txt` entry, and deploy-manifest path.
- Keeps the shared inline `<style>` block byte-identical. On the rebased tree, the inline-style count is 308 under the existing 318 cap.
- Records the D-14 Netherlands reacquisition work in the append-only plan ledger.

## Verification

Local required checks passed on the rebased candidate: `npm test` (1718/1718), `node scripts/check-chars.mjs`, `npm run seo`, `npm run format:check` (743 tracked files), `npm run deploy:check` (394 manifest files), and `npm run plan:check` (MASTER_PLAN SHA unchanged).

## Dutch locale launch status

The Dutch interface remains unlaunched. The P8.1 Q-12 comprehension probe has not been run, so this PR does not claim P11.1 completion or satisfy the P8.1 launch bar. PR #230 supplies the locale implementation; this PR adds editorial content only.
