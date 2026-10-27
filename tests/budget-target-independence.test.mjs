import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { bestAffordableCurvePoint } from "../assets/js/shared/budget-targets.js";

const points = [
  { index: 0, x: 1000, y: 50 },
  { index: 1, x: 1800, y: 72 },
  { index: 2, x: 2600, y: 72 },
  { index: 3, x: 4000, y: 91 },
];

test("budget selection picks the best outcome that stays within the budget", () => {
  assert.equal(bestAffordableCurvePoint(points, 2500), points[1]);
  assert.equal(bestAffordableCurvePoint(points, 4000), points[3]);
  assert.equal(bestAffordableCurvePoint(points, 999), null);
});

test("equal outcomes prefer the lower-cost frontier point", () => {
  assert.equal(bestAffordableCurvePoint(points, 3000), points[1]);
});

test("budget selection ignores malformed points and leaves the frontier intact", () => {
  const input = [null, { x: 100, y: Number.NaN }, { x: 200, y: 10 }];
  assert.equal(bestAffordableCurvePoint(input, 500), input[2]);
  assert.equal(input.length, 3);
});

test("missing or nonnumeric budgets do not select a system", () => {
  assert.equal(bestAffordableCurvePoint(points, null), null);
  assert.equal(bestAffordableCurvePoint([{ x: 0, y: 1 }], null), null);
  assert.equal(bestAffordableCurvePoint(points, "unlimited"), null);
  assert.equal(bestAffordableCurvePoint(null, 2500), null);
});

const ui = fs.readFileSync("assets/js/sizing/ui.js", "utf8");

function between(start, end) {
  const from = ui.indexOf(start);
  const to = ui.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `missing ${start}`);
  assert.notEqual(to, -1, `missing ${end}`);
  return ui.slice(from, to);
}

test("cut-target edits keep a previously chosen budget point", () => {
  const cutHandler = between(
    "function setupCutSlider()",
    "function requestIncrementalCut(",
  );
  assert.doesNotMatch(cutHandler, /budgetPinnedUsd\s*=\s*null/);
  assert.doesNotMatch(cutHandler, /followMarkerOnce/);
  assert.match(cutHandler, /Number\.isFinite\(budgetPinnedUsd\)/);
});

test("budget-point selection never rewrites the independent cut target", () => {
  const adopt = between(
    "function adoptFrontierPoint(",
    "function renderFrontierPanel(",
  );
  assert.doesNotMatch(adopt, /syncCutControls\(/);
  assert.match(adopt, /updateShareHash\(p, readInputs\(\)\)/);
});

test("budget slider selects the best affordable point, not the nearest over-budget one", () => {
  const budgetHandler = between(
    "function setupBudgetSlider()",
    "function restoreRunButton()",
  );
  assert.match(budgetHandler, /bestAffordableCurvePoint/);
  assert.doesNotMatch(budgetHandler, /nearestCurvePoint\([^\n]*"x"\)/);
});

test("target slices retain the selected budget point on the frontier", () => {
  const slice = between(
    "function mergeReSlice(result)",
    "function setupBillSlider(",
  );
  assert.match(
    slice,
    /if \(!Number\.isFinite\(budgetPinnedUsd\)\) frontierSelected = null/,
  );
});

test("unconstrained budget position follows the current target marker", () => {
  const range = between(
    "function syncBudgetRange(",
    "function syncBudgetLabel(",
  );
  assert.match(range, /else \{\s*\/\/ With no optional budget choice/);
  assert.match(range, /next = m && Number\.isFinite\(m\.capexUsd\)/);
  assert.match(range, /slider\.min = String\(Math\.ceil\(lo\)\)/);
});

const smoke = fs.readFileSync("scripts/smoke/results.js", "utf8");

test("real-browser smoke asserts independent budget and cut selections", () => {
  assert.match(smoke, /budget change keeps the independent bill-cut target/);
  assert.match(smoke, /cut change keeps the chosen budget pinned/);
  assert.doesNotMatch(
    smoke,
    /budgetFollowedCut|budget pick moves the bill-cut target/,
  );
});
