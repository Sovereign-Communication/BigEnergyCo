import test from "node:test";
import assert from "node:assert/strict";
import { LOCALES } from "../assets/js/shared/locales.js";

test("reviewed error and advisor copy preserves the English meaning", () => {
  assert.equal(
    LOCALES.es.advisorDegradedWhyUnavailable,
    "el servicio no ha respondido",
  );
  assert.equal(
    LOCALES.pt.advisorDegradedWhyUnavailable,
    "o serviço não respondeu",
  );
  assert.equal(
    LOCALES.pt.advisorDegradedWhyNoKey,
    "não há uma chave de modelo configurada, então o consultor fica desativado intencionalmente",
  );
  assert.equal(
    LOCALES.fr.advisorDegradedWhyUnavailable,
    "le service n’a pas répondu",
  );
  assert.equal(
    LOCALES.de.advisorDegradedWhyUnavailable,
    "der Dienst reagiert nicht",
  );
  assert.equal(
    LOCALES.nl.advisorDegradedWhyUnavailable,
    "de dienst reageert niet",
  );
  assert.equal(LOCALES.ar.advisorDegradedWhyUnavailable, "الخدمة لم تستجب");
  assert.equal(
    LOCALES.ar.advisorDegradedWhyNoKey,
    "لم يتم إعداد مفتاح للنموذج، لذا فالمستشار غير متصل عمدًا",
  );
  assert.match(LOCALES.ar.advisorIntro, /كيمياء البطارية/);
  assert.match(LOCALES.ar.frontierNoSystem, /ما لا تصل إليه الشمس/);
  assert.match(LOCALES.ar.frontierColRange, /تجميع ذاتي/);
  assert.match(LOCALES.ar.frontierLegendBand, /نظام كامل/);
  assert.match(LOCALES.de.invalidDailyKwh, /kreuze die Geräte an/);
  assert.match(
    LOCALES.nl.frontierVerdictCoveredOffgrid,
    /maar levert geen extra onafhankelijkheid op/,
  );
  assert.match(
    LOCALES.es.simpleAdvisorStyle,
    /termina con un único número: el más importante/,
  );
});

test("localized frontier copy retains the delivered DIY midpoint and method", () => {
  // English names a midpoint for DIY components after shipping and duty.
  // The same local term must survive in the caption and both pricing notes.
  const terms = {
    es: "aranceles",
    pt: "impostos de importação",
    fr: "droits de douane",
    de: "Einfuhrabgaben",
    nl: "invoerrechten",
    ar: "الرسوم الجمركية",
  };
  for (const [locale, dutyTerm] of Object.entries(terms)) {
    for (const key of [
      "frontierTableCaption",
      "frontierMethod",
      "frontierMethodBattery",
    ]) {
      assert.ok(
        LOCALES[locale][key].includes(dutyTerm),
        `${locale}.${key} must preserve the import-duty detail`,
      );
    }
  }
  assert.match(
    LOCALES.de.frontierMethod,
    /jede Kombination aus Modulen und Batterie/,
  );
  assert.match(LOCALES.de.frontierMethod, /kein günstigeres System übertrifft/);
});

test("frontier range labels do not leak English DIY or retail terms", () => {
  const markers = {
    es: {
      range: "Montaje propio",
      legend: "montar por cuenta propia",
      retail: "por menor",
    },
    pt: {
      range: "Montagem própria",
      legend: "montagem própria",
      retail: "varejo",
    },
    fr: {
      range: "Montage soi-même",
      legend: "monter soi-même",
      retail: "livrés au détail",
    },
  };
  for (const [locale, terms] of Object.entries(markers)) {
    assert.doesNotMatch(
      LOCALES[locale].frontierColRange,
      /\b(?:DIY|retail)\b/i,
      `${locale}.frontierColRange must use local wording`,
    );
    assert.doesNotMatch(
      LOCALES[locale].frontierLegendBand,
      /\b(?:DIY|retail)\b/i,
      `${locale}.frontierLegendBand must use local wording`,
    );
    assert.ok(LOCALES[locale].frontierColRange.includes(terms.range));
    assert.ok(LOCALES[locale].frontierLegendBand.includes(terms.legend));
    assert.ok(LOCALES[locale].frontierLegendBand.includes(terms.retail));
  }
});
