import fs from "node:fs";

const root = "C:/tmp/beco-p95-battery-bank-20261022";
const read = (path) => fs.readFileSync(`${root}/${path}`, "utf8");
const write = (path, value) => fs.writeFileSync(`${root}/${path}`, value, "utf8");
const replaceOnce = (value, before, after, label) => {
  const first = value.indexOf(before);
  if (first < 0 || value.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${label}: expected one exact match`);
  }
  return value.slice(0, first) + after + value.slice(first + before.length);
};
const updateLd = (html, update, label) => {
  let seen = 0;
  const result = html.replace(
    /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,
    (_whole, open, body, close) => {
      seen++;
      const data = JSON.parse(body);
      update(data["@graph"]);
      const formatted = JSON.stringify(data, null, 2)
        .split("\n")
        .map((line) => `        ${line}`)
        .join("\n");
      return `${open}\n${formatted}\n      ${close}`;
    },
  );
  if (seen !== 1) throw new Error(`${label}: expected one JSON-LD script`);
  return result;
};

const title = "How to Size an Off-Grid Battery Bank (2026)";
const description = "Size off-grid battery storage from the loads, backup plan, usable energy, power limits, equipment compatibility, and local installation rules.";
const faq = [
  {
    name: "How many kWh of battery do I need for a 10 kWh/day home?",
    text: "There is no universal battery size from daily kWh alone. Define the required loads and backup duration, then check generation, product usable capacity, losses, power limits, and reserve settings in the manufacturer's model and a time-series study.",
  },
  {
    name: "How do I convert battery kWh to amp-hours?",
    text: "Use nominal voltage and nameplate amp-hours only for an approximate nominal-energy conversion: kWh = V × Ah ÷ 1,000. Use the manufacturer's stated usable kWh and discharge limits for design.",
  },
  {
    name: "Is 48 V always better than 12 V or 24 V?",
    text: "No. Choose a voltage supported by your battery, inverter, and chargers. A higher DC voltage generally means lower current for the same power, but equipment limits, wiring, and local code determine the system.",
  },
  {
    name: "Can I connect batteries in series or parallel?",
    text: "Only when the battery manufacturer permits the exact model and configuration. Follow its connection, BMS, current, and protection instructions; do not mix batteries based on simple arithmetic alone.",
  },
];
const article = `      <article>
        <h1>${title}</h1>
        <p class="meta">
          Last reviewed: October 22, 2026 · Lucas Ballek · 10 min read
        </p>
        <p>
          <em class="kicker">The short answer:</em> Start with the loads that
          must run, the hours they must run, and the backup plan. Then compare
          those needs with the exact battery's usable energy and power limits.
          Daily use alone does not determine a safe or reliable battery size.
          Have a qualified installer review the complete design.
        </p>

        <h2>Start with the load and backup plan</h2>
        <p>
          List the circuits that must stay on, how much energy each uses over
          time, the largest loads that may run together, and any motor-starting
          surge. Decide how long the system must support those loads, what can
          be switched off, and whether a generator or grid connection is part
          of the plan. A daily kWh total does not show the timing or peak power
          of the loads.
        </p>
        <p>
          For solar-backed storage, test battery charging and discharging across
          local weather sequences. NREL's
          <a href="https://sam.nrel.gov/battery-storage/">System Advisor Model battery documentation</a>
          describes dispatch options and models that account for voltage,
          temperature, degradation, and replacement assumptions. An annual
          energy average cannot establish how a bank performs through a low-sun
          period.
        </p>

        <h2>Use the exact battery's usable-energy limits</h2>
        <p>
          Nameplate energy and energy delivered to AC loads are different
          quantities. Start with the manufacturer's stated usable capacity,
          discharge limits, operating temperatures, and inverter compatibility.
          Current, temperature, state of charge, and aging can change what a
          product delivers. The
          <a href="https://www.victronenergy.com/media/pg/Lithium_Battery_Smart/en/operation.html">Victron Lithium Smart Battery manual</a>
          is one product-specific example: its capacity data and operating
          limits depend on stated test conditions. Those values are not defaults
          for other batteries or chemistries.
        </p>
        <ul>
          <li>
            <strong>Nominal-energy estimate:</strong> nominal kWh ≈ nominal
            voltage × nameplate Ah ÷ 1,000.
          </li>
          <li>
            <strong>Approximate AC energy:</strong> stated usable battery kWh ×
            inverter efficiency, before other system losses.
          </li>
          <li>
            <strong>Power check:</strong> compare simultaneous and surge loads
            with the battery, BMS, inverter, and charger ratings.
          </li>
        </ul>
        <p>
          Hypothetical arithmetic only: a product rated for 10 kWh usable and
          an assumed 90% inverter efficiency would deliver about 9 kWh AC before
          standby, wiring, temperature, reserve, and other losses. This is not a
          recommended bank size. It says nothing about the load timing, the
          system's peak output, or how quickly solar can recharge it.
        </p>

        <h2>Choose a voltage the equipment supports</h2>
        <p>
          12 V, 24 V, and 48 V are system options, not daily-energy tiers. Match
          the battery voltage to the inverter, charger, controller, and battery
          configuration allowed by their manuals. For the same ideal DC power,
          current is approximately power divided by voltage. Actual battery-side
          current also depends on conversion losses and the battery's operating
          voltage. Check continuous and short-duration ratings; this estimate is
          not a method for selecting conductors or protection.
        </p>

        <h2>Series and parallel connections are product-specific</h2>
        <p>
          In simple arithmetic, series connections add nominal voltage while
          amp-hours stay the same; parallel connections at the same voltage add
          amp-hours. Real batteries can only be connected that way when the
          manufacturer allows the exact model and configuration. Connection
          limits, BMS requirements, protection, and compatibility differ by
          product. Follow the complete manual rather than combining batteries
          from a generic diagram.
        </p>

        <h2>Compare more than nominal kWh</h2>
        <div class="table-container">
          <table>
            <caption>Battery details to compare in written system quotes</caption>
            <thead>
              <tr>
                <th scope="col">Check</th>
                <th scope="col">Ask for</th>
                <th scope="col">Why it matters</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Energy</td>
                <td>Nominal and usable kWh, plus reserve settings</td>
                <td>Shows how much energy is available under stated conditions</td>
              </tr>
              <tr>
                <td>Power</td>
                <td>Continuous and surge output, charge and discharge current</td>
                <td>Shows whether the system can serve loads that run together</td>
              </tr>
              <tr>
                <td>Compatibility</td>
                <td>Approved battery, inverter, charger, and BMS pairing</td>
                <td>Limits connection choices and safe operating modes</td>
              </tr>
              <tr>
                <td>Conditions</td>
                <td>Temperature range, enclosure, location, and warranty terms</td>
                <td>Product output and permitted installation depend on conditions</td>
              </tr>
              <tr>
                <td>Installed scope</td>
                <td>Controls, wiring, protection, permits, labor, and commissioning</td>
                <td>Makes quotes comparable and identifies omitted work</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>Safety and local installation rules</h2>
        <p>
          Do not use a web example to choose a fuse, breaker, wire size, spacing,
          or battery layout. Those depend on the exact equipment and the rules
          that apply at the property. In the United States,
          <a href="https://www.nfpa.org/codes-and-standards/nfpa-standard-development/855">NFPA 855</a>
          covers installation of stationary energy storage systems; the adopted
          code and local authority determine the requirements for a project.
          <a href="https://www.ul.com/resources/installation-codes-and-requirements-energy-storage-systems-ess-faqs">UL Solutions' installation-code FAQ</a>
          explains that fire-testing requirements depend on system and code
          conditions. Use equipment approved for the intended installation,
          follow its instructions, and have a qualified local professional
          review the design before it is energized.
        </p>

        <h2>Sources and limits</h2>
        <ul>
          <li>
            <a href="https://sam.nrel.gov/battery-storage/">NREL System Advisor Model: Battery Storage</a>
            describes battery performance models and dispatch options.
          </li>
          <li>
            <a href="https://www.victronenergy.com/media/pg/Lithium_Battery_Smart/en/operation.html">Victron Lithium Smart Battery Manual</a>
            gives model-specific operating and connection instructions; it is
            not a universal chemistry specification.
          </li>
          <li>
            <a href="https://www.nfpa.org/codes-and-standards/nfpa-standard-development/855">NFPA 855</a>
            is the United States standard for installation of stationary energy
            storage systems; local adoption determines what applies.
          </li>
          <li>
            <a href="https://www.ul.com/resources/installation-codes-and-requirements-energy-storage-systems-ess-faqs">UL Solutions: Installation Codes and Requirements for ESS</a>
            summarizes selected fire-testing requirements for energy storage
            systems.
          </li>
        </ul>

        <div class="cta-box">
          <p>
            <strong>Start with your own load profile.</strong> Run a free
            simulation, then check any proposed battery against its product
            documentation and a local installation review.
          </p>
          <a class="btn" href="../../#sizing">Run free simulation</a>
        </div>

        <h2>Related guides</h2>
        <ul>
          <li>
            <a href="../what-size-solar-system-for-off-grid/">Off-grid solar system sizing</a>
          </li>
          <li>
            <a href="../is-a-home-battery-worth-it/">Is a home battery worth it?</a>
          </li>
          <li>
            <a href="../battery-longevity-and-dod-reference/">Battery longevity and depth of discharge</a>
          </li>
        </ul>

        <h2>Frequently asked</h2>
        ${faq
          .map(
            ({ name, text }) => `        <details>\n          <summary>${name}</summary>\n          <p>${text}</p>\n        </details>`,
          )
          .join("\n")}
      </article>`;

let page = read("blog/off-grid-battery-bank-sizing/index.html");
const articleStart = page.indexOf("      <article>");
const articleEndStart = page.indexOf("      </article>", articleStart);
if (articleStart < 0 || articleEndStart < 0) throw new Error("article boundary not found");
page = page.slice(0, articleStart) + article + page.slice(articleEndStart + "      </article>".length);
const oldTitle = "Battery Bank Sizing Calculator: Off-Grid Guide (2026)";
page = page.replaceAll(oldTitle, title);
page = replaceOnce(
  page,
  "Battery bank sizing guide: voltage, usable vs nominal capacity, series parallel math, and 48V bank ranges for 10 kWh per day. Run free simulation.",
  description,
  "meta description",
);
page = replaceOnce(
  page,
  "Usable vs nominal, series vs parallel, 12V vs 24V vs 48V, and worked 10 kWh/day Ah math at 48V.",
  description,
  "Open Graph description",
);
page = replaceOnce(
  page,
  "Usable vs nominal, series vs parallel, voltage choice, and worked Ah math at 48V.",
  description,
  "Twitter description",
);
page = replaceOnce(
  page,
  "battery bank sizing calculator, off grid battery bank sizing, battery Ah calculation 48V, usable vs nominal battery capacity, series parallel battery wiring",
  "off-grid battery bank sizing, usable battery capacity, battery inverter power, off-grid storage planning, battery system safety",
  "keywords",
);
page = replaceOnce(
  page,
  '<meta property="article:modified_time" content="2026-09-07" />',
  '<meta property="article:modified_time" content="2026-10-22" />',
  "modified time metadata",
);
page = updateLd(page, (graph) => {
  const record = graph.find((item) => item["@type"] === "Article");
  const questions = graph.find((item) => item["@type"] === "FAQPage");
  if (!record || !questions) throw new Error("article or FAQ schema missing");
  record.headline = title;
  record.name = title;
  record.description = description;
  record.dateModified = "2026-10-22T00:00:00Z";
  record.citation = [
    "https://sam.nrel.gov/battery-storage/",
    "https://www.victronenergy.com/media/pg/Lithium_Battery_Smart/en/operation.html",
    "https://www.nfpa.org/codes-and-standards/nfpa-standard-development/855",
    "https://www.ul.com/resources/installation-codes-and-requirements-energy-storage-systems-ess-faqs",
  ];
  questions.mainEntity = faq.map(({ name, text }) => ({
    "@type": "Question",
    name,
    acceptedAnswer: { "@type": "Answer", text },
  }));
}, "article JSON-LD");
write("blog/off-grid-battery-bank-sizing/index.html", page);

let listing = read("blog/index.html").replaceAll(oldTitle, title);
listing = replaceOnce(
  listing,
  "Usable vs nominal, series parallel math, voltage choice, and 48V worked example.",
  description,
  "blog schema description",
);
listing = updateLd(listing, (graph) => {
  const record = graph.find((item) =>
    item["@type"] === "BlogPosting" &&
    item.url === "https://freeoffgridcalculator.com/blog/off-grid-battery-bank-sizing/",
  );
  if (!record) throw new Error("blog posting schema missing");
  record.headline = title;
  record.name = title;
  record.description = description;
  record.dateModified = "2026-10-22T00:00:00Z";
}, "blog index JSON-LD");
listing = replaceOnce(
  listing,
  `              Usable vs nominal, series vs parallel, voltage choice, and worked\n              10 kWh/day Ah math at 48V. Free simulation.`,
  `              Loads and backup duration come first. Compare usable energy,\n              power limits, compatible equipment, and local installation rules.`,
  "visible card excerpt",
);
listing = replaceOnce(
  listing,
  '              <span class="card-tag">48V</span>\n',
  "",
  "obsolete 48V tag",
);
listing = replaceOnce(
  listing,
  `${String.fromCodePoint(0x1f4c5)} Sep 7, 2026 · 10 min read`,
  "Last reviewed: Oct 22, 2026 · 10 min read",
  "visible card review date",
);
write("blog/index.html", listing);

let rss = read("rss.xml").replaceAll(oldTitle, title);
rss = replaceOnce(
  rss,
  "Usable vs nominal, series vs parallel, voltage choice, and 48V bank ranges for 10 kWh per day. Free simulation.",
  "Battery capacity starts with the load timeline and backup plan. Compare usable energy, power limits, product instructions, and local installation rules. Free tool.",
  "RSS description",
);
write("rss.xml", rss);

let sitemap = read("sitemap.xml");
sitemap = sitemap.replace(
  /(<loc>https:\/\/freeoffgridcalculator\.com\/blog\/off-grid-battery-bank-sizing\/<\/loc>\s*<lastmod>)2026-09-07(<\/lastmod>)/,
  "$12026-10-22$2",
);
if (!sitemap.includes("<loc>https://freeoffgridcalculator.com/blog/off-grid-battery-bank-sizing/</loc>\n    <lastmod>2026-10-22</lastmod>")) {
  throw new Error("sitemap lastmod was not updated");
}
write("sitemap.xml", sitemap);