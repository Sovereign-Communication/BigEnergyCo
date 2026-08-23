// Sizing web worker: keeps multi-second searches off the main thread.
// Message in:  { type: "run", latitude, longitude, dailyKwh, chemistry, years }
// Message out: { type: "ok", payload } | { type: "error", message }
import {
  buildE1kw, flatProfile, expandProfile, sizeAllTiers, simulate,
  downsampleEnvelope, RELIABILITY_TIERS, CHEMISTRIES,
  DERATES_DEFAULT, GAMMA_PMAX, NOCT, ETA_INVERTER,
} from "./engine.js";
import { fetchHourlyCached } from "./nasa.js";

const HISTORY_BUCKETS = 1500;

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
    const chem = CHEMISTRIES[chemistry] || CHEMISTRIES.lfp;

    const historyTiers = [];
    const tiers = results.map(({ tier, sizing }) => {
      let batteryLifeYears = null;
      let socEnv = null;

      if (sizing) {
        const cyclesPerYear = sizing.result.cyclesEquivalent / series.meta.years;
        batteryLifeYears = cyclesPerYear > 0 ? chem.cyclesTo80 / cyclesPerYear : null;

        // Re-run the chosen configuration once more to capture the full
        // hourly SOC trajectory for the reliability chart.
        const traced = simulate({
          pvKw: sizing.pvKw, battKwhUsable: sizing.battKwh,
          e1kw, loadWh, chemistry, tempsC, capture: true,
        });
        socEnv = downsampleEnvelope(traced.socSeries, HISTORY_BUCKETS)
          .map((p) => [
            Math.round(p.lo * 1000) / 10, // % SOC, one decimal
            Math.round(p.hi * 1000) / 10,
          ]);
        // Share of hours spent essentially full — the real difference between
        // tiers is DURATION at 100%, never peak height (every tier tops out).
        let fullHrs = 0;
        for (const v of traced.socSeries) if (v >= 0.95) fullHrs++;
        historyTiers.push({
          id: tier.id,
          env: socEnv,
          fullPct: Math.round((fullHrs / traced.socSeries.length) * 100),
        });
      }

      return {
        id: tier.id,
        label: tier.label,
        solvable: !!sizing,
        pvKw: sizing?.pvKw ?? null,
        battKwh: sizing?.battKwh ?? null,
        cost: sizing ? Math.round(sizing.cost) : null,
        unmetHoursPerYear: sizing ? +(sizing.result.unmetHours / series.meta.years).toFixed(1) : null,
        longestGapHours: sizing?.result.longestGapHours ?? null,
        cyclesPerYear: sizing ? Math.round(sizing.result.cyclesEquivalent / series.meta.years) : null,
        batteryLifeYears: batteryLifeYears === null ? null : +batteryLifeYears.toFixed(1),
        minSocPct: sizing ? +(sizing.result.minSoc * 100).toFixed(0) : null,
      };
    });

    self.postMessage({
      type: "ok",
      payload: {
        meta: series.meta,
        annualYieldPerKw: Math.round(annualYield),
        chemistry,
        chemLabel: chem.label,
        tiers,
        history: {
          buckets: HISTORY_BUCKETS,
          startYear: series.meta.startYear,
          endYear: series.meta.endYear,
          tiers: historyTiers,
        },
        assumptions: {
          derates: DERATES_DEFAULT,
          gammaPerC: GAMMA_PMAX,
          noctC: NOCT,
          etaInverter: ETA_INVERTER,
          dataYears: `${series.meta.startYear}–${series.meta.endYear} (${series.meta.years} yr)`,
          source: series.meta.source,
          cycleLifeTo80: { [chemistry]: chem.cyclesTo80 },
        },
      },
    });
  } catch (e) {
    self.postMessage({ type: "error", message: String(e && e.message || e) });
  }
};
