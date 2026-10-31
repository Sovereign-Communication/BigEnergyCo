import fs from "node:fs";
const path = "C:/tmp/beco-p95-battery-bank-20261022/blog/off-grid-battery-bank-sizing/index.html";
let html = fs.readFileSync(path, "utf8");
const faq = [
  {name:"How many kWh of battery do I need for a 10 kWh/day home?", text:"Define required loads, backup duration, recharge source, and allowed backup; test those conditions against the product's usable capacity and power limits."},
  {name:"How do I convert battery kWh to amp-hours?", text:"Nominal kWh ≈ nominal volts × nameplate Ah ÷ 1,000. Use stated usable kWh and current limits when planning a real system."},
  {name:"Is 48 V always better than 12 V or 24 V?", text:"No. Match all equipment. Higher voltage usually lowers current for the same power; model and local code determine a safe system."},
  {name:"Can I connect batteries in series or parallel?", text:"Only when the manufacturer permits the exact models and arrangement; follow its BMS and protection instructions."},
];
html = html.replace(
  /        <p>\s*<strong>Start with your own load profile\.<\/strong>[\s\S]*?<\/p>/,
  `          <p><strong>Run a free simulation.</strong> Check its result against product limits and local code.</p>`,
);
html = html.replace(
  /\s*<li>\s*<a href="\.\.\/battery-longevity-and-dod-reference\/"[\s\S]*?<\/li>/,
  "",
);
const faqHtml = `        <h2>Frequently asked</h2>
${faq.map(({name,text})=>`        <details>\n          <summary>${name}</summary>\n          <p>${text}</p>\n        </details>`).join("\n")}
`;
const faqStart = html.indexOf("        <h2>Frequently asked</h2>");
const articleEnd = html.indexOf("      </article>", faqStart);
if (faqStart < 0 || articleEnd < 0) throw new Error("FAQ section missing");
html = html.slice(0, faqStart) + faqHtml + html.slice(articleEnd);
const match = html.match(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/);
if (!match) throw new Error("JSON-LD missing");
const data = JSON.parse(match[2]);
const schema = data["@graph"].find((item)=>item["@type"]==="FAQPage");
if (!schema) throw new Error("FAQ schema missing");
schema.mainEntity = faq.map(({name,text})=>({"@type":"Question",name,acceptedAnswer:{"@type":"Answer",text}}));
const formatted = JSON.stringify(data,null,2).split("\n").map((line)=>`        ${line}`).join("\n");
html = html.replace(match[0],`${match[1]}\n${formatted}\n      ${match[3]}`);
fs.writeFileSync(path, html, "utf8");