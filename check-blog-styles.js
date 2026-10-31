const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dirs = fs.readdirSync('blog', { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== 'assets');
const out = dirs.map(d => {
  const html = fs.readFileSync(path.join('blog', d.name, 'index.html'), 'utf8');
  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]);
  return { slug: d.name, styleCount: styles.length, hash: styles.length ? crypto.createHash('sha256').update(styles[0]).digest('hex') : null };
});
console.log(JSON.stringify(out));
