import fs from "node:fs";
const path = "C:/tmp/beco-p95-battery-bank-20261022/blog/off-grid-battery-bank-sizing/index.html";
let html = fs.readFileSync(path, "utf8");
const replaceRange = (value, startMarker, endMarker, replacement, label) => {
  const start = value.indexOf(startMarker);
  const end = value.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`${label}: section boundaries missing`);
  return value.slice(0, start) + replacement + value.slice(end);
};
html = html.replace(
  "A daily kWh total does not show the timing or peak power of the loads.",
  "A daily kWh total does not show load timing or peak power. Before comparing quotes, record usable capacity, power, compatibility, operating limits, warranty, and all installed work.",
);
html = replaceRange(
  html,
  "        <h2>Compare more than nominal kWh</h2>",
  "        <h2>Safety and local installation rules</h2>",
  "",
  "quote comparison",
);
html = replaceRange(
  html,
  "        <h2>Safety and local installation rules</h2>",
  '        <div class="cta-box">',
  `        <h2>Safety and local installation rules</h2>
        <p>
          Do not use an article to choose a fuse, breaker, wire size, spacing,
          or bank layout. These depend on exact products and local code. In the
          United States, <a href="https://www.nfpa.org/codes-and-standards/nfpa-standard-development/855">NFPA 855</a>
          covers stationary energy storage installation; the local authority
          decides which rules apply. <a href="https://www.ul.com/resources/installation-codes-and-requirements-energy-storage-systems-ess-faqs">UL summarizes code-specific fire testing</a>.
          Use equipment approved for its intended location and have a qualified
          local professional review the design before it is energized.
        </p>

`,
  "safety copy",
);
html = html.replace(
  /        <h2>Related guides<\/h2>[\s\S]*?        <\/ul>/,
  `        <h2>Related guides</h2>
        <ul>
          <li><a href="../what-size-solar-system-for-off-grid/">Off-grid solar sizing</a></li>
          <li><a href="../is-a-home-battery-worth-it/">Is a home battery worth it?</a></li>
          <li><a href="../battery-longevity-and-dod-reference/">Battery longevity and depth of discharge</a></li>
        </ul>`,
);
const faq = [
  {name:"How many kWh of battery do I need for a 10 kWh/day home?", text:"There is no universal size from daily kWh alone. Define required loads and backup duration, then model generation, usable capacity, losses, power limits, and reserve settings over time."},
  {name:"How do I convert battery kWh to amp-hours?", text:"Nominal kWh ≈ nominal volts × nameplate Ah ÷ 1,000. For design, use the manufacturer's usable kWh and discharge limits."},
  {name:"Is 48 V always better than 12 V or 24 V?", text:"No. Match battery, inverter, controller, and charger voltages. Higher voltage usually lowers current for the same power, but equipment limits and local code decide."},
  {name:"Can I connect batteries in series or parallel?", text:"Only when the manufacturer permits the exact models and arrangement. Follow its BMS, current, and protection instructions."},
];
const faqHtml = `        <h2>Frequently asked</h2>
${faq.map(({name,text})=>`        <details>\n          <summary>${name}</summary>\n          <p>${text}</p>\n        </details>`).join("\n")}
`;
html = replaceRange(html, "        <h2>Frequently asked</h2>", "      </article>", faqHtml, "visible FAQs");
const schemaMatch = html.match(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/);
if (!schemaMatch) throw new Error("article JSON-LD missing");
const data = JSON.parse(schemaMatch[2]);
const faqSchema = data["@graph"].find((item)=>item["@type"]==="FAQPage");
if (!faqSchema) throw new Error("FAQ schema missing");
faqSchema.mainEntity = faq.map(({name,text})=>({"@type":"Question",name,acceptedAnswer:{"@type":"Answer",text}}));
const formatted = JSON.stringify(data,null,2).split("\n").map((line)=>`        ${line}`).join("\n");
html = html.replace(schemaMatch[0],`${schemaMatch[1]}\n${formatted}\n      ${schemaMatch[3]}`);
fs.writeFileSync(path, html, "utf8");