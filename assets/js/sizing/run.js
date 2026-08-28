// The single source of truth for sizing runs. Both the web worker wrapper
// and the Node test suite call runSizing() directly, so the UI contract —
// every field the renderers read — is defined here and only here.
//
// msg: { latitude, longitude, dailyKwh, chemistry: "auto"|"naion"|"lfp"|"agm",
//        years, tariff, exportRate, mode: "offgrid"|"gridtie" }
// deps: { fetchWeather } injectable for offline tests.
import {
  buildE1kw, flatProfile, expandProfile, sizeAllTiers, simulate,
  sizeAllBillTargets, simulateOffset, dailyExtremes, CHEMISTRIES,
  RELIABILITY_TIERS, BILL_TARGETS,
  DERATES_DEFAULT, GAMMA_PMAX, NOCT, ETA_INVERTER, capacityScaleFor,
} from "./engine.js?v=20260828a";
import { fetchHourlyCached, synthesizeFromProfile } from "./nasa.js?v=20260828a";
import { fullRange, getScope, POWMR_CATALOG, estimateTariff } from "./pricing.js?v=20260828a";
import {
  annualGridSpendUsd, paybackYears, batteryReplacements, lcoeUsdPerKwh,
  lifetimeCostUsd, exportValueUsd, trueBreakEvenYear,
  INSTALL_LABOR_PER_KWH_USABLE,
} from "./money.js?v=20260828a";

const TIER_BASIS = {
  tier100: "100% independence — never needs a generator",
  tier99: "99% reliability — generator only as a rare backup",
  tier95: "95% reliability — generator runs now and then",
};
const TARGET_BASIS = {
  cut60: "a ~60% grid-bill cut",
  cut80: "an ~80% grid-bill cut",
  cut95: "a ~95% grid-bill cut",
};

const VALID_AUTO_TIERS = new Set(["tier100", "tier99", "tier95"]);
const VALID_AUTO_TARGETS = new Set(["cut60", "cut80", "cut95"]);

// UI-contract version: bump whenever payload fields change shape. The
// renderer compares this to its own constant and warns on mismatch instead
// of rendering garbage from a stale cached module.
export const PAYLOAD_CONTRACT = 6;

const AUTO_CARD_NOTES = {
  naion: "Runs on standard LFP voltage settings (the common case): the ~40 V low cutoff protects it from deep discharge, so it gives up a little capacity but lasts longer than its deep-cycle rating.",
  lfp: "The benchmark: uses most of its nameplate every day and still outlives everything else.",
  agm: "Half the bank is untouchable reserve (50% DoD rule), and without active balancing — typical for DIY series strings — the whole string wears at the weakest block's pace.",
};

async function fetchWeatherDefault(opts) {
  return fetchHourlyCached(opts);
}

// Offline fallback: bundled typical-year profile nearest to the request.
async function fetchWeatherWithFallback(opts) {
  try {
    return await fetchWeatherDefault(opts);
  } catch (netErr) {
    const { OFFLINE_PROFILES, PROFILE_YEAR } = await import("./profiles.js");
    let best = null, bestD = Infinity;
    for (const p of OFFLINE_PROFILES) {
      const d = (p.lat - opts.latitude) ** 2 + ((p.lon - opts.longitude) * Math.cos(opts.latitude * Math.PI / 180)) ** 2;
      if (d < bestD) { bestD = d; best = p; }
    }
    if (!best) throw netErr;
    return {
      hours: synthesizeFromProfile(best),
      meta: {
        latitude: opts.latitude, longitude: opts.longitude,
        startYear: PROFILE_YEAR, endYear: PROFILE_YEAR, years: 1,
        source: `bundled typical-year weather for ${best.name} (OFFLINE MODE)`,
        offline: true,
        offlineCity: best.name,
        retrievedAt: new Date().toISOString(),
        timeStandard: "LST",
        parameters: ["ALLSKY_SFC_SW_DWN", "T2M"],
      },
    };
  }
}

export async function runSizing(msg, deps = {}) {
  const {
    latitude, longitude, dailyKwh, chemistry = "auto", years = 5,
    tariff = null, exportRate = null, mode = "offgrid",
    autoTier = "tier99", autoTargetId = "cut80",
  } = msg;
  const repTierId = VALID_AUTO_TIERS.has(autoTier) ? autoTier : "tier99";
  const repTargetId = VALID_AUTO_TARGETS.has(autoTargetId) ? autoTargetId : "cut80";

  const series = await (deps.fetchWeather || fetchWeatherWithFallback)({ latitude, longitude, years });
  const hours = series.hours;
  const e1kw = buildE1kw(hours);
  const loadWh = expandProfile(flatProfile(dailyKwh), hours.length);
  const tempsC = Float64Array.from(hours, (h) => h.tAmb);

  // Highest AC demand hour of the load profile — the number the hardware
  // list (inverter class, DC protection) is built around.
  let peakLoadW = 0;
  for (let i = 0; i < loadWh.length; i++) if (loadWh[i] > peakLoadW) peakLoadW = loadWh[i];

  const annualYield = [...e1kw].reduce((a, b) => a + b, 0) / 1000 / series.meta.years;
  const gridSpend = annualGridSpendUsd(dailyKwh, tariff);
  const landedScope = getScope("landed");
  const meanTempC = tempsC.reduce((a, b) => a + b, 0) / tempsC.length;

  // Regional cost factors: install labor & landed freight/duty
  const region = estimateTariff(latitude, longitude);
  const laborF = region.laborF ?? 1;
  const landedF = region.landedF ?? 1.1;
  const laborPerKwh = INSTALL_LABOR_PER_KWH_USABLE.map((v) => v * laborF);
  // Scale the landed-mid cost inputs for the sizer & money math
  const costPerWpvMid = (landedScope.pvPerW[0] + landedScope.pvPerW[1]) / 2 * landedF;
  const landedMidBattKwh = (landedScope.battPerKwhUsable[0] + landedScope.battPerKwhUsable[1]) / 2 * landedF;
  const costPerKwInvMid = (landedScope.invPerKw[0] + landedScope.invPerKw[1]) / 2 * landedF;

  // Daily solar harvest per kW of array (kWh/day) — feeds the chart's sun
  // strip so the visual shows what drives the battery's recharge rhythm.
  const dayCount = Math.floor(hours.length / 24);
  const pvDaily = new Array(dayCount);
  for (let d = 0; d < dayCount; d++) {
    let s = 0;
    for (let h = d * 24; h < (d + 1) * 24; h++) s += e1kw[h];
    pvDaily[d] = Math.round((s / 1000) * 100) / 100;
  }

  function moneyFor(chemId, sizing) {
    const chemObj = CHEMISTRIES[chemId] || CHEMISTRIES.lfp;
    const cyclesPerYear = sizing.result.cyclesEquivalent / series.meta.years;
    const replacementsHorizon = batteryReplacements(cyclesPerYear, chemObj.cyclesTo80);
    const cost = fullRange(sizing.pvKw, sizing.battKwh, chemId, landedF);
    const life = lifetimeCostUsd({
      capexMidUsd: cost.objectiveMid,
      battKwhUsable: sizing.battKwh,
      battPriceMidPerKwh: landedMidBattKwh,
      replacements: replacementsHorizon,
      laborPerKwh,
    });
    return {
      chemObj, cost,
      cyclesPerYear: Math.round(cyclesPerYear),
      batteryLifeYears: cyclesPerYear > 0 ? +(chemObj.cyclesTo80 / cyclesPerYear).toFixed(1) : null,
      replacementsHorizon,
      swapsAndLaborUsd: life.swapsAndLabor,
      lifetimeCostMid: life.total,
      battNameplateKwh: +(sizing.battKwh / chemObj.usableDod).toFixed(1),
    };
  }

  function socBand(id, sim, chemId) {
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
    const floor = chemId === "agm" ? 50 : 20;
    const toPct = (v) => Math.round((floor + v * (100 - floor)) * 10) / 10;
    return {
      id,
      dailyMin: Array.from(ext.min, toPct),
      dailyMax: Array.from(ext.max, toPct),
      minPct: Math.max(0, Math.round(minPct)),
      emptyDays, fullDays, totalDays: nDays,
    };
  }

  function nameplateBands(sim, effectiveCapWh, nameplateWh, chemId) {
    if (!sim.socSeries || !(effectiveCapWh > 0) || !(nameplateWh > 0)) return null;
    const ext = dailyExtremes(sim.socSeries);
    const floor = chemId === "agm" ? 50 : 20;
    const toPct = (v) => Math.round((floor + v * (100 - floor)) * 10) / 10;
    return { min: Array.from(ext.min, toPct), max: Array.from(ext.max, toPct) };
  }

  // Honest payback: the year cumulative avoided bills overtake cumulative
  // TRUE cost (every swap counted). Null = never catches up inside horizon.
  function breakEvenFor(m, annualSavingsUsd) {
    if (!(annualSavingsUsd > 0)) return null;
    return trueBreakEvenYear({
      capexMidUsd: m.cost.objectiveMid,
      annualSavingsUsd,
      swapsAndLaborTotalUsd: m.swapsAndLaborUsd,
      replacements: m.replacementsHorizon,
      batteryLifeYears: m.batteryLifeYears,
    });
  }

  // The system the hardware list (BOM panel) is built around.
  function focusFor(chemId, sizing) {
    const chemObj = CHEMISTRIES[chemId] || CHEMISTRIES.lfp;
    return {
      chemistry: chemId,
      chemLabel: chemObj.label,
      pvKw: sizing.pvKw,
      battKwh: sizing.battKwh,
      battNameplateKwh: +(sizing.battKwh / chemObj.usableDod).toFixed(1),
      usableDod: chemObj.usableDod,
      peakLoadW: Math.round(peakLoadW),
      meanTempC: Math.round(meanTempC),
    };
  }

  /**
   * One cell of the all-options matrix (chemistry × tier or × bill-cut
   * target). Same money math as the headline cards, minus SOC capture —
   * the search already computed every one of these systems; recording them
   * costs nothing extra.
   */
  function matrixCell(chemId, sizing, kind) {
    if (!sizing) return { solvable: false };
    const m = moneyFor(chemId, sizing);
    const yrs = series.meta.years;
    const servedKwhPerYear =
      (kind === "offgrid" ? sizing.result.servedWh : sizing.result.directWh + sizing.result.battWhAc) / 1000 / yrs;
    const lcoe = lcoeUsdPerKwh({
      capexMidUsd: m.cost.objectiveMid,
      battReplaceCostUsd: Math.round(sizing.battKwh * landedMidBattKwh),
      replacements: m.replacementsHorizon,
      annualServedKwh: servedKwhPerYear,
    });
    const cell = {
      solvable: true,
      pvKw: sizing.pvKw,
      battKwh: sizing.battKwh,
      costLo: m.cost.lo,
      costHi: m.cost.hi,
      replacementsHorizon: m.replacementsHorizon,
      swapsAndLaborUsd: m.swapsAndLaborUsd,
      lifetimeCostMid: m.lifetimeCostMid,
      lcoeUsdPerKwh: lcoe === null ? null : +lcoe.toFixed(4),
      paybackYearsLo: null,
      paybackYearsHi: null,
      trueBreakEvenYear: null,
    };
    let savings = null;
    if (kind === "offgrid") {
      savings = gridSpend;
      cell.unmetHoursPerYear = +(sizing.result.unmetHours / yrs).toFixed(1);
    } else {
      const importedKwhPerYear = sizing.result.importedWh / 1000 / yrs;
      const clippedKwhPerYear = sizing.result.curtailedWh / 1000 / yrs;
      const billAfterUsd = tariff ? importedKwhPerYear * tariff : null;
      savings = billAfterUsd !== null && gridSpend ? Math.max(0, gridSpend - billAfterUsd) : null;
      if (savings) savings += exportValueUsd(clippedKwhPerYear, exportRate);
      cell.cutPct = Math.round((1 - sizing.result.importedWh / (dailyKwh * 365 * 1000)) * 100);
    }
    if (savings) {
      cell.paybackYearsLo = paybackYears(m.cost.lo, savings);
      cell.paybackYearsHi = paybackYears(m.cost.hi, savings);
      cell.trueBreakEvenYear = breakEvenFor(m, savings);
    }
    return cell;
  }

  /** Lowest true-20-year-cost solvable entry — the "Best pick". */
  function bestOf(entries) {
    const solvable = entries.filter((a) => a.solvable && Number.isFinite(a.lifetimeCostMid));
    if (!solvable.length) return null;
    return solvable.reduce((a, b) => (a.lifetimeCostMid <= b.lifetimeCostMid ? a : b));
  }

  /** Plain-language verdict for why the winning chemistry won. */
  function bestPickReason(winner, allEntries, meanT) {
    if (!winner) return null;
    const others = allEntries.filter((a) => a.solvable && a !== winner && Number.isFinite(a.lifetimeCostMid));
    const runnerUp = others.length ? others.reduce((a, b) => (a.lifetimeCostMid <= b.lifetimeCostMid ? a : b)) : null;
    const gapPct =
      runnerUp && runnerUp.lifetimeCostMid > 0
        ? Math.round(((runnerUp.lifetimeCostMid - winner.lifetimeCostMid) / runnerUp.lifetimeCostMid) * 1000) / 10
        : null;
    const ahead = gapPct !== null ? ` — about ${gapPct}% ahead of ${runnerUp.chemLabel}` : "";
    let why;
    if (winner.chemistry === "lfp") {
      why = `${winner.chemLabel} delivered the lowest true 20-year cost at your site and target${ahead}. It uses most of its nameplate every day and its cycle life means no bank swaps inside the horizon.`;
    } else if (winner.chemistry === "naion") {
      why =
        meanT < 12
          ? `${winner.chemLabel} won here${ahead}. At this site's ${meanT}°C mean it charges in cold weather where standard LFP must sit idle below freezing, and on common LFP voltage settings it wears slowly.`
          : `${winner.chemLabel} came out ahead${ahead} — gentler discharge wear on LFP voltage settings outweighed its small capacity give-back.`;
    } else {
      why = `At this load and target, ${winner.chemLabel} wins on first cost${ahead} — but expect ~${winner.replacementsHorizon} bank swaps over 20 years, already counted in every figure above.`;
    }
    return `${why} The ranking shifts with climate, tariffs, and how much work you do yourself — check the other options before deciding.`;
  }

  const basePayload = () => ({
    contract: PAYLOAD_CONTRACT,
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
      dataYears: `${series.meta.startYear}–${series.meta.endYear}`,
      source: series.meta.source,
      offline: !!series.meta.offline,
      capacityScale: +capacityScaleFor(chemistry === "auto" ? "lfp" : chemistry, meanTempC).toFixed(3),
      meanTempC: Math.round(meanTempC),
      capacityNote: (() => {
        const capChem = chemistry === "auto" ? "lfp" : chemistry;
        const scale = capacityScaleFor(capChem, meanTempC);
        const pct = Math.round(scale * 100);
        const tC = Math.round(meanTempC);
        if (capChem === "agm" && tC <= 10) {
          return `Cold site: at a mean ${tC}°C, lead-acid (AGM) is derated to about ${pct}% of nameplate capacity; lithium and sodium are unaffected by cold in this model (they charge more slowly instead).`;
        }
        if (scale < 1) {
          const name = capChem === "naion" ? "sodium-ion" : capChem.toUpperCase();
          return `At this site's mean ${tC}°C, ${name} delivers about ${pct}% of nameplate usable capacity (rate/cold scaling).`;
        }
        return `Capacity model assumes full nameplate usable capacity at this site's mean ${tC}°C.`;
      })(),
    },
  });

  // ── GRID-TIE ──────────────────────────────────────────────────────────────
  if (mode === "gridtie") {
    const historyTiers = [];

    if (chemistry === "auto") {
      const auto = [];
      const matrixCells = {};
      for (const chemId of ["naion", "lfp", "agm"]) {
        const capScale = capacityScaleFor(chemId, meanTempC);
        const results = sizeAllBillTargets({
          e1kw, loadWh, tempsC, chemistry: chemId,
          years: series.meta.years, costPerWpv: costPerWpvMid, costPerKwhBatt: landedMidBattKwh, costPerKwInv: costPerKwInvMid,
          pvMax: 45, battMax: 120, battStep: 1, capacityScale: capScale, laborPerKwh,
        });
        for (const { target, sizing } of results) {
          matrixCells[chemId + ":" + target.id] = matrixCell(chemId, sizing, "gridtie");
        }
        const hit = results.find((r) => r.target.id === repTargetId);
        if (!hit || !hit.sizing) continue;
        const m = moneyFor(chemId, hit.sizing);
        const servedKwhPerYear = (hit.sizing.result.directWh + hit.sizing.result.battWhAc) / 1000 / series.meta.years;
        const importedKwhPerYear = hit.sizing.result.importedWh / 1000 / series.meta.years;
        const clippedKwhPerYear = hit.sizing.result.curtailedWh / 1000 / series.meta.years;
        const billAfterUsd = tariff ? importedKwhPerYear * tariff : null;
        const savingsUsd = billAfterUsd !== null && gridSpend ? Math.max(0, gridSpend - billAfterUsd) : null;
        const exportVal = exportValueUsd(clippedKwhPerYear, exportRate);
        const entry = {
          chemistry: chemId,
          cardNote: AUTO_CARD_NOTES[chemId] ?? null,
          chemLabel: m.chemObj.label,
          usableDod: m.chemObj.usableDod,
          solvable: true,
          pvKw: hit.sizing.pvKw,
          battKwh: hit.sizing.battKwh,
          battNameplateKwh: m.battNameplateKwh,
          costLo: m.cost.lo, costHi: m.cost.hi,
          cutPct: Math.round((1 - hit.sizing.result.importedWh / (dailyKwh * 365 * 1000)) * 100),
          billAfterMonthlyUsd: billAfterUsd === null ? null : Math.round(billAfterUsd / 12),
          paybackYearsLo: savingsUsd ? paybackYears(m.cost.lo, savingsUsd + exportVal) : null,
          paybackYearsHi: savingsUsd ? paybackYears(m.cost.hi, savingsUsd + exportVal) : null,
          trueBreakEvenYear: breakEvenFor(m, savingsUsd),
          exportValueAnnualUsd: Math.round(exportVal),
          clippedKwhPerYear: Math.round(clippedKwhPerYear),
          replacementsHorizon: m.replacementsHorizon,
          swapsAndLaborUsd: m.swapsAndLaborUsd,
          lifetimeCostMid: m.lifetimeCostMid,
          servedKwhPerYear: Math.round(servedKwhPerYear),
          lcoeUsdPerKwh: (() => {
            const l = lcoeUsdPerKwh({
              capexMidUsd: m.cost.objectiveMid,
              battReplaceCostUsd: Math.round(hit.sizing.battKwh * landedMidBattKwh),
              replacements: m.replacementsHorizon,
              annualServedKwh: servedKwhPerYear,
            });
            return l === null ? null : +l.toFixed(4);
          })(),
        };
        const sim = simulateOffset({
          pvKw: hit.sizing.pvKw, battKwhUsable: hit.sizing.battKwh,
          e1kw, loadWh, chemistry: chemId, tempsC, capacityScale: capScale, capture: true,
        });
        entry.socNameplatePct = nameplateBands(sim, hit.sizing.battKwh * 1000 * capScale, entry.battNameplateKwh * 1000, chemId);
        auto.push(entry);
      }
      const payload = basePayload();
      payload.mode = "gridtie";
      payload.auto = auto;
        payload.autoNote = `All three chemistries sized for ${TARGET_BASIS[repTargetId]}`;
      payload.targets = [];
      const gtWinner = bestOf(auto);
      payload.best = gtWinner;
      payload.bestReason = bestPickReason(gtWinner, auto, meanTempC);
      payload.focus = gtWinner ? focusFor(gtWinner.chemistry, gtWinner) : null;
      payload.matrix = {
        kind: "gridtie",
        cols: BILL_TARGETS.map((t) => ({ id: t.id, label: t.label })),
        rows: ["naion", "lfp", "agm"].map((id) => ({ id, label: CHEMISTRIES[id].label })),
        cells: matrixCells,
      };
      payload.history = { kind: "auto", startYear: series.meta.startYear, endYear: series.meta.endYear, days: Math.ceil(hours.length / 24), pvDaily, tiers: [] };
      payload.assumptions.cycleLifeTo80 = Object.fromEntries(["naion", "lfp", "agm"].map((c) => [c, CHEMISTRIES[c].cyclesTo80]));
      payload.assumptions.money =
        `Auto mode sizes each chemistry to deliver the same ~80% bill cut within its depth-of-discharge window (AGM banks are ~2× nameplate; lithium/sodium ~1.1×; sodium modeled on LFP voltage settings — slightly less capacity, gentler discharge). Lifetime cost adds every bank swap PLUS install labor each time over 20 years; lead-acid is modeled WITHOUT active balancing (typical DIY strings). Payback compares first cost against bill savings${exportRate ? " plus feed-in credit on clipped surplus" : ""}; fixed connection fees not counted.`;
      return payload;
    }

    const chem = CHEMISTRIES[chemistry] || CHEMISTRIES.lfp;
    const capScale = capacityScaleFor(chemistry, meanTempC);
    const results = sizeAllBillTargets({
      e1kw, loadWh, tempsC, chemistry,
      years: series.meta.years, costPerWpv: costPerWpvMid, costPerKwhBatt: landedMidBattKwh, costPerKwInv: costPerKwInvMid,
      pvMax: 45, battMax: 120, battStep: 1, capacityScale: capScale, laborPerKwh,
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
        replacements: m.replacementsHorizon,
        annualServedKwh: servedKwhPerYear,
      });
      const sim = simulateOffset({
        pvKw: sizing.pvKw, battKwhUsable: sizing.battKwh,
        e1kw, loadWh, chemistry, tempsC, capacityScale: capScale, capture: true,
      });
      const band = socBand(target.id, sim, chemistry);
      if (band) historyTiers.push(band);
      return {
        id: target.id, label: target.label, solvable: true,
        minFraction: target.minFraction,
        pvKw: sizing.pvKw, battKwh: sizing.battKwh,
        battNameplateKwh: m.battNameplateKwh,
        usableDod: chem.usableDod,
        costLo: m.cost.lo, costHi: m.cost.hi,
        pvCostLo: m.cost.pvCostLo, pvCostHi: m.cost.pvCostHi,
        battCostLo: m.cost.battCostLo, battCostHi: m.cost.battCostHi,
        battPerKwhLo: m.cost.battPerKwhLo, battPerKwhHi: m.cost.battPerKwhHi,
        cutPct: Math.round((1 - sizing.result.importedWh / loadTotalWh) * 100),
        importedKwhPerYear: Math.round(importedKwhPerYear),
        clippedKwhPerYear: Math.round(clippedKwhPerYear),
        exportValueAnnualUsd: Math.round(exportVal),
        billAfterMonthlyUsd: billAfterUsd === null ? null : Math.round(billAfterUsd / 12),
        paybackYearsLo: savingsUsd ? paybackYears(m.cost.lo, savingsUsd + exportVal) : null,
        paybackYearsHi: savingsUsd ? paybackYears(m.cost.hi, savingsUsd + exportVal) : null,
        trueBreakEvenYear: breakEvenFor(m, savingsUsd),
        replacementsHorizon: m.replacementsHorizon,
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
    const gtFocus = targets.find((x) => x.id === repTargetId && x.solvable) || targets.find((x) => x.solvable) || null;
    payload.focus = gtFocus ? focusFor(chemistry, gtFocus) : null;
    payload.best = null;
    payload.bestReason = null;
    payload.matrix = null;
    payload.history = { kind: "gridtie", startYear: series.meta.startYear, endYear: series.meta.endYear, days: Math.ceil(hours.length / 24), pvDaily, tiers: historyTiers };
    payload.assumptions.cycleLifeTo80 = { [chemistry]: chem.cyclesTo80 };
    payload.assumptions.money =
      `Bill reduction simulated hour-by-hour across five years of weather: solar serves the load first, surplus charges the battery, the grid covers the rest, nothing is exported unless you enter a feed-in credit (then clipped surplus is valued at that rate). Lifetime cost includes bank swaps plus install labor each time. Fixed connection fees not counted.`;
    return payload;
  }

  // ── OFF-GRID ──────────────────────────────────────────────────────────────
  const historyTiers = [];

  if (chemistry === "auto") {
    const auto = [];
    const matrixCells = {};
    for (const chemId of ["naion", "lfp", "agm"]) {
      const capScale = capacityScaleFor(chemId, meanTempC);
      const allTiers = sizeAllTiers({
        e1kw, loadWh, tempsC, chemistry: chemId,
        years: series.meta.years, costPerWpv: costPerWpvMid, costPerKwhBatt: landedMidBattKwh, costPerKwInv: costPerKwInvMid,
        battMax: 250, capacityScale: capScale, laborPerKwh,
      });
      for (const { tier, sizing } of allTiers) {
        matrixCells[chemId + ":" + tier.id] = matrixCell(chemId, sizing, "offgrid");
      }
      const midTier = allTiers.find((t) => t.tier.id === repTierId);
      if (!midTier || !midTier.sizing) continue;
      const sizing = midTier.sizing;
      const m = moneyFor(chemId, sizing);
      const servedKwhPerYear = sizing.result.servedWh / 1000 / series.meta.years;
      const lcoe = lcoeUsdPerKwh({
        capexMidUsd: m.cost.objectiveMid,
        battReplaceCostUsd: Math.round(sizing.battKwh * landedMidBattKwh),
        replacements: m.replacementsHorizon,
        annualServedKwh: servedKwhPerYear,
      });
      const entry = {
        chemistry: chemId,
        cardNote: AUTO_CARD_NOTES[chemId] ?? null,
        chemLabel: m.chemObj.label,
        usableDod: m.chemObj.usableDod,
        solvable: true,
        pvKw: sizing.pvKw,
        battKwh: sizing.battKwh,
        battNameplateKwh: m.battNameplateKwh,
        costLo: m.cost.lo, costHi: m.cost.hi,
        unmetHoursPerYear: +(sizing.result.unmetHours / series.meta.years).toFixed(1),
        longestGapHours: sizing.result.longestGapHours,
        replacementsHorizon: m.replacementsHorizon,
        swapsAndLaborUsd: m.swapsAndLaborUsd,
        lifetimeCostMid: m.lifetimeCostMid,
        servedKwhPerYear: Math.round(servedKwhPerYear),
        batteryLifeYears: m.batteryLifeYears,
        cyclesPerYear: m.cyclesPerYear,
        lcoeUsdPerKwh: lcoe === null ? null : +lcoe.toFixed(4),
        paybackYearsLo: gridSpend ? paybackYears(m.cost.lo, gridSpend) : null,
        paybackYearsHi: gridSpend ? paybackYears(m.cost.hi, gridSpend) : null,
        trueBreakEvenYear: breakEvenFor(m, gridSpend),
      };
      const sim = simulate({
        pvKw: sizing.pvKw, battKwhUsable: sizing.battKwh,
        e1kw, loadWh, chemistry: chemId, tempsC, capture: true, capacityScale: capScale,
      });
      entry.socNameplatePct = nameplateBands(sim, sizing.battKwh * 1000 * capScale, entry.battNameplateKwh * 1000, chemId);
       auto.push(entry);
     }
     const payload = basePayload();
      payload.mode = "offgrid";
      payload.auto = auto;
        payload.autoNote = `All three chemistries sized for ${TIER_BASIS[repTierId]}`;
      payload.tiers = [];
      const ogWinner = bestOf(auto);
      payload.best = ogWinner;
      payload.bestReason = bestPickReason(ogWinner, auto, meanTempC);
      payload.focus = ogWinner ? focusFor(ogWinner.chemistry, ogWinner) : null;
      payload.matrix = {
        kind: "offgrid",
        cols: RELIABILITY_TIERS.map((t) => ({ id: t.id, label: t.label })),
        rows: ["naion", "lfp", "agm"].map((id) => ({ id, label: CHEMISTRIES[id].label })),
        cells: matrixCells,
      };
      payload.history = { kind: "auto", startYear: series.meta.startYear, endYear: series.meta.endYear, days: Math.ceil(hours.length / 24), pvDaily, tiers: [] };
    payload.assumptions.cycleLifeTo80 = Object.fromEntries(["naion", "lfp", "agm"].map((c) => [c, CHEMISTRIES[c].cyclesTo80]));
    payload.assumptions.money =
      `Auto mode sizes each chemistry for the same job — lights stay on with a generator as rare backup — inside its depth-of-discharge window (AGM keeps a 50% reserve; lithium/sodium use ~90%). Sodium is modeled on standard LFP voltage settings: slightly less usable capacity than a native profile, but gentler discharge and longer life. Lifetime cost adds every bank swap PLUS install labor each time over 20 years; lead-acid is modeled WITHOUT active balancing (typical DIY strings) — that is why its sticker price misleads.`;
    return payload;
  }

  const chem = CHEMISTRIES[chemistry] || CHEMISTRIES.lfp;
  const capScale = capacityScaleFor(chemistry, meanTempC);
  const results = sizeAllTiers({
    e1kw, loadWh, tempsC, chemistry,
    years: series.meta.years, costPerWpv: costPerWpvMid, costPerKwhBatt: landedMidBattKwh, costPerKwInv: costPerKwInvMid,
    battMax: 250, capacityScale: capScale, laborPerKwh,
  });

  const tiers = results.map(({ tier, sizing }) => {
    if (!sizing) {
      return {
        id: tier.id, label: tier.label, solvable: false,
        pvKw: null, battKwh: null, battNameplateKwh: null, usableDod: chem.usableDod,
        costLo: null, costHi: null, unmetHoursPerYear: null, longestGapHours: null,
        cyclesPerYear: null, batteryLifeYears: null, minSocPct: null,
        servedKwhPerYear: null, replacementsHorizon: null, swapsAndLaborUsd: null,
        lifetimeCostMid: null, lcoeUsdPerKwh: null, paybackYearsLo: null, paybackYearsHi: null,
      };
    }
    const m = moneyFor(chemistry, sizing);
    const servedKwhPerYear = sizing.result.servedWh / 1000 / series.meta.years;
    const lcoe = lcoeUsdPerKwh({
      capexMidUsd: m.cost.objectiveMid,
      battReplaceCostUsd: Math.round(sizing.battKwh * landedMidBattKwh),
      replacements: m.replacementsHorizon,
      annualServedKwh: servedKwhPerYear,
    });
    const sim = simulate({
      pvKw: sizing.pvKw, battKwhUsable: sizing.battKwh,
      e1kw, loadWh, chemistry, tempsC, capture: true, capacityScale: capScale,
    });
    const band = socBand(tier.id, sim, chemistry);
     if (band) historyTiers.push(band);
     return {
       id: tier.id, label: tier.label, solvable: true,
       pvKw: sizing.pvKw, battKwh: sizing.battKwh,
       battNameplateKwh: m.battNameplateKwh,
       usableDod: chem.usableDod,
      costLo: m.cost.lo, costHi: m.cost.hi,
      pvCostLo: m.cost.pvCostLo, pvCostHi: m.cost.pvCostHi,
      battCostLo: m.cost.battCostLo, battCostHi: m.cost.battCostHi,
      battPerKwhLo: m.cost.battPerKwhLo, battPerKwhHi: m.cost.battPerKwhHi,
      unmetHoursPerYear: +(sizing.result.unmetHours / series.meta.years).toFixed(1),
      longestGapHours: sizing.result.longestGapHours,
      cyclesPerYear: m.cyclesPerYear,
      batteryLifeYears: m.batteryLifeYears,
      minSocPct: +(sizing.result.minSoc * 100).toFixed(0),
      servedKwhPerYear: Math.round(servedKwhPerYear),
      replacementsHorizon: m.replacementsHorizon,
      swapsAndLaborUsd: m.swapsAndLaborUsd,
      lifetimeCostMid: m.lifetimeCostMid,
      lcoeUsdPerKwh: lcoe === null ? null : +lcoe.toFixed(4),
      paybackYearsLo: gridSpend ? paybackYears(m.cost.lo, gridSpend) : null,
      paybackYearsHi: gridSpend ? paybackYears(m.cost.hi, gridSpend) : null,
      trueBreakEvenYear: breakEvenFor(m, gridSpend),
    };
  });

  const payload = basePayload();
  payload.mode = "offgrid";
  payload.chemLabel = chem.label;
  payload.tiers = tiers;
  payload.auto = null;
  const ogFocus = tiers.find((x) => x.id === repTierId && x.solvable) || tiers.find((x) => x.solvable) || null;
  payload.focus = ogFocus ? focusFor(chemistry, ogFocus) : null;
  payload.best = null;
  payload.bestReason = null;
  payload.matrix = null;
  payload.history = { kind: "offgrid", startYear: series.meta.startYear, endYear: series.meta.endYear, days: Math.ceil(hours.length / 24), pvDaily, tiers: historyTiers };
  payload.assumptions.cycleLifeTo80 = { [chemistry]: chem.cyclesTo80 };
  payload.assumptions.money =
    `Payback compares component cost against your current annual grid spend (tariff you entered). Levelized cost uses landed-mid capex, replaces battery banks as they wear out across a 20-year horizon, and assumes panels/inverter last the full 20 years. Lifetime figures include install labor on the first bank and every swap. Generator fuel and grid fixed charges are not counted.`;
  return payload;
}
