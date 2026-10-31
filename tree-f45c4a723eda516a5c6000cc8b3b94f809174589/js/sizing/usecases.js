// The six use cases, in one place, with one owner each.
//
// Why this file exists. D-16 names six use cases (bill cut, time-of-use
// battery-only, essential-load backup, an emergency reserve held inside the
// battery, full off-grid, portable/mobile) and demands they live in ONE
// unified flow. Before this module the flow offered two of them through a
// `systemGoal` select, offered a third as a hardware option, and mentioned a
// fourth only in copy about a generator — so "keep the essentials running"
// and "portable power" were sentences, not offers.
//
// Three rules this file exists to enforce, each one a way the six used to
// blur into each other:
//
//   1. ONE OWNER. Every use case's inputs, outcome metric and verdict are
//      declared here. Nothing else in the app may define what a use case
//      means; the UI renders this, the engine is driven by this, and the
//      gate reads this. Two call sites cannot disagree because there is one.
//
//   2. ITS OWN METRIC. Each entry names a distinct `metric.id`. A use case
//      that borrowed another one's number would be a caption, not an offer:
//      "backup" reporting a bill cut is backup-by-proxy, and a reader has no
//      way to tell the difference. Distinct ids are checked by
//      scripts/check-usecases.mjs.
//
//   3. AN HONEST VERDICT. Every case can answer "no". `verdict()` returns
//      "not-here" with a reason naming the number that failed, never a
//      softened "works". The thresholds are not aspirations — they are
//      derived from the target the visitor set or from the physics.
//
// The legacy `mode` × `hardwareConfig` pair (three overlapping vocabularies,
// finding F-17) is DERIVED here and never shown: `deriveLegacy()` is the only
// place a use case becomes the old enum pair.

/** @typedef {"billcut"|"tou"|"backup"|"reserve"|"offgrid"|"portable"} UseCaseId */

/** Canonical order. D-16 lists bill-cut first; that order is the UI order. */
export const USE_CASE_IDS = [
  "billcut",
  "tou",
  "backup",
  "reserve",
  "offgrid",
  "portable",
];

export const DEFAULT_RESERVE_PCT = 0.2;

/**
 * R-UC-02 fallback. The registry carries no time-of-use schedule for any
 * country, so the time-of-use case cannot invent one. It uses this split as a
 * DOCUMENTED DEFAULT, prefilled into the visitor's own editable fields, and
 * the card says which numbers it assumed. The 16-21 window is the same
 * documented default the engine already used.
 */
export const DEFAULT_TOU = {
  peakHourStart: 16,
  peakHourEnd: 21,
  // Multiples of the visitor's own flat rate, not currency amounts: a
  // multiplier survives the display-currency conversion that a literal rate
  // would not.
  peakMultiplier: 1.6,
  offPeakMultiplier: 0.55,
};

/**
 * What the visitor is asked, per use case. `control` is the id of the form
 * field the flow must render for this case; `engine` entries are derived
 * (the weather year, the tariff) and are asked of the location card in
 * Step 2 rather than of the visitor.
 *
 * The gate fails when a declared control does not exist in index.html, which
 * is what stops a use case from quietly degrading to "named in copy".
 */
const INPUTS = {
  billcut: [
    { control: "billSlider", kind: "visitor" },
    { control: "loadMode", kind: "visitor" },
    { control: "cutSlider", kind: "visitor" },
  ],
  tou: [
    { control: "touPeakRate", kind: "visitor" },
    { control: "touOffPeakRate", kind: "visitor" },
    { control: "dailyKwhInput", kind: "visitor" },
  ],
  backup: [
    { control: "essentialLoadList", kind: "visitor" },
    { control: "outageTargetHours", kind: "visitor" },
    { control: "backupSolarRecharge", kind: "visitor" },
  ],
  reserve: [{ control: "reserveSlider", kind: "visitor" }],
  offgrid: [
    { control: "dailyKwhInput", kind: "visitor" },
    { control: "generatorAllowed", kind: "visitor" },
  ],
  portable: [
    { control: "portableDeviceList", kind: "visitor" },
    { control: "portableBankKwh", kind: "visitor" },
    { control: "portableShorePower", kind: "visitor" },
  ],
};

/**
 * The six cases.
 *
 * `metric.id` is the identity a reviewer checks; `metric.labelKey` is what a
 * visitor reads next to the number. `verdict` takes the SAME measurement
 * object `metric` reads, so a verdict can never quote a number the headline
 * does not show.
 */
export const USE_CASES = {
  // ── 1. Bill cut (primary) ────────────────────────────────────────────────
  billcut: {
    id: "billcut",
    labelKey: "useCaseBillCut",
    blurbKey: "useCaseBillCutBlurb",
    metric: {
      id: "bill_cut_pct",
      unit: "percent",
      labelKey: "metricBillCut",
      higherIsBetter: true,
    },
    legacy: { mode: "gridtie", hardwareConfig: "both", locksHardware: false },
    loads: "household",
    accepts: { reservePct: true, backupEssentials: true },
    metricOf: (m) => m.billCutPct,
    verdict: (m) => {
      const v = m.billCutPct;
      if (!Number.isFinite(v) || v <= 0)
        return {
          status: "not-here",
          reasonKey: "verdictBillCut",
        };
      const target = Number.isFinite(m.targetBillCutPct)
        ? m.targetBillCutPct
        : 0;
      if (target > 0 && v >= target)
        return { status: "works", reasonKey: "verdictBillCut" };
      if (v >= 0.5) return { status: "partial", reasonKey: "verdictBillCut" };
      return { status: "not-here", reasonKey: "verdictBillCut" };
    },
  },

  // ── 2. Time-of-use, battery only ─────────────────────────────────────────
  tou: {
    id: "tou",
    labelKey: "useCaseTou",
    blurbKey: "useCaseTouBlurb",
    metric: {
      id: "tou_peak_offset_pct",
      unit: "percent",
      labelKey: "metricTouOffset",
      higherIsBetter: true,
    },
    // A ToU battery has no panels by definition; the old hardwareConfig
    // option offered it, but as a hardware setting rather than a use case.
    legacy: { mode: "gridtie", hardwareConfig: "battery", locksHardware: true },
    loads: "household",
    accepts: { reservePct: true, backupEssentials: false },
    metricOf: (m) => m.touPeakOffsetPct,
    verdict: (m) => {
      // The plan's own honest verdict: when the peak/off-peak spread cannot
      // pay for the kWh you would store, a battery alone does not pay back.
      if (
        !Number.isFinite(m.touSavingUsd20y) ||
        !Number.isFinite(m.touBatteryCostUsd20y)
      )
        return { status: "not-here", reasonKey: "verdictTou" };
      if (m.touSavingUsd20y <= 0)
        return { status: "not-here", reasonKey: "verdictTou" };
      if (m.touSavingUsd20y < m.touBatteryCostUsd20y)
        return { status: "not-here", reasonKey: "verdictTou" };
      if (m.touPeakOffsetPct < 0.1)
        return { status: "partial", reasonKey: "verdictTou" };
      return { status: "works", reasonKey: "verdictTou" };
    },
  },

  // ── 3. Essential-load backup ─────────────────────────────────────────────
  backup: {
    id: "backup",
    labelKey: "useCaseBackup",
    blurbKey: "useCaseBackupBlurb",
    metric: {
      id: "outage_coverage_pct",
      unit: "percent",
      labelKey: "metricOutageCoverage",
      higherIsBetter: true,
    },
    // Backup is sized on the ESSENTIALS, not on the whole home: asking the
    // bill-cut search for an 80% cut and then pointing an outage simulator at
    // its answer measures a bank that was never sized to keep anything
    // running (a 80%-cut grid-tie pick can legitimately carry no battery at
    // all, which is how the first version of this measured a 0 kWh bank and
    // threw). The essentials profile at a zero-unmet-hours budget IS "keep
    // the essentials running", and the whole-home bill cut is the bill-cut
    // case's job — the two never share a number.
    legacy: { mode: "offgrid", hardwareConfig: "both", locksHardware: true },
    loads: "essentials",
    sizingTier: "tier100",
    accepts: { reservePct: true, backupEssentials: false },
    metricOf: (m) => m.outageCoveragePct,
    verdict: (m) => {
      const cov = m.outageCoveragePct;
      if (!Number.isFinite(cov) || cov <= 0)
        return { status: "not-here", reasonKey: "verdictBackup" };
      if (cov >= 90) return { status: "works", reasonKey: "verdictBackup" };
      if (cov >= 50) return { status: "partial", reasonKey: "verdictBackup" };
      return { status: "not-here", reasonKey: "verdictBackup" };
    },
  },

  // ── 4. Emergency reserve held inside the battery ─────────────────────────
  // A modifier on the battery cases rather than a seventh sizing question,
  // but D-16 names it, so it carries its OWN outcome: what the reserve costs
  // in savings, and what it buys in outage hours. That trade-off is the
  // metric — it is not the parent's bill cut restated.
  reserve: {
    id: "reserve",
    labelKey: "useCaseReserve",
    blurbKey: "useCaseReserveBlurb",
    metric: {
      id: "reserve_tradeoff",
      unit: "tradeoff",
      labelKey: "metricReserveTradeoff",
      higherIsBetter: true,
    },
    // The reserve rides on whatever the visitor chose; the parent is whatever
    // sizing case the flow is running, and it is named, never assumed.
    legacy: { mode: "gridtie", hardwareConfig: "both", locksHardware: false },
    loads: "household",
    accepts: { reservePct: true, backupEssentials: true },
    parentOf: ["billcut", "tou", "backup"],
    metricOf: (m) => ({
      savingsLostPct: m.reserveSavingsLostPct,
      coverHours: m.reserveCoverHours,
    }),
    verdict: (m) => {
      // The reserve lives INSIDE a battery. When the cheapest system for
      // this goal carries no bank at all there is nothing to hold a reserve
      // in, and reporting a 0% saving loss would read as "the reserve is
      // free" — the exact dishonesty this facet is about.
      if (!(m.battKwh > 0))
        return { status: "not-here", reasonKey: "verdictReserveNoBattery" };
      if (!Number.isFinite(m.reserveSavingsLostPct))
        return { status: "not-here", reasonKey: "verdictReserve" };
      // Half your bill savings is the line: past it the reserve has stopped
      // being insurance and started being the price of the system.
      if (m.reserveSavingsLostPct > 0.5)
        return { status: "not-here", reasonKey: "verdictReserve" };
      if (!Number.isFinite(m.reserveCoverHours) || m.reserveCoverHours <= 0)
        return { status: "partial", reasonKey: "verdictReserve" };
      if (m.reserveSavingsLostPct > 0.2)
        return { status: "partial", reasonKey: "verdictReserve" };
      return { status: "works", reasonKey: "verdictReserve" };
    },
  },

  // ── 5. Full off-grid independence ───────────────────────────────────────
  offgrid: {
    id: "offgrid",
    labelKey: "useCaseOffGrid",
    blurbKey: "useCaseOffGridBlurb",
    metric: {
      id: "grid_independence_pct",
      unit: "percent",
      labelKey: "metricGridIndependence",
      higherIsBetter: true,
    },
    legacy: { mode: "offgrid", hardwareConfig: "both", locksHardware: true },
    loads: "household",
    accepts: { reservePct: true, backupEssentials: false },
    metricOf: (m) => m.gridIndependencePct,
    verdict: (m) => {
      const v = m.gridIndependencePct;
      if (!Number.isFinite(v) || v <= 0)
        return { status: "not-here", reasonKey: "verdictOffGrid" };
      if (v >= 99.9) return { status: "works", reasonKey: "verdictOffGrid" };
      if (v >= 95) return { status: "partial", reasonKey: "verdictOffGrid" };
      return { status: "not-here", reasonKey: "verdictOffGrid" };
    },
  },

  // ── 6. Portable / mobile power ───────────────────────────────────────────
  portable: {
    id: "portable",
    labelKey: "useCasePortable",
    blurbKey: "useCasePortableBlurb",
    metric: {
      id: "portable_runtime_coverage_pct",
      unit: "percent",
      labelKey: "metricPortableRuntime",
      higherIsBetter: true,
    },
    // No roof, no grid, no tariff (R-UC-06): portable is sized from a device
    // profile, so it has no legacy enum pair at all. Saying so here is what
    // stops a caller from forcing it through `mode`.
    legacy: { mode: "portable", hardwareConfig: null, locksHardware: true },
    loads: "devices",
    accepts: { reservePct: false, backupEssentials: false },
    metricOf: (m) => m.portableCoveragePct,
    verdict: (m) => {
      const v = m.portableCoveragePct;
      if (!Number.isFinite(v) || v <= 0)
        return { status: "not-here", reasonKey: "verdictPortable" };
      if (v >= 90) return { status: "works", reasonKey: "verdictPortable" };
      if (v >= 50) return { status: "partial", reasonKey: "verdictPortable" };
      return { status: "not-here", reasonKey: "verdictPortable" };
    },
  },
};

export const USE_CASE_LIST = USE_CASE_IDS.map((id) => USE_CASES[id]);

export function isUseCaseId(id) {
  return Object.prototype.hasOwnProperty.call(USE_CASES, id);
}

export function useCase(id) {
  return isUseCaseId(id) ? USE_CASES[id] : null;
}

/** Every use case's outcome metric id. Used by the gate to prove uniqueness. */
export function metricIds() {
  return USE_CASE_LIST.map((c) => c.metric.id);
}

/** The form fields this use case must present. */
export function inputsFor(id) {
  const c = useCase(id);
  return c ? INPUTS[c.id] : [];
}

/** Every control id any use case declares (for the "control must exist" check). */
export function declaredControls() {
  return [
    ...new Set(USE_CASE_IDS.flatMap((id) => INPUTS[id].map((i) => i.control))),
  ];
}

/**
 * Which load profile a use case is sized on. A backup system answers to the
 * essentials, a portable one to the devices, the rest to the household. It is
 * declared here rather than in run.js so the sizing rule is part of the use
 * case's definition and cannot drift per call site.
 */
export function loadsFor(id) {
  const c = useCase(id);
  return c ? c.loads : "household";
}

/** The reliability tier a use case's sizing must satisfy, or null. */
export function sizingTierFor(id) {
  const c = useCase(id);
  return (c && c.sizingTier) || null;
}

/**
 * The one derivation from a use case to the legacy engine enum pair.
 * Unknown ids fall back to bill-cut, the primary use case, because a bad
 * value must never land on a case that would quietly report the wrong metric.
 */
export function deriveLegacy(id) {
  const c = useCase(id) || USE_CASES.billcut;
  return { mode: c.legacy.mode, hardwareConfig: c.legacy.hardwareConfig };
}

/**
 * The reverse direction, for the share link and for anything restoring saved
 * state: given the legacy pair, which use case was meant? Backup and reserve
 * are not recoverable from the pair alone (they share the pair with
 * bill-cut), so the pair resolves to the case that owns it and the caller
 * carries the explicit id in the link.
 */
export function useCaseForLegacy({ mode, hardwareConfig }) {
  if (mode === "offgrid") return "offgrid";
  if (hardwareConfig === "battery") return "tou";
  return "billcut";
}

/** Normalise an incoming reserve share: null/NaN/absurd input means "off". */
export function normaliseReservePct(pct) {
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return Math.min(0.9, pct);
}

/** Normalise the outage target the visitor asked about, in hours. */
export function normaliseOutageTarget(hours) {
  if (!Number.isFinite(hours) || hours <= 0) return 6;
  return Math.min(168, Math.max(1, Math.round(hours)));
}

/**
 * Build the outcome object the payload carries and the UI renders.
 *
 * `measurement` is what run.js measured with the real engine; this function
 * does no physics of its own — it only reads the case's metric and asks the
 * case's own verdict. Keeping it pure is what lets a test prove that a use
 * case can say "no".
 *
 * Returns null for an unknown id rather than a plausible-looking object: a
 * caller that passes a bad use case gets nothing to render, which is safer
 * than the wrong metric.
 */
export function outcomeFor(id, measurement) {
  const c = useCase(id);
  if (!c || !measurement) return null;
  const value = c.metricOf(measurement);
  const v = c.verdict(measurement);
  // A structurally infeasible run has no system to measure. Reporting a
  // verdict there would mean printing numbers the engine never produced, so
  // the card says so instead — one short sentence, shared by every case,
  // because "this cannot be sized at all" is the same fact for all of them.
  const measured = measurement.measured !== false;
  return {
    useCase: c.id,
    metricId: c.metric.id,
    unit: c.metric.unit,
    labelKey: c.metric.labelKey,
    value,
    measured,
    status: v.status,
    reasonKey: measured ? v.reasonKey : "useCaseNotMeasured",
    measurement,
  };
}

/** Every verdict key the six cases can emit — the gate proves each is translated. */
export function verdictKeys() {
  return [
    ...new Set(
      USE_CASE_LIST.flatMap((c) => [
        c.verdict({
          billCutPct: 1,
          touPeakOffsetPct: 1,
          touSavingUsd20y: 2,
          touBatteryCostUsd20y: 1,
          outageCoveragePct: 99,
          reserveSavingsLostPct: 0.1,
          reserveCoverHours: 4,
          gridIndependencePct: 99.9,
          portableCoveragePct: 99,
        }).reasonKey,
        c.verdict({
          billCutPct: 0,
          touPeakOffsetPct: 0,
          touSavingUsd20y: 0,
          touBatteryCostUsd20y: 1,
          outageCoveragePct: 0,
          reserveSavingsLostPct: 0.9,
          reserveCoverHours: 0,
          gridIndependencePct: 0,
          portableCoveragePct: 0,
        }).reasonKey,
      ]),
    ),
  ];
}
