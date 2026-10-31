// One-shot import helper: inserts the six chart-canvas a11y label keys into
// every locale of LOCALES, immediately before the shared socCaptionGrid anchor.
import { readFileSync, writeFileSync } from "node:fs";

const path = "assets/js/shared/locales.js";
let src = readFileSync(path, "utf8");

const BLOCKS = {
  en: [
    'chartLabelSoc: "Battery charge chart for {chemLabel}.",',
    'chartLabelCumCost: "Cumulative 20-year cost chart for {system} ({pv}).",',
    'chartLabelAuto: "Battery charge comparison chart for {systems}.",',
    'chartSolarKw: "{kw} kW solar",',
    'chartBatteryOnly: "battery only",',
    'chartSystemFallback: "the selected system",',
  ],
  es: [
    'chartLabelSoc: "Gráfico de carga de la batería para {chemLabel}.",',
    'chartLabelCumCost: "Gráfico de coste acumulado a 20 años para {system} ({pv}).",',
    'chartLabelAuto: "Gráfico comparativo de carga de la batería para {systems}.",',
    'chartSolarKw: "{kw} kW solares",',
    'chartBatteryOnly: "solo batería",',
    'chartSystemFallback: "el sistema seleccionado",',
  ],
  pt: [
    'chartLabelSoc: "Gráfico de carga da bateria para {chemLabel}.",',
    'chartLabelCumCost: "Gráfico de custo acumulado de 20 anos para {system} ({pv}).",',
    'chartLabelAuto: "Gráfico comparativo de carga da bateria para {systems}.",',
    'chartSolarKw: "{kw} kW solares",',
    'chartBatteryOnly: "somente bateria",',
    'chartSystemFallback: "o sistema selecionado",',
  ],
  fr: [
    'chartLabelSoc: "Graphique de charge de la batterie pour {chemLabel}.",',
    'chartLabelCumCost: "Graphique du coût cumulé sur 20 ans pour {system} ({pv}).",',
    'chartLabelAuto: "Graphique comparatif de charge de la batterie pour {systems}.",',
    'chartSolarKw: "{kw} kW solaires",',
    'chartBatteryOnly: "batterie uniquement",',
    'chartSystemFallback: "le système sélectionné",',
  ],
  de: [
    'chartLabelSoc: "Batterieladeverlauf für {chemLabel}.",',
    'chartLabelCumCost: "Grafik der kumulierten 20-Jahres-Kosten für {system} ({pv}).",',
    'chartLabelAuto: "Vergleichsgrafik der Batterieladung für {systems}.",',
    'chartSolarKw: "{kw} kW Solar",',
    'chartBatteryOnly: "nur Batterie",',
    'chartSystemFallback: "das ausgewählte System",',
  ],
  nl: [
    'chartLabelSoc: "Batterijladingsgrafiek voor {chemLabel}.",',
    'chartLabelCumCost: "Grafiek van de cumulatieve 20-jarige kosten voor {system} ({pv}).",',
    'chartLabelAuto: "Vergelijkende batterijladingsgrafiek voor {systems}.",',
    'chartSolarKw: "{kw} kW zonne-energie",',
    'chartBatteryOnly: "alleen batterij",',
    'chartSystemFallback: "het geselecteerde systeem",',
  ],
  ar: [
    'chartLabelSoc: "رسم شحن البطارية لـ {chemLabel}.",',
    'chartLabelCumCost: "رسم التكلفة التراكمية على 20 عامًا لـ {system} ({pv}).",',
    'chartLabelAuto: "رسم مقارنة شحن البطارية لـ {systems}.",',
    'chartSolarKw: "{kw} كيلوواط من الطاقة الشمسية",',
    'chartBatteryOnly: "بطارية فقط",',
    'chartSystemFallback: "النظام المحدد",',
  ],
};

const ORDER = ["en", "es", "pt", "fr", "de", "nl", "ar"];
let total = 0;
for (let i = 0; i < ORDER.length; i++) {
  const loc = ORDER[i];
  const start = src.indexOf(`  ${loc}: {`);
  if (start < 0) throw new Error(`locale block ${loc} not found`);
  const end =
    i + 1 < ORDER.length
      ? src.indexOf(`  ${ORDER[i + 1]}: {`, start + 1)
      : src.length;
  if (end < 0) throw new Error(`next locale after ${loc} not found`);
  const slice = src.slice(start, end);
  const anchor = "    socCaptionGrid:";
  const at = slice.indexOf(anchor);
  if (at < 0) throw new Error(`socCaptionGrid anchor missing in ${loc}`);
  if (slice.includes("chartLabelSoc")) {
    console.log(`${loc}: already present, skipping`);
    continue;
  }
  const indent = BLOCKS[loc].map((l) => "    " + l).join("\n");
  const patched =
    slice.slice(0, at) + indent + "\n" + slice.slice(at);
  src = src.slice(0, start) + patched + src.slice(end);
  total += BLOCKS[loc].length;
  console.log(`${loc}: inserted ${BLOCKS[loc].length} keys`);
}
writeFileSync(path, src);
console.log(`total keys inserted: ${total}`);
