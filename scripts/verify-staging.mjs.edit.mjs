import { readFileSync, writeFileSync } from 'fs';
const p = 'scripts/verify-staging.mjs';
let src = readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const needle =
`  let localBuf;
  try {
    localBuf = readFileSync(file);
  } catch (e) {
    return {
      file,
      state: "unreadable",
      detail: \`local read failed: ${e.code || e.message}\`,
    };
  }`;

const replacement =
`  // Read the COMMITTED blob for this path, not the working tree. The deploy
  // manifest enumerates from the git index, so every parityTarget is tracked;
  // reading the index blob means a dirty or half-checked-out working tree can
  // never make a faithful artifact look wrong (or a broken one look clean).
  let localBuf;
  try {
    localBuf = execFileSync("git", ["show", ":" + file], {
      cwd: ROOT,
      maxBuffer: 32 * 1024 * 1024,
      encoding: "buffer",
    });
  } catch (e) {
    return {
      file,
      state: "unreadable",
      detail: \`committed read failed: ${e.message}\`,
    };
  }`;

const idx = src.indexOf(needle);
console.log('found needle at', idx);
if (idx < 0) {
  console.log('needle NOT FOUND - dumping context around localBuf');
  const lb = src.indexOf('let localBuf;');
  console.log(src.slice(Math.max(0, lb - 200), lb + 250));
  process.exit(1);
}

src = src.slice(0, idx) + replacement + src.slice(idx + needle.length);
writeFileSync(p, src.replace(/\n/g, '\r\n'));
console.log('edit applied; verifying...');

const src2 = readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const idx2 = src2.indexOf('READ THE COMMITTED blob');
if (idx2 < 0) {
  console.log('VERIFICATION FAILED: replacement not found after write');
  process.exit(1);
}
console.log('VERIFIED: edited block now reads:');
console.log(src2.slice(idx2, idx2 + 480));
