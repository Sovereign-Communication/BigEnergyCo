import assert from "node:assert/strict";
import { runSizing } from "../assets/js/sizing/run.js";

const hours = Array.from({ length: 24 * 365 }, (_, i) => ({
  ghi: 1000,
  tAmb: 25,
}));
const fetchWeather = async () => ({
  hours,
  meta: {
    latitude: 21.3,
    longitude: -157.8,
    startYear: 2024,
    endYear: 2024,
    years: 1,
    source: "headless verification",
    offline: false,
  },
});

const payload = await runSizing(
  {
    latitude: 21.3,
    longitude: -157.8,
    years: 1,
    dailyKwh: 2,
    chemistry: "lfp",
    mode: "gridtie",
    tariff: 0.42,
    exportRate: null,
    autoTier: "tier99",
    autoTargetId: "cut80",
  },
  { fetchWeather },
);
const entries = payload.targets || [];
const solvable = entries.filter((x) => x.solvable);
assert.ok(
  solvable.length > 0,
  "real grid-tie target search should produce a result",
);
assert.ok(
  solvable.every((x) => x.cumCostSeries?.years === 20),
  "every solvable positive-tariff target must carry a 20-year series",
);
assert.ok(
  solvable.every(
    (x) =>
      x.cumCostSeries.grid.length === 20 && x.cumCostSeries.solar.length === 20,
  ),
  "series must contain both complete running sums",
);
assert.equal(
  payload.annualGridSpendUsd,
  Math.round(2 * 365 * 0.42),
  "payload must retain the tariff baseline",
);

const noTariff = await runSizing(
  {
    latitude: 21.3,
    longitude: -157.8,
    years: 1,
    dailyKwh: 2,
    chemistry: "lfp",
    mode: "gridtie",
    tariff: null,
    exportRate: null,
  },
  { fetchWeather },
);
assert.ok(
  (noTariff.targets || []).every((x) => x.cumCostSeries === null),
  "missing tariff must not invent savings data",
);
console.log("cumulative real-entry flow passed");
