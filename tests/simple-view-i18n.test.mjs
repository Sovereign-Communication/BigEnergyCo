// E13 pin: Simple mode's runtime copy and the chrome strings that share its
// surface must resolve through the dictionary in every locale. The source scan
// is the invariant a future string has to satisfy: a bare prose literal in the
// view model fails here, which is the class the source audit measured.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { LOCALES } from "../assets/js/shared/locales.js";
import { interpolate } from "../assets/js/shared/interpolate.js";
import { buildSimpleView } from "../assets/js/shared/simple-view.js";
import { modeLabel } from "../assets/js/shared/simple-mode.js";

const KEYS = [
  "simpleSolar",
  "simpleBattery",
  "simpleFirstCost",
  "simplePanels",
  "simpleKwhUsable",
  "simpleKwhInstalled",
  "simpleWhatItDoes",
  "simpleYearCovered",
  "simpleBillCut",
  "simplePeakShift",
  "simpleSaved",
  "simpleNoPayback",
  "simplePayback",
  "simpleModeTechnical",
  "simpleModeAria",
  "simpleHintFeedIn",
  "simpleHintFixed",
  "analysisFullBill",
  "analysisFullSystem",
  "offlineReady",
  "backOnline",
  "offlineBadgeTitle",
];

const fmt = {
  fmt: (n) => String(n),
  money: (n) => "$" + n,
  moneyRange: (a, b) => `$${a}-$${b}`,
  fmtPaybackRange: (a, b) => `${a}-${b}`,
};

const entry = {
  solvable: true,
  pvKw: 5,
  battKwh: 10,
  battNameplateKwh: 12,
  costLo: 1000,
  costHi: 2000,
  cutPct: 60,
  unmetHoursPerYear: 0,
  paybackYearsLo: 5,
  paybackYearsHi: 7,
};

const translator =
  (locale) =>
  (key, vars = {}) =>
    interpolate(LOCALES[locale][key], vars);

test("every Simple-mode runtime key exists in all seven locales", () => {
  for (const locale of Object.keys(LOCALES)) {
    for (const key of KEYS) {
      assert.equal(
        typeof LOCALES[locale][key],
        "string",
        `${locale}.${key} is missing`,
      );
      assert.ok(
        LOCALES[locale][key].trim().length > 0,
        `${locale}.${key} is empty`,
      );
    }
  }
});

test("a grid-tie Simple view renders fully localized in every locale", () => {
  for (const locale of Object.keys(LOCALES)) {
    const t = translator(locale);
    const view = buildSimpleView({
      p: { mode: "gridtie" },
      entry,
      saved: 5000,
      fmt,
      t,
    });
    assert.equal(view.feasible, true);
    assert.equal(view.heroes.length, 5);
    assert.equal(view.heroes[0].label, LOCALES[locale].simpleSolar);
    assert.equal(view.heroes[1].label, LOCALES[locale].simpleBattery);
    assert.equal(view.heroes[2].label, LOCALES[locale].simpleFirstCost);
    assert.equal(view.heroes[3].label, LOCALES[locale].simpleWhatItDoes);
    assert.equal(view.heroes[4].label, LOCALES[locale].simpleSaved);
    for (const hero of view.heroes) {
      assert.doesNotMatch(
        `${hero.label} ${hero.value} ${hero.sub || ""}`,
        /\{[a-zA-Z]+\}/,
        `${locale}: an interpolation placeholder reached the DOM`,
      );
    }
    if (locale !== "en") {
      assert.notEqual(
        view.heroes[1].label,
        "Battery",
        `${locale}: the battery label is still English`,
      );
      assert.notEqual(
        view.heroes[2].label,
        "First cost",
        `${locale}: the first-cost label is still English`,
      );
    }
  }
});

test("off-grid and battery-only Simple views localize their goal sentences", () => {
  for (const locale of Object.keys(LOCALES)) {
    const t = translator(locale);
    const offgrid = buildSimpleView({
      p: { mode: "offgrid" },
      entry,
      saved: 1000,
      fmt,
      t,
    });
    const battery = buildSimpleView({
      p: { mode: "gridtie" },
      entry: { ...entry, pvKw: 0, cutPct: 30 },
      saved: 0,
      fmt,
      t,
    });
    assert.match(offgrid.heroes[3].value, /%/, `${locale}: coverage percent`);
    assert.match(battery.heroes[2].value, /%/, `${locale}: shift percent`);
    assert.equal(
      battery.heroes[3].value,
      LOCALES[locale].simpleNoPayback,
      `${locale}: the no-payback sentence is not localized`,
    );
  }
});

test("the Simple mode label and chrome strings are dictionary lookups", () => {
  assert.equal(modeLabel(true, translator("es")), "Modo simple");
  assert.equal(modeLabel(false, translator("fr")), "Mode technique");
  const ui = fs.readFileSync("assets/js/sizing/ui.js", "utf8");
  for (const literal of [
    "Full bill-cut analysis",
    "Full system analysis",
    "Offline Ready",
    "Back Online",
    "Working offline using cached app data & local weather simulation",
  ]) {
    assert.ok(
      !ui.includes(literal),
      `ui.js still ships the unkeyed chrome literal: ${literal}`,
    );
  }
  for (const key of ["analysisFullBill", "analysisFullSystem"]) {
    assert.ok(ui.includes(`"${key}"`), `ui.js does not name ${key}`);
  }
  assert.match(
    ui,
    /t\(\s*p\.mode === "gridtie"[\s\S]{0,160}"analysisFullBill"/,
    "the analysis title must pass its mode-selected key through t()",
  );
  for (const key of [
    "offlineReady",
    "backOnline",
    "offlineBadgeTitle",
    "simpleHintFeedIn",
    "simpleHintFixed",
    "simpleModeAria",
  ]) {
    assert.ok(ui.includes(`t("${key}"`), `ui.js does not render ${key}`);
  }
});

test("the language switch repaints the Simple mode chrome", () => {
  // The toggle's aria-label is built from modeLabel(…, t); a beco:lang switch
  // that only repaints the card leaves that label in the previous language.
  const ui = fs.readFileSync("assets/js/sizing/ui.js", "utf8");
  assert.match(
    ui,
    /addEventListener\("beco:lang"[\s\S]{0,320}?applySimpleMode\(\)/,
    "beco:lang must repaint the Simple mode toggle, not only the results",
  );
});

test("ui.js passes the translator into the Simple view render", () => {
  // The view model requires `t`; this call site is the one the real page uses,
  // and omitting it made every Simple result throw "t is not a function" after
  // the simulation had already finished.
  const ui = fs.readFileSync("assets/js/sizing/ui.js", "utf8");
  assert.match(
    ui,
    /buildSimpleView\(\{[\s\S]{0,320}?\bt,\s*\}\)/,
    "buildSimpleView must receive the translator at the render call site",
  );
});

test("the Simple view model carries no bare prose literals", () => {
  const src = fs
    .readFileSync("assets/js/shared/simple-view.js", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  // Drop the translator calls, then anything left that is a multi-word quoted
  // string is prose that skipped the dictionary.
  const withoutCalls = src.replace(
    /t\(\s*"[^"]+"\s*(?:,\s*\{[^}]*\}\s*)?\)/g,
    "",
  );
  const bare = [...withoutCalls.matchAll(/"([^"\n]{10,})"/g)]
    .map((m) => m[1])
    .filter((s) => /\s/.test(s) && /[a-z]/i.test(s));
  assert.deepEqual(bare, [], `bare prose literals: ${bare.join(" | ")}`);
  assert.ok(
    (src.match(/\bt\("/g) || []).length >= 12,
    "every label and sentence must go through t()",
  );
});
