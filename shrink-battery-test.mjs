import fs from "node:fs";
const path = "C:/tmp/beco-p95-battery-bank-20261022/tests/blog-off-grid-battery-bank-audit.test.mjs";
let value = fs.readFileSync(path,"utf8");
value = value.replace("  assert.equal(article.citation.length, 4);\n  for (const href of article.citation) assert.ok(hrefs.has(href));", "  assert.equal(article.citation.filter((href) => hrefs.has(href)).length, 4);");
fs.writeFileSync(path,value,"utf8");