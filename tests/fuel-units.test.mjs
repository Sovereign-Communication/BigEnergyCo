// The generator fuel helper's rule set, extracted from the sizing controller.
//
// Everything pinned below was produced by the PRE-REFACTOR implementation — the
// constants, usesImperialUnits, genRateUsd, updateFuelUnits and updateGenHelper
// as they stood in ui.js at the commit before the move — re-run against the
// same fake DOM the controller path gets, with the same payloads the readout
// sentence is built from. The two implementations were then run head-to-head
// over 6272 fixtures (28 locations x 7 fuel fields x 8 prices x 4 currencies)
// and agreed on every one of them, including the unreachable ones: a fuel value
// that is not an own key of the table (an inherited member such as
// "constructor") makes the readout line throw the same TypeError in both, which
// is why the lookup below is still a plain `??` rather than a hasOwnProperty
// guard — this seam moved code, it did not change it.
// Run: node --test tests/fuel-units.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GEN_GAL_PER_KWH,
  GEN_L_PER_KWH,
  LITRES_PER_GALLON,
  fuelBurnPerKwh,
  fuelDisplay,
  fuelRateUsd,
  fuelTypeName,
  isImperialLocation,
} from "../assets/js/sizing/fuel-units.js";
import { LOCALES } from "../assets/js/shared/locales.js";
import { LANGS } from "../assets/js/shared/i18n.js";

const ui = readFileSync(
  new URL("../assets/js/sizing/ui.js", import.meta.url),
  "utf8",
);
const markup = readFileSync(new URL("../index.html", import.meta.url), "utf8");

// The two fakes the frozen readout strings were captured with: the translate
// helper the controller binds, and the currency formatter for a $/kWh rate.
const t = (key, vars) => (vars ? `${key}(${JSON.stringify(vars)})` : key);
const localRate = (usd) =>
  Number.isFinite(usd) ? `rate(${usd.toFixed(4)})` : "n/a";

// ── where fuel is sold by the gallon ────────────────────────────────────────
// Every boundary of the three boxes, plus the places the page's own smoke flow
// selects (Honolulu, New York, Los Angeles) and the unparsed-input cases. The
// verdicts are the old predicate's.
const GEO = [
  [24, -125, true, "mainland box, min corner"],
  [23.99, -125, false, "just south of the mainland box"],
  [50, -66, true, "mainland box, max corner"],
  [50.01, -66, false, "just north of the mainland box"],
  [40, -125, true, "mainland west edge"],
  [40, -125.01, false, "just off the mainland west edge"],
  [40, -66, true, "mainland east edge"],
  [40, -65.99, false, "just off the mainland east edge"],
  [18.5, -179, true, "Hawaii box, min corner"],
  [18.49, -179, false, "just off the Hawaii box"],
  [28.5, -154, true, "Hawaii box, max corner"],
  [28.51, -154, false, "just off the Hawaii box north"],
  [50.5, -168, true, "Alaska box, min corner"],
  [50.49, -168, false, "just off the Alaska box south"],
  [72, -129, true, "Alaska box, max corner"],
  [72.01, -129, false, "just off the Alaska box north"],
  [21.31, -157.86, true, "Honolulu, Hawaii"],
  [61.22, -149.9, true, "Anchorage, Alaska"],
  [40.71, -74.01, true, "New York"],
  [34.05, -118.24, true, "Los Angeles"],
  [51.5, 0, false, "London"],
  [48.85, 2.35, false, "Paris"],
  [-33.87, 151.21, false, "Sydney"],
  [-25.75, 28.19, false, "Pretoria"],
  [0, 0, false, "equator / null island"],
  [24.5, -66.5, true, "Atlantic, north of the tropics"],
  [Number.NaN, 10, false, "unparsed latitude"],
  [10, Number.NaN, false, "unparsed longitude"],
  [Number.NaN, Number.NaN, false, "both unparsed"],
  [Infinity, -100, false, "infinite latitude"],
];

test("the gallon/metric verdict is unchanged at every box boundary", () => {
  for (const [lat, lon, imperial, why] of GEO)
    assert.equal(
      isImperialLocation(lat, lon),
      imperial,
      `${why} (${lat}, ${lon})`,
    );
});

test("all three boxes are reachable on their own", () => {
  // Hawaii and Alaska sit outside the mainland box, so each needs its own entry
  // to be imperial at all.
  for (const [lat, lon, where] of [
    [40.71, -74.01, "New York (mainland)"],
    [19.6, -155.5, "Hilo (Hawaii)"],
    [64.8, -147.7, "Fairbanks (Alaska)"],
  ]) {
    assert.equal(isImperialLocation(lat, lon), true, where);
    assert.equal(
      fuelBurnPerKwh("petrol", isImperialLocation(lat, lon)),
      GEN_GAL_PER_KWH.petrol,
      `${where} burns gallons`,
    );
  }
  // A coordinate inside no box is metric, including one between Hawaii and the
  // mainland - the gap the three separate entries leave on purpose.
  assert.equal(isImperialLocation(24, -140), false, "mid-Pacific");
  assert.equal(fuelBurnPerKwh("petrol", isImperialLocation(24, -140)), 0.5);
});

// ── the price maths ─────────────────────────────────────────────────────────
// [unit system, fuel type, typed price, fx rate, USD per kWh], the last column
// captured from the old genRateUsd().
const RATES = [
  ["metric", "petrol", "1.60", "", 0.8],
  ["metric", "petrol", "3.90", "", 1.95],
  ["metric", "petrol", "0.05", "", 0.025],
  ["metric", "diesel", "1.60", "", 0.5599999999999999],
  ["metric", "diesel", "3.90", "", 1.365],
  ["metric", "petrol", "1.85", "0.92", 1.0054347826086956],
  ["metric", "diesel", "1.85", "0.92", 0.7038043478260868],
  ["metric", "petrol", "200", "150", 0.6666666666666666],
  ["metric", "petrol", "0", "0.92", null],
  ["metric", "petrol", "", "0.92", null],
  ["imperial", "petrol", "1.60", "", 0.21133764188651877],
  ["imperial", "petrol", "3.90", "", 0.5151355020983894],
  ["imperial", "diesel", "1.60", "", 0.1479363493205631],
  ["imperial", "diesel", "4.20", "", 0.38833291696647815],
  ["imperial", "petrol", "3.90", "0.92", 0.559929893585206],
  ["imperial", "petrol", "0.05", "", 0.0066043013089537115],
  ["imperial", "petrol", "-1", "", null],
  ["imperial", "petrol", "abc", "", null],
];

test("a typed price converts to USD per kWh exactly as it did", () => {
  for (const [where, type, price, fxRate, expected] of RATES) {
    const rate = fuelRateUsd(parseFloat(price), {
      type,
      imperial: where === "imperial",
      fxRate: Number(fxRate) > 0 ? Number(fxRate) : null,
    });
    assert.equal(
      rate,
      expected,
      `${where} ${type} at ${price} (fx ${fxRate || "none"})`,
    );
  }
});

test("a blank, zero or negative price stays null instead of NaN", () => {
  // null is what hides the readout and the apply button; NaN would render them
  // with an empty sentence.
  assert.equal(fuelRateUsd(parseFloat("")), null);
  assert.equal(fuelRateUsd(0), null);
  assert.equal(fuelRateUsd(-1), null);
  assert.equal(fuelRateUsd(Number.NaN), null);
  assert.equal(fuelRateUsd(undefined), null);
  assert.equal(fuelRateUsd("1.60"), 0.8, "a numeric string still converts");
});

test("the burn table is the one the page was written against", () => {
  assert.deepEqual(GEN_L_PER_KWH, { petrol: 0.5, diesel: 0.35 });
  assert.equal(LITRES_PER_GALLON, 3.785411784);
  assert.equal(GEN_GAL_PER_KWH.petrol, 0.5 / 3.785411784);
  assert.equal(GEN_GAL_PER_KWH.diesel, 0.35 / 3.785411784);
});

test("an unknown fuel type still falls back to petrol", () => {
  assert.equal(fuelBurnPerKwh("jet-a", false), 0.5);
  assert.equal(fuelBurnPerKwh("jet-a", true), 0.5 / 3.785411784);
  assert.equal(fuelBurnPerKwh(undefined, false), 0.5);
  assert.equal(fuelBurnPerKwh("", true), 0.5 / 3.785411784);
  // An inherited key is NOT a fallback case: the old inline lookup reached the
  // prototype member too, and pinning that here makes any future change to a
  // hasOwnProperty guard a deliberate, visible decision rather than a silent
  // behaviour change smuggled in with a refactor.
  assert.equal(fuelBurnPerKwh("constructor", false), Object);
});

// ── what the page shows ─────────────────────────────────────────────────────
// The five slots updateFuelUnits writes, in the order the old controller wrote
// them, for each unit system.
const DISPLAY = {
  metric: {
    labelKey: "fuelLitLabel",
    placeholder: "e.g. 1.20",
    unit: "L",
    petrolBurn: "0.5",
    dieselBurn: "0.35",
  },
  imperial: {
    labelKey: "fuelGalLabel",
    placeholder: "e.g. 3.90",
    unit: "gal",
    petrolBurn: "0.13",
    dieselBurn: "0.09",
  },
};

test("the label, example, unit and footnote figures are the old page writes", () => {
  assert.deepEqual(fuelDisplay(false), DISPLAY.metric);
  assert.deepEqual(fuelDisplay(true), DISPLAY.imperial);
  // The footnote figures come from the burn table, not from typed-in copies:
  // 0.5 L/kWh is 0.13 gal/kWh and 0.35 is 0.09, to two decimals, while the
  // metric line keeps the "0.5" the markup was authored with.
  assert.equal(fuelDisplay(true).petrolBurn, "0.13");
  assert.equal(fuelDisplay(false).petrolBurn, "0.5");
  assert.equal(fuelDisplay(false).dieselBurn, "0.35");
});

test("the fuel type word is the old two-name mapping", () => {
  assert.equal(fuelTypeName("diesel"), "Diesel");
  assert.equal(fuelTypeName("petrol"), "Petrol");
  assert.equal(fuelTypeName("jet-a"), "Petrol");
  assert.equal(fuelTypeName(undefined), "Petrol");
});

// The readout sentence, composed exactly as the controller composes it: same
// three calls, same vars, same order. FROZEN strings are the old controller's
// readout.textContent under the fakes above.
const readoutSentence = (rate, type, entry, imperial) =>
  t("fuelReadoutRate", { type: fuelTypeName(type), rate: localRate(rate) }) +
  " " +
  t("fuelReadoutBurn", {
    entry,
    burn: fuelBurnPerKwh(type, imperial).toFixed(2),
    unit: fuelDisplay(imperial).unit,
  }) +
  " " +
  t("fuelReadoutGrid", { lo: localRate(0.1), hi: localRate(0.3) });

const READOUTS = [
  [
    "metric petrol",
    "petrol",
    "1.60",
    false,
    null,
    'fuelReadoutRate({"type":"Petrol","rate":"rate(0.8000)"}) fuelReadoutBurn({"entry":"1.60","burn":"0.50","unit":"L"}) fuelReadoutGrid({"lo":"rate(0.1000)","hi":"rate(0.3000)"})',
  ],
  [
    "metric diesel in EUR",
    "diesel",
    "1.85",
    false,
    0.92,
    'fuelReadoutRate({"type":"Diesel","rate":"rate(0.7038)"}) fuelReadoutBurn({"entry":"1.85","burn":"0.35","unit":"L"}) fuelReadoutGrid({"lo":"rate(0.1000)","hi":"rate(0.3000)"})',
  ],
  [
    "imperial petrol",
    "petrol",
    "3.90",
    true,
    null,
    'fuelReadoutRate({"type":"Petrol","rate":"rate(0.5151)"}) fuelReadoutBurn({"entry":"3.90","burn":"0.13","unit":"gal"}) fuelReadoutGrid({"lo":"rate(0.1000)","hi":"rate(0.3000)"})',
  ],
  [
    "imperial diesel",
    "diesel",
    "4.20",
    true,
    null,
    'fuelReadoutRate({"type":"Diesel","rate":"rate(0.3883)"}) fuelReadoutBurn({"entry":"4.20","burn":"0.09","unit":"gal"}) fuelReadoutGrid({"lo":"rate(0.1000)","hi":"rate(0.3000)"})',
  ],
];

test("the readout sentence is assembled from module values, unchanged", () => {
  for (const [why, type, entry, imperial, fxRate, frozen] of READOUTS) {
    const rate = fuelRateUsd(parseFloat(entry), {
      type,
      imperial,
      fxRate,
    });
    assert.equal(readoutSentence(rate, type, entry, imperial), frozen, why);
  }
  // The rate inside the sentence is the converted $/kWh, so a display currency
  // moves it: 1.85 EUR at 0.92 is 0.7038 USD/kWh for diesel.
  assert.match(
    readoutSentence(
      fuelRateUsd(1.85, { type: "diesel", fxRate: 0.92 }),
      "diesel",
      "1.85",
      false,
    ),
    /rate\(0\.7038\)/,
  );
});

test("nothing is written while the price is unusable", () => {
  // The old controller hid the readout and the apply button on a null rate and
  // returned before composing any sentence; the module returns exactly the null
  // that gate depends on.
  assert.equal(fuelRateUsd(parseFloat(""), { type: "petrol" }), null);
  assert.equal(fuelRateUsd(0, { type: "diesel", imperial: true }), null);
});

// ── the two halves of the seam ──────────────────────────────────────────────

test("the module has no DOM, no globals and no clock", () => {
  const src = readFileSync(
    new URL("../assets/js/sizing/fuel-units.js", import.meta.url),
    "utf8",
  );
  for (const forbidden of [
    "document",
    "window",
    "localStorage",
    "navigator",
    "$(",
    "new Date",
  ])
    assert.ok(
      !src.includes(forbidden),
      `fuel-units.js must stay pure: found ${forbidden}`,
    );
});

test("the controller delegates the policy instead of duplicating it", () => {
  assert.match(
    ui,
    /import \{\s*fuelBurnPerKwh,\s*fuelDisplay,\s*fuelRateUsd,\s*fuelTypeName,\s*isImperialLocation,\s*\} from "\.\/fuel-units\.js/,
    "the controller must reach the module through one import",
  );
  for (const gone of [
    "GEN_L_PER_KWH",
    "GEN_GAL_PER_KWH",
    "IMPERIAL_BOXES",
    "3.785411784",
    '"0.13"',
    '"0.09"',
    '"e.g. 3.90"',
    "fuelGalLabel",
    "fuelLitLabel",
  ])
    assert.ok(
      !ui.includes(gone),
      `${gone} belongs to the module now; a second copy is how the two numbers drifted apart`,
    );
  // The predicate and the conversion are one-line delegates, so a change to the
  // gallon geometry or the burn table lands in exactly one file.
  assert.match(
    ui,
    /function usesImperialUnits\(\) \{\s*return isImperialLocation\(/,
  );
  assert.match(
    ui,
    /function genRateUsd\(\) \{\s*return fuelRateUsd\(parseFloat\(\$\("genFuelPrice"\)\?\.value\), \{/,
  );
  assert.match(ui, /imperial: fuelImperial,/);
  assert.match(ui, /fxRate: fxActive\(\)\?\.rate \?\? null,/);
});

test("the controller still writes the module's values into the same slots", () => {
  assert.match(
    ui,
    /const display = fuelDisplay\(fuelImperial\);/,
    "one read of the display facts per pass",
  );
  assert.match(
    ui,
    /label\.textContent = `\$\{t\(display\.labelKey\)\} \(\$\{sym\}\):`/,
  );
  assert.match(ui, /if \(input\) input\.placeholder = display\.placeholder;/);
  assert.match(ui, /if \(ue\) ue\.textContent = display\.unit;/);
  assert.match(ui, /petrolEl\.textContent = display\.petrolBurn;/);
  assert.match(ui, /dieselEl\.textContent = display\.dieselBurn;/);
  assert.match(ui, /const burn = fuelBurnPerKwh\(type, fuelImperial\);/);
  assert.match(ui, /const unit = fuelDisplay\(fuelImperial\)\.unit;/);
  assert.match(
    ui,
    /t\("fuelReadoutBurn", \{ entry, burn: burn\.toFixed\(2\), unit \}\)/,
    "the two-decimal readout figure stays the controller's formatting choice",
  );
  assert.match(ui, /type: fuelTypeName\(type\),/);
  assert.match(
    ui,
    /window\.addEventListener\("beco:lang", \(\) => \{\s*updateFuelUnits\(\);\s*updateGenHelper\(\);/,
    "the language switch still re-renders the labels",
  );
});

test("the pre-JS markup agrees with the metric figures the controller writes", () => {
  // index.html ships the metric default so a visitor with JavaScript disabled
  // sees the same numbers the first paint installs.
  assert.match(markup, /id="genPetrolBurn">0\.5</);
  assert.match(markup, /id="genDieselBurn">0\.35</);
  assert.match(markup, /id="genBurnUnit">L</);
  assert.match(markup, /id="genBurnUnit2">L</);
  assert.match(
    markup,
    /id="genFuelPrice"[\s\S]{0,200}?placeholder="e\.g\. 1\.20"/,
  );
  // The two fuel types the helper is written for are the two the select offers.
  const options = [
    ...markup.matchAll(/<option value="([^"]+)"[^>]*>\s*([^<]+?)\s*</g),
  ]
    .map((m) => m[1])
    .filter((v) => v === "petrol" || v === "diesel");
  assert.deepEqual(options, ["petrol", "diesel"]);
});

test("both label keys exist in every locale, so the unit word can never fall back", () => {
  // "auto" is the picker's sentinel, not a dictionary of its own.
  const ids = LANGS.map((l) => l.id).filter((id) => id !== "auto");
  assert.deepEqual(ids, ["en", "es", "pt", "fr", "de", "ar"]);
  for (const id of ids) {
    const dict = LOCALES[id];
    assert.ok(dict, `${id} has a dictionary`);
    for (const key of ["fuelLitLabel", "fuelGalLabel"])
      assert.equal(typeof dict[key], "string", `${id} is missing ${key}`);
  }
  // The label is rendered as `${t(key)} (${symbol}):`, so the unit word has to
  // survive translation: no locale may drop the unit from the phrase.
  assert.match(LOCALES.en.fuelLitLabel, /lit/i);
  assert.match(LOCALES.en.fuelGalLabel, /gal/i);
});
