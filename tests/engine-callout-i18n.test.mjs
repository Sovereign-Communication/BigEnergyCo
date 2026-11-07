// C4 remainder: every engine callout must reach the surface through a locale
// key, not as an English literal. #321 keyed the two oversize sentences that
// carry a dollar figure; the zero-swap, strategy-off and fallback sentences
// (and run.js's exact-hardware note) stayed English on every locale.
//
// These assertions fail on the pre-fix tree: the literals are still there and
// the descriptors do not exist.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildE1kw,
  evaluateOversizeOptimization,
  expandProfile,
  flatProfile,
  sizeForTier,
} from "../assets/js/sizing/engine.js";
import { capacityScaleFor } from "../assets/js/sizing/chem-model.js";
import {
  oversizeCalloutI18n,
  oversizeCallout,
} from "../assets/js/sizing/rescale.js";
import { LOCALES } from "../assets/js/shared/locales.js";
import { LANGS } from "../assets/js/shared/i18n.js";
import { interpolate } from "../assets/js/shared/interpolate.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const KEYED_SCENARIOS = [
  ["zero_swap_solar_only", {}, "engineZeroSwapSolarOnly"],
  ["zero_swap_natural", {}, "engineZeroSwapNatural"],
  ["strategy_off", { replacements: 2 }, "engineStrategyOffSwaps"],
  ["strategy_off", { replacements: 0 }, "engineStrategyOffNoSwaps"],
  ["swaps_cheaper_no_figures", {}, "engineSwapsCheaperNoFigures"],
  ["zero_swap_beyond_search", {}, "engineZeroSwapBeyondSearch"],
  ["standard_sizing_cheapest", {}, "engineStandardSizingCheapest"],
  ["exact_hardware_swaps", { replacements: 2 }, "engineExactHardwareSwaps"],
];

const OFFERED = LANGS.map((l) => l.id).filter((id) => id !== "auto");

test("every callout scenario resolves to a semantic key", () => {
  for (const [scenario, args, expected] of KEYED_SCENARIOS) {
    const message = oversizeCalloutI18n(scenario, args);
    assert.ok(message, `${scenario} must produce a descriptor`);
    assert.equal(message.key, expected, `${scenario} key`);
    assert.ok(message.args && typeof message.args === "object");
  }
});

test("every descriptor key exists in every offered locale", () => {
  const keys = new Set(KEYED_SCENARIOS.map(([, , key]) => key));
  for (const key of keys) {
    for (const lang of OFFERED) {
      const dict = LOCALES[lang] || {};
      assert.equal(typeof dict[key], "string", `${lang} is missing ${key}`);
      const rendered = interpolate(dict[key], {
        battKwh: "27",
        replacements: "2",
        savings: "$1,000",
      });
      assert.ok(
        !/\{[a-zA-Z]+\}/.test(rendered),
        `${lang}.${key} leaves a placeholder: ${rendered}`,
      );
    }
  }
});

test("the engine emits a descriptor wherever it emits a callout", () => {
  const solarOnly = evaluateOversizeOptimization({ battKwh: 0 });
  assert.equal(solarOnly.oversizeScenario, "zero_swap_natural");
  assert.equal(solarOnly.bestPriceCalloutI18n?.key, "engineZeroSwapSolarOnly");

  const natural = evaluateOversizeOptimization({
    battKwh: 10,
    sizingResult: { cyclesEquivalent: 1000 },
    chemistry: "lfp",
    years: 20,
  });
  assert.equal(natural.oversizeScenario, "zero_swap_natural");
  assert.equal(natural.bestPriceCalloutI18n?.key, "engineZeroSwapNatural");

  // The English diagnostic sentence stays as the worker/legacy fallback, but
  // it must agree with the descriptor rather than drift.
  assert.match(solarOnly.bestPriceCallout, /solar-only setup/i);
  assert.match(natural.bestPriceCallout, /naturally outlasts/i);
});

test("no unkeyed English callout literal remains in shipped sizing code", () => {
  for (const file of [
    "assets/js/sizing/engine.js",
    "assets/js/sizing/rescale.js",
    "assets/js/sizing/run.js",
  ]) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    // The English sentence survives as the worker/legacy fallback, but it must
    // be paired with a descriptor the surface can translate. An unpaired
    // literal is the defect this test pins.
    const lines = text.split("\n");
    const unpaired = [];
    lines.forEach((line, i) => {
      if (/^\s*(\/\/|\*)/.test(line)) return;
      if (!/Best 20-year price|Oversize strategy off/.test(line)) return;
      if (/return `Best 20-year price/.test(line)) return; // legacy builder
      const tail = lines.slice(i + 1, i + 3).join("\n");
      if (!/bestPriceCalloutI18n|oversizeCalloutI18n/.test(tail))
        unpaired.push({ line, n: i + 1 });
    });
    assert.deepEqual(
      unpaired,
      [],
      `${file} has an unkeyed callout: ${unpaired
        .map((o) => `${o.n}: ${o.line.trim()}`)
        .join(" | ")}`,
    );
  }
  // The legacy builder must keep a sibling descriptor for the same figures.
  const rescale = fs.readFileSync(
    path.join(root, "assets/js/sizing/rescale.js"),
    "utf8",
  );
  assert.match(rescale, /export function oversizeCalloutI18n/);
  assert.match(rescale, /engineExactHardwareSwaps/);
  assert.doesNotThrow(() =>
    oversizeCallout("swaps_cheaper", { replacements: 2, savingsUsd: 500 }),
  );
});

import { hardwareForRun } from "../assets/js/sizing/usecases.js";

// ── C4: the two remaining keys, constructed rather than sampled ─────────────
//
// Both sentences only exist inside the off-grid reliability-tier search, and
// both need AGM's 500-cycle bank life: the cheap bank is cycled hard enough to
// wear out several times, so a zero-swap bank looks cheaper up front — and the
// fresh verification simulation then either overturns that estimate (the
// no-figures fallback) or finds the estimate beyond the searched envelope (the
// beyond-search fallback). No real-weather site reproduces this by accident,
// so the test builds the state: a pinned synthetic year, the app's US
// landed/labor cost factors, and the app's own off-grid envelope.
function pinnedYear(seed = 20261104, floor = 0.25, drift = 0.22) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const out = [];
  let cloud = 0.8;
  for (let d = 0; d < 365; d++) {
    cloud = Math.min(1, Math.max(floor, cloud + (rnd() - 0.5) * drift));
    const season = 0.55 + 0.45 * Math.sin(((d - 80) / 365) * 2 * Math.PI);
    const amp = 1000 * season;
    for (let h = 0; h < 24; h++) {
      const sun = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
      const ghi = amp * sun * cloud * (0.85 + rnd() * 0.3);
      const tAmb = 8 + 12 * season + 6 * Math.sin(((h - 9) / 12) * Math.PI);
      out.push({ ghi, tAmb: Math.round(tAmb * 10) / 10 });
    }
  }
  return out;
}

// US regional factors from pricing.js: laborF 2.2, landedF 1.1; landed scope
// mids for PV, the AGM bank, and the inverter. Pinned so the fixture describes
// one exact world; a pricing change should not silently move this branch.
const US_MID = {
  pvPerW: ((0.16 + 0.28) / 2) * 1.1,
  agmPerKwh: ((240 + 330) / 2) * 1.1,
  invPerKw: ((90 + 260) / 2) * 1.1,
  laborPerKwh: [12 * 2.2, 30 * 2.2],
};

function tierSizing({ dailyKwh, maxUnmetHoursPerYear }) {
  const hours = pinnedYear();
  const e1kw = buildE1kw(hours);
  const tempsC = Float64Array.from(hours, (h) => h.tAmb);
  const meanTempC = tempsC.reduce((a, b) => a + b, 0) / tempsC.length;
  return sizeForTier({
    e1kw,
    loadWh: expandProfile(flatProfile(dailyKwh), hours.length),
    tempsC,
    chemistry: "agm",
    maxUnmetHoursPerYear,
    years: 1,
    costPerWpv: US_MID.pvPerW,
    costPerKwhBatt: US_MID.agmPerKwh,
    costPerKwInv: US_MID.invPerKw,
    pvMax: 40,
    battMax: 300,
    capacityScale: capacityScaleFor("agm", meanTempC),
    laborPerKwh: US_MID.laborPerKwh,
    invMinKw: dailyKwh / 24,
    oversizeStrategy: true,
  });
}

test("the tier search emits the no-figures swap fallback on a verification flip", () => {
  const sizing = tierSizing({ dailyKwh: 10, maxUnmetHoursPerYear: 87.6 });
  assert.equal(sizing.oversizeScenario, "swaps_cheaper");
  assert.equal(sizing.bestPriceCalloutI18n?.key, "engineSwapsCheaperNoFigures");
  // The estimate pointed at a larger zero-swap bank; verification overturned it.
  assert.ok(sizing.oversizedBattKwh > sizing.battKwh);
});

test("the tier search emits the beyond-search fallback when the estimate exceeds the envelope", () => {
  const sizing = tierSizing({ dailyKwh: 15, maxUnmetHoursPerYear: 87.6 });
  assert.equal(sizing.oversizeScenario, "swaps_cheaper");
  assert.equal(sizing.bestPriceCalloutI18n?.key, "engineZeroSwapBeyondSearch");
  // The estimated zero-swap bank is past the app's own off-grid envelope.
  assert.ok(sizing.oversizedBattKwh > 300);
});

test("an unlocked use case honors the visitor's hardware choice", () => {
  assert.equal(hardwareForRun("billcut", "solar"), "solar");
  assert.equal(hardwareForRun("billcut", "both"), "both");
  assert.equal(hardwareForRun("billcut", undefined), "both");
  // Locked cases keep their physics: ToU is battery-only, off-grid needs both.
  assert.equal(hardwareForRun("tou", "solar"), "battery");
  assert.equal(hardwareForRun("offgrid", "solar"), "both");
  assert.equal(hardwareForRun("backup", "solar"), "both");
});
