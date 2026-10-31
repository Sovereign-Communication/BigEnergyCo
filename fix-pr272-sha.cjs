const cp = require('node:child_process');
const fs = require('node:fs');
const p = 'docs/plan/LEDGER.jsonl';
const text = fs.readFileSync(p, 'utf8');
const lines = text.split(/\r?\n/);
for (let i = 0; i < lines.length; i++) {
  if (!lines[i]) continue;
  const row = JSON.parse(lines[i]);
  if (row.evidence?.pr === 272 && row.evidence.scope === 'i18n DOM writes only') row.evidence.sha = cp.execFileSync('git', ['rev-parse', '122ec82b'], { encoding: 'utf8' }).trim();
  if (row.evidence?.pr === 272 && row.evidence.scope === 'asset graph cache tokens') row.evidence.sha = cp.execFileSync('git', ['rev-parse', 'a468c12f'], { encoding: 'utf8' }).trim();
  lines[i] = JSON.stringify(row);
}
fs.writeFileSync(p, lines.join('\n'));
