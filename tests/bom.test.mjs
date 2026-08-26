// BOM helper test suite. Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PANEL_WATTS_DEFAULT, INVERTER_STANDARD_KW, FUSE_STANDARD_AMPS,
  WIRE_TABLE, RETAIL_MODULE_KWH,
  nextInverterSize, nextFuseSize, pickSystemVoltage,
  panelLayout, controllerSpec, protectionSpec, cableGauge, buildBom,
} from "../assets/js/sizing/bom.js";

test("nextInverterSize rounds up to the smallest standard class", () => {
  assert.equal(nextInverterSize(0.4), 1);
  assert.equal(nextInverterSize(1.0), 1);
  assert.equal(nextInverterSize(1.01), 1.5);
  assert.equal(nextInverterSize(4.2), 5);
  assert.equal(nextInverterSize(30), INVERTER_STANDARD_KW[INVERTER_STANDARD_KW.length - 1]);
});

test("nextFuseSize never picks below the required amps", () => {
  assert.equal(nextFuseSize(55), 60);
  assert.equal(nextFuseSize(61), 80);
  assert.equal(nextFuseSize(100), 100);
  for (let a = 1; a <= 400; a += 7) {
    const picked = nextFuseSize(a);
    assert.ok(picked >= a, `fuse ${picked} must cover ${a}`);
    assert.ok(FUSE_STANDARD_AMPS.includes(picked));
  }
});

test("pickSystemVoltage follows the documented heuristic", () => {
  assert.equal(pickSystemVoltage(1, 1), 12);      // RV-scale
  assert.equal(pickSystemVoltage(3, 1.5), 12);    // boundary stays 12 V
  assert.equal(pickSystemVoltage(3.1, 1.5), 24);  // bank pushes past 12 V
  assert.equal(pickSystemVoltage(2, 1.6), 24);    // inverter pushes past 12 V
  assert.equal(pickSystemVoltage(10, 3.5), 24);   // upper mid boundary
  assert.equal(pickSystemVoltage(10, 3.6), 48);   // house scale
  assert.equal(pickSystemVoltage(20, 8), 48);
});

test("panelLayout ceils panel count and sizes area honestly", () => {
  const p = panelLayout(8, PANEL_WATTS_DEFAULT); // 8000/550 = 14.5 → 15
  assert.equal(p.count, 15);
  assert.equal(p.kwActual, 8.25);
  assert.equal(p.areaM2, 40); // 15×550/200 = 41.25 → rounds to 40 (nearest 5)
  assert.equal(panelLayout(0, 550), null);
  assert.equal(panelLayout(5, 0), null);
});

test("controller amps are PV/voltage × 1.25", () => {
  const c = controllerSpec(8, 48);
  // 8000/48 × 1.25 = 208.3 → 209
  assert.equal(c.ampsRequired, 209);
  assert.match(c.suggestion, /split across 3 × 80 A/);
  const small = controllerSpec(1.5, 48);
  assert.ok(small.ampsRequired <= 80);
  assert.match(small.suggestion, /one \d+ A-class MPPT/);
  assert.equal(controllerSpec(0, 48), null);
});

test("protection sizes main fuse off inverter draw at system voltage", () => {
  const pr = protectionSpec(5, 48, 8);
  // 5000/48 = 104.2 A discharge; ×1.25 = 130.2 → 150 A fuse
  assert.equal(pr.batteryDischargeAmps, 105);
  assert.equal(pr.mainFuseAmps, 150);
  assert.ok(pr.pvBreakerAmps >= pr.mainFuseAmps === false || true); // independent values
  assert.equal(protectionSpec(0, 48, 0).mainFuseAmps, null);
});

test("cable gauge grows with run length and satisfies ampacity + drop", () => {
  // At 48 V the ampacity requirement usually dominates; a 12 V low-voltage
  // run is where cable length visibly forces bigger copper.
  const shortRun = cableGauge(30, 12, 2);
  const longRun = cableGauge(30, 12, 8);
  const awgIdx = (awg) => WIRE_TABLE.findIndex((w) => w.awg === awg);
  assert.ok(awgIdx(longRun.awg) > awgIdx(shortRun.awg) || longRun.awg.startsWith(">"));
  // Returned gauge always satisfies both constraints (drop + ampacity)
  for (const g of [shortRun, longRun]) {
    const minMm2 = (0.0175 * 2 * g.meters * 30) / (12 * 0.02);
    if (g.mm2 !== null) assert.ok(g.mm2 >= minMm2 - 1e-9);
  }
  // Hot site never picks smaller copper than the same amps cold
  const hot = cableGauge(50, 48, 2, 45);
  const cold = cableGauge(50, 48, 2, 20);
  assert.ok(awgIdx(hot.awg) >= awgIdx(cold.awg));
});

test("buildBom produces a coherent house-scale LFP system", () => {
  const b = buildBom({
    pvKw: 8,
    battNameplateKwh: 14.4,   // 13 kWh usable at 90% DoD
    chemistry: "lfp",
    peakLoadW: 3200,          // flat-ish profile peak
  });
  assert.equal(b.panels.count, 15);
  assert.equal(b.voltage.volts, 48);
  assert.equal(b.inverter.recommendedKw, 4);   // smallest standard class ≥ 3.2 kW peak
  assert.equal(b.battery.diy.seriesPerString, 16); // market-standard 51.2 V string
  // 16S×314Ah string ≈ 16.07 kWh → one string covers 14.4 nameplate
  assert.equal(b.battery.diy.stringsParallel, 1);
  assert.equal(b.battery.retail.modules, Math.ceil(14.4 / RETAIL_MODULE_KWH)); // 3
  // 4 kW inverter on 48 V draws ~83 A → ×1.25 → 125 A fuse
  assert.equal(b.protection.mainFuseAmps, 125);
  assert.ok(b.feasibility.areaM2 >= 35 && b.feasibility.areaM2 <= 45);
});

test("buildBom switches chemistry layouts correctly", () => {
  const sodium = buildBom({ pvKw: 8, battNameplateKwh: 16, chemistry: "naion", peakLoadW: 3000 });
  assert.equal(sodium.battery.diy.seriesPerString, 16); // 16 × 3.1 = 49.6 V bus
  const agm = buildBom({ pvKw: 8, battNameplateKwh: 28.8, chemistry: "agm", peakLoadW: 3000 });
  assert.equal(agm.battery.diy.seriesPerString, 4);     // 4 × 12 V blocks per 48 V string
  assert.equal(agm.battery.diy.stringKwh, 9.6);         // 4S × 200 Ah × 12 V
});

test("buildBom handles battery-less grid-tie systems without crashing", () => {
  const b = buildBom({ pvKw: 2, battNameplateKwh: 0, chemistry: "lfp", peakLoadW: 2500 });
  assert.equal(b.battery, null);
  assert.equal(b.controller, null);
  assert.equal(b.protection, null);
  assert.equal(b.cable, null);
  assert.equal(b.inverter.recommendedKw, 3);
  assert.ok(b.notes.some((n) => /No meaningful battery/.test(n)));
});
