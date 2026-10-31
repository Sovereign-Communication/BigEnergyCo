import fs from "node:fs";
const path = "tests/blog-solar-bill-claims.test.mjs";
let source = fs.readFileSync(path, "utf8");
source = source.replace('  assert.ok(card.includes(post.description));', '  const excerpt = card.match(/<p class="card-excerpt">([\\s\\S]*?)<\\/p>/);\n  assert.ok(excerpt);\n  assert.equal(normalizeText(excerpt[1]), post.description);');
fs.writeFileSync(path, source, "utf8");
