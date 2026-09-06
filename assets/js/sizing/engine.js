// BigEnergyCo deterministic sizing engine.
// Pure functions only: no DOM, no network, no globals. Every constant is
// exported so the UI can render a complete "show the arithmetic" panel.

import { batteryReplacements, lifetimeCostUsd } from "./money.js?v=20260906e";
import { oversizeCallout } from "./rescale.js?v=20260906e";
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
export const ROUND_TRIP_DEFAULT = 0.92;

export const CHEMISTRIES = {
  lfp: {
    label: "LFP (LiFePO4)",
    usableDod: 0.9,
    roundTrip: 0.92,
    chargeMinC: 0, // must not charge below 0 °C without heating
    dischargeMinC: -20,
    cyclesTo80: 6000, // 314Ah-class manufacturer rating
    usableScale: 1.0, // capacity barely affected by discharge rate or chill
    note: "Cannot charge below 0°C without a heated/insulated enclosure.",
  },
  naion: {
    label: "Sodium-Ion",
    usableDod: 0.9,
    roundTrip: 0.9,
    chargeMinC: -20,
    dischargeMinC: -40,
    // Field reality (2026): most hybrid inverters only offer LFP voltage
    // profiles. On a 16S LFP window the ~40-42 V low cutoff sits ABOVE true
    // sodium empty, and the LFP absorb voltage ends charge early — so you
    // lose ~15% effective capacity but the pack never sees deep discharge,
    // which EXTENDS life versus the deep-cycle rating.
    usableScale: 0.85,
    cyclesTo80: 5500, // uprated from ~4500 deep-cycle figure for shallow effective DoD
    note: "Cold-capable. Modeled on standard LFP voltage settings (the common case): slightly less usable capacity, gentler discharge, longer life. A native sodium inverter profile restores full capacity.",
  },
  agm: {
    label: "Lead-Acid (AGM)",
    usableDod: 0.5,
    roundTrip: 0.85,
    chargeMinC: -20,
    dischargeMinC: -20,
    // Field reality: DIY banks are series strings of 12 V blocks, usually
    // WITHOUT active balancing (top-balancing at best, often misconfigured).
    // Cells drift and one laggard drags the whole string, so manufacturer
    // lab ratings (~600 cycles) aren't achieved. 500 is the honest number.
    cyclesTo80: 500,
    usableScale: 0.85,
    coldPctPerC: 0.008,
    note: "Cheapest upfront. Modeled WITHOUT active balancing (typical DIY series strings) — expect several bank replacements over 20 years. Proper balancing helps; physics still wins.",
  },
};

/** Capacity scale from annual-mean temperature (lead-acid chemistry only). */
export function coldCapacityScale(chemistry, meanTempC) {
  const chem = CHEMISTRIES[chemistry];
  if (!chem || !chem.coldPctPerC) return 1;
  const drop = Math.max(0, 25 - meanTempC) * chem.coldPctPerC;
  return Math.max(0.6, Math.min(1, 1 - drop));
}

/**
 * Total delivered-capacity factor for a chemistry at a site:
 * rate-related loss (Peukert-style, from CHEMISTRIES.usableScale) times
 * cold loss (annual-mean temperature). Explicitly passed into the sims so
 * every result can show its arithmetic.
 */
export function capacityScaleFor(chemistry, meanTempC = null) {
  const chem = CHEMISTRIES[chemistry];
  if (!chem) return 1;
  return (
    (chem.usableScale ?? 1) *
    (meanTempC === null ? 1 : coldCapacityScale(chemistry, meanTempC))
  );
}

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
 * Simulate state of charge hour by hour across the full series.
 * Energy bookkeeping is AC-side: surplus AC charges the battery via
 * sqrt(RTE); the battery serves deficits via sqrt(RTE) as well.
 * Charging is blocked when ambient temp is below the chemistry's
 * chargeMinC (the cold-charge reality that sizes heated enclosures).
 *
 * @returns {{servedWh:number, unmetWh:number, unmetHours:number,
 *            longestGapHours:number, cyclesEquivalent:number,
 *            finalSoc:number, minSoc:number}}
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
}) {
  const chem = CHEMISTRIES[chemistry] || CHEMISTRIES.lfp;
  const eta = Math.sqrt(chem.roundTrip);
  // Delivered-capacity factor: rate loss (usableScale) by default, or the
  // caller's rate×cold product when provided (the worker always provides it).
  const cap = battKwhUsable * 1000 * (capacityScale ?? chem.usableScale ?? 1); // Wh
  if (cap <= 0) throw new Error("battery capacity must be > 0");

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
      const availableAc = soc * cap * eta;
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

/**
 * Size all tiers at once. Returns array aligned with RELIABILITY_TIERS order.
 * @deprecated — use simulate() directly; kept for backwards compat.
 */
export function simulateWithCycles(opts) {
  return simulate(opts);
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

  const opt = evaluateOversizeOptimization({
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
  });
  if (opt.useOversized && opt.oversizedBattKwh > best.battKwh) {
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
export function isPeakHour(hourOfDay) {
  return hourOfDay >= PEAK_HOUR_START && hourOfDay < PEAK_HOUR_END;
}

// ── Grid-connected mode: bill reduction without exporting ───────────────────

export const BILL_TARGETS = [
  { id: "cut60", label: "Cut ~60% of your bill", minFraction: 0.6 },
  { id: "cut80", label: "Cut ~80% of your bill", minFraction: 0.8 },
  { id: "cut95", label: "Cut ~95% of your bill", minFraction: 0.95 },
];

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
 *            curtailedWh:number, cyclesEquivalent:number, finalSoc:number,
 *            minSoc:number}}
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
}) {
  const chem = CHEMISTRIES[chemistry] || CHEMISTRIES.lfp;
  const eta = Math.sqrt(chem.roundTrip);
  const cap =
    Math.max(0, battKwhUsable) *
    1000 *
    (capacityScale ?? chem.usableScale ?? 1);

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
      } else if (peak && soc > 0) {
        const availableAc = soc * cap * eta;
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
      const availableAc = soc * cap * eta;
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
 * under (1 - minFraction) of total load. Imports are monotonically
 * non-increasing in PV for a fixed battery (extra PV can only serve load,
 * fill the bank, or clip), so each battery row binary-searches its smallest
 * sufficient PV — far fewer simulations than a full lattice scan.
 *
 * @returns {{pvKw:number, battKwh:number, result:object, cost:number} | null}
 */
export function sizeForBillCut({
  e1kw,
  loadWh,
  tempsC = null,
  chemistry = "lfp",
  minFraction = 0.8,
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
}) {
  const f = Number(minFraction);
  if (!Number.isFinite(f) || f < 0.01 || f > 1.11) {
    throw new RangeError(
      `minFraction must be within [0.01, 1.11] (a 1% to 111% bill cut); got ${minFraction}`,
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
  // sell/track the surplus, so the constraint becomes "the bill is fully
  // covered AND at least (f-1) of annual load is produced as surplus". A mere
  // sliver of clipped PV while still importing is not a >100% cut, so both
  // conditions must hold. A battery only absorbs surplus and adds cost against
  // that goal, but the search below stays fully general and lets the cost
  // objective decide.
  const surplusTarget = f > 1;
  const importBudget = surplusTarget ? loadTotal * 0.005 : loadTotal * (1 - f);
  const evaluate = (pv, batt) =>
    simulateOffset({
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
    : surplusTarget
      ? (r) =>
          r.importedWh <= importBudget + 1e-6 &&
          r.curtailedWh >= loadTotal * (f - 1) - 1e-6
      : (r) => r.importedWh <= importBudget + 1e-6;

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

  const opt = evaluateOversizeOptimization({
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
  });
  if (opt.useOversized && opt.oversizedBattKwh > best.battKwh) {
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
