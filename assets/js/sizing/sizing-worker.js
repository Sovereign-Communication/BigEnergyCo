// Sizing web worker: keeps multi-second searches off the main thread.
// Message in:  { type: "run", latitude, longitude, dailyKwh, chemistry, years }
// Message out: { type: "ok", payload } | { type: "error", message }
import {
  buildE1kw, flatProfile, expandProfile, sizeAllTiers, simulate,
  dailyMinimums, CHEMISTRIES,
  DERATES_DEFAULT, GAMMA_PMAX, NOCT, ETA_INVERTER,
} from "./engine.js";
import { fetchHourlyCached } from "./nasa.js";

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

      if (sizing) {
        const cyclesPerYear = sizing.result.cyclesEquivalent / series.meta.years;
        batteryLifeYears = cyclesPerYear > 0 ? chem.cyclesTo80 / cyclesPerYear : null;

        // One clean number per day: the lowest the battery got that day.
        const traced = simulate({
          pvKw: sizing.pvKw, battKwhUsable: sizing.battKwh,
          e1kw, loadWh, chemistry, tempsC, capture: true,
        });
        const mins = dailyMinimums(traced.socSeries);
        let minPct = 100, emptyDays = 0;
        for (const v of mins) {
          const p = v * 100;
          if (p < minPct) minPct = p;
          if (p < 5) emptyDays++;
        }
        historyTiers.push({
          id: tier.id,
          dailyMin: Array.from(mins, (v) => Math.round(v * 1000) / 10),
          minPct: Math.max(0, Math.round(minPct)),
          emptyDays,
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
          startYear: series.meta.startYear,
          endYear: series.meta.endYear,
          days: Math.ceil(hours.length / 24),
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
