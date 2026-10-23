// Selected label anchors, not a grammar or meaning assessment. Stems allow
// natural compounds and inflections; every shipped locale needs a glossary.
export const TERMINOLOGY_KEYS = Object.freeze({
  battery: [
    "socChartTitle",
    "cumCostTitleBattery",
    "reserveLabel",
    "chemLabel",
  ],
  bill: ["monthlyBillLabel", "heroTitle1"],
  offgrid: ["infeasibleNeedsBatteryTitle", "infeasibleNeedsPanelsTitle"],
});

export const LOCALE_GLOSSARY = Object.freeze({
  en: { battery: "battery", bill: "bill", offgrid: "off-grid" },
  es: { battery: "batería", bill: "factura", offgrid: "fuera de la red" },
  pt: { battery: "bateria", bill: "conta", offgrid: "fora da rede" },
  fr: { battery: "batterie", bill: "facture", offgrid: "hors réseau" },
  de: { battery: "batterie", bill: "stromrechnung", offgrid: "netzunabhängig" },
  nl: { battery: "accu", bill: "rekening", offgrid: "off-grid" },
  ar: { battery: "بطارية", bill: "فاتورة", offgrid: "خارج الشبكة" },
});

const normalise = (text, locale) =>
  typeof text === "string"
    ? text.normalize("NFKC").toLocaleLowerCase(locale)
    : "";

export function checkTerminology(locales, glossary = LOCALE_GLOSSARY) {
  const errors = [];
  let checked = 0;
  let passed = 0;
  for (const [locale, strings] of Object.entries(locales)) {
    for (const [term, keys] of Object.entries(TERMINOLOGY_KEYS)) {
      const anchor = normalise(glossary[locale]?.[term], locale);
      for (const key of keys) {
        checked++;
        if (anchor && normalise(strings?.[key], locale).includes(anchor))
          passed++;
        else errors.push(`${locale}.${key}: missing glossary term ${term}`);
      }
    }
  }
  return {
    checked,
    passed,
    errors,
    locales: Object.keys(locales).length,
    terms: Object.keys(TERMINOLOGY_KEYS).length,
  };
}
