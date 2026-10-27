// Candidate translation facet line shapes, measured precisely.
const shapes = {
  head_real_v1:
    '7 locales x 3 re-entry: raw keys 0/22, JS 42/42, DOM 2982/2982=dict. ',
  head_real_v2:
    '7 locales x3 re-entry: keys 0/22, JS 42/42, DOM 2982/2982=dict. ',
  head_real_v3:
    '7 locales x3 re-entry: raw keys 0/22, JS 42/42, DOM 2982/2982=dict. ',
  head_fix_v2: '7 locales x3 re-entry: keys 0/22, JS 84/84, DOM 0/0=dict. ',
  cl1: 'Parity+ph: check-i18n.mjs. ',
  cl2: 'Intl N/C/D, plurals. ',
  cl3: 'RTL ar; check-chars.mjs. ',
  cl4a: 'Back-read 436x6 (AI): 23 fixes. ',
  cl4b: 'Phrasing: back-read 436x6 (AI): 23 fixes. ',
  cl5a: 'Gloss 56/56. Figs 12/12. ',
  cl5b: 'Gloss/Figs unmeasured. ',
  cl6a: 'Fix link: no send. ',
  cl6b: 'Fix link unverified. ',
  cl7a: 'Gaps: native review, F-42, engine prose.',
  cl7b: 'Gaps: native review, F-42, engine EN.',
  cl7c: 'Gaps: native review, F-42, engine.',
};
for (const [k, v] of Object.entries(shapes)) console.log(k.padEnd(14), v.length);

const real = (head, cl4, cl7) =>
  [head, shapes.cl1, shapes.cl2, shapes.cl3, cl4, shapes.cl5a, shapes.cl6a, cl7].join('');
const fix = (head, cl4, cl7) =>
  [head, shapes.cl1, shapes.cl2, shapes.cl3, cl4, shapes.cl5b, shapes.cl6b, cl7].join('');

for (const [name, line] of [
  ['real v2+cl4a+cl7a', real(shapes.head_real_v2, shapes.cl4a, shapes.cl7a)],
  ['real v3+cl4a+cl7a', real(shapes.head_real_v3, shapes.cl4a, shapes.cl7a)],
  ['real v2+cl4b+cl7a', real(shapes.head_real_v2, shapes.cl4b, shapes.cl7a)],
  ['real v2+cl4a+cl7b', real(shapes.head_real_v2, shapes.cl4a, shapes.cl7b)],
  ['real v3+cl4a+cl7b', real(shapes.head_real_v3, shapes.cl4a, shapes.cl7b)],
  ['fix v2+cl4a+cl7b', fix(shapes.head_fix_v2, shapes.cl4a, shapes.cl7b)],
  ['fix v2+cl4a+cl7a', fix(shapes.head_fix_v2, shapes.cl4a, shapes.cl7a)],
]) {
  console.log(name.padEnd(20), line.length);
}
