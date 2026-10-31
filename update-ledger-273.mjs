import { readFileSync, writeFileSync } from "node:fs";
const path = "docs/plan/LEDGER.jsonl";
const raw = readFileSync(path, "utf8");
const parts = raw.split(/(\r?\n)/);
let changed = 0;
for (let i = 0; i < parts.length; i += 2) {
  if (!parts[i]) continue;
  const row = JSON.parse(parts[i]);
  if (row.evidence?.pr === 273 && row.evidence.full_test === "npm test 1732/1732") {
    parts[i] = parts[i].replace("\"full_test\":\"npm test 1732/1732\"", "\"full_test\":\"npm test 1741/1741\"");
    changed++;
  }
}
if (changed !== 1) throw new Error(`Expected one PR #273 full_test row, updated ${changed}`);
writeFileSync(path, parts.join(""));
console.log(`Updated ${changed} PR #273 ledger measurement`);