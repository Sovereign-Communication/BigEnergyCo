// Behavioral contract for the extracted chart module (charts.js) and the
// module graph it forms with ui.js. The extraction once shipped a missing
// drawSocChart export — a browser link error no source-regex test could see,
// because ui.js source still reads fine while the page is dead — so the graph
// itself is under test: every name ui.js imports must exist, and the export
// surface must be exactly its consumers.
//
// The import below binds the SAME stamped instance the app loads (Node treats
// a `?v=` specifier as a distinct module — see tests/location-picker.test.mjs).
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

// Documented surface beyond ui.js's needs: the pure seams this file tests,
// the cumulative-caption composer (tests/cum-cost-caption.test.mjs reads the
// words a visitor gets, which needs no canvas and no DOM), and the palette
// (one home; chart legends are its only consumers).
const SEAMS = ["computeZoomSpan", "findWorstStreak", "cumCostCaptionText"];
const PALETTE = ["TIER_COLORS", "TIER_NAMES"];

test("MODULE GRAPH: every name ui.js imports exists in charts.js", () => {
  for (const name of uiImports) {
    assert.ok(
      name in charts,
      `charts.js must export ${name} (ui.js imports it)`,
    );
  }
});

test("MODULE GRAPH: the export surface is exactly its consumers", () => {
  assert.deepEqual(
    Object.keys(charts).sort(),
    [...new Set([...uiImports, ...SEAMS, ...PALETTE])].sort(),
  );
});

test("OWNERSHIP: the tier palette has one home — ui.js may consume it but never redeclares it", () => {
  assert.ok(!/(const|let|var)\s+TIER_(COLORS|NAMES)\b/.test(uiSrc));
});

test("BOUNDARY: nothing charts.js calls may live only in ui.js (the el/fmt class)", () => {
  // The extraction shipped `el`/`fmt` calls inside charts.js while both
  // helpers were defined only in ui.js — a ReferenceError at first render,
  // invisible to node --check and to the export pin. Any top-level ui.js
  // helper that charts.js calls must be reachable: declared here, imported
  // here, or injected through initCharts.
  const chartsSrc = readFileSync(
    new URL("../assets/js/sizing/charts.js", import.meta.url),
    "utf8",
  ).replace(/\/\/[^\n]*/g, "");
  const uiHelpers = new Set(
    [...uiSrc.matchAll(/^function\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]),
  );
  const reachable = new Set();
  for (const m of chartsSrc.matchAll(
    /(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g,
  ))
    reachable.add(m[1]);
  for (const m of chartsSrc.matchAll(/import\s*\{([^}]*)\}/g))
    m[1].split(",").forEach((s) => reachable.add(s.trim()));
  const injected = chartsSrc.match(/initCharts\(\{([^}]*)\}\)/);
  assert.ok(injected, "charts.js must take its boundary via initCharts");
  injected[1].split(",").forEach((s) => reachable.add(s.trim()));
  for (const name of uiHelpers) {
    const called = new RegExp(`\\b${name}\\s*\\(`).test(chartsSrc);
    if (called)
      assert.ok(
        reachable.has(name),
        `charts.js calls ${name}() but only ui.js defines it — declare, import, or inject it`,
      );
  }
});

test("BOUNDARY R2: every forwarding wrapper is backed by initCharts' destructure", () => {
  // A wrapper whose _target is never assigned forwards to undefined — an
  // infinite recursion or TypeError at first render. Tooth: dropping fmt
  // from the destructure turns this red.
  const chartsSrc = readFileSync(
    new URL("../assets/js/sizing/charts.js", import.meta.url),
    "utf8",
  );
  const destr = chartsSrc.match(/initCharts\(\{([^}]*)\}\)/);
  assert.ok(destr, "charts.js must take its boundary via initCharts");
  const injected = new Set(
    destr[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const assignments = new Map(
    [...chartsSrc.matchAll(/(_[\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*;/g)].map(
      (m) => [m[1], m[2]],
    ),
  );
  const wrappers = [
    ...chartsSrc.matchAll(
      /function ([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*return _([A-Za-z_$][\w$]*)\s*\(/g,
    ),
  ];
  assert.ok(wrappers.length >= 5, "the five boundary wrappers must exist");
  for (const [, name, target] of wrappers) {
    // target is the name after the "return _" prefix — must equal the wrapper name
    assert.equal(target, name, `wrapper ${name} must forward to _${name}`);
    assert.ok(
      injected.has(name) && assignments.get(`_${name}`) === name,
      `wrapper ${name}() is not backed by initCharts — add ${name} to its destructure`,
    );
  }
});

test("BOUNDARY R3: ui.js passes exactly the boundary charts.js destructures", () => {
  // Tooth: dropping a name from one side only turns this red.
  const chartsSrc = readFileSync(
    new URL("../assets/js/sizing/charts.js", import.meta.url),
    "utf8",
  );
  const destr = chartsSrc.match(/initCharts\(\{([^}]*)\}\)/);
  const call = uiSrc.match(/initCharts\(\{([^}]*)\}\)/);
  assert.ok(destr && call, "both sides must wire initCharts");
  const names = (s) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .sort();
  assert.deepEqual(
    names(call[1]),
    names(destr[1]),
    "ui.js must pass exactly the boundary charts.js destructures",
  );
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
