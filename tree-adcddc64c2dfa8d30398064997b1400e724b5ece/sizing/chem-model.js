// Battery chemistry / cell model shared by the engine and the UI.
//
// Pure data + math, no engine deps. This lives OUTSIDE engine.js so the UI's
// arithmetic panel and the parts list can read it without dragging the whole
// deterministic search into the visitor's first load (plan §3.1 byte budget);
// engine.js re-exports everything here so the worker's surface is unchanged.

export const CHEMISTRIES = {
  lfp: {
    label: "LFP (LiFePO4)",
    usableDod: 0.8, // 80% DoD delivers the full 6,000 cycle rating (90% DoD shortens cycle life)
    roundTrip: 0.92,
    chargeMinC: 0, // must not charge below 0 °C without heating
    dischargeMinC: -20,
    cyclesTo80: 6000, // 314Ah-class manufacturer rating at 80% DoD
    usableScale: 1.0, // capacity barely affected by discharge rate or chill
    note: "Cannot charge below 0°C without heating. Sized at 80% DoD to guarantee full 6,000+ cycle lifespan.",
  },
  naion: {
    label: "Sodium-Ion",
    usableDod: 0.85, // Inherent cell window is 95%+; standard 48V inverter cutoffs (~40-42V) utilize ~85%
    roundTrip: 0.9,
    chargeMinC: -20,
    dischargeMinC: -40,
    // Field reality (2026): most hybrid inverters only offer LFP voltage
    // profiles. On a 16S LFP window the ~40-42 V low cutoff sits ABOVE true
    // sodium empty, and the LFP absorb voltage ends charge early — so you
    // use ~85% of nameplate, but avoiding deep discharge EXTENDS life to 5,500+ cycles.
    usableScale: 0.85,
    cyclesTo80: 5500, // uprated from ~4500 deep-cycle figure for shallow effective DoD
    note: "Cold-capable. Inherent 95%+ cell DoD window; standard 48V inverter voltage cutoffs utilize ~85% in practice, which extends life to 5,500+ cycles.",
  },
  agm: {
    label: "Lead-Acid (AGM)",
    usableDod: 0.5,
    roundTrip: 0.85,
    chargeMinC: -20,
    dischargeMinC: -20,
    // Field reality: DIY 12 V series strings, usually WITHOUT active
    // balancing. The reference rates 1,250 @ 50% DoD balanced; un-balanced
    // strings miss it, so 500 = the model's 1,250 x a 0.4x derate.
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

/**
 * Cycles to 80% SOH vs DoD: SUPER-LINEAR, one exponent per DoD band (#156), as
 * a precomputed [anchorDoD, anchorCycles, exponent] triple. The derivation, the
 * per-band values and their sources: BATTERY_CYCLE_LIFE_REFERENCE_2026.md.
 */
export const CYCLE_LIFE_CURVES = {
  // Winston 3,000 @ 80% scaled 2.0x onto CATL 280Ah's 6,000-8,000.
  lfp: {
    cap: 15000,
    bands: [0.55, 16000, 2.618, 0.8, 6000, 1.817, 1, 4000, 0],
  },
  // Near-flat: the reference calls Na-ion DoD-insensitive.
  naion: { cap: 12000, bands: [0.85, 5500, 0.586, 1, 5000, 0] },
  // 500 = the reference's 1,250 @ 50% x a 0.4x derate; see CHEMISTRIES.
  agm: { cap: 2000, bands: [0.5, 1250, 2.424, 0.8, 400, 3.705, 1, 175, 0] },
};

/** Cycles to 80% SOH; `dod` clamped to 0.1..1.0. */
export function cycleLifeForDoD(chemistry, dod) {
  const curve = CYCLE_LIFE_CURVES[chemistry];
  if (!curve) return 4000;
  const d = Math.max(0.1, Math.min(1.0, dod));
  const b = curve.bands;
  const hit = (i) => {
    const [a, cy, e] = [b[i], b[i + 1], b[i + 2]];
    return e ? Math.min(curve.cap, Math.round(cy * Math.pow(a / d, e))) : cy;
  };
  // Band i owns [b[i], b[i+3]), so a point ON an anchor returns that anchor
  // exactly; the other side re-evaluates the rounded exponent (LFP read 5,999).
  for (let i = 0; i < b.length; i += 3) {
    if (d >= b[i] && (i + 3 >= b.length || d < b[i + 3])) return hit(i);
  }
  return hit(0); // below the shallowest anchor: extrapolate, capped
}
