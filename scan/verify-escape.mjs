// Read the inserted gate conditions straight out of the file, evaluate them as
// regexes, and prove each one fails on the string it exists to catch and passes
// on the fixed one. This is a read of the actual characters, so no shell layer
// can hide an escaping mistake.
import { readFileSync } from "node:fs";

const src = readFileSync(
  "C:/tmp/world-fix/scripts/smoke/gridtie.js",
  "utf8",
);
const lines = src.split(/\r?\n/);
const money = lines.find((l) => l.includes("worth about") && l.includes(".test(outcome)"));
const spread = lines.find((l) => l.includes("spread here is") && l.includes(".test(outcome)"));
console.log("money line  :", JSON.stringify(money));
console.log("spread line :", JSON.stringify(spread));

for (const [line, bare, formatted] of [
  [money, "INE (worth about 9720 over 20 years against a 4100 battery)", "x (worth about $9,720.00 over 20 years against a $4,100.00 battery)"],
  [spread, "spread here is 0.18 per kWh.", "spread here is $0.18 per kWh."],
]) {
  const [reLiteral] = line.match(/\/[^/]*\/(?=\.test\(outcome\))/);
  const re = eval(reLiteral); // eslint-disable-line no-eval
  console.log(`\n${reLiteral} -> does it CATCH the shipped text? ${re.test(bare)}`);
  console.log(`   -> does it pass the fixed text?          ${!re.test(formatted)}`);
}
