import fs from 'node:fs';
const ev = JSON.parse(fs.readFileSync('evidence/advisor-and-release.json', 'utf8'));
const notes = ev.notes || [];
console.log('notes:', notes.length);
notes.forEach((n, i) => console.log(String(i).padStart(2), String(n.length).padStart(5), n.slice(0, 90).replace(/\n/g, ' ')));
console.log('notes total chars:', notes.reduce((s, n) => s + n.length + 3, 0));
for (const k of ['tests_summary', 'ci_summary', 'smoke_note', 'seo_summary', 'advisor_audit']) {
  console.log(k, (ev[k] || '').length);
}
console.log('facet_evidence keys:', Object.keys(ev.facet_evidence || {}).length);
for (const [k, v] of Object.entries(ev.facet_evidence || {})) console.log('  ', k, String(v).length);
