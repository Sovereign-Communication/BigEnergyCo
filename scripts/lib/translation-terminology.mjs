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

// ── Material quantities ─────────────────────────────────────────────────────
// The one thing a sub-word glossary cannot see: a translation that keeps the
// term but drops the number beside it. The bilingual semantic probe found two
// shipped omissions of exactly this shape (de.firstRunNote lost "~2 MB",
// de.runBtn lost "(5-yr simulation)"), both invisible to every existing gate
// because the term anchors they check carry no digits.
//
// A number may legitimately appear as Eastern Arabic digits or spelled out,
// so those forms are accepted; anything else means the translation dropped a
// figure the reader can see in English.
export const MATERIAL_QUANTITY_KEYS = Object.freeze(["firstRunNote", "runBtn"]);

// Spelled-out forms for the numbers those keys carry. Deliberately narrow: a
// key added here without its locale's spelling fails, which is the reminder to
// extend this map rather than to silence the check.
export const LOCALE_NUMERALS = Object.freeze({
  ar: { 5: ["خمس", "٥"] },
});

const EASTERN_DIGITS = /[\u0660-\u0669\u06f0-\u06f9]/g;
const digitise = (text) =>
  String(text).replace(EASTERN_DIGITS, (d) => String(d.charCodeAt(0) & 0xf));

const hasQuantity = (text, numeral, locale, numerals) => {
  if (new RegExp(`(^|[^0-9])${numeral}([^0-9]|$)`).test(digitise(text)))
    return true;
  return (numerals[locale]?.[numeral] || []).some((word) =>
    text.includes(word),
  );
};

export function checkMaterialQuantities(
  locales,
  keys = MATERIAL_QUANTITY_KEYS,
  numerals = LOCALE_NUMERALS,
) {
  const errors = [];
  let checked = 0;
  let passed = 0;
  const source = locales.en || {};
  for (const [locale, strings] of Object.entries(locales)) {
    if (locale === "en") continue;
    for (const key of keys) {
      const from = source[key];
      const to = strings?.[key];
      if (typeof from !== "string" || typeof to !== "string") continue;
      const wanted = [...new Set(from.match(/[0-9]+/g) || [])];
      if (!wanted.length) continue;
      checked++;
      const missing = wanted.filter(
        (n) => !hasQuantity(to, n, locale, numerals),
      );
      if (missing.length)
        errors.push(
          `${locale}.${key}: missing material quantity ${missing.join(", ")}`,
        );
      else passed++;
    }
  }
  return { checked, passed, errors, keys: keys.length };
}

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
