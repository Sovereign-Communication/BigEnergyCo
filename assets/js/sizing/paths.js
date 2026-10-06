// The four ways to buy one system, in one place, priced the same way.
//
// Why this file exists. D-01 names four purchase paths — turnkey installer,
// lease or PPA, self-purchase with a licensed electrician, and DIY mounting
// with an electrician connection — and R-PATH-01..08 require all four priced
// for the SAME sized system over the SAME 20 years with the SAME definitions.
// Before this module the flow had one path and a proxy for a second:
//
//   turnkey   was our OWN hardware estimate times 10 (low) and 5 (high). A
//             quote derived from the thing it is compared against is not an
//             independent benchmark, and cannot move independently of it.
//   hookup    was a flat $1,500-$3,000 literal, the same on a 2 kW system and
//             a 20 kW one.
//   lease/PPA did not exist in any form.
//   permits, inspection and interconnection were prose, not line items.
//   incentives were absent, so a path that forgoes them looked free.
//
// Three rules this file exists to enforce:
//
//   1. ONE OWNER. Every path, price component and definition is declared here.
//      The UI renders this, the gate walks this, the tests price this. Four
//      paths computed at four call sites cannot be compared, because nothing
//      forces them to count the same things.
//
//   2. ONE SYSTEM. `priceAllPaths` takes a single `system` and prices all four
//      from it. A path quietly priced against a different size, chemistry or
//      replacement count is exactly the asymmetry that made the old
//      comparison meaningless.
//
//   3. AN HONEST VERDICT. Every path can refuse: a path blocked by D-10
//      legality says why, and R-PATH-05 forbids silence — a path with no
//      verified incentive says so in words, and a lease says explicitly that
//      the incentive went to the provider instead of showing nothing.
//
// SOURCES AND GRADES. Every figure is a PLANNING ESTIMATE with a stated
// basis, not a quote and not a survey. The registry is per-region rather than
// per-country on purpose: an unverified per-country number is a worse lie
// than an honest regional one, and a region with no verified incentive entry
// says so rather than borrowing a US figure. Each entry carries `source` and
// `grade` so nothing downstream claims more precision than its weakest input
// supports (P10.2). Generic labels only; D-05 forbids naming a firm.

/** @typedef {"turnkey"|"lease"|"selfpurchase"|"diy"} PathId */

/** Canonical order. D-01 lists them in this order; so is the UI. */
export const PATH_IDS = ["turnkey", "lease", "selfpurchase", "diy"];

export const DEFAULT_PATH_ID = "turnkey";

/** One horizon for every path (D-20). */
export const HORIZON_YEARS = 20;

/** Install labour per usable battery kWh, paid again on every bank swap. */
const BANK_LABOUR_PER_KWH = [12, 21, 30];

/**
 * Degradation (plan §6.4): E_1 = E_sim x (1 - d_1), E_y = E_1 x (1 - d_ann)^(y-1).
 * The defaults are the cited PVWatts values, and they are defaults: nothing
 * presents them as a measurement of the visitor's own array.
 */
export const DEGRADATION = { firstYear: 0.02, annual: 0.005 };

/**
 * THE PRICE REGISTRY, one row per region block.
 *
 * Columns, in order. `tk*` are the all-in TURNKEY figures — hardware,
 * labour, permits and the installer's margin already included, which is why
 * the cash paths add their own fees instead of borrowing them. `hw*` are the
 * hardware a self-purchaser actually buys, so the cash paths buy comparable
 * goods to the benchmark. The `elec*` columns are the labour model: a base
 * visit plus per-unit terms, priced at the hourly rate; `elecConnect*` is the
 * CONNECTION-ONLY variant with no racking and no roof work. Every money
 * column is [low, mid, high]; the hours columns are mid-only because an hour
 * count is not an estimate range anyone can act on.
 */
const REGION_COLUMNS = [
  "tkPvPerW",
  "tkBattPerKwh",
  "tkInvPerKw",
  "hwPvPerW",
  "hwBattPerKwh",
  "hwInvPerKw",
  "elecRate",
  "elecBaseH",
  "elecPerKwH",
  "elecPerKwhH",
  "connectBaseH",
  "connectPerKwhH",
  "permit",
  "inspection",
  "interconnection",
  "diyTools",
  "omPct",
  "inverterYears",
];

const REGION_ROWS = {
  us: {
    label: "United States and Canada",
    grade: "B",
    source:
      "US/CA residential installed-price surveys and interconnection cost studies, 2024-2026",
    escalationPct: 0.02,
    values: [
      [2.6, 3.4, 4.4],
      [420, 560, 780],
      [180, 260, 400],
      [1.35, 1.85, 2.6],
      [150, 205, 300],
      [110, 165, 260],
      [95, 130, 185],
      3,
      2.2,
      0.35,
      2,
      0.28,
      [180, 420, 950],
      [120, 260, 600],
      [250, 700, 1800],
      [280, 520, 1100],
      [0.005, 0.01, 0.02],
      [10, 13, 15],
    ],
  },
  eu: {
    label: "Europe and the UK",
    grade: "B",
    source:
      "EU/UK residential installed-price surveys and distribution-operator connection schedules, 2024-2026",
    escalationPct: 0.025,
    values: [
      [1.9, 2.5, 3.2],
      [330, 440, 620],
      [150, 220, 330],
      [1.0, 1.4, 1.95],
      [120, 165, 240],
      [95, 145, 220],
      [70, 95, 140],
      3,
      2.0,
      0.3,
      2,
      0.25,
      [120, 300, 700],
      [90, 200, 450],
      [150, 450, 1200],
      [220, 420, 900],
      [0.005, 0.01, 0.02],
      [12, 15, 18],
    ],
  },
  apac: {
    label: "Asia-Pacific and Southern Africa",
    grade: "B",
    source: "AU/NZ/JP/IN/ZA residential installed-price surveys, 2024-2026",
    escalationPct: 0.02,
    values: [
      [1.7, 2.3, 3.0],
      [300, 410, 580],
      [140, 200, 310],
      [0.9, 1.25, 1.75],
      [110, 150, 220],
      [85, 130, 200],
      [55, 80, 120],
      3,
      1.8,
      0.28,
      2,
      0.22,
      [80, 220, 520],
      [60, 150, 340],
      [100, 320, 850],
      [180, 350, 750],
      [0.005, 0.01, 0.02],
      [10, 13, 15],
    ],
  },
  // The fallback block, and deliberately the weakest grade on every card: a
  // visitor in a country with no verified data is told the numbers are
  // derived, not measured.
  row: {
    label: "Rest of world",
    grade: "C",
    source: "Derived from the blocks above; the weakest input on every card",
    escalationPct: 0.02,
    values: [
      [2.2, 3.0, 4.0],
      [370, 500, 700],
      [160, 240, 360],
      [1.2, 1.6, 2.2],
      [135, 180, 265],
      [100, 150, 235],
      [45, 70, 110],
      3,
      2.0,
      0.3,
      2,
      0.25,
      [90, 250, 600],
      [70, 170, 400],
      [120, 380, 1000],
      [200, 380, 820],
      [0.005, 0.01, 0.02],
      [10, 13, 15],
    ],
  },
};

export const REGION_IDS = Object.keys(REGION_ROWS);

/** Expand the row table into named fields, so no pricing code indexes by column. */
function expandRegion(row) {
  const out = {
    label: row.label,
    grade: row.grade,
    source: row.source,
    escalationPct: row.escalationPct,
    // No verified escalation source for every region, so the default is
    // flagged rather than presented as measured.
    escalationGraded: false,
  };
  REGION_COLUMNS.forEach((col, i) => {
    out[col] = row.values[i];
  });
  return out;
}

const REGIONS = Object.fromEntries(
  Object.entries(REGION_ROWS).map(([id, row]) => [id, expandRegion(row)]),
);

const REGION_COUNTRIES = {
  us: ["us", "ca"],
  eu: [
    "gb",
    "ie",
    "de",
    "fr",
    "es",
    "pt",
    "it",
    "nl",
    "be",
    "at",
    "ch",
    "dk",
    "se",
    "no",
    "fi",
    "pl",
    "cz",
    "hu",
    "ro",
    "gr",
    "si",
    "sk",
    "hr",
    "ee",
    "lv",
    "lt",
    "is",
    "lu",
    "mt",
    "cy",
  ],
  apac: [
    "au",
    "nz",
    "jp",
    "kr",
    "sg",
    "in",
    "za",
    "ph",
    "id",
    "my",
    "th",
    "vn",
  ],
};

/** Region block for an ISO country code; unknown countries get the weak block. */
export function regionForCountry(country) {
  const c = String(country || "")
    .trim()
    .toLowerCase();
  if (!c) return "row";
  for (const [region, list] of Object.entries(REGION_COUNTRIES))
    if (list.includes(c)) return region;
  return "row";
}

export function registryFor(region) {
  return REGIONS[region] || REGIONS.row;
}

/**
 * LEASE / PPA TERMS (R-PATH-02). Two instruments because they behave
 * differently, and conflating them is how "a lease costs nothing" happens: a
 * PPA buys ENERGY and the provider keeps the system; a lease rents the SYSTEM
 * and ends, which is a real fork with a real buyout price.
 */
const LEASE_TERMS = {
  ppa: {
    instrument: "ppa",
    labelKey: "pathsInstrumentPpa",
    discountPct: [0.05, 0.1, 0.18],
    downPaymentPct: [0, 0, 0.1],
    escPct: [0, 0.015, 0.039],
    termYears: [20, 25, 25],
    buyoutPct: null,
    grade: "C",
    source: "Published residential PPA discount ranges, 2023-2026",
  },
  lease: {
    instrument: "lease",
    labelKey: "pathsInstrumentLease",
    monthlyUsdPerKwh: [0.09, 0.13, 0.19],
    downPaymentPct: [0, 0.05, 0.15],
    escPct: [0, 0.02, 0.039],
    termYears: [10, 15, 20],
    buyoutPct: [0.15, 0.3, 0.45],
    grade: "C",
    source: "Published residential solar-lease payment ranges, 2023-2026",
  },
};

export const LEASE_INSTRUMENTS = ["ppa", "lease"];

/**
 * INCENTIVES (R-PATH-05). Registry entries, not prose, and the field that
 * matters is `eligiblePaths`: an incentive that goes to the system owner is
 * worth nothing to a PPA subscriber, and a self-purchaser cannot also claim an
 * installer-only rebate. Naming the eligible paths is what stops the four
 * cards being compared with different things counted.
 *
 * `eu`, `apac` and `row` are present and EMPTY on purpose: this repo has no
 * verified per-country incentive registry (the provenance finding, still
 * open), so those regions report the honest "no incentives included" line
 * rather than a borrowed US number.
 */
export const INCENTIVES = {
  us: [
    {
      id: "residential-credit",
      type: "tax-credit",
      labelKey: "pathsIncentiveTaxCredit",
      amountPctOfYear0: [0.22, 0.3, 0.3],
      capUsd: [3200, 8000, 8000],
      eligiblePaths: ["selfpurchase", "diy"],
      grade: "C",
      source:
        "US federal residential clean-energy credit; expiry and phase-down must be checked",
    },
    {
      id: "utility-rebate",
      type: "upfront-rebate",
      labelKey: "pathsIncentiveRebate",
      amountPctOfYear0: [0.03, 0.08, 0.15],
      capUsd: [200, 1000, 3000],
      eligiblePaths: ["turnkey"],
      grade: "C",
      source:
        "Typical state and utility residential solar rebate bands, 2024-2026",
    },
  ],
  eu: [],
  apac: [],
  row: [],
};

/** Incentives a given path can actually claim in a region. */
export function incentivesFor(region, pathId) {
  const list = INCENTIVES[region] || INCENTIVES.row || [];
  return list.filter((i) => i.eligiblePaths.includes(pathId));
}

/**
 * D-10 LEGALITY. `diyMounting` is whether a homeowner may mount their own
 * array; `electricalDiy` is whether they may do the electrical work, which is
 * the case where the DIY path is NOT offered at all, because R-PATH-04 pairs
 * DIY mounting WITH an electrician doing the connection.
 *
 * `null` means UNKNOWN, which is neither permitted nor forbidden: an unknown
 * jurisdiction must not render as a green light.
 */
const LEGALITY_RULES = {
  us: [
    "allowed",
    "allowed",
    "Varies by state and by local authority; verify before you start",
  ],
  ca: [
    "allowed",
    "allowed",
    "Varies by province and by local authority; verify before you start",
  ],
  au: ["allowed", "allowed", "State and territory rules vary; verify locally"],
  nz: [
    "allowed",
    "allowed",
    "Electrical work requires a licensed practitioner",
  ],
  in: [
    "allowed",
    "restricted",
    "State rules vary; electrical work is licensed",
  ],
  za: ["allowed", "restricted", "Electrical work by a registered contractor"],
  gb: [
    "restricted",
    "restricted",
    "Building regulations place the work with a registered installer",
  ],
  ie: [
    "restricted",
    "restricted",
    "Building regulations place the work with a registered installer",
  ],
  de: [
    "restricted",
    "restricted",
    "Handwerk law: electrical work is a licensed trade",
  ],
  fr: ["restricted", "restricted", "Installation by a qualified installer"],
  es: ["restricted", "restricted", "Installation by a qualified installer"],
  pt: ["restricted", "restricted", "Installation by a qualified installer"],
  it: ["restricted", "restricted", "Installation by a qualified installer"],
  nl: ["restricted", "restricted", "Installation by a qualified installer"],
  jp: ["restricted", "restricted", "Electrical work by a licensed contractor"],
};

const UNKNOWN_SOURCE =
  "No verified rule for this jurisdiction; check with your local authority";

export function legalityFor(country) {
  const c = String(country || "")
    .trim()
    .toLowerCase();
  const rule = LEGALITY_RULES[c];
  return {
    country: c || null,
    diyMounting: rule ? rule[0] : null,
    electricalDiy: rule ? rule[1] : null,
    grade: "C",
    source: rule ? rule[2] : UNKNOWN_SOURCE,
  };
}

/** What each path's money includes and excludes. One owner, so no two cards differ. */
export const INCLUDED_BY_PATH = {
  turnkey: [
    "pathsIncludesInstalledAllIn",
    "pathsIncludesProviderSwaps",
    "pathsIncludesIncentivesIfEligible",
  ],
  lease: [
    "pathsIncludesNoYear0Hardware",
    "pathsIncludesProviderSwaps",
    "pathsIncludesIncentivesToProvider",
    "pathsIncludesEndOfTerm",
  ],
  selfpurchase: [
    "pathsIncludesHardwareYouBuy",
    "pathsIncludesElectricianInstalls",
    "pathsIncludesPermitsAndInterconnection",
    "pathsIncludesYouDoSwaps",
    "pathsIncludesIncentivesIfEligible",
  ],
  diy: [
    "pathsIncludesHardwareYouBuy",
    "pathsIncludesYouMountTheArray",
    "pathsIncludesElectricianConnects",
    "pathsIncludesPermitsAndInterconnection",
    "pathsIncludesToolsAndSafety",
    "pathsIncludesYouDoSwaps",
    "pathsIncludesIncentivesIfEligible",
  ],
};

/** The localized key for a path's refusal, or null when it is available. */
export function blockedReasonKey(blockedBy) {
  switch (blockedBy) {
    case "no-system":
      return "pathsNoSystem";
    case "no-tariff":
      return "pathsNoTariff";
    case "diy-not-permitted":
      return "pathsDiyNotPermitted";
    case "diy-restricted":
      return "pathsDiyRestricted";
    case "diy-unknown":
      return "pathsDiyUnknown";
    default:
      return "pathsUnavailable";
  }
}

/** Midpoint of a [low, mid, high] triple; a malformed entry reads 0. */
export function bandMid(triple) {
  if (!Array.isArray(triple)) return 0;
  const m = triple[1];
  return Number.isFinite(m) ? m : 0;
}

/** One end of a triple, floored so a malformed registry cannot go negative. */
export function bandEnd(triple, index) {
  if (!Array.isArray(triple)) return 0;
  const v = triple[index];
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

/** Delivered energy in each of the 20 years, degradation included. */
export function energyByYear(servedKwhPerYear, opts = {}) {
  const d1 = Number.isFinite(opts.firstYear)
    ? opts.firstYear
    : DEGRADATION.firstYear;
  const da = Number.isFinite(opts.annual) ? opts.annual : DEGRADATION.annual;
  const e1 = Math.max(0, servedKwhPerYear) * (1 - d1);
  return Array.from(
    { length: HORIZON_YEARS },
    (_, i) => e1 * Math.pow(1 - da, i),
  );
}

function addTo(years, index, amount) {
  if (index >= 0 && index < HORIZON_YEARS && amount) years[index] += amount;
}

/** What a lease or PPA costs in each of the 20 years, buyout included. */
export function leaseSchedule({
  installedUsd,
  annualServedKwh,
  tariff,
  instrument = "ppa",
}) {
  const terms = LEASE_TERMS[instrument] || LEASE_TERMS.ppa;
  const energy = energyByYear(annualServedKwh);
  const esc = bandMid(terms.escPct);
  const years = new Array(HORIZON_YEARS).fill(0);
  if (instrument === "lease") {
    const pmt0 = bandMid(terms.monthlyUsdPerKwh) * Math.max(0, annualServedKwh);
    for (let y = 0; y < HORIZON_YEARS; y++)
      years[y] = pmt0 * Math.pow(1 + esc, y);
  } else {
    const rate0 = Math.max(0, tariff) * (1 - bandMid(terms.discountPct));
    for (let y = 0; y < HORIZON_YEARS; y++)
      years[y] = rate0 * Math.pow(1 + esc, y) * energy[y];
  }
  const term = Math.round(bandMid(terms.termYears));
  const buyoutPct = terms.buyoutPct ? bandMid(terms.buyoutPct) : null;
  let endOfTerm;
  if (term > 0 && term < HORIZON_YEARS) {
    const buyout = Math.round(installedUsd * buyoutPct);
    // The buyout sits INSIDE the 20-year figure so a lease is compared like
    // with like against a path that ends up owning the system.
    addTo(years, Math.max(0, term - 1), buyout);
    endOfTerm = {
      instrument,
      termYears: term,
      buyoutUsd: buyout,
      buyoutPct,
      choice: "buyout-modelled",
      noteKey: "pathsEndOfTermBuyout",
    };
  } else {
    endOfTerm = {
      instrument,
      termYears: term,
      buyoutUsd: null,
      buyoutPct: null,
      choice: "still-leasing-at-horizon",
      noteKey: "pathsEndOfTermStillLeasing",
    };
  }
  return { years, endOfTerm, terms };
}

function incentiveValue(entries, year0) {
  let total = 0;
  for (const e of entries || []) {
    const cap = bandMid(e.capUsd);
    total += Math.min(
      year0 * bandMid(e.amountPctOfYear0),
      cap > 0 ? cap : Infinity,
    );
  }
  return Math.max(0, Math.round(total));
}

/** Price the four paths for ONE sized system. */
export function priceAllPaths(system, ctx = {}) {
  const region = ctx.region || regionForCountry(ctx.country);
  const registry = registryFor(region);
  const legality = legalityFor(ctx.country);
  const sys = normaliseSystem(system);
  const paths = PATH_IDS.map((id) =>
    priceOne(id, sys, ctx, region, registry, legality),
  );
  const by = Object.fromEntries(paths.map((p) => [p.id, p]));
  const order = paths
    .filter((p) => p.available)
    .sort((a, b) => a.spend20 - b.spend20 || a.year0 - b.year0)
    .map((p) => p.id);

  return {
    system: sys,
    region,
    registry,
    legality,
    country: ctx.country || null,
    instrument: ctx.instrument === "lease" ? "lease" : "ppa",
    paths,
    by,
    // R-PATH-07, defined against the SAME system.
    premiums: {
      installer:
        by.turnkey.available && by.selfpurchase.available
          ? by.turnkey.year0 - by.selfpurchase.year0
          : null,
      lease:
        by.lease.available && by.selfpurchase.available
          ? by.lease.spend20 - by.selfpurchase.spend20
          : null,
    },
    ranking: order,
    cheapest: order.length ? order[0] : null,
    rankingExplained: explainRanking(paths, order),
  };
}

function normaliseSystem(system) {
  const s = system || {};
  const num = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);
  return {
    pvKw: Math.max(0, num(s.pvKw)),
    battKwh: Math.max(0, num(s.battKwh)),
    annualServedKwh: Math.max(0, num(s.annualServedKwh)),
    replacements: Math.max(0, Math.floor(num(s.replacements))),
    batteryLifeYears: num(s.batteryLifeYears, null),
    annualBaselineBillsUsd: num(s.annualBaselineBillsUsd, null),
    annualResidualBillsUsd: num(s.annualResidualBillsUsd, null),
    billCutPct: num(s.billCutPct, null),
    tariff: num(s.tariff, null),
  };
}

/**
 * THE ADAPTER: one sized result entry + the visitor's own bill -> the system
 * the four paths are priced for.
 *
 * This is the seam where a payload field could quietly stop feeding the
 * comparison, so it is ONE owner and it is exported: the gate, the tests and
 * the UI all call this rather than re-deriving the mapping, which means a
 * renamed payload field fails in one place instead of silently pricing four
 * cards against a system that is not the one on screen.
 *
 * The baseline bill is the visitor's CURRENT annual bill \u2014 an input, not a
 * derived figure, so break-even is measured against what they actually pay
 * today. The residual bill is what the grid still charges them afterwards, and
 * it comes back off the entry as the post-solar monthly bill plus the export
 * credit the entry already netted out (a battery-only or matrix cell that
 * carries no monthly figure reports no residual rather than a guess).
 */
export function systemForPaths(entry, ctx = {}) {
  const e = entry || {};
  const num = (v) => (Number.isFinite(v) ? v : null);
  const residual =
    num(ctx.annualResidualBillsUsd) ??
    (num(e.billAfterMonthlyUsd) !== null
      ? e.billAfterMonthlyUsd * 12 + (num(e.exportValueAnnualUsd) || 0)
      : null);
  return {
    pvKw: Math.max(0, num(e.pvKw) || 0),
    battKwh: Math.max(0, num(e.battKwh) || 0),
    annualServedKwh: Math.max(0, num(e.servedKwhPerYear) || 0),
    replacements: Math.max(0, num(e.replacementsHorizon) || 0),
    batteryLifeYears: num(e.batteryLifeYears) ?? num(ctx.batteryLifeYears),
    annualBaselineBillsUsd: num(ctx.annualBaselineBillsUsd),
    annualResidualBillsUsd: residual,
    billCutPct: num(e.cutPct),
    tariff: num(e.tariff) ?? num(ctx.tariff),
  };
}

function newPath(id, registry) {
  return {
    id,
    available: false,
    blockedBy: null,
    // Per-year cash the owner actually pays, years 1-20. Break-even and
    // spend20 both read this array, so they cannot disagree.
    recurringByYear: new Array(HORIZON_YEARS).fill(0),
    year0: 0,
    year0Low: 0,
    year0High: 0,
    hardware: 0,
    labour: 0,
    fees: 0,
    tools: 0,
    omTotal: 0,
    replacementsTotal: 0,
    recurringTotal: 0,
    incentives: 0,
    incentiveEntries: [],
    incentiveNoteKey: null,
    spend20: 0,
    residualBills20: null,
    baselineBills20: null,
    net20: null,
    billCutPct: null,
    breakEvenYear: null,
    endOfTerm: null,
    ownershipKey: null,
    included: (INCLUDED_BY_PATH[id] || []).slice(),
    grade: registry.grade,
    source: registry.source,
    notes: [],
    horizonYears: HORIZON_YEARS,
    escalationPct: registry.escalationPct,
    escalationGraded: registry.escalationGraded,
  };
}

function priceOne(id, sys, ctx, region, registry, legality) {
  const p = newPath(id, registry);
  if (sys.pvKw <= 0 && sys.battKwh <= 0) {
    p.blockedBy = "no-system";
    return p;
  }
  const invKw = Math.max(sys.pvKw, 3);

  if (id === "turnkey") {
    const installed = (perW, perKwh, perKw) =>
      perW * sys.pvKw * 1000 + perKwh * sys.battKwh + perKw * invKw;
    p.hardware = Math.round(
      installed(
        bandMid(registry.tkPvPerW),
        bandMid(registry.tkBattPerKwh),
        bandMid(registry.tkInvPerKw),
      ),
    );
    p.year0 = p.hardware;
    // The benchmark already includes labour, permits and margin. Adding fees
    // on top would double-count them, which is how a "gap" stops being real.
    p.labour = 0;
    p.fees = 0;
    p.year0Low = Math.round(
      installed(
        bandEnd(registry.tkPvPerW, 0),
        bandEnd(registry.tkBattPerKwh, 0),
        bandEnd(registry.tkInvPerKw, 0),
      ),
    );
    p.year0High = Math.round(
      installed(
        bandEnd(registry.tkPvPerW, 2),
        bandEnd(registry.tkBattPerKwh, 2),
        bandEnd(registry.tkInvPerKw, 2),
      ),
    );
    addOwnerRecurring(p, sys, registry, p.year0);
    p.incentiveEntries = incentivesFor(region, id);
    p.incentives = incentiveValue(p.incentiveEntries, p.year0);
    p.ownershipKey = "pathsOwnershipTurnkey";
    p.notes.push("pathsNoteTurnkeyAllIn");
    return finish(p, sys);
  }

  if (id === "lease") {
    const instrument = ctx.instrument === "lease" ? "lease" : "ppa";
    const installed =
      bandMid(registry.tkPvPerW) * sys.pvKw * 1000 +
      bandMid(registry.tkBattPerKwh) * sys.battKwh +
      bandMid(registry.tkInvPerKw) * invKw;
    if (!(sys.tariff > 0) && instrument === "ppa") {
      // A PPA's price IS a rate against the utility rate; without a tariff
      // there is nothing to discount, so it says so instead of guessing.
      p.blockedBy = "no-tariff";
      return p;
    }
    const schedule = leaseSchedule({
      installedUsd: installed,
      annualServedKwh: sys.annualServedKwh,
      tariff: sys.tariff || 0,
      instrument,
    });
    p.year0 = Math.round(installed * bandMid(schedule.terms.downPaymentPct));
    p.year0Low = Math.round(
      installed * bandEnd(schedule.terms.downPaymentPct, 0),
    );
    p.year0High = Math.round(
      installed * bandEnd(schedule.terms.downPaymentPct, 2),
    );
    p.hardware = p.year0;
    p.recurringByYear = schedule.years;
    // The provider owns and maintains it: no O&M, no inverter swap, no bank
    // replacement on the visitor's account.
    p.omTotal = 0;
    p.replacementsTotal = 0;
    // So the incentives are theirs too. Counted as zero WITH the reason stated:
    // a lease showing no incentive and no reason is the defect R-PATH-05 exists
    // to prevent.
    p.incentives = 0;
    p.incentiveEntries = [];
    p.incentiveNoteKey = "pathsIncentivesToProvider";
    p.endOfTerm = schedule.endOfTerm;
    p.notes.push(schedule.endOfTerm.noteKey);
    p.ownershipKey =
      instrument === "ppa" ? "pathsOwnershipPpa" : "pathsOwnershipLease";
    p.grade = schedule.terms.grade;
    p.source = schedule.terms.source;
    return finish(p, sys);
  }

  // selfpurchase and diy differ in exactly one respect: which labour hours are
  // paid for, plus the tools allowance. Every other line is shared, which is
  // what makes their gap a real gap rather than a difference in counting.
  const hardware = (perW, perKwh, perKw) =>
    perW * sys.pvKw * 1000 + perKwh * sys.battKwh + perKw * invKw;
  const hwMid = hardware(
    bandMid(registry.hwPvPerW),
    bandMid(registry.hwBattPerKwh),
    bandMid(registry.hwInvPerKw),
  );
  const hwLow = hardware(
    bandEnd(registry.hwPvPerW, 0),
    bandEnd(registry.hwBattPerKwh, 0),
    bandEnd(registry.hwInvPerKw, 0),
  );
  const hwHigh = hardware(
    bandEnd(registry.hwPvPerW, 2),
    bandEnd(registry.hwBattPerKwh, 2),
    bandEnd(registry.hwInvPerKw, 2),
  );
  const hours =
    id === "diy"
      ? registry.connectBaseH + registry.connectPerKwhH * sys.battKwh
      : registry.elecBaseH +
        registry.elecPerKwH * sys.pvKw +
        registry.elecPerKwhH * sys.battKwh;
  const labourMid = hours * bandMid(registry.elecRate);
  const fees = (idx) =>
    bandEnd(registry.permit, idx) +
    bandEnd(registry.inspection, idx) +
    bandEnd(registry.interconnection, idx);
  const toolsMid = id === "diy" ? bandMid(registry.diyTools) : 0;
  const toolsHigh = id === "diy" ? bandEnd(registry.diyTools, 2) : 0;

  p.hardware = Math.round(hwMid);
  p.labour = Math.round(labourMid);
  p.fees = Math.round(fees(1));
  p.tools = Math.round(toolsMid);
  p.year0 = p.hardware + p.labour + p.fees + p.tools;
  p.year0Low = Math.round(
    hwLow + hours * bandEnd(registry.elecRate, 0) + fees(0),
  );
  p.year0High = Math.round(
    hwHigh + hours * bandEnd(registry.elecRate, 2) + fees(2) + toolsHigh,
  );
  addOwnerRecurring(p, sys, registry, p.year0);
  p.incentiveEntries = incentivesFor(region, id);
  p.incentives = incentiveValue(p.incentiveEntries, p.year0);
  p.ownershipKey = "pathsOwnershipSelf";

  if (id === "diy") {
    // D-10. `electricalDiy: "allowed"` is exactly the case where this path is
    // NOT offered: R-PATH-04 pairs DIY mounting WITH an electrician doing the
    // connection, so a jurisdiction where the owner may wire their own system
    // is not the jurisdiction this path describes.
    if (legality.electricalDiy === "allowed") p.blockedBy = "diy-not-permitted";
    else if (legality.diyMounting === "restricted")
      p.blockedBy = "diy-restricted";
    else if (legality.diyMounting !== "allowed") p.blockedBy = "diy-unknown";
    if (p.blockedBy) {
      p.notes.push(legality.source);
      return p;
    }
  }
  return finish(p, sys);
}

/**
 * O&M, inverter service life and the battery-bank schedule, for a path whose
 * owner ends up holding the system. The SAME schedule applies to turnkey,
 * self-purchase and DIY: hardware wears out on a clock, not on who paid for
 * it, and pricing it differently per path is the defect this file removes.
 */
function addOwnerRecurring(p, sys, registry, year0) {
  const om = bandMid(registry.omPct) * year0;
  const invCost = bandMid(registry.hwInvPerKw) * Math.max(sys.pvKw, 3);
  const invYear = Math.round(bandMid(registry.inverterYears));
  const bank =
    sys.battKwh *
    (bandMid(registry.hwBattPerKwh) + bandMid(BANK_LABOUR_PER_KWH));
  const swapYears = [];
  if (sys.replacements > 0 && sys.batteryLifeYears > 0) {
    const due = Math.round(sys.batteryLifeYears);
    for (let k = 1; k <= sys.replacements; k++) {
      const yr = k * due;
      if (yr > 0 && yr <= HORIZON_YEARS) swapYears.push(yr);
    }
  }
  for (let y = 1; y <= HORIZON_YEARS; y++) {
    let year = om;
    if (invYear > 0 && y === invYear) year += invCost;
    if (swapYears.includes(y)) year += bank;
    p.recurringByYear[y - 1] = year;
  }
  p.omTotal = Math.round(om * HORIZON_YEARS);
  p.replacementsTotal = Math.round(
    p.recurringByYear.reduce((a, v) => a + v, 0) - om * HORIZON_YEARS - invCost,
  );
}

/**
 * The shared tail: the definitions every path reports (R-PATH-07).
 *
 * 20-year system spend = year-0 - incentives + every recurring cost inside the
 * horizon, with grid bills EXCLUDED — they are a property of the system, not
 * of the payment route, and are reported separately as `residualBills20`.
 * 20-year net = baseline bills - residual bills - system spend.
 */
function finish(p, sys) {
  p.year0 = Math.round(p.year0);
  p.year0Low = Math.round(Math.max(0, p.year0Low));
  p.year0High = Math.round(Math.max(p.year0Low, p.year0High));
  p.recurringByYear = p.recurringByYear.map((v) => Math.round(v));
  p.recurringTotal = p.recurringByYear.reduce((a, v) => a + v, 0);
  p.spend20 = Math.round(p.year0 - p.incentives + p.recurringTotal);
  p.residualBills20 =
    sys.annualResidualBillsUsd === null
      ? null
      : Math.round(sys.annualResidualBillsUsd * HORIZON_YEARS);
  p.baselineBills20 =
    sys.annualBaselineBillsUsd === null
      ? null
      : Math.round(sys.annualBaselineBillsUsd * HORIZON_YEARS);
  p.net20 =
    p.baselineBills20 !== null && p.residualBills20 !== null
      ? p.baselineBills20 - p.residualBills20 - p.spend20
      : null;
  p.billCutPct = sys.billCutPct;
  p.breakEvenYear = breakEvenYear(p, sys);
  p.available = true;
  p.grade = p.incentiveEntries.length
    ? [...new Set(p.incentiveEntries.map((e) => e.grade))].join(",")
    : p.grade;
  return p;
}

/**
 * R-PATH-07 break-even: the first year in which cumulative (system spend +
 * residual bills) is at or below cumulative baseline bills. Null when it never
 * happens inside the horizon, which the card states as "not within 20 years"
 * rather than printing a year it does not have.
 */
export function breakEvenYear(p, sys) {
  if (!(sys.annualBaselineBillsUsd > 0)) return null;
  const residual = Math.max(0, sys.annualResidualBillsUsd || 0);
  // The year-0 bill is paid ONCE, in year 1. Adding it on every iteration
  // made every path look permanently unprofitable and reported "never".
  let cumSystem = p.year0 - p.incentives;
  for (let y = 0; y < HORIZON_YEARS; y++) {
    cumSystem += p.recurringByYear[y];
    if (cumSystem + residual * (y + 1) <= sys.annualBaselineBillsUsd * (y + 1))
      return y + 1;
  }
  return null;
}

/**
 * Why one path prices below the next.
 *
 * The components are ADDITIVE, not a story: since spend20 is
 * `year0 - incentives + recurring`, the per-component differences must
 * reconstruct the gap exactly. That identity is the check — an ordering
 * nobody can account for shows up as a decomposition that does not add up, and
 * fails rather than being dressed up in a plausible sentence.
 *
 * A gap driven by a COMBINATION (one component pulling each way) is a real
 * ordering, not a broken one, so it is reported as `dominance: "combined"`
 * rather than called unexplained.
 */
export function explainRanking(paths, order = null) {
  const sorted = order
    ? order.map((id) => paths.find((p) => p.id === id)).filter(Boolean)
    : paths
        .filter((p) => p.available)
        .slice()
        .sort((a, b) => a.spend20 - b.spend20);
  const leasePaymentsOf = (p) =>
    p.recurringTotal - p.replacementsTotal - p.omTotal;
  const out = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const gap = b.spend20 - a.spend20;
    const parts = {
      year0: b.year0 - a.year0,
      incentives: a.incentives - b.incentives,
      om: b.omTotal - a.omTotal,
      replacements: b.replacementsTotal - a.replacementsTotal,
      leasePayments: leasePaymentsOf(b) - leasePaymentsOf(a),
    };
    const sum = Object.values(parts).reduce((x, y) => x + y, 0);
    const entries = Object.entries(parts)
      .filter(([, v]) => v !== 0)
      .sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]));
    const [driver, driverAmount] = entries[0] || ["none", 0];
    const agreeing = entries.filter(([, v]) => Math.sign(v) === Math.sign(gap));
    const opposing = entries.filter(([, v]) => Math.sign(v) !== Math.sign(gap));
    out.push({
      cheaper: a.id,
      dearer: b.id,
      gap: Math.round(gap),
      driver,
      driverAmount: Math.round(driverAmount),
      components: Object.fromEntries(
        Object.entries(parts).map(([k, v]) => [k, Math.round(v)]),
      ),
      dominance:
        opposing.length === 0 ||
        agreeing.some(([, v]) => Math.abs(v) >= Math.abs(gap))
          ? "single-component"
          : "combined",
      // The reconstruction test; a tolerance of 1 absorbs float rounding only.
      explained: gap !== 0 && Math.abs(sum - gap) <= 1,
      residual: Math.round(sum - gap),
    });
  }
  return out;
}

/**
 * The four cards in the shape the renderer consumes, so the UI never
 * re-derives a number. Every value here came out of `priceAllPaths`.
 */
/**
 * Static label keys, ONE per path id.
 *
 * These were built as `pathsLabel_${p.id}` until the i18n gate refused them: a
 * key assembled at runtime cannot be read by any scanner, so nothing can check
 * that it exists in all six locales or that a translator ever saw it. An
 * explicit map also turns a typo'd id into a stated fallback instead of a
 * `pathsLabel_undefined` that renders as the literal key on the page.
 */
export const LABEL_KEYS = {
  turnkey: "pathsLabel_turnkey",
  lease: "pathsLabel_lease",
  selfpurchase: "pathsLabel_selfpurchase",
  diy: "pathsLabel_diy",
};

/**
 * The ranking explanation's component names, statically keyed for the same
 * reason as LABEL_KEYS.
 */
export const DRIVER_KEYS = {
  year0: "pathsDriver_year0",
  incentives: "pathsDriver_incentives",
  om: "pathsDriver_om",
  replacements: "pathsDriver_replacements",
  leasePayments: "pathsDriver_leasePayments",
  none: "pathsDriver_none",
};

export function describePaths(result, moneyFn, tFn = (k) => k) {
  if (!result || !Array.isArray(result.paths)) return [];
  const tr = (k, params) => tFn(k, params);
  return result.paths.map((p) => {
    const notes = (p.notes || []).map((n) =>
      n.startsWith("paths") ? tr(n) : n,
    );
    if (!p.available)
      return {
        id: p.id,
        available: false,
        labelKey: LABEL_KEYS[p.id] || "pathsUnavailable",
        reasonKey: blockedReasonKey(p.blockedBy),
        notes,
      };
    const incentivesText =
      p.incentiveNoteKey === "pathsIncentivesToProvider"
        ? tr("pathsIncentivesGoToProvider")
        : p.incentives > 0
          ? moneyFn(p.incentives)
          : tr(
              p.incentiveEntries.length
                ? "pathsNoIncentive"
                : "pathsNoVerifiedIncentive",
            );
    return {
      id: p.id,
      available: true,
      labelKey: LABEL_KEYS[p.id] || "pathsUnavailable",
      year0Text: moneyFn(p.year0),
      year0RangeText:
        p.year0Low === p.year0 && p.year0High === p.year0
          ? moneyFn(p.year0)
          : `${moneyFn(p.year0Low)}\u2013${moneyFn(p.year0High)}`,
      spend20Text: moneyFn(p.spend20),
      incentivesText,
      billCutText:
        p.billCutPct === null ? tr("pathsUnknown") : `${p.billCutPct}%`,
      breakEvenText:
        p.breakEvenYear === null
          ? tr("pathsNotWithinHorizon")
          : tr("pathsBreakEvenYear", { year: p.breakEvenYear }),
      netText: p.net20 === null ? tr("pathsUnknown") : moneyFn(p.net20),
      ownershipKey: p.ownershipKey,
      endOfTerm: p.endOfTerm,
      included: p.included,
      notes,
      grade: p.grade,
      source: p.source,
      escalationPct: p.escalationPct,
      escalationGraded: p.escalationGraded,
    };
  });
}

// NOTE 2026-10-05: the comparability audit (`comparisonIntegrity`) lives in
// scripts/lib/paths-integrity.mjs, not here. It is a BUILD assertion — the
// gate and the tests run it — so shipping it would put a self-check on the
// wire for a visitor who never triggers it. The numbers it audits are all
// still exported below.
