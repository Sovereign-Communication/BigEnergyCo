// Tests for assets/js/heatmap-palette.js — the shared color module.
//
// The build script (scripts/build-heatmap-images.mjs) renders PNGs with these
// exact functions, and the live map uses them for canvas dots. These tests pin
// the color scale so a palette change is deliberate, not accidental.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Load the UMD palette the same way the build script does.
const _m = { exports: {} };
{
  const src = readFileSync(
    join(ROOT, "assets", "js", "heatmap-palette.js"),
    "utf8",
  );
  const module = _m;
  eval(src);
}
const P = _m.exports;

test("palette exports all required functions", () => {
  for (const fn of [
    "costColor",
    "costTextColor",
    "yearColor",
    "costLabel",
    "yearLabel",
    "getPointCost",
    "getPointYears",
    "dotColor",
    "hexToRgb",
    "pointLat",
    "pointLon",
  ]) {
    assert.equal(typeof P[fn], "function", fn);
  }
});

test("costColor buckets match the documented scale", () => {
  assert.equal(P.costColor(0.05), "#00e699");
  assert.equal(P.costColor(0.1), "#00e699");
  assert.equal(P.costColor(0.15), "#7ec850");
  assert.equal(P.costColor(0.18), "#7ec850");
  assert.equal(P.costColor(0.25), "#c8b400");
  assert.equal(P.costColor(0.28), "#c8b400");
  assert.equal(P.costColor(0.35), "#e68a00");
  assert.equal(P.costColor(0.4), "#e68a00");
  assert.equal(P.costColor(0.5), "#e64545");
  assert.equal(P.costColor(0.55), "#e64545");
  assert.equal(P.costColor(0.8), "#991b1b");
  assert.equal(P.costColor(null), "#555555");
  assert.equal(P.costColor(undefined), "#555555");
  assert.equal(P.costColor(0), "#555555");
  assert.equal(P.costColor(-1), "#555555");
});

test("yearColor buckets match the documented scale", () => {
  assert.equal(P.yearColor(1), "#00e699");
  assert.equal(P.yearColor(2), "#00e699");
  assert.equal(P.yearColor(2.5), "#7ec850");
  assert.equal(P.yearColor(3), "#7ec850");
  assert.equal(P.yearColor(4), "#c8b400");
  assert.equal(P.yearColor(5), "#c8b400");
  assert.equal(P.yearColor(6), "#e68a00");
  assert.equal(P.yearColor(7), "#e68a00");
  assert.equal(P.yearColor(10), "#e64545");
  assert.equal(P.yearColor(12), "#e64545");
  assert.equal(P.yearColor(20), "#888888");
  assert.equal(P.yearColor(null), "#555555");
});

test("getPointCost respects basis (real vs grid)", () => {
  const pt = { t: 0.2, tr: 0.5 };
  assert.equal(P.getPointCost(pt, "real"), 0.5);
  assert.equal(P.getPointCost(pt, "grid"), 0.2);
  // Falls back to t when tr missing.
  assert.equal(P.getPointCost({ t: 0.2 }, "real"), 0.2);
  // Compressed format (r instead of tr).
  assert.equal(P.getPointCost({ t: 0.2, r: 0.6 }, "real"), 0.6);
});

test("getPointYears handles scalar and array series", () => {
  const ptArray = {
    p: [1, 2, 3, 4],
    pr: [0.5, 1, 1.5, 2],
    b: [5, 6, 7, 8],
    br: [2, 3, 4, 5],
  };
  assert.equal(P.getPointYears(ptArray, "p", "real", 1), 1);
  assert.equal(P.getPointYears(ptArray, "p", "grid", 2), 3);
  assert.equal(P.getPointYears(ptArray, "b", "real", 0), 2);
  // Collapsed scalar (compressed format).
  const ptScalar = { p: 2, q: 1, b: 6, s: 3 };
  assert.equal(P.getPointYears(ptScalar, "p", "real", 1), 1);
  assert.equal(P.getPointYears(ptScalar, "b", "grid", 3), 6);
});

test("dotColor dispatches on metric", () => {
  const pt = { t: 0.05, tr: 0.05, p: 1, b: 2 };
  assert.equal(P.dotColor(pt, "cost", "real", 1), P.costColor(0.05));
  assert.equal(P.dotColor(pt, "p", "real", 1), P.yearColor(1));
  assert.equal(P.dotColor(pt, "b", "grid", 1), P.yearColor(2));
});

test("hexToRgb parses 6-digit and 3-digit hex", () => {
  assert.deepEqual(P.hexToRgb("#00e699"), { r: 0, g: 230, b: 153 });
  assert.deepEqual(P.hexToRgb("#fff"), { r: 255, g: 255, b: 255 });
  assert.deepEqual(P.hexToRgb("#0d1117"), { r: 13, g: 17, b: 23 });
});

test("pointLat/pointLon read both original and compressed keys", () => {
  assert.equal(P.pointLat({ lat: 13.13 }), 13.13);
  assert.equal(P.pointLat({ a: 13.13 }), 13.13);
  assert.equal(P.pointLon({ lon: 45.38 }), 45.38);
  assert.equal(P.pointLon({ o: 45.38 }), 45.38);
});
