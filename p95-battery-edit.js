const fs = require("node:fs");
const path = "blog/battery-longevity-and-dod-reference/index.html";
let html = fs.readFileSync(path, "utf8");
const oldTitle = "Battery Longevity, Oversizing &amp; DoD Reference Guide (2026)";
const newTitle = "Battery cycle life and depth of discharge: a practical guide";
html = html.split(oldTitle).join(newTitle);
const newDescription = "How to read battery cycle-life ratings, compare test conditions, and plan usable capacity without assuming a guaranteed service life.";
html = html.replace(/(<meta\s+name="description"\s+content=")[^"]*"/, "$1" + newDescription + '"');
html = html.replace(/(<meta\s+property="og:description"\s+content=")[^"]*"/, "$1" + newDescription + '"');
html = html.replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*"/, "$1" + newDescription + '"');
html = html.replace(/("description":\s*")[^"]*"/, '$1' + newDescription + '"');
html = html.replace(/(<meta\s+name="keywords"\s+content=")[^"]*"/, '$1battery cycle life, depth of discharge, battery sizing, energy storage ratings"');
html = html.replace('"dateModified": "2026-09-11T00:00:00Z"', '"dateModified": "2026-10-22T00:00:00Z"');
html = html.replace('<meta property="article:modified_time" content="2026-09-11" />', '<meta property="article:modified_time" content="2026-10-22" />');
const start = html.indexOf("        <!-- Executive Summary Callout -->");
const next = html.indexOf("3. LiFePO<sub>4</sub>", start);
if (start < 0 || next < 0) throw new Error("Could not locate the article claim section.");
const end = html.lastIndexOf("        <h2>", next);
const lines = [
  "        <!-- Executive Summary Callout -->",
  '        <div class="callout callout-info">',
  '          <div class="callout-title">What the evidence supports</div>',
  '          <p style="margin-bottom: 0">',
  "            No single cycle count or service life applies to every battery",
  "            sold under the same chemistry label. Cell design and test",
  "            conditions matter. Use the product data sheet and the limits",
  "            stated by the battery maker and battery-management system when",
  "            planning a bank.",
  "          </p>",
  "        </div>",
  "",
  "        <h2>1. Cycle-life ratings belong to a test protocol</h2>",
  "        <p>",
  "          Depth of discharge (DoD) describes how much of a battery's rated",
  "          capacity is removed during a discharge. It is one input to aging,",
  "          not a stand-alone lifetime predictor. A Sandia study tested",
  "          commercial LFP, NCA, and NMC cells at different discharge rates,",
  "          depths of discharge, and temperatures. It found substantial",
  "          variation in time and cycle counts to 80% capacity, including",
  "          variation among cells of the same chemistry. The result describes",
  "          those cells and protocols; it does not establish a universal",
  "          cycle-life curve for every product. See",
  '          <a href="https://www.osti.gov/biblio/1650174">Preger et al. (2020)</a>.',
  "        </p>",
  "        <p>",
  "          A cycle-life number is useful only alongside the conditions under",
  "          which it was measured. When comparing products, record the DoD or",
  "          state-of-charge window, temperature, charge and discharge rate,",
  "          voltage limits, cycle profile, and the maker's end-of-life",
  "          criterion. NREL's",
  '          <a href="https://docs.nrel.gov/docs/fy19osti/73822.pdf">operation and maintenance guide</a>',
  "          emphasizes documenting operating conditions when evaluating",
  "          energy-storage systems.",
  "        </p>",
  "",
  "        <h2>2. What a larger battery can and cannot tell you</h2>",
  "        <p>",
  "          If the energy taken from a bank stays the same, increasing its",
  "          usable capacity reduces the share used on a typical day. That is",
  "          capacity arithmetic, not a promise of a particular cycle count,",
  "          calendar life, or replacement date. Temperature, charge settings,",
  "          system controls, and time in service still matter.",
  "        </p>",
  "        <p>",
  "          For an initial sizing estimate, divide the energy that must come",
  "          from the battery by the usable fraction selected for the scenario.",
  "          Then account for conversion losses, reserve, and the limits in the",
  "          battery and inverter documentation. Treat the result as a planning",
  "          input; it is not a warranty or a battery-life prediction.",
  "        </p>",
  ""
].join("\r\n");
html = html.slice(0, start) + lines + html.slice(end);
const faqHeading = html.indexOf("<h2>8. Frequently Asked Questions</h2>");
const firstFaq = html.indexOf('        <div class="faq-item">', faqHeading);
const nextFaq = html.indexOf('        <div class="faq-item">', firstFaq + 1);
if (faqHeading < 0 || firstFaq < 0 || nextFaq < 0) throw new Error("Could not locate the first visible FAQ.");
const question = "How should I compare cycle-life ratings at different DoD values?";
const answer = "Compare ratings only when their test conditions and end-of-life criteria are stated. Depth of discharge is one variable; cell design, temperature, charge and discharge rate, and voltage limits also matter. Research on commercial cells reports variation across cycling conditions, so a generic cycle count is not a life guarantee.";
const faqLines = [
  '        <div class="faq-item">',
  '          <div class="faq-question">',
  "            " + question,
  "          </div>",
  '          <div class="faq-answer">',
  "            " + answer,
  "          </div>",
  "        </div>",
  "",
  ""
].join("\r\n");
html = html.slice(0, firstFaq) + faqLines + html.slice(nextFaq);
const scriptStart = html.indexOf('<script type="application/ld+json">');
const jsonStart = html.indexOf("{", scriptStart);
const scriptEnd = html.indexOf("</script>", jsonStart);
if (scriptStart < 0 || jsonStart < 0 || scriptEnd < 0) throw new Error("Could not locate Article JSON-LD.");
const graph = JSON.parse(html.slice(jsonStart, scriptEnd).trim());
const faqSchema = graph["@graph"].find((item) => item["@type"] === "FAQPage");
if (!faqSchema || !faqSchema.mainEntity || !faqSchema.mainEntity[0]) throw new Error("FAQ schema entry missing.");
faqSchema.mainEntity[0].name = question;
faqSchema.mainEntity[0].acceptedAnswer.text = answer;
const json = JSON.stringify(graph, null, 2).split("\n").map((line) => "      " + line).join("\r\n");
html = html.slice(0, jsonStart) + json + "\r\n    " + html.slice(scriptEnd);
fs.writeFileSync(path, html, "utf8");

