import { readFileSync, writeFileSync } from "node:fs";

const gate = "C:/tmp/be-usecase-20261028/scripts/check-usecases.mjs";
const fragmentPath = "C:/tmp/_uc_clause6b.txt";

const anchor = "// ── 7. every verdict reason key is translated";
const raw = readFileSync(gate, "utf8");
const frag = readFileSync(fragmentPath, "utf8");

if (raw.includes("clause 6b")) {
  console.error("ABORT: clause 6b already present");
  process.exit(1);
}
if (!raw.includes(anchor)) {
  console.error(`ABORT: anchor not found: ${anchor}`);
  process.exit(1);
}
if (raw.split(anchor).length - 1 !== 1) {
  console.error("ABORT: anchor is not unique");
  process.exit(1);
}

// Preserve the file's own line endings: this file is pure CRLF.
const toCrlf = (s) => s.replace(/\r\n/g, "\n").split("\n").join("\r\n");
const block = toCrlf(frag).replace(/\s+$/, "") + "\r\n\r\n";

const next = raw.replace(anchor, block + anchor);
writeFileSync(gate, next, "utf8");

const check = readFileSync(gate, "utf8");
console.log("clause 6b inserted:", check.includes("clause 6b"));
console.log("bare LF remaining:", (check.match(/(?<!\r)\n/g) || []).length);
console.log("anchor still unique:", check.split(anchor).length - 1 === 1);
