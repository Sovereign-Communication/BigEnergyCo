// Compare, market by market: what the deployed calculator produced for the
// static page's own inputs (10 kWh/day, 60% cut) against what that market's
// static city page states.
import { readFileSync, writeFileSync } from "node:fs";

const measured = JSON.parse(readFileSync("/c/tmp/scan/world-calc-measure.json", "utf8"));
const strip = (s) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&mdash;/g, "—")
    .replace(/&minus;/g, "−")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/\s+/g, " ")
    .trim();

function readCalc(m) {
  const lines = (m.bodyText || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const before = (label) => {
    const i = lines.findIndex((l) => l === label);
    return i > 0 ? lines[i - 1] : null;
  };
  const sysLine = lines.find((l) => /^\w[\w\s()+-]*: [\d.]+ kW solar \+ [\d.]+ kWh battery/.test(l)) || null;
  const sizes = sysLine ? sysLine.match(/([\d.]+) kW solar \+ ([\d.]+) kWh battery/) : null;
  const paletteLine = lines.find((l) => /[\d.]+ kW$/.test(l)) || null;
  const battLine = lines.find((l) => /^[\d.]+ kWh$/.test(l)) || null;
  const powerCostLine = lines.find((l) => /your power costs about/.test(l)) || null;
  return {
    system: sysLine,
    pvKw: sizes ? Number(sizes[1]) : null,
    battKwh: sizes ? Number(sizes[2]) : null,
    // the KPI chips ("1.92 kW / solar", "7 kWh / LFP") when the sentence is absent
    chipPv: paletteLine,
    chipBatt: battLine,
    billCut: before("bill cut"),
    billAfter: before("bill after"),
    payback: before("payback"),
    twentyYear: before("20-yr true cost"),
    savings20: m.results?.cumSavingsTotal || null,
    breakEven: (m.results?.cumSavingsSub || "").match(/Break-even in year (\d+)/)?.[1] || null,
    powerCostLine,
    cumCaptionHead: (m.results?.cumCaption || "").slice(0, 120),
  };
}

async function readPage(slug) {
  const res = await fetch(`https://bigenergyco.pages.dev/solar-calculator/${slug}/`, { cache: "no-store" });
  const html = await res.text();
  const table = html.match(/<table>[\s\S]*?<\/table>/);
  const rows = table
    ? [...table[0].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) =>
        [...r[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => strip(c[1])),
      )
    : [];
  const paybackLine = strip((html.match(/Payback depends[\s\S]*?<\/p>/) || [""])[0]);
  const rate = paybackLine.match(/at ~\$([\d.]+)\/kWh/)?.[1] ?? null;
  const saved = paybackLine.match(/saves roughly \$([\d,]+)\/year/)?.[1] ?? null;
  const landed = paybackLine.match(/\(about \$([\d,]+)\)/)?.[1] ?? null;
  const years = paybackLine.match(/in about ([\d.]+) years/)?.[1] ?? null;
  const row60 = rows.find((r) => r[0] === "~60%") || null;
  const nums = (s) => (s ? s.match(/[\d.]+/g)?.map(Number) ?? null : null);
  return {
    slug,
    status: res.status,
    rateUsd: rate,
    savedUsdYr: saved,
    landedUsd: landed,
    paybackYears: years,
    row60Panels: row60?.[1] ?? null,
    row60Battery: row60?.[2] ?? null,
    row60PanelsNums: nums(row60?.[1]),
    row60BatteryNums: nums(row60?.[2]),
  };
}

const out = [];
for (const m of measured.markets) {
  const calc = readCalc(m);
  const page = await readPage(m.slug);
  const flags = [];
  const batteryAbovePage = page.row60BatteryNums && calc.battKwh != null && calc.battKwh > page.row60BatteryNums[1];
  const batteryBelowPage = page.row60BatteryNums && calc.battKwh != null && calc.battKwh < page.row60BatteryNums[0];
  const pvInside = page.row60PanelsNums && calc.pvKw != null && calc.pvKw >= page.row60PanelsNums[0] * 0.9 && calc.pvKw <= page.row60PanelsNums[1] * 1.1;
  if (batteryAbovePage) flags.push(`engine battery ${calc.battKwh} kWh > page band ${page.row60Battery}`);
  if (batteryBelowPage) flags.push(`engine battery ${calc.battKwh} kWh < page band ${page.row60Battery}`);
  if (!pvInside) flags.push(`engine PV ${calc.pvKw} kW outside page band ${page.row60Panels}`);
  if (page.rateUsd && Math.abs(Number(page.rateUsd) * 1 - (Number(m.tariff?.tariffLocal) / Number(m.tariff?.fxRate))) > 0.005)
    flags.push(`rate mismatch: page $${page.rateUsd} vs calculator ${m.tariff?.tariffLocal} ${m.tariff?.fxCode} (${(Number(m.tariff?.tariffLocal) / Number(m.tariff?.fxRate)).toFixed(3)} USD)`);
  out.push({ market: m.slug, locale: m.locale, note: m.note, fx: m.tariff?.fxCode, tariffLocal: m.tariff?.tariffLocal, symbol: m.tariff?.billCurrencySymbol, calc, page, flags });
}
writeFileSync("/c/tmp/scan/world-calc-compare.json", JSON.stringify(out, null, 1));

for (const r of out) {
  console.log(`\n=== ${r.market} (${r.locale}) — ${r.note}`);
  console.log(`  currency: ${r.fx} · symbol ${JSON.stringify(r.symbol)} · tariff ${r.tariffLocal} ${r.fx}/kWh (page: $${r.page.rateUsd}/kWh)`);
  console.log(`  calculator: ${r.calc.system || "(no system line)"} | cut ${r.calc.billCut} | payback ${r.calc.payback} | 20-yr ${r.calc.twentyYear} | ${r.calc.savings20}`);
  console.log(`  page 60% row: ${r.page.row60Panels} panels, ${r.page.row60Battery} battery | payback ${r.page.paybackYears} yr | saved $${r.page.savedUsdYr}/yr`);
  console.log(`  flags: ${r.flags.length ? r.flags.join(" | ") : "none"}`);
}
