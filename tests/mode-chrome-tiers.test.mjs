// The generator-runtime question is the engine's reliability tiers in plainer
// words — not a parallel invention. This pins the mapping to the engine's own
// RELIABILITY_TIERS: every tierForGeneratorRuntime output must be a real
// engine tier id, and the unmet-hour budgets must order exactly as the
// question promises ("0% — never" < "1% — a few days a year" < "2%+").
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  GENERATOR_RUNTIMES,
  tierForGeneratorRuntime,
  generatorRuntimeForTier,
} from "../assets/js/sizing/mode-chrome.js";
import { RELIABILITY_TIERS } from "../assets/js/sizing/engine.js";

const byId = Object.fromEntries(RELIABILITY_TIERS.map((t) => [t.id, t]));

test("TIERS: every generator answer maps to a real engine tier", () => {
  for (const rt of GENERATOR_RUNTIMES) {
    const tier = tierForGeneratorRuntime(rt);
    assert.ok(byId[tier], `${rt} maps to ${tier}, which is not an engine tier`);
  }
});

test("TIERS: the unmet-hour budgets match the question's promise", () => {
  // 1% of a year is 87.6 h; 5% is 438 h. The question's three answers are
  // the engine's three reliability tiers, in order.
  assert.equal(byId[tierForGeneratorRuntime("gen0")].maxUnmetHoursPerYear, 0);
  assert.equal(
    byId[tierForGeneratorRuntime("gen1")].maxUnmetHoursPerYear,
    87.6,
  );
  assert.equal(byId[tierForGeneratorRuntime("gen2")].maxUnmetHoursPerYear, 438);
});

test("TIERS: the mapping round-trips through the engine tier ids", () => {
  for (const rt of GENERATOR_RUNTIMES) {
    assert.equal(generatorRuntimeForTier(tierForGeneratorRuntime(rt)), rt);
  }
  // Every engine tier is reachable from the question — no orphan tier.
  const mapped = new Set(GENERATOR_RUNTIMES.map(tierForGeneratorRuntime));
  for (const t of RELIABILITY_TIERS) {
    assert.ok(mapped.has(t.id), `engine tier ${t.id} unreachable from the UI`);
  }
});
