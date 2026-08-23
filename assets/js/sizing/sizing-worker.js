// Sizing web worker: keeps multi-second searches off the main thread.
// Message in:  { type: "run", latitude, longitude, dailyKwh,
//                chemistry: "auto" | "naion" | "lfp" | "agm",
//                tariff, exportRate, mode: "offgrid" | "gridtie" }
// Message out: { type: "ok", payload } | { type: "error", message }
import {
  buildE1kw, flatProfile, expandProfile, sizeAllTiers, simulate,
  sizeAllBillTargets, simulateOffset, dailyExtremes, CHEMISTRIES,
  DERATES_DEFAULT, GAMMA_PMAX, NOCT, ETA_INVERTER, capacityScaleFor,
} from "./engine.js?v=20260823k";
import { fetchHourlyCached } from "./nasa.js?v=20260823j";
import { fullRange, getScope, POWMR_CATALOG } from "./pricing.js?v=20260823j";
import {
  annualGridSpendUsd, paybackYears, batteryReplacements, lcoeUsdPerKwh,
  lifetimeCostUsd, exportValueUsd,
} from "./money.js?v=20260823k";

const AUTO_COMPARE_NOTE = {
  offgrid: "compared at the middle reliability tier (99% — generator as rare backup)",
  gridtie: "compared at the ~80% bill-cut target",
};

self.onmessage = async (ev) => {
  const msg = ev.data;
  if (msg?.type !== "run") return;
  try {
    const {
      latitude, longitude, dailyKwh, chemistry = "auto", years = 5,
      tariff = null, exportRate = null, mode = "offgrid",
    } = msg;

    const series = await fetchHourlyCached({ latitude, longitude, years });
    const hours = series.hours;
    const e1kw = buildE1kw(hours);
    const loadWh = expandProfile(flatProfile(dailyKwh), hours.length);
    const tempsC = Float64Array.from(hours, (h) => h.tAmb);

    const annualYield = [...e1kw].reduce((a, b) => a + b, 0) / 1000 / series.meta.years;
    const gridSpend = annualGridSpendUsd(dailyKwh, tariff);
    const landedScope = getScope("landed");
    const costPerWpvMid = (landedScope.pvPerW[0] + landedScope.pvPerW[1]) / 2;
    const landedMidBattKwh = (landedScope.battPerKwhUsable[0] + landedScope.battPerKwhUsable[1]) / 2;
    const meanTempC = tempsC.reduce((a, b) => a + b, 0) / tempsC.length;

    // Shared per-result money block: first-cost range plus the TRUE lifetime
    // picture (bank swaps + install labor each time, levelized energy cost).
    function moneyFor(chemId, sizing) {
      const chemObj = CHEMISTRIES[chemId] || CHEMISTRIES.lfp;
      const cyclesPerYear = sizing.result.cyclesEquivalent / series.meta.years;
      const replacements25y = batteryReplacements(cyclesPerYear, chemObj.cyclesTo80);
      const cost = fullRange(sizing.pvKw, sizing.battKwh, chemId);
      const life = lifetimeCostUsd({
        capexMidUsd: cost.objectiveMid,
        battKwhUsable: sizing.battKwh,
        battPriceMidPerKwh: landedMidBattKwh,
        replacements: replacements25y,
      });
      return {
        chemObj, cost,
        cyclesPerYear: Math.round(cyclesPerYear),
        batteryLifeYears: cyclesPerYear > 0 ? +(chemObj.cyclesTo80 / cyclesPerYear).toFixed(1) : null,
        replacements25y,
        swapsAndLaborUsd: life.swapsAndLabor,
        lifetimeCostMid: life.total,
        battNameplateKwh: +(sizing.battKwh / chemObj.usableDod).toFixed(1),
      };
    }

    function socBand(id, sim) {
      if (!sim.socSeries) return null;
      const ext = dailyExtremes(sim.socSeries);
      let minPct = 100, emptyDays = 0, fullDays = 0;
      const nDays = ext.min.length;
      for (let d = 0; d < nDays; d++) {
        const lo = ext.min[d] * 100;
        if (lo < minPct) minPct = lo;
        if (lo < 5) emptyDays++;
        if (ext.max[d] >= 0.995) fullDays++;
      }
      return {
        id,
        dailyMin: Array.from(ext.min, (v) => Math.round(v * 1000) / 10),
        dailyMax: Array.from(ext.max, (v) => Math.round(v * 1000) / 10),
        minPct: Math.max(0, Math.round(minPct)),
        emptyDays, fullDays, totalDays: nDays,
      };
    }

    const basePayload = () => ({
      meta: series.meta,
      annualYieldPerKw: Math.round(annualYield),
      chemistry,
      tariff: tariff ?? null,
      exportRate: exportRate ?? null,
      annualGridSpendUsd: gridSpend === null ? null : Math.round(gridSpend),
      pricing: {
        basisLabel: "ex-factory China through PowMr-class budget retail",
        source: "cell market indications → PowMr public catalog, Aug 2026",
        catalog: POWMR_CATALOG,
      },
      assumptions: {
        derates: DERATES_DEFAULT,
        gammaPerC: GAMMA_PMAX,
        noctC: NOCT,
        etaInverter: ETA_INVERTER,
        dataYears: `${series.meta.startYear}–${series.meta.endYear} (${series.meta.years} yr)`,
        source: series.meta.source,
        capacityScale: +capacityScaleFor(chemistry === "auto" ? "lfp" : chemistry, meanTempC).toFixed(3),
        meanTempC: Math.round(meanTempC),
      },
    });

    // ── GRID-TIE ────────────────────────────────────────────────────────────
    if (mode === "gridtie") {
      const historyTiers = [];

      // AUTO: one representative system (~80% bill cut) per chemistry.
      if (chemistry === "auto") {
        const auto = [];
        for (const chemId of ["naion", "lfp", "agm"]) {
          const capScale = capacityScaleFor(chemId, meanTempC);
          const results = sizeAllBillTargets({
            e1kw, loadWh, tempsC, chemistry: chemId,
            years: series.meta.years, costPerWpv: costPerWpvMid, costPerKwhBatt: landedMidBattKwh,
            pvMax: 45, battMax: 120, battStep: 1, capacityScale: capScale,
          });
          const hit = results.find((r) => r.target.id === "cut80");
          if (!hit || !hit.sizing) continue;
          const m = moneyFor(chemId, hit.sizing);
          const servedKwhPerYear =
            (hit.sizing.result.directWh + hit.sizing.result.battWhAc) / 1000 / series.meta.years;
          const importedKwhPerYear = hit.sizing.result.importedWh / 1000 / series.meta.years;
          const clippedKwhPerYear = hit.sizing.result.curtailedWh / 1000 / series.meta.years;
          const billAfterUsd = tariff ? importedKwhPerYear * tariff : null;
          const savingsUsd = billAfterUsd !== null && gridSpend ? Math.max(0, gridSpend - billAfterUsd) : null;
          const exportVal = exportValueUsd(clippedKwhPerYear, exportRate);
          const pbLo = savingsUsd ? paybackYears(m.cost.lo, savingsUsd + exportVal) : null;
          const pbHi = savingsUsd ? paybackYears(m.cost.hi, savingsUsd + exportVal) : null;
          auto.push({
            chemistry: chemId,
            chemLabel: m.chemObj.label,
            usableDod: m.chemObj.usableDod,
            solvable: true,
            pvKw: hit.sizing.pvKw,
            battKwh: hit.sizing.battKwh,
            battNameplateKwh: m.battNameplateKwh,
            costLo: m.cost.lo, costHi: m.cost.hi,
            cutPct: Math.round((1 - hit.sizing.result.importedWh / (dailyKwh * 365 * 1000)) * 100),
            billAfterMonthlyUsd: billAfterUsd === null ? null : Math.round(billAfterUsd / 12),
            paybackYearsLo: pbLo, paybackYearsHi: pbHi,
            exportValueAnnualUsd: Math.round(exportVal),
            clippedKwhPerYear: Math.round(clippedKwhPerYear),
            replacements25y: m.replacements25y,
            swapsAndLaborUsd: m.swapsAndLaborUsd,
            lifetimeCostMid: m.lifetimeCostMid,
            servedKwhPerYear: Math.round(servedKwhPerYear),
            lcoeUsdPerKwh: (() => {
              const l = lcoeUsdPerKwh({
                capexMidUsd: m.cost.objectiveMid,
                battReplaceCostUsd: Math.round(hit.sizing.battKwh * landedMidBattKwh),
                replacements: m.replacements25y,
                annualServedKwh: servedKwhPerYear,
              });
              return l === null ? null : +l.toFixed(4);
            })(),
          });
          const sim = simulateOffset({
            pvKw: hit.sizing.pvKw, battKwhUsable: hit.sizing.battKwh,
            e1kw, loadWh, chemistry: chemId, tempsC, capacityScale: capScale, capture: true,
          });
          const band = socBand(`auto-${chemId}`, sim);
          if (band) historyTiers.push(band);
        }
        const payload = basePayload();
        payload.mode = "gridtie";
        payload.auto = auto;
        payload.autoNote = AUTO_COMPARE_NOTE.gridtie;
        payload.targets = [];
        payload.history = {
          kind: "gridtie", startYear: series.meta.startYear, endYear: series.meta.endYear,
          days: Math.ceil(hours.length / 24), tiers: historyTiers,
        };
        payload.assumptions.cycleLifeTo80 = Object.fromEntries(["naion", "lfp", "agm"].map((c) => [c, CHEMISTRIES[c].cyclesTo80]));
        payload.assumptions.money =
          `Auto mode sizes each chemistry to deliver the same ~80% bill cut within its depth-of-discharge window ` +
          `(AGM banks are ~2× nameplate; lithium/sodium ~1.1×). Lifetime cost adds every bank swap PLUS install labor each time over 25 years. ` +
          `Payback compares first cost against bill savings${exportRate ? " plus feed-in credit on clipped surplus" : ""}; fixed connection fees not counted.`;
        self.postMessage({ type: "ok", payload });
        return;
      }

      // SPECIFIC chemistry: three bill-cut targets with full money + chart.
      const chem = CHEMISTRIES[chemistry] || CHEMISTRIES.lfp;
      const capScale = capacityScaleFor(chemistry, meanTempC);
      const results = sizeAllBillTargets({
        e1kw, loadWh, tempsC, chemistry,
        years: series.meta.years, costPerWpv: costPerWpvMid, costPerKwhBatt: landedMidBattKwh,
        pvMax: 45, battMax: 120, battStep: 1, capacityScale: capScale,
      });
      const loadTotalWh = dailyKwh * 365 * 1000;
      const targets = results.map(({ target, sizing }) => {
        if (!sizing) return { id: target.id, label: target.label, solvable: false };
        const m = moneyFor(chemistry, sizing);
        const servedKwhPerYear = (sizing.result.directWh + sizing.result.battWhAc) / 1000 / series.meta.years;
        const importedKwhPerYear = sizing.result.importedWh / 1000 / series.meta.years;
        const clippedKwhPerYear = sizing.result.curtailedWh / 1000 / series.meta.years;
        const billAfterUsd = tariff ? importedKwhPerYear * tariff : null;
        const savingsUsd = billAfterUsd !== null && gridSpend ? Math.max(0, gridSpend - billAfterUsd) : null;
        const exportVal = exportValueUsd(clippedKwhPerYear, exportRate);
        const lcoe = lcoeUsdPerKwh({
          capexMidUsd: m.cost.objectiveMid,
          battReplaceCostUsd: Math.round(sizing.battKwh * landedMidBattKwh),
          replacements: m.replacements25y,
          annualServedKwh: servedKwhPerYear,
        });
        const sim = simulateOffset({
          pvKw: sizing.pvKw, battKwhUsable: sizing.battKwh,
          e1kw, loadWh, chemistry, tempsC, capacityScale: capScale, capture: true,
        });
        const band = socBand(target.id, sim);
        if (band) historyTiers.push(band);
        return {
          id: target.id, label: target.label, solvable: true,
          minFraction: target.minFraction,
          pvKw: sizing.pvKw, battKwh: sizing.battKwh,
          battNameplateKwh: m.battNameplateKwh,
          usableDod: chem.usableDod,
          costLo: m.cost.lo, costHi: m.cost.hi,
          cutPct: Math.round((1 - sizing.result.importedWh / loadTotalWh) * 100),
          importedKwhPerYear: Math.round(importedKwhPerYear),
          clippedKwhPerYear: Math.round(clippedKwhPerYear),
          exportValueAnnualUsd: Math.round(exportVal),
          billAfterMonthlyUsd: billAfterUsd === null ? null : Math.round(billAfterUsd / 12),
          paybackYearsLo: savingsUsd ? paybackYears(m.cost.lo, savingsUsd + exportVal) : null,
          paybackYearsHi: savingsUsd ? paybackYears(m.cost.hi, savingsUsd + exportVal) : null,
          replacements25y: m.replacements25y,
          swapsAndLaborUsd: m.swapsAndLaborUsd,
          lifetimeCostMid: m.lifetimeCostMid,
          servedKwhPerYear: Math.round(servedKwhPerYear),
          cyclesPerYear: m.cyclesPerYear,
          batteryLifeYears: m.batteryLifeYears,
          lcoeUsdPerKwh: lcoe === null ? null : +lcoe.toFixed(4),
        };
      });
      const payload = basePayload();
      payload.mode = "gridtie";
      payload.chemLabel = chem.label;
      payload.targets = targets;
      payload.auto = null;
      payload.history = {
        kind: "gridtie", startYear: series.meta.startYear, endYear: series.meta.endYear,
        days: Math.ceil(hours.length / 24), tiers: historyTiers,
      };
      payload.assumptions.cycleLifeTo80 = { [chemistry]: chem.cyclesTo80 };
      payload.assumptions.money =
        `Bill reduction simulated hour-by-hour across five years of weather: solar serves the load first, surplus charges the battery, the grid covers the rest, nothing is exported unless you enter a feed-in credit (then clipped surplus is valued at that rate). Lifetime cost includes bank swaps plus install labor each time. Fixed connection fees not counted.`;
      self.postMessage({ type: "ok", payload });
      return;
    }

    // ── OFF-GRID ────────────────────────────────────────────────────────────
    const historyTiers = [];

    // AUTO: one representative system per chemistry (middle tier).
    if (chemistry === "auto") {
      const auto = [];
      for (const chemId of ["naion", "lfp", "agm"]) {
        const capScale = capacityScaleFor(chemId, meanTempC);
        const allTiers = sizeAllTiers({
          e1kw, loadWh, tempsC, chemistry: chemId,
          years: series.meta.years, costPerWpv: costPerWpvMid, costPerKwhBatt: landedMidBattKwh,
          battMax: 250, capacityScale: capScale,
        });
        const midTier = allTiers.find((t) => t.tier.id === "tier99");
        if (!midTier || !midTier.sizing) continue;
        const sizing = midTier.sizing;
        const m = moneyFor(chemId, sizing);
        const servedKwhPerYear = sizing.result.servedWh / 1000 / series.meta.years;
        const lcoe = lcoeUsdPerKwh({
          capexMidUsd: m.cost.objectiveMid,
          battReplaceCostUsd: Math.round(sizing.battKwh * landedMidBattKwh),
          replacements: m.replacements25y,
          annualServedKwh: servedKwhPerYear,
        });
        auto.push({
          chemistry: chemId,
          chemLabel: m.chemObj.label,
          usableDod: m.chemObj.usableDod,
          solvable: true,
          pvKw: sizing.pvKw,
          battKwh: sizing.battKwh,
          battNameplateKwh: m.battNameplateKwh,
          costLo: m.cost.lo, costHi: m.cost.hi,
          unmetHoursPerYear: +(sizing.result.unmetHours / series.meta.years).toFixed(1),
          longestGapHours: sizing.result.longestGapHours,
          replacements25y: m.replacements25y,
          swapsAndLaborUsd: m.swapsAndLaborUsd,
          lifetimeCostMid: m.lifetimeCostMid,
          servedKwhPerYear: Math.round(servedKwhPerYear),
          batteryLifeYears: m.batteryLifeYears,
          cyclesPerYear: m.cyclesPerYear,
          lcoeUsdPerKwh: lcoe === null ? null : +lcoe.toFixed(4),
          paybackYearsLo: gridSpend ? paybackYears(m.cost.lo, gridSpend) : null,
          paybackYearsHi: gridSpend ? paybackYears(m.cost.hi, gridSpend) : null,
        });
        const sim = simulate({
          pvKw: sizing.pvKw, battKwhUsable: sizing.battKwh,
          e1kw, loadWh, chemistry: chemId, tempsC, capture: true, capacityScale: capScale,
        });
        const band = socBand(`auto-${chemId}`, sim);
        if (band) historyTiers.push(band);
      }
      const payload = basePayload();
      payload.mode = "offgrid";
      payload.auto = auto;
      payload.autoNote = AUTO_COMPARE_NOTE.offgrid;
      payload.tiers = [];
      payload.history = {
        kind: "offgrid", startYear: series.meta.startYear, endYear: series.meta.endYear,
        days: Math.ceil(hours.length / 24), tiers: historyTiers,
      };
      payload.assumptions.cycleLifeTo80 = Object.fromEntries(["naion", "lfp", "agm"].map((c) => [c, CHEMISTRIES[c].cyclesTo80]));
      payload.assumptions.money =
        `Auto mode sizes each chemistry for the same job — lights stay on with a generator as rare backup — inside its depth-of-discharge window (AGM keeps a 50% reserve; lithium/sodium use ~90%). Lifetime cost adds every bank swap PLUS install labor each time over 25 years. That is why lead-acid's sticker price misleads.`;
      self.postMessage({ type: "ok", payload });
      return;
    }

    // SPECIFIC chemistry: three reliability tiers.
    const chem = CHEMISTRIES[chemistry] || CHEMISTRIES.lfp;
    const capScale = capacityScaleFor(chemistry, meanTempC);
    const results = sizeAllTiers({
      e1kw, loadWh, tempsC, chemistry,
      years: series.meta.years, costPerWpv: costPerWpvMid, costPerKwhBatt: landedMidBattKwh,
      battMax: 250, capacityScale: capScale,
    });

    const tiers = results.map(({ tier, sizing }) => {
      if (!sizing) {
        return {
          id: tier.id, label: tier.label, solvable: false,
          pvKw: null, battKwh: null, battNameplateKwh: null, usableDod: chem.usableDod,
          costLo: null, costHi: null, unmetHoursPerYear: null, longestGapHours: null,
          cyclesPerYear: null, batteryLifeYears: null, minSocPct: null,
          servedKwhPerYear: null, replacements25y: null, swapsAndLaborUsd: null,
          lifetimeCostMid: null, lcoeUsdPerKwh: null, paybackYearsLo: null, paybackYearsHi: null,
        };
      }
      const m = moneyFor(chemistry, sizing);
      const servedKwhPerYear = sizing.result.servedWh / 1000 / series.meta.years;
      const lcoe = lcoeUsdPerKwh({
        capexMidUsd: m.cost.objectiveMid,
        battReplaceCostUsd: Math.round(sizing.battKwh * landedMidBattKwh),
        replacements: m.replacements25y,
        annualServedKwh: servedKwhPerYear,
      });
      const sim = simulate({
        pvKw: sizing.pvKw, battKwhUsable: sizing.battKwh,
        e1kw, loadWh, chemistry, tempsC, capture: true, capacityScale: capScale,
      });
      const band = socBand(tier.id, sim);
      if (band) historyTiers.push(band);
      return {
        id: tier.id, label: tier.label, solvable: true,
        pvKw: sizing.pvKw, battKwh: sizing.battKwh,
        battNameplateKwh: m.battNameplateKwh,
        usableDod: chem.usableDod,
        costLo: m.cost.lo, costHi: m.cost.hi,
        unmetHoursPerYear: +(sizing.result.unmetHours / series.meta.years).toFixed(1),
        longestGapHours: sizing.result.longestGapHours,
        cyclesPerYear: m.cyclesPerYear,
        batteryLifeYears: m.batteryLifeYears,
        minSocPct: +(sizing.result.minSoc * 100).toFixed(0),
        servedKwhPerYear: Math.round(servedKwhPerYear),
        replacements25y: m.replacements25y,
        swapsAndLaborUsd: m.swapsAndLaborUsd,
        lifetimeCostMid: m.lifetimeCostMid,
        lcoeUsdPerKwh: lcoe === null ? null : +lcoe.toFixed(4),
        paybackYearsLo: gridSpend ? paybackYears(m.cost.lo, gridSpend) : null,
        paybackYearsHi: gridSpend ? paybackYears(m.cost.hi, gridSpend) : null,
      };
    });

    const payload = basePayload();
    payload.mode = "offgrid";
    payload.chemLabel = chem.label;
    payload.tiers = tiers;
    payload.auto = null;
    payload.history = {
      kind: "offgrid", startYear: series.meta.startYear, endYear: series.meta.endYear,
      days: Math.ceil(hours.length / 24), tiers: historyTiers,
    };
    payload.assumptions.cycleLifeTo80 = { [chemistry]: chem.cyclesTo80 };
    payload.assumptions.money =
      `Payback compares component cost against your current annual grid spend (tariff you entered). Levelized cost uses landed-mid capex, replaces battery banks as they wear out across a 25-year horizon, and assumes panels/inverter last the full 25 years. Lifetime figures include install labor on the first bank and every swap. Generator fuel and grid fixed charges are not counted.`;
    self.postMessage({ type: "ok", payload });
  } catch (e) {
    self.postMessage({ type: "error", message: String(e && e.message || e) });
  }
};
