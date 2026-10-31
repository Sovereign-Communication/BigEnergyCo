// Report the character CODES around "d" in the two inserted conditions, so no
// escaping layer can make one backslash look like two.
import { readFileSync } from "node:fs";

const src = readFileSync("C:/tmp/world-fix/scripts/smoke/gridtie.js", "utf8");
for (const key of ["worth about", "spread here is", "innerText.replace"]) {
  for (const line of src.split(/\r?\n/)) {
    if (!line.includes(key)) continue;
    const idx = line.search(/d\/\.test\(outcome\)|s\+\/g/);
    if (idx < 0) continue;
    const codes = [];
    for (let i = idx - 3; i <= idx + 1; i++) codes.push(line.charCodeAt(i));
    console.log(
      `${key}: codes around the token = [${codes.join(", ")}]  (92 = one backslash)`,
    );
    break;
  }
}
