// i18n contract: English is the source of truth and must contain every key
// the UI can ask for; other locales fall back to English per key (never
// key-ese) via the t() chain and the data-i18n applier. New strings ship in
// English first — this test forbids dangling references, not untranslated
// strings.
// Run: node --test tests/i18n.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALES } from "../assets/js/shared/locales.js";
import { interpolate, pickString } from "../assets/js/shared/interpolate.js";
import { deployList } from "../scripts/lib/deploy-manifest.mjs";
import { unkeyedProse } from "../scripts/lib/gates.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

test("localized homepage hooks preserve reader-visible claims and live values", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.deepEqual(
    unkeyedProse(html),
    [],
    "every prose block on the translated homepage must have a locale hook",
  );
  assert.match(html, /id="billSliderCur"/, "bill label keeps its live amount");
  assert.match(
    html,
    /id="genPetrolBurn"/,
    "generator label keeps its petrol value",
  );
  assert.match(
    html,
    /id="genDieselBurn"/,
    "generator label keeps its diesel value",
  );
  assert.match(
    html,
    /href="mailto:lucasballek@gmail\.com"/,
    "email link remains actionable",
  );
  assert.match(
    html,
    /href="\.\/solar-calculator\/"/,
    "benchmark link remains actionable",
  );

  for (const [locale, copy] of Object.entries(LOCALES)) {
    assert.match(copy.homeIntro, /5/u, `${locale}: NASA weather window`);
    assert.match(copy.homeIntro, /20/u, `${locale}: payback horizon`);
    const batteryCostNumbers =
      locale === "nl"
        ? ["80", "125", "110", "165", "0,16", "0,38"]
        : ["80", "125", "110", "165", "0.16", "0.38"];
    assert.ok(
      batteryCostNumbers.every((number) =>
        copy.batteryCostClaim.includes(number),
      ),
      `${locale}: DIY, retail, and panel price ranges remain present`,
    );
    for (const key of [
      "bomSafetyNote",
      "paybackClaim",
      "batterySafety",
      "donationTerms",
      "resultEstimateDisclaimer",
      "electricalSafetyDisclaimer",
      "liabilityLimitation",
    ]) {
      assert.ok(
        copy[key].split(/\s+/u).length >= 8,
        `${locale}.${key} remains complete`,
      );
    }
  }
});

function readEnKeys() {
  const src = fs.readFileSync(
    path.join(ROOT, "assets/js/shared/locales.js"),
    "utf8",
  );
  const keys = new Set();
  let depth = 0;
  let inEn = false;
  for (const line of src.split(/\r?\n/)) {
    if (/^  en: \{$/.test(line)) inEn = true;
    else if (/^  \w+: \{$/.test(line) && depth === 1) inEn = false;
    depth +=
      (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    if (inEn && depth >= 2) {
      const k = line.match(/^    (\w+):/);
      if (k) keys.add(k[1]);
    }
  }
  return keys;
}

function jsFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name !== "city-data") jsFiles(p, out);
    } else if (name.endsWith(".js")) out.push(p);
  }
  return out;
}

test("every t() and data-i18n key exists in English", () => {
  const en = readEnKeys();
  assert.ok(en.size > 50, "english source found");
  const used = new Set();
  for (const f of jsFiles(path.join(ROOT, "assets/js"))) {
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(/[^.\w]t\("([A-Za-z0-9_]+)"/g)) used.add(m[1]);
  }
  // Dynamic verdict keys are built as "frontierVerdict<X>" + ("Grid"|"Offgrid"):
  // the scan above only sees the prefix, so pin the ten full keys directly.
  // (Static data-i18n keys are intentionally NOT checked here: English lives
  // in the source markup and the applier keeps it when a dict lacks the key.)
  const dynamicPrefixes = [
    "frontierVerdictCovered",
    "frontierVerdictBeyondSweep",
    "frontierVerdictSteep",
    "frontierVerdictTapering",
    "frontierVerdictLinear",
  ];
  for (const p of dynamicPrefixes) used.delete(p);
  for (const p of dynamicPrefixes) {
    for (const suffix of ["Grid", "Offgrid"]) used.add(p + suffix);
  }
  const missing = [...used].filter((k) => !en.has(k));
  assert.deepEqual(
    missing,
    [],
    `keys referenced but absent from English: ${missing.join(", ")}`,
  );
});

test("advisor chrome is translated in every supported locale", () => {
  const keys = [
    "advisorTitle",
    "advisorSubtitle",
    "advisorIntro",
    "advisorBotNote",
    "advisorThinking",
    "advisorLabel",
    "advisorPlaceholder",
    "advisorSend",
    "advisorClose",
    "advisorBusyRetry",
    "advisorNoReply",
    "advisorBusy",
    "advisorUnreachable",
  ];
  for (const [loc, dict] of Object.entries(LOCALES)) {
    for (const key of keys) {
      assert.equal(typeof dict[key], "string", `${loc}.${key} missing`);
      assert.ok(dict[key].trim().length > 0, `${loc}.${key} empty`);
    }
  }
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /data-i18n="advisorTitle"/);
  assert.match(html, /data-i18n-placeholder="advisorPlaceholder"/);
  assert.match(html, /data-i18n-aria-label="advisorClose"/);
});

// Two locale-file defects that no other gate could see: a string glued
// together from pre-translated fragments in code cannot be reordered for
// another language, and the shipped Arabic advisor title once carried a
// corrupted byte pair (U+FFFD) that survived every existing check.
const FRAGMENT_KEYS = [
  "advisorBusyQuota",
  "advisorBusyWait",
  "advisorUnreachableRetry",
];

test("no locale string carries a lost byte or a split sentence", () => {
  for (const [loc, dict] of Object.entries(LOCALES)) {
    for (const [key, value] of Object.entries(dict)) {
      if (typeof value !== "string") continue;
      assert.ok(
        !value.includes("\uFFFD"),
        `${loc}.${key} carries U+FFFD — a lost byte, not a translation`,
      );
    }
    for (const key of FRAGMENT_KEYS) {
      assert.ok(
        !(key in dict),
        `${loc}.${key} is a sentence fragment — fold it into the key that owns the sentence`,
      );
    }
  }
});

test("runtime advisor copy interpolates through the locale placeholder contract", () => {
  const placeholders = {
    advisorBusy: "{status}",
    advisorBusyRetry: "{secs}",
    advisorUnreachable: "{status}",
  };
  for (const [loc, dict] of Object.entries(LOCALES)) {
    for (const [key, token] of Object.entries(placeholders)) {
      assert.ok(
        dict[key].includes(token),
        `${loc}.${key} must place ${token} where the runtime value belongs`,
      );
    }
  }
  const chat = fs.readFileSync(path.join(ROOT, "assets/js/chat.js"), "utf8");
  assert.match(
    chat,
    /\{ secs: waitSecs \}/,
    "the retry countdown must travel as a placeholder variable",
  );
  assert.match(
    chat,
    /\{ status: err\.status \}/,
    "the HTTP status must travel as a placeholder variable",
  );
});

// Interpolation used to pass the value as a string replacement, so a value
// containing "$&" or "$n" was read as a replacement pattern: the bill-start
// note silently dropped the "$2" of "$200". That defect had to be fixed in two
// separate helpers, which is why this used to pin both files' source. The
// substitution now has one owner (shared/interpolate.js), so the pins point at
// that single place and at the delegation from each reader.
test("interpolation never re-reads a value as a replacement pattern", async () => {
  const { translate, localesReady } =
    await import("../assets/js/shared/i18n.js");
  // The dictionary is a deferred dynamic import, so it must be awaited before
  // anything can be translated.
  await localesReady;
  const rendered = translate("quickBillStarts", { bill: "$200", kwh: 5 });
  assert.ok(
    rendered.includes("$200"),
    `the formatted bill must survive interpolation intact: ${rendered}`,
  );
  const helper = fs.readFileSync(
    path.join(ROOT, "assets/js/shared/interpolate.js"),
    "utf8",
  );
  assert.match(
    helper,
    /replaceAll\(`\{\$\{name\}\}`, \(\) =>/,
    "the replacer must be a function, never a string",
  );
  const i18n = fs.readFileSync(
    path.join(ROOT, "assets/js/shared/i18n.js"),
    "utf8",
  );
  assert.match(
    i18n,
    /return interpolate\(pickString\(dict, key, LOCALES\.en\), vars\);/,
    "i18n.js must delegate instead of substituting on its own",
  );
});

test("German is exposed and has a translated core result vocabulary", () => {
  const src = fs.readFileSync(
    path.join(ROOT, "assets/js/shared/i18n.js"),
    "utf8",
  );
  assert.match(src, /id: "de", label: "Deutsch"/);
  const locale = fs.readFileSync(
    path.join(ROOT, "assets/js/shared/locales.js"),
    "utf8",
  );
  assert.match(locale, /de: \{/);
  assert.match(locale, /navSizing: "System dimensionieren"/);
  assert.match(locale, /frontierTitle:/);
});

test("the locale lookup falls back to English before the raw key", () => {
  const helper = fs.readFileSync(
    path.join(ROOT, "assets/js/shared/interpolate.js"),
    "utf8",
  );
  assert.ok(
    /fallbackDict\?\.\[key\]\s*\?\?\s*key/.test(helper),
    "the lookup must chain locale -> English -> raw key",
  );
  // Behaviorally, not just textually: a key only English carries must read as
  // English, and a key nothing carries must not read as key-ese garbage.
  assert.equal(pickString({}, "navBlog", LOCALES.en), LOCALES.en.navBlog);
  assert.equal(
    pickString({}, "definitelyNotAKey", LOCALES.en),
    "definitelyNotAKey",
  );
  // And the controller must not have grown a second lookup of its own again:
  // that duplication is what let the money bug need fixing twice.
  const ui = fs.readFileSync(path.join(ROOT, "assets/js/sizing/ui.js"), "utf8");
  assert.match(
    ui,
    /translate as t,/,
    "runtime copy binds to the shared lookup",
  );
  assert.doesNotMatch(
    ui,
    /function t\(key, params = \{\}\)/,
    "a local t() would be a second implementation of the same contract",
  );
});

// Locale parity follows the product's English-source contract: every
// translated locale must carry each key defined by the English dictionary.
// Additional locale-specific keys are allowed, and unused missing strings
// continue to fall back to their English/source-markup equivalents.
test("locale parity: every English key exists in each translated locale", () => {
  const englishKeys = Object.keys(LOCALES.en);
  for (const [code, dict] of Object.entries(LOCALES)) {
    if (code === "en") continue;
    const missing = englishKeys.filter((key) => !(key in dict));
    assert.deepEqual(
      missing,
      [],
      `${code} missing English keys: ${missing.join(", ")}`,
    );
  }
});

test("no locale carries a key that no shipped code renders", () => {
  // Parity in BOTH directions. The rule above proves English has no dangling
  // key; this proves the reverse — that a dead string cannot survive by living
  // in a non-English dictionary, which is where four of them (offlineCity,
  // tariffSpend, noTariff, fxNote) were hiding until this branch removed them.
  // It matters because translate() falls back through English: a key only `de`
  // answers is dead for an English visitor AND unrenderable everywhere else.
  //
  // The source set is the deploy allowlist plus every JS module under
  // assets/js and worker — the same net the gate uses, so this test cannot
  // pass where scripts/check-i18n.mjs rule 7 would fail.
  const sources = new Set([...deployList()]);
  const walk = (dir) => {
    for (const name of fs.readdirSync(path.join(ROOT, dir))) {
      const rel = path.join(dir, name);
      if (fs.statSync(path.join(ROOT, rel)).isDirectory()) {
        if (name !== "city-data") walk(rel);
      } else if (name.endsWith(".js") || name.endsWith(".mjs"))
        sources.add(rel);
    }
  };
  walk("assets/js");
  walk("worker");

  let text = "";
  for (const rel of sources) {
    if (rel.endsWith("locales.js")) continue;
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) continue;
    text += fs.readFileSync(full, "utf8");
  }
  const rendered = new Set();
  for (const m of text.matchAll(/["'`]([A-Za-z][A-Za-z0-9_]*)["'`]/g))
    rendered.add(m[1]);

  // frontierVerdict() composes base + a suffix at runtime, so those member
  // names never appear literally; rule 6 proves each family is complete.
  const composed = ["Grid", "Offgrid", "Battery"];
  const everyKey = new Set();
  for (const dict of Object.values(LOCALES))
    for (const key of Object.keys(dict)) everyKey.add(key);

  const dead = [...everyKey].filter(
    (k) => !rendered.has(k) && !composed.some((s) => k.endsWith(s)),
  );
  assert.deepEqual(
    dead,
    [],
    `keys no shipped code renders, in ANY locale: ${dead.join(", ")}`,
  );
});
// ── the use-case card's sentences cannot take the metric fragment ──────────
// Measured on the deployed calculator, 2026-10-14, in every market of the
// worldwide sample (New York, London, Berlin, Tokyo, Lagos, Delhi, Santiago,
// Ho Chi Minh City, Suva, Papeete, Kathmandu): the outcome card a visitor got
// read "Your Cut my electricity bill result", and its footer read "Measured for
// Cut my electricity bill against of your bill removed over 20 years, using
// this location's own hourly weather". Two shapes caused it, and both are
// structural rather than typographic:
//
//   * useCaseVerdictFooter and useCaseNotMeasured interpolated {metric}, whose
//     value is a label-relative fragment ("of your bill removed over 20 years",
//     "what holding a reserve costs, in savings and hours"). A fragment that
//     reads correctly under the number it labels cannot also follow a
//     preposition or a negation, which is the only slot those sentences have;
//   * useCaseOutcomeTitle put the case label — an imperative sentence
//     ("Cut my electricity bill") — into a possessive slot, which no wording of
//     the frame can save.
//
// So the fragment stays where it reads (under the number), and the label stays
// in a slot where it reads as its own sentence (after a colon).
test("cumulative-savings headline and chart callout use translated locale copy", () => {
  const copy = {
    en: {
      headline: "saved over 20 years",
      served: "served by the sun",
      breakEven: "Break-even in year",
      never: "Never breaks even within 20 years",
      shortfall: "Battery replacements outpace bill savings",
    },
    es: {
      headline: "ahorrados en 20 años",
      served: "servidos por el sol",
      breakEven: "Se amortiza en el año",
      never: "No se amortiza en 20 años",
      shortfall: "reemplazos de batería superan el ahorro",
    },
    pt: {
      headline: "economizados em 20 anos",
      served: "atendidos pelo sol",
      breakEven: "O investimento se paga no ano",
      never: "Não se paga em 20 anos",
      shortfall: "trocas da bateria superam a economia",
    },
    fr: {
      headline: "économisés sur 20 ans",
      served: "fournis par le solaire",
      breakEven: "Rentabilité atteinte en année",
      never: "Pas de rentabilité sur 20 ans",
      shortfall: "remplacement des batteries dépasse les économies",
    },
    de: {
      headline: "über 20 Jahre gespart",
      served: "kommen von der Sonne statt aus dem Netz",
      breakEven: "Amortisiert sich in Jahr",
      never: "keine Amortisation",
      shortfall: "Batteriewechsel die Ersparnis",
    },
    nl: {
      headline: "bespaard over 20 jaar",
      served: "door de zon geleverd",
      breakEven: "Terugverdiend in jaar",
      never: "Verdient zichzelf nooit terug",
      shortfall: "Accuvervangingen gaan sneller dan de rekeningsbesparing",
    },
    ar: {
      headline: "توفيرًا على مدى 20 عامًا",
      served: "من الشمس بدلًا من الشبكة",
      breakEven: "يُسترد الاستثمار في السنة",
      never: "لا يُسترد خلال 20 عامًا",
      shortfall: "تتجاوز استبدالات البطارية التوفير في الفاتورة",
    },
  };
  const charts = fs.readFileSync(
    path.join(__dirname, "..", "assets/js/sizing/charts.js"),
    "utf8",
  );
  const keys = [
    "cumSavingsHeadline",
    "cumSavingsServed",
    "cumSavingsBreakEven",
    "cumSavingsNeverBreaksEven",
    "cumSavingsShortfall",
  ];
  for (const key of keys) {
    assert.ok(charts.includes(`t("${key}"`), `${key} is rendered from locales`);
  }
  assert.doesNotMatch(
    charts,
    /saved over 20 years|Break-even in year|Never breaks even within 20 years|Battery replacements outpace bill savings/,
    "the chart must not reintroduce hard-coded English callout copy",
  );

  for (const [locale, dict] of Object.entries(LOCALES)) {
    for (const key of keys) {
      assert.equal(typeof dict[key], "string", `${locale}.${key} missing`);
    }
    assert.ok(
      dict.cumSavingsHeadline.includes("{amount}"),
      `${locale}.cumSavingsHeadline amount placeholder`,
    );
    assert.ok(
      dict.cumSavingsServed.includes("{kwh}"),
      `${locale}.cumSavingsServed kWh placeholder`,
    );
    assert.ok(
      dict.cumSavingsBreakEven.includes("{year}") &&
        dict.cumSavingsBreakEven.includes("{kwhBits}"),
      `${locale}.cumSavingsBreakEven placeholders`,
    );
    assert.ok(
      dict.cumSavingsShortfall.includes("{amount}"),
      `${locale}.cumSavingsShortfall amount placeholder`,
    );
    const expected = copy[locale];
    const renderedHeadline = interpolate(dict.cumSavingsHeadline, {
      amount: "CFPF 1,182,240",
    });
    const renderedServed = interpolate(dict.cumSavingsServed, {
      kwh: "1,687",
    });
    const renderedBreakEven = interpolate(dict.cumSavingsBreakEven, {
      year: 3,
      kwhBits: renderedServed,
    });
    const renderedShortfall = interpolate(dict.cumSavingsShortfall, {
      amount: "CFPF 123,456",
    });
    assert.ok(
      renderedHeadline.includes(expected.headline),
      `${locale} headline should be localized: ${renderedHeadline}`,
    );
    assert.ok(
      renderedBreakEven.includes(expected.breakEven),
      `${locale} break-even should be localized: ${renderedBreakEven}`,
    );
    assert.ok(
      renderedBreakEven.includes(expected.served),
      `${locale} served-energy clause should be localized: ${renderedBreakEven}`,
    );
    assert.ok(
      dict.cumSavingsNeverBreaksEven.includes(expected.never),
      `${locale} no-payback copy should be localized`,
    );
    assert.ok(
      renderedShortfall.includes(expected.shortfall),
      `${locale} shortfall should be localized: ${renderedShortfall}`,
    );
  }
});

test("use-case card sentences do not interpolate the metric fragment", () => {
  const bad = [];
  for (const [lang, dict] of Object.entries(LOCALES)) {
    for (const key of ["useCaseVerdictFooter", "useCaseNotMeasured"]) {
      if (!dict[key]) bad.push(`${lang}.${key} (missing)`);
      else if (/\{metric\}/.test(dict[key])) bad.push(`${lang}.${key}`);
    }
    if (!/\:\s*\{useCase\}/.test(dict.useCaseOutcomeTitle || ""))
      bad.push(`${lang}.useCaseOutcomeTitle (the case must follow a colon)`);
  }
  assert.deepEqual(
    bad,
    [],
    `sentences that interpolate a label or a fragment into a slot that cannot take one: ${bad.join(", ")}`,
  );
});
