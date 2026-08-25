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
    battPerKwhNaion: [110, 175],   // retail sodium packs still scarce → thin premium
    note: "Shipped retail prices with BMS/enclosure included.",
  },
  {
    id: "landed",
    label: "Landed DIY build (cells shipped + duty)",
    source: "Aggregated community builds, 2025-2026",
    pvPerW: [0.16, 0.28],
    battPerKwhUsable: [80, 125],
    invPerKw: [90, 260],
    battPerKwhNaion: [88, 138],    // ~10% premium over LFP landed, Aug 2026
    note: "You assemble: cells + BMS + enclosure + freight + duty.",
  },
  {
    id: "cells",
    label: "Ex-factory China (cells only)",
    source: "Cell market indications, Aug 2026",
    pvPerW: [0.11, 0.2],
    battPerKwhUsable: [45, 70],    // $43.5 per 314Ah cell ≈ $43/kWh nominal ≈ $48 usable
    invPerKw: [60, 180],
    battPerKwhNaion: [52, 78],     // sodium cell lines still ramping → ~15% premium
    note: "Components only, before freight/duty/BMS/enclosure — rarely the final cost.",
  },
];

export function getScope(id) {
  return PRICING_SCOPES.find((s) => s.id === id) || PRICING_SCOPES[0];
}

/** Battery price range for one scope and chemistry. */
function battRangeFor(scope, chemistry) {
  if (chemistry === "naion" && Array.isArray(scope.battPerKwhNaion)) return scope.battPerKwhNaion;
  return scope.battPerKwhUsable;
}

/** Cost range for a system under one scope. */
export function costRange(pvKw, battKwhUsable, scopeId, chemistry = "lfp") {
  const s = getScope(scopeId);
  const bRange = battRangeFor(s, chemistry);
  const pvLo = pvKw * 1000 * s.pvPerW[0];
  const pvHi = pvKw * 1000 * s.pvPerW[1];
  const bLo = battKwhUsable * bRange[0];
  const bHi = battKwhUsable * bRange[1];
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

/**
 * The ONE range shown in the UI: ex-factory China at the low end through
 * PowMr-class budget retail at the high end. No selector — every result
 * simply states its honest spread.
 */
export function fullRange(pvKw, battKwhUsable, chemistry = "lfp") {
  const lo = costRange(pvKw, battKwhUsable, "cells", chemistry);
  const hi = costRange(pvKw, battKwhUsable, "powmr", chemistry);
  const landed = costRange(pvKw, battKwhUsable, "landed", chemistry);
  // search objective sits near the middle of the honest spread (landed DIY)
  const cellsBatt = battRangeFor(getScope("cells"), chemistry);
  const powmrBatt = battRangeFor(getScope("powmr"), chemistry);
  return {
    lo: lo.lo,
    hi: hi.hi,
    pvCostLo: Math.round(lo.pvLo ?? pvKw * 1000 * getScope("cells").pvPerW[0]),
    pvCostHi: Math.round(pvKw * 1000 * getScope("powmr").pvPerW[1]),
    battCostLo: Math.round(battKwhUsable * cellsBatt[0]),
    battCostHi: Math.round(battKwhUsable * powmrBatt[1]),
    battPerKwhLo: cellsBatt[0],
    battPerKwhHi: powmrBatt[1],
    objectiveMid: Math.round((landed.lo + landed.hi) / 2),
  };
}

/** Battery-only cost ranges per procurement scope (the storage-comparison view has no PV). */
export function battOnlyCost(battKwhUsable, chemistry = "lfp") {
  const out = {};
  for (const s of PRICING_SCOPES) {
    const r = battRangeFor(s, chemistry);
    out[s.id] = {
      label: s.label,
      lo: Math.round(battKwhUsable * r[0]),
      hi: Math.round(battKwhUsable * r[1]),
    };
  }
  return out;
}

// ── Regional electricity price estimation ───────────────────────────────────
// Coarse residential rates (USD/kWh) from coordinates. Deliberately rough:
// enough to turn a monthly bill into kWh/day without asking people to know
// their tariff. Country boxes are checked first; regional boxes are the
// fallback. Indicative 2026 residential averages aggregated from public
// tariff trackers — users can always type their exact rate.
const TARIFF_BOXES = [
  // Country-level refinement (most-specific first)
  { box: [47.0, 55.5, 5.0, 15.5], rate: 0.40, label: "Germany" },
  { box: [49.5, 61.0, -8.5, 2.0], rate: 0.34, label: "United Kingdom / Ireland" },
  { box: [36.0, 47.5, 6.0, 19.0], rate: 0.42, label: "Italy" },
  { box: [35.5, 44.0, -10.0, 4.5], rate: 0.26, label: "Spain / Portugal" },
  { box: [41.0, 51.5, -5.5, 10.0], rate: 0.25, label: "France / Belgium / Netherlands" },
  { box: [48.5, 55.0, 13.5, 24.5], rate: 0.20, label: "Poland / Czechia / Slovakia" },
  { box: [55.0, 60.0, 20.0, 28.5], rate: 0.21, label: "Finland / Baltics" },
  { box: [-56.0, -17.0, -74.0, -34.0], rate: 0.17, label: "Brazil" },
  { box: [-30.0, -17.0, -73.0, -53.0], rate: 0.16, label: "Chile / Uruguay" },
  { box: [0.0, 12.5, -79.0, -71.0], rate: 0.20, label: "Colombia / Venezuela" },
  { box: [-20.5, -0.5, -81.5, -75.0], rate: 0.14, label: "Peru / Ecuador" },
  { box: [14.5, 33.0, -118.0, -86.0], rate: 0.16, label: "Mexico" },
  { box: [4.0, 21.5, 116.0, 127.0], rate: 0.19, label: "Philippines" },
  { box: [-11.5, 6.5, 94.5, 141.5], rate: 0.11, label: "Indonesia / Malaysia / Singapore" },
  { box: [5.5, 20.5, 97.0, 106.0], rate: 0.13, label: "Thailand / Myanmar / Cambodia / Laos" },
  { box: [8.0, 24.0, 102.0, 110.0], rate: 0.08, label: "Vietnam" },
  { box: [6.0, 36.0, 68.0, 98.0], rate: 0.08, label: "India / Pakistan / Bangladesh / Nepal" },
  { box: [30.5, 46.5, 128.5, 146.5], rate: 0.20, label: "Japan / South Korea" },
  { box: [-50.0, -9.5, 111.0, 180.0], rate: 0.29, label: "Australia / New Zealand" },
  { box: [20.0, 32.5, 34.0, 60.0], rate: 0.09, label: "Saudi Arabia / UAE / Qatar / Oman / Kuwait" },
  { box: [35.5, 42.5, 25.5, 45.0], rate: 0.11, label: "Turkey" },
  { box: [29.5, 32.0, 34.0, 36.0], rate: 0.16, label: "Israel / Jordan" },
  { box: [20.5, 32.5, -18.0, -1.0], rate: 0.14, label: "Morocco / Algeria / Tunisia" },
  { box: [21.5, 32.0, 24.0, 37.0], rate: 0.05, label: "Egypt / Libya / Sudan" },
  { box: [4.5, 12.5, -4.5, 2.5], rate: 0.14, label: "Ghana / Côte d'Ivoire / Togo" },
  { box: [3.0, 14.5, 2.5, 15.5], rate: 0.07, label: "Nigeria / Niger / Benin / Cameroon" },
  { box: [-5.5, 5.5, 33.0, 42.0], rate: 0.19, label: "Kenya / Uganda / Tanzania / Rwanda" },
  { box: [-35.5, -17.5, 15.5, 33.5], rate: 0.18, label: "South Africa / Namibia / Botswana" },
  { box: [3.5, 12.0, 8.0, 24.0], rate: 0.12, label: "Chad / CAR / South Sudan / Ethiopia" },
  // Regional fallbacks
  { box: [18.5, 28.5, -179, -154], rate: 0.42, label: "Hawaii / Pacific islands" },
  { box: [59, 72, 24, 46], rate: 0.18, label: "Nordics / Baltic" },
  { box: [49.5, 61, -9, 3], rate: 0.34, label: "UK / Ireland" },
  { box: [35.5, 72, -11, 41], rate: 0.29, label: "Europe" },
  { box: [24, 50, -125, -66], rate: 0.17, label: "US mainland" },
  { box: [42, 71, -141, -52], rate: 0.13, label: "Canada" },
  { box: [7, 25, -93, -58], rate: 0.33, label: "Caribbean & Central America" },
  { box: [-56, 13, -82, -34], rate: 0.16, label: "South America" },
  { box: [22, 47, 123, 147], rate: 0.21, label: "Japan / Korea" },
  { box: [-48, -9, 110, 180], rate: 0.26, label: "Australia / New Zealand" },
  { box: [5, 37, 60, 98], rate: 0.08, label: "South Asia" },
  { box: [18, 54, 73, 135], rate: 0.09, label: "China / Mongolia" },
  { box: [-12, 26, 90, 142], rate: 0.12, label: "Southeast Asia" },
  { box: [12, 43, 33, 64], rate: 0.09, label: "Middle East" },
  { box: [-36, 38, -19, 53], rate: 0.16, label: "Africa" },
];

export function estimateTariff(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { rate: 0.28, label: "global average" };
  }
  for (const t of TARIFF_BOXES) {
    const [latMin, latMax, lonMin, lonMax] = t.box;
    if (lat >= latMin && lat <= latMax && lon >= lonMin && lon <= lonMax) {
      return { rate: t.rate, label: t.label };
    }
  }
  return { rate: 0.28, label: "global average" };
}
