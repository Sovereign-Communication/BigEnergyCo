// Inspect and, if needed, fix the regex escaping of the smoke gates I inserted.
import { readFileSync, writeFileSync } from "node:fs";

const path = "C:/tmp/world-fix/scripts/smoke/gridtie.js";
let s = readFileSync(path, "utf8");
const show = (re) => console.log(JSON.stringify(s.match(re)[0]));

show(/worth about.{0,24}/);
show(/spread here is.{0,24}/);
show(/innerText\.replace.{0,24}/);

// The host-side regexes must be \d (one backslash in the file); the in-page
// string, which is inside a template literal, must keep \\s (two).
const fixes = [
  ["/worth about \\\\d/", "/worth about \\d/"],
  ["/spread here is \\\\d/", "/spread here is \\d/"],
];
for (const [from, to] of fixes) {
  const n = s.split(from).length - 1;
  console.log(`"${from}" occurrences: ${n}`);
  if (n === 1) s = s.replace(from, to);
}
writeFileSync(path, s);
show(/worth about.{0,24}/);
show(/spread here is.{0,24}/);
show(/innerText\.replace.{0,24}/);
