import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

import { runSizing } from "../assets/js/sizing/run.js";

const ui = readFileSync("assets/js/sizing/ui.js", "utf8");

function between(start, end) {
  const from = ui.indexOf(start);
  assert.notEqual(from, -1, `${start} must exist`);
  const to = ui.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `${end} must follow ${start}`);
  return ui.slice(from, to);
}

function runApplianceState(rows) {
  const sandbox = {
    $(id) {
      assert.equal(id, "applianceList");
      return { querySelectorAll: () => rows };
    },
  };
  vm.createContext(sandbox);
  return vm.runInContext(
    `${between("function applianceState()", "function getTariff()")}
     applianceState;`,
    sandbox,
  )();
}

test("applianceState skips malformed rows without poisoning valid totals", () => {
  const valid = {
    dataset: {
      w: "100",
      qty: "2",
      h: "4",
      surgeW: "500",
      splitPhase: "true",
    },
  };
  const malformed = [
    { w: "100watts", qty: "1", h: "4", surgeW: "500" },
    { w: "100", qty: "1.5", h: "4", surgeW: "500" },
    { w: "100", qty: "31", h: "4", surgeW: "500" },
    { w: "100", qty: "1", h: "-0.25", surgeW: "500" },
    { w: "100", qty: "1", h: "4", surgeW: "Infinity" },
  ].map((dataset) => ({ dataset }));

  const state = runApplianceState([valid, ...malformed]);
  assert.equal(state.kwh, 0.8);
  assert.equal(state.peakW, 200);
  assert.equal(state.peakSurgeW, 1000);
  assert.equal(state.requiresSplitPhase, true);
  assert.equal(state.count, 1, "only the accepted row contributes to count");
});

test("applianceState keeps the catalog surge fallback for valid rows", () => {
  const state = runApplianceState([
    { dataset: { w: "75", qty: "1", h: "8", splitPhase: "false" } },
  ]);
  assert.equal(state.kwh, 0.6);
  assert.equal(state.peakW, 75);
  assert.equal(state.peakSurgeW, 75);
  assert.equal(state.count, 1);
});

test("applianceState skips rows whose derived totals overflow", () => {
  const state = runApplianceState([
    {
      dataset: {
        w: String(Number.MAX_VALUE),
        qty: "2",
        h: "24",
        surgeW: "500",
      },
    },
    { dataset: { w: "100", qty: "2", h: "4", surgeW: "500" } },
  ]);

  assert.equal(state.count, 1, "rejects the overflowing row");
  assert.ok(Number.isFinite(state.kwh));
  assert.ok(Number.isFinite(state.peakW));
  assert.ok(Number.isFinite(state.peakSurgeW));
  assert.equal(state.kwh, 0.8);

  const aggregate = runApplianceState([
    {
      dataset: { w: "1e308", qty: "1", h: "0.25", surgeW: "1e308" },
    },
    {
      dataset: { w: "1e308", qty: "1", h: "0.25", surgeW: "1e308" },
    },
  ]);

  assert.equal(aggregate.count, 1, "rejects aggregate overflow");
  assert.ok(Number.isFinite(aggregate.kwh));
  assert.ok(Number.isFinite(aggregate.peakW));
  assert.ok(Number.isFinite(aggregate.peakSurgeW));
});

test("applyGenRate rejects non-finite or overflowing prices", () => {
  const source = between("function applyGenRate()", "function renderMoneyBar(");
  for (const rate of [null, Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
    const input = { value: "0.12" };
    let dirty = 0;
    let status = 0;
    const sandbox = {
      genRateUsd: () => rate,
      fxActive: () => null,
      $(id) {
        return id === "customRateVal" ? input : null;
      },
      syncBillSlider() {},
      markPrecalcDirty() {
        dirty++;
      },
      setStatus() {
        status++;
      },
      money: String,
      t: (key) => key,
      generatorBasis: false,
      tariffTouched: false,
    };
    vm.createContext(sandbox);
    vm.runInContext(`${source}\napplyGenRate();`, sandbox);
    assert.equal(input.value, "0.12", `rate ${String(rate)} is rejected`);
    assert.equal(dirty, 0);
    assert.equal(status, 0);
    assert.equal(sandbox.generatorBasis, false);
    assert.equal(sandbox.tariffTouched, false);
  }

  const input = { value: "0.12" };
  const sandbox = {
    genRateUsd: () => Number.MAX_VALUE,
    fxActive: () => ({ rate: 2 }),
    $(id) {
      return id === "customRateVal" ? input : null;
    },
    syncBillSlider() {},
    markPrecalcDirty() {
      throw new Error("overflow must be rejected before dirtying state");
    },
    setStatus() {},
    money: String,
    t: (key) => key,
    generatorBasis: false,
    tariffTouched: false,
  };
  vm.createContext(sandbox);
  vm.runInContext(`${source}\napplyGenRate();`, sandbox);
  assert.equal(input.value, "0.12");
});

test("applyGenRate preserves valid converted prices", () => {
  const source = between("function applyGenRate()", "function renderMoneyBar(");
  const input = { value: "0.12" };
  const sandbox = {
    genRateUsd: () => 1.25,
    fxActive: () => ({ rate: 1.1 }),
    $(id) {
      return id === "customRateVal" ? input : null;
    },
    syncBillSlider() {},
    markPrecalcDirty() {},
    setStatus() {},
    money: String,
    t: (key) => key,
    generatorBasis: false,
    tariffTouched: false,
  };
  vm.createContext(sandbox);
  vm.runInContext(`${source}\napplyGenRate();`, sandbox);
  assert.equal(input.value, "1.375");
  assert.equal(sandbox.generatorBasis, true);
  assert.equal(sandbox.tariffTouched, true);
});

test("runSizing rejects non-object messages before spreading them", async () => {
  for (const msg of [null, undefined, "run", 42, true, Symbol("bad"), []]) {
    await assert.rejects(
      () => runSizing(msg),
      /runSizing: msg must be an object/,
      `message ${String(msg)} must be rejected`,
    );
  }
});
