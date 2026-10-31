const fs=require('fs'),path=require('path');
for(const d of fs.readdirSync('blog',{withFileTypes:true}).filter(d=>d.isDirectory()&&d.name!=='assets')){
 const h=fs.readFileSync(path.join('blog',d.name,'index.html'),'utf8');const s=h.match(/<style\b[^>]*>([\s\S]*?)<\/style>/i)?.[1]||'';
 console.log(d.name, Buffer.byteLength(s), s.split('\n').length);
}
