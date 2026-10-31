import { readFileSync, writeFileSync } from "node:fs";
const p = "C:/tmp/gate-scope/.drift-pins-demo.mjs";
let s = readFileSync(p, "utf8");

const d6 = `// D6 — the city matcher goes back to the flat-only form (the dead shape).
plant(
  "scripts/lib/quality-matrix.mjs",
  (s) => {
    const lines = s.split("\\n");
    const i = lines.findIndex((l) => l.includes("solar-calculator/[^/]+/index.html$"));
    if (i < 0) throw new Error("city matcher line not found");
    lines[i] = "      /^$/.test(p),";
    return lines.join("\\n");
  },
  () => tests("tests/lighthouse-gate.test.mjs"),
  "city shape must be derivable",
);

`;

const d9 = `// D9 — the hub is absorbed into the city shape, which does have a target
// (coverage moved, the recorded exception did not).
plant(
  "scripts/lib/quality-matrix.mjs",
  (s) => {
    const lines = s.split("\\n");
    const i = lines.findIndex((l) => l.includes("solar-calculator/[^/]+/index.html$"));
    if (i < 0) throw new Error("city matcher line not found");
    lines[i] = lines[i].replace(/,\\s*$/, ' || p === "solar-calculator/index.html",');
    return lines.join("\\n");
  },
  () => tests("tests/lighthouse-gate.test.mjs"),
  "set of pages no shape owns changed",
);

`;

const d6start = s.indexOf("// D6");
const d7 = s.indexOf("// D7");
const d9start = s.indexOf("// D9");
const tail = s.indexOf("// After all plants");
if (d6start < 0 || d7 < 0 || d9start < 0 || tail < 0)
  throw new Error("harness markers missing");

s = s.slice(0, d6start) + d6 + s.slice(d7);
// indices shifted: recompute for D9
const d9start2 = s.indexOf("// D9");
const tail2 = s.indexOf("// After all plants");
s = s.slice(0, d9start2) + d9 + s.slice(tail2);
writeFileSync(p, s);
console.log("harness patched; bytes:", s.length);
