import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ui = readFileSync(
  new URL("../assets/js/sizing/ui.js", import.meta.url),
  "utf8",
);
const modules = ["engine", "charts", "frontier-chart", "rescale"];

test("post-run modules stay outside the initial UI graph", () => {
  const start = ui.indexOf("function preloadRunModules()");
  const end = ui.indexOf("// Live, quiet feedback", start);
  assert.ok(start >= 0 && end > start);
  const loader = ui.slice(start, end);

  for (const name of modules) {
    assert.ok(
      loader.includes(`import("./${name}.js?v=`),
      `${name} loads on demand`,
    );
    assert.doesNotMatch(ui, new RegExp(`from\\s+["']\\./${name}\\.js`));
  }
  assert.ok(loader.includes("Promise.all"), "result modules load together");
  for (const setup of [
    "initCharts",
    "setupChartInteractions",
    "setupZoomButtons",
  ])
    assert.ok(loader.indexOf(".then(") < loader.indexOf(`_charts.${setup}`));
});

test("result renderers await lazy modules before rendering", () => {
  for (const name of ["renderResults", "refreshSelectionOutputs"]) {
    const start = ui.indexOf(`async function ${name}(`);
    assert.ok(start >= 0, `${name} remains async`);
    assert.ok(
      ui.slice(start, start + 180).includes("await preloadRunModules();"),
    );
  }
  assert.doesNotMatch(
    ui,
    /(?<![._])\b(?:initCharts|setupChartInteractions|setupZoomButtons)\(\)/,
  );
});
