import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildE1kw,
  flatProfile,
  expandProfile,
  sizeForTier,
  CHEMISTRIES,
} from "../assets/js/sizing/engine.js";
import { batteryReplacements } from "../assets/js/sizing/money.js";
import { runSizing } from "../assets/js/sizing/run.js";
import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import {
  OFFLINE_PROFILES,
  PROFILE_YEAR,
} from "../assets/js/sizing/profiles.js";

const london = OFFLINE_PROFILES.find((p) => p.name.includes("London"));
const honolulu = OFFLINE_PROFILES.find((p) => p.name.includes("Honolulu"));

function fixtureWeather(site, lat, lon) {
  return async () => ({
    hours: synthesizeFromProfile(site),
    meta: {
      latitude: lat,
      longitude: lon,
      startYear: PROFILE_YEAR,
      endYear: PROFILE_YEAR,
      years: 1,
      source: "test fixture",
      offline: true,
    },
  });
}

// Regression: the oversize estimate can point beyond the searched envelope
// (London AGM tier99: 375 kWh target vs 250 kWh battMax). The recommendation
// must then carry swaps_cheaper — never a note advertising an unbuildable
// oversized bank alongside swap-carrying numbers.
test("sizeForTier never pairs swaps with an oversized_cheaper note", () => {
  const hours = synthesizeFromProfile(london);
  const e1kw = buildE1kw(hours);
  const loadWh = expandProfile(flatProfile(20), hours.length);
  const tempsC = Float64Array.from(hours, (h) => h.tAmb);
  const t = sizeForTier({
    e1kw,
    loadWh,
    tempsC,
    chemistry: "agm",
    maxUnmetHoursPerYear: 87.6,
    years: 1,
    costPerWpv: 0.4,
    costPerKwhBatt: 140,
    costPerKwInv: 60,
    pvMax: 30,
    battMax: 250,
    laborPerKwh: [12, 30],
    invMinKw: 20 / 24,
  });
  assert.ok(t, "tier must solve");
  const repl = batteryReplacements(
    t.result.cyclesEquivalent / 1,
    CHEMISTRIES.agm.cyclesTo80,
  );
  if (repl > 0) {
    assert.notEqual(
      t.oversizeScenario,
      "oversized_cheaper",
      `note/system contradiction: ${repl} swaps with note "${t.bestPriceCallout}"`,
    );
    assert.equal(t.oversizeScenario, "swaps_cheaper");
    assert.match(t.bestPriceCallout, /Best 20-year price:/);
    assert.doesNotMatch(
      t.bestPriceCallout,
      /oversizing battery to \d+ kWh avoids replacements/,
    );
  }
});

// User-visible invariant: the custom bill-cut column (the 1–111% slider the
// visitor actually drags) must never show a swap-carrying system under a
// scenario note that claims oversizing is cheaper.
test("runSizing custom-cut entries never pair swaps with an oversized_cheaper note", async () => {
  const payload = await runSizing(
    {
      latitude: 21.31,
      longitude: -157.86,
      dailyKwh: 54,
      tariff: 0.15,
      exportRate: null,
      years: 1,
      mode: "gridtie",
      chemistry: "auto",
      customCut: 0.82,
      hardwareConfig: "both",
    },
    { fetchWeather: fixtureWeather(honolulu, 21.31, -157.86) },
  );
  const entries = (payload.customCut && payload.customCut.entries) || [];
  assert.ok(entries.length > 0, "custom-cut column must have entries");
  for (const e of entries) {
    if (e.replacementsHorizon > 0) {
      assert.notEqual(
        e.oversizeScenario,
        "oversized_cheaper",
        `${e.chemistry}: ${e.replacementsHorizon} swaps with note "${e.bestPriceCallout}"`,
      );
    } else {
      // A zero-swap recommendation is self-consistent by construction.
      assert.ok(
        ["oversized_cheaper", "swaps_cheaper", "zero_swap_natural"].includes(
          e.oversizeScenario,
        ),
      );
    }
  }
});
