import { readFileSync, writeFileSync } from 'node:fs';
const FILE = 'assets/js/shared/locales.js';
const KEYS = ['oversizeCheaper', 'swapsCheaper', 'swapsNatural'];
let src = readFileSync(FILE, 'utf8');
let removed = 0;
for (const key of KEYS) {
  const re = new RegExp(`^    ${key}: [^\n]*\n`, 'gm');
  const matches = src.match(re) || [];
  if (matches.length !== 7) {
    console.error(`${key}: expected 7 locale entries, found ${matches.length}`);
    process.exit(1);
  }
  src = src.replace(re, '');
  removed += matches.length;
}
writeFileSync(FILE, src);
console.log('removed', removed, 'entries');
