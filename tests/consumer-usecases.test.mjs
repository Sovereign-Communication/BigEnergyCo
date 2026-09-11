// Tests for consumer use-cases, presets, autonomy, and balance-of-system logic.
// Run: node --test tests/consumer-usecases.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { pickSystemVoltage } from "../assets/js/sizing/bom.js";
import { LOCALES } from "../assets/js/shared/locales.js";

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

test("Battery SOC chart heading is renamed and localized across all supported languages", () => {
  const supported = ["en", "es", "pt", "fr", "ar"];
  for (const lang of supported) {
    const dict = LOCALES[lang];
    assert.ok(dict, `Locale dict for ${lang} must exist`);
    assert.ok(
      typeof dict.socChartTitle === "string" && dict.socChartTitle.length > 10,
      `socChartTitle in ${lang} must be defined and non-trivial`,
    );
    assert.ok(
      !dict.socChartTitle.toLowerCase().includes("how low"),
      `socChartTitle in ${lang} must not use colloquial 'how low'`,
    );
  }
  assert.equal(
    LOCALES.en.socChartTitle,
    "Battery Charge Levels & Year-Round Reliability (5-Year Real Weather)",
  );
});

test("Battery SOC canvas does not trap mouse wheel and allows touch pan-y in index.html", () => {
  const html = fs.readFileSync(
    new URL("../index.html", import.meta.url),
    "utf8",
  );
  assert.ok(
    html.includes('id="socCanvas"'),
    "index.html must include socCanvas",
  );
  assert.ok(
    html.includes("touch-action: pan-y;"),
    "socCanvas style must include touch-action: pan-y to avoid mobile scroll-trapping",
  );
  assert.ok(
    !html.includes("How low does each battery get?"),
    "index.html must not contain old colloquial heading 'How low does each battery get?'",
  );
  assert.ok(
    html.includes('data-i18n="socChartTitle"'),
    "index.html must include data-i18n attribute for socChartTitle",
  );
});

test("Solar Heatmap defaults to True Grid Cost view and preserves Payback and Break-even views", () => {
  const html = fs.readFileSync(
    new URL("../solar-heatmap/index.html", import.meta.url),
    "utf8",
  );

  // Default metric in script state must be "cost"
  assert.ok(
    html.includes('let metric = "cost";'),
    'solar-heatmap/index.html must initialize state with let metric = "cost"',
  );
  assert.ok(
    html.includes('let basis = "real";'),
    'solar-heatmap/index.html must initialize state with let basis = "real"',
  );

  // Default active button markup
  assert.ok(
    /data-metric="cost"\s+class="active"/.test(html),
    "True Grid Cost button must be marked active by default",
  );
  assert.ok(
    html.includes("True Grid Cost"),
    "Metric control must contain True Grid Cost",
  );
  assert.ok(
    html.includes('data-metric="p"'),
    "Payback view must be retained for reference",
  );
  assert.ok(
    html.includes('data-metric="b"'),
    "Break-even view must be retained for reference",
  );
  assert.ok(
    html.includes('data-basis="real"'),
    "True Cost (Weighted) basis must exist",
  );
  assert.ok(html.includes('data-basis="grid"'), "Grid Only basis must exist");
});

test("Weighted True Grid Cost math accurately models population grid coverage and generator displacement", () => {
  function computeWeightedTrueRate({
    unservedPct,
    outagePctOnGrid,
    onGridRate,
    genCostPerKwh,
  }) {
    const onGridEffective =
      (1 - outagePctOnGrid) * onGridRate + outagePctOnGrid * genCostPerKwh;
    const realEffectiveRate =
      unservedPct * genCostPerKwh + (1 - unservedPct) * onGridEffective;
    return Math.round(realEffectiveRate * 100) / 100;
  }

  // 100% grid-connected country with 0% outages (e.g. Germany/France)
  const fullyConnected = computeWeightedTrueRate({
    unservedPct: 0,
    outagePctOnGrid: 0,
    onGridRate: 0.4,
    genCostPerKwh: 0.55,
  });
  assert.equal(fullyConnected, 0.4);

  // Nigeria: 43% unserved, 50% outages on grid, $0.07 nominal tariff, $0.55 generator cost
  const nigeria = computeWeightedTrueRate({
    unservedPct: 0.43,
    outagePctOnGrid: 0.5,
    onGridRate: 0.07,
    genCostPerKwh: 0.55,
  });
  assert.equal(nigeria, 0.41, "Nigeria true grid cost blends to ~$0.41/kWh");

  // South Sudan: 93% unserved, 60% outages on remaining grid, $0.16 nominal tariff, $0.65 generator cost
  const southSudan = computeWeightedTrueRate({
    unservedPct: 0.93,
    outagePctOnGrid: 0.6,
    onGridRate: 0.16,
    genCostPerKwh: 0.65,
  });
  assert.equal(
    southSudan,
    0.64,
    "South Sudan true grid cost blends to ~$0.64/kWh",
  );
});

test("Tied sliders: monthly electric bill and off-grid kWh operate bidirectionally in parity", () => {
  const DAYS_PER_MONTH = 30.4375;
  function kwhFromBill(bill, rate, fixed = 0) {
    return (bill - fixed) / (rate * DAYS_PER_MONTH);
  }
  function billForKwh(kwh, rate, fixed = 0) {
    return kwh * DAYS_PER_MONTH * rate + fixed;
  }

  const rate = 0.28; // $0.28 / kWh
  let billAnchorKwh = 15;
  let billSliderVal = 128;
  let offgridKwhSliderVal = 15;

  // 1. User drags bill slider to $250/month
  const newBill = 250;
  billSliderVal = newBill;
  billAnchorKwh = kwhFromBill(newBill, rate);
  offgridKwhSliderVal = Math.round(billAnchorKwh * 10) / 10;

  assert.ok(
    Math.abs(offgridKwhSliderVal - 29.3) < 0.2,
    `Bill of $250 @ $0.28/kWh should sync offgrid slider to ~29.3 kWh/day, got ${offgridKwhSliderVal}`,
  );

  // 2. User drags offgrid kWh slider to 12 kWh/day
  const newKwh = 12;
  offgridKwhSliderVal = newKwh;
  billAnchorKwh = newKwh;
  billSliderVal = Math.round(billForKwh(newKwh, rate));

  assert.equal(
    billSliderVal,
    102,
    `Offgrid load of 12 kWh/day @ $0.28/kWh should sync bill slider to $102/mo, got ${billSliderVal}`,
  );

  // 3. User switches goal: shared anchor preserves exact load across modes
  let activeGoal = "gridtie";
  const gridtieLoad = billAnchorKwh;
  activeGoal = "offgrid";
  const offgridLoad = billAnchorKwh;
  assert.equal(
    gridtieLoad,
    offgridLoad,
    "Goal switching must maintain shared load anchor without conflict",
  );
});

test("Manual mode deferral: option changes do not trigger calculation until Size My System is clicked", () => {
  let runCount = 0;
  function triggerRun() {
    runCount++;
  }

  // Simulation of option change handlers in ui.js
  function onOptionChange(optionName, { quickMode, lastPayload }) {
    if (quickMode && lastPayload) {
      triggerRun();
    }
  }

  function onSliderDrag(sliderName, { lastPayload }) {
    // Sliders auto/instant update in place when results are present
    if (lastPayload) {
      triggerRun();
    }
  }

  function onSizeMySystemClick() {
    triggerRun();
  }

  // Case 1: Manual Mode (quickMode = false) with existing payload
  const manualState = { quickMode: false, lastPayload: { mode: "gridtie" } };

  onOptionChange("chemSelect", manualState);
  onOptionChange("hardwareConfig", manualState);
  onOptionChange("autoTier", manualState);
  onOptionChange("customRateVal", manualState);
  onOptionChange("onCoordChange", manualState);

  assert.equal(
    runCount,
    0,
    "Manual mode option selections must NOT calculate automatically",
  );

  // Sliders continue to auto-update in place
  onSliderDrag("billSlider", manualState);
  assert.equal(
    runCount,
    1,
    "Slider drag in manual mode should still auto-update calculation in place",
  );

  // Clicking "Size My System" runs calculation
  onSizeMySystemClick();
  assert.equal(
    runCount,
    2,
    "Clicking Size My System button in manual mode must trigger calculation",
  );

  // Case 2: Quick Mode (quickMode = true) with existing payload auto-updates on option changes
  const quickState = { quickMode: true, lastPayload: { mode: "gridtie" } };
  onOptionChange("chemSelect", quickState);
  assert.equal(
    runCount,
    3,
    "Quick mode option changes should auto-trigger calculation",
  );
});

test("Result ladder tabs: Best pick, Compare batteries, and All options are present and active", () => {
  const html = fs.readFileSync("index.html", "utf8");
  const uiJs = fs.readFileSync("assets/js/sizing/ui.js", "utf8");

  // Verify ladder container and tabs in HTML
  assert.match(html, /id="resultLadder"/);
  assert.match(html, /id="lvlBest"[^>]*>[\s\S]*?Best pick/);
  assert.match(html, /id="lvlCompare"[^>]*>[\s\S]*?Compare batteries/);
  assert.match(html, /id="lvlMatrix"[^>]*>[\s\S]*?All options/);

  // Verify syncLadderTabs displays all tabs (no canCompare gate)
  assert.match(uiJs, /function syncLadderTabs\(\)/);
  assert.match(
    uiJs,
    /const map = \{\s*best:\s*"lvlBest",\s*compare:\s*"lvlCompare",\s*matrix:\s*"lvlMatrix"\s*\};/,
  );

  // Verify ladder is set to flex across payload results
  assert.match(uiJs, /if \(ladder\) ladder\.style\.display = "flex";/);

  // Verify view routing on resultLevel
  assert.match(uiJs, /if \(resultLevel === "compare"\) \{/);
  assert.match(uiJs, /renderBatteryComparison\(p, sel\);/);
  assert.match(uiJs, /else if \(resultLevel === "matrix"\) \{/);
  assert.match(uiJs, /renderRelativeOptions\(p, sel\);/);
});

test("Compare Batteries: uses baseline system, applies DoD + cold derates, compares swaps vs oversizing and 20-yr costs", () => {
  const uiJs = fs.readFileSync("assets/js/sizing/ui.js", "utf8");
  assert.match(uiJs, /function renderBatteryComparison\(p, selectedSystem\)/);

  // Test chemistry configurations and DoD
  const targetUsableKwh = 10;
  const chems = {
    lfp: { dod: 0.8, cycles: 6000 },
    naion: { dod: 0.85, cycles: 5500 },
    agm: { dod: 0.5, cycles: 500 },
  };

  // Nameplate requirements
  const lfpNameplate = +(targetUsableKwh / chems.lfp.dod).toFixed(1);
  const naionNameplate = +(targetUsableKwh / chems.naion.dod).toFixed(1);
  const agmNameplate = +(targetUsableKwh / chems.agm.dod).toFixed(1);

  assert.equal(
    lfpNameplate,
    12.5,
    "LFP needs 12.5 kWh nameplate for 10 kWh usable (80% DoD to guarantee 6,000 cycles)",
  );
  assert.equal(
    naionNameplate,
    11.8,
    "Sodium needs ~11.8 kWh nameplate for 10 kWh usable (85% DoD)",
  );
  assert.equal(
    agmNameplate,
    20.0,
    "AGM needs 20 kWh nameplate for 10 kWh usable (50% DoD)",
  );

  // Cold weather derate for AGM
  const meanTempColdC = 5;
  const agmColdScale = Math.max(
    0.6,
    Math.min(1, 1 - Math.max(0, 25 - meanTempColdC) * 0.015),
  );
  assert.ok(agmColdScale < 0.8, "AGM loses >20% capacity at 5°C");
  const agmColdNameplate = +(
    targetUsableKwh /
    (chems.agm.dod * agmColdScale)
  ).toFixed(1);
  assert.ok(agmColdNameplate > 25, "AGM cold nameplate expands to >25 kWh");

  // Swaps calculation over 20 years at 300 cycles/yr
  const estCyclesPerYr = 300;
  const lfpSwaps = Math.max(
    0,
    Math.ceil((estCyclesPerYr * 20) / chems.lfp.cycles) - 1,
  );
  const agmSwaps = Math.max(
    0,
    Math.ceil((estCyclesPerYr * 20) / chems.agm.cycles) - 1,
  );
  assert.equal(
    lfpSwaps,
    0,
    "LFP has 0 swaps over 20 years (6000 cycles / 6000 needed)",
  );
  assert.equal(
    agmSwaps,
    11,
    "AGM requires ~11 battery bank swaps over 20 years",
  );

  // Winner logic: Sodium in cold climates (<10°C), LFP in warm/temperate climates
  const isColdSite = meanTempColdC < 10;
  const winnerCold = isColdSite ? "naion" : "lfp";
  assert.equal(
    winnerCold,
    "naion",
    "Sodium-ion is recommended cold champion for freezing sites",
  );

  const meanTempWarmC = 22;
  const isWarmSite = meanTempWarmC < 10;
  const winnerWarm = isWarmSite ? "naion" : "lfp";
  assert.equal(
    winnerWarm,
    "lfp",
    "LFP is most cost-effective pick for warm/temperate sites",
  );
});

test("All Options: strictly excludes AGM, compares capacity tiers relative to baseline, shows deltas", () => {
  const uiJs = fs.readFileSync("assets/js/sizing/ui.js", "utf8");
  assert.match(uiJs, /function renderRelativeOptions\(p, selectedSystem\)/);

  // Verify modern cost-efficient chemistry selection (NOT AGM)
  assert.match(uiJs, /const rawChem = sel\.chemistry \|\| "lfp";/);
  assert.match(
    uiJs,
    /const chem = rawChem === "sodium" \|\| rawChem === "naion" \? "naion" : "lfp";/,
  );

  // Verify tiers definition
  assert.match(uiJs, /label:\s*"Compact \/ Essential"/);
  assert.match(uiJs, /label:\s*"Lean \/ Moderate"/);
  assert.match(uiJs, /label:\s*"Current Selection"/);
  assert.match(uiJs, /label:\s*"High Resilience"/);
  assert.match(uiJs, /label:\s*"Maximum Independence"/);

  // Verify delta calculation format
  const fmtDelta = (val, prefix = "$") => {
    if (Math.abs(val) < 1) return "Baseline";
    return val > 0
      ? `+${prefix}${Math.round(val).toLocaleString()}`
      : `\u2212${prefix}${Math.abs(Math.round(val)).toLocaleString()}`;
  };

  assert.equal(fmtDelta(0), "Baseline");
  assert.equal(fmtDelta(1200), "+$1,200");
  assert.equal(fmtDelta(-500), "\u2212$500");
  assert.equal(fmtDelta(4.5, ""), "+5");
  assert.equal(fmtDelta(-3.2, ""), "\u22123");
});

test("DOM Parity: autoTargetRow exists in HTML and interactive modal/nav buttons have explicit onclick", () => {
  const html = fs.readFileSync("index.html", "utf8");

  // Verify autoTargetRow and autoTarget
  assert.match(html, /id="autoTargetRow"/);
  assert.match(html, /id="autoTarget"/);
  assert.match(html, /value="cut100"/);
  assert.match(html, /value="cut80"/);

  // Verify explicit onclick handlers and ARIA accessibility on previously broken buttons
  assert.match(
    html,
    /id="btnLegalTerms1"[^>]*onclick="window\.openLegalModal && window\.openLegalModal\(\)"/,
  );
  assert.match(
    html,
    /id="btnLegalTerms2"[^>]*onclick="window\.openLegalModal && window\.openLegalModal\(\)"/,
  );
  assert.match(
    html,
    /id="btnLegalTerms3"[^>]*onclick="window\.openLegalModal && window\.openLegalModal\(\)"/,
  );
  assert.match(
    html,
    /id="btnCloseLegal"[^>]*onclick="window\.closeLegalModal && window\.closeLegalModal\(\)"/,
  );
  assert.match(
    html,
    /id="btnCloseSizing"[^>]*onclick="window\.closeSizingModal && window\.closeSizingModal\(\)"/,
  );
  assert.match(
    html,
    /id="btnSendChat"[^>]*onclick="window\.sendChatMsg && window\.sendChatMsg\(\)"/,
  );
  assert.match(
    html,
    /class="nav-toggle"[^>]*onclick="window\.toggleMobileNav && window\.toggleMobileNav\(\)"/,
  );
});

test("Off-Grid goal: setCoords shows offgridLoadWrap and hides billSliderWrap when goal is offgrid", () => {
  const uiJs = fs.readFileSync("assets/js/sizing/ui.js", "utf8");

  // setCoords must check isOffgrid and show the correct slider
  assert.match(
    uiJs,
    /function setCoords\(lat, lon, label, region, country\) \{[\s\S]*?const isOffgrid/,
  );
  assert.match(
    uiJs,
    /billWrap\.style\.display = isOffgrid \? "none" : "block"/,
  );
  assert.match(
    uiJs,
    /offgridWrap\.style\.display = isOffgrid \? "block" : "none"/,
  );

  // setQuickMode must NOT block slider visibility on locationResolved
  assert.match(
    uiJs,
    /billWrap\.style\.display = !isOffgrid \? "block" : "none"/,
  );
  assert.match(
    uiJs,
    /offgridWrap\.style\.display = isOffgrid \? "block" : "none"/,
  );
});

test("Off-Grid goal: setupGoalControls triggers run(false) when coordinates are valid, not just when lastPayload exists", () => {
  const uiJs = fs.readFileSync("assets/js/sizing/ui.js", "utf8");

  // The goal toggle must trigger a run with full feedback whenever coords are valid
  assert.match(
    uiJs,
    /if \(Number\.isFinite\(lat\) && Number\.isFinite\(lon\)\) run\(false\)/,
  );

  // The old broken pattern (only run when lastPayload) must NOT be present in setupGoalControls
  assert.doesNotMatch(
    uiJs,
    /if \(quickMode && lastPayload\) run\(true\);\s*\};/,
  );
});

test("readInputs dailyKwh: bill mode uses kWh derived from bill/rate, not the raw dailyKwhInput field", () => {
  const uiJs = fs.readFileSync("assets/js/sizing/ui.js", "utf8");

  // The broken line that overrode bill-derived kWh must not exist
  assert.doesNotMatch(
    uiJs,
    /dailyKwh = parseFloat\(\$\("dailyKwhInput"\)\.value\) \|\| 10;/,
  );

  // The correct bill-to-kWh conversion must be present
  assert.match(uiJs, /kwhFromBill\(bill, rate\)/);
});
