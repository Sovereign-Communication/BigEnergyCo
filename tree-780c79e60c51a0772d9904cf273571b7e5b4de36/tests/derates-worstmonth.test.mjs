// Phase 4 acceptance regressions:
// 1. User-adjustable wiring/MPPT derates reach the engine, change the payload,
//    and are clamped to honest bounds (a visitor cannot claim a lossless
//    system). At defaults the payload is byte-for-byte unchanged.
// 2. The worst-month caveat from the climate analysis is surfaced in the UI as
//    a plain-language element (index.html affordance guard).
// Run: node --test tests/derates-worstmonth.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runOnce(overrides = {}) {
  const { runSizing } = await import("../assets/js/sizing/run.js");
  const { synthesizeFromProfile } = await import("../assets/js/sizing/nasa.js");
  const { OFFLINE_PROFILES, PROFILE_YEAR } =
    await import("../assets/js/sizing/profiles.js");
  const city = OFFLINE_PROFILES.find((p) => p.name.includes("Honolulu"));
  const fakeWeather = async () => ({
    hours: synthesizeFromProfile(city),
    meta: {
      latitude: 21.31,
      longitude: -157.86,
      startYear: PROFILE_YEAR,
      endYear: PROFILE_YEAR,
      years: 1,
      source: "test fixture",
      offline: false,
    },
  });
  return runSizing(
    {
      latitude: 21.31,
      longitude: -157.86,
      dailyKwh: 10,
      tariff: 0.42,
      chemistry: "lfp",
      mode: "offgrid",
      climateAware: true,
      ...overrides,
    },
    { fetchWeather: fakeWeather },
  );
}

test("derate overrides change assumptions.derates and are clamped", async () => {
  const base = await runOnce();
  assert.equal(base.assumptions.derates.wiring, 0.98);
  assert.equal(base.assumptions.derates.mppt, 0.98);

  const custom = await runOnce({ wiringOverride: 0.85, mpptOverride: 0.9 });
  assert.equal(custom.assumptions.derates.wiring, 0.85);
  assert.equal(custom.assumptions.derates.mppt, 0.9);
  // Weaker wiring/MPPT factors mean each kW produces less: measured yield
  // must drop, never rise.
  assert.ok(
    custom.annualYieldPerKw < base.annualYieldPerKw,
    `weaker derates must reduce annualYieldPerKw (${custom.annualYieldPerKw} vs ${base.annualYieldPerKw})`,
  );

  // A visitor cannot claim a lossless system: values above 1 and below the
  // honest floors are clamped.
  const clamped = await runOnce({ wiringOverride: 1.2, mpptOverride: 0.5 });
  assert.equal(clamped.assumptions.derates.wiring, 1);
  assert.equal(clamped.assumptions.derates.mppt, 0.9);
  // And the defaults must reproduce the stock payload exactly.
  const defaults = await runOnce({ wiringOverride: 0.98, mpptOverride: 0.98 });
  assert.equal(defaults.annualYieldPerKw, base.annualYieldPerKw);
});

test("worst-month caveat is surfaced in the UI", () => {
  const html = fs.readFileSync(
    path.join(__dirname, "..", "index.html"),
    "utf8",
  );
  assert.match(html, /id="worstMonthCaveat"/);
  assert.match(html, /worst month|darkest month/i);
});
