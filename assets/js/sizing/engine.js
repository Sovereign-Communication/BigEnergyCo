// BigEnergyCo deterministic sizing engine.
// Pure functions only: no DOM, no network, no globals. Every constant is
// exported so the UI can render a complete "show the arithmetic" panel.
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
  soiling: 0.97,   // dust/dirt, washed occasionally
  wiring: 0.98,    // DC + AC wiring losses
  mismatch: 0.99,  // panel-to-panel variation
  mppt: 0.98,      // charge-controller tracking efficiency
  snow: 1.00,      // user-adjustable for snowy sites
};

export const GAMMA_PMAX = -0.0034;  // per °C, mono-PERC typical (range -0.0029..-0.0040)
export const NOCT = 45;             // nominal operating cell temp, °C

export const ETA_INVERTER = 0.94;   // DC->AC conversion, continuous
export const ROUND_TRIP_DEFAULT = 0.92;

export const CHEMISTRIES = {
  lfp: {
    label: "LFP (LiFePO4)",
    usableDod: 0.90,
    roundTrip: 0.92,
    chargeMinC: 0,        // must not charge below 0 °C without heating
    dischargeMinC: -20,
    cyclesTo80: 6000,     // 314Ah-class manufacturer rating
    note: "Cannot charge below 0°C without a heated/insulated enclosure.",
  },
  naion: {
    label: "Sodium-Ion",
    usableDod: 0.90,
    roundTrip: 0.90,
    chargeMinC: -20,
    dischargeMinC: -40,
    cyclesTo80: 4500,     // conservative mid-range for current packs
    note: "Cold-capable; check local availability and certification (UL 9540 rare as of Aug 2026).",
  },
  agm: {
    label: "Lead-Acid (AGM)",
    usableDod: 0.50,
    roundTrip: 0.85,
    chargeMinC: -20,
    dischargeMinC: -20,
    cyclesTo80: 600,
    note: "Cheapest upfront; short cycle life at deep discharge.",
  },
};

export const RELIABILITY_TIERS = [
  { id: "tier100", label: "100% — no generator", maxUnmetHoursPerYear: 0 },
  { id: "tier99",  label: "99% — generator as rare backup", maxUnmetHoursPerYear: 87.6 },
  { id: "tier95",  label: "95% — generator now and then", maxUnmetHoursPerYear: 438 },
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
    if (!Number.isFinite(ghi) || ghi <= -900 || !Number.isFinite(tAmb)) continue; // fill values / gaps
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
      const h = ((Math.round(it.startHour) + k) % 24 + 24) % 24;
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
export function simulate({ pvKw, battKwhUsable, e1kw, loadWh, chemistry = "lfp", startSoc = 0.5, tempsC = null, capture = false }) {
  const chem = CHEMISTRIES[chemistry] || CHEMISTRIES.lfp;
  const eta = Math.sqrt(chem.roundTrip);
  const cap = battKwhUsable * 1000; // Wh
  if (cap <= 0) throw new Error("battery capacity must be > 0");

  let soc = startSoc;
  let served = 0, unmet = 0, unmetHours = 0, gap = 0, longestGap = 0;
  let throughputDc = 0, minSoc = soc;
  const n = e1kw.length;
  const loadN = loadWh.length;
  if (loadN !== n) throw new Error("load series must match e1kw length");
  const socSeries = capture ? new Float64Array(n) : null;

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
      if (short > 1) { // >1 Wh: count as an unserved hour
        unmet += short;
        unmetHours += 1;
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
    longestGapHours: longestGap,
    cyclesEquivalent: throughputDc / cap, // full-equivalent cycles over the period
    finalSoc: soc,
    minSoc,
    socSeries,
  };
}

/**
 * Lowest state of charge reached on each calendar day (data is Local Solar
 * Time, so every 24 consecutive samples is exactly one day starting midnight).
 * The daily minimum IS the reliability signal: it shows how deep each system
 * digs into its reserve during bad weather, with no hourly noise.
 * @returns {Float64Array} length ceil(n/24)
 */
export function dailyMinimums(series) {
  const out = new Float64Array(Math.ceil(series.length / 24));
  for (let d = 0; d < out.length; d++) {
    const s = d * 24;
    const e = Math.min(series.length, s + 24);
    let lo = Infinity;
    for (let i = s; i < e; i++) if (series[i] < lo) lo = series[i];
    out[d] = lo;
  }
  return out;
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
    let lo = Infinity, hi = -Infinity;
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
 */
export function simulateWithCycles(opts) {
  const chem = CHEMISTRIES[opts.chemistry || "lfp"] || CHEMISTRIES.lfp;
  const eta = Math.sqrt(chem.roundTrip);
  const base = simulate(opts);
  // Re-derive cycles cheaply: total energy through inverter ≈ served AC energy.
  base.cyclesEquivalent = base.servedWh / (opts.battKwhUsable * 1000 * 2);
  return base;
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
  e1kw, loadWh, tempsC = null, chemistry = "lfp",
  maxUnmetHoursPerYear, years = 1,
  costPerWpv = 0.35, costPerKwhBatt = 140,
  pvMax = 30, battMax = 200, pvStep = 0.5, battStep = 1,
}) {
  const evaluate = (pv, batt) => {
    const r = simulate({ pvKw: pv, battKwhUsable: batt, e1kw, loadWh, chemistry, tempsC });
    return { avgUnmet: r.unmetHours / years, r };
  };
  const meets = (ev) => ev.avgUnmet <= maxUnmetHoursPerYear + 1e-9;

  let best = null;
  for (let b = battStep; b <= battMax; b += battStep) {
    for (let p = pvStep; p <= pvMax; p += pvStep) {
      const ev = evaluate(p, b);
      if (!meets(ev)) continue;
      const cost = p * 1000 * costPerWpv + b * costPerKwhBatt;
      if (!best || cost < best.cost) best = { pvKw: p, battKwh: b, result: ev.r, cost };
      break; // smallest PV that works for this battery; larger PV only costs more
    }
    if (best && best.battKwh <= b - battStep) {
      // best found with a smaller battery already; larger batteries can't be cheaper
      // unless PV drops a step — allow one more row for refinement, then stop.
      if (b >= best.battKwh + 4 * battStep) break;
    }
  }

  if (!best) return null;

  // Refinement: try to shave PV and battery around the coarse optimum.
  let improved = true;
  while (improved) {
    improved = false;
    for (const dp of [-pvStep, 0, pvStep]) {
      for (const db of [-battStep, 0, battStep]) {
        const p = best.pvKw + dp, b = best.battKwh + db;
        if (p <= 0 || b <= 0) continue;
        const ev = evaluate(p, b);
        if (!meets(ev)) continue;
        const cost = p * 1000 * costPerWpv + b * costPerKwhBatt;
        if (cost < best.cost) { best = { pvKw: p, battKwh: b, result: ev.r, cost }; improved = true; }
      }
    }
  }
  return best;
}

/**
 * Size all tiers at once. Returns array aligned with RELIABILITY_TIERS order.
 */
export function sizeAllTiers(opts) {
  return RELIABILITY_TIERS.map((t) => {
    const best = sizeForTier({ ...opts, maxUnmetHoursPerYear: t.maxUnmetHoursPerYear });
    return { tier: t, sizing: best };
  });
}
