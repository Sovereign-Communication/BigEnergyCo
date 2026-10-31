const fs = require('fs');
const path = require('path');
const blog = path.resolve('blog');
const canonical = fs.readFileSync(path.join(blog, 'is-a-home-battery-worth-it', 'index.html'), 'utf8');
const canonicalBlocks = [...canonical.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)];
if (canonicalBlocks.length !== 1) throw new Error('expected exactly one canonical style block');
let changed = 0;
for (const entry of fs.readdirSync(blog, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === 'assets') continue;
  const file = path.join(blog, entry.name, 'index.html');
  const html = fs.readFileSync(file, 'utf8');
  const blocks = [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)];
  if (blocks.length !== 1) throw new Error(`${entry.name}: expected one style block, found ${blocks.length}`);
  if (blocks[0][0] === canonicalBlocks[0][0]) continue;
  fs.writeFileSync(file, html.replace(blocks[0][0], canonicalBlocks[0][0]));
  changed += 1;
}
console.log(`canonicalized ${changed} blog style blocks`);
