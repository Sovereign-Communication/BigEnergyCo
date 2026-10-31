const fs=require("node:fs");
const oldArticle="Hawaii DCCA warned about reported misleading door-to-door solar claims. Learn how to verify a pitch, check business records, and find official cancellation guidance.";
const oldListing="Hawaii DCCA warned about reported misleading door-to-door solar claims. Check business records, verify program offers, and find official cancellation guidance.";
const next="Hawaii DCCA warned of misleading door-to-door solar claims. Check business records, verify offers, and find official cancellation guidance.";
for (const f of ["blog/hawaii-solar-scams-2026-warning/index.html","blog/index.html"]) {
  let s=fs.readFileSync(f,"utf8");
  const old=f.includes("hawaii-solar-scams-2026-warning")?oldArticle:oldListing;
  const n=s.split(old).length-1;
  if(n===0) throw new Error("description missing in "+f);
  fs.writeFileSync(f,s.split(old).join(next));
  console.log(f+": updated "+n+" descriptions");
}
