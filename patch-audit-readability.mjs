// Small readability fix: prettier wrapped the rev-list call awkwardly, so give
// the git call its own name. CRLF is preserved.
import { readFileSync, writeFileSync } from "node:fs";

const path = "C:/tmp/fix-main-audit/scripts/lib/release.mjs";
const raw = readFileSync(path, "utf8");
const hadCrlf = raw.includes("\r\n");
let text = raw.replace(/\r\n/g, "\n");

const oldText = `    const [first, ...side] = parents;
    for (const rev of git(["rev-list", ...side, "--not", first], cwd).split(
      "\\n",
    )) {
      const trimmed = rev.trim();
      if (trimmed) delivered.add(trimmed);
    }`;
const newText = `    const [first, ...others] = parents;
    const pulled = git(["rev-list", ...others, "--not", first], cwd);
    for (const rev of pulled.split("\\n")) {
      const trimmed = rev.trim();
      if (trimmed) delivered.add(trimmed);
    }`;

const hits = text.split(oldText).length - 1;
if (hits !== 1) throw new Error(`anchor matched ${hits} times, expected 1`);
text = text.replace(oldText, newText);
writeFileSync(path, text.replace(/\n/g, hadCrlf ? "\r\n" : "\n"), "utf8");
console.log("readability patch applied");
