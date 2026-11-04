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

import { evaluateOversizeOptimization } from "../assets/js/sizing/engine.js";
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

test("an unlocked use case honors the visitor's hardware choice", () => {
  assert.equal(hardwareForRun("billcut", "solar"), "solar");
  assert.equal(hardwareForRun("billcut", "both"), "both");
  assert.equal(hardwareForRun("billcut", undefined), "both");
  // Locked cases keep their physics: ToU is battery-only, off-grid needs both.
  assert.equal(hardwareForRun("tou", "solar"), "battery");
  assert.equal(hardwareForRun("offgrid", "solar"), "both");
  assert.equal(hardwareForRun("backup", "solar"), "both");
});
