import { readFileSync, writeFileSync } from "node:fs";
const stamp = /\?v=\d{8}[a-z]?/g;
const files = ["assets/js/sizing/bom.js","assets/js/sizing/engine.js","assets/js/sizing/run.js","sw.js","assets/js/sizing/ui.js"];
for (const f of files) {
  const lines = readFileSync(f, "utf8").split(/\r?\n/);
  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim().startsWith("<<<<<<<")) {
      let mid = -1, end = -1;
      for (let j = i + 1; j < lines.length; j++) { if (mid === -1 && lines[j].trim() === "=======") mid = j; else if (mid !== -1 && lines[j].trim().startsWith(">>>>>>>")) { end = j; break; } }
      const ours = lines.slice(i + 1, mid).map((l) => l.replace(stamp, "?v=20261023d"));
      out.push(...ours);
      i = end + 1;
      continue;
    }
    out.push(lines[i]); i++;
  }
  writeFileSync(f, out.join("\n"));
  console.log("resolved", f);
}
