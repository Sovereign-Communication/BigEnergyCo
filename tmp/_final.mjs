// Final candidate translation lines — count exactly, then lock.
const real =
  '7 locales x3 re-entry: keys 0/22, JS 42/42, DOM 2982/2982=dict. ' +
  'Parity+ph: check-i18n.mjs. ' +
  'Intl N/C/D, plurals. ' +
  'RTL ar; check-chars.mjs. ' +
  'Back-read 436x6 (AI): 23 fixes. ' +
  'Gloss 56/56. Figs 12/12. ' +
  'Fix link: no send. ' +
  'Gaps: native review, F-42, engine.';
const fixture =
  '7 locales x3 re-entry: keys 0/22, JS 84/84, DOM 0/0=dict. ' +
  'Parity+ph: check-i18n.mjs. ' +
  'Intl N/C/D, plurals. ' +
  'RTL ar; check-chars.mjs. ' +
  'Back-read 436x6 (AI): 23 fixes. ' +
  'Gloss/Figs unmeasured. ' +
  'Fix link unverified. ' +
  'Gaps: native review, F-42, engine.';
const alt = real
  .replace('Parity+ph: check-i18n.mjs. ', 'Parity+ph check-i18n.mjs. ')
  .replace(/engine\.$/, 'engine EN.');
console.log('real   ', real.length, real);
console.log('fixture', fixture.length);
console.log('alt    ', alt.length, alt);
