const fs=require("node:fs");
const p="blog/index.html"; let s=fs.readFileSync(p,"utf8");
const re=/<p class="card-excerpt">\s*Hawaii DCCA warned about reported misleading door-to-door\s*solar claims\. Check business records, verify program offers,\s*and find official cancellation guidance\.\s*<\/p>/;
if(!re.test(s)) throw new Error("visible card excerpt target not found");
s=s.replace(re,'<p class="card-excerpt">\n              Hawaii DCCA warned of misleading door-to-door solar claims.\n              Check business records, verify offers, and find official\n              cancellation guidance.\n            </p>');
s=s.replace(/\r?\n/g,"\r\n"); fs.writeFileSync(p,s);
