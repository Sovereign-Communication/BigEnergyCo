import test from "node:test";
import assert from "node:assert/strict";
import {
  DAYS_PER_MONTH,
  costRange,
  fullRange,
  CURRENCIES,
} from "../assets/js/sizing/pricing.js";
import { readFileSync } from "node:fs";
import { runSizing } from "../assets/js/sizing/run.js";
import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import { OFFLINE_PROFILES } from "../assets/js/sizing/profiles.js";

function fakeWeather(lat, lon) {
  const p =
    OFFLINE_PROFILES.find((pp) => pp.name.includes("Honolulu")) ||
    OFFLINE_PROFILES[0];
  return {
    hours: synthesizeFromProfile(p),
    meta: {
      latitude: lat,
      longitude: lon,
      startYear: 2023,
      endYear: 2023,
      years: 1,
      source: "fake",
      timeStandard: "LST",
    },
  };
}

test("DAYS_PER_MONTH is 30.44 and bill<->kWh round-trips", () => {
  assert.equal(DAYS_PER_MONTH, 30.44);
  const bill = 150,
    rate = 0.28;
  const kwhDay = bill / (rate * DAYS_PER_MONTH);
  const spend = kwhDay * 365 * rate;
  assert.ok(Math.abs(spend - bill * 12) / (bill * 12) < 0.005);
});

test("costRange now exposes pvLo/pvHi and invLo/invHi", () => {
  const r = costRange(5, 10, "powmr", "lfp");
  assert.ok(r.pvLo > 0 && r.invLo > 0);
  assert.equal(r.lo, r.pvLo + 10 * 110 + r.invLo); // rough check includes all
});

test("fullRange pvCostLo/Hi includes inverter (panels+inverter)", () => {
  const f = fullRange(5, 10, "lfp");
  // cells: pv 550 + inv 300 = 850
  assert.equal(f.pvCostLo, 850);
  // powmr: pv 1900 + inv 1000 = 2900
  assert.equal(f.pvCostHi, 2900);
});

test("FX: display tariff round-trips via USD", async () => {
  const fx = CURRENCIES.PHP.perUSD; // 58
  const display = 0.42 * fx; // show 24.36 PHP/kWh
  const usd = display / fx;
  assert.ok(Math.abs(usd - 0.42) < 1e-9);
  // run sizing with tariff 0.42 USD should give same result as via display conversion
  const deps = { fetchWeather: async () => fakeWeather(21.31, -157.86) };
  const base = await runSizing(
    {
      latitude: 21.31,
      longitude: -157.86,
      dailyKwh: 10,
      chemistry: "lfp",
      years: 1,
      tariff: 0.42,
      mode: "offgrid",
    },
    deps,
  );
  const viaFx = await runSizing(
    {
      latitude: 21.31,
      longitude: -157.86,
      dailyKwh: 10,
      chemistry: "lfp",
      years: 1,
      tariff: display / fx,
      mode: "offgrid",
    },
    deps,
  );
  assert.equal(base.tiers[0].pvKw, viaFx.tiers[0].pvKw);
});

test("UI converts LCOE and grid rates into the selected currency", () => {
  const ui = readFileSync(
    new URL("../assets/js/sizing/ui.js", import.meta.url),
    "utf8",
  );
  assert.match(ui, /function energyRate\(usdPerKwh\)/);
  assert.match(ui, /usdPerKwh \* \(fx \? fx\.rate : 1\)/);
  assert.match(ui, /energyRate\(a\.lcoeUsdPerKwh\)/);
  assert.match(ui, /energyRate\(b\.lcoeUsdPerKwh\)/);
  assert.match(ui, /energyRate\(t\.lcoeUsdPerKwh\)/);
});

test("location changes refresh the display currency in existing results", () => {
  const ui = readFileSync(
    new URL("../assets/js/sizing/ui.js", import.meta.url),
    "utf8",
  );
  // setCurrency must refresh the manual-edit baseline so a later typed rate
  // isn't double-converted against a stale pre-location snapshot.
  assert.match(ui, /prevFxSnapshot = fxActive\(\);/);
  // applyEstimatedTariff must re-render existing results after the tariff
  // input is rewritten, so GPS/city changes update the money figures.
  assert.match(ui, /if \(lastPayload\) renderResults\(lastPayload\);/);
  // The money bar, assumptions text and print sheet must convert the tariff
  // into the selected currency rather than printing raw USD.
  assert.match(ui, /tariff: localRate\(p\.tariff\)/);
  assert.match(ui, /Grid spend assumes \$\{energyRate\(p\.tariff\)\}/);
  assert.match(ui, /grid price \$\{energyRate\(p\.tariff\)\}/);
});

test("export-rate input is converted like the tariff (display currency in, USD out)", () => {
  const ui = readFileSync(
    new URL("../assets/js/sizing/ui.js", import.meta.url),
    "utf8",
  );
  assert.match(
    ui,
    /exportRate: \(\(\) => \{[\s\S]*?v \/ fx\.rate[\s\S]*?\}\)\(\)/,
  );
  assert.match(ui, /label\[for="exportRate"\] span/);
});

test("LCOE fields present for all solvable tiers after bugfix", async () => {
  const deps = { fetchWeather: async () => fakeWeather(21.31, -157.86) };
  const p = await runSizing(
    {
      latitude: 21.31,
      longitude: -157.86,
      dailyKwh: 10,
      chemistry: "lfp",
      years: 1,
      tariff: 0.42,
      mode: "offgrid",
    },
    deps,
  );
  for (const t of p.tiers)
    if (t.solvable)
      assert.ok(Number.isFinite(t.lcoeUsdPerKwh), `tier ${t.id} missing lcoe`);
  const pg = await runSizing(
    {
      latitude: 21.31,
      longitude: -157.86,
      dailyKwh: 10,
      chemistry: "lfp",
      years: 1,
      tariff: 0.42,
      mode: "gridtie",
    },
    deps,
  );
  for (const t of pg.targets)
    if (t.solvable)
      assert.ok(
        Number.isFinite(t.lcoeUsdPerKwh),
        `target ${t.id} missing lcoe`,
      );
  const pa = await runSizing(
    {
      latitude: 21.31,
      longitude: -157.86,
      dailyKwh: 10,
      chemistry: "auto",
      years: 1,
      tariff: 0.42,
      mode: "offgrid",
    },
    deps,
  );
  for (const a of pa.auto)
    if (a.solvable)
      assert.ok(
        Number.isFinite(a.lcoeUsdPerKwh),
        `auto ${a.chemistry} missing lcoe`,
      );
});
