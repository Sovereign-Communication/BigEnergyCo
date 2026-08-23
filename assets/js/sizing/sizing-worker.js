// Sizing web worker: keeps multi-second searches off the main thread.
// Message in:  { type: "run", latitude, longitude, dailyKwh, chemistry, years }
// Message out: { type: "ok", payload } | { type: "error", message }
import { buildE1kw, flatProfile, expandProfile, sizeAllTiers, RELIABILITY_TIERS, DERATES_DEFAULT, GAMMA_PMAX, NOCT, ETA_INVERTER } from "./engine.js";
import { fetchHourlyCached, CITY_PRESETS } from "./nasa.js";

self.onmessage = async (ev) => {
  const msg = ev.data;
  if (msg?.type !== "run") return;
  try {
    const { latitude, longitude, dailyKwh, chemistry = "lfp", years = 5 } = msg;

    const series = await fetchHourlyCached({ latitude, longitude, years });
    const hours = series.hours;
    const e1kw = buildE1kw(hours);
    const loadWh = expandProfile(flatProfile(dailyKwh), hours.length);
    const tempsC = Float64Array.from(hours, (h) => h.tAmb);

    const results = sizeAllTiers({
      e1kw, loadWh, tempsC, chemistry,
      years: series.meta.years,
      costPerWpv: 0.35,
      costPerKwhBatt: chemistry === "lfp" ? 140 : chemistry === "naion" ? 160 : 90,
      battMax: 250,
    });

    const annualYield = [...e1kw].reduce((a, b) => a + b, 0) / 1000 / series.meta.years;

    self.postMessage({
      type: "ok",
      payload: {
        meta: series.meta,
        annualYieldPerKw: Math.round(annualYield),
        chemistry,
        tiers: results.map(({ tier, sizing }) => ({
          id: tier.id,
          label: tier.label,
          solvable: !!sizing,
          pvKw: sizing?.pvKw ?? null,
          battKwh: sizing?.battKwh ?? null,
          cost: sizing ? Math.round(sizing.cost) : null,
          unmetHoursPerYear: sizing ? +(sizing.result.unmetHours / series.meta.years).toFixed(1) : null,
          longestGapHours: sizing?.result.longestGapHours ?? null,
          cyclesPerYear: sizing ? Math.round(sizing.result.cyclesEquivalent / series.meta.years) : null,
        })),
        assumptions: {
          derates: DERATES_DEFAULT,
          gammaPerC: GAMMA_PMAX,
          noctC: NOCT,
          etaInverter: ETA_INVERTER,
          dataYears: `${series.meta.startYear}–${series.meta.endYear} (${series.meta.years} yr)`,
          source: series.meta.source,
        },
      },
    });
  } catch (e) {
    self.postMessage({ type: "error", message: String(e && e.message || e) });
  }
};
