// Car 1 of the Jev audit named three execution-ready guards (0.95–0.98). Two of
// them are settled here, and the third is settled on the thread because the
// function it named no longer exists.
//
// Scope: P0.6, the completion-program evidence item — audit evidence and its
// verdicts, judged on the `docs` facets. No product threshold moves here.
//
// Like the B-series in cold-start-defects, the point is that a prescription is
// a suspect, not a work order: each item below is answered against the shipped
// code, and where the answer is "already guarded" the guard gets a test that
// fails if someone removes it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

import {
  parseShareHash,
  b64urlEncode,
} from "../assets/js/sizing/share-codec.js";

const ui = readFileSync("assets/js/sizing/ui.js", "utf8");

function between(start, end) {
  const from = ui.indexOf(start);
  assert.notEqual(from, -1, `${start} must exist`);
  const to = ui.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `${end} must follow ${start}`);
  return ui.slice(from, to);
}

// ── mergeReSlice: validate-guard, pinpoint `multiple-sites` ────────────────
//
// The flagged sink is the pair of `in` probes. `"x" in result` throws a
// TypeError when `result` is a primitive, so a malformed worker message used to
// take the whole merge down instead of being ignored. The guard predates this
// test — it came in with #171 — but nothing pinned it, which is how a sink gets
// re-opened by a refactor. It is EXECUTED here, not pattern-matched: the
// function is sliced out of ui.js and run against a real payload.

const MERGE_SRC = between(
  "function mergeReSlice(result)",
  "function setupBillSlider()",
);

/** Run the shipped mergeReSlice in a context whose only real state is the payload. */
function runMerge(payload, result) {
  const sandbox = {
    lastPayload: payload,
    selectedKey: undefined,
    resultLevel: undefined,
    budgetPinnedUsd: Number.NaN,
    frontierSelected: null,
    adoptedEntry: null,
    // Every module-level helper the function may reach. None of them should be
    // called on the guard path, which is the other half of the assertion below.
    renderTargetCards() {},
    renderFrontierPanel() {},
    refreshSelectionOutputs() {},
    renderBestPick() {},
    renderMoneyBar() {},
    renderMatrix() {},
    drawSocChartForEntry() {},
    syncBillSlider() {},
    syncBudgetRange() {},
    syncCutLabel() {},
    updateShareHash() {},
    readPercentInput: () => null,
    curveReady: () => false,
    readInputs: () => ({}),
    displayRate: () => 0,
    NOW: () => 0,
    t: (k) => k,
    money: (v) => String(v),
    fmt: (v) => String(v),
    fmtKwh: (v) => String(v),
    energyRate: () => 0,
  };
  vm.createContext(sandbox);
  const merge = vm.runInContext(`${MERGE_SRC}\nmergeReSlice;`, sandbox);
  merge(result);
  return sandbox;
}

test("mergeReSlice refuses a non-object slice instead of throwing at the `in` checks", () => {
  // A worker message that is truthy but not an object is exactly the shape that
  // crashed: `"agmReference" in "text"` is a TypeError, and the old guard only
  // rejected falsy values.
  for (const hostile of ["text", 42, true, Symbol("x")]) {
    const payload = { matrix: { cells: {} } };
    assert.doesNotThrow(
      () => runMerge(payload, hostile),
      `a ${typeof hostile} slice must be ignored, not thrown on`,
    );
    assert.deepEqual(
      payload,
      { matrix: { cells: {} } },
      "a refused slice must not mutate the payload",
    );
  }
});

test("mergeReSlice still merges a real slice (the guard is not a mute button)", () => {
  const payload = { matrix: { cells: { a: 1 } } };
  const state = runMerge(payload, {
    cells: { b: 2 },
    customCut: { fraction: 0.8 },
  });
  assert.deepEqual(payload.matrix.cells, { a: 1, b: 2 }, "cells merge");
  assert.deepEqual(
    payload.customCut,
    { fraction: 0.8 },
    "the cut is merged too",
  );
  assert.equal(
    state.selectedKey,
    undefined,
    "no selection is invented by a payload-only slice",
  );
});

test("mergeReSlice's guard runs before both `in` probes", () => {
  const body = MERGE_SRC.slice(MERGE_SRC.indexOf("{") + 1);
  const guard = body.indexOf('typeof result !== "object"');
  assert.notEqual(guard, -1, "the object guard must exist");
  for (const sink of ['"agmReference" in result', '"customTarget" in result']) {
    assert.ok(
      body.indexOf(sink) > guard,
      `${sink} must sit after the guard, or it throws on a primitive`,
    );
  }
});

// ── populatePrintSheet: escape-output, pinpoint `footprintText` ─────────────
//
// The sheet is assembled with innerHTML, so the prescription is right that the
// sink exists. The question is whether anything can reach it unescaped. Reading
// every interpolation inside the sheet: they are numbers, formatter output,
// module literals, or engine-supplied labels. The one field that arrives from
// outside the app — the share hash — is whitelisted by restoreFromShare before
// it can set any control, and basis is computed from those validated controls.
//
// That makes the codec's permissiveness load-bearing, which is what these two
// tests pin: the codec passes arbitrary text through (executed), and no hash
// string field reaches the form without a whitelist (source).

test("the share codec is permissive on purpose, so the UI must be the gate", () => {
  // Executed, against the real codec: this is NOT sanitised here.
  const hostile = "<img src=x onerror=alert(1)>";
  const parsed = parseShareHash(
    "#s=" + b64urlEncode({ v: 1, la: 21.3, lo: -157.8, kw: 30, ch: hostile }),
  );
  assert.equal(parsed.ch, hostile, "the codec carries the string through");
});

test("every hash string field is whitelisted before it can reach the form", () => {
  const restore = between(
    "function restoreFromShare()",
    "function populatePrintSheet(p, inp)",
  );
  const guards = [
    ["chemistry", /CHEM_KEYS\.has\(o\.ch\)/],
    ["use case", /useCase\(o\.uc\)/],
    ["auto tier", /\["tier100", "tier99", "tier95"\]\.includes\(o\.at\)/],
    ["cut target", /valid\.includes\(o\.ag\)/],
    ["hardware", /\["both", "solar", "battery"\]\.includes\(o\.hw\)/],
    ["focus chemistry", /\["naion", "lfp", "agm"\]\.includes\(o\.fc\)/],
    ["selection key", /\(best\|focus\|custom\|adopted\|matrix/],
  ];
  for (const [what, pattern] of guards) {
    assert.match(
      restore,
      pattern,
      `the ${what} field must be checked, not trusted`,
    );
  }
  // And the whitelist is what the hostile value meets: CHEM_KEYS is a set of
  // four engine chemistries, so the payload above cannot pass it.
  const keys = ui.match(/const CHEM_KEYS = new Set\(\[([^\]]+)\]\)/);
  assert.ok(keys, "CHEM_KEYS must be a literal set");
  assert.doesNotMatch(keys[1], /img|onerror/i);
});

test("the print sheet interpolates no untrusted text: basis is computed, not read", () => {
  const sheet = between(
    "function populatePrintSheet(p, inp)",
    "function askAdvisor()",
  );
  // `basis` is the one string field interpolated into the sheet, and readInputs
  // assigns it only literals — never a form value, never the hash.
  const readInputs = between(
    "function readInputs()",
    "function readPercentInput",
  );
  const basisAssignments = readInputs.match(/basis =[^;]+;/g) || [];
  assert.ok(
    basisAssignments.length > 0,
    "basis must be assigned in readInputs",
  );
  for (const line of basisAssignments) {
    assert.match(
      line,
      /basis = ("[^"]*"|generatorBasis|isOffgrid|\s*$)/,
      `basis must come from a literal, not a field: ${line.trim()}`,
    );
  }
  assert.match(sheet, /\$\{inp\.basis\}/, "the sheet does render basis");
});
