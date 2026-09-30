// Pure decision logic for the budget slider's span and walkable pool, and the
// projection of the bill-cut slider's % onto the price-cut curve (plan §267:
// the two sliders are independent constraints that must never fight — F-20).
//
// The price-cut curve only reaches 100%, so the >100% "produce surplus and
// sell the extra" systems never appear as curve points; when a surplus target
// sized a system, that system becomes a virtual anchor — appended to the
// budget slider's span and walkable pool, and walkable by the projection.
// Pure functions, no DOM, no engine deps, so node:test can pin the contract
// directly.

/** The >100% system the cut slider sized, if any (null at <=100%). */
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
 * The budget slider's max: largest of the curve's span, the marker's cost
 * and the anchor's cost. NaN-safe; a degenerate pool falls back to the
 * anchor alone (or 0).
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

// ── Slider projection along the curve ─────────────────────────────────────
// A drag preview must describe the position the slider actually holds, so
// the slider's % is projected onto the curve: exact at a lattice point,
// linear between two, clamped at the ends, the surplus anchor extending the
// top. Blended figures stop at 2 decimals (engine precision — unrounded
// lerps print float noise) and the entry's cutPct is forced to the slider's
// %, so the card never claims a bill-cut the slider does not hold (the old
// nearest-lattice snap did exactly that).

/** Project the slider's % onto the frontier curve (see the note above). */
export function interpolateCurveTarget(points, pct, anchor = null) {
  const pts = (Array.isArray(points) ? points : [])
    .filter(
      (q) =>
        q &&
        Number.isFinite(q.outcomePct) &&
        Number.isFinite(q.capexUsd) &&
        Number.isFinite(q.pvKw) &&
        Number.isFinite(q.battKwh),
    )
    .sort((a, b) => a.outcomePct - b.outcomePct);
  const v = Number(pct);
  if (!pts.length || !Number.isFinite(v)) return null;
  const top = pts[pts.length - 1];
  if (
    anchor &&
    Number.isFinite(anchor.outcomePct) &&
    Number.isFinite(anchor.capexUsd) &&
    anchor.outcomePct > top.outcomePct
  )
    pts.push(anchor);
  for (let i = 0; i < pts.length; i++)
    if (pts[i].outcomePct === v) return project(pts, i, i, 0, v);
  if (v <= pts[0].outcomePct) return project(pts, 0, 0, 0, v);
  const last = pts.length - 1;
  if (v >= pts[last].outcomePct) return project(pts, last, last, 0, v);
  let hi = 1;
  while (pts[hi].outcomePct < v) hi++;
  return project(
    pts,
    hi - 1,
    hi,
    (v - pts[hi - 1].outcomePct) /
      (pts[hi].outcomePct - pts[hi - 1].outcomePct),
    v,
  );
}

function project(pts, loIdx, hiIdx, t, pct) {
  const lo = pts[loIdx];
  const hi = pts[hiIdx];
  const lerp = (a, b) =>
    Number.isFinite(a) && Number.isFinite(b) ? a + (b - a) * t : (b ?? a);
  // 2 decimals = the precision the engine itself reports.
  const r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : x);
  return {
    outcomePct: pct,
    capexUsd: r2(lerp(lo.capexUsd, hi.capexUsd)),
    pvKw: r2(lerp(lo.pvKw, hi.pvKw)),
    battKwh: r2(lerp(lo.battKwh, hi.battKwh)),
    entry: blendEntries(
      lo.detail,
      hi.detail,
      t,
      pct,
      lerp(lo.pvKw, hi.pvKw),
      lerp(lo.battKwh, hi.battKwh),
    ),
    exact: loIdx === hiIdx,
    loIndex: loIdx,
  };
}

// The preview card is an ENTRY card (the same rows a click adopts). For an
// exact point the real entry is returned untouched; between points the two
// bracketing entries are blended — every shared finite number moves
// linearly, everything else stays with the nearer entry. cutPct is forced to
// the slider's %: the card must never claim a bill-cut figure the slider
// does not hold (that contradiction was the defect).
function blendEntries(a, b, t, pct, pvKw, battKwh) {
  const base = t <= 0.5 ? a || b : b || a;
  if (!a || !b) {
    // No entry detail on one side (the surplus anchor): carry the pair's
    // interpolated size onto the nearer entry's numbers.
    const merged = { ...(base || {}) };
    merged.pvKw = +pvKw.toFixed(2);
    merged.battKwh = +battKwh.toFixed(2);
    merged.cutPct = Math.round(pct);
    return merged;
  }
  const out = { ...base };
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const va = a[k];
    const vb = b[k];
    if (
      typeof va === "number" &&
      typeof vb === "number" &&
      Number.isFinite(va) &&
      Number.isFinite(vb)
    )
      out[k] = +(va + (vb - va) * t).toFixed(2);
  }
  out.cutPct = Math.round(pct);
  return out;
}
