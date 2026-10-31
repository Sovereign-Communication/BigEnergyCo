import fs from "node:fs";
const path = "tests/blog-solar-bill-claims.test.mjs";
let test = fs.readFileSync(path, "utf8");
test = test.replace('assert.match(card, /<time datetime="2026-10-22">/);', 'assert.match(card, /<time datetime="2026-10-22"/);');
fs.writeFileSync(path, test, "utf8");
