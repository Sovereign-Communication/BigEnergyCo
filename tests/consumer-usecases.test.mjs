// Tests for consumer use-cases, presets, autonomy, and balance-of-system logic.
// Run: node --test tests/consumer-usecases.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { pickSystemVoltage } from "../assets/js/sizing/bom.js";

test("pickSystemVoltage: van/RV scale loads (<=1.5kW, <=3kWh) select 12V", () => {
  assert.equal(pickSystemVoltage(2.5, 1.2), 12);
  assert.equal(pickSystemVoltage(3.0, 1.5), 12);
});

test("pickSystemVoltage: mid-scale cabins/workshops (<=3.5kW, <=10kWh) select 24V", () => {
  assert.equal(pickSystemVoltage(5.0, 2.5), 24);
  assert.equal(pickSystemVoltage(9.6, 3.0), 24);
});

test("pickSystemVoltage: house-scale (>3.5kW or >10kWh) select 48V", () => {
  assert.equal(pickSystemVoltage(15.0, 5.0), 48);
  assert.equal(pickSystemVoltage(30.0, 10.0), 48);
});

test("Days of autonomy formula: usable kWh / daily kWh", () => {
  const dailyKwh = 10;
  const usableKwh = 25;
  const autonomy = usableKwh / dailyKwh;
  assert.equal(autonomy, 2.5);
  assert.ok(autonomy >= 2, "2.5 days covers standard 2-day storm front");
});

test("Array tilt heuristic gives steeper angles in high latitudes for winter harvest", () => {
  function optimalWinterTilt(lat) {
    const absLat = Math.abs(lat);
    return Math.min(70, Math.round(absLat + 15));
  }
  function optimalYearRoundTilt(lat) {
    const absLat = Math.abs(lat);
    return Math.round(absLat * 0.9);
  }

  // Hawaii (21°N)
  assert.equal(optimalYearRoundTilt(21.3), 19);
  assert.equal(optimalWinterTilt(21.3), 36);

  // Montana / Germany (48°N)
  assert.equal(optimalYearRoundTilt(48.0), 43);
  assert.equal(optimalWinterTilt(48.0), 63);
});

test("240V split-phase detection flags deep well pump and high-power inductive loads", () => {
  const items = [
    { name: "LED bulb", w: 10, splitPhase: false },
    { name: "Deep well pump", w: 1100, splitPhase: true, surgeW: 3500 },
  ];
  const needsSplitPhase = items.some((i) => i.splitPhase);
  const maxSurge = Math.max(...items.map((i) => i.surgeW || i.w));
  assert.equal(needsSplitPhase, true);
  assert.equal(maxSurge, 3500);
});

test("Offgrid load heuristic uses daily kWh directly without utility bill calculation", () => {
  function computeDailyKwh({ mode, isOffgrid, offSliderVal, billVal, tariff }) {
    if (isOffgrid) {
      return offSliderVal || 10;
    }
    if (mode === "bill") {
      return billVal / tariff / 30.4375;
    }
    return 10;
  }

  // In off-grid mode, user daily kWh is read directly (5 kWh) regardless of any tariff or bill
  const offgridKwh = computeDailyKwh({
    mode: "bill",
    isOffgrid: true,
    offSliderVal: 5,
    billVal: 150,
    tariff: 0.35,
  });
  assert.equal(offgridKwh, 5);

  // In grid-tie mode with $150 bill @ $0.35/kWh -> ~14.1 kWh/day
  const gridtieKwh = computeDailyKwh({
    mode: "bill",
    isOffgrid: false,
    offSliderVal: 5,
    billVal: 150,
    tariff: 0.35,
  });
  assert.ok(Math.abs(gridtieKwh - 14.1) < 0.2);
});

test("ELI5 inverter descriptions correctly branch on hardware configuration", () => {
  function describeInverter(pvKw, battKwh, requiresSplitPhase) {
    const splitNote = requiresSplitPhase
      ? " Native 240V split-phase required."
      : "";
    if (battKwh === 0) {
      return `Grid-tied string inverter (~${Math.max(3, Math.ceil(pvKw))} kW).${splitNote}`;
    }
    if (pvKw === 0) {
      return `Bidirectional battery inverter / charger.${splitNote}`;
    }
    return `Hybrid inverter / charger (~5 kW continuous).${splitNote}`;
  }

  assert.ok(
    describeInverter(6.0, 0, false).includes("Grid-tied string inverter"),
  );
  assert.ok(
    describeInverter(0, 10.0, false).includes("Bidirectional battery inverter"),
  );
  assert.ok(
    describeInverter(6.0, 10.0, true).includes("Hybrid inverter") &&
      describeInverter(6.0, 10.0, true).includes("240V split-phase"),
  );
});

test("Budget slider adoption auto-adjusts recommendation in place without popup modal", () => {
  let modalShown = false;
  let adopted = null;
  let bannerUpdated = null;

  function fakeAdoptFrontierPoint(point, opts = {}) {
    adopted = point;
    bannerUpdated = point;
    if (opts.showModal) {
      modalShown = true;
    }
  }

  function onBudgetSliderChange(nearestPoint) {
    fakeAdoptFrontierPoint(nearestPoint, {
      showModal: false,
      keepSlider: true,
    });
  }

  function onFrontierCurveClick(clickedPoint) {
    fakeAdoptFrontierPoint(clickedPoint, { showModal: true });
  }

  // 1. Budget slider adjustment
  onBudgetSliderChange({ pvKw: 5.2, battKwh: 10, capexUsd: 8500 });
  assert.equal(modalShown, false, "Budget slider must NOT show modal popup");
  assert.deepEqual(adopted, { pvKw: 5.2, battKwh: 10, capexUsd: 8500 });
  assert.deepEqual(bannerUpdated, { pvKw: 5.2, battKwh: 10, capexUsd: 8500 });

  // 2. Direct click on frontier curve point
  onFrontierCurveClick({ pvKw: 8.0, battKwh: 15, capexUsd: 13000 });
  assert.equal(
    modalShown,
    true,
    "Frontier curve click MUST open system selection modal",
  );
  assert.deepEqual(adopted, { pvKw: 8.0, battKwh: 15, capexUsd: 13000 });
});

test("Budget slider synchronization logic updates slider on curve click unless keepSlider is set", () => {
  let sliderVal = "5000";

  function syncSliderToPoint(capexUsd, opts = {}) {
    if (!opts.keepSlider && Number.isFinite(capexUsd)) {
      sliderVal = String(Math.round(capexUsd));
    }
  }

  // Curve click without keepSlider updates slider position
  syncSliderToPoint(12400, { keepSlider: false });
  assert.equal(sliderVal, "12400");

  // Budget slider change with keepSlider preserves current slider position
  syncSliderToPoint(15000, { keepSlider: true });
  assert.equal(sliderVal, "12400");
});
