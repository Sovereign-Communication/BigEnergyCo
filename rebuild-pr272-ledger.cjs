const cp = require('node:child_process');
const fs = require('node:fs');
const p = 'docs/plan/LEDGER.jsonl';
const base = cp.execFileSync('git', ['show', 'origin/main:' + p]);
const codeSha = cp.execFileSync('git', ['rev-parse', '122ec82b'], { encoding: 'utf8' }).trim();
const tokenSha = cp.execFileSync('git', ['rev-parse', 'a468c12f'], { encoding: 'utf8' }).trim();
const preflight = ['npm test', 'node scripts/check-chars.mjs', 'npm run seo', 'npm run format:check', 'npm run deploy:check', 'npm run plan:check'];
const rows = [
  { ts: '2026-10-22', kind: 'note', ref: 'P0.4', summary: 'PR #272 extracts the i18n compare-before-write intent from the mixed #171 branch. applyI18n now skips textContent, placeholder, and aria-label setters when the translated value is unchanged; a focused DOM mock test proves a repeated locale application is a no-op and a language change still updates all three surfaces.', evidence: { pr: 272, sha: codeSha, scope: 'i18n DOM writes only', source_pr: 171, test: 'tests/i18n-noop-apply.test.mjs; 1/1; related i18n checks 17/17', full_test: 'npm test 1732/1732', preflight } },
  { ts: '2026-10-22', kind: 'note', ref: 'P0.4', summary: 'PR #272 follows the i18n compare-before-write change with the required immutable asset-token refresh: 20261022h to 20261022i and service-worker cache beco-v133 to beco-v134. The refresh changes cache keys only; no runtime behavior changed.', evidence: { pr: 272, sha: tokenSha, scope: 'asset graph cache tokens', focused_test: 'node scripts/bump-asset-tokens.mjs; 16 graph files refreshed', preflight } }
];
const suffixText = rows.map(x => JSON.stringify(x)).join('\n') + '\n';
const suffix = Buffer.from((base.length && base[base.length - 1] === 10 ? '' : '\n') + suffixText, 'utf8');
fs.writeFileSync(p, Buffer.concat([base, suffix]));
