// Regressions observed while playtesting the built app in headless Chrome:
// the visible numeric bounds and the sizing guards must agree, and rejected
// values must explain why the worker was not started.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { LOCALES } from "../assets/js/shared/locales.js";

const ui = fs.readFileSync("assets/js/sizing/ui.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const locationSmoke = fs.readFileSync("scripts/smoke/location.js", "utf8");

test("direct kWh sizing enforces the range the form advertises", () => {
  assert.match(html, /id="dailyKwhInput"[\s\S]*?min="0\.5"[\s\S]*?max="500"/);
  assert.match(ui, /directKwh && inp\.dailyKwh < 0\.5/);
  assert.match(ui, /inp\.dailyKwh > 500/);
  assert.match(
    ui,
    /directKwh \|\| inp\.dailyKwh > 500[\s\S]*t\("invalidDailyKwh"\)/,
  );
  assert.match(locationSmoke, /empty kWh entry stays on the form/);
  assert.match(
    locationSmoke,
    /out-of-range coordinates explain the valid bounds/,
  );
  assert.match(locationSmoke, /"0\.1", "501"/);
});

test("share restoration keeps its source hash until all inputs are restored", () => {
  const setCoordsStart = ui.indexOf("function setCoords(");
  const setCoordsEnd = ui.indexOf(
    "// Fill the bill-mode tariff",
    setCoordsStart,
  );
  const setCoords = ui.slice(setCoordsStart, setCoordsEnd);
  assert.match(
    ui,
    /function setCoords\(lat, lon, label, region, country, skipShareUpdate = false\)/,
  );
  assert.match(
    setCoords,
    /if \(!skipShareUpdate\) updateShareHash\(lastPayload, readInputs\(\)\)/,
  );
  const restoreStart = ui.indexOf("function restoreFromShare() {");
  const restoreEnd = ui.indexOf("// -- Printable summary", restoreStart);
  const restore = ui.slice(restoreStart, restoreEnd);
  assert.match(restore, /undefined,\s*undefined,\s*true,/);
  assert.match(restore, /Math\.abs\(lat\) > 90/);
  assert.match(restore, /Math\.abs\(lon\) > 180/);
  assert.match(restore, /kw < 0\.5/);
  assert.match(restore, /kw > 500/);
});

test("background location refinements are tied to the current user choice", () => {
  const location = fs.readFileSync(
    "assets/js/sizing/location-picker.js",
    "utf8",
  );
  assert.match(
    location,
    /export function locateMe\(\{[\s\S]*isCurrent = \(\) => true/,
  );
  assert.match(location, /if \(!isCurrent\(\)\) return;/);
  assert.match(location, /let lookupGeneration = 0/);
  assert.doesNotMatch(location, /lookupBusy/);
  assert.match(ui, /let locationChoiceGeneration = 0/);
  assert.match(ui, /isCurrent: \(\) => locationChoiceGeneration === choice/);
  assert.match(ui, /onQueryChange:[\s\S]*locationChoiceGeneration \+= 1/);
  assert.match(
    ui,
    /const onCoordChange = \(\) => \{[\s\S]*locationChoiceGeneration \+= 1/,
  );
});

test("validation feedback exists in every supported language", () => {
  for (const [locale, strings] of Object.entries(LOCALES)) {
    assert.match(strings.invalidCoordinates, /90/);
    assert.match(strings.invalidCoordinates, /180/);
    assert.match(strings.invalidDailyKwh, /500/);
  }
});
