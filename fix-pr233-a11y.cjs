const fs = require("node:fs");
const uiPath = "C:/tmp/be-mission-pr233-20261022/assets/js/sizing/ui.js";
const testPath = "C:/tmp/be-mission-pr233-20261022/tests/a11y-markup.test.mjs";
let ui = fs.readFileSync(uiPath, "utf8").replace(/\r\n/g, "\n");
const clickableStart = ui.indexOf("          const clickable = selectable");
const unsolvableStart = ui.indexOf("          if (!cell || !cell.solvable) {", clickableStart);
if (clickableStart < 0 || unsolvableStart < 0) throw new Error("Could not locate the matrix clickability block");
ui = ui.slice(0, clickableStart) + ui.slice(unsolvableStart);
const lcoeStart = ui.indexOf("          const lcoe = Number.isFinite(cell.lcoeUsdPerKwh)");
const returnStart = ui.indexOf("          return (", lcoeStart);
const returnMarker = "\n          );";
const returnEnd = ui.indexOf(returnMarker, returnStart);
if (lcoeStart < 0 || returnStart < 0 || returnEnd < 0) throw new Error("Could not locate matrix cell rendering");
const replacement = [
'          const pvText = `${cell.pvKw} kW PV`;',
'          const batteryText =',
'            cell.battKwh > 0 ? `${fmt(cell.battKwh)} kWh batt` : "no battery";',
'          const costText = `~${moneyRange(cell.costLo, cell.costHi)}`;',
'          const lifetimeText = `20-yr ~${money(cell.lifetimeCostMid)}`;',
'          const lcoeText = Number.isFinite(cell.lcoeUsdPerKwh)',
'            ? `\\u00B7 ${energyRate(cell.lcoeUsdPerKwh)}`',
'            : "";',
'          const visibleText = [',
'            pvText,',
'            batteryText,',
'            costText,',
'            lifetimeText,',
'            rel,',
'            lcoeText,',
'          ]',
'            .filter(Boolean)',
'            .join(" ");',
'          const clickable = selectable',
'            ? ` data-sel="${key}" role="button" tabindex="0" aria-label="${escapeAttr(`Select ${row.label} at ${col.label}: ${visibleText}`)}" style="cursor:pointer;"`',
'            : "";',
'          const lcoe = lcoeText',
'            ? `<span style="color:var(--text-muted);">${lcoeText}</span>`',
'            : "";',
'          return (',
'            `<td${cls}${clickable}>${pvText}<br>${batteryText}<br>${costText}<br><strong>${lifetimeText}</strong><br>${rel} ${lcoe}</td>`',
'          );',
].join("\n");
ui = ui.slice(0, lcoeStart) + replacement + ui.slice(returnEnd + returnMarker.length);
fs.writeFileSync(uiPath, ui.replace(/\n/g, "\r\n"), "utf8");

let test = fs.readFileSync(testPath, "utf8").replace(/\r\n/g, "\n");
test += [
  "",
  'test("A11Y: selectable matrix-cell names include their visible summary", () => {',
  '  const source = read("assets/js/sizing/ui.js");',
  '  const start = source.indexOf("function matrixHtml(p) {");',
  '  assert.notEqual(start, -1, "the comparison matrix renderer exists");',
  '  const matrix = source.slice(start);',
  '  const labelStart = matrix.indexOf("aria-label=");',
  '  assert.notEqual(labelStart, -1, "selectable cells have an accessible name");',
  '  assert.ok(',
  '    matrix.indexOf("${visibleText}", labelStart) > labelStart,',
  '    "the accessible name includes the cell visible summary",',
  '  );',
  '  for (const visiblePart of [',
  '    "const visibleText = [",',
  '    "pvText,",',
  '    "batteryText,",',
  '    "costText,",',
  '    "lifetimeText,",',
  '    "rel,",',
  '    "lcoeText,",',
  '    "${pvText}<br>${batteryText}<br>${costText}",',
  '  ]) {',
  '    assert.ok(matrix.includes(visiblePart), "matrix rendering includes " + visiblePart);',
  '  }',
  '});',
  "",
].join("\n");
fs.writeFileSync(testPath, test, "utf8");