// Single source of truth for sizing cost estimates.
// Every figure is a RANGE tied to a labeled procurement scope, because
// "battery cost" spans 4x depending on where and how you buy.

// Verified against PowMr's public catalog on 2026-08-23 (sale prices):
//   Inverters (low-frequency, 48V, split-phase, ~3x surge, MPPT built in):
//     10 kW — $939 (reg $1,899)   5 kW — $449 (reg $999)
//   Batteries (51.2V LiFePO4, ≥6000 cycles @80% DoD, BMS + enclosure incl.):
//     600Ah/30.72kWh — $3,399 ($111/kWh) · 400Ah/20.48kWh — $2,399 ($117)
//     300Ah/15.36kWh — $1,999 ($130)      · 100Ah/5.12kWh — $919-1,199
export const POWMR_CATALOG = {
  checkedDate: "Aug 2026",
  inverters: [
    { model: "10 kW low-frequency split-phase", kw: 10, priceUsd: 939, note: "48V · 3× surge · built-in MPPT" },
    { model: "5 kW low-frequency split-phase", kw: 5, priceUsd: 449, note: "48V · 3× surge · built-in MPPT" },
  ],
  batteries: [
    { kwhNominal: 30.72, priceUsd: 3399, perKwh: 111 },
    { kwhNominal: 20.48, priceUsd: 2399, perKwh: 117 },
    { kwhNominal: 15.36, priceUsd: 1999, perKwh: 130 },
    { kwhNominal: 5.12, priceUsd: 1059, perKwh: 207 },
  ],
};

// Scopes. Battery figures are per USABLE kWh (the unit the sizer outputs);
// nominal-retail prices divide by usableDoD 0.9 to stay comparable.
export const PRICING_SCOPES = [
  {
    id: "powmr",
    label: "Budget retail (PowMr-class)",
    source: "PowMr public catalog, Aug 2026 sale prices",
    pvPerW: [0.28, 0.38],          // budget mono panels, retail
    battPerKwhUsable: [110, 165],  // big-unit $111-130/kWh nominal; small units higher
    invPerKw: [85, 200],           // $90-94/kW sale on 5-10 kW LF units
    note: "Shipped retail prices with BMS/enclosure included.",
  },
  {
    id: "landed",
    label: "Landed DIY build (cells shipped + duty)",
    source: "Aggregated community builds, 2025-2026",
    pvPerW: [0.16, 0.28],
    battPerKwhUsable: [80, 125],
    invPerKw: [90, 260],
    note: "You assemble: cells + BMS + enclosure + freight + duty.",
  },
  {
    id: "cells",
    label: "Ex-factory China (cells only)",
    source: "Cell market indications, Aug 2026",
    pvPerW: [0.11, 0.2],
    battPerKwhUsable: [45, 70],    // $43.5 per 314Ah cell ≈ $43/kWh nominal ≈ $48 usable
    invPerKw: [60, 180],
    note: "Components only, before freight/duty/BMS/enclosure — rarely the final cost.",
  },
];

export function getScope(id) {
  return PRICING_SCOPES.find((s) => s.id === id) || PRICING_SCOPES[0];
}

/** Cost range for a system under a scope. Returns {lo, hi, pvMid, battMid}. */
export function costRange(pvKw, battKwhUsable, scopeId) {
  const s = getScope(scopeId);
  const pvLo = pvKw * 1000 * s.pvPerW[0];
  const pvHi = pvKw * 1000 * s.pvPerW[1];
  const bLo = battKwhUsable * s.battPerKwhUsable[0];
  const bHi = battKwhUsable * s.battPerKwhUsable[1];
  const invLo = (pvKw * s.invPerKw[0]);
  const invHi = (pvKw * s.invPerKw[1]);
  return {
    lo: Math.round(pvLo + bLo + invLo),
    hi: Math.round(pvHi + bHi + invHi),
    pvMid: Math.round((pvLo + pvHi) / 2),
    battMid: Math.round((bLo + bHi) / 2),
    scope: s,
  };
}
