const fs=require("node:fs");
const p="blog/index.html";
let s=fs.readFileSync(p,"utf8");
const old='"description": "Hawaii DCCA warned about reported misleading door-to-door solar claims. Check business records, verify program offers, and find official cancellation guidance.,';
const next='"description": "Hawaii DCCA warned about reported misleading door-to-door solar claims. Check business records, verify program offers, and find official cancellation guidance.",';
if(s.split(old).length!==2) throw new Error("listing JSON description target missing or duplicated");
s=s.replace(old,next);
for (const f of [p,"blog/hawaii-solar-scams-2026-warning/index.html"]) {
  let text=f===p?s:fs.readFileSync(f,"utf8");
  text=text.replace(/\r?\n/g,"\r\n");
  fs.writeFileSync(f,text);
}
console.log("Fixed listing JSON-LD and normalized both edited HTML files to CRLF.");
