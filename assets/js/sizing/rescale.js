// Instant re-sizing when ONLY the load changes at the SAME location.
//
// The engine's search space (PV × battery × chemistry × bill target) is
// scale-invariant for a flat day profile: double the load and every sized
// system doubles (PV, battery, costs, bills, imports) while the RATIOS stay
// put — cut %, payback years, break-even year, cycles-per-year, levelized
// cost, SOC bands. So a cached payload can be re-expressed for a new bill in
// pure arithmetic (<1 ms) instead of a 5+ second engine search, and the
// weather is never re-fetched.
//
// Only the main thread uses this (the UI merges the rescale into the retained
// payload and then quietly refines with a full run in the background), but it
// lives here dependency-free so Node tests can prove it matches a fresh
// engine run.

const round2 = (v) => Math.round(v * 100) / 100;

/**
 * Single source of truth for the oversize scenario prose. The battery kWh
 * and dollar figures inside these strings scale with the load, so they are
 * built here — next to the rescaler that must regenerate them — instead of
 * baked once at sizing time. engine.js and run.js share this (never
 * hand-write these sentences elsewhere) so a note can never name a bank the
 * card doesn't show.
 */
export function oversizeCallout(
  scenario,
  { battKwh = null, savingsUsd = null, replacements = null } = {},
) {
  if (
    scenario === "oversized_cheaper" &&
    Number.isFinite(battKwh) &&
    Number.isFinite(savingsUsd)
  ) {
    return `This system uses an oversized battery (${battKwh} kWh) to avoid replacements, giving you the lowest 20-year cost — saving ~$${Math.round(savingsUsd).toLocaleString()} vs. smaller banks with swaps.`;
  }
  if (
    scenario === "swaps_cheaper" &&
    Number.isFinite(replacements) &&
    Number.isFinite(savingsUsd)
  ) {
    return `Best 20-year price: standard sizing with ${replacements} replacement(s) is ~$${Math.round(savingsUsd).toLocaleString()} cheaper over 20 years than paying upfront to oversize.`;
  }
  return null;
}

/** Rescale a cumulative cost series {grid, solar, system} by load factor k. */
export function scaleSeries(s, k) {
  if (!s || !Number.isFinite(k)) return s;
  const out = {
    years: s.years,
    grid: s.grid.map((v) => Math.round(v * k)),
    solar: s.solar.map((v) => Math.round(v * k)),
  };
  if (Array.isArray(s.system))
    out.system = s.system.map((v) => Math.round(v * k));
  return out;
}

// Money/flow fields that scale linearly with the load. Ratios (cutPct,
// paybackYears, trueBreakEvenYear, lcoeUsdPerKwh, cyclesPerYear,
// batteryLifeYears, battPerKwhLo/Hi unit RATES) and SOC bands (percentages,
// daily extremes) are scale-invariant and must NOT be touched.
const SCALE_FIELDS = [
  "pvKw",
  "battKwh",
  "battNameplateKwh",
  "costLo",
  "costHi",
  "pvCostLo",
  "pvCostHi",
  "battCostLo",
  "battCostHi",
  "billAfterMonthlyUsd",
  "exportValueAnnualUsd",
  "clippedKwhPerYear",
  "importedKwhPerYear",
  "swapsAndLaborUsd",
  "lifetimeCostMid",
  "servedKwhPerYear",
  "peakLoadW",
  // Oversize economics scale with the load like every other money figure —
  // and the scenario sentence is regenerated from them below, so the note's
  // kWh and $ can never freeze at the pre-rescale values.
  "oversizeSavingsUsd",
  "oversizedBattKwh",
];

/**
 * Rescale one money record (auto card, matrix cell, tier, target, curve-point
 * detail, focus system...) for a k× change in load. Returns a shallow-copied
 * record; the original payload is never mutated. Money rounds to whole
 * dollars and batteries to whole kWh — the engine's own quantization — so a
 * rescaled payload stays comparable with a fresh engine run.
 */
export function scaleRecord(o, k) {
  if (!o || !Number.isFinite(k)) return o;
  const n = { ...o };
  for (const f of SCALE_FIELDS) {
    if (typeof n[f] !== "number") continue;
    // Engine quantization: batteries whole kWh, PV/nameplate 2/1 decimals,
    // money and annual energy whole units.
    if (f === "battKwh" || f === "oversizedBattKwh")
      n[f] = Math.round(n[f] * k);
    else if (f === "pvKw") n[f] = Math.round(n[f] * k * 100) / 100;
    else if (f === "battNameplateKwh") n[f] = Math.round(n[f] * k * 10) / 10;
    else n[f] = Math.round(n[f] * k);
  }
  if (n.cumCostSeries) n.cumCostSeries = scaleSeries(n.cumCostSeries, k);
  // The scenario sentence embeds scaled numbers: regenerate it from the
  // scaled parts instead of letting it quote the old system. Only $-claiming
  // notes are touched — number-free variants ("beyond the sizes searched",
  // "naturally outlasts", hardware-specific fallbacks) are scale-invariant
  // by construction and stay byte-identical.
  if (
    n.oversizeScenario === "oversized_cheaper" &&
    Number.isFinite(n.oversizedBattKwh) &&
    Number.isFinite(n.oversizeSavingsUsd)
  ) {
    const regen = oversizeCallout("oversized_cheaper", {
      battKwh: n.oversizedBattKwh,
      savingsUsd: n.oversizeSavingsUsd,
    });
    if (regen) n.bestPriceCallout = regen;
  } else if (
    n.oversizeScenario === "swaps_cheaper" &&
    typeof n.bestPriceCallout === "string" &&
    n.bestPriceCallout.includes("~$") &&
    Number.isFinite(n.oversizeSavingsUsd) &&
    Number.isFinite(n.replacementsHorizon)
  ) {
    const regen = oversizeCallout("swaps_cheaper", {
      replacements: n.replacementsHorizon,
      savingsUsd: n.oversizeSavingsUsd,
    });
    if (regen) n.bestPriceCallout = regen;
  }
  return n;
}

function scaleFocus(o, k) {
  if (!o) return o;
  const n = {
    ...o,
    pvKw: Math.round(o.pvKw * k * 100) / 100,
    battKwh: Math.round(o.battKwh * k),
    battNameplateKwh: Math.round(o.battNameplateKwh * k * 100) / 100,
    peakLoadW: Math.round((o.peakLoadW || 0) * k),
  };
  // The frontier marker carries its own dollars — scale them with the curve
  // (previously the marker kept stale costs while every point doubled,
  // spuriously tripping the off-curve note and mis-anchoring the blue dot).
  if (typeof o.capexUsd === "number") n.capexUsd = Math.round(o.capexUsd * k);
  return n;
}

/**
 * Rescale a full runSizing payload for a k× change in daily load. Every money
 * number moves linearly; every ratio and percentage is preserved. Returns a
 * new payload; the input is untouched.
 */
export function rescalePayload(p, k) {
  if (
    !p ||
    !Number.isFinite(k) ||
    k <= 0 ||
    !Number.isFinite(p.annualGridSpendUsd)
  )
    return p;
  const out = { ...p };
  out.annualGridSpendUsd = Math.round(out.annualGridSpendUsd * k);
  if (Array.isArray(out.auto))
    out.auto = out.auto.map((e) => scaleRecord(e, k));
  out.best = scaleRecord(out.best, k);
  out.focus = scaleFocus(out.focus, k);
  out.focusSystem = scaleRecord(out.focusSystem, k);
  if (Array.isArray(out.tiers))
    out.tiers = out.tiers.map((t) => scaleRecord(t, k));
  if (Array.isArray(out.targets))
    out.targets = out.targets.map((t) => scaleRecord(t, k));
  out.customTarget = scaleRecord(out.customTarget, k);
  if (out.customCut) {
    out.customCut = {
      ...out.customCut, // fraction / achievedPct / surplus stay as-is
      entries: (out.customCut.entries || []).map((e) => scaleRecord(e, k)),
      best: scaleRecord(out.customCut.best, k),
    };
  }
  if (out.matrix && out.matrix.cells) {
    const cells = {};
    for (const [key, c] of Object.entries(out.matrix.cells))
      cells[key] = scaleRecord(c, k);
    out.matrix = { ...out.matrix, cells };
  }
  if (out.frontier) {
    const points = (out.frontier.points || []).map((pt) => {
      const np = {
        ...pt,
        pvKw: round2(pt.pvKw * k),
        battKwh: Math.round(pt.battKwh * k),
        capexUsd: Math.round(pt.capexUsd * k),
      };
      if (pt.detail) np.detail = scaleRecord(pt.detail, k);
      return np;
    });
    const reach = out.frontier.reach ? { ...out.frontier.reach } : null;
    if (reach) {
      for (const f of [
        "ceilingCostUsd",
        "entryCostUsd",
        "kneeCostUsd",
        "headCostPerPoint",
        "tailCostPerPoint",
      ]) {
        if (typeof reach[f] === "number") reach[f] = Math.round(reach[f] * k);
      }
      // The searched envelope is in kW/kWh — it describes the new load too.
      for (const f of ["pvMaxKw", "battMaxKwh"]) {
        if (typeof reach[f] === "number")
          reach[f] = Math.round(reach[f] * k * 100) / 100;
      }
    }
    out.frontier = {
      ...out.frontier,
      points,
      reach,
      marker: out.frontier.marker ? scaleFocus(out.frontier.marker, k) : null,
    };
  }
  return out;
}

/** Two payloads come from the same site/options (only the load differs)? */
export function sameSiteOptions(a, b) {
  if (!a || !b) return false;
  const lat = (v) => Math.abs(v - Math.round(v * 1000) / 1000) < 0.0006;
  if (!lat(a.latitude - b.latitude)) return false;
  if (!lat(a.longitude - b.longitude)) return false;
  // Hardware envelope and search-affecting options must match too: rescaling
  // a battery-only payload into a solar+battery one (or across derates)
  // would show hardware the envelope never searched.
  return (
    a.mode === b.mode &&
    a.chemistry === b.chemistry &&
    (a.hardwareConfig || "both") === (b.hardwareConfig || "both") &&
    JSON.stringify(a.derates || null) === JSON.stringify(b.derates || null) &&
    Number(a.tariff) === Number(b.tariff) &&
    Number(a.exportRate) === Number(b.exportRate)
  );
}
