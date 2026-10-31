## Summary

Updates the two GitHub Actions used by the test and Cloudflare Pages deploy workflows.

This is P0.4 workflow/evidence infrastructure. The PR is rebased onto current main and deliberately keeps the TypeScript 5 toolchain compatible with the optional `tsconfck` peer dependency.

## Verification

- `npm test`
- `node scripts/check-chars.mjs`
- `npm run seo`
- `npm run format:check`
- `npm run deploy:check`
- `npm run plan:check`

Current rebased change: `cloudflare/wrangler-action` v3 to v4 and `actions/download-artifact` v7 to v8.
