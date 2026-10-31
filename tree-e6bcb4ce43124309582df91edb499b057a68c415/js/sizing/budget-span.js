// Pure decision logic for the budget slider's span and walkable pool.
//
// The price-cut curve only reaches 100% (its outcome is the net-metered or
// import-only bill cut), so the systems the cut slider sizes ABOVE 100% —
// "produce surplus and sell the extra" — never appear as curve points. The
// budget slider derives its range from the curve's own points, which made the
// two sliders fight: at a 150% cut target the budget slider capped at the
// cheapest 100% system and the visitor had no budget headroom at all.
//
// The fix: when a surplus target actually sized a system, that system becomes
// a virtual anchor — appended to the budget slider's span and walkable pool.
// Pure functions, no DOM, no engine deps, so node:test can pin the contract
// directly.

/**
 * The >100% system the cut slider sized, if any.
 *
 * @param {object} p  the sizing payload (lastPayload shape)
 * @returns {{pvKw:number, battKwh:number, chemistry:string, chemLabel:string,
 *          capexUsd:number, outcomePct:number, kind:"custom"} | null}
 *   null when the target is ≤100%, nothing solved, or no usable cost figure.
 */
export function surplusAnchor(p) {
  const frac = p && p.customCut && p.customCut.fraction;
  if (!Number.isFinite(frac) || frac <= 1.0001) return null;
  const cand =
    (p.customCut && p.customCut.best) ||
    (p.customCut &&
      Array.isArray(p.customCut.entries) &&
      p.customCut.entries.find((e) => e && e.solvable)) ||
    (p.customTarget && p.customTarget.solvable ? p.customTarget : null);
  if (!cand || !cand.solvable) return null;
  const capex = Number.isFinite(cand.costMid)
    ? cand.costMid
    : Number.isFinite(cand.costLo) && Number.isFinite(cand.costHi)
      ? (cand.costLo + cand.costHi) / 2
      : null;
  if (!Number.isFinite(capex) || capex <= 0) return null;
  // The honest display % for a surplus target is the target itself: the raw
  // import fraction caps near 100, and run.js relabels solved >100% entries
  // to the target % — mirror that here instead of inventing a number.
  const outcomePct = Number.isFinite(cand.cutPct)
    ? Math.max(cand.cutPct, Math.round(frac * 100))
    : Math.round(frac * 100);
  return {
    kind: "custom",
    pvKw: cand.pvKw,
    battKwh: cand.battKwh,
    chemistry: cand.chemistry,
    chemLabel: cand.chemLabel || cand.chemistry,
    capexUsd: capex,
    outcomePct,
  };
}

/**
 * The budget slider's maximum: the largest of the curve's own capex span,
 * the marker's cost, and the surplus anchor's cost. NaN-safe: non-finite
 * candidates are ignored, and a degenerate pool falls back to the anchor
 * alone (or 0).
 *
 * @param {Array<{capexUsd:number}>} points  frontier points
 * @param {number|null} markerCost
 * @param {ReturnType<surplusAnchor>} anchor
 * @returns {number}
 */
export function budgetSpanMax(points, markerCost, anchor) {
  let hi = 0;
  if (Array.isArray(points)) {
    for (const pt of points)
      if (Number.isFinite(pt && pt.capexUsd) && pt.capexUsd > hi)
        hi = pt.capexUsd;
  }
  if (Number.isFinite(markerCost) && markerCost > hi) hi = markerCost;
  if (anchor && Number.isFinite(anchor.capexUsd) && anchor.capexUsd > hi)
    hi = anchor.capexUsd;
  return hi;
}
