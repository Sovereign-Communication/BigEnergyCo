// When is the lead-acid (AGM) reference a real comparison, and what may it say?
//
// This lives in its own module because the reference is rendered in three
// places (the focus-chip, the results footnote, and the comparison tab) and a
// live report showed them disagreeing:
//
//   "🏚️ lead-acid ~€1,926.36 less — but needs ~0 swaps · not recommended"
//
// for a design with NO battery on either side. With no bank in the design there
// is no chemistry to compare at all: the delta was a PV-sizing artifact wearing
// a lead-acid label, and "~0 swaps" implied lead-acid was free of its usual
// penalty. Two rules fall out of that:
//
//   1. A comparison is only drawn when both designs actually carry a battery
//      bank, and when the selection is not itself lead-acid (comparing
//      lead-acid with lead-acid compares nothing).
//   2. "No swaps" is never presented as a win. A lead-acid bank that outlasts
//      the horizon does so because it was oversized — the cost is the extra
//      nameplate, so the copy names that instead of implying a free lunch.
//
// Pure on purpose: every branch is unit-tested, and the UI owns formatting.

export const AGM_CHEM = "agm";

/**
 * @returns {null|{direction:"save"|"cheaper", deltaUsd:number, agmSwaps:number,
 *   bankFactor:number, agmBattKwh:number, entryBattKwh:number}}
 *   null when no honest comparison exists.
 */
export function leadAcidComparison(entry, agm) {
  if (!entry || !agm || agm.solvable !== true) return null;
  if (
    !Number.isFinite(entry.lifetimeCostMid) ||
    !Number.isFinite(agm.lifetimeCostMid)
  )
    return null;
  // Comparing lead-acid with lead-acid compares nothing.
  if (entry.chemistry === AGM_CHEM) return null;
  // Never subtract a figure modelled elsewhere (the comparison tab's nameplate
  // model) from a simulated one: the delta would be real arithmetic on two
  // different models, which is how "lead-acid ~€X less" ended up beside a
  // comparison card showing lead-acid an order of magnitude dearer.
  if (entry.estimatedFromTab === true || agm.estimatedFromTab === true)
    return null;
  // Bank-free designs share one PV-only system; a chemistry delta there is a
  // sizing artifact, not a chemistry result.
  if (!(entry.battKwh > 0) || !(agm.battKwh > 0)) return null;
  const agmSwaps = Number.isFinite(agm.replacementsHorizon)
    ? agm.replacementsHorizon
    : null;
  if (agmSwaps === null) return null;
  const deltaUsd = Math.round(agm.lifetimeCostMid - entry.lifetimeCostMid);
  if (deltaUsd === 0 && agmSwaps === 0) return null; // identical economics
  return {
    direction: deltaUsd > 0 ? "save" : "cheaper",
    deltaUsd: Math.abs(deltaUsd),
    agmSwaps,
    bankFactor: Math.max(
      1,
      Math.round((agm.battKwh / entry.battKwh) * 10) / 10,
    ),
    agmBattKwh: agm.battKwh,
    entryBattKwh: entry.battKwh,
  };
}

/**
 * Chip text for a comparison. `money` is the UI's formatter so the figure keeps
 * whatever currency/FX the payload was rescaled to.
 * @returns {null|{big:string, small:string}}
 */
export function leadAcidChipCopy(comparison, money) {
  if (!comparison) return null;
  const { direction, deltaUsd, agmSwaps, bankFactor } = comparison;
  if (direction === "save")
    return {
      big: `save ~${money(deltaUsd)}`,
      small:
        agmSwaps > 0
          ? `vs lead-acid · skips ~${agmSwaps} swaps`
          : `vs lead-acid · ${bankFactor}× the bank for the same usable kWh`,
    };
  return {
    big: `lead-acid ~${money(deltaUsd)} cheaper`,
    small:
      agmSwaps > 0
        ? `but needs ~${agmSwaps} swaps and acid upkeep · not recommended`
        : `but needs ${bankFactor}× the bank and the shortest life · not recommended`,
  };
}

/**
 * Footnote figures for the lead-acid reference line.
 * @returns {null|{lifetimeCostUsd:number, swaps:number, battKwh:number}}
 */
export function leadAcidReferenceCopy(agm) {
  if (!agm || agm.solvable !== true) return null;
  if (!Number.isFinite(agm.lifetimeCostMid)) return null;
  // A "lead-acid reference" with no bank is not a reference for anything.
  if (!(agm.battKwh > 0)) return null;
  return {
    lifetimeCostUsd: agm.lifetimeCostMid,
    swaps: Number.isFinite(agm.replacementsHorizon)
      ? agm.replacementsHorizon
      : 0,
    battKwh: agm.battKwh,
  };
}
