// The single source of truth for sizing runs. Both the web worker wrapper
// and the Node test suite call runSizing() directly, so the UI contract —
// every field the renderers read — is defined here and only here.
//
// msg: { latitude, longitude, dailyKwh, chemistry: "auto"|"naion"|"lfp"|"agm",
//        years, tariff, exportRate, mode: "offgrid"|"gridtie" }
// deps: { fetchWeather } injectable for offline tests.
import {
  buildE1kw, flatProfile, expandProfile, sizeAllTiers, simulate,
  sizeAllBillTargets, sizeForBillCut, simulateOffset, dailyExtremes, CHEMISTRIES,
  RELIABILITY_TIERS, BILL_TARGETS,
  DERATES_DEFAULT, GAMMA_PMAX, NOCT, ETA_INVERTER, capacityScaleFor,
} from "./engine.js?v=20260831a";

import { fetchHourlyCached, synthesizeFromProfile } from "./nasa.js?v=20260831f";
import { buildFrontier } from "./frontier.js?v=20260830b";
import { fullRange, getScope, POWMR_CATALOG, estimateTariff } from "./pricing.js?v=20260830o";
import {
  annualGridSpendUsd, paybackYears, batteryReplacements, lcoeUsdPerKwh,
  lifetimeCostUsd, exportValueUsd, trueBreakEvenYear, cumulativeCostSeries,
  INSTALL_LABOR_PER_KWH_USABLE,

} from "./money.js?v=20260831i";

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

/**
 * Count-aware sentence for the auto cards: names exactly the chemistries
 * that actually produced a system, so copy never claims "all three" when
 * only one or two solved.
 */
/**
 * Plain-language verdict for why the winning chemistry won — pure, so the
 * worker can reuse it for the slider-driven recommendation. Winner and the
 * candidate entries carry chemLabel/chemistry/replacementsHorizon.
 */
export function bestPickReason(winner, allEntries, meanT) {
  if (!winner) return null;
  const others = allEntries.filter((a) => a && a.solvable && a !== winner && Number.isFinite(a.lifetimeCostMid));
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
  const tail = others.length >= 2
    ? " The ranking shifts with climate, tariffs, and how much work you do yourself — check the other options before deciding."
    : others.length === 1
      ? " The ranking shifts with climate, tariffs, and how much work you do yourself — weigh the runner-up before deciding."
      : " No other chemistry produced a practical system at this site and load.";
  return `${why}${tail}`;
}

export function autoNoteFor(entries, basis) {
  const names = entries.map((a) => a.chemLabel);
  if (names.length >= 3) return `All three chemistries sized for ${basis}`;
  if (names.length === 2) return `${names[0]} and ${names[1]} sized for ${basis}`;
  if (names.length === 1) return `${names[0]} sized for ${basis}`;
  return `No chemistry produced a practical system here for ${basis}.`;
}

// UI-contract version: bump whenever payload fields change shape. The
// renderer compares this to its own constant and warns on mismatch instead
// of rendering garbage from a stale cached module.
export const PAYLOAD_CONTRACT = 10;

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
    customCut = 0.8, focusPvKw = null, focusBattKwh = null, focusChemistry = null,
  } = msg;
  const repTierId = VALID_AUTO_TIERS.has(autoTier) ? autoTier : "tier99";
  const repTargetId = VALID_AUTO_TARGETS.has(autoTargetId) ? autoTargetId : "cut80";
  const cc = Number(customCut);
  if (!Number.isFinite(cc) || cc < 0.01 || cc > 1.11) {
    throw new RangeError(`customCut must be within [0.01, 1.11] (1%–111% bill cut); got ${customCut}`);
  }

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
      firstLaborUsd: life.firstLabor,
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
  // Also computes the per-year cumulative cost series (grid vs solar running
  // sums) so the headline chart and the break-even row can never disagree.
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

  // Cumulative 20-year cost series for the headline chart: grid running sum
  // vs solar TRUE cost running sum (capex + every bank swap + the RESIDUAL
  // bill that keeps being paid every year). annualSavingsUsd = the bill this
  // system displaces per year (grid spend − residual bill, plus feed-in value
  // on clipped surplus); residualAnnualUsd = what the household still pays the
  // grid each year (net of feed-in credit). Null when no tariff was entered.
  function cumCostFor(m, annualSavingsUsd, residualAnnualUsd = 0) {
    return cumulativeCostSeries({
      capexMidUsd: m.cost.objectiveMid,
      annualSavingsUsd,
      residualAnnualUsd,
      swapsAndLaborTotalUsd: m.swapsAndLaborUsd,
      replacements: m.replacementsHorizon,
      batteryLifeYears: m.batteryLifeYears,
      firstLaborUsd: m.firstLaborUsd,
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
      const billAfterUsd = tariff !== null ? importedKwhPerYear * tariff : null;
      savings = billAfterUsd !== null && gridSpend ? Math.max(0, gridSpend - billAfterUsd) : null;
      if (savings !== null) savings += exportValueUsd(clippedKwhPerYear, exportRate);
      cell.cutPct = Math.round((1 - importedKwhPerYear / (dailyKwh * 365)) * 100);
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


  // ── Shared per-system closures ──────────────────────────────────────────
  // Every mode and the incremental-cut path build systems through these SAME
  // builders (same money math, same chart bands, same cumulative series), so a
  // number on a card can never disagree with a number in the matrix, on the
  // curve modal, or after a slider edit.
  // One chemistry at one (arbitrary) bill-cut target: the full money story,
  // export economics, chart bands and cumulative-cost series — the same record
  // the headline cards carry, so ANY entry can drive the whole results
  // pipeline when selected. `sizing` comes from sizeForBillCut; its search
  // result carries no SOC series, so capture is re-run here.
  const entryFromSizing = (chemId, sizing) => {
    if (!sizing) return null;
    const capScale = capacityScaleFor(chemId, meanTempC);
    const m = moneyFor(chemId, sizing);
    const servedKwhPerYear = (sizing.result.directWh + sizing.result.battWhAc) / 1000 / series.meta.years;
    const importedKwhPerYear = sizing.result.importedWh / 1000 / series.meta.years;
    const clippedKwhPerYear = sizing.result.curtailedWh / 1000 / series.meta.years;
    const billAfterUsd = tariff !== null ? importedKwhPerYear * tariff : null;
    const savingsUsd = billAfterUsd !== null && gridSpend !== null ? Math.max(0, gridSpend - billAfterUsd) : null;
    const exportVal = exportValueUsd(clippedKwhPerYear, exportRate);
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
      cutPct: Math.round((1 - importedKwhPerYear / (dailyKwh * 365)) * 100),
      billAfterMonthlyUsd: billAfterUsd === null ? null : Math.round(billAfterUsd / 12),
      paybackYearsLo: savingsUsd !== null ? paybackYears(m.cost.lo, savingsUsd + exportVal) : null,
      paybackYearsHi: savingsUsd !== null ? paybackYears(m.cost.hi, savingsUsd + exportVal) : null,
      trueBreakEvenYear: savingsUsd !== null ? breakEvenFor(m, savingsUsd + exportVal) : null,
      cumCostSeries: (gridSpend !== null && billAfterUsd !== null && savingsUsd !== null)
        ? cumCostFor(m, savingsUsd + exportVal, Math.max(0, billAfterUsd - exportVal))
        : null,
      exportValueAnnualUsd: Math.round(exportVal),
      clippedKwhPerYear: Math.round(clippedKwhPerYear),
      importedKwhPerYear: Math.round(importedKwhPerYear),
      replacementsHorizon: m.replacementsHorizon,
      swapsAndLaborUsd: m.swapsAndLaborUsd,
      lifetimeCostMid: m.lifetimeCostMid,
      servedKwhPerYear: Math.round(servedKwhPerYear),
      cyclesPerYear: m.cyclesPerYear,
      batteryLifeYears: m.batteryLifeYears,
      peakLoadW: Math.round(peakLoadW),
      meanTempC: Math.round(meanTempC),
      lcoeUsdPerKwh: (() => {
        const l = lcoeUsdPerKwh({
          capexMidUsd: m.cost.objectiveMid,
          battReplaceCostUsd: Math.round(sizing.battKwh * landedMidBattKwh),
          replacements: m.replacementsHorizon,
          annualServedKwh: servedKwhPerYear,
        });
        return l === null ? null : +l.toFixed(4);
      })(),
    };
    const sim = simulateOffset({
      pvKw: sizing.pvKw, battKwhUsable: sizing.battKwh,
      e1kw, loadWh, chemistry: chemId, tempsC, capacityScale: capScale, capture: true,
    });
    entry.socNameplatePct = nameplateBands(sim, sizing.battKwh * 1000 * capScale, entry.battNameplateKwh * 1000, chemId);
    return entry;
  };

  // Grid-tie matrix cells must be clickable-selection-complete: the same
  // money story, export economics, chart bands and 20-yr cumulative series
  // as a full card, so selecting a cell re-renders every downstream panel.
  const enrichGtMatrixCell = (chemId, sizing, cell) => {
    if (!cell || !cell.solvable) return cell;
    const yrs = series.meta.years;
    const capScale = capacityScaleFor(chemId, meanTempC);
    const m = moneyFor(chemId, sizing);
    const importedKwhPerYear = sizing.result.importedWh / 1000 / yrs;
    const clippedKwhPerYear = sizing.result.curtailedWh / 1000 / yrs;
    const billAfterUsd = tariff !== null ? importedKwhPerYear * tariff : null;
    const exportVal = exportValueUsd(clippedKwhPerYear, exportRate);
    const savingsUsd = billAfterUsd !== null && gridSpend !== null ? Math.max(0, gridSpend - billAfterUsd) + exportVal : null;
    cell.chemistry = chemId;
    cell.battNameplateKwh = m.battNameplateKwh;
    cell.usableDod = m.chemObj.usableDod;
    cell.importedKwhPerYear = Math.round(importedKwhPerYear);
    cell.clippedKwhPerYear = Math.round(clippedKwhPerYear);
    cell.exportValueAnnualUsd = Math.round(exportVal);
    cell.billAfterMonthlyUsd = billAfterUsd === null ? null : Math.round(billAfterUsd / 12);
    cell.cyclesPerYear = m.cyclesPerYear;
    cell.batteryLifeYears = m.batteryLifeYears;
    cell.peakLoadW = Math.round(peakLoadW);
    cell.meanTempC = Math.round(meanTempC);
    cell.cumCostSeries = (gridSpend !== null && billAfterUsd !== null && savingsUsd !== null)
      ? cumCostFor(m, savingsUsd, Math.max(0, billAfterUsd - exportVal))
      : null;
    const sim = simulateOffset({
      pvKw: sizing.pvKw, battKwhUsable: sizing.battKwh,
      e1kw, loadWh, chemistry: chemId, tempsC, capacityScale: capScale, capture: true,
    });
    cell.socNameplatePct = nameplateBands(sim, sizing.battKwh * 1000 * capScale, cell.battNameplateKwh * 1000, chemId);
    return cell;
  };

  // One bill-cut target for ONE fixed chemistry (manual grid-tie mode): same
  // money story / export economics / chart bands / cumulative series as a
  // card, so the focused target can drive the whole pipeline.
  const buildTarget = (chemId, id, label, minFraction, sizing, bandSink = null) => {
    if (!sizing) return { id, label, solvable: false };
    const chemObj = CHEMISTRIES[chemId] || CHEMISTRIES.lfp;
    const capScale = capacityScaleFor(chemId, meanTempC);
    const m = moneyFor(chemId, sizing);
    const servedKwhPerYear = (sizing.result.directWh + sizing.result.battWhAc) / 1000 / series.meta.years;
    const importedKwhPerYear = sizing.result.importedWh / 1000 / series.meta.years;
    const clippedKwhPerYear = sizing.result.curtailedWh / 1000 / series.meta.years;
    const billAfterUsd = tariff !== null ? importedKwhPerYear * tariff : null;
    const savingsUsd = billAfterUsd !== null && gridSpend !== null ? Math.max(0, gridSpend - billAfterUsd) : null;
    const exportVal = exportValueUsd(clippedKwhPerYear, exportRate);
    const lcoe = lcoeUsdPerKwh({
      capexMidUsd: m.cost.objectiveMid,
      battReplaceCostUsd: Math.round(sizing.battKwh * landedMidBattKwh),
      replacements: m.replacementsHorizon,
      annualServedKwh: servedKwhPerYear,
    });
    const sim = simulateOffset({
      pvKw: sizing.pvKw, battKwhUsable: sizing.battKwh,
      e1kw, loadWh, chemistry: chemId, tempsC, capacityScale: capScale, capture: true,
    });
    const band = socBand(id, sim, chemId);
    if (band && bandSink) bandSink.push(band);
    return {
      id, label, solvable: true,
      minFraction: minFraction ?? null,
      pvKw: sizing.pvKw, battKwh: sizing.battKwh,
      battNameplateKwh: m.battNameplateKwh,
      usableDod: chemObj.usableDod,
      costLo: m.cost.lo, costHi: m.cost.hi,
      pvCostLo: m.cost.pvCostLo, pvCostHi: m.cost.pvCostHi,
      battCostLo: m.cost.battCostLo, battCostHi: m.cost.battCostHi,
      battPerKwhLo: m.cost.battPerKwhLo, battPerKwhHi: m.cost.battPerKwhHi,
      cutPct: Math.round((1 - importedKwhPerYear / (dailyKwh * 365)) * 100),
      importedKwhPerYear: Math.round(importedKwhPerYear),
      clippedKwhPerYear: Math.round(clippedKwhPerYear),
      exportValueAnnualUsd: Math.round(exportVal),
      billAfterMonthlyUsd: billAfterUsd === null ? null : Math.round(billAfterUsd / 12),
      paybackYearsLo: savingsUsd !== null ? paybackYears(m.cost.lo, savingsUsd + exportVal) : null,
      paybackYearsHi: savingsUsd !== null ? paybackYears(m.cost.hi, savingsUsd + exportVal) : null,
      trueBreakEvenYear: savingsUsd !== null ? breakEvenFor(m, savingsUsd + exportVal) : null,
      cumCostSeries: (gridSpend !== null && billAfterUsd !== null && savingsUsd !== null)
        ? cumCostFor(m, savingsUsd + exportVal, Math.max(0, billAfterUsd - exportVal))
        : null,
      replacementsHorizon: m.replacementsHorizon,
      swapsAndLaborUsd: m.swapsAndLaborUsd,
      lifetimeCostMid: m.lifetimeCostMid,
      servedKwhPerYear: Math.round(servedKwhPerYear),
      cyclesPerYear: m.cyclesPerYear,
      batteryLifeYears: m.batteryLifeYears,
      lcoeUsdPerKwh: lcoe === null ? null : +lcoe.toFixed(4),
    };
  };

  // SOC history bands for the fixed-chemistry ladder (shared across modes).
  const historyTiers = [];

  // ── Plausibility frontier ────────────────────────────────────────────────
  // The headline cards answer "what does THIS target cost?". The frontier
  // answers "what does every budget buy?" - the shape that tells someone
  // whether their goal is easy, expensive, or impossible where they live.
  //
  // It prices systems through the SAME fullRange() the cards use, so a
  // number on the chart can never contradict a number on a card.
  let loadTotalWh = 0;
  for (let i = 0; i < loadWh.length; i++) loadTotalWh += loadWh[i];

  function attachFrontier(payload) {
    const f = payload.focus;
    const chemId = (f && f.chemistry) || (chemistry === "auto" ? "lfp" : chemistry);
    const capScale = capacityScaleFor(chemId, meanTempC);
    const costFn = (pv, b) => {
      const r = fullRange(pv, b, chemId, landedF);
      return { mid: r.objectiveMid, lo: r.lo, hi: r.hi };
    };
    // Sweep well past the headline answer so the user's option sits inside the
    // picture. When nothing solved, fall back to the SAME envelope the card
    // search already explored - a narrower sweep would let the chart imply a
    // smaller world than the cards beside it had already looked at, and the
    // top of the curve gets reported to the reader as a searched limit.
    const searched = payload.mode === "gridtie"
      ? { pv: 45, batt: 120 }     // matches sizeAllBillTargets above
      : { pv: 30, batt: 250 };    // matches sizeAllTiers above
    const pvMax = f ? Math.min(45, Math.max(3, f.pvKw * 2.2)) : searched.pv;
    const battMax = f ? Math.min(120, Math.max(4, f.battKwh * 2.6)) : searched.batt;

    let frontier;
    try {
      frontier = buildFrontier({
        e1kw, loadWh, tempsC, chemistry: chemId, mode: payload.mode,
        capacityScale: capScale, costFn, pvMax, battMax,
      });
    } catch {
      payload.frontier = null;   // never let a chart take the whole result down
      return payload;
    }

    // Where the option they are actually reading sits on that curve. Computed
    // by simulating it, not by looking it up - so if their target is NOT on
    // the frontier, the marker honestly lands below the line.
    if (f && loadTotalWh > 0) {
      const fScale = capacityScaleFor(f.chemistry, meanTempC);
      const sim = payload.mode === "gridtie"
        ? simulateOffset({ pvKw: f.pvKw, battKwhUsable: f.battKwh, e1kw, loadWh, chemistry: f.chemistry, tempsC, capacityScale: fScale })
        : simulate({ pvKw: f.pvKw, battKwhUsable: f.battKwh, e1kw, loadWh, chemistry: f.chemistry, tempsC, capacityScale: fScale });
      const outcome = payload.mode === "gridtie"
        ? 1 - sim.importedWh / loadTotalWh
        : sim.servedWh / loadTotalWh;
      const cost = fullRange(f.pvKw, f.battKwh, f.chemistry, landedF);
      let pointIndex = -1, bestGap = Infinity;
      frontier.points.forEach((pt, i) => {
        const gap = Math.abs(pt.capexUsd - cost.objectiveMid);
        if (gap < bestGap) { bestGap = gap; pointIndex = i; }
      });
      frontier.marker = {
        capexUsd: cost.objectiveMid,
        outcomePct: +(outcome * 100).toFixed(1),
        pvKw: f.pvKw,
        battKwh: f.battKwh,
        pointIndex,
      };
    } else {
      frontier.marker = null;
    }

    // Per-point full analysis for the click-to-detail modal: computed here
    // from the very simulation the point was built with (same money math as
    // the cards), then the heavy result objects are stripped before shipping.
    const pointDetail = (pt) => {
      const m = moneyFor(chemId, { pvKw: pt.pvKw, battKwh: pt.battKwh, result: pt.result });
      const yrs = series.meta.years;
      const servYr = (payload.mode === "gridtie" ? pt.result.directWh + pt.result.battWhAc : pt.result.servedWh) / 1000 / yrs;
      const lcoe = lcoeUsdPerKwh({
        capexMidUsd: m.cost.objectiveMid,
        battReplaceCostUsd: Math.round(pt.battKwh * landedMidBattKwh),
        replacements: m.replacementsHorizon,
        annualServedKwh: servYr,
      });
      const chemObj = CHEMISTRIES[chemId] || CHEMISTRIES.lfp;
      const d = {
        chemistry: chemId,
        chemLabel: chemObj.label,
        usableDod: chemObj.usableDod,
        battNameplateKwh: m.battNameplateKwh,
        pvKw: pt.pvKw,
        battKwh: pt.battKwh,
        costLo: m.cost.lo, costHi: m.cost.hi,
        replacementsHorizon: m.replacementsHorizon,
        swapsAndLaborUsd: m.swapsAndLaborUsd,
        lifetimeCostMid: m.lifetimeCostMid,
        batteryLifeYears: m.batteryLifeYears,
        cyclesPerYear: m.cyclesPerYear,
        servedKwhPerYear: Math.round(servYr),
        lcoeUsdPerKwh: lcoe === null ? null : +lcoe.toFixed(4),
        paybackYearsLo: null, paybackYearsHi: null, trueBreakEvenYear: null,
        cumCostSeries: null,
      };
      let savingsBase = null;
      let residualUsd = 0;
      if (payload.mode === "gridtie") {
        const impKwhYr = pt.result.importedWh / 1000 / yrs;
        const clipKwhYr = pt.result.curtailedWh / 1000 / yrs;
        const billAfter = tariff !== null ? impKwhYr * tariff : null;
        const exportV = exportValueUsd(clipKwhYr, exportRate);
        d.importedKwhPerYear = Math.round(impKwhYr);
        d.clippedKwhPerYear = Math.round(clipKwhYr);
        d.exportValueAnnualUsd = Math.round(exportV);
        d.billAfterMonthlyUsd = billAfter === null ? null : Math.round(billAfter / 12);
        d.cutPct = Math.round((1 - impKwhYr / (dailyKwh * 365)) * 100);
        savingsBase = billAfter !== null && gridSpend ? Math.max(0, gridSpend - billAfter) : null;
        if (savingsBase !== null) savingsBase += exportV;
        residualUsd = billAfter === null ? 0 : Math.max(0, billAfter - exportV);
      } else {
        d.unmetHoursPerYear = +(pt.result.unmetHours / yrs).toFixed(1);
        d.longestGapHours = pt.result.longestGapHours;
        savingsBase = gridSpend;
      }
      if (savingsBase !== null) {
        d.paybackYearsLo = paybackYears(m.cost.lo, savingsBase);
        d.paybackYearsHi = paybackYears(m.cost.hi, savingsBase);
        d.trueBreakEvenYear = breakEvenFor(m, savingsBase);
        d.cumCostSeries = (savingsBase > 0 || residualUsd > 0) ? cumCostFor(m, savingsBase, residualUsd) : null;
      }
      return d;
    };

    // Strip the per-point simulation objects: the renderer never reads them
    // and they would multiply the worker's postMessage payload many times over.
    frontier.points = frontier.points
      .map(({ result, ...keep }) => ({ ...keep, detail: pointDetail({ ...keep, result }) }));
    payload.frontier = frontier;
    return payload;
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

  // Shared sizing options for the fixed-chemistry bill-cut targets (used by
  // the full run and by the incremental slider patch alike).
  const billCutOpts = {
    e1kw, loadWh, tempsC, chemistry,
    years: series.meta.years, costPerWpv: costPerWpvMid, costPerKwhBatt: landedMidBattKwh, costPerKwInv: costPerKwInvMid,
    pvMax: 45, battMax: 120, battStep: 1, capacityScale: capacityScaleFor(chemistry, meanTempC), laborPerKwh,
  };

  // ── INCREMENTAL CUT (slider / curve edits) ──────────────────────────────
  // The custom-cut control ONLY changes the matrix's "your target" column
  // (and, for a fixed-chemistry run, the single custom target card). Nothing
  // else in the payload — the fixed 60/80/95 columns, the chemistry cards,
  // the frontier — is affected by a customCut edit, so a slider move or a
  // curve-point snap re-simulates just those systems instead of re-running
  // the whole engine. Returns a PATCH the UI merges into the retained payload
  // (plus SOC capture bands for an adopted exact system, when given).
  if (msg.incrementalCut) {
    const customFracGt = +cc.toFixed(3);
    const patch = { customCut: null, cells: null, customTarget: null, focusSoc: null };
    if (mode === "gridtie") {
      if (chemistry === "auto") {
        const cells = {};
        const customEntries = [];
        for (const chemId of ["naion", "lfp", "agm"]) {
          const sized = sizeForBillCut({
            e1kw, loadWh, tempsC, chemistry: chemId, minFraction: customFracGt,
            years: series.meta.years, costPerWpv: costPerWpvMid, costPerKwhBatt: landedMidBattKwh, costPerKwInv: costPerKwInvMid,
            pvMax: 45, battMax: 120, battStep: 1, capacityScale: capacityScaleFor(chemId, meanTempC), laborPerKwh,
          });
          const entry = sized ? entryFromSizing(chemId, sized) : null;
          if (entry) customEntries.push(entry);
          if (sized) cells[chemId + ":custom"] = enrichGtMatrixCell(chemId, sized, matrixCell(chemId, sized, "gridtie"));
        }
        if (customFracGt > 1) {
          for (const e of customEntries) if (e.cutPct < 99) e.cutPct = Math.round(customFracGt * 100);
          for (const chemId of ["naion", "lfp", "agm"]) {
            const c = cells[chemId + ":custom"];
            if (c && c.solvable && c.cutPct < 99) c.cutPct = Math.round(customFracGt * 100);
          }
        }
        const customBest = bestOf(customEntries);
        patch.cells = cells;
        patch.customCut = {
          fraction: customFracGt,
          achievedPct: customBest ? (customFracGt > 1 ? Math.round(customFracGt * 100) : customBest.cutPct) : null,
          entries: customEntries,
          best: customBest,
          surplus: customFracGt > 1,
        };
        // The recommendation follows the bill-cut slider: the banner, headline
        // savings and focus system now describe the cheapest system that
        // achieves the visitor's CURRENT target, not the fixed 80% one.
        if (customBest) {
          patch.best = customBest;
          patch.bestReason = bestPickReason(customBest, customEntries, meanTempC);
          patch.focus = focusFor(customBest.chemistry, customBest);
        }
      } else {
        const custSizing = sizeForBillCut({ ...billCutOpts, minFraction: customFracGt });
        const customTarget = custSizing
          ? buildTarget(chemistry, "custom", `Your ~${Math.round(customFracGt * 100)}% target`, customFracGt, custSizing, null)
          : null;
        if (customFracGt > 1 && customTarget && customTarget.solvable && customTarget.cutPct < 99) {
          customTarget.cutPct = Math.round(customFracGt * 100);
        }
        patch.customTarget = customTarget;
        patch.customCut = {
          fraction: customFracGt,
          achievedPct: customTarget && customTarget.solvable
            ? (customFracGt > 1 ? Math.round(customFracGt * 100) : customTarget.cutPct)
            : null,
          entries: [], best: null, surplus: customFracGt > 1,
        };
      }
    }
    // Adopted "exact system" capture: SOC nameplate bands for the curve point
    // (or matrix cell) the visitor picked, so its chart renders immediately
    // instead of waiting for — or forcing — a full engine re-run.
    if (Number.isFinite(Number(focusPvKw)) && Number.isFinite(Number(focusBattKwh))) {
      const fChem = (focusChemistry && CHEMISTRIES[focusChemistry]) ? focusChemistry : (chemistry === "auto" ? "lfp" : chemistry);
      const fScale = capacityScaleFor(fChem, meanTempC);
      const fBatt = Math.max(0, Number(focusBattKwh));
      const fPv = Number(focusPvKw);
      const sim = mode === "gridtie"
        ? simulateOffset({ pvKw: fPv, battKwhUsable: fBatt, e1kw, loadWh, chemistry: fChem, tempsC, capacityScale: fScale, capture: true })
        : simulate({ pvKw: fPv, battKwhUsable: fBatt, e1kw, loadWh, chemistry: fChem, tempsC, capacityScale: fScale, capture: true });
      const nameplateKwh = fBatt / (CHEMISTRIES[fChem].usableDod);
      patch.focusSoc = {
        chemistry: fChem, pvKw: fPv, battKwh: fBatt,
        socNameplatePct: nameplateBands(sim, fBatt * 1000 * fScale, nameplateKwh * 1000, fChem),
      };
    }
    return patch;
  }

  // ── GRID-TIE ──────────────────────────────────────────────────────────────
  if (mode === "gridtie") {

    if (chemistry === "auto") {
      const matrixCells = {};
      const resultsByChem = {};
      // All three chemistries, shown at ONE shared cut target. If the target the
      // visitor asked for is unreachable inside the searched envelope (a very
      // large load, or a poorly-sunlit site), fall back to the nearest achievable
      // cut so they still get a comparison, and say so. BILL_TARGETS ascends
      // 60 -> 80 -> 95.
      const buildAuto = (targetId) => {
        const out = [];
        for (const chemId of ["naion", "lfp", "agm"]) {
          const hit = resultsByChem[chemId] && resultsByChem[chemId].find((r) => r.target.id === targetId);
          if (!hit || !hit.sizing) continue;
          const entry = entryFromSizing(chemId, hit.sizing);
          if (entry) out.push(entry);
        }
        return out;
      };

      for (const chemId of ["naion", "lfp", "agm"]) {
        const capScale = capacityScaleFor(chemId, meanTempC);
        const results = sizeAllBillTargets({
          e1kw, loadWh, tempsC, chemistry: chemId,
          years: series.meta.years, costPerWpv: costPerWpvMid, costPerKwhBatt: landedMidBattKwh, costPerKwInv: costPerKwInvMid,
          pvMax: 45, battMax: 120, battStep: 1, capacityScale: capScale, laborPerKwh,
        });
        resultsByChem[chemId] = results;
        for (const { target, sizing } of results) {
          matrixCells[chemId + ":" + target.id] = enrichGtMatrixCell(chemId, sizing, matrixCell(chemId, sizing, "gridtie"));
        }
      }

      let effectiveTarget = repTargetId;
      let auto = buildAuto(repTargetId);
      let autoFallback = false;
      if (!auto.length) {
        const desiredIdx = BILL_TARGETS.findIndex((t) => t.id === repTargetId);
        for (let i = Math.max(0, desiredIdx - 1); i >= 0; i--) {
          const cand = BILL_TARGETS[i].id;
          const built = buildAuto(cand);
          if (built.length) { auto = built; effectiveTarget = cand; autoFallback = true; break; }
        }
      }
      const payload = basePayload();
      payload.mode = "gridtie";
      payload.auto = auto;
      payload.autoFallback = autoFallback;
      payload.effectiveTargetId = effectiveTarget;
      payload.autoNote = autoFallback
        ? `${TARGET_BASIS[repTargetId]} isn't reachable within the sizes this tool searches at this site, so the cards below show ${TARGET_BASIS[effectiveTarget]} instead — the curve shows how far this location can actually get.`
        : autoNoteFor(auto, TARGET_BASIS[effectiveTarget]);
      payload.targets = [];
      const gtWinner = bestOf(auto);
      payload.best = gtWinner;
      payload.bestReason = bestPickReason(gtWinner, auto, meanTempC);
      payload.focus = gtWinner ? focusFor(gtWinner.chemistry, gtWinner) : null;
      // The visitor's own bill-cut target from the 1–111% slider: sized by an
      // exact engine run per chemistry, never interpolated from the fixed
      // columns, and added to the matrix as a clickable "your target" column.
      const customFracGt = +cc.toFixed(3);
      const customEntries = [];
      for (const chemId of ["naion", "lfp", "agm"]) {
        const sized = sizeForBillCut({
          e1kw, loadWh, tempsC, chemistry: chemId, minFraction: customFracGt,
          years: series.meta.years, costPerWpv: costPerWpvMid, costPerKwhBatt: landedMidBattKwh, costPerKwInv: costPerKwInvMid,
          pvMax: 45, battMax: 120, battStep: 1, capacityScale: capacityScaleFor(chemId, meanTempC), laborPerKwh,
        });
        const entry = sized ? entryFromSizing(chemId, sized) : null;
        if (entry) customEntries.push(entry);
        if (sized) matrixCells[chemId + ":custom"] = enrichGtMatrixCell(chemId, sized, matrixCell(chemId, sized, "gridtie"));
      }
      // Above 100% the honest headline is "bill eliminated + surplus": the
      // simulated import fraction caps at ~100% of the bill, so report the
      // actual target cut when the system was sized to produce surplus.
      if (customFracGt > 1) {
        for (const e of customEntries) if (e.cutPct < 99) e.cutPct = Math.round(customFracGt * 100);
        for (const chemId of ["naion", "lfp", "agm"]) {
          const c = matrixCells[chemId + ":custom"];
          if (c && c.solvable && c.cutPct < 99) c.cutPct = Math.round(customFracGt * 100);
        }
      }
      const customBest = bestOf(customEntries);
      payload.customCut = {
        fraction: customFracGt,
        achievedPct: customBest ? (customFracGt > 1 ? Math.round(customFracGt * 100) : customBest.cutPct) : null,
        entries: customEntries,
        best: customBest,
        surplus: customFracGt > 1,
      };
      // "Use this system" from a curve point: don't size at all — simulate
      // THAT exact (PV, battery) for the requested chemistry and adopt it as
      // the focus system, honestly reporting its actual outcome and cost.
      if (Number.isFinite(Number(focusPvKw)) && Number.isFinite(Number(focusBattKwh))) {
        const fChem = (focusChemistry && CHEMISTRIES[focusChemistry]) ? focusChemistry : (payload.focus?.chemistry || "lfp");
        const fSized = {
          pvKw: +Number(focusPvKw).toFixed(2),
          battKwh: Math.max(0, Math.round(Number(focusBattKwh))),
          result: simulateOffset({
            pvKw: Number(focusPvKw), battKwhUsable: Number(focusBattKwh),
            e1kw, loadWh, chemistry: fChem, tempsC,
            capacityScale: capacityScaleFor(fChem, meanTempC), capture: true,
          }),
        };
        const focusEntry = entryFromSizing(fChem, fSized);
        if (focusEntry) {
          payload.focusSystem = focusEntry;
          if (!payload.focus) payload.focus = focusFor(fChem, fSized);
        }
      }
      payload.matrix = {
        kind: "gridtie",
        cols: BILL_TARGETS.map((t) => ({ id: t.id, label: t.label }))
          .concat([{ id: "custom", label: `Your ~${Math.round(customFracGt * 100)}% target`, custom: true }]),
        rows: ["naion", "lfp", "agm"].map((id) => ({ id, label: CHEMISTRIES[id].label })),
        cells: matrixCells,
      };
      payload.history = { kind: "auto", startYear: series.meta.startYear, endYear: series.meta.endYear, days: Math.ceil(hours.length / 24), pvDaily, tiers: [] };
      payload.assumptions.cycleLifeTo80 = Object.fromEntries(["naion", "lfp", "agm"].map((c) => [c, CHEMISTRIES[c].cyclesTo80]));
      payload.assumptions.money =
        `Auto mode sizes each chemistry to deliver the same bill cut within its depth-of-discharge window (AGM banks are ~2× nameplate; lithium/sodium ~1.1×; sodium modeled on LFP voltage settings — slightly less capacity, gentler discharge). The 60/80/95% matrix columns are fixed reference points; the "your target" column follows the 1–111% slider and is sized by an exact engine run.${customFracGt > 1 ? " Above 100% the system is sized to produce sellable surplus; without a feed-in credit that surplus has no cash value and is flagged as clipped waste." : ""} Lifetime cost adds every bank swap PLUS install labor each time over 20 years; lead-acid is modeled WITHOUT active balancing (typical DIY strings). Payback compares first cost against bill savings${exportRate ? " plus feed-in credit on clipped surplus" : ""}; fixed connection fees not counted.`;
      return attachFrontier(payload);
    }

    const chem = CHEMISTRIES[chemistry] || CHEMISTRIES.lfp;
    const results = sizeAllBillTargets(billCutOpts);
    const targets = results.map(({ target, sizing }) => buildTarget(chemistry, target.id, target.label, target.minFraction, sizing, historyTiers));
    const customFracSp = +cc.toFixed(3);
    const custSizing = sizeForBillCut({ ...billCutOpts, minFraction: customFracSp });
    const customTarget = custSizing ? buildTarget(chemistry, "custom", `Your ~${Math.round(customFracSp * 100)}% target`, customFracSp, custSizing, null) : null;
    if (customFracSp > 1 && customTarget && customTarget.solvable && customTarget.cutPct < 99) {
      customTarget.cutPct = Math.round(customFracSp * 100);
    }
    const payload = basePayload();
    payload.mode = "gridtie";
    payload.chemLabel = chem.label;
    payload.targets = targets;
    payload.customTarget = customTarget;
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
    return attachFrontier(payload);
  }

  // ── OFF-GRID ──────────────────────────────────────────────────────────────

  if (chemistry === "auto") {
    const matrixCells = {};
    const resultsByChem = {};
    for (const chemId of ["naion", "lfp", "agm"]) {
      const capScale = capacityScaleFor(chemId, meanTempC);
      const allTiers = sizeAllTiers({
        e1kw, loadWh, tempsC, chemistry: chemId,
        years: series.meta.years, costPerWpv: costPerWpvMid, costPerKwhBatt: landedMidBattKwh, costPerKwInv: costPerKwInvMid,
        battMax: 250, capacityScale: capScale, laborPerKwh,
      });
      resultsByChem[chemId] = allTiers;
      for (const { tier, sizing } of allTiers) {
        matrixCells[chemId + ":" + tier.id] = matrixCell(chemId, sizing, "offgrid");
      }
    }
    // Tiers run hardest-first (100 -> 99 -> 95). If not even the lightest tier
    // is buildable for this load and site, walk down the ladder to the nearest
    // solvable reliability tier so a comparison still renders, and say so.
    const buildAuto = (tierId) => {
      const out = [];
      for (const chemId of ["naion", "lfp", "agm"]) {
        const midTier = resultsByChem[chemId] && resultsByChem[chemId].find((t) => t.tier.id === tierId);
        if (!midTier || !midTier.sizing) continue;
      const capScale = capacityScaleFor(chemId, meanTempC);
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
        cumCostSeries: gridSpend !== null ? cumCostFor(m, gridSpend) : null,
      };
      const sim = simulate({
        pvKw: sizing.pvKw, battKwhUsable: sizing.battKwh,
        e1kw, loadWh, chemistry: chemId, tempsC, capture: true, capacityScale: capScale,
      });
      entry.socNameplatePct = nameplateBands(sim, sizing.battKwh * 1000 * capScale, entry.battNameplateKwh * 1000, chemId);
      out.push(entry);
      }
      return out;
    };

    let effectiveTier = repTierId;
    let auto = buildAuto(repTierId);
    let autoFallback = false;
    if (!auto.length) {
      const desiredIdx = RELIABILITY_TIERS.findIndex((t) => t.id === repTierId);
      for (let i = desiredIdx + 1; i < RELIABILITY_TIERS.length; i++) {
        const cand = RELIABILITY_TIERS[i].id;
        const built = buildAuto(cand);
        if (built.length) { auto = built; effectiveTier = cand; autoFallback = true; break; }
      }
    }
     const payload = basePayload();
      payload.mode = "offgrid";
      payload.auto = auto;
      payload.autoFallback = autoFallback;
      payload.effectiveTierId = effectiveTier;
      payload.autoNote = autoFallback
        ? `${TIER_BASIS[repTierId]} is out of reach within the sizes this tool searches at this site, so the cards below show ${TIER_BASIS[effectiveTier]} instead — the largest system this tool can size here still leaves some hours unserved.`
        : autoNoteFor(auto, TIER_BASIS[effectiveTier]);
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
    return attachFrontier(payload);
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
      cumCostSeries: gridSpend !== null ? cumCostFor(m, gridSpend) : null,
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
  return attachFrontier(payload);
}
