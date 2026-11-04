// Three defects found by driving the shipped surface at 412px in es/fr, pinned
// so they cannot come back:
//
//  1. the lead-acid savings chip was one unbreakable flex line, so
//     "save ~$25,526.00 + vs lead-acid · skips ~8 swaps" rendered 324px inside a
//     241px parent and `.results-box{overflow:hidden}` cut the tail off;
//  2. five visible UI controls shipped English in every non-English locale
//     because they had no dictionary hook at all (the 2026-11-03 audit's F-4);
//  3. the comparison matrix scrolls sideways on a phone and had no focusable
//     child, so a keyboard could not reach it (WCAG 2.1.1).
//
// Run: node --test tests/mobile-locale-chrome.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALES } from "../assets/js/shared/locales.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const LOCALE_IDS = ["en", "es", "pt", "fr", "de", "nl", "ar"];

// The chrome labels the audit caught rendering English. Each must resolve in
// every shipped locale and must be hooked in the markup, or the dictionary
// value never reaches the screen.
const CHROME_KEYS = [
  "manualModeLabel",
  "manualModeHint",
  "simpleModeLabel",
  "simpleModeHint",
  "mapDrawAction",
];

test("every chrome label exists in all seven locales", () => {
  for (const key of CHROME_KEYS.concat(["matrixScroll"])) {
    for (const lang of LOCALE_IDS) {
      const value = LOCALES[lang]?.[key];
      assert.equal(
        typeof value,
        "string",
        `${lang}.${key} must exist in the dictionary`,
      );
      assert.ok(value.trim().length > 0, `${lang}.${key} must not be empty`);
    }
  }
});

test("chrome labels that read differently per language actually differ", () => {
  // "Manual" is the same word in en/es/pt, so equality alone is not a defect.
  // These three must not fall back to English.
  for (const key of ["simpleModeLabel", "mapDrawAction", "matrixScroll"]) {
    for (const lang of ["es", "pt", "fr", "de", "nl", "ar"]) {
      assert.notEqual(
        LOCALES[lang][key],
        LOCALES.en[key],
        `${lang}.${key} is still the English string`,
      );
    }
  }
});

test("each chrome label is hooked in the markup it renders in", () => {
  const html = read("index.html");
  for (const key of CHROME_KEYS) {
    assert.match(
      html,
      new RegExp(`data-i18n="${key}"`),
      `index.html must carry data-i18n="${key}" so the label is translated`,
    );
  }
  // The map toggle's hook rides on the button, not on a text node inside it.
  assert.match(
    html,
    /id="btnOpenRoofMap"[\s\S]{0,200}?data-i18n="mapDrawAction"/,
    "the optional-map button keeps its label hook",
  );
});

test("the results chip wraps instead of clipping on a phone", () => {
  const ui = read("assets/js/sizing/ui.js");
  const chip = ui.slice(ui.indexOf("const chip = (icon, big, small)"));
  const styleLine = chip.slice(0, chip.indexOf("s.appendChild"));
  assert.match(
    styleLine,
    /flex-wrap:wrap/,
    "the chip container must be allowed to wrap",
  );
  assert.match(
    styleLine,
    /max-width:100%/,
    "the chip must not exceed its parent",
  );
  assert.doesNotMatch(
    styleLine,
    /white-space:nowrap/,
    "nowrap on the whole chip is what clipped ~34px of the savings line",
  );
  // The figure stays atomic: a dollar amount must never break mid-number.
  assert.match(
    ui,
    /font-size:1\.05rem;color:var\(--text-main\);white-space:nowrap;/,
    "the amount itself keeps nowrap so it cannot split across lines",
  );
});

test("the scrollable matrix is reachable by keyboard and named", () => {
  const ui = read("assets/js/sizing/ui.js");
  assert.match(
    ui,
    /class="matrix-wrap" tabindex="0" role="region" aria-label="\$\{escapeAttr\(t\("matrixScroll"\)\)\}"/,
    "the matrix wrap must be focusable and carry a translated name",
  );
  const css = read("assets/site.css");
  assert.match(
    css,
    /\.matrix-wrap:focus-visible\s*\{[^}]*outline:/,
    "a focusable element needs a visible focus indicator",
  );
});

test("the Spanish hero speaks in one register", () => {
  // The shipped H1 paired "Reduce tu factura de luz." (tú) with
  // "Vea exactamente lo que haría falta." (usted). Keep one address.
  const es = LOCALES.es;
  assert.match(es.heroTitle1, /\bReduce\b/, "the first line stays informal");
  assert.doesNotMatch(
    es.heroTitle2,
    /^(Vea|Veamos)\b/,
    "the second line must not switch to the formal address",
  );
  assert.match(
    es.heroTitle2,
    /^Ve\b/,
    "the second line matches the tú imperative",
  );
});
