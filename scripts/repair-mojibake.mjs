// One-shot repair: reverses UTF-8 → cp1252 mis-decode ("â€”" -> "—") caused
// by PowerShell Get-Content|Set-Content on UTF-8 files. Sequence-validated:
// a run of mappable chars is only rewritten when its re-encoded bytes form
// VALID UTF-8; otherwise the original chars are kept. Multi-pass handles
// doubly-corrupted layers. Idempotent.
import { readFileSync, writeFileSync } from "node:fs";

const CP1252_HIGH = {
  0x80: "\u20AC",
  0x82: "\u201A",
  0x83: "\u0192",
  0x84: "\u201E",
  0x85: "\u2026",
  0x86: "\u2020",
  0x87: "\u2021",
  0x88: "\u02C6",
  0x89: "\u2030",
  0x8a: "\u0160",
  0x8b: "\u2039",
  0x8c: "\u0152",
  0x8e: "\u017D",
  0x91: "\u2018",
  0x92: "\u2019",
  0x93: "\u201C",
  0x94: "\u201D",
  0x95: "\u2022",
  0x96: "\u2013",
  0x97: "\u2014",
  0x98: "\u02DC",
  0x99: "\u2122",
  0x9a: "\u0161",
  0x9b: "\u203A",
  0x9c: "\u0153",
  0x9e: "\u017E",
  0x9f: "\u0178",
};
const CHAR_TO_BYTE = new Map();
for (let b = 0x00; b <= 0xff; b++) {
  const ch = CP1252_HIGH[b] ?? String.fromCharCode(b);
  CHAR_TO_BYTE.set(ch, b);
}
const decoder = new TextDecoder("utf-8", { fatal: true });

function repairOnce(text) {
  let out = "";
  let run = "";
  let changed = false;

  function flush() {
    if (!run) return;
    try {
      const bytes = Uint8Array.from([...run].map((ch) => CHAR_TO_BYTE.get(ch)));
      const decoded = decoder.decode(bytes);
      out += decoded;
      changed = true;
    } catch {
      out += run; // not a valid mojibake sequence — keep as-is
    }
    run = "";
  }

  for (const ch of text) {
    if (CHAR_TO_BYTE.has(ch)) run += ch;
    else {
      flush();
      out += ch;
    }
  }
  flush();
  return { text: out, changed };
}

const SUSPICIOUS =
  /\u00e2\u20ac|\u00c3.|\u00f0\u0178|\u00c2[\s\u00b0\u00b7]|\uFFFD|\u00e2\u2030|\u00e2\u2321/;

for (const file of process.argv.slice(2)) {
  let text = readFileSync(file, "utf8");
  if (!SUSPICIOUS.test(text)) {
    console.log(`clean            ${file}`);
    continue;
  }
  for (let pass = 0; pass < 6; pass++) {
    const r = repairOnce(text);
    text = r.text;
    if (!r.changed) break;
  }
  if (SUSPICIOUS.test(text)) {
    console.error(`STILL SUSPICIOUS after repair: ${file}`);
    const m = text.match(new RegExp(SUSPICIOUS.source + "[^\\s]{0,10}", "g"));
    console.error("  residuals:", JSON.stringify(m && m.slice(0, 5)));
    process.exitCode = 1;
  } else {
    console.log(`repaired         ${file}`);
  }
  writeFileSync(file, text);
}
