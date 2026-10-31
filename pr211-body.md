## Root cause

`deploy-manifest.test.mjs` already takes the cross-process mutation lock while deleting `robots.txt`. `deploy-blobs.test.mjs` also edits `robots.txt` but did not take that lock, so Node's parallel test-file execution could make the staging test read the file during the other test's deletion. I reproduced the resulting `ENOENT` in a fresh Windows worktree.

## Change

- Serialize the blob-staging mutation with the same root-scoped lock.
- Restore the deletion test's original working-tree bytes, preserving CRLF checkouts.
- Compare staged bytes to the committed Git blob, so LF staging remains correct under `core.autocrlf=true`.

## Validation

- `npm test`: 1,708/1,708 passed.
- The two affected test files passed together: 20/20.
- `node scripts/check-chars.mjs`, `npm run seo`, `npm run format:check`, `npm run deploy:check`, `npm run plan:check`, `npm run gate:byte-budgets`, and Prettier 3.9.6 passed.

Fixes #211.
