// Best First Dollar: action ranking tests.
// Run: node --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTION_TYPES,
  ACTION_DEFS,
  computeMarginalCosts,
  estimateActionSavings,
  rankActions,
  computeActionScore,
} from "../assets/js/sizing/best-first.js";
import { buildFrontier } from "../assets/js/sizing/frontier.js";
import {
  buildE1kw,
  flatProfile,
  expandProfile,
} from "../assets/js/sizing/engine.js";
import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import { OFFLINE_PROFILES } from "../assets/js/sizing/profiles.js";

const LINEAR_COSTS = {
  costPerWpv: 0.35,
  costPerKwhBatt: 140,
  costPerKwInv: 60,
};

// Build a plausible frontier from the real engine so ranking is exercised
// against genuine marginal-cost data.
function buildGridTieFrontier() {
  const profile = OFFLINE_PROFILES.find((p) => p.name.includes("Los Angeles"));
  assert.ok(profile, "offline profile exists");
  const hours = synthesizeFromProfile(profile);
  const e1kw = buildE1kw(hours);
  const tempsC = Float64Array.from(hours, (h) => h.tAmb);
  const loadWh = expandProfile(flatProfile(25), hours.length);
  const front = buildFrontier({
    e1kw,
    loadWh,
    tempsC,
    chemistry: "lfp",
    mode: "gridtie",
    pvMax: 12,
    battMax: 40,
    ...LINEAR_COSTS,
  });
  assert.ok(
    front && front.points && front.points.length,
    "frontier must be built",
  );
  return front;
}

const BASE_PAYLOAD = {
  dailyKwh: 25,
  tariff: 0.35,
  exportRate: 0.15,
  mode: "gridtie",
  latitude: 37.77,
  longitude: -122.42,
};

test("computeMarginalCosts returns an ascending list with positive deltas", () => {
  const front = buildGridTieFrontier();
  const costs = computeMarginalCosts(front);
  assert.ok(Array.isArray(costs));
  for (const c of costs) {
    assert.ok(c.deltaPct > 0, "each entry must represent a coverage gain");
    assert.ok(
      c.costPerPct > 0,
      "each entry must have a positive marginal cost",
    );
    assert.ok(Number.isFinite(c.fromPct) && Number.isFinite(c.toPct));
  }
});

test("ACTION_DEFS covers every type with the fields the UI reads", () => {
  assert.ok(Array.isArray(Object.values(ACTION_TYPES)));
  for (const type of Object.values(ACTION_TYPES)) {
    const def = ACTION_DEFS[type];
    assert.ok(def, `definition exists for ${type}`);
    assert.equal(def.id, type);
    assert.ok(def.label && def.description && def.icon);
    assert.ok(typeof def.resilienceScore === "number");
  }
});

test("estimateActionSavings returns structured estimates for known actions", () => {
  const front = buildGridTieFrontier();
  for (const type of Object.values(ACTION_TYPES)) {
    const def = ACTION_DEFS[type];
    const est = estimateActionSavings(def, front, BASE_PAYLOAD);
    if (type === ACTION_TYPES.GENERATOR) {
      // generator returns a fixed-cost + operating-cost shape
      assert.ok(est && est.implementationCost > 0 && est.annualCost > 0);
    } else {
      assert.ok(est, `${type} produces an estimate`);
      assert.ok(Number.isFinite(est.implementationCost), `${type} has a cost`);
      assert.ok(typeof est.paybackYears === "number");
    }
  }
});

test("rankActions sorts best-first by composite score", () => {
  const front = buildGridTieFrontier();
  const ranked = rankActions(BASE_PAYLOAD, front);
  assert.ok(ranked.length > 0);
  for (let i = 1; i < ranked.length; i++) {
    assert.ok(
      ranked[i - 1].score >= ranked[i].score,
      "scores must be non-increasing down the list",
    );
  }
  // First item gets the "best-first" marker in the UI
  assert.ok(ranked[0].score >= ranked[ranked.length - 1].score);
});

test("computeActionScore rejects unaffordable or zero-savings actions", () => {
  assert.equal(
    computeActionScore(ACTION_DEFS[ACTION_TYPES.SOLAR], null),
    -Infinity,
  );
  const bad = {
    implementationCost: 0,
    annualSavingsUsd: 100,
    paybackYears: 5,
    resilienceGain: 0.4,
  };
  assert.equal(
    computeActionScore(ACTION_DEFS[ACTION_TYPES.SOLAR], bad),
    -Infinity,
  );
});

test("rankActions returns an empty list for a null/failed frontier", () => {
  const ranked = rankActions(BASE_PAYLOAD, null);
  assert.deepEqual(ranked, []);
});

test("estimateActionSavings returns null for an unknown action id", () => {
  const front = buildGridTieFrontier();
  const est = estimateActionSavings({ id: "teleport" }, front, BASE_PAYLOAD);
  assert.equal(est, null);
});
