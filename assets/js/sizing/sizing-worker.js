// Sizing web worker: keeps multi-second searches off the main thread.
// Message in:  { type: "run", latitude, longitude, dailyKwh, chemistry, years,
//                tariff, mode: "offgrid" | "gridtie" }
// Message out: { type: "ok", payload } | { type: "error", message }
import {
  buildE1kw, flatProfile, expandProfile, sizeAllTiers, simulate,
  sizeAllBillTargets, dailyExtremes, CHEMISTRIES,
  DERATES_DEFAULT, GAMMA_PMAX, NOCT, ETA_INVERTER, capacityScaleFor,
} from "./engine.js?v=20260823j";
import { fetchHourlyCached } from "./nasa.js?v=20260823j";
import { fullRange, getScope, POWMR_CATALOG } from "./pricing.js?v=20260823j";
import {
  annualGridSpendUsd, paybackYears, batteryReplacements, lcoeUsdPerKwh,
} from "./money.js?v=20260823j";

self.onmessage = async (ev) => {
  const msg = ev.data;
  if (msg?.type !== "run") return;
  try {
    const { latitude, longitude, dailyKwh, chemistry = "lfp", years = 5, tariff = null, mode = "offgrid" } = msg;

    const series = await fetchHourlyCached({ latitude, longitude, years });
    const hours = series.hours;
    const e1kw = buildE1kw(hours);
    const loadWh = expandProfile(flatProfile(dailyKwh), hours.length);
    const tempsC = Float64Array.from(hours, (h) => h.tAmb);

    // Delivered-capacity factor: rate loss × cold loss (matters for
    // lead-acid; LFP/sodium are 1.0 except cold charging blocks).
    const meanTempC = tempsC.reduce((a, b) => a + b, 0) / tempsC.length;
    const capScale = capacityScaleFor(chemistry, meanTempC);

    const annualYield = [...e1kw].reduce((a, b) => a + b, 0) / 1000 / series.meta.years;
    const chem = CHEMISTRIES[chemistry] || CHEMISTRIES.lfp;
    const gridSpend = annualGridSpendUsd(dailyKwh, tariff);
    const landedMidBattKwh = (() => {
      const landedScope = getScope("landed");
      return (landedScope.battPerKwhUsable[0] + landedScope.battPerKwhUsable[1]) / 2;
    })();

    // ── Grid-connected mode: smallest systems that cut the bill by X% ──
    if (mode === "gridtie") {
      const landedScope = getScope("landed");
      const results = sizeAllBillTargets({
        e1kw, loadWh, tempsC, chemistry,
        years: series.meta.years,
        costPerWpv: (landedScope.pvPerW[0] + landedScope.pvPerW[1]) / 2,
        costPerKwhBatt: landedMidBattKwh,
        pvMax: 45, battMax: 120, battStep: 1,
        capacityScale: capScale,
      });

      const loadTotalKwh = [...loadWh].reduce((a, b) => a + b, 0) / 1000;

      const targets = results.map(({ target, sizing }) => {
        if (!sizing) {
          return { id: target.id, label: target.label, solvable: false };
        }
        const cyclesPerYear = sizing.result.cyclesEquivalent / series.meta.years;
        const cost = fullRange(sizing.pvKw, sizing.battKwh, chemistry);
        const servedKwhPerYear =
          (sizing.result.directWh + sizing.result.battWhAc) / 1000 / series.meta.years;
        const replacements25y = batteryReplacements(cyclesPerYear, chem.cyclesTo80);
        const battReplCost = Math.round(sizing.battKwh * landedMidBattKwh);
        const lcoeUsd = lcoeUsdPerKwh({
          capexMidUsd: cost.objectiveMid,
          battReplaceCostUsd: battReplCost,
          replacements: replacements25y,
          annualServedKwh: servedKwhPerYear,
        });
        const importedKwhPerYear = sizing.result.importedWh / 1000 / series.meta.years;
        const billAfterUsd = tariff ? importedKwhPerYear * tariff : null;
        const savingsUsd = billAfterUsd !== null && gridSpend ? Math.max(0, gridSpend - billAfterUsd) : null;

        return {
          id: target.id,
          label: target.label,
          solvable: true,
          minFraction: target.minFraction,
          pvKw: sizing.pvKw,
          battKwh: sizing.battKwh,
          costLo: cost.lo,
          costHi: cost.hi,
          cutPct: Math.round((1 - sizing.result.importedWh / (loadTotalKwh * 1000)) * 100),
          importedKwhPerYear: Math.round(importedKwhPerYear),
          clippedKwhPerYear: Math.round(sizing.result.curtailedWh / 1000 / series.meta.years),
          billAfterMonthlyUsd: billAfterUsd === null ? null : Math.round(billAfterUsd / 12),
          paybackYearsLo: savingsUsd ? paybackYears(cost.lo, savingsUsd) : null,
          paybackYearsHi: savingsUsd ? paybackYears(cost.hi, savingsUsd) : null,
          servedKwhPerYear: Math.round(servedKwhPerYear),
          replacements25y,
          lcoeUsdPerKwh: lcoeUsd === null ? null : +lcoeUsd.toFixed(4),
          cyclesPerYear: Math.round(cyclesPerYear),
          batteryLifeYears: cyclesPerYear > 0 ? +(chem.cyclesTo80 / cyclesPerYear).toFixed(1) : null,
        };
      });

      self.postMessage({
        type: "ok",
        payload: {
          mode: "gridtie",
          meta: series.meta,
          annualYieldPerKw: Math.round(annualYield),
          chemistry,
          chemLabel: chem.label,
          tariff: tariff ?? null,
          annualGridSpendUsd: gridSpend === null ? null : Math.round(gridSpend),
          pricing: {
            basisLabel: "ex-factory China through PowMr-class budget retail",
            source: "cell market indications → PowMr public catalog, Aug 2026",
            catalog: POWMR_CATALOG,
          },
          targets,
          assumptions: {
            derates: DERATES_DEFAULT,
            gammaPerC: GAMMA_PMAX,
            noctC: NOCT,
            etaInverter: ETA_INVERTER,
            dataYears: `${series.meta.startYear}–${series.meta.endYear} (${series.meta.years} yr)`,
            source: series.meta.source,
            cycleLifeTo80: { [chemistry]: chem.cyclesTo80 },
          capacityScale: +capScale.toFixed(3),
          meanTempC: Math.round(meanTempC),
          capacityNote: capScale < 0.995 ? `${chemistry.toUpperCase()} delivers about ${(capScale * 100).toFixed(0)}% of nameplate usable capacity at this site (discharge-rate and cold losses; annual mean ${Math.round(meanTempC)}°C).` : null,
            money: `Bill reduction is computed hour-by-hour across ${series.meta.startYear}–${series.meta.endYear} of NASA POWER weather: solar serves the load first, surplus charges the battery, and the grid covers whatever remains. The system never exports (surplus beyond storage is clipped). Payback compares component cost against the bill savings at your tariff; fixed connection fees are not counted.`,
          },
        },
      });
      return;
    }

    // Search objective sits mid-spread (landed DIY); the DISPLAYED range
    // always spans ex-factory China through PowMr-class budget retail.
    const landed = getScope("landed");
    const results = sizeAllTiers({
      e1kw, loadWh, tempsC, chemistry,
      years: series.meta.years,
      costPerWpv: (landed.pvPerW[0] + landed.pvPerW[1]) / 2,
      costPerKwhBatt: (landed.battPerKwhUsable[0] + landed.battPerKwhUsable[1]) / 2,
      battMax: 250,
      capacityScale: capScale,
    });

    const historyTiers = [];
    const tiers = results.map(({ tier, sizing }) => {
      if (!sizing) {
        return {
          id: tier.id, label: tier.label, solvable: false,
          pvKw: null, battKwh: null, costLo: null, costHi: null,
          unmetHoursPerYear: null, longestGapHours: null, cyclesPerYear: null,
          batteryLifeYears: null, minSocPct: null, servedKwhPerYear: null,
          replacements25y: null, lcoeUsdPerKwh: null, paybackYearsLo: null, paybackYearsHi: null,
        };
      }

      const cyclesPerYear = sizing.result.cyclesEquivalent / series.meta.years;
      const batteryLifeYears = cyclesPerYear > 0 ? chem.cyclesTo80 / cyclesPerYear : null;
      const cost = fullRange(sizing.pvKw, sizing.battKwh, chemistry);

      // Money story: payback against avoided grid bills, plus levelized
      // cost of the AC energy this system actually serves (landed-mid
      // capex, battery banks replaced as they wear out over 25 years).
      const servedKwhPerYear = sizing.result.servedWh / 1000 / series.meta.years;
      const replacements25y = batteryReplacements(cyclesPerYear, chem.cyclesTo80);
      const battReplCost = Math.round(
        sizing.battKwh * (landed.battPerKwhUsable[0] + landed.battPerKwhUsable[1]) / 2
      );
      const lcoeUsd = lcoeUsdPerKwh({
        capexMidUsd: cost.objectiveMid,
        battReplaceCostUsd: battReplCost,
        replacements: replacements25y,
        annualServedKwh: servedKwhPerYear,
      });

      // Full daily range: the band between each day's lowest and highest
      // charge. Top edge touches 100% on charging days for EVERY system —
      // that is the whole point of using percent.
      const traced = simulate({
        pvKw: sizing.pvKw, battKwhUsable: sizing.battKwh,
        e1kw, loadWh, chemistry, tempsC, capture: true, capacityScale: capScale,
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

      return {
        id: tier.id,
        label: tier.label,
        solvable: true,
        pvKw: sizing.pvKw,
        battKwh: sizing.battKwh,
        costLo: cost.lo,
        costHi: cost.hi,
        pvCostLo: Math.round(sizing.pvKw * 1000 * getScope("cells").pvPerW[0]),
        pvCostHi: Math.round(sizing.pvKw * 1000 * getScope("powmr").pvPerW[1]),
        battCostLo: cost.battCostLo,
        battCostHi: cost.battCostHi,
        battPerKwhLo: cost.battPerKwhLo,
        battPerKwhHi: cost.battPerKwhHi,
        unmetHoursPerYear: +(sizing.result.unmetHours / series.meta.years).toFixed(1),
        longestGapHours: sizing.result.longestGapHours,
        cyclesPerYear: Math.round(cyclesPerYear),
        batteryLifeYears: batteryLifeYears === null ? null : +batteryLifeYears.toFixed(1),
        minSocPct: +(sizing.result.minSoc * 100).toFixed(0),
        servedKwhPerYear: Math.round(servedKwhPerYear),
        replacements25y,
        lcoeUsdPerKwh: lcoeUsd === null ? null : +lcoeUsd.toFixed(4),
        paybackYearsLo: gridSpend ? paybackYears(cost.lo, gridSpend) : null,
        paybackYearsHi: gridSpend ? paybackYears(cost.hi, gridSpend) : null,
      };
    });

    self.postMessage({
      type: "ok",
      payload: {
        meta: series.meta,
        annualYieldPerKw: Math.round(annualYield),
        chemistry,
        chemLabel: chem.label,
        tariff: tariff ?? null,
        annualGridSpendUsd: gridSpend === null ? null : Math.round(gridSpend),
        pricing: {
          basisLabel: "ex-factory China through PowMr-class budget retail",
          source: "cell market indications → PowMr public catalog, Aug 2026",
          catalog: POWMR_CATALOG,
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
          capacityScale: +capScale.toFixed(3),
          meanTempC: Math.round(meanTempC),
          capacityNote: capScale < 0.995 ? `${chemistry.toUpperCase()} delivers about ${(capScale * 100).toFixed(0)}% of nameplate usable capacity at this site (discharge-rate and cold losses; annual mean ${Math.round(meanTempC)}°C).` : null,
          money: `Payback compares component cost against your current annual grid spend (tariff you entered). Levelized cost uses landed-mid capex, replaces battery banks as they wear out across a 25-year horizon, and assumes panels/inverter last the full 25 years. Generator fuel and grid fixed charges are not counted.`,
        },
      },
    });
  } catch (e) {
    self.postMessage({ type: "error", message: String(e && e.message || e) });
  }
};
