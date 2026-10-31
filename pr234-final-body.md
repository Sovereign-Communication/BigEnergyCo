## Summary

Updates the two GitHub Actions used by CI evidence and the Cloudflare Pages deploy workflow:

- `cloudflare/wrangler-action` v3 to v4
- `actions/download-artifact` v7 to v8

Rebased onto current main at `1ee9a6f`. The dependency update is limited to the workflow actions; no application source, credentials, deployment target, or environment behavior changes.

## Verification

- `npm test` (1,720/1,720)
- `node scripts/check-chars.mjs`
- `npm run seo`
- `npm run format:check`
- `npm run deploy:check`
- `npm run plan:check`
