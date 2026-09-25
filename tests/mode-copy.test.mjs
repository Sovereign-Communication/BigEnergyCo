// A systematic sweep of every user-visible surface, in every mode, found copy
// that described a system the run did not have, a number whose sign disagreed
// with the word beside it, and a panel that stayed in the previous language
// after the picker changed. These tests pin each one against the output that is
// live today, so they fail on the old tree rather than on a future edit.
//
// The browser-coupled surfaces (ui.js, charts.js) cannot be imported under
// plain Node, so they are pinned two ways: the pure seams behaviourally (the
// turnkey estimator through the existing extraction bridge, the parts list
// directly), and the render wiring by source, with the rendered result pinned
// again by the smoke gates that drive a real browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { turnkeyQuoteText } from "./quote-tilt-helpers.mjs";
import { partsListRows } from "../assets/js/sizing/parts-csv.js";
import { LOCALES } from "../assets/js/shared/locales.js";

const ui = readFileSync(
  new URL("../assets/js/sizing/ui.js", import.meta.url),
  "utf8",
);
const charts = readFileSync(
  new URL("../assets/js/sizing/charts.js", import.meta.url),
  "utf8",
);
const markup = readFileSync(new URL("../index.html", import.meta.url), "utf8");

const money = (u) => "$" + Math.round(u).toLocaleString();
const moneyRange = (lo, hi) => money(lo) + "–" + money(hi);

const LANGS = ["en", "es", "pt", "fr", "de", "ar"];

// ── the sign has to follow the number ───────────────────────────────────────

test("the quote comparison says ABOVE when the hookup costs more than the quote", () => {
  // A battery-only build: $165–$591 of hardware, so the quote band (hardware ×
  // 10 … × 5) is $1,700–$3,000 while DIY plus hookup lands $1,700–$3,600. The
  // midpoint comparison is NEGATIVE, and the old copy printed it as
  // "roughly -$300.00 below a typical quote".
  const text = turnkeyQuoteText(
    { costLo: 165, costHi: 591 },
    money,
    moneyRange,
  );
  assert.doesNotMatch(
    text,
    /-\$[\d,]+ below/,
    `a negative delta must never read as a saving: ${text}`,
  );
  assert.match(text, /below a typical quote|ABOVE a typical quote/);
  assert.match(
    text,
    /ABOVE a typical quote/,
    `this system's all-in is above the quote band: ${text}`,
  );
  assert.doesNotMatch(text, /below a typical quote/);
});

test("the quote comparison still says below when the quote really is dearer", () => {
  // A whole-home system: hardware $917–$3,241 against a $9,200–$16,200 quote.
  const text = turnkeyQuoteText(
    { costLo: 917, costHi: 3241 },
    money,
    moneyRange,
  );
  assert.match(text, /below a typical quote/);
  assert.doesNotMatch(text, /ABOVE a typical quote/);
  assert.doesNotMatch(text, /-\$[\d,]+ below/);
});

// ── the parts list must not shop for an array the build has none of ─────────

const BATTERY_ONLY_BOM = {
  chemLabel: "LFP (LiFePO4)",
  panels: null,
  voltage: { volts: 12, rationale: "12 V fits a 1 kW-class inverter" },
  battery: {
    diy: {
      unitLabel: "4S strings of 314 Ah prismatic cells",
      stringsParallel: 1,
      blocksTotal: 4,
      stringKwh: 4,
    },
    retail: { unitLabel: "5.12 kWh rack modules", modules: 1 },
  },
  inverter: { recommendedKw: 1, referenceUnit: "none" },
  controller: null,
  cable: [],
  protection: { mainFuseAmps: 125 },
  notes: [],
};

test("a battery-only parts list omits every PV-only item", () => {
  const csv = partsListRows({
    bom: BATTERY_ONLY_BOM,
    focus: { pvKw: 0, battNameplateKwh: 2.5 },
    meta: { latitude: 21.31, longitude: -157.86 },
    generatedOn: "2026-09-25",
  })
    .map((r) => r.join("|"))
    .join("\n");
  assert.doesNotMatch(
    csv,
    /PV DC Isolator/,
    "a battery-only list must not ask a supplier to ship a PV isolator",
  );
  assert.doesNotMatch(csv, /PV lightning surges/);
  assert.match(csv, /Panels\|None\|0\|Battery-only configuration/);
  // Grounding keeps its row, without the panel rails it cannot ground.
  assert.match(csv, /Equipment Grounding & Bonding/);
  assert.doesNotMatch(csv, /frame rails/);
  assert.match(csv, /battery rack, the inverter chassis/);
});

test("a parts list WITH panels still carries the PV safety items", () => {
  const csv = partsListRows({
    bom: {
      ...BATTERY_ONLY_BOM,
      panels: { panelWatts: 550, count: 6, kwActual: 3.3, areaM2: 19.8 },
    },
    focus: { pvKw: 3.3, battNameplateKwh: 16.1 },
    meta: { latitude: -33.87, longitude: 151.21 },
    generatedOn: "2026-09-25",
  })
    .map((r) => r.join("|"))
    .join("\n");
  assert.match(csv, /PV DC Isolator & Surge Device/);
  assert.match(csv, /frame rails/);
});

// ── the two mode-dependent dictionary strings ──────────────────────────────

test("every locale carries a panel-free simple-mode explainer", () => {
  const sun = {
    en: /solar|panel|sun/i,
    es: /solar|panel|sol\b/i,
    pt: /solar|pain[ée]is|sol\b/i,
    fr: /solaire|panneau|soleil/i,
    de: /solar|paneel|sonne/i,
    ar: /الشمس|الألواح|شمس/,
  };
  for (const id of LANGS) {
    const variant = LOCALES[id]?.simpleWhatItMeansBattery;
    assert.equal(typeof variant, "string", `${id}: simpleWhatItMeansBattery`);
    assert.ok(variant.length > 60, `${id}: battery explainer looks empty`);
    assert.doesNotMatch(
      variant,
      sun[id],
      `${id}: a panel-free run must not be explained with panels`,
    );
    // It must still carry the sizing-data sentence the other variant has.
    assert.match(variant, /weather|meteorol|Wetter|météo|الطقس/i);
  }
});

test("the German caption reads grammatically after its definite article", () => {
  // "für das {which} System" — weak adjective, so -e. The shipped variants were
  // "empfohlenen"/"ausgewählten", which renders "für das empfohlenen System".
  assert.match(LOCALES.de.cumCostCaptionHead, /für das \{which\} System/);
  for (const key of ["cumCostRecommended", "cumCostSelected"]) {
    assert.doesNotMatch(
      LOCALES.de[key],
      /en$/,
      `${key} cannot take the weak -en ending after "das"`,
    );
  }
});

test("every locale carries a battery-only curve method note", () => {
  for (const id of LANGS) {
    const variant = LOCALES[id]?.frontierMethodBattery;
    assert.equal(typeof variant, "string", `${id}: frontierMethodBattery`);
    assert.ok(variant.length > 60, `${id}: battery method note looks empty`);
  }
});

test("the in-sentence best-value range is translated, with the same placeholders", () => {
  const en = LOCALES.en.frontierBestValueRange;
  assert.match(
    en,
    /Best-value range: ~\{lo\}–\{hi\} \(\{loPct\}–\{hiPct\}%\)\./,
  );
  for (const id of LANGS) {
    const v = LOCALES[id]?.frontierBestValueRange;
    assert.equal(typeof v, "string", `${id}: frontierBestValueRange`);
    // A missing translation would ship the English fragment inside a sentence
    // the dictionary built — the one thing a translated verdict must not do.
    for (const ph of ["{lo}", "{hi}", "{loPct}", "{hiPct}"]) {
      assert.ok(v.includes(ph), `${id}: lost ${ph}`);
    }
    if (id !== "en")
      assert.doesNotMatch(v, /Best-value range/, `${id}: untranslated`);
  }
});

// ── the render wiring (pinned again from a real browser by the smoke gates) ──

test("the levelized-cost row is named for what it measures in each mode", () => {
  assert.match(ui, /function powerCostRow\(entry, tariff\)/);
  assert.match(ui, /\[\"Your power cost\", lcoe \+ gridRate\(tariff\)\]/);
  assert.match(ui, /\"Cost per shifted kWh\"/);
  // One owner: no call site may go back to printing the LCOE as "your power
  // cost", which put a figure five times below the tariff beside "never
  // breaks even" and a money bar that says it does not cut what you pay.
  const raw = ui.match(/rows\.push\(\[\s*\"Your power cost\",\s*energyRate\(/);
  assert.equal(raw, null, "a call site still builds the row inline");
  assert.equal(
    (ui.match(/rows\.push\(powerCostRow\(/g) || []).length,
    5,
    "each of the five cards must go through powerCostRow",
  );
});

test("a missing panel footprint can no longer print the word null", () => {
  assert.match(
    ui,
    /const footLine = foot \? foot \+ \" - \" : \"\"/,
    "the print sheet's basis line must guard the null footprint",
  );
  const unguarded = ui.match(
    /\$\{hwEntry \|\| p\.focus \? footprintText\([^)]*\) \+ \" - \"/,
  );
  assert.equal(unguarded, null, "the unguarded concatenation is back");
});

test("the BOS checklist drops its PV items when the build has no PV", () => {
  assert.match(ui, /const hasPv = Boolean\(bom\.panels\)/);
  assert.match(
    ui,
    /\.\.\.\(hasPv\s*\?\s*\[\s*\[\s*\"PV Array Isolator \+ SPD\"/,
  );
  assert.match(
    ui,
    /hasPv\s*\?\s*\"Common earth ground bonding for panel mounting rails/,
  );
  assert.match(ui, /\"Common earth ground bonding for the battery rack/);
});

test("the tilt guide is not advice about an array the run does not build", () => {
  assert.match(
    ui,
    /function renderSunPath\(lat, hasPv = \$\("hardwareConfig"\)\?\.value !== \"battery\"\)/,
  );
  assert.match(ui, /if \(!hasPv\) \{\s*wrap\.style\.display = \"none\";/);
  // The results render passes the RUN's hardware, not the selector's.
  assert.match(
    ui,
    /renderSunPath\(\s*p\.input\?\.latitude[\s\S]{0,80}p\.hardwareConfig !== \"battery\",/,
  );
});

test("the cumulative panel asks the question the run can answer", () => {
  assert.match(markup, /id="cumCostTitle"/);
  assert.match(
    charts,
    /const hasPvRun = p\.hardwareConfig !== \"battery\";/,
    "the title must follow the run, not the chart's fallback entry",
  );
  assert.match(charts, /What does the battery do to your 20-year cost\?/);
  // The legend's emerald key is the system's own line, which on a panel-free
  // run is not a solar one.
  assert.match(charts, /hasPv \? \"Solar system\" : \"Battery only\"/);
});

test("the sun strip is not drawn for a run with no array", () => {
  assert.match(
    charts,
    /export function drawSocChart\(history, chemLabel, hasPv = true\)/,
  );
  assert.match(charts, /hasPv && history\.pvDaily && nDays/);
  assert.match(
    charts,
    /p\.hardwareConfig !== \"battery\" \&\&\s*p\.history &&/,
  );
});

test("the method note describes the sweep the run actually performed", () => {
  assert.match(markup, /id="frontierMethodNote"/);
  assert.match(ui, /methodNote\.setAttribute\("data-i18n", methodKey\)/);
  assert.match(ui, /\"frontierMethodBattery\"/);
});

test("a language switch re-renders the results instead of half-translating them", () => {
  assert.match(
    ui,
    /window\.addEventListener\(\"beco:lang\", \(\) => \{[\s\S]{0,700}if \(lastPayload\) renderResults\(lastPayload\);/,
    "applyI18n only rewrites markup: the JS-built panel must re-render too",
  );
});

test("the best-value range tail is translated, not appended as a literal", () => {
  assert.match(ui, /t\(\"frontierBestValueRange\", \{/);
  assert.doesNotMatch(
    ui,
    /` Best-value range: ~\$\{money\(/,
    "the literal appended English inside a translated verdict",
  );
});

test("the simple card's explainer follows the system it just described", () => {
  assert.match(
    ui,
    /t\(entry\.pvKw > 0 \? \"simpleWhatItMeans\" : \"simpleWhatItMeansBattery\"\)/,
  );
});
