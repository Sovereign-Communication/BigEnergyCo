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
test("the 2026-10-24 full meaning back-read fixes stay fixed", () => {
  // One pin per defect fixed in the full back-read of all 436 keys x 6 locales
  // (docs/jev-completion/TRANSLATION_MEANING_BACKREAD_2026-10-24.md). Each
  // assertion fails if the specific unreadable or wrong string it names comes
  // back — the same contract the reviewed-value pins above carry.
  assert.equal(LOCALES.nl.quickSetupTitle, "⚡ Snelle installatie");
  for (const [locale, value] of Object.entries({
    es: "☀️ Dimensionar mi sistema (simulación de 5 años)",
    pt: "☀️ Dimensionar meu sistema (simulação de 5 anos)",
    fr: "☀️ Dimensionner (simulation sur 5 ans)",
    de: "☀️ System dimensionieren (5-Jahres-Simulation)",
    nl: "☀️ Systeem dimensioneren (5-jaarssimulatie)",
    ar: "☀️ احسب نظامي (محاكاة 5 سنوات)",
  })) {
    // The CTA must not lose its marker or change wording between its two
    // states: runBtn is painted before a run, runBtnReady while it runs.
    assert.equal(LOCALES[locale].runBtn, value, `${locale}.runBtn`);
    assert.equal(LOCALES[locale].runBtnReady, value, `${locale}.runBtnReady`);
  }
  for (const locale of ["es", "pt", "fr", "ar"]) {
    assert.ok(
      LOCALES[locale].heroTag.startsWith("🌍 "),
      `${locale}.heroTag lost the marker the other locales carry`,
    );
    assert.ok(
      LOCALES[locale].locBtn.includes("📍"),
      `${locale}.locBtn lost the marker the other locales carry`,
    );
  }
  assert.match(LOCALES.ar.statusSuccess, /البيانات الساعية/);
  assert.doesNotMatch(LOCALES.ar.statusSuccess, /البيانات الساعة[^ي]/);
  assert.match(LOCALES.es.offlineNote, /año típico/);
  assert.match(LOCALES.pt.offlineNote, /ano típico/);
  assert.match(LOCALES.fr.offlineNote, /année type/);
  // The German frontier intro dropped the whole second sentence of the chart
  // explanation; it must carry the budget-reading meaning again.
  assert.match(
    LOCALES.de.frontierIntro,
    /das beste Ergebnis, das jedes Budget kaufen kann/,
  );
  assert.doesNotMatch(LOCALES.es.advisorBusy, /satur ahora/);
  assert.match(LOCALES.de.advisorSubtitle, /Lernschätzungen/);
  assert.doesNotMatch(
    LOCALES.de.sanityTooltip,
    /personenbezogener Daten verlässt/,
  );
  assert.doesNotMatch(LOCALES.ar.metricReserveTradeoff, /بالوفوفير/);
  assert.match(LOCALES.ar.metricReserveTradeoff, /بالوفورات/);
  assert.match(LOCALES.es.pathsOwnershipLease, /^Lo alquilas /);
  assert.doesNotMatch(LOCALES.fr.pathsDiyRestricted, /autoconsommation/);
  assert.match(LOCALES.fr.pathsDiyRestricted, /montage/);
  assert.match(LOCALES.ar.pathsInstrumentPpa, /أنت تشتري الطاقة/);
  // The help texts must quote the button the visitor actually sees.
  for (const [locale, label] of Object.entries({
    en: "Use my precise location",
    de: "Präzisen Standort verwenden",
    nl: "Mijn exacte locatie gebruiken",
  })) {
    assert.ok(
      LOCALES[locale].locationPrecision.includes(label),
      `${locale}.locationPrecision must quote the button label "${label}"`,
    );
    assert.ok(LOCALES[locale].locBtn.includes(label));
  }
  assert.ok(
    LOCALES.ar.quickSetupHint.includes("احسب نظامي"),
    "ar.quickSetupHint must quote the button label",
  );
  assert.ok(
    LOCALES.ar.preciseLocationHelp.includes("احسب نظامي"),
    "ar.preciseLocationHelp must quote the button label",
  );
  // The English source must not carry the spacing artifacts the review fixed.
  for (const key of [
    "applianceWattages",
    "emailSupportExpectations",
    "footerWarranty",
  ]) {
    assert.doesNotMatch(LOCALES.en[key], / ,/, `en.${key} has " ,"`);
  }
  for (const key of [
    "feedInCreditLabel",
    "fixedMonthlyChargeLabel",
    "independenceTarget",
    "billCutTarget",
  ]) {
    assert.ok(LOCALES.en[key].endsWith(":"), `en.${key} must end at the colon`);
    assert.doesNotMatch(LOCALES.en[key], / :$/, `en.${key} has " :"`);
  }
});
