// The two host-side gate conditions must read \d (a single backslash) in the
// file: they are regex literals in the smoke runner, not strings inside the
// page snippet. Written with String.raw so no layer can escape them for me.
import { readFileSync, writeFileSync } from "node:fs";

const path = "C:/tmp/world-fix/scripts/smoke/gridtie.js";
let s = readFileSync(path, "utf8");

const from1 = String.raw`!/worth about \\d/`;
const to1 = String.raw`!/worth about \d/`;
const from2 = String.raw`!/spread here is \\d/`;
const to2 = String.raw`!/spread here is \d/`;

for (const [from, to, label] of [
  [from1, to1, "money"],
  [from2, to2, "spread"],
]) {
  const n = s.split(from).length - 1;
  if (n !== 1) {
    console.error(`FAIL ${label}: ${n} occurrences of ${JSON.stringify(from)}`);
    process.exit(1);
  }
  s = s.replace(from, to);
  console.log(`OK   ${label}: ${JSON.stringify(from)} -> ${JSON.stringify(to)}`);
}
writeFileSync(path, s);

// Prove it by evaluating every regex literal on the two lines against the
// shipped text (must match) and the fixed text (must not).
const lines = s.split(/\r?\n/);
for (const [key, bare, fixed] of [
  [
    "worth about",
    "Works: the battery covers 62% of your peak-window energy, worth about 9720 over 20 years against a 4100 battery. Your peak-to-off-peak spread here is 0.18 per kWh.",
    "Works: the battery covers 62% of your peak-window energy, worth about $9,720.00 over 20 years against a $4,100.00 battery. Your peak-to-off-peak spread here is $0.18 per kWh.",
  ],
]) {
  const line = lines.find((l) => l.includes(key) && l.includes("test(outcome)"));
  console.log(`\nline: ${line.trim()}`);
  for (const lit of line.match(/\/[^/]*\/(?=\.test\(outcome\))/g)) {
    const re = eval(lit); // eslint-disable-line no-eval
    console.log(
      `  ${lit.padEnd(26)} catches shipped: ${re.test(bare)}   passes fixed: ${!re.test(fixed)}`,
    );
  }
}
