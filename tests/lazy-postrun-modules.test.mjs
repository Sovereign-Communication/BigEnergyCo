import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ui = readFileSync(
  new URL("../assets/js/sizing/ui.js", import.meta.url),
  "utf8",
);

test("post-run modules stay outside the initial UI import graph", () => {
  const modules = ["engine", "charts", "frontier-chart", "rescale"];
  const loaderStart = ui.indexOf("function preloadRunModules()");
  const loader = ui.slice(
    loaderStart,
    ui.indexOf("// Live, quiet feedback", loaderStart),
  );
  assert.ok(
    loaderStart >= 0 && loader.length > 0,
    "the lazy module loader exists",
  );

  for (const name of modules) {
    assert.ok(
      loader.includes('import("./' + name + ".js?v="),
      name + " is loaded dynamically after a result is requested",
    );
    assert.doesNotMatch(
      ui,
      new RegExp("from\\s+[\"\\']\\./" + name + "\\.js"),
      name + " is absent from static imports",
    );
  }

  assert.ok(
    loader.includes("Promise.all"),
    "the result modules begin loading together",
  );
  assert.ok(
    loader.indexOf("_charts.initCharts") >= 0 &&
      loader.indexOf("_charts.setupChartInteractions") >= 0 &&
      loader.indexOf("_charts.setupZoomButtons") >= 0,
    "chart setup happens after the chart module resolves",
  );
});

test("result and selection renderers await their lazy modules", () => {
  for (const name of ["renderResults", "refreshSelectionOutputs"]) {
    const start = ui.indexOf("async function " + name + "(");
    assert.ok(start >= 0, name + " remains async");
    const body = ui.slice(start, start + 180);
    assert.ok(
      body.includes("await preloadRunModules();"),
      name + " waits until its modules are ready",
    );
  }

  assert.doesNotMatch(
    ui,
    /(?<![._])\\b(?:initCharts|setupChartInteractions|setupZoomButtons)\\(\\)/,
    "chart setup is not called before lazy initialization",
  );
});
