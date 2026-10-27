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
    {
      model: "10 kW low-frequency split-phase",
      kw: 10,
      priceUsd: 939,
      note: "48V · 3× surge · built-in MPPT",
    },
    {
      model: "5 kW low-frequency split-phase",
      kw: 5,
      priceUsd: 449,
      note: "48V · 3× surge · built-in MPPT",
    },
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
    pvPerW: [0.28, 0.38], // budget mono panels, retail
    battPerKwhUsable: [110, 165], // big-unit $111-130/kWh nominal; small units higher
    invPerKw: [85, 200], // $90-94/kW sale on 5-10 kW LF units
    battPerKwhNaion: [110, 175], // retail sodium packs still scarce → thin premium
    battPerKwhAgm: [280, 380], // retail AGM blocks per usable kWh (50% DoD)
    note: "Shipped retail prices with BMS/enclosure included.",
  },
  {
    id: "landed",
    label: "Landed DIY build (cells shipped + duty)",
    source: "Aggregated community builds, 2025-2026",
    pvPerW: [0.16, 0.28],
    battPerKwhUsable: [80, 125],
    invPerKw: [90, 260],
    battPerKwhNaion: [88, 138], // ~10% premium over LFP landed, Aug 2026
    // AGM realities: 12 V 200 Ah blocks ≈ $350-450 per 2.4 kWh nominal, and
    // only half is usable (50% DoD) → ~$290-375 per USABLE kWh. Blocks ship
    // as finished goods, so ex-factory-to-landed spread is narrower.
    battPerKwhAgm: [240, 330],
    note: "You assemble: cells + BMS + enclosure + freight + duty.",
  },
  {
    id: "cells",
    label: "Ex-factory China (cells only)",
    source: "Cell market indications, Aug 2026",
    pvPerW: [0.11, 0.2],
    battPerKwhUsable: [45, 70], // $43.5 per 314Ah cell ≈ $43/kWh nominal ≈ $48 usable
    invPerKw: [60, 180],
    battPerKwhNaion: [52, 78], // sodium cell lines still ramping → ~15% premium
    battPerKwhAgm: [200, 280], // AGM blocks ex-factory ≈ $120-140/kWh nominal ≈ 2× usable
    note: "Components only, before freight/duty/BMS/enclosure — rarely the final cost.",
  },
];

export function getScope(id) {
  return PRICING_SCOPES.find((s) => s.id === id) || PRICING_SCOPES[0];
}

/** Battery price range for one scope and chemistry. */
function battRangeFor(scope, chemistry) {
  if (chemistry === "naion" && Array.isArray(scope.battPerKwhNaion))
    return scope.battPerKwhNaion;
  if (chemistry === "agm" && Array.isArray(scope.battPerKwhAgm))
    return scope.battPerKwhAgm;
  return scope.battPerKwhUsable;
}

/**
 * Cost range for a system under one scope. The inverter is sized to the
 * load's peak (invKw), NOT the array: a battery-only system still needs an
 * inverter, and a small array on a spiky load needs a big one. Defaults to
 * pvKw when the peak is unknown (back-compat).
 */
export function costRange(
  pvKw,
  battKwhUsable,
  scopeId,
  chemistry = "lfp",
  invKw = null,
) {
  const s = getScope(scopeId);
  const bRange = battRangeFor(s, chemistry);
  const inv = invKw === null || !(invKw >= 0) ? pvKw : invKw;
  const pvLo = pvKw * 1000 * s.pvPerW[0];
  const pvHi = pvKw * 1000 * s.pvPerW[1];
  const bLo = battKwhUsable * bRange[0];
  const bHi = battKwhUsable * bRange[1];
  const invLo = inv * s.invPerKw[0];
  const invHi = inv * s.invPerKw[1];
  return {
    lo: Math.round(pvLo + bLo + invLo),
    hi: Math.round(pvHi + bHi + invHi),
    pvLo: Math.round(pvLo),
    pvHi: Math.round(pvHi),
    invLo: Math.round(invLo),
    invHi: Math.round(invHi),
    pvMid: Math.round((pvLo + pvHi) / 2),
    battMid: Math.round((bLo + bHi) / 2),
    scope: s,
  };
}

/**
 * The ONE range shown in the UI: ex-factory China at the low end through
 * PowMr-class budget retail at the high end. No selector — every result
 * simply states its honest spread. `landedF` scales the landed-DIY midpoint
 * (freight/duty premium) for the region — islands and landlocked countries
 * pay more to get hardware ashore.
 */
export function fullRange(
  pvKw,
  battKwhUsable,
  chemistry = "lfp",
  landedF = 1,
  invKw = null,
) {
  const lo = costRange(pvKw, battKwhUsable, "cells", chemistry, invKw);
  const hi = costRange(pvKw, battKwhUsable, "powmr", chemistry, invKw);
  const landed = costRange(pvKw, battKwhUsable, "landed", chemistry, invKw);
  // Regional freight/duty scales every leg equally, so the landed midpoint
  // can never escape its own displayed range (previously only the mid was
  // scaled, and high-landedF regions showed a mid above the hi end).
  const f = Number.isFinite(landedF) && landedF > 0 ? landedF : 1;
  // search objective sits near the middle of the honest spread (landed DIY)
  const cellsBatt = battRangeFor(getScope("cells"), chemistry);
  const powmrBatt = battRangeFor(getScope("powmr"), chemistry);
  return {
    lo: Math.round(lo.lo * f),
    hi: Math.round(hi.hi * f),
    pvCostLo: Math.round((lo.pvLo + lo.invLo) * f),
    pvCostHi: Math.round((hi.pvHi + hi.invHi) * f),
    battCostLo: Math.round(battKwhUsable * cellsBatt[0] * f),
    battCostHi: Math.round(battKwhUsable * powmrBatt[1] * f),
    battPerKwhLo: cellsBatt[0],
    battPerKwhHi: powmrBatt[1],
    objectiveMid: Math.round(((landed.lo + landed.hi) / 2) * f),
  };
}

/**
 * Landed-mid battery price per usable kWh for ONE chemistry (freight-scaled).
 * Replacement banks must be costed at their own chemistry's rate — AGM banks
 * at lithium $/kWh understated AGM lifetime cost by ~2-3×.
 */
export function landedMidBattKwhFor(chemistry = "lfp", landedF = 1) {
  const scope = getScope("landed");
  const r = battRangeFor(scope, chemistry);
  const f = Number.isFinite(landedF) && landedF > 0 ? landedF : 1;
  return ((r[0] + r[1]) / 2) * f;
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

export const DAYS_PER_MONTH = 30.44; // 365/12, for bill→kWh/day conversion

// ── Regional electricity price estimation ───────────────────────────────────
// Coarse residential rates (USD/kWh) from coordinates. Deliberately rough:
// enough to turn a monthly bill into kWh/day without asking people to know
// their tariff. Country boxes are checked first; regional boxes are the
// fallback. Indicative 2026 residential averages aggregated from public
// tariff trackers — users can always type their exact rate.
// ISO-4217 currencies the estimator knows about. `perUSD` is units of this
// currency per 1 US dollar — used to convert the displayed tariff and all
// output amounts. These static defaults are overwritten by live FX on load
// (see ui.js) and are only a fallback when the network is unavailable.
export const CURRENCIES = {
  USD: { symbol: "$", perUSD: 1, name: "US dollar" },
  EUR: { symbol: "€", perUSD: 0.92, name: "euro" },
  GBP: { symbol: "£", perUSD: 0.79, name: "pound sterling" },
  PLN: { symbol: "zł", perUSD: 3.95, name: "Polish złoty" },
  BRL: { symbol: "R$", perUSD: 5.4, name: "Brazilian real" },
  CLP: { symbol: "$", perUSD: 950, name: "Chilean peso" },
  COP: { symbol: "$", perUSD: 4100, name: "Colombian peso" },
  PEN: { symbol: "S/", perUSD: 3.7, name: "Peruvian sol" },
  MXN: { symbol: "$", perUSD: 17, name: "Mexican peso" },
  PHP: { symbol: "₱", perUSD: 58, name: "Philippine peso" },
  THB: { symbol: "฿", perUSD: 34, name: "Thai baht" },
  VND: { symbol: "₫", perUSD: 25000, name: "Vietnamese đồng" },
  INR: { symbol: "₹", perUSD: 86, name: "Indian rupee" },
  JPY: { symbol: "¥", perUSD: 150, name: "Japanese yen" },
  AUD: { symbol: "A$", perUSD: 1.52, name: "Australian dollar" },
  TRY: { symbol: "₺", perUSD: 34, name: "Turkish lira" },
  ILS: { symbol: "₪", perUSD: 3.7, name: "Israeli new shekel" },
  MAD: { symbol: "DH", perUSD: 10, name: "Moroccan dirham" },
  EGP: { symbol: "E£", perUSD: 48, name: "Egyptian pound" },
  GHS: { symbol: "₵", perUSD: 12, name: "Ghanaian cedi" },
  NGN: { symbol: "₦", perUSD: 1500, name: "Nigerian naira" },
  KES: { symbol: "KSh", perUSD: 130, name: "Kenyan shilling" },
  ZAR: { symbol: "R", perUSD: 18.5, name: "South African rand" },
  CAD: { symbol: "C$", perUSD: 1.35, name: "Canadian dollar" },
  // Every currency a country named in assets/js/sizing/country-currency.js
  // can resolve to. These were absent, so a location in any of those
  // countries either had no currency to select or silently fell back to
  // USD. The static perUSD values are OFFLINE FALLBACKS ONLY --
  // refreshFxRates() overwrites every one of them from a live source.
  AED: { symbol: "د.إ", perUSD: 3.67, name: "UAE dirham" },
  AFN: { symbol: "؋", perUSD: 70, name: "Afghan afghani" },
  ALL: { symbol: "L", perUSD: 92, name: "Albanian lek" },
  AMD: { symbol: "֏", perUSD: 385, name: "Armenian dram" },
  ANG: { symbol: "ƒ", perUSD: 1.79, name: "Netherlands Antillean guilder" },
  AOA: { symbol: "Kz", perUSD: 900, name: "Angolan kwanza" },
  ARS: { symbol: "$", perUSD: 1400, name: "Argentine peso" },
  AWG: { symbol: "ƒ", perUSD: 1.79, name: "Aruban florin" },
  AZN: { symbol: "₼", perUSD: 1.7, name: "Azerbaijani manat" },
  BAM: { symbol: "KM", perUSD: 1.79, name: "Bosnia-Herzegovina mark" },
  BBD: { symbol: "$", perUSD: 2, name: "Barbadian dollar" },
  BDT: { symbol: "৳", perUSD: 122, name: "Bangladeshi taka" },
  BHD: { symbol: "BD", perUSD: 0.376, name: "Bahraini dinar" },
  BIF: { symbol: "FBu", perUSD: 2900, name: "Burundian franc" },
  BMD: { symbol: "BD$", perUSD: 1, name: "Bermudian dollar" },
  BND: { symbol: "$", perUSD: 1.3, name: "Brunei dollar" },
  BOB: { symbol: "Bs", perUSD: 6.9, name: "Bolivian boliviano" },
  BSD: { symbol: "B$", perUSD: 1, name: "Bahamian dollar" },
  BTN: { symbol: "Nu.", perUSD: 134, name: "Bhutanese ngultrum" },
  BWP: { symbol: "P", perUSD: 13.9, name: "Botswana pula" },
  BYN: { symbol: "Br", perUSD: 3.28, name: "Belarusian ruble" },
  BZD: { symbol: "BZ$", perUSD: 2.02, name: "Belize dollar" },
  CDF: { symbol: "FC", perUSD: 2700, name: "Congolese franc" },
  CHF: { symbol: "CHF", perUSD: 0.88, name: "Swiss franc" },
  CNY: { symbol: "¥", perUSD: 7.1, name: "Chinese yuan" },
  CRC: { symbol: "₡", perUSD: 520, name: "Costa Rican colon" },
  CUP: { symbol: "$", perUSD: 24, name: "Cuban peso" },
  CVE: { symbol: "CVE$", perUSD: 110, name: "Cape Verdean escudo" },
  CZK: { symbol: "Kč", perUSD: 23, name: "Czech koruna" },
  DJF: { symbol: "Fdj", perUSD: 177, name: "Djiboutian franc" },
  DKK: { symbol: "kr", perUSD: 6.9, name: "Danish krone" },
  DOP: { symbol: "RD$", perUSD: 60, name: "Dominican peso" },
  DZD: { symbol: "DA", perUSD: 135, name: "Algerian dinar" },
  ERN: { symbol: "Nfk", perUSD: 15, name: "Eritrean nakfa" },
  ETB: { symbol: "Br", perUSD: 130, name: "Ethiopian birr" },
  FJD: { symbol: "$", perUSD: 2.25, name: "Fijian dollar" },
  GEL: { symbol: "₾", perUSD: 2.7, name: "Georgian lari" },
  GIP: { symbol: "GI£", perUSD: 0.83, name: "Gibraltar pound" },
  GMD: { symbol: "D", perUSD: 68, name: "Gambian dalasi" },
  GNF: { symbol: "FG", perUSD: 8600, name: "Guinean franc" },
  GTQ: { symbol: "Q", perUSD: 7.85, name: "Guatemalan quetzal" },
  GYD: { symbol: "GY$", perUSD: 209, name: "Guyanese dollar" },
  HKD: { symbol: "HK$", perUSD: 7.8, name: "Hong Kong dollar" },
  HNL: { symbol: "L", perUSD: 24.7, name: "Honduran lempira" },
  HTG: { symbol: "G", perUSD: 130, name: "Haitian gourde" },
  HUF: { symbol: "Ft", perUSD: 355, name: "Hungarian forint" },
  IDR: { symbol: "Rp", perUSD: 16200, name: "Indonesian rupiah" },
  IQD: { symbol: "IQD", perUSD: 1310, name: "Iraqi dinar" },
  IRR: { symbol: "IRR", perUSD: 420000, name: "Iranian rial" },
  ISK: { symbol: "kr", perUSD: 138, name: "Icelandic krona" },
  JMD: { symbol: "J$", perUSD: 156, name: "Jamaican dollar" },
  JOD: { symbol: "JD", perUSD: 0.709, name: "Jordanian dinar" },
  KGS: { symbol: "с", perUSD: 89, name: "Kyrgyzstani som" },
  KHR: { symbol: "KHR", perUSD: 4100, name: "Cambodian riel" },
  KMF: { symbol: "FC", perUSD: 452, name: "Comorian franc" },
  KPW: { symbol: "₩", perUSD: 150, name: "North Korean won" },
  KRW: { symbol: "₩", perUSD: 1350, name: "South Korean won" },
  KWD: { symbol: "KD", perUSD: 0.308, name: "Kuwaiti dinar" },
  KYD: { symbol: "CI$", perUSD: 0.82, name: "Cayman Islands dollar" },
  KZT: { symbol: "₸", perUSD: 470, name: "Kazakhstani tenge" },
  LAK: { symbol: "₭", perUSD: 21000, name: "Lao kip" },
  LBP: { symbol: "LBP", perUSD: 89000, name: "Lebanese pound" },
  LKR: { symbol: "Rs", perUSD: 290, name: "Sri Lankan rupee" },
  LRD: { symbol: "$", perUSD: 190, name: "Liberian dollar" },
  LSL: { symbol: "L", perUSD: 18.5, name: "Lesotho loti" },
  LYD: { symbol: "LD", perUSD: 4.8, name: "Libyan dinar" },
  MDL: { symbol: "L", perUSD: 17.5, name: "Moldovan leu" },
  MGA: { symbol: "Ar", perUSD: 4500, name: "Malagasy ariary" },
  MKD: { symbol: "ден", perUSD: 57, name: "Macedonian denar" },
  MMK: { symbol: "K", perUSD: 2100, name: "Burmese kyat" },
  MNT: { symbol: "₮", perUSD: 3400, name: "Mongolian tugrik" },
  MOP: { symbol: "MOP$", perUSD: 8, name: "Macanese pataca" },
  MRU: { symbol: "UM", perUSD: 40, name: "Mauritanian ouguiya" },
  MUR: { symbol: "Rs", perUSD: 45, name: "Mauritian rupee" },
  MVR: { symbol: "Rf", perUSD: 15.4, name: "Maldivian rufiyaa" },
  MWK: { symbol: "MK", perUSD: 1750, name: "Malawian kwacha" },
  MYR: { symbol: "RM", perUSD: 4.7, name: "Malaysian ringgit" },
  MZN: { symbol: "MT", perUSD: 63.8, name: "Mozambican metical" },
  NAD: { symbol: "N$", perUSD: 18.5, name: "Namibian dollar" },
  NIO: { symbol: "C$", perUSD: 36.7, name: "Nicaraguan cordoba" },
  NOK: { symbol: "kr", perUSD: 10.8, name: "Norwegian krone" },
  NPR: { symbol: "Rs", perUSD: 133, name: "Nepalese rupee" },
  NZD: { symbol: "NZ$", perUSD: 1.66, name: "New Zealand dollar" },
  OMR: { symbol: "OMR", perUSD: 0.384, name: "Omani rial" },
  PAB: { symbol: "B/.", perUSD: 1, name: "Panamanian balboa" },
  PGK: { symbol: "K", perUSD: 3.9, name: "Papua New Guinean kina" },
  PKR: { symbol: "Rs", perUSD: 278, name: "Pakistani rupee" },
  PYG: { symbol: "Gs", perUSD: 7300, name: "Paraguayan guarani" },
  QAR: { symbol: "QR", perUSD: 3.64, name: "Qatari riyal" },
  RON: { symbol: "lei", perUSD: 4.58, name: "Romanian leu" },
  RSD: { symbol: "дин.", perUSD: 107, name: "Serbian dinar" },
  RUB: { symbol: "₽", perUSD: 92, name: "Russian ruble" },
  RWF: { symbol: "FRw", perUSD: 1300, name: "Rwandan franc" },
  SAR: { symbol: "SR", perUSD: 3.75, name: "Saudi riyal" },
  SBD: { symbol: "SI$", perUSD: 8.7, name: "Solomon Islands dollar" },
  SCR: { symbol: "Rs", perUSD: 14, name: "Seychellois rupee" },
  SDG: { symbol: "SDG", perUSD: 450, name: "Sudanese pound" },
  SEK: { symbol: "kr", perUSD: 10.6, name: "Swedish krona" },
  SGD: { symbol: "S$", perUSD: 1.35, name: "Singapore dollar" },
  SLE: { symbol: "Le", perUSD: 22, name: "Sierra Leonean leone" },
  SOS: { symbol: "Sh", perUSD: 570, name: "Somali shilling" },
  SRD: { symbol: "$", perUSD: 35, name: "Surinamese dollar" },
  SSP: { symbol: "SSP", perUSD: 1300, name: "South Sudanese pound" },
  STN: { symbol: "Db", perUSD: 22, name: "Sao Tomean dobra" },
  SYP: { symbol: "SYP", perUSD: 13000, name: "Syrian pound" },
  SZL: { symbol: "E", perUSD: 18.5, name: "Swazi lilangeni" },
  TJS: { symbol: "ЅМ", perUSD: 10.9, name: "Tajikistani somoni" },
  TMT: { symbol: "m", perUSD: 3.5, name: "Turkmenistani manat" },
  TND: { symbol: "DT", perUSD: 3.1, name: "Tunisian dinar" },
  TOP: { symbol: "T$", perUSD: 2.3, name: "Tongan paanga" },
  TTD: { symbol: "TT$", perUSD: 6.8, name: "Trinidad and Tobago dollar" },
  TWD: { symbol: "NT$", perUSD: 32, name: "New Taiwan dollar" },
  TZS: { symbol: "TSh", perUSD: 2700, name: "Tanzanian shilling" },
  UAH: { symbol: "₴", perUSD: 41, name: "Ukrainian hryvnia" },
  UGX: { symbol: "USh", perUSD: 3700, name: "Ugandan shilling" },
  UYU: { symbol: "$U", perUSD: 38, name: "Uruguayan peso" },
  UZS: { symbol: "so'm", perUSD: 12900, name: "Uzbekistani som" },
  VES: { symbol: "Bs.", perUSD: 36, name: "Venezuelan bolivar" },
  VUV: { symbol: "VT", perUSD: 115, name: "Vanuatu vatu" },
  WST: { symbol: "T", perUSD: 2.7, name: "Samoan tala" },
  XAF: { symbol: "FCFA", perUSD: 600, name: "Central African CFA franc" },
  XCD: { symbol: "EC$", perUSD: 2.7, name: "East Caribbean dollar" },
  XOF: { symbol: "CFA", perUSD: 600, name: "West African CFA franc" },
  XPF: { symbol: "₣", perUSD: 110, name: "CFP franc" },
  YER: { symbol: "YER", perUSD: 250, name: "Yemeni rial" },
  ZMW: { symbol: "ZK", perUSD: 27, name: "Zambian kwacha" },
  ZWL: { symbol: "Z$", perUSD: 13000, name: "Zimbabwean dollar" },
};

// Last-update timestamp for the FX rates in use (set by live fetch in ui.js).
export const fxMeta = { asOf: null };

const TARIFF_BOXES = [
  // Country-level refinement (most-specific first). `currency` is the ISO
  // code auto-selected when this box matches; null for multi-country boxes
  // where a single currency would be wrong. laborF scales install labor
  // (baseline $12–30/usable kWh); landedF scales the landed-hardware
  // freight/duty premium (islands and landlocked regions pay the most).
  {
    box: [47.0, 55.5, 5.0, 15.5],
    rate: 0.4,
    label: "Germany",
    currency: "EUR",
    laborF: 2.2,
    landedF: 1.1,
  },
  {
    box: [49.5, 61.0, -8.5, 2.0],
    rate: 0.34,
    label: "United Kingdom / Ireland",
    currency: "GBP",
    laborF: 1.9,
    landedF: 1.1,
  },
  {
    box: [36.0, 47.5, 6.0, 19.0],
    rate: 0.42,
    label: "Italy",
    currency: "EUR",
    laborF: 1.8,
    landedF: 1.1,
  },
  {
    box: [35.5, 44.0, -10.0, 4.5],
    rate: 0.26,
    label: "Spain / Portugal",
    currency: "EUR",
    laborF: 1.5,
    landedF: 1.1,
  },
  {
    box: [41.0, 51.5, -5.5, 10.0],
    rate: 0.25,
    label: "France / Belgium / Netherlands",
    currency: "EUR",
    laborF: 2.0,
    landedF: 1.1,
  },
  {
    box: [48.5, 55.0, 13.5, 24.5],
    rate: 0.2,
    label: "Poland / Czechia / Slovakia",
    currency: "PLN",
    laborF: 1.2,
    landedF: 1.1,
  },
  {
    box: [55.0, 60.0, 20.0, 28.5],
    rate: 0.21,
    label: "Finland / Baltics",
    currency: "EUR",
    laborF: 1.6,
    landedF: 1.15,
  },
  // US first so its states never fall into the later Mexico / regional boxes.
  // currency is USD (not null) so any US location actively resets the
  // display currency back to USD when the user hasn't chosen one manually.
  {
    box: [24, 50, -125, -66],
    rate: 0.17,
    label: "US mainland",
    currency: "USD",
    laborF: 1.5,
    landedF: 1.05,
  },
  {
    box: [50.5, 72, -168, -129],
    rate: 0.24,
    label: "Alaska, United States",
    currency: "USD",
    laborF: 1.7,
    landedF: 1.35,
  },
  {
    box: [-56.0, -17.0, -74.0, -34.0],
    rate: 0.17,
    label: "Brazil",
    currency: "BRL",
    laborF: 0.9,
    landedF: 1.6,
  },
  {
    box: [-30.0, -17.0, -73.0, -53.0],
    rate: 0.16,
    label: "Chile / Uruguay",
    currency: "CLP",
    laborF: 1.0,
    landedF: 1.35,
  },
  {
    box: [0.0, 12.5, -79.0, -71.0],
    rate: 0.2,
    label: "Colombia / Venezuela",
    currency: "COP",
    laborF: 0.8,
    landedF: 1.4,
  },
  {
    box: [-20.5, -0.5, -81.5, -75.0],
    rate: 0.14,
    label: "Peru / Ecuador",
    currency: "PEN",
    laborF: 0.7,
    landedF: 1.3,
  },
  {
    box: [14.5, 33.0, -118.0, -86.0],
    rate: 0.16,
    label: "Mexico",
    currency: "MXN",
    laborF: 0.9,
    landedF: 1.2,
  },
  {
    box: [4.0, 21.5, 116.0, 127.0],
    rate: 0.19,
    label: "Philippines",
    currency: "PHP",
    laborF: 0.6,
    landedF: 1.25,
  },
  {
    box: [-11.5, 6.5, 94.5, 141.5],
    rate: 0.11,
    label: "Indonesia / Malaysia / Singapore",
    currency: null,
    laborF: 0.6,
    landedF: 1.2,
  },
  {
    box: [5.5, 20.5, 97.0, 106.0],
    rate: 0.13,
    label: "Thailand / Myanmar / Cambodia / Laos",
    currency: "THB",
    laborF: 0.5,
    landedF: 1.2,
  },
  {
    box: [8.0, 24.0, 102.0, 110.0],
    rate: 0.08,
    label: "Vietnam",
    currency: "VND",
    laborF: 0.5,
    landedF: 1.15,
  },
  {
    box: [6.0, 36.0, 68.0, 98.0],
    rate: 0.08,
    label: "India / Pakistan / Bangladesh / Nepal",
    currency: "INR",
    laborF: 0.4,
    landedF: 1.25,
  },
  {
    box: [30.5, 46.5, 128.5, 146.5],
    rate: 0.2,
    label: "Japan / South Korea",
    currency: "JPY",
    laborF: 1.7,
    landedF: 1.05,
  },
  {
    box: [-50.0, -9.5, 111.0, 180.0],
    rate: 0.29,
    label: "Australia / New Zealand",
    currency: "AUD",
    laborF: 1.7,
    landedF: 1.2,
  },
  {
    box: [20.0, 32.5, 34.0, 60.0],
    rate: 0.09,
    label: "Saudi Arabia / UAE / Qatar / Oman / Kuwait",
    currency: null,
    laborF: 1.0,
    landedF: 1.1,
  },
  {
    box: [35.5, 42.5, 25.5, 45.0],
    rate: 0.11,
    label: "Turkey",
    currency: "TRY",
    laborF: 0.7,
    landedF: 1.3,
  },
  {
    box: [29.5, 32.0, 34.0, 36.0],
    rate: 0.16,
    label: "Israel / Jordan",
    currency: "ILS",
    laborF: 1.2,
    landedF: 1.25,
  },
  {
    box: [20.5, 32.5, -18.0, -1.0],
    rate: 0.14,
    label: "Morocco / Algeria / Tunisia",
    currency: "MAD",
    laborF: 0.6,
    landedF: 1.3,
  },
  {
    box: [21.5, 32.0, 24.0, 37.0],
    rate: 0.05,
    label: "Egypt / Libya / Sudan",
    currency: "EGP",
    laborF: 0.4,
    landedF: 1.3,
  },
  {
    box: [4.5, 12.5, -4.5, 2.5],
    rate: 0.14,
    label: "Ghana / Côte d'Ivoire / Togo",
    currency: "GHS",
    laborF: 0.5,
    landedF: 1.35,
  },
  {
    box: [3.0, 14.5, 2.5, 15.5],
    rate: 0.07,
    label: "Nigeria / Niger / Benin / Cameroon",
    currency: "NGN",
    laborF: 0.4,
    landedF: 1.35,
  },
  {
    box: [-5.5, 5.5, 33.0, 42.0],
    rate: 0.19,
    label: "Kenya / Uganda / Tanzania / Rwanda",
    currency: "KES",
    laborF: 0.5,
    landedF: 1.35,
  },
  {
    box: [-35.5, -17.5, 15.5, 33.5],
    rate: 0.18,
    label: "South Africa / Namibia / Botswana",
    currency: "ZAR",
    laborF: 0.8,
    landedF: 1.3,
  },
  {
    box: [3.5, 12.0, 8.0, 24.0],
    rate: 0.12,
    label: "Chad / CAR / South Sudan / Ethiopia",
    currency: null,
    laborF: 0.4,
    landedF: 1.5,
  },
  // Regional fallbacks (no single currency — do not auto-set)
  {
    box: [18.5, 28.5, -179, -154],
    rate: 0.42,
    label: "Hawaii / Pacific islands",
    currency: null,
    laborF: 1.8,
    landedF: 1.4,
  },
  {
    box: [59, 72, 24, 46],
    rate: 0.18,
    label: "Nordics / Baltic",
    currency: null,
    laborF: 1.6,
    landedF: 1.1,
  },
  {
    box: [49.5, 61, -9, 3],
    rate: 0.34,
    label: "UK / Ireland",
    currency: null,
    laborF: 1.9,
    landedF: 1.1,
  },
  {
    box: [35.5, 72, -11, 41],
    rate: 0.29,
    label: "Europe",
    currency: null,
    laborF: 1.8,
    landedF: 1.1,
  },
  {
    box: [42, 71, -141, -52],
    rate: 0.13,
    label: "Canada",
    currency: "CAD",
    laborF: 1.5,
    landedF: 1.1,
  },
  {
    box: [7, 25, -93, -58],
    rate: 0.33,
    label: "Caribbean & Central America",
    currency: null,
    laborF: 0.8,
    landedF: 1.35,
  },
  {
    box: [-56, 13, -82, -34],
    rate: 0.16,
    label: "South America",
    currency: null,
    laborF: 0.9,
    landedF: 1.35,
  },
  {
    box: [22, 47, 123, 147],
    rate: 0.21,
    label: "Japan / Korea",
    currency: null,
    laborF: 1.7,
    landedF: 1.05,
  },
  {
    box: [-48, -9, 110, 180],
    rate: 0.26,
    label: "Australia / New Zealand",
    currency: null,
    laborF: 1.7,
    landedF: 1.2,
  },
  {
    box: [5, 37, 60, 98],
    rate: 0.08,
    label: "South Asia",
    currency: null,
    laborF: 0.4,
    landedF: 1.25,
  },
  {
    box: [18, 54, 73, 135],
    rate: 0.09,
    label: "China / Mongolia",
    currency: null,
    laborF: 0.7,
    landedF: 1.0,
  },
  {
    box: [-12, 26, 90, 142],
    rate: 0.12,
    label: "Southeast Asia",
    currency: null,
    laborF: 0.55,
    landedF: 1.2,
  },
  {
    box: [12, 43, 33, 64],
    rate: 0.09,
    label: "Middle East",
    currency: null,
    laborF: 1.0,
    landedF: 1.1,
  },
  {
    box: [-36, 38, -19, 53],
    rate: 0.16,
    label: "Africa",
    currency: null,
    laborF: 0.5,
    landedF: 1.35,
  },
];

// US state-level average residential electricity prices (EIA-style 2023-24,
// cents/kWh). Used when a catalog city carries its two-letter state code so
// New York doesn't get the whole-mainland lump rate and Louisiana doesn't get
// Hawaii's price. `currency` stays null: the US displays in USD by default.
export const US_STATES = {
  AL: { name: "Alabama", cents: 14.4 },
  AK: { name: "Alaska", cents: 23.6 },
  AZ: { name: "Arizona", cents: 13.6 },
  AR: { name: "Arkansas", cents: 12.2 },
  CA: { name: "California", cents: 30.2 },
  CO: { name: "Colorado", cents: 14.4 },
  CT: { name: "Connecticut", cents: 27.0 },
  DE: { name: "Delaware", cents: 16.6 },
  DC: { name: "District of Columbia", cents: 17.4 },
  FL: { name: "Florida", cents: 15.1 },
  GA: { name: "Georgia", cents: 14.1 },
  HI: { name: "Hawaii", cents: 44.0 },
  ID: { name: "Idaho", cents: 11.8 },
  IL: { name: "Illinois", cents: 16.6 },
  IN: { name: "Indiana", cents: 15.1 },
  IA: { name: "Iowa", cents: 12.5 },
  KS: { name: "Kansas", cents: 14.1 },
  KY: { name: "Kentucky", cents: 12.6 },
  LA: { name: "Louisiana", cents: 11.9 },
  ME: { name: "Maine", cents: 21.7 },
  MD: { name: "Maryland", cents: 16.7 },
  MA: { name: "Massachusetts", cents: 28.5 },
  MI: { name: "Michigan", cents: 18.3 },
  MN: { name: "Minnesota", cents: 14.4 },
  MS: { name: "Mississippi", cents: 13.7 },
  MO: { name: "Missouri", cents: 13.3 },
  MT: { name: "Montana", cents: 12.7 },
  NE: { name: "Nebraska", cents: 12.4 },
  NV: { name: "Nevada", cents: 16.4 },
  NH: { name: "New Hampshire", cents: 24.0 },
  NJ: { name: "New Jersey", cents: 17.9 },
  NM: { name: "New Mexico", cents: 14.8 },
  NY: { name: "New York", cents: 23.0 },
  NC: { name: "North Carolina", cents: 13.7 },
  ND: { name: "North Dakota", cents: 11.6 },
  OH: { name: "Ohio", cents: 15.7 },
  OK: { name: "Oklahoma", cents: 12.5 },
  OR: { name: "Oregon", cents: 13.1 },
  PA: { name: "Pennsylvania", cents: 17.3 },
  RI: { name: "Rhode Island", cents: 27.7 },
  SC: { name: "South Carolina", cents: 14.1 },
  SD: { name: "South Dakota", cents: 12.0 },
  TN: { name: "Tennessee", cents: 13.0 },
  TX: { name: "Texas", cents: 14.2 },
  UT: { name: "Utah", cents: 11.5 },
  VT: { name: "Vermont", cents: 21.2 },
  VA: { name: "Virginia", cents: 14.2 },
  WA: { name: "Washington", cents: 11.8 },
  WV: { name: "West Virginia", cents: 14.8 },
  WI: { name: "Wisconsin", cents: 15.8 },
  WY: { name: "Wyoming", cents: 12.0 },
};

// Accept either a two-letter state code ("LA") or a full state name
// ("Louisiana") and return the canonical code, or null if not a US state.
export function usStateCode(region) {
  if (!region) return null;
  const s = String(region).trim();
  if (Object.prototype.hasOwnProperty.call(US_STATES, s.toUpperCase()))
    return s.toUpperCase();
  const hit = Object.values(US_STATES).find(
    (st) => st.name.toUpperCase() === s.toUpperCase(),
  );
  return hit
    ? Object.keys(US_STATES).find((code) => US_STATES[code] === hit)
    : null;
}

export function estimateTariff(lat, lon, region, country) {
  const st = usStateCode(region);
  if (st) {
    const state = US_STATES[st];
    return {
      rate: +(state.cents / 100).toFixed(4),
      label: `${state.name}, United States`,
      currency: "USD",
      laborF: 1.5,
      landedF: 1.05,
      state: st,
    };
  }
  // Canada: province codes ("02", "08", …) aren't US states, so resolve by
  // country BEFORE the box loop — otherwise Toronto/Montreal/Vancouver fall
  // inside the US mainland box and get USD rates.
  const cUp = String(country || "")
    .trim()
    .toUpperCase();
  const rUp = String(region || "")
    .trim()
    .toUpperCase();
  if (cUp === "CA" || cUp === "CANADA" || rUp === "CA" || rUp === "CANADA") {
    return {
      rate: 0.13,
      label: "Canada",
      currency: "CAD",
      laborF: 1.5,
      landedF: 1.1,
    };
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return {
      rate: 0.28,
      label: "global average",
      currency: null,
      laborF: 1,
      landedF: 1.1,
    };
  }
  for (const t of TARIFF_BOXES) {
    const [latMin, latMax, lonMin, lonMax] = t.box;
    if (lat >= latMin && lat <= latMax && lon >= lonMin && lon <= lonMax) {
      return {
        rate: t.rate,
        label: t.label,
        currency: t.currency || null,
        laborF: t.laborF,
        landedF: t.landedF,
      };
    }
  }
  return {
    rate: 0.28,
    label: "global average",
    currency: null,
    laborF: 1,
    landedF: 1.1,
  };
}
