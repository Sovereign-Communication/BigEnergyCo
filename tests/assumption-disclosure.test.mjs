// P1.6 regression: the three modelling choices a visitor cannot see must be
// told on screen with every result, and the export line must not appear where
// export cannot happen.
//
// The plan's clause is exact: "No incentives included", "Electricity prices
// assumed flat for 20 years", "Export credited hourly". Each is a choice the
// visitor did not make; each changes how a number above should be read.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { assumptionDisclosureKeys } from "../assets/js/sizing/mode-chrome.js";

const locales = readFileSync("assets/js/shared/locales.js", "utf8");

test("every result carries the two always-true assumptions", () => {
  assert.deepEqual(assumptionDisclosureKeys({ mode: "gridtie" }).slice(0, 2), [
    "assumeNoIncentives",
    "assumeFlatPrices",
  ]);
  assert.deepEqual(assumptionDisclosureKeys({ mode: "offgrid" }), [
    "assumeNoIncentives",
    "assumeFlatPrices",
  ]);
});

test("the export assumption exists only where export exists", () => {
  assert.ok(assumptionDisclosureKeys({ mode: "gridtie" }).includes("assumeHourlyExport"));
  assert.equal(
    assumptionDisclosureKeys({ mode: "offgrid" }).includes("assumeHourlyExport"),
    false,
    "an off-grid system cannot export, so claiming export credit there would disclose something that never happens",
  );
});

test("every assumption key is translated in all seven locales", () => {
  for (const key of [
    "assumeNoIncentives",
    "assumeFlatPrices",
    "assumeHourlyExport",
  ]) {
    const hits = locales.split(`    ${key}:`).length - 1;
    assert.equal(hits, 7, `${key} must exist in 7 locales, found ${hits}`);
  }
});

test("the disclosure is visible markup, not a collapsed footnote", () => {
  const html = readFileSync("index.html", "utf8");
  const start = html.indexOf('id="assumptionDisclosure"');
  assert.notEqual(start, -1, "the disclosure element must exist");
  const tag = html.slice(html.lastIndexOf("<p", start), start + 200);
  assert.match(tag, /role="note"/);
  // It must sit OUTSIDE the collapsed "How this was calculated" <details>.
  const details = html.lastIndexOf("<details", start);
  const detailsClose = html.indexOf("</details>", details);
  assert.ok(
    detailsClose < start,
    "the disclosure must not live inside the collapsed details block",
  );
});

test("the renderer paints one joined, localized line and hides an empty list", () => {
  const ui = readFileSync("assets/js/sizing/ui.js", "utf8");
  const fn = ui.slice(
    ui.indexOf("function renderAssumptionDisclosure"),
    ui.indexOf("// Surface the climate analysis's darkest 30-day window"),
  );
  assert.match(fn, /assumptionDisclosureKeys/);
  assert.match(fn, /t\(key\)/);
  assert.match(fn, /box\.hidden = keys\.length === 0/);
});
