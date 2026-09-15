import { test } from "node:test";
import assert from "node:assert/strict";
import { PERSONAS } from "./personas.mjs";
import { APPLIANCE_NAMES } from "../assets/js/sizing/appliances.js";
import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import {
  OFFLINE_PROFILES,
  PROFILE_YEAR,
} from "../assets/js/sizing/profiles.js";
import { runSizing } from "../assets/js/sizing/run.js";

const profileByName = new Map(
  OFFLINE_PROFILES.map((profile) => [profile.name, profile]),
);

function fixtureFor(persona) {
  const profile = profileByName.get(persona.profile);
  assert.ok(
    profile,
    `${persona.id}: missing offline profile ${persona.profile}`,
  );
  return async () => ({
    hours: synthesizeFromProfile(profile),
    meta: {
      latitude: profile.lat,
      longitude: profile.lon,
      startYear: PROFILE_YEAR,
      endYear: PROFILE_YEAR,
      years: 1,
      source: `offline persona fixture: ${profile.name}`,
      offline: true,
    },
  });
}

function inputFor(persona) {
  return {
    latitude: profileByName.get(persona.profile).lat,
    longitude: profileByName.get(persona.profile).lon,
    dailyKwh: persona.dailyKwh,
    tariff: persona.tariff,
    exportRate: persona.goal.mode === "gridtie" ? persona.tariff * 0.25 : null,
    years: 1,
    mode: persona.goal.mode,
    chemistry: persona.chemistry,
    autoTier: persona.goal.tier,
    customCut: persona.goal.cut,
  };
}

function selectedSystem(payload) {
  return (
    payload.focus ||
    payload.customTarget ||
    payload.tiers?.find((tier) => tier.solvable) ||
    null
  );
}

function assertFiniteNumbers(value, label, seen = new Set()) {
  if (value === null || value === undefined || typeof value !== "object") {
    if (typeof value === "number")
      assert.ok(Number.isFinite(value), `${label}: non-finite number`);
    return;
  }
  if (seen.has(value)) return;
  seen.add(value);
  if (ArrayBuffer.isView(value) || Array.isArray(value)) {
    for (const item of value) assertFiniteNumbers(item, label, seen);
    return;
  }
  for (const [key, item] of Object.entries(value))
    assertFiniteNumbers(item, `${label}.${key}`, seen);
}

test("GATE: persona registry covers twelve named worldwide stories", () => {
  assert.equal(PERSONAS.length, 12);
  assert.equal(new Set(PERSONAS.map((persona) => persona.id)).size, 12);
  for (const persona of PERSONAS) {
    assert.ok(persona.region && persona.story && persona.profile);
    assert.ok(persona.dailyKwh > 0);
    assert.ok(persona.tariff > 0);
    assert.ok(["offgrid", "gridtie"].includes(persona.goal.mode));
    assert.ok(["lfp", "naion", "agm"].includes(persona.chemistry));
  }
});

test("GATE: every persona references a real offline profile and appliance", () => {
  for (const persona of PERSONAS) {
    assert.ok(
      profileByName.has(persona.profile),
      `${persona.id}: profile is bundled`,
    );
    for (const name of persona.appliances) {
      assert.ok(
        APPLIANCE_NAMES.has(name),
        `${persona.id}: appliance ${name} is catalogued`,
      );
    }
  }
});

test("GATE: every persona is deterministic, finite, bounded, and energy-conserving", async () => {
  for (const persona of PERSONAS) {
    const first = await runSizing(inputFor(persona), {
      fetchWeather: fixtureFor(persona),
    });
    const second = await runSizing(inputFor(persona), {
      fetchWeather: fixtureFor(persona),
    });
    assert.deepEqual(
      first,
      second,
      `${persona.id}: identical offline runs must match`,
    );
    assertFiniteNumbers(first, persona.id);

    const system = selectedSystem(first);
    assert.ok(system, `${persona.id}: a practical focus or target exists`);
    assert.ok(
      system.pvKw >= persona.bounds.pvKw[0] &&
        system.pvKw <= persona.bounds.pvKw[1],
      `${persona.id}: PV is bounded`,
    );
    assert.ok(
      system.battKwh >= persona.bounds.battKwh[0] &&
        system.battKwh <= persona.bounds.battKwh[1],
      `${persona.id}: battery is bounded`,
    );
    if (persona.tariff > 0 && system.costLo > 0) {
      assert.ok(
        Number.isFinite(system.paybackYearsLo),
        `${persona.id}: payback is finite`,
      );
      assert.ok(system.paybackYearsLo >= persona.bounds.paybackYears[0]);
      assert.ok(system.paybackYearsHi <= persona.bounds.paybackYears[1]);
    }

    const result = system.result || system.simulation || first.focus?.result;
    if (result) {
      const loadWh = result.loadWh ?? first.loadWh;
      if (
        Number.isFinite(result.servedWh) &&
        Number.isFinite(result.unmetWh) &&
        Number.isFinite(loadWh)
      ) {
        assert.ok(
          Math.abs(result.servedWh + result.unmetWh - loadWh) < 1e-3,
          `${persona.id}: served + unmet = load`,
        );
      }
    }
  }
});
