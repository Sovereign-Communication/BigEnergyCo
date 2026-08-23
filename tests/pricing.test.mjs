import { test } from "node:test";
import assert from "node:assert/strict";
import { PRICING_SCOPES, POWMR_CATALOG, costRange, getScope, fullRange, estimateTariff } from "../assets/js/sizing/pricing.js";

test("PowMr catalog derivation matches the checked prices", () => {
  assert.equal(POWMR_CATALOG.batteries[0].perKwh, Math.round(POWMR_CATALOG.batteries[0].priceUsd / POWMR_CATALOG.batteries[0].kwhNominal));
  const inv = POWMR_CATALOG.inverters.find((i) => i.kw === 10);
  assert.equal(inv.priceUsd, 939);
});

test("scopes are ordered cheap-to-expensive and ranges are sane", () => {
  for (const s of PRICING_SCOPES) {
    assert.ok(s.pvPerW[0] < s.pvPerW[1], `${s.id} pv range`);
    assert.ok(s.battPerKwhUsable[0] < s.battPerKwhUsable[1], `${s.id} batt range`);
    assert.ok(s.invPerKw[0] < s.invPerKw[1], `${s.id} inv range`);
  }
  // ex-factory cells cheapest, budget retail most expensive
  const cells = getScope("cells").battPerKwhUsable[1];
  const powmr = getScope("powmr").battPerKwhUsable[0];
  assert.ok(cells <= powmr, "ex-Factory top must overlap-or-below retail bottom");
});

test("costRange: PowMr scope puts a realistic bank near catalog $/kWh", () => {
  // 30.7 kWh usable should land in the same neighborhood as the 600Ah unit
  // ($3,399 nominal -> ~$3.8k usable-adjusted) plus panels/inverter on top.
  const r = costRange(5, 30.72, "powmr");
  assert.ok(r.hi > r.lo && r.lo > 0);
  const battOnly = r.battMid;
  assert.ok(battOnly > 3000 && battOnly < 5200, `battery mid ${battOnly} in plausible window`);
  // per-kWh context line can never again read like total/pv-inflated nonsense
  const perKwh = Math.round(battOnly / 30.72);
  assert.ok(perKwh >= 110 && perKwh <= 165, `stored-kWh price ${perKwh} within PowMr-derived band`);
});

test("costRange: cells scope lands near the ~$50/kWh expectation", () => {
  const r = costRange(0, 10, "cells");
  const perKwh = r.battMid / 10;
  assert.ok(perKwh >= 45 && perKwh <= 70, `cells scope mid ${perKwh}/kWh usable`);
});

test("fullRange: one honest spread, ex-factory low to budget-retail high", () => {
  const r = fullRange(10, 50);
  assert.ok(r.lo < r.hi, "range must have width");
  const cellsOnly = costRange(10, 50, "cells");
  const retail = costRange(10, 50, "powmr");
  assert.equal(r.lo, cellsOnly.lo, "low end is ex-factory");
  assert.equal(r.hi, retail.hi, "high end is budget retail");
  assert.ok(r.battPerKwhLo === 45 && r.battPerKwhHi === 165);
  // battery sub-range must sit inside the total range
  assert.ok(r.battCostLo >= r.lo * 0.1 && r.battCostHi <= r.hi);
});

test("estimateTariff: region boxes resolve from coordinates", () => {
  assert.equal(estimateTariff(19.5, -155.0).rate, 0.42); // Hawaii beats US box
  assert.equal(estimateTariff(33.45, -112.07).label, "US mainland");
  assert.equal(estimateTariff(51.51, -0.13).label, "United Kingdom / Ireland"); // country box beats regional
  assert.equal(estimateTariff(28.61, 77.21).rate, 0.08); // Delhi
  assert.equal(estimateTariff(52.52, 13.41).rate, 0.40); // Berlin: Germany country box beats Europe fallback
  assert.equal(estimateTariff(-10, -140).rate, 0.28); // mid-Pacific -> global fallback
});
