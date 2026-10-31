const fs=require('fs'),path=require('path');
for(const slug of ['diy-vs-prebuilt-sodium-ion-lifepo4-battery-storage','battery-longevity-and-dod-reference','hawaii-solar-scams-2026-warning']){const h=fs.readFileSync(path.join('blog',slug,'index.html'),'utf8');const s=h.match(/<style\b[^>]*>([\s\S]*?)<\/style>/i)?.[1]||'';fs.writeFileSync(`C:/tmp/${slug}.css`,s)}
