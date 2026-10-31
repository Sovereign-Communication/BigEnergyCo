import fs from "node:fs";
const path = "C:/tmp/beco-p95-battery-bank-20261022/tests/blog-off-grid-battery-bank-audit.test.mjs";
let source = fs.readFileSync(path, "utf8");
const before = String.raw`/off-grid-battery-bank-sizing\/><\/loc>\s*<lastmod>2026-10-22/, `;
const after = String.raw`/off-grid-battery-bank-sizing\/<\/loc>\s*<lastmod>2026-10-22/,`;
if (!source.includes(before)) throw new Error("sitemap assertion pattern not found");
source = source.replace(before, after);
fs.writeFileSync(path, source, "utf8");