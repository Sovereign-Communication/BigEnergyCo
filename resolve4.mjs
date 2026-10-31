import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
const files = execSync("git diff --name-only --diff-filter=U", { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
const stamp = /\?v=\d{8}[a-z]?/g;
const stats = [];
for (const file of files) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  const out = [];
  let i = 0, auto = 0, manual = 0;
  const isSep = (l) => l.trim() === "=======";
  const isEnd = (l) => l.trim().startsWith(">>>>>>>");
  const isStart = (l) => l.trim().startsWith("<<<<<<<");
  while (i < lines.length) {
    if (isStart(lines[i])) {
      let mid = -1, end = -1;
      for (let j = i + 1; j < lines.length; j++) { if (mid === -1 && isSep(lines[j])) mid = j; else if (mid !== -1 && isEnd(lines[j])) { end = j; break; } }
      if (mid === -1 || end === -1) { out.push(lines[i]); i++; continue; }
      const ours = lines.slice(i + 1, mid);
      const theirs = lines.slice(mid + 1, end);
      const norm = (arr) => arr.map((l) => l.replace(stamp, "?v=STAMP")).join("\n");
      if (norm(ours) === norm(theirs)) { out.push(...theirs); auto++; }
      else { out.push("<<<<<<< OURS", ...ours, "=======", ...theirs, ">>>>>>> MAIN"); manual++; }
      i = end + 1;
      continue;
    }
    out.push(lines[i]); i++;
  }
  writeFileSync(file, out.join("\n"));
  stats.push({ file, auto, manual });
}
console.log(JSON.stringify(stats.filter(s => s.auto || s.manual)));
console.log("MANUAL_TOTAL", stats.reduce((a, s) => a + s.manual, 0));
