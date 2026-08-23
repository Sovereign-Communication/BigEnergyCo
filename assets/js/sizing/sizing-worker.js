// Sizing web worker: keeps multi-second searches off the main thread.
// Message in:  { type: "run", latitude, longitude, dailyKwh, chemistry, years }
// Message out: { type: "ok", payload } | { type: "error", message }
import {
  buildE1kw, flatProfile, expandProfile, sizeAllTiers, simulate,
  dailyExtremes, CHEMISTRIES,
  DERATES_DEFAULT, GAMMA_PMAX, NOCT, ETA_INVERTER,
} from "./engine.js?v=20260823f";
import { fetchHourlyCached } from "./nasa.js?v=20260823f";
import { costRange, getScope, POWMR_CATALOG } from "./pricing.js?v=20260823f";

self.onmessage = async (ev) => {
  const msg = ev.data;
  if (msg?.type !== "run") return;
  try {
    const { latitude, longitude, dailyKwh, chemistry = "lfp", years = 5, pricingScope = "powmr" } = msg;
    const scope = getScope(pricingScope);

    const series = await fetchHourlyCached({ latitude, longitude, years });
    const hours = series.hours;
    const e1kw = buildE1kw(hours);
    const loadWh = expandProfile(flatProfile(dailyKwh), hours.length);
    const tempsC = Float64Array.from(hours, (h) => h.tAmb);

    const results = sizeAllTiers({
      e1kw, loadWh, tempsC, chemistry,
      years: series.meta.years,
      costPerWpv: (scope.pvPerW[0] + scope.pvPerW[1]) / 2,
      costPerKwhBatt: (scope.battPerKwhUsable[0] + scope.battPerKwhUsable[1]) / 2,
      battMax: 250,
    });

    const annualYield = [...e1kw].reduce((a, b) => a + b, 0) / 1000 / series.meta.years;
    const chem = CHEMISTRIES[chemistry] || CHEMISTRIES.lfp;

    const historyTiers = [];
    const tiers = results.map(({ tier, sizing }) => {
      let batteryLifeYears = null;
      let cost = null;

      if (sizing) {
        const cyclesPerYear = sizing.result.cyclesEquivalent / series.meta.years;
        batteryLifeYears = cyclesPerYear > 0 ? chem.cyclesTo80 / cyclesPerYear : null;
        const cr = costRange(sizing.pvKw, sizing.battKwh, pricingScope);
        cost = cr;

        // Full daily range: the band between each day's lowest and highest
        // charge. Top edge touches 100% on charging days for EVERY system —
        // that is the whole point of using percent.
        const traced = simulate({
          pvKw: sizing.pvKw, battKwhUsable: sizing.battKwh,
          e1kw, loadWh, chemistry, tempsC, capture: true,
        });
        const ext = dailyExtremes(traced.socSeries);
        let minPct = 100, emptyDays = 0, fullDays = 0;
        const nDays = ext.min.length;
        for (let d = 0; d < nDays; d++) {
          const lo = ext.min[d] * 100;
          if (lo < minPct) minPct = lo;
          if (lo < 5) emptyDays++;
          if (ext.max[d] >= 0.995) fullDays++;
        }
        historyTiers.push({
          id: tier.id,
          dailyMin: Array.from(ext.min, (v) => Math.round(v * 1000) / 10),
          dailyMax: Array.from(ext.max, (v) => Math.round(v * 1000) / 10),
          minPct: Math.max(0, Math.round(minPct)),
          emptyDays,
          fullDays,
          totalDays: nDays,
        });
      }

      return {
        id: tier.id,
        label: tier.label,
        solvable: !!sizing,
        pvKw: sizing?.pvKw ?? null,
        battKwh: sizing?.battKwh ?? null,
        costLo: cost ? cost.lo : null,
        costHi: cost ? cost.hi : null,
        pvCostMid: cost ? cost.pvMid : null,
        battCostMid: cost ? cost.battMid : null,
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
        pricing: {
          scopeId: scope.id,
          scopeLabel: scope.label,
          source: scope.source,
          note: scope.note,
          catalog: scope.id === "powmr" ? POWMR_CATALOG : null,
        },
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
