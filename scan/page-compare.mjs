// Read one static city page from staging and print the numbers its worked
// example states: the band, the 60/80/95 rows, the payback line, the USD rate.
const slug = process.argv[2];
if (!slug) throw new Error("usage: page-compare.mjs <slug>");
const res = await fetch(`https://bigenergyco.pages.dev/solar-calculator/${slug}/`, { cache: "no-store" });
const html = await res.text();
const strip = (s) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&mdash;/g, "—")
    .replace(/&minus;/g, "−")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&bull;/g, "•")
    .replace(/\s+/g, " ")
    .trim();

const table = html.match(/<table>[\s\S]*?<\/table>/);
const rows = table
  ? [...table[0].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) =>
      [...r[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => strip(c[1])),
    )
  : [];
const payback = (html.match(/Payback depends[\s\S]*?<\/p>/) || [""])[0];
const coord = (html.match(/(\d+\.\d+)° ([NS]), (\d+\.\d+)° ([EW])/) || []).slice(0, 5);
const band = (html.match(/([\d,]+)–([\d,]+) kWh produced per kW/) || []).slice(1);
const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];

console.log(
  JSON.stringify(
    {
      slug,
      status: res.status,
      title,
      coord: coord.join(" "),
      bandKwhPerKwp: band,
      tableRows: rows,
      paybackLine: strip(payback),
    },
    null,
    1,
  ),
);
