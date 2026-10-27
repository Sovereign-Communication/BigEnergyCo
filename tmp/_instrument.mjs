import fs from 'node:fs';

let s = fs.readFileSync('tests/jev-facets.test.mjs', 'utf8');
s = s.replace(
  '  for (const note of merged.notes) {',
  '  console.log("TEXTLEN", text.length, "BUDGET", stateTextBudget(axes), "HEADROOM", stateTextBudget(axes) - text.length);\n' +
    '  for (const note of merged.notes) {',
);
fs.writeFileSync('tmp/_transport-instrumented.test.mjs', s);
console.log('written');
