## Scope

P9.5, shared blog formatting only.

- Normalize all 13 article pages to the canonical inline `<style>` block from `blog/is-a-home-battery-worth-it/index.html`.
- Add a regression test that compares every article block byte-for-byte with the canonical block.
- Record that source audits and visible review dates remain outstanding; this change does not mark P9.5 complete.

## Validation

- `npm test`: 1,724/1,724
- `node scripts/check-chars.mjs`
- `npm run seo`
- `npm run format:check`
- `npm run deploy:check`
- `npm run plan:check`
