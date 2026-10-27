// Exercise the stamped chart module the same way ui.js loads it, plus the
// chart-copy contract visitors and assistive technology read after a render.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const uiSrc = readFileSync(
  new URL("../assets/js/sizing/ui.js", import.meta.url),
  "utf8",
);
const block = uiSrc.match(
  /import \{([^}]*)\} from "\.\/charts\.js\?v=([^"]+)";/,
);
assert.ok(block, "ui.js must import the stamped charts module");
const uiImports = block[1]
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const charts = await import(
  new URL(`../assets/js/sizing/charts.js?v=${block[2]}`, import.meta.url).href
);

test("MODULE GRAPH: every name ui.js imports exists in charts.js", () => {
  for (const name of uiImports) {
    assert.ok(
      name in charts,
      `charts.js must export ${name} (ui.js imports it)`,
    );
  }
});

function makeChartNode() {
  const context = new Proxy(
    {},
    {
      get: (target, key) =>
        target[key] ??
        (key === "createLinearGradient"
          ? () => ({ addColorStop() {} })
          : () => {}),
      set: (target, key, value) => ((target[key] = value), true),
    },
  );
  return {
    style: {},
    attributes: {},
    clientWidth: 640,
    textContent: "fallback",
    setAttribute(key, value) {
      this.attributes[key] = value;
    },
    appendChild() {},
    getContext: () => context,
  };
}

function withCharts(run) {
  const nodes = new Map();
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, makeChartNode());
    return nodes.get(id);
  };
  const oldWindow = globalThis.window;
  globalThis.window = { devicePixelRatio: 1, innerWidth: 800 };
  charts.initCharts({
    $: get,
    el: makeChartNode,
    t: (key) => key,
    fmt: String,
    money: (value) => `$${Math.round(value)}`,
  });
  try {
    run(get);
  } finally {
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
  }
}

test("chart renders replace fallback text and label the rendered systems", () => {
  withCharts(($) => {
    const history = {
      kind: "gridtie",
      startYear: 2024,
      endYear: 2024,
      days: 2,
      tiers: [
        {
          id: "tier100",
          dailyMin: [70, 65],
          dailyMax: [100, 100],
          fullDays: 2,
          totalDays: 2,
          minPct: 65,
          emptyDays: 0,
        },
      ],
    };
    const auto = {
      history,
      auto: ["LFP", "Sodium-ion"].map((chemLabel, index) => ({
        chemistry: index ? "naion" : "lfp",
        chemLabel,
        solvable: true,
        battNameplateKwh: 10,
        replacementsHorizon: 0,
        socNameplatePct: { min: [70, 65], max: [100, 100] },
      })),
    };
    const entry = (chemLabel, pvKw) => ({
      chemistry: "lfp",
      chemLabel,
      pvKw,
      cumCostSeries: {
        years: 2,
        grid: [2000, 4000],
        solar: [2500, 3500],
        system: [1200, 1200],
      },
    });
    const cases = [
      [
        "socCanvas",
        "Battery charge chart for LFP.",
        () => charts.drawSocChart(history, "LFP"),
      ],
      [
        "socCanvas",
        "Battery charge chart for AGM.",
        () => charts.drawSocChart(history, "AGM"),
      ],
      [
        "socCanvas",
        "Battery charge comparison chart for LFP, Sodium-ion.",
        () => charts.drawAutoChart(auto),
      ],
      [
        "cumCostCanvas",
        "Cumulative 20-year cost chart for LFP (5 kW solar).",
        () =>
          charts.drawCumCostChart(
            { hardwareConfig: "solar", tariff: 0.2 },
            entry("LFP", 5),
          ),
        /solar really save you/i,
      ],
      [
        "cumCostCanvas",
        "Cumulative 20-year cost chart for Sodium-ion (battery only).",
        () =>
          charts.drawCumCostChart(
            { hardwareConfig: "battery", tariff: 0.2 },
            entry("Sodium-ion", 0),
          ),
        /battery do to your 20-year cost/i,
      ],
    ];

    for (const [id, expected, draw, title] of cases) {
      draw();
      const canvas = $(id);
      assert.equal(canvas.textContent, expected);
      assert.equal(canvas.attributes["aria-label"], expected);
      if (title) assert.match($("cumCostTitle").textContent, title);
    }
  });
});

// ── computeZoomSpan: the exact zoom computation ────────────────────────────

test("computeZoomSpan: zooming in from full view centers the new span", () => {
  assert.deepEqual(charts.computeZoomSpan(null, 365, 0.5), {
    start: 91,
    end: 273,
  });
});

test("computeZoomSpan: full view is a sentinel — zooming out there returns null", () => {
  assert.equal(charts.computeZoomSpan(null, 365, 1), null);
  assert.equal(charts.computeZoomSpan(null, 365, 2), null);
});

test("computeZoomSpan: the span clamps at 14 days and hugs both edges", () => {
  // a 5-day span can only grow back to the 14-day floor…
  assert.deepEqual(charts.computeZoomSpan({ start: 0, end: 5 }, 365, 0.5), {
    start: 0,
    end: 14,
  });
  // …and near the right edge that floor slides left along the axis
  assert.deepEqual(charts.computeZoomSpan({ start: 358, end: 363 }, 365, 0.5), {
    start: 350,
    end: 364,
  });
  // deep zoom stops at the floor instead of collapsing to a single day
  assert.deepEqual(charts.computeZoomSpan({ start: 200, end: 201 }, 365, 0.5), {
    start: 194,
    end: 208,
  });
});

test("computeZoomSpan: a corrupt span falls back to the full view", () => {
  assert.deepEqual(
    charts.computeZoomSpan({ start: NaN, end: NaN }, 365, 0.5),
    charts.computeZoomSpan(null, 365, 0.5),
  );
});

// ── findWorstStreak: the worst-window algorithm ─────────────────────────────

test("findWorstStreak: the deepest single dip wins over a lower-average window", () => {
  // window 3 has the lowest sum (24) but window 0 holds the one 0° night
  assert.equal(charts.findWorstStreak([0, 9, 9, 8, 8, 8], 3), 0);
});

test("findWorstStreak: equal dips break to the lower-sum window; full ties keep the first", () => {
  assert.equal(charts.findWorstStreak([5, 0, 5, 4, 0, 5], 3), 1);
  assert.equal(charts.findWorstStreak([5, 5, 5, 5], 2), 0);
});

test("findWorstStreak: boundaries return 0 and the window defaults to 30 days", () => {
  assert.equal(charts.findWorstStreak(null), 0);
  assert.equal(charts.findWorstStreak([5, 5, 5]), 0); // length <= windowSize
  const days = new Array(40).fill(5);
  days[35] = 0; // only windows 6..10 hold day 35 → they tie → first (6)
  assert.equal(charts.findWorstStreak(days), 6);
  assert.equal(charts.findWorstStreak(days), charts.findWorstStreak(days, 30));
});
