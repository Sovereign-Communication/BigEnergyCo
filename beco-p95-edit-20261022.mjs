import fs from "node:fs";

const eol = "\r\n";
const articlePath = "blog/how-to-cut-electricity-bill-with-solar/index.html";
const indexPath = "blog/index.html";
const pageUrl = "https://freeoffgridcalculator.com/blog/how-to-cut-electricity-bill-with-solar/";
const title = "How to Cut Your Electricity Bill With Solar (2026 Guide)";
const description = "A practical guide to comparing solar bill savings using your electricity use, utility rates, export credits, storage needs, and full system costs.";
const cardExcerpt = "Compare solar options with your real utility bill, export-credit rules, storage needs, and full installed costs. No universal bill-cut or payback promise.";
const faqItems = [
  {
    question: "How much of my electricity bill can solar panels cut?",
    answer: "There is no universal percentage. Solar output, the home's electricity use and timing, roof and site conditions, utility rates, and export credits all affect the result. Use recent utility bills and the current local tariff. The calculator is an estimate, not a roof inspection or savings promise.",
  },
  {
    question: "Do I need a battery to cut my bill with solar?",
    answer: "A battery can shift solar energy for later use or backup, but it does not guarantee a lower bill. The value depends on your rate schedule, export compensation, installed battery cost, and how much power you shift. Compare solar scenarios with and without storage.",
  },
  {
    question: "How fast does solar pay for itself?",
    answer: "There is no universal payback period. Use the full price you would actually pay, financing terms, utility bills, export credits, operating and replacement costs, and only incentives you have verified for your location. Treat a calculator result as an estimate, not a promise.",
  },
  {
    question: "Is it cheaper to build the battery myself?",
    answer: "Not always. Compare like-for-like written quotes for usable capacity, power, protection, enclosure, shipping, installation, permits, inspection, warranty, and support. A cell-only price is not the cost of an installed system. Check local rules and use qualified help for electrical work.",
  },
];

const replacement = `        <p class="meta">
          Published Aug 30, 2026 &middot; Last reviewed Oct 22, 2026 &middot; Lucas Ballek
        </p>

        <p>
          <em class="kicker">The short answer:</em> solar can reduce the electricity you buy from the grid, but no fixed bill-cut percentage or payback period applies everywhere. Your result depends on the electricity you use, when you use it, what the system produces, how your utility credits exports, and the full price of the system. The U.S. Department of Energy lists these as key factors in solar savings; check the rules and rates for your own utility.
        </p>
        <p>
          A model can compare scenarios, but it cannot inspect your roof, read your utility contract, or promise a financial outcome. Treat every output as an estimate and verify the assumptions against current bills and itemized quotes.
        </p>

        <h2>Three levers that affect your bill</h2>
        <ul>
          <li>
            <strong>Use less electricity.</strong> Efficiency changes the amount of energy a system needs to cover. The estimator uses the load you enter; it does not model a specific efficiency upgrade for you.
          </li>
          <li>
            <strong>Generate electricity on site.</strong> Solar can reduce power bought from the grid while panels are producing. Roof direction, shade, weather, equipment, and the hours you use electricity all affect how much of that production offsets your bill.
          </li>
          <li>
            <strong>Shift energy to a later time.</strong> A battery can store some solar power for later use or backup. The financial value depends on the local rate schedule, export credit, battery cost, and how much power you shift; storage is not automatically the cheaper option.
          </li>
        </ul>

        <h2>Use your own bill to compare options</h2>
        <ol>
          <li>
            <strong>Start with recent utility bills.</strong> Note monthly kWh, the rate schedule, fixed charges, and any time-of-use periods. Check the rate and export credit shown in the estimator against your current utility tariff.
          </li>
          <li>
            <strong>Confirm export rules.</strong> Compensation for power sent to the grid varies by utility and location. Use the current utility terms for your address rather than assuming every exported kWh earns the retail rate.
          </li>
          <li>
            <strong>Compare like with like.</strong> Keep the same load and tariff assumptions while comparing solar-only and solar-plus-storage options, different cut targets, and different budgets. Look at the modeled bill reduction and full cost together.
          </li>
          <li>
            <strong>Check the site separately.</strong> Confirm roof condition, orientation, shade, electrical service, permits, inspection, and interconnection with your utility and qualified local professionals. A weather-based estimate does not inspect these conditions.
          </li>
        </ol>

        <h2>Compare the complete system price</h2>
        <p>
          Component prices are not an installed quote. Compare written offers with the same scope: panels, inverter, usable battery capacity and power, mounting, wiring, electrical upgrades, permits, inspection, interconnection, labor, taxes, financing, warranty, and replacement terms. For a DIY battery, include the battery-management system, enclosure, shipping, tools, protection, inspection, and support. Do not treat a cell-only price as the cost of a finished system.
        </p>

        <h2>What the estimate can and cannot tell you</h2>
        <p>
          The calculator uses a five-year hourly weather series from NASA POWER with the location and load you enter. NASA describes its Hourly API as time-series solar and meteorological data; it is not a measurement of your roof. NREL's PVWatts guidance also describes modeled output as an estimate with assumptions and uncertainty. The calculator cannot see roof shade, equipment condition, contract terms, or every local charge, so use its displayed assumptions and verify the result before making a purchase decision.
        </p>

        <div class="cta-box">
          <p>
            <strong>Start with your bill, not a fixed percentage.</strong> Use a current location and load, check the utility rate and export credit, then compare the estimate with a complete local quote.
          </p>
          <a class="btn" href="../../#sizing">Run my free sizing</a>
        </div>

        <h2>Sources and methods</h2>
        <ul>
          <li>
            <a href="https://www.energy.gov/cmei/systems/homeowners-guide-solar" rel="noreferrer">U.S. Department of Energy, Homeowner's Guide to Solar</a> - the savings and net-metering sections explain why usage, system size, sunlight, rates, and export compensation matter. Check current local rules and incentives directly; examples and policy details can age.
          </li>
          <li>
            <a href="https://power.larc.nasa.gov/docs/services/api/temporal/hourly/" rel="noreferrer">NASA POWER Hourly API documentation</a> - describes the hourly solar and meteorological time-series data used by the estimator.
          </li>
          <li>
            <a href="https://pvwatts.nrel.gov/" rel="noreferrer">NREL PVWatts Calculator</a> - an independent solar-production model whose guidance describes the assumptions and uncertainty in modeled output.
          </li>
        </ul>
`;

function replaceOne(source, regex, replacementText, label) {
  let count = 0;
  const out = source.replace(regex, (match, ...args) => {
    count++;
    return typeof replacementText === "function" ? replacementText(match, ...args) : replacementText;
  });
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`);
  return out;
}

function setMeta(source, attribute, value, label) {
  const tags = [...source.matchAll(/<meta\b[^>]*>/gs)];
  const found = tags.filter((match) => match[0].includes(attribute));
  if (found.length !== 1) throw new Error(`${label}: expected one matching meta tag, found ${found.length}`);
  const tag = found[0][0];
  if (!/\bcontent="[^"]*"/.test(tag)) throw new Error(`${label}: missing content attribute`);
  const updated = tag.replace(/\bcontent="[^"]*"/, `content="${value}"`);
  return source.slice(0, found[0].index) + updated + source.slice(found[0].index + tag.length);
}

function updateJsonLd(source, edit, label) {
  const regex = /([ \t]*)<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let count = 0;
  const out = source.replace(regex, (whole, indent, body) => {
    let data;
    try { data = JSON.parse(body.trim()); } catch { return whole; }
    if (!edit(data)) return whole;
    count++;
    const formatted = JSON.stringify(data, null, 2).split("\n").map((line) => indent + "  " + line).join(eol);
    return indent + '<script type="application/ld+json">' + eol + formatted + eol + indent + "</script>";
  });
  if (count !== 1) throw new Error(`${label}: expected one JSON-LD block update, got ${count}`);
  return out;
}

let article = fs.readFileSync(articlePath, "utf8");
const bodyStartMarker = '        <p class="meta">';
const bodyEndMarker = "        <h2>Related guides</h2>";
const bodyStart = article.indexOf(bodyStartMarker);
const bodyEnd = article.indexOf(bodyEndMarker, bodyStart);
if (bodyStart < 0 || bodyEnd < 0) throw new Error("article body markers not found");
const body = replacement.replace(/\r?\n/g, eol);
article = article.slice(0, bodyStart) + body + article.slice(bodyEnd);

const faqHeading = "        <h2>Frequently asked</h2>";
const faqStart = article.indexOf(faqHeading);
const articleClose = article.indexOf("      </article>", faqStart);
if (faqStart < 0 || articleClose < 0) throw new Error("FAQ markers not found");
const faqHtml = [
  faqHeading,
  ...faqItems.flatMap(({ question, answer }) => [
    "        <details>",
    `          <summary>${question}</summary>`,
    "          <p>",
    `            ${answer}`,
    "          </p>",
    "        </details>",
  ]),
  "",
].join(eol);
article = article.slice(0, faqStart) + faqHtml + article.slice(articleClose);

const descMeta = "A practical guide to comparing solar bill savings using your electricity use, utility rates, export credits, storage needs, and full system costs.";
article = setMeta(article, 'name="description"', descMeta, "article description");
article = setMeta(article, 'property="og:description"', descMeta, "Open Graph description");
article = setMeta(article, 'name="twitter:description"', descMeta, "Twitter description");
article = replaceOne(article, /(<meta property="article:modified_time" content=")[^"]+("\s*\/>)/, (match, prefix, suffix) => prefix + "2026-10-22" + suffix, "article modified time");
article = updateJsonLd(article, (data) => {
  const graph = Array.isArray(data["@graph"]) ? data["@graph"] : [];
  const articleNode = graph.find((node) => node["@type"] === "Article");
  const faqNode = graph.find((node) => node["@type"] === "FAQPage");
  if (!articleNode || !faqNode) return false;
  articleNode.description = descMeta;
  articleNode.dateModified = "2026-10-22T00:00:00Z";
  faqNode.mainEntity = faqItems.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  }));
  return true;
}, "article JSON-LD");
fs.writeFileSync(articlePath, article, "utf8");

const indexDescription = "Compare solar options with your real utility bill, export-credit rules, storage needs, and full installed costs. No universal bill-cut or payback promise.";
let index = fs.readFileSync(indexPath, "utf8");
index = updateJsonLd(index, (data) => {
  const posts = Array.isArray(data.blogPost) ? data.blogPost : (Array.isArray(data["@graph"]) ? data["@graph"] : []);
  const post = posts.find((node) => node["@type"] === "BlogPosting" && node.url === pageUrl);
  if (!post) return false;
  post.headline = title;
  post.name = title;
  post.description = indexDescription;
  post.dateModified = "2026-10-22T00:00:00Z";
  return true;
}, "blog index JSON-LD");

const cardMarker = "        <!-- Article 3 -->";
const cardStart = index.indexOf(cardMarker);
const cardEnd = index.indexOf("        </article>", cardStart);
if (cardStart < 0 || cardEnd < 0) throw new Error("article card markers not found");
let card = index.slice(cardStart, cardEnd + "        </article>".length);
card = replaceOne(card, /(<a href="\.\/how-to-cut-electricity-bill-with-solar\/"\s*>)[\s\S]*?(<\/a\s*>)/, `$1${title}$2`, "visible article card title");
card = replaceOne(card, /<p class="card-excerpt">[\s\S]*?<\/p>/, `            <p class="card-excerpt">${indexDescription}</p>`, "visible article card description");
card = replaceOne(card, /(<div class="card-footer">\s*<span>)[\s\S]*?(<\/span>)/, "$1Published Aug 30, 2026 &middot; Last reviewed Oct 22, 2026$2", "visible article card review date");
index = index.slice(0, cardStart) + card + index.slice(cardEnd + "        </article>".length);
fs.writeFileSync(indexPath, index, "utf8");

let sitemap = fs.readFileSync("sitemap.xml", "utf8");
const articleLoc = `<loc>${pageUrl}</loc>`;
const locIndex = sitemap.indexOf(articleLoc);
if (locIndex < 0) throw new Error("article sitemap entry not found");
const dateIndex = sitemap.indexOf("<lastmod>2026-08-30</lastmod>", locIndex);
if (dateIndex < 0) throw new Error("article sitemap date not found");
sitemap = sitemap.slice(0, dateIndex) + "<lastmod>2026-10-22</lastmod>" + sitemap.slice(dateIndex + "<lastmod>2026-08-30</lastmod>".length);
fs.writeFileSync("sitemap.xml", sitemap, "utf8");

console.log("Updated one P9.5 article: body, FAQs, source list, modification dates, JSON-LD, blog card, and sitemap.");
