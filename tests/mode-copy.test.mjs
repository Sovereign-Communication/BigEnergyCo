// A systematic sweep of every user-visible surface, in every mode, found copy
// that described a system the run did not have, a number whose sign disagreed
// with the word beside it, and a panel that stayed in the previous language
// after the picker changed. These tests pin each one against the output that is
// live today, so they fail on the old tree rather than on a future edit.
//
// The browser-coupled surfaces (ui.js, charts.js) cannot be imported under
// plain Node, so they are pinned two ways: the pure seams behaviourally (the
// installer-vs-direct sentence through the extraction bridge, against a REAL
// priced four-path comparison; the parts list directly), and the render wiring
// by source, with the rendered result pinned again by the smoke gates that
// drive a real browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { turnkeyQuoteText, pricedFor, entryFor } from "./quote-text-bridge.mjs";
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
const pathBand = (p) =>
  p.year0Low === p.year0High
    ? money(p.year0)
    : moneyRange(p.year0Low, p.year0High);

const LANGS = ["en", "es", "pt", "fr", "de", "ar"];

test("the system-cost range is clearly separated from installed DIY and turnkey estimates", () => {
  assert.match(ui, /t\("pathsPartsOnlyLabel"\)/);
  assert.match(ui, /t\("pathsPriceBasisNote"\)/);
  assert.match(ui, /pathsEstimateDiyHigherReason/);
  for (const lang of LANGS) {
    assert.ok(LOCALES[lang].pathsPartsOnlyLabel, `${lang} parts-only label`);
    assert.ok(LOCALES[lang].pathsPriceBasisNote, `${lang} price-basis note`);
    assert.ok(
      LOCALES[lang].pathsEstimateDiyHigherReason,
      `${lang} higher-DIY explanation`,
    );
    assert.match(
      LOCALES[lang].pathsNoVerifiedIncentive,
      /incentiv|program|subven|aide|förder|حوافز/i,
      `${lang} tells visitors to check local incentive programs`,
    );
  }
});

test("the off-grid BOM labels a daily-load profile as an unknown peak", () => {
  assert.match(ui, /Daily-load profile \(not measured peak\)/);
  assert.match(ui, /profile value; simultaneous peak unknown/);
  assert.match(ui, /OFFGRID_INVERTER_MIN_KW/);
});

// ── the sign has to follow the number ───────────────────────────────────────
//
// This invariant outlived the estimator that broke it. The old sentence
// compared a quote midpoint against an all-in midpoint and could print
// "roughly -$300.00 below a typical quote" for a battery-only build whose real
// all-in was dearer than its real quote. Nothing may describe a negative gap as
// a saving. The fix is structural now — both sides are registry prices, so a
// subtraction of one real price from another is what gets printed — and these
// tests hold the door on it for both sizes.

test("the installer comparison never reads a negative gap as a saving", () => {
  // A battery-only build, the exact shape that used to print the defect.
  const paths = pricedFor(
    entryFor({ pvKw: 0, battKwh: 2.5, servedKwhPerYear: 1400 }),
    { annualBaselineBillsUsd: 900, tariff: 0.3 },
  );
  const text = turnkeyQuoteText(paths, money, moneyRange);
  assert.doesNotMatch(
    text,
    /-\$[\d,]+/,
    `a negative figure must never appear: ${text}`,
  );
  assert.ok(paths.by.diy.available, "the DIY route is priced");
  assert.ok(
    text.includes(pathBand(paths.by.diy)),
    `the sentence uses the DIY path's own price ${pathBand(paths.by.diy)}: ${text}`,
  );
  assert.ok(
    !text.includes(
      moneyRange(
        paths.by.selfpurchase.year0Low,
        paths.by.selfpurchase.year0High,
      ),
    ),
    "the sentence does not substitute the full-electrician self-purchase route",
  );
  const gap =
    (paths.by.turnkey.year0Low + paths.by.turnkey.year0High) / 2 -
    (paths.by.diy.year0Low + paths.by.diy.year0High) / 2;
  if (gap > 0) assert.ok(text.includes(`${money(gap)} lower`));
  else if (gap < 0)
    assert.ok(text.includes(`${money(-gap)} higher than turnkey`));
  else assert.match(text, /same modeled midpoint/);
  assert.match(text, /planning estimates, not quotes/i);
});

test("a whole-home comparison uses the DIY install route", () => {
  const paths = pricedFor(entryFor(), {
    annualBaselineBillsUsd: 2400,
    tariff: 0.3,
  });
  const text = turnkeyQuoteText(paths, money, moneyRange);
  assert.ok(paths.by.diy.available, "the DIY route is priced");
  assert.ok(
    text.includes(pathBand(paths.by.diy)),
    "the explanation quotes the DIY route's price band",
  );
  const gap =
    (paths.by.turnkey.year0Low + paths.by.turnkey.year0High) / 2 -
    (paths.by.diy.year0Low + paths.by.diy.year0High) / 2;
  if (gap > 0) assert.ok(text.includes(`${money(gap)} lower`));
  else if (gap < 0) {
    assert.ok(text.includes(`${money(-gap)} higher than turnkey`));
    assert.match(text, /parts, .*electrician connection, .*permits/i);
  } else assert.match(text, /same modeled midpoint/);
  assert.doesNotMatch(text, /-\$[\d,]+/);
});

test("a DIY midpoint above turnkey is explained with its included cost components", () => {
  const paths = {
    mode: "gridtie",
    by: {
      turnkey: {
        available: true,
        year0: 1000,
        year0Low: 900,
        year0High: 1100,
      },
      diy: {
        available: true,
        year0: 1600,
        year0Low: 1500,
        year0High: 1700,
        hardware: 900,
        labour: 300,
        fees: 250,
        tools: 150,
      },
    },
  };
  const text = turnkeyQuoteText(paths, money, moneyRange);
  assert.match(text, /DIY midpoint is \$600 higher than turnkey/i);
  assert.match(text, /\$900 in parts/);
  assert.match(text, /\$300 for the electrician connection/);
  assert.match(text, /\$250 in permits/);
  assert.match(text, /\$150 for tools and safety/);
});

test("upfront quote comparison uses the visible ranges' arithmetic midpoints", () => {
  const paths = {
    mode: "gridtie",
    by: {
      turnkey: { available: true, year0: 1000, year0Low: 500, year0High: 1500 },
      diy: {
        available: true,
        year0: 1100,
        year0Low: 600,
        year0High: 1200,
        hardware: 500,
        labour: 300,
        fees: 200,
        tools: 100,
      },
    },
  };
  const text = turnkeyQuoteText(paths, money, moneyRange);
  assert.match(text, /DIY midpoint is \$100 lower/i);
});

test("off-grid estimate copy names the excluded generator costs and system lease", () => {
  const paths = pricedFor(entryFor(), {
    mode: "offgrid",
    annualBaselineBillsUsd: 2400,
    tariff: 0.3,
  });
  const text = turnkeyQuoteText(paths, money, moneyRange);
  assert.equal(paths.by.lease.available, true);
  assert.equal(paths.by.lease.endOfTerm.instrument, "lease");
  assert.match(
    text,
    /Off-grid figures cover the selected PV, battery, and inverter/i,
  );
  assert.match(
    text,
    /Generator hardware, transfer equipment, and fuel are excluded/i,
  );
  assert.match(text, /not quotes/i);
});

test("no purchase-path sentence may name a fixed dollar amount it did not price", () => {
  // Both the installed band and the connection cost now come from the
  // registry. The two invented figures the old copy carried are gone with it.
  const paths = pricedFor(entryFor(), {
    annualBaselineBillsUsd: 2400,
    tariff: 0.3,
  });
  const text = turnkeyQuoteText(paths, money, moneyRange);
  assert.doesNotMatch(text, /\$1,500/);
  assert.doesNotMatch(text, /\$3,000/);
  assert.match(text, /planning estimates, not quotes/i);
  assert.match(text, /same system over 20 years/i);
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
  assert.match(ui, /function powerCostRow\(entry, tariff, mode = "gridtie"\)/);
  assert.match(ui, /\[\"Your power cost\", lcoe \+ gridRate\(tariff\)\]/);
  assert.match(ui, /\"Cost per shifted kWh\"/);
  // One owner: no call site may go back to printing the LCOE as "your power
  // cost", which put a figure five times below the tariff beside "never
  // breaks even" and a money bar that says it does not cut what you pay.
  const raw = ui.match(/rows\.push\(\[\s*\"Your power cost\",\s*energyRate\(/);
  assert.equal(raw, null, "a call site still builds the row inline");
  assert.equal(
    (ui.match(/rows\.push\(powerCostRow\(/g) || []).length,
    4,
    "each live card must go through powerCostRow. This was 5 until the dead " +
      "renderAutoCards() came out \u2014 that 232-line function was called from " +
      "nothing but itself, so its call site was unreachable code wearing the " +
      "same uniform. The four that remain are the four that render.",
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
    /function repaintRuntimeCopy\(\) \{[\s\S]{0,900}if \(lastPayload\) renderResults\(lastPayload\);/,
    "the JS-built results panel must be re-rendered from the payload",
  );
  // …and both call sites must reach it: the language change, and the moment the
  // deferred dictionary resolves. The second is what stops a surface being
  // painted with a raw dictionary key before any translation exists.
  assert.match(
    ui,
    /window\.addEventListener\(\"beco:lang\", \(\) => \{\s*repaintRuntimeCopy\(\);/,
    "the language switch must reach the re-render",
  );
  assert.match(
    ui,
    /await applyI18n\(\);[\s\S]{0,400}repaintRuntimeCopy\(\);/,
    "the repaint must also run once the deferred dictionary has resolved",
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

test("off-grid setup and result surfaces use reliability instead of grid-bill claims", () => {
  assert.match(
    ui,
    /selectedUseCase\(\) === "offgrid"[\s\S]{0,120}quickOffgridSetup/,
  );
  assert.match(ui, /paths\.mode === "offgrid"[\s\S]{0,100}pathsRowBillCut/);
  assert.match(
    ui,
    /mode === "offgrid"\) return \["Modeled system energy cost", lcoe\]/,
  );
  assert.match(ui, /p\.mode === "offgrid" \|\| !p\.annualGridSpendUsd/);
  assert.match(
    ui,
    /p\.mode === "offgrid"[\s\S]{0,80}Standalone estimate; no utility-grid bill is used/,
  );
  assert.match(
    charts,
    /if \(p\.mode === "offgrid"\) \{[\s\S]{0,220}wrap\.style\.display = "none";/,
  );
  for (const id of LANGS) {
    assert.match(
      LOCALES[id].quickOffgridSetup,
      /\{kwh\}/,
      `${id}: quickOffgridSetup`,
    );
    assert.ok(
      LOCALES[id].quickOffgridSetup.length > 80,
      `${id}: missing translation`,
    );
  }
});
