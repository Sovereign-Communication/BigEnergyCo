// BigEnergyCo deterministic sizing engine.
// Pure functions only: no DOM, no network, no globals. Every constant is
// exported so the UI can render a complete "show the arithmetic" panel.

import { batteryReplacements, lifetimeCostUsd } from "./money.js?v=20261006a";
import { oversizeCallout } from "./rescale.js?v=20261006a";
import {
  CHEMISTRIES,
  coldCapacityScale,
  capacityScaleFor,
  CYCLE_LIFE_CURVES,
  cycleLifeForDoD,
} from "./chem-model.js?v=20261006a";
//
// Units:
//   irradiance  GHI(h) in W/m²  (NASA POWER hourly ALLSKY_SFC_SW_DWN, local solar time)
//   e1kw(h)     Wh delivered that hour by 1 kW-STC of array, after derates
//   load(h)     Wh AC consumption that hour
//   battery     kWh usable (between SOC floor and full)
//
// The 1 kW-array translation matches the reference spreadsheet method:
// a 4.5 kW array simply multiplies e1kw by 4.5.

// ── Constants (all visible in the UI's arithmetic panel) ────────────────────

export const DERATES_DEFAULT = {
  soiling: 0.97, // dust/dirt, washed occasionally
  wiring: 0.98, // DC + AC wiring losses
  mismatch: 0.99, // panel-to-panel variation
  mppt: 0.98, // charge-controller tracking efficiency
  snow: 1.0, // user-adjustable for snowy sites
};

export const GAMMA_PMAX = -0.0034; // per °C, mono-PERC typical (range -0.0029..-0.0040)
export const NOCT = 45; // nominal operating cell temp, °C

export const ETA_INVERTER = 0.94; // DC->AC conversion, continuous

// The chemistry/cell model — CHEMISTRIES, coldCapacityScale, capacityScaleFor,
// CYCLE_LIFE_CURVES, cycleLifeForDoD — lives in chem-model.js (imported at the
// top of this file and re-exported here) so the UI can render its arithmetic
// without pulling the search engine into the first load (plan §3.1 budgets).
export {
  CHEMISTRIES,
  coldCapacityScale,
  capacityScaleFor,
  CYCLE_LIFE_CURVES,
  cycleLifeForDoD,
};

export const RELIABILITY_TIERS = [
  { id: "tier100", label: "100% — no generator", maxUnmetHoursPerYear: 0 },
  {
    id: "tier99",
    label: "99% — generator as rare backup",
    maxUnmetHoursPerYear: 87.6,
  },
  {
    id: "tier95",
    label: "95% — generator now and then",
    maxUnmetHoursPerYear: 438,
  },
];

// ── Irradiance → array energy ───────────────────────────────────────────────

export function cellTemp(tAmbC, ghiWm2) {
  // Sandia/NOCT-style model at reference insolation 800 W/m².
  return tAmbC + (NOCT - 20) * (ghiWm2 / 800);
}

export function tempFactor(tAmbC, ghiWm2) {
  const f = 1 + GAMMA_PMAX * (cellTemp(tAmbC, ghiWm2) - 25);
  return Math.max(0, f);
}

export function arrayEfficiency(derates = DERATES_DEFAULT) {
  const d = { ...DERATES_DEFAULT, ...derates };
  return d.soiling * d.wiring * d.mismatch * d.mppt * d.snow;
}

/**
 * Build the e1kw series: Wh produced in each hour by 1 kW-STC of array.
 * @param {Array<{ghi:number, tAmb:number}>} hours - GHI W/m² and ambient °C, hourly
 * @param {object} [derates]
 * @returns {Float64Array} Wh per hour (0 for missing data hours)
 */
export function buildE1kw(hours, derates = DERATES_DEFAULT) {
  const base = arrayEfficiency(derates);
  const out = new Float64Array(hours.length);
  for (let i = 0; i < hours.length; i++) {
    const { ghi, tAmb } = hours[i];
    if (!Number.isFinite(ghi) || ghi <= -900 || !Number.isFinite(tAmb))
      continue; // fill values / gaps
    out[i] = ghi * base * tempFactor(tAmb, ghi);
  }
  return out;
}

// ── Load models ─────────────────────────────────────────────────────────────

/** Flat 24 h profile in Wh/hour summing to kWhPerDay. */
export function flatProfile(kwhPerDay) {
  const per = (kwhPerDay * 1000) / 24;
  return Float64Array.from({ length: 24 }, () => per);
}

/** Weighted 24 h profile; shape is 24 fractions summing to 1. */
export function shapedProfile(kwhPerDay, shape) {
  if (shape.length !== 24) throw new Error("shape must have 24 entries");
  const s = shape.reduce((a, b) => a + b, 0);
  if (Math.abs(s - 1) > 1e-6) throw new Error("shape must sum to 1");
  return Float64Array.from(shape, (f) => f * kwhPerDay * 1000);
}

/**
 * Appliance-based 24 h profile.
 * items: [{ watts, hoursPerDay, startHour, count }] — energy spread evenly
 * across hoursPerDay beginning at startHour (wraps past midnight).
 */
export function applianceProfile(items) {
  const day = new Float64Array(24);
  for (const it of items) {
    // A zero/non-positive daily-hours entry carries no energy; skipping avoids
    // a 0/0 NaN that would poison all 24 hours of the profile.
    if (!(it.hoursPerDay > 0)) continue;
    const count = it.count ?? 1;
    const wh = it.watts * count * it.hoursPerDay;
    const whole = Math.floor(it.hoursPerDay);
    const frac = it.hoursPerDay - whole;
    const n = whole + (frac > 0 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const h = (((Math.round(it.startHour) + k) % 24) + 24) % 24;
      const share = k < whole ? 1 : frac;
      day[h] += (wh * share) / it.hoursPerDay;
    }
  }
  return day;
}

/** Expand a 24 h profile across the full e1kw series length. */
export function expandProfile(profile24, totalHours) {
  const out = new Float64Array(totalHours);
  for (let i = 0; i < totalHours; i++) out[i] = profile24[i % 24];
  return out;
}

// ── Battery simulation (hourly SOC) ─────────────────────────────────────────

/**
 * R-UC-04: the emergency reserve is a hard floor on daily cycling. 0 is the
 * historical behaviour, so every existing payload is bit-identical when it is
 * off, and it is capped: a reserve can never be the whole bank, because past
 * 90% the savings cases stop having any energy left to trade and a bill cut
 * computed from a bank that cannot function is not a bill cut.
 *
 * Lives ABOVE simulate's own doc block on purpose: a helper wedged between a
 * JSDoc and its function silently inherits that function's declared return
 * type, which is how a floor came out typed as a simulation result.
 */
export function clampReserveFloor(reserveFloor) {
  if (!Number.isFinite(reserveFloor) || reserveFloor <= 0) return 0;
  return Math.min(0.9, reserveFloor);
}

/**
 * ONE discharge loop, shared by simulateOutage and both simulatePortable runs.
 *
 * These were three hand-written copies of the same hour-by-hour arithmetic and
 * they had already drifted: the outage loop computed discharge from `soc`
 * alone while the portable ones subtracted the reserve floor. Two different
 * answers to "how much is available right now" from one physics file is
 * exactly the class of defect the single-owner rule exists to stop, so the
 * loop lives here once and `reserveFloor` is the same on all three paths.
 *
 * Returns the state it stopped in, so the caller decides what a shortfall
 * means (`breakEven: false` stops at the first unmet hour, which is how
 * "how long did it last" is measured; `breakEven: true` lets a caller run a
 * whole window and report only whether it survived).
 */
/**
 * ONE discharge loop, three callers \u2014 and the floor is a CALLER's decision.
 *
 * `floor` is the share of the bank the owner refuses to spend. It is a
 * parameter, not a property of this loop, because the three callers genuinely
 * disagree and the disagreement is the physics:
 *
 *   - the portable day model holds the floor. A station parked in a field
 *     keeps its reserve; there is no grid coming back.
 *   - simulateOutage passes 0. R-UC-04: the reserve is released exactly when
 *     the grid is gone, which is the entire reason to hold one. Folding the
 *     floor in here "for consistency" silently deleted that behaviour, and
 *     tests/usecases.test.mjs caught it: a 3 kWh bank started at 20% covered
 *     nothing at all.
 *
 * Extract this loop and the floor has to stay a parameter. A shared helper
 * that hides a caller-specific rule is not a dedup.
 */
function runDischarge({
  soc,
  floor,
  cap,
  eta,
  chem,
  e1kw,
  loadWh,
  tempsC,
  pvKw,
  fromIndex,
  hours,
  wrap,
  unmetThresholdWh,
}) {
  const n = e1kw.length;
  let cur = soc;
  let runHours = 0;
  let unmetWh = 0;
  for (let h = 0; h < hours; h++) {
    const i = wrap ? (fromIndex + h) % n : fromIndex + h;
    const load = loadWh[i];
    const pvAc = pvKw * e1kw[i] * ETA_INVERTER;
    const direct = Math.min(pvAc, load);
    const surplus = pvAc - direct;
    const deficit = load - direct;
    const tooCold = tempsC ? tempsC[i] < chem.chargeMinC : false;
    if (surplus > 0 && !tooCold) {
      const charged = Math.min(surplus * eta, Math.max(0, cap - cur * cap));
      cur += charged / cap;
    }
    if (deficit > 0) {
      const available = Math.max(0, (cur - floor) * cap * eta);
      const coveredAc = Math.min(deficit, available);
      cur = Math.max(floor, cur - coveredAc / eta / cap);
      const shortfall = deficit - coveredAc;
      if (shortfall > unmetThresholdWh) {
        unmetWh += shortfall;
        return { soc: cur, runHours, shortfall: true, unmetWh };
      }
    }
    runHours++;
  }
  return { soc: cur, runHours, shortfall: false, unmetWh };
}

/**
 * Simulate state of charge hour by hour across the full series.
 * Energy bookkeeping is AC-side: surplus AC charges the battery via
 * sqrt(RTE); the battery serves deficits via sqrt(RTE) as well.
 * Charging is blocked when ambient temp is below the chemistry's
 * chargeMinC (the cold-charge reality that sizes heated enclosures).
 *
 * @returns {{servedWh:number, unmetWh:number, unmetHours:number,
 *            unmetHoursByYear:Array<number>, worstYearUnmetHours:number,
 *            longestGapHours:number, cyclesEquivalent:number,
 *            finalSoc:number, minSoc:number, socSeries:Float64Array|null}}
 */
export function simulate({
  pvKw,
  battKwhUsable,
  e1kw,
  loadWh,
  chemistry = "lfp",
  startSoc = 0.5,
  tempsC = null,
  capture = false,
  capacityScale = null,
  unmetThresholdWh = 1,
  reserveFloor = 0,
}) {
  const chem = CHEMISTRIES[chemistry] || CHEMISTRIES.lfp;
  const eta = Math.sqrt(chem.roundTrip);
  // Delivered-capacity factor: rate loss (usableScale) by default, or the
  // caller's rate×cold product when provided (the worker always provides it).
  const cap = battKwhUsable * 1000 * (capacityScale ?? chem.usableScale ?? 1); // Wh
  if (cap <= 0) throw new Error("battery capacity must be > 0");
  // R-UC-04: the emergency reserve is a hard floor on daily cycling. It is
  // charged like any other energy, it is simply not spendable while the grid
  // is up; only simulateOutage (an actual outage) releases it. 0 is the
  // historical behaviour, so every existing payload is bit-identical.
  const floor = clampReserveFloor(reserveFloor);

  let soc = startSoc;
  let served = 0,
    unmet = 0,
    unmetHours = 0,
    gap = 0,
    longestGap = 0;
  let throughputDc = 0,
    minSoc = soc;
  const n = e1kw.length;
  const loadN = loadWh.length;
  if (loadN !== n) throw new Error("load series must match e1kw length");
  const socSeries = capture ? new Float64Array(n) : null;
  // Per-calendar-year unmet hours: reliability budgets are per-year ("87.6
  // h/yr"), so the constraint must bind the WORST year, not the average — one
  // 400-hour year plus four clean ones must not pass a 99% tier.
  const yearCount = Math.max(1, Math.ceil(n / 8760));
  const unmetHoursByYear = new Array(yearCount).fill(0);

  for (let i = 0; i < n; i++) {
    const pvAc = pvKw * e1kw[i] * ETA_INVERTER;
    const load = loadWh[i];
    const direct = Math.min(pvAc, load);
    served += direct;
    const surplus = pvAc - direct;
    const deficit = load - direct;

    // charge (blocked when too cold for this chemistry)
    let charged = 0;
    const tooCold = tempsC ? tempsC[i] < chem.chargeMinC : false;
    if (surplus > 0 && !tooCold) {
      const room = cap - soc * cap;
      charged = Math.min(surplus * eta, room);
      soc += charged / cap;
      throughputDc += charged;
    }

    // discharge
    if (deficit > 0) {
      const availableAc = Math.max(0, (soc - floor) * cap * eta);
      const covered = Math.min(deficit, availableAc);
      soc -= covered / eta / cap;
      throughputDc += covered / eta;
      served += covered;
      const short = deficit - covered;
      unmet += short;
      if (short > unmetThresholdWh) {
        unmetHours += 1;
        unmetHoursByYear[Math.min(yearCount - 1, Math.floor(i / 8760))] += 1;
        gap += 1;
        if (gap > longestGap) longestGap = gap;
      } else {
        gap = 0;
      }
    } else {
      gap = 0;
    }

    if (capture) socSeries[i] = soc;
    if (soc < minSoc) minSoc = soc;
  }

  return {
    servedWh: served,
    unmetWh: unmet,
    unmetHours,
    unmetHoursByYear,
    worstYearUnmetHours: Math.max(...unmetHoursByYear),
    longestGapHours: longestGap,
    cyclesEquivalent: throughputDc / cap, // full-equivalent cycles over the period
    finalSoc: soc,
    minSoc,
    socSeries,
  };
}

/**
 * Lowest and highest state of charge reached on each calendar day (data is
 * Local Solar Time, so every 24 consecutive samples is one day from midnight).
 * The pair gives the FULL daily range of use: max shows the battery charging
 * back to full, min shows how deep bad weather digs into the reserve.
 * @returns {{min:Float64Array, max:Float64Array}} length ceil(n/24)
 */
export function dailyExtremes(series) {
  const n = Math.ceil(series.length / 24);
  const min = new Float64Array(n);
  const max = new Float64Array(n);
  for (let d = 0; d < n; d++) {
    const s = d * 24;
    const e = Math.min(series.length, s + 24);
    let lo = Infinity,
      hi = -Infinity;
    for (let i = s; i < e; i++) {
      if (series[i] < lo) lo = series[i];
      if (series[i] > hi) hi = series[i];
    }
    min[d] = lo;
    max[d] = hi;
  }
  return { min, max };
}

/**
 * Reduce an hourly series to a min/max envelope of `buckets` buckets.
 * Plotting the envelope (rather than sampled points) preserves every dip
 * and spike — essential for honest reliability charts.
 * @returns {Array<{lo:number, hi:number}>}
 */
export function downsampleEnvelope(series, buckets) {
  const n = series.length;
  const out = [];
  const size = n / buckets;
  for (let b = 0; b < buckets; b++) {
    const s = Math.floor(b * size);
    let e = Math.floor((b + 1) * size);
    if (e <= s) e = s + 1;
    if (e > n) e = n;
    let lo = Infinity,
      hi = -Infinity;
    for (let i = s; i < e; i++) {
      const v = series[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    out.push({ lo, hi });
  }
  return out;
}

// ── Oversizing vs. Swaps Optimization ───────────────────────────────────────

/**
 * Evaluates whether oversizing a battery to eliminate replacements over a 20-year
 * horizon provides a lower total lifetime cost than a smaller bank that incurs swaps and labor.
 *
 * @returns {{
 *   useOversized: boolean,
 *   oversizeScenario: "oversized_cheaper" | "swaps_cheaper" | "zero_swap_natural",
 *   oversizedBattKwh: number,
 *   oversizeSavingsUsd: number,
 *   bestPriceCallout: string
 * }}
 */
export function evaluateOversizeOptimization({
  pvKw = 0,
  battKwh = 0,
  sizingResult = null,
  chemistry = "lfp",
  years = 1,
  costPerWpv = 0.35,
  costPerKwhBatt = 140,
  costPerKwInv = 0,
  laborPerKwh = [12, 30],
  invMinKw = 0,
}) {
  // Inverter is costed on the load peak (never below the array): battery-only
  // and small-array/spiky-load systems still buy a real inverter.
  const chem = CHEMISTRIES[chemistry] || CHEMISTRIES.lfp;
  if (!battKwh || battKwh <= 0 || !sizingResult) {
    return {
      useOversized: false,
      oversizeScenario: "zero_swap_natural",
      oversizedBattKwh: 0,
      oversizeSavingsUsd: 0,
      bestPriceCallout:
        "Best 20-year price: solar-only setup has zero battery swap or degradation costs.",
    };
  }

  const cyclesPerYear = sizingResult.cyclesEquivalent / years;
  const replacements = batteryReplacements(cyclesPerYear, chem.cyclesTo80);
  const capexStandard =
    pvKw * 1000 * costPerWpv +
    Math.max(pvKw, invMinKw) * costPerKwInv +
    battKwh * costPerKwhBatt;
  const lifeStandard = lifetimeCostUsd({
    capexMidUsd: capexStandard,
    battKwhUsable: battKwh,
    battPriceMidPerKwh: costPerKwhBatt,
    replacements,
    laborPerKwh,
  });

  if (replacements === 0) {
    return {
      useOversized: false,
      oversizeScenario: "zero_swap_natural",
      oversizedBattKwh: battKwh,
      oversizeSavingsUsd: 0,
      bestPriceCallout:
        "Best 20-year price: battery bank naturally outlasts the 20-year horizon with zero replacements.",
    };
  }

  // To achieve 0 replacements, batteryLifeYears >= 20 => cyclesPerYear <= cyclesTo80 / 20.
  const annualThroughputDc = cyclesPerYear * battKwh;
  const maxCyclesForZeroSwap = chem.cyclesTo80 / 20;
  const targetBattKwh = Math.max(
    battKwh + 1,
    Math.ceil(annualThroughputDc / maxCyclesForZeroSwap),
  );

  const capexOversized =
    pvKw * 1000 * costPerWpv +
    Math.max(pvKw, invMinKw) * costPerKwInv +
    targetBattKwh * costPerKwhBatt;
  const lifeOversized = lifetimeCostUsd({
    capexMidUsd: capexOversized,
    battKwhUsable: targetBattKwh,
    battPriceMidPerKwh: costPerKwhBatt,
    replacements: 0,
    laborPerKwh,
  });

  if (lifeOversized.total < lifeStandard.total) {
    const savings = lifeStandard.total - lifeOversized.total;
    return {
      useOversized: true,
      oversizeScenario: "oversized_cheaper",
      oversizedBattKwh: targetBattKwh,
      oversizeSavingsUsd: savings,
      bestPriceCallout: oversizeCallout("oversized_cheaper", {
        battKwh: targetBattKwh,
        savingsUsd: savings,
      }),
    };
  } else {
    const savings = lifeOversized.total - lifeStandard.total;
    return {
      useOversized: false,
      oversizeScenario: "swaps_cheaper",
      oversizedBattKwh: targetBattKwh,
      oversizeSavingsUsd: savings,
      bestPriceCallout: oversizeCallout("swaps_cheaper", {
        replacements,
        savingsUsd: savings,
      }),
    };
  }
}

// #155: the no-swap UI option. Builds the oversize-result stand-in used when
// the oversize/swap strategy is disabled: no evaluation, no adoption — the
// engine's direct pick, labeled so results are distinguishable in both modes.
function strategyOffOpt(best, chemistry, years) {
  const cyclesPerYear = best.result.cyclesEquivalent / years;
  const replacements = batteryReplacements(
    cyclesPerYear,
    CHEMISTRIES[chemistry].cyclesTo80,
  );
  return {
    useOversized: false,
    oversizeScenario: "strategy_off",
    oversizedBattKwh: best.battKwh,
    oversizeSavingsUsd: 0,
    bestPriceCallout:
      replacements > 0
        ? `Oversize strategy off: the engine's direct pick — ${replacements} bank swap(s) over 20 years are counted in the lifetime cost.`
        : `Oversize strategy off: the engine's direct pick — the bank already lasts the full 20-year horizon with zero swaps.`,
  };
}

// ── Tier sizing search ──────────────────────────────────────────────────────

/**
 * Find minimum-cost (pvKw, battKwh) meeting a reliability constraint.
 * Coarse lattice scan + local refinement. Constraint: average unmet hours
 * per year must be <= maxUnmetHoursPerYear (0 => zero across all years).
 *
 * @returns {{pvKw:number, battKwh:number, result:object, cost:number} | null}
 */
export function sizeForTier({
  e1kw,
  loadWh,
  tempsC = null,
  chemistry = "lfp",
  maxUnmetHoursPerYear,
  years = 1,
  costPerWpv = 0.35,
  costPerKwhBatt = 140,
  costPerKwInv = 0,
  pvMax = 30,
  battMax = 200,
  pvStep = 0.5,
  battStep = 1,
  capacityScale = null,
  laborPerKwh,
  invMinKw = 0,
  // #155: the battery-oversize swap strategy. When true (default), the
  // engine evaluates a verified-cheaper oversized bank and adopts it;
  // when false, the engine returns its direct pick (swaps included) with
  // no oversize adoption. Default preserves existing behavior.
  oversizeStrategy = true,
}) {
  // The strictest tier ("100% — no generator") uses a fine shortfall
  // threshold (0.1 Wh): at a zero-hour budget, sub-1-Wh shortfalls must not
  // pass silently. The half-full start is retained — banks are commissioned
  // charged, and the binding constraint is the worst dark stretch mid-series,
  // which the per-year accounting below already judges strictly.
  const strict = maxUnmetHoursPerYear <= 0;
  const evaluate = (pv, batt) => {
    const r = simulate({
      pvKw: pv,
      battKwhUsable: batt,
      e1kw,
      loadWh,
      chemistry,
      tempsC,
      capacityScale,
      unmetThresholdWh: strict ? 0.1 : 1,
    });
    return { worstYear: r.worstYearUnmetHours, r };
  };
  const meets = (ev) => ev.worstYear <= maxUnmetHoursPerYear + 1e-9;

  // Lifetime-cost objective: among banks meeting reliability, pick the one
  // whose TRUE cost over the horizon is lowest — capex plus every bank swap
  // and its install labor. Includes inverter cost (PV-driven) so search isn't
  // biased low by ~$90/kW.
  //
  // Empty envelope guard: pvMax <= 0 is battery-only (the run.js envelope
  // signals this for off-grid battery-only). Nothing recharges the bank;
  // bail rather than run a degenerate inner loop that probes the inverter
  // minimum. The caller (run.js) maps this to a structural "needs-panels"
  // reason.
  if (pvMax <= 0 || battMax <= 0) return null;
  const lifetimeObjective = (p, b, r) => {
    const cyclesPerYear = r.cyclesEquivalent / years;
    const replacements = batteryReplacements(
      cyclesPerYear,
      CHEMISTRIES[chemistry].cyclesTo80,
    );
    const life = lifetimeCostUsd({
      capexMidUsd:
        p * 1000 * costPerWpv +
        Math.max(p, invMinKw) * costPerKwInv +
        b * costPerKwhBatt,
      battKwhUsable: b,
      battPriceMidPerKwh: costPerKwhBatt,
      replacements,
      laborPerKwh,
    });
    return { total: life.total, replacements };
  };

  let best = null,
    bestBatt = null,
    bestObj = Infinity;
  for (let b = battStep; b <= battMax; b += battStep) {
    let firstFeasible = null;
    for (let p = pvStep; p <= pvMax; p += pvStep) {
      const ev = evaluate(p, b);
      if (!meets(ev)) continue;
      if (!firstFeasible) firstFeasible = { p, ev };
      // The objective is lifetime cost (capex + swaps + labor), NOT capex:
      // cycling is not monotonic in PV at fixed battery, so a slightly
      // larger array can pay for itself in fewer swaps. Probe above the
      // first feasible PV instead of stopping at it.
      const obj = lifetimeObjective(p, b, ev.r).total;
      if (obj < bestObj) {
        bestObj = obj;
        bestBatt = b;
        best = { pvKw: p, battKwh: b, result: ev.r, obj };
      }
      if (p >= firstFeasible.p + 4 * pvStep) break;
    }
    // Lifetime cost rises again once swaps are exhausted and further
    // oversizing only adds capex; stop a bounded window past the optimum.
    if (bestBatt !== null && b >= bestBatt + 15 * battStep) break;
  }

  if (!best) return null;

  // Refinement: try to shave PV and battery around the coarse optimum.
  let improved = true;
  while (improved) {
    improved = false;
    for (const dp of [-pvStep, 0, pvStep]) {
      for (const db of [-battStep, 0, battStep]) {
        const p = best.pvKw + dp,
          b = best.battKwh + db;
        if (p <= 0 || b <= 0) continue;
        const ev = evaluate(p, b);
        if (!meets(ev)) continue;
        const obj = lifetimeObjective(p, b, ev.r).total;
        if (obj < best.obj - 1e-9) {
          best = { pvKw: p, battKwh: b, result: ev.r, obj };
          improved = true;
        }
      }
    }
  }

  // #155: with the strategy off there is no oversize evaluation or
  // adoption — the engine returns its direct pick (swaps included).
  const opt = oversizeStrategy
    ? evaluateOversizeOptimization({
        pvKw: best.pvKw,
        battKwh: best.battKwh,
        sizingResult: best.result,
        chemistry,
        years,
        costPerWpv,
        costPerKwhBatt,
        costPerKwInv,
        laborPerKwh,
        invMinKw,
      })
    : strategyOffOpt(best, chemistry, years);
  if (
    oversizeStrategy &&
    opt.useOversized &&
    opt.oversizedBattKwh > best.battKwh
  ) {
    // Verify zero-swap on a fresh simulation instead of assuming it
    // (throughput shifts with bank size), growing the bank within the
    // envelope until replacements truly hit zero. Then re-optimize PV
    // downward: a bigger bank usually needs a smaller array.
    let t = opt.oversizedBattKwh;
    let adopted = null;
    for (let guard = 0; guard < 6 && t <= battMax; guard++) {
      const ev = evaluate(best.pvKw, t);
      if (!meets(ev)) break;
      const cpy = ev.r.cyclesEquivalent / years;
      if (batteryReplacements(cpy, CHEMISTRIES[chemistry].cyclesTo80) === 0) {
        adopted = { t, ev };
        break;
      }
      t = Math.min(battMax + battStep, Math.ceil(t * 1.25));
    }
    if (adopted) {
      let adopPv = best.pvKw,
        adopEv = adopted.ev;
      for (let p = best.pvKw - pvStep; p >= pvStep; p -= pvStep) {
        const ev = evaluate(p, adopted.t);
        if (!meets(ev)) break;
        adopPv = p;
        adopEv = ev;
      }
      const obj = lifetimeObjective(adopPv, adopted.t, adopEv.r).total;
      if (obj < best.obj) {
        // The note must name the bank actually adopted (verified size after
        // growth + PV re-optimization) and the saving on the same basis that
        // chose it — never the pre-verification estimate.
        const prevObj = best.obj;
        best = { pvKw: adopPv, battKwh: adopted.t, result: adopEv.r, obj };
        opt.oversizedBattKwh = adopted.t;
        opt.oversizeSavingsUsd = prevObj - obj;
        opt.bestPriceCallout = oversizeCallout("oversized_cheaper", {
          battKwh: adopted.t,
          savingsUsd: prevObj - obj,
        });
      } else {
        // Verified on a fresh simulation, the oversized bank is NOT cheaper
        // (throughput shifts with bank size, so the pre-verification estimate
        // can be wrong): fall back to swaps_cheaper so the scenario note can
        // never recommend a system the numbers don't show.
        opt.useOversized = false;
        opt.oversizeScenario = "swaps_cheaper";
        opt.oversizeSavingsUsd = obj - best.obj;
        opt.bestPriceCallout = `Best 20-year price: standard sizing with battery replacements is cheaper over 20 years than paying upfront to oversize.`;
      }
    } else {
      // Zero-swap is unreachable inside the searched envelope (the estimate
      // points beyond battMax): the oversized bank can't be built, so the
      // note must not advertise it.
      opt.useOversized = false;
      opt.oversizeScenario = "swaps_cheaper";
      opt.oversizeSavingsUsd = 0;
      opt.bestPriceCallout = `Best 20-year price: standard sizing with battery replacements is the practical pick — a zero-swap bank is beyond the sizes this tool searches.`;
    }
  }
  best.oversizeScenario = opt.oversizeScenario;
  best.bestPriceCallout = opt.bestPriceCallout;
  best.oversizeSavingsUsd = opt.oversizeSavingsUsd;
  best.oversizedBattKwh = opt.oversizedBattKwh;

  return best;
}

/**
 * Size all tiers at once. Returns array aligned with RELIABILITY_TIERS order.
 */
export function sizeAllTiers(opts) {
  return RELIABILITY_TIERS.map((t) => {
    const best = sizeForTier({
      ...opts,
      maxUnmetHoursPerYear: t.maxUnmetHoursPerYear,
    });
    return { tier: t, sizing: best };
  });
}

// Battery-only (no-PV) time-of-use window: evening peak the bank discharges
// into. Shared by the simulator, the bill-cut search, and the frontier so the
// peak-offset metric can never disagree between views.
export const PEAK_HOUR_START = 16;
export const PEAK_HOUR_END = 21; // exclusive
function isPeakHour(hourOfDay) {
  return hourOfDay >= PEAK_HOUR_START && hourOfDay < PEAK_HOUR_END;
}

// ── Grid-connected mode: bill reduction without exporting ───────────────────

export const BILL_TARGETS = [
  { id: "cut60", label: "Cut ~60% of your bill", minFraction: 0.6 },
  { id: "cut80", label: "Cut ~80% of your bill", minFraction: 0.8 },
  { id: "cut95", label: "Cut ~95% of your bill", minFraction: 0.95 },
];

/**
 * One definition of "bill cut" shared by the search constraint, the curve
 * outcome, the cards and the table — so a % can never disagree between
 * views. Without a feed-in credit it is pure self-sufficiency
 * (1 − imports/load). With a credit it is net-metered: imports billed at
 * the tariff, clipped surplus credited at the feed-in rate. At 1:1
 * (exportRate == tariff) a big solar-only array can therefore zero any bill
 * given enough roof — capping it at the daytime fraction would be the
 * import-only fallacy this helper exists to prevent.
 */
export function billCutFraction({
  importedWh,
  curtailedWh = 0,
  loadTotalWh,
  tariff = null,
  exportRate = null,
}) {
  if (!(loadTotalWh > 0)) return 0;
  if (tariff !== null && tariff > 0 && exportRate !== null && exportRate > 0) {
    return (
      1 -
      (importedWh * tariff - curtailedWh * exportRate) / (loadTotalWh * tariff)
    );
  }
  return 1 - importedWh / loadTotalWh;
}

// ── Structural feasibility ──────────────────────────────────────────────
//
// Some (mode, hardware, target) combinations cannot physically work at any
// site or load, no matter the envelope. Name them so callers can explain
// the dead end instead of showing a generic "beyond the searched envelope"
// message. Returns a reason code, or null when the combination is arguably
// solvable (the search decides).
//
//   offgrid + solar-only  → nights are always unmet (thousands of hours a
//                           year vs a 438 h/yr allowance at the loosest tier)
//   offgrid + battery-only → nothing ever recharges the bank (the tier search
//                           has no PV-free path, so the envelope is empty)
//   gridtie + battery-only, cut > 100% → a peak-offset fraction can never
//                           exceed 1, and surplus needs panels
export function infeasibleReason({ mode, hardwareConfig, minFraction = null }) {
  if (mode === "offgrid" && hardwareConfig === "solar") return "needs-battery";
  if (mode === "offgrid" && hardwareConfig === "battery") return "needs-panels";
  if (
    mode === "gridtie" &&
    hardwareConfig === "battery" &&
    Number.isFinite(minFraction) &&
    minFraction > 1
  )
    return "needs-pv-surplus";
  return null;
}

/**
 * Hourly simulation of a grid-connected home that does NOT export:
 *   PV serves the load directly; surplus charges the battery (clipped when
 *   the bank is full or too cold); deficits draw from the battery first and
 *   the grid covers whatever remains. The battery never pushes power out.
 *
 * @returns {{directWh:number, battWhAc:number, importedWh:number,
 *            curtailedWh:number, peakLoadWh:number, peakImportedWh:number,
 *            peakOffsetFraction:number, cyclesEquivalent:number,
 *            finalSoc:number, minSoc:number, socSeries:Float64Array|null}}
 *          NOTE: this declared type used to stop after `importedWh:number`,
 *          which is why `curtailedWh` and the peak-window fields already
 *          errored at every call site. The whole return shape is listed now so
 *          a caller can read every field the function actually hands back.
 */
export function simulateOffset({
  pvKw,
  battKwhUsable,
  e1kw,
  loadWh,
  chemistry = "lfp",
  startSoc = 0.5,
  tempsC = null,
  capacityScale = null,
  capture = false,
  reserveFloor = 0,
}) {
  const chem = CHEMISTRIES[chemistry] || CHEMISTRIES.lfp;
  const eta = Math.sqrt(chem.roundTrip);
  const cap =
    Math.max(0, battKwhUsable) *
    1000 *
    (capacityScale ?? chem.usableScale ?? 1);
  const floor = clampReserveFloor(reserveFloor);

  let soc = startSoc;
  let direct = 0,
    fromBatt = 0,
    imported = 0,
    curtailed = 0;
  let peakImported = 0,
    peakLoad = 0;
  let throughputDc = 0,
    minSoc = cap > 0 ? soc : 0;
  const n = e1kw.length;
  if (loadWh.length !== n)
    throw new Error("load series must match e1kw length");
  const socSeries = capture ? new Float64Array(n) : null;

  const isBatteryOnly = (pvKw <= 0 || !Number.isFinite(pvKw)) && cap > 0;

  for (let i = 0; i < n; i++) {
    const load = loadWh[i];
    if (isBatteryOnly) {
      const hourOfDay = i % 24;
      const peak = isPeakHour(hourOfDay);
      if (peak) peakLoad += load;
      if (!peak && soc < 1.0 && !(tempsC && tempsC[i] < chem.chargeMinC)) {
        const room = cap - soc * cap;
        const maxChargeWh = cap / 4;
        const charged = Math.min(maxChargeWh * eta, room);
        soc += charged / cap;
        throughputDc += charged;
        // Off-peak grid charging is metered: the AC drawn from the grid is
        // the DC stored divided by charge efficiency (previously uncounted,
        // which made peak-shaving look like free energy).
        imported += load + charged / eta;
      } else if (peak && soc > floor) {
        const availableAc = (soc - floor) * cap * eta;
        const covered = Math.min(load, availableAc);
        soc -= covered / eta / cap;
        throughputDc += covered / eta;
        fromBatt += covered;
        const imp = Math.max(0, load - covered);
        imported += imp;
        peakImported += imp;
      } else {
        imported += load;
        if (peak) peakImported += load;
      }
      if (capture && cap > 0) socSeries[i] = soc;
      if (cap > 0 && soc < minSoc) minSoc = soc;
      continue;
    }

    const pvAc = pvKw * e1kw[i] * ETA_INVERTER;
    const d = Math.min(pvAc, load);
    direct += d;
    const surplus = pvAc - d;
    const deficit = load - d;

    // charge from surplus only (no grid charging, no export)
    if (cap > 0 && surplus > 0 && !(tempsC && tempsC[i] < chem.chargeMinC)) {
      const room = cap - soc * cap;
      const charged = Math.min(surplus * eta, room);
      curtailed += surplus - charged / eta;
      soc += charged / cap;
      throughputDc += charged;
    } else if (surplus > 0) {
      curtailed += surplus;
    }

    // deficit: battery first, grid picks up the rest
    if (deficit > 0 && cap > 0) {
      const availableAc = Math.max(0, (soc - floor) * cap * eta);
      const covered = Math.min(deficit, availableAc);
      soc -= covered / eta / cap;
      throughputDc += covered / eta;
      fromBatt += covered;
      imported += deficit - covered;
    } else {
      imported += deficit;
    }

    if (capture && cap > 0) socSeries[i] = soc;
    if (cap > 0 && soc < minSoc) minSoc = soc;
  }

  return {
    directWh: direct,
    battWhAc: fromBatt,
    importedWh: imported,
    curtailedWh: curtailed,
    // Evening-peak window accounting (battery-only ToU shifting): the peak
    // load and how much of it still came from the grid. For PV+battery
    // systems these are zero and the total-import metric applies instead.
    peakLoadWh: peakLoad,
    peakImportedWh: peakImported,
    peakOffsetFraction:
      peakLoad > 0 ? Math.max(0, 1 - peakImported / peakLoad) : 0,
    cyclesEquivalent: cap > 0 ? throughputDc / cap : 0,
    finalSoc: soc,
    minSoc: cap > 0 ? minSoc : 0,
    socSeries,
  };
}

/**
 * Find minimum-cost (pvKw, battKwh >= 0) whose average imported energy stays
 * under (1 - minFraction) of total load — net-metered when a feed-in credit
 * is entered (see billCutFraction), so a 1:1 credit lets solar-only reach
 * 100%. Imports are monotonically non-increasing in PV for a fixed battery
 * (extra PV can only serve load, fill the bank, or clip), so each battery
 * row binary-searches its smallest sufficient PV — far fewer simulations
 * than a full lattice scan. Net bill value is likewise monotonic in PV
 * (more array can only displace imports or add credited surplus), so the
 * same search shape holds with credits.
 *
 * @returns {{pvKw:number, battKwh:number, result:object, cost:number} | null}
 */
export function sizeForBillCut({
  e1kw,
  loadWh,
  tempsC = null,
  chemistry = "lfp",
  minFraction = 0.8,
  tariff = null,
  exportRate = null,
  years = 1,
  costPerWpv = 0.35,
  costPerKwhBatt = 140,
  costPerKwInv = 0,
  pvMax = 30,
  battMax = 100,
  battStep = 1,
  capacityScale = null,
  laborPerKwh,
  invMinKw = 0,
  // #155: the battery-oversize swap strategy. When true (default), the
  // engine evaluates a verified-cheaper oversized bank and adopts it;
  // when false, the engine returns its direct pick (swaps included) with
  // no oversize adoption. Default preserves existing behavior.
  oversizeStrategy = true,
  // Injected by run.js to share one bounded exact-key sims memo across a
  // run's searches and the slider's re-slices; default = the pure simulation.
  simulate = simulateOffset,
}) {
  const f = Number(minFraction);
  if (!Number.isFinite(f) || f < 0.01 || f > 1.5) {
    throw new RangeError(
      `minFraction must be within [0.01, 1.5] (a 1% to 150% bill cut); got ${minFraction}`,
    );
  }
  const loadTotal = [...loadWh].reduce((a, b) => a + b, 0);
  // Battery-only (pvMax === 0): there is no PV, so total imports can never
  // fall — charging losses always add. The honest target is the evening-peak
  // window instead: offset at least minFraction of peak-window energy. The
  // 10/15/20% battery targets are named as peak cuts, so the fraction applies
  // directly to peak load (no share conversion needed).
  const peakOnly = pvMax === 0;
  // Above 100% the visitor wants to PRODUCE more than the load consumes and
  // sell/track the surplus. With a feed-in credit the constraint is simply
  // the net-metered cut (bill gone AND surplus value cover the rest) — a
  // solar-only array qualifies on credits alone. Without a credit the
  // constraint stays physical: the bill must be ~fully covered AND at least
  // (f-1) of annual load produced as surplus, since clipped waste has no
  // cash value. A mere sliver of clipped PV while still importing is not a
  // >100% cut under either rule, so both conditions must hold there. A
  // battery only absorbs surplus and adds cost against that goal, but the
  // search below stays fully general and lets the cost objective decide.
  const hasCredit =
    tariff !== null && tariff > 0 && exportRate !== null && exportRate > 0;
  const cutOf = (r) =>
    billCutFraction({
      importedWh: r.importedWh,
      curtailedWh: r.curtailedWh,
      loadTotalWh: loadTotal,
      tariff,
      exportRate,
    });
  const surplusTarget = f > 1;
  const importBudget = surplusTarget ? loadTotal * 0.005 : loadTotal * (1 - f);
  const evaluate = (pv, batt) =>
    simulate({
      pvKw: pv,
      battKwhUsable: batt,
      e1kw,
      loadWh,
      chemistry,
      tempsC,
      capacityScale,
    });
  const meets = peakOnly
    ? (r) => r.peakOffsetFraction + 1e-9 >= f
    : surplusTarget && !hasCredit
      ? (r) =>
          r.importedWh <= importBudget + 1e-6 &&
          r.curtailedWh >= loadTotal * (f - 1) - 1e-6
      : (r) => cutOf(r) + 1e-9 >= f;

  // Lifetime-cost objective: among systems meeting the bill-cut target, pick
  // the one whose TRUE cost over the horizon is lowest (capex plus every bank
  // swap and its install labor), so banks are sized to reach the horizon.
  // Includes inverter cost so PV-heavy solutions aren't underpriced.
  const lifetimeObjective = (p, b, r) => {
    const cyclesPerYear = r.cyclesEquivalent / years;
    const replacements = batteryReplacements(
      cyclesPerYear,
      CHEMISTRIES[chemistry].cyclesTo80,
    );
    const life = lifetimeCostUsd({
      capexMidUsd:
        p * 1000 * costPerWpv +
        Math.max(p, invMinKw) * costPerKwInv +
        b * costPerKwhBatt,
      battKwhUsable: b,
      battPriceMidPerKwh: costPerKwhBatt,
      replacements,
      laborPerKwh,
    });
    return { total: life.total, replacements };
  };

  let best = null;
  for (let b = 0; b <= battMax; b += battStep) {
    if (pvMax === 0) {
      const r = evaluate(0, b);
      if (!meets(r)) continue;
      const obj = lifetimeObjective(0, b, r).total;
      if (!best || obj < best.obj)
        best = { pvKw: 0, battKwh: b, result: r, obj };
      continue;
    }
    // No lower-bound shortcut: the required PV for a bigger bank is only
    // bounded ABOVE by the previous row's answer, never below, so every row
    // searches from 0.05 (a stale floor previously oversized PV by whole kWs
    // whenever adjacent rows differed by more than the 1 kW slack).
    const pvFloor = 0.05;
    let lo = pvFloor,
      hi = pvMax;
    if (!meets(evaluate(hi, b))) continue;
    while (hi - lo > 0.25) {
      const mid = (lo + hi) / 2;
      if (meets(evaluate(mid, b))) hi = mid;
      else lo = mid;
    }
    const r = evaluate(hi, b);
    const obj = lifetimeObjective(hi, b, r).total;
    if (!best || obj < best.obj)
      best = { pvKw: +hi.toFixed(2), battKwh: b, result: r, obj };
  }

  if (!best) return null;

  // Local refinement around the coarse winner.
  let improved = true;
  while (improved) {
    improved = false;
    for (const db of [-battStep, 0, battStep]) {
      const b = best.battKwh + db;
      if (b < 0) continue;
      if (pvMax === 0) {
        const r = evaluate(0, b);
        if (!meets(r)) continue;
        const obj = lifetimeObjective(0, b, r).total;
        if (obj < best.obj - 1e-9) {
          best = { pvKw: 0, battKwh: b, result: r, obj };
          improved = true;
        }
        continue;
      }
      let lo = 0.05,
        hi = Math.min(pvMax, best.pvKw + 2);
      if (!meets(evaluate(hi, b))) continue;
      while (hi - lo > 0.25) {
        const mid = (lo + hi) / 2;
        if (meets(evaluate(mid, b))) hi = mid;
        else lo = mid;
      }
      const r = evaluate(hi, b);
      const obj = lifetimeObjective(hi, b, r).total;
      if (obj < best.obj - 1e-9) {
        best = { pvKw: +hi.toFixed(2), battKwh: b, result: r, obj };
        improved = true;
      }
    }
  }

  // #155: with the strategy off there is no oversize evaluation or
  // adoption — the engine returns its direct pick (swaps included).
  const opt = oversizeStrategy
    ? evaluateOversizeOptimization({
        pvKw: best.pvKw,
        battKwh: best.battKwh,
        sizingResult: best.result,
        chemistry,
        years,
        costPerWpv,
        costPerKwhBatt,
        costPerKwInv,
        laborPerKwh,
        invMinKw,
      })
    : strategyOffOpt(best, chemistry, years);
  if (
    oversizeStrategy &&
    opt.useOversized &&
    opt.oversizedBattKwh > best.battKwh
  ) {
    // Verify zero-swap on a fresh simulation (throughput shifts with bank
    // size), growing within the envelope until replacements truly hit zero.
    let b = opt.oversizedBattKwh;
    let verified = false;
    for (let guard = 0; guard < 6 && b <= battMax; guard++) {
      const r = evaluate(pvMax === 0 ? 0 : best.pvKw, b);
      if (!meets(r)) break;
      const cpy = r.cyclesEquivalent / years;
      if (batteryReplacements(cpy, CHEMISTRIES[chemistry].cyclesTo80) === 0) {
        verified = true;
        break;
      }
      b = Math.min(battMax + battStep, Math.ceil(b * 1.25));
    }
    if (!verified) {
      opt.useOversized = false;
      opt.oversizeScenario = "swaps_cheaper";
      opt.bestPriceCallout = `Best 20-year price: standard sizing with battery replacements is cheaper over 20 years than paying upfront to oversize.`;
    } else if (pvMax === 0) {
      const r = evaluate(0, b);
      if (meets(r)) {
        const obj = lifetimeObjective(0, b, r).total;
        if (obj < best.obj - 1e-9) {
          // Name the verified bank and the saving on the deciding basis.
          const prevObj = best.obj;
          best = { pvKw: 0, battKwh: b, result: r, obj };
          opt.oversizedBattKwh = b;
          opt.oversizeSavingsUsd = prevObj - obj;
          opt.bestPriceCallout = oversizeCallout("oversized_cheaper", {
            battKwh: b,
            savingsUsd: prevObj - obj,
          });
        } else {
          opt.useOversized = false;
          opt.oversizeScenario = "swaps_cheaper";
          opt.bestPriceCallout = `Best 20-year price: standard sizing is cheaper over 20 years than paying upfront to oversize.`;
        }
      } else {
        // Verified bank misses the peak-cut target: fall back so the note
        // matches the system actually recommended.
        opt.useOversized = false;
        opt.oversizeScenario = "swaps_cheaper";
        opt.bestPriceCallout = `Best 20-year price: standard sizing with battery replacements is cheaper over 20 years than paying upfront to oversize.`;
      }
    } else {
      let lo = 0.05,
        hi = best.pvKw;
      if (meets(evaluate(hi, b))) {
        while (hi - lo > 0.25) {
          const mid = (lo + hi) / 2;
          if (meets(evaluate(mid, b))) hi = mid;
          else lo = mid;
        }
        const r = evaluate(hi, b);
        const obj = lifetimeObjective(hi, b, r).total;
        if (obj < best.obj - 1e-9) {
          // Name the verified bank and the saving on the deciding basis.
          const prevObj = best.obj;
          best = { pvKw: +hi.toFixed(2), battKwh: b, result: r, obj };
          opt.oversizedBattKwh = b;
          opt.oversizeSavingsUsd = prevObj - obj;
          opt.bestPriceCallout = oversizeCallout("oversized_cheaper", {
            battKwh: b,
            savingsUsd: prevObj - obj,
          });
        } else {
          opt.useOversized = false;
          opt.oversizeScenario = "swaps_cheaper";
          opt.bestPriceCallout = `Best 20-year price: standard sizing with battery replacements is cheaper over 20 years than paying upfront to oversize.`;
        }
      } else {
        // Defensive: the verification loop already proved meets() at
        // (best.pvKw, b), so this branch is unreachable — but if it ever
        // triggers, the note must not advertise an unbuilt system.
        opt.useOversized = false;
        opt.oversizeScenario = "swaps_cheaper";
        opt.bestPriceCallout = `Best 20-year price: standard sizing with battery replacements is cheaper over 20 years than paying upfront to oversize.`;
      }
    }
  }
  best.oversizeScenario = opt.oversizeScenario;
  best.bestPriceCallout = opt.bestPriceCallout;
  best.oversizeSavingsUsd = opt.oversizeSavingsUsd;
  best.oversizedBattKwh = opt.oversizedBattKwh;

  return best;
}

/** Size all bill-cut targets at once, aligned with BILL_TARGETS order. */
export function sizeAllBillTargets(opts) {
  const targets = opts.targets || BILL_TARGETS;
  return targets.map((t) => ({
    target: t,
    sizing: sizeForBillCut({ ...opts, minFraction: t.minFraction }),
  }));
}

// ── Essential-load backup (R-UC-03) ─────────────────────────────────────────
//
// The bill-cut search asks "how much of this load can PV+battery serve with
// the grid up?". Backup asks a different question and needs a different
// model: the grid is GONE, only the essentials matter, and the answer is a
// distribution over when the outage starts, not a single number.
//
// One call, one definition of "covered": for every start hour of the weather
// record the bank is run forward for the target duration with no grid, and
// the start hour counts only if the essentials were met in EVERY hour of it.
//
// The start state of charge is the one the bank ACTUALLY holds at that hour,
// read from a grid-connected run's SOC series (`startSocSeries`), because a
// bank that charged all afternoon is not sitting at the reserve floor at 19:00.
// With no series supplied the bank is assumed FULL, which is the optimistic
// reading — so it is named in `startState` rather than quietly assumed, and a
// caller who wants the pessimistic reading passes `startSoc` explicitly.
// (An empty default would have been both untrue and useless: it makes every
// coverage figure exactly zero regardless of bank size.)
export function simulateOutage({
  battKwhUsable,
  e1kw,
  essentialsWh,
  chemistry = "lfp",
  capacityScale = null,
  tempsC = null,
  reserveFloor = 0,
  targetHours = 6,
  startSoc = null,
  startSocSeries = null,
  pvKw = 0,
  sampleEvery = 1,
  unmetThresholdWh = 1,
}) {
  const chem = CHEMISTRIES[chemistry] || CHEMISTRIES.lfp;
  const eta = Math.sqrt(chem.roundTrip);
  const cap =
    Math.max(0, battKwhUsable) *
    1000 *
    (capacityScale ?? chem.usableScale ?? 1);
  if (!(cap > 0)) throw new Error("battery capacity must be > 0");
  const n = e1kw.length;
  if (essentialsWh.length !== n)
    throw new Error("essentials series must match e1kw length");
  const floor = clampReserveFloor(reserveFloor);
  const hours = Math.max(1, Math.min(Math.round(targetHours), n));
  const stride = Math.max(1, Math.round(sampleEvery));
  // R-UC-04: the reserve is released only here, inside an actual outage.
  const soc0 = Number.isFinite(startSoc)
    ? Math.min(1, Math.max(0, startSoc))
    : Math.max(floor, 1);
  const useSeries = !!startSocSeries && startSocSeries.length === n;

  let starts = 0;
  let coveredStarts = 0;
  const held = [];
  for (let s = 0; s < n; s += stride) {
    starts++;
    // The bank never sits below the floor while the grid is up, so the
    // series is floored anyway: an outage may only release the reserve, never
    // dip under it.
    let soc = useSeries
      ? Math.min(1, Math.max(floor, startSocSeries[s]))
      : soc0;
    const run = runDischarge({
      soc,
      // floor: 0 \u2014 R-UC-04. Inside an actual outage the reserve is SPENT,
      // not held: that is what the reserve is for. The floor still applies to
      // where an outage BEGINS (the series above is floored), so the bank can
      // never dip below it while the grid is up.
      floor: 0,
      cap,
      eta,
      chem,
      e1kw,
      loadWh: essentialsWh,
      tempsC,
      pvKw,
      fromIndex: s,
      hours,
      wrap: true,
      unmetThresholdWh,
    });
    soc = run.soc;
    if (!run.shortfall) coveredStarts++;
    held.push(run.runHours);
  }
  void soc0;

  held.sort((a, b) => a - b);
  const at = (q) =>
    held.length
      ? held[Math.min(held.length - 1, Math.floor(q * held.length))]
      : 0;
  let essentialWhPerDay = 0;
  for (let i = 0; i < Math.min(24, n); i++)
    essentialWhPerDay += essentialsWh[i];
  const deliveredKwh =
    Math.max(0, battKwhUsable) *
    (1 - floor) *
    (capacityScale ?? chem.usableScale ?? 1);

  return {
    targetHours: hours,
    starts,
    coveredStarts,
    coveragePct: starts > 0 ? (coveredStarts / starts) * 100 : 0,
    // Hours of backup at the 10th and 50th percentile start: the plan's
    // extra output. P10 is what you would plan around; the mean would lie,
    // because one dark January evening moves it more than a whole summer.
    hoursBackupP10: at(0.1),
    hoursBackupP50: at(0.5),
    hoursBackupMin: held.length ? held[0] : 0,
    hoursBackupMax: held.length ? held[held.length - 1] : 0,
    startState: useSeries
      ? "measured-soc"
      : Number.isFinite(startSoc)
        ? "explicit"
        : "assumed-full",
    essentialKwhPerDay: essentialWhPerDay / 1000,
    autonomyDays:
      essentialWhPerDay > 0 ? deliveredKwh / (essentialWhPerDay / 1000) : 0,
  };
}

// ── Portable / mobile power (R-UC-06) ───────────────────────────────────────
//
// No roof, no grid, no tariff: a device load profile, the trip days sampled
// from the location's own weather year, and whatever charging the visitor
// actually has. Shore power is modelled as an overnight top-up to the stated
// state of charge, which is the only honest way to say "it is full every
// morning" without pretending a meter exists on a campsite.
export function simulatePortable({
  battKwhUsable,
  e1kw,
  devicesWh,
  chemistry = "lfp",
  capacityScale = null,
  tempsC = null,
  reserveFloor = 0,
  pvKw = 0,
  shorePower = false,
  startSoc = 1,
  hoursPerTrip = 24,
  unmetThresholdWh = 1,
}) {
  const chem = CHEMISTRIES[chemistry] || CHEMISTRIES.lfp;
  const eta = Math.sqrt(chem.roundTrip);
  const cap =
    Math.max(0, battKwhUsable) *
    1000 *
    (capacityScale ?? chem.usableScale ?? 1);
  if (!(cap > 0)) throw new Error("battery capacity must be > 0");
  const n = e1kw.length;
  if (devicesWh.length !== n)
    throw new Error("devices series must match e1kw length");
  const floor = clampReserveFloor(reserveFloor);
  const hours = Math.max(1, Math.min(Math.round(hoursPerTrip), n));
  const dayStride = Math.max(24, hours);

  let soc = Math.min(1, Math.max(floor, startSoc));
  let trips = 0;
  let poweredTrips = 0;
  const runtimes = [];

  // Two questions, two runs, never conflated://   autonomyHours — how long ONE charge runs the devices (from full, with
  //                   whatever the panel adds during the trip).
  //   coveragePct    — how many days of the weather year the panel alone can
  //                   carry, carrying state over day to day as it really does.
  const runOne = (fromSoc) => {
    let s = fromSoc;
    // Run past the trip window: "how long does one charge last" is capped by
    // the trip length if you let the trip bound it, which would report the
    // trip length back and call it autonomy. 168 h is a week, past which a
    // portable station nobody has recharged is not a question worth asking.
    const span = Math.min(n, Math.max(hours, 168));
    return runDischarge({
      soc: fromSoc,
      floor,
      cap,
      eta,
      chem,
      e1kw,
      loadWh: devicesWh,
      tempsC,
      pvKw,
      fromIndex: 0,
      hours: span,
      unmetThresholdWh,
    }).runHours;
  };
  const autonomyHours = runOne(Math.min(1, Math.max(floor, startSoc)));

  for (let d = 0; d + hours <= n; d += dayStride) {
    if (shorePower) soc = Math.min(1, Math.max(floor, startSoc));
    trips++;
    const run = runDischarge({
      soc,
      floor,
      cap,
      eta,
      chem,
      e1kw,
      loadWh: devicesWh,
      tempsC,
      pvKw,
      fromIndex: d,
      hours,
      unmetThresholdWh,
    });
    soc = run.soc;
    if (!run.shortfall) poweredTrips++;
    runtimes.push(run.runHours);
    if (!Number.isFinite(soc)) soc = floor;
  }
  runtimes.sort((a, b) => a - b);
  const at = (q) =>
    runtimes.length
      ? runtimes[Math.min(runtimes.length - 1, Math.floor(q * runtimes.length))]
      : 0;

  return {
    trips,
    poweredTrips,
    coveragePct: trips > 0 ? (poweredTrips / trips) * 100 : 0,
    hoursPerTrip: hours,
    // Median and worst, never the mean: a handful of dark days move the mean
    // more than the other 360 combined, and a mean is the one number that
    // would let a station that fails at dawn look like an average performer.
    medianRuntimeHours: at(0.5),
    worstRuntimeHours: at(0),
    bestRuntimeHours: at(1),
    autonomyHours,
    shorePower,
    endSoc: soc,
  };
}
