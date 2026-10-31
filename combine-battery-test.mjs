import fs from "node:fs";
const path="C:/tmp/beco-p95-battery-bank-20261022/tests/blog-off-grid-battery-bank-audit.test.mjs";
let source=fs.readFileSync(path,"utf8");
source=source.replace("  assert.equal(article.headline, title);", "  assert.ok(article.headline === title && rss.includes(`<title>${title}</title>`));");
source=source.replace("  assert.ok(rss.includes(`<title>${title}</title>`));", "");
fs.writeFileSync(path,source,"utf8");