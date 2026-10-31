import fs from "node:fs";

const articlePath = process.argv[2];
const sitemapPath = process.argv[3];
let html = fs.readFileSync(articlePath, "utf8");
const eol = html.includes("\r\n") ? "\r\n" : "\n";

function replaceExact(text, replacement, label, expected = 1) {
  const count = html.split(text).length - 1;
  if (count !== expected) throw new Error(label + ": expected " + expected + " match(es), found " + count);
  html = html.split(text).join(replacement);
}

const oldDescription =
  "Compare DIY battery storage options for LiFePO4 and sodium-ion. Learn cost, safety, and modularity benefits of building your own off-grid or backup system.";
const newDescription =
  "A dated REPT cell and JK box listing puts one 16-cell DIY LFP materials example near $116 per usable kWh before freight and tax.";
replaceExact(oldDescription, newDescription, "description", 4);
replaceExact(
  '<meta property="article:modified_time" content="2026-08-20" />',
  '<meta property="article:modified_time" content="2026-10-21" />',
  "article modified time",
);
replaceExact(
  '"dateModified": "2026-08-20T00:00:00Z"',
  '"dateModified": "2026-10-21T00:00:00Z"',
  "JSON-LD modified time",
);

const marker = "In the DIY market, you are essentially cutting out the middleman.";
const markerIndex = html.indexOf(marker);
if (markerIndex < 0) throw new Error("pricing paragraph marker not found");
const paragraphStart = html.lastIndexOf("        <p>" + eol, markerIndex);
const closingParagraph = eol + "        </p>";
const paragraphEndAt = html.indexOf(closingParagraph, markerIndex);
if (paragraphStart < 0 || paragraphEndAt < 0) throw new Error("pricing paragraph boundaries not found");
const paragraphEnd = paragraphEndAt + closingParagraph.length;
const replacementParagraphs = [
  "        <p>",
  "          Compare DIY materials with an installed system by scope, not by a",
  "          blanket savings percentage. The owner-supplied $80–$120 per usable",
  "          kWh DIY materials band is a planning assumption for this guide, not",
  "          a current market average or a delivered quote.",
  "        </p>",
  "        <p>",
  "          In a price snapshot checked 21 October 2026, Docan listed its",
  '          <a href="https://www.docanpower.com/rept-280ah-prismatic-cell">',
  "            China-stock REPT LF280 3.2V, 280Ah cell",
  "          </a>",
  "          at $60 before tax and its",
  '          <a href="https://www.docanpower.com/s3-diy-box-jk-bms-v19">',
  "            Apex 280 box with 200A JK BMS",
  "          </a>",
  "          at $365 before tax. The kit listing says it fits 16 cells; confirm",
  "          compatibility and delivered costs with the supplier before buying.",
  "          Sixteen cells have 14.34 kWh nameplate capacity",
  "          (16 × 3.2 V × 280 Ah); at an 80% usable fraction, that is 11.47",
  "          kWh. Listed materials total $1,325, or about $116 per usable kWh",
  "          before freight and tax. This is one supplier snapshot, not proof",
  "          of the planning band's endpoints or a full installed-system price.",
  "        </p>",
].join(eol);
html = html.slice(0, paragraphStart) + replacementParagraphs + html.slice(paragraphEnd);

const oldFaq =
  "Yes, building your own LiFePO4 battery is typically 40-60% cheaper than buying a comparable pre-built system. You save on R&D, marketing, and warranty overhead. However, you must factor in the cost of tools, enclosures, and your own time. For large capacities (10kWh+), the savings are most significant.";
const newFaq =
  "$80–$120 per usable kWh is a planning assumption for DIY materials, not a sourced market range. The dated 16-cell example works out to about $116 per usable kWh before freight and tax; delivery, inverter, electrical work, permits, and installation require separate quotes.";
replaceExact(oldFaq, newFaq, "FAQ structured data");
const visibleQuestion = "Is it cheaper to build your own LiFePO4 battery?";
const visibleQuestionIndex = html.lastIndexOf(visibleQuestion);
if (visibleQuestionIndex < 0) throw new Error("visible FAQ question not found");
const visibleAnswerStart = html.indexOf(
  "              Yes, building your own LiFePO4 battery is typically 40-60% cheaper",
  visibleQuestionIndex,
);
const visibleAnswerEnd = html.indexOf("</div>", visibleAnswerStart);
if (visibleAnswerStart < 0 || visibleAnswerEnd < 0) throw new Error("visible FAQ answer boundaries not found");
html =
  html.slice(0, visibleAnswerStart) +
  "              " +
  newFaq +
  eol +
  "            " +
  html.slice(visibleAnswerEnd);

fs.writeFileSync(articlePath, html);

let sitemap = fs.readFileSync(sitemapPath, "utf8");
const articleUrl =
  "<loc>https://freeoffgridcalculator.com/blog/diy-vs-prebuilt-sodium-ion-lifepo4-battery-storage/</loc>";
const urlIndex = sitemap.indexOf(articleUrl);
if (urlIndex < 0) throw new Error("DIY article sitemap entry not found");
const lastmod = "<lastmod>2026-08-30</lastmod>";
const lastmodIndex = sitemap.indexOf(lastmod, urlIndex);
if (lastmodIndex < 0) throw new Error("DIY article sitemap lastmod not found");
sitemap =
  sitemap.slice(0, lastmodIndex) +
  "<lastmod>2026-10-21</lastmod>" +
  sitemap.slice(lastmodIndex + lastmod.length);
fs.writeFileSync(sitemapPath, sitemap);
console.log("Updated one article pricing section, metadata, FAQ, and sitemap lastmod.");
