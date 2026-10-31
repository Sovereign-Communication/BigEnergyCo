const fs = require('fs'); const path = require('path');
const slug = process.argv[2];
const html = fs.readFileSync(path.join('blog', slug, 'index.html'), 'utf8');
const content = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
const text = content.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<(h[1-6]|p|li|tr|td|blockquote)\b[^>]*>/gi, '\n').replace(/<\/(h[1-6]|p|li|tr|td|blockquote)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#(d+);/g, (_,n)=>String.fromCodePoint(+n)).replace(/&[a-zA-Z]+;/g, ' ');
console.log(text.split(/\n+/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean).join('\n'));
