import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
const files = execSync("git diff --name-only --diff-filter=U", { encoding: "utf8" }).trim().split("\n").filter(Boolean);
const stamp = /\?v=\d{8}[a-z]?/g;
let auto = 0; const manual = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const out = [];
  const lines = text.split("\n");
  let i = 0, changed = false;
  while (i < lines.length) {
    if (lines[i].startsWith("<<<<<<<")) {
      const mid = lines.indexOf("=======", i);
      const end = lines.indexOf(">>>>>>>", mid);
      const ours = lines.slice(i + 1, mid);
      const theirs = lines.slice(mid + 1, end);
      const norm = (arr) => arr.map((l) => l.replace(stamp, "?v=STAMP")).join("\n");
      if (norm(ours) === norm(theirs)) { out.push(...theirs); auto++; changed = true; }
      else { manual.push({ file, ours, theirs }); out.push(...ours, "/*MANUAL-CONFLICT*/"); changed = true; }
      i = end + 1;
      continue;
    }
    out.push(lines[i]); i++;
  }
  if (changed) {
    // keep manual markers out of the file until resolved; write a sidecar instead
    const cleaned = out.filter((l) => l !== "/*MANUAL-CONFLICT*/");
    writeFileSync(file, cleaned.join("\n"));
  }
}
console.log(JSON.stringify({ autoResolved: auto, manualCount: manual.length }, null, 1));
writeFileSync("C:/tmp/manual-conflicts.json", JSON.stringify(manual, null, 2));
