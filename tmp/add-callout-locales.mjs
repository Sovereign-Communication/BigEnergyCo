import { readFileSync, writeFileSync } from "node:fs";
const FILE = "assets/js/shared/locales.js";
const K = {
  oversizeCheaper: {
    en: "This system uses an oversized battery ({battKwh} kWh) to avoid replacements, giving you the lowest 20-year cost — saving {cost} vs. smaller banks with swaps.",
    es: "Este sistema usa una batería sobredimensionada ({battKwh} kWh) para evitar sustituciones, lo que te da el coste más bajo a 20 años — ahorrando {cost} frente a bancos más pequeños con sustituciones.",
    pt: "Este sistema usa uma bateria superdimensionada ({battKwh} kWh) para evitar substituições, o que lhe dá o custo mais baixo a 20 anos — poupando {cost} em comparação com bancos menores com substituições.",
    fr: "Ce système utilise une batterie surdimensionnée ({battKwh} kWh) pour éviter les remplacements, ce qui vous donne le coût le plus bas sur 20 ans — économisant {cost} par rapport à des bancs plus petits avec remplacements.",
    de: "Dieses System nutzt eine überdimensionierte Batterie ({battKwh} kWh), um Wechsel zu vermeiden, und bietet dir so die niedrigsten 20-Jahres-Kosten — {cost} Ersparnis gegenüber kleineren Bänken mit Wechseln.",
    nl: "Dit systeem gebruikt een overgedimensioneerde accu ({battKwh} kWh) om vervangingen te voorkomen, wat u de laagste 20-jaarskosten oplevert — {cost} besparing ten opzichte van kleinere banken met vervangingen.",
    ar: "يستخدم هذا النظام بطارية كبيرة الحجم ({battKwh} كيلوواط ساعة) لتجنّب الاستبدالات، ما يمنحك أقل تكلفة على 20 عامًا — توفير {cost} مقارنةً ببنوك أصغر مع الاستبدالات.",
  },
  swapsCheaper: {
    en: "Best 20-year price: standard sizing with {replacements} replacement(s) is {cost} cheaper over 20 years than paying upfront to oversize.",
    es: "Mejor precio a 20 años: el dimensionado estándar con {replacements} sustitución(es) es {cost} más barato a 20 años que pagar por adelantado para sobredimensionar.",
    pt: "Melhor preço a 20 anos: o dimensionamento padrão com {replacements} substituição(ões) é {cost} mais barato a 20 anos do que pagar adiantado para superdimensionar.",
    fr: "Meilleur prix sur 20 ans : le dimensionnement standard avec {replacements} remplacement(s) est {cost} moins cher sur 20 ans que de payer d'avance pour surdimensionner.",
    de: "Bester 20-Jahres-Preis: Standardauslegung mit {replacements} Wechsel(n) ist über 20 Jahre {cost} günstiger als die Vorauszahlung für Überdimensionierung.",
    nl: "Beste 20-jaarsprijs: standaard dimensioneren met {replacements} vervanging(en) is over 20 jaar {cost} goedkoper dan vooraf betalen voor overdimensionering.",
    ar: "أفضل سعر على 20 عامًا: القياس القياسي مع {replacements} استبدال(ات) أرخص بـ {cost} على 20 عامًا من الدفع مقدمًا للحجم الزائد.",
  },
  swapsNatural: {
    en: "Best 20-year price: battery bank naturally outlasts the 20-year horizon with zero replacements.",
    es: "Mejor precio a 20 años: el banco de baterías supera de forma natural el horizonte de 20 años sin sustituciones.",
    pt: "Melhor preço a 20 anos: o banco de baterias ultrapassa naturalmente o horizonte de 20 anos com zero substituições.",
    fr: "Meilleur prix sur 20 ans : le parc de batteries dépasse naturellement l'horizon de 20 ans sans aucun remplacement.",
    de: "Bester 20-Jahres-Preis: die Batteriebank überdauert den 20-Jahres-Horizont natürlich ohne Wechsel.",
    nl: "Beste 20-jaarsprijs: de accubank overleeft het 20-jaars horizon natuurlijk zonder vervangingen.",
    ar: "أفضل سعر على 20 عامًا: يتجاوز بنك البطاريات أفق 20 عامًا طبيعيًا دون أي استبدال.",
  },
};
const KEYS = Object.keys(K);
const LOCALES = ["en", "es", "pt", "fr", "de", "nl", "ar"];
for (const key of KEYS) {
  const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  const base = ph(K[key].en);
  for (const loc of LOCALES) {
    if (ph(K[key][loc]) !== base) {
      console.error(`placeholder mismatch ${key}.${loc}`);
      process.exit(1);
    }
  }
}
let src = readFileSync(FILE, "utf8");
for (const loc of LOCALES) {
  const open = new RegExp(`^  ${loc}: \\{`, "m");
  const m = open.exec(src);
  if (!m) throw new Error(`block ${loc} not found`);
  const after = src.slice(m.index + m[0].length);
  const c = /^  \},$/m.exec(after);
  if (!c) throw new Error(`close of ${loc} not found`);
  const at = m.index + m[0].length + c.index;
  const block = KEYS.map((key) => `    ${key}: ${JSON.stringify(K[key][loc])},`).join("\n");
  src = src.slice(0, at) + block + "\n" + src.slice(at);
}
writeFileSync(FILE, src);
console.log("inserted", KEYS.length, "keys x", LOCALES.length, "locales");
