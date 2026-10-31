import fs from "node:fs";
const path = "C:/tmp/beco-p95-battery-bank-20261022/blog/off-grid-battery-bank-sizing/index.html";
let html = fs.readFileSync(path, "utf8");
html = html.replace(
  /the plan\. A daily kWh total does not show the timing or peak power of\s+the loads\./,
  "the plan. Daily energy hides timing and peak power.",
);
html = html.replace(/An annual energy average cannot establish how a bank performs through a low-sun\s+period\./, "");
html = html.replace(
  /<div class="cta-box">[\s\S]*?<a class="btn" href="\.\.\/\.\.\/#sizing">Run free simulation<\/a>\s*<\/div>/,
  '<div class="cta-box">\n          <a class="btn" href="../../#sizing">Run free simulation</a>\n        </div>',
);
fs.writeFileSync(path, html, "utf8");