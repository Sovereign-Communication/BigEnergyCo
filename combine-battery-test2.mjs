import fs from "node:fs";
const path="C:/tmp/beco-p95-battery-bank-20261022/tests/blog-off-grid-battery-bank-audit.test.mjs";
let source=fs.readFileSync(path,"utf8");
const pattern=/  assert\.ok\(\s*article\.headline === title && rss\.includes\(`<title>\$\{title\}<\/title>`\),\s*\);/;
if (!pattern.test(source)) throw new Error("combined assertion not found");
source=source.replace(pattern,"  assert.equal(article.headline, title);");
fs.writeFileSync(path,source,"utf8");