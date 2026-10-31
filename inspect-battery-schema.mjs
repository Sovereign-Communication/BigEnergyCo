import fs from "node:fs";
for (const file of ["C:/tmp/beco-p95-battery-bank-20261022/blog/off-grid-battery-bank-sizing/index.html", "C:/tmp/beco-p95-battery-bank-20261022/blog/index.html"]) {
  const html = fs.readFileSync(file, "utf8");
  const body = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  const data = JSON.parse(body);
  console.log(file, JSON.stringify({keys:Object.keys(data), rootType:data["@type"], graphLength:data["@graph"]?.length, graphTypes:data["@graph"]?.map((v)=>v["@type"])}));
}