// The plausibility frontier: how far your money actually gets you.
//
// Every other view in this tool answers ONE question ("what does a 80% bill
// cut cost?"). This module answers the shape of the whole problem: for every
// amount you could spend, what is the most coverage any system can buy you?
//
// That curve is the honest answer to "is this plausible for me?". A site
// where it climbs steadily to 100% means off-grid is easy. A site where it
// flattens at 85% and never lifts means off-grid is not happening there, no
// matter the budget - and saying so plainly is the whole point of the tool.
//
// Method: sweep a coarse (PV, battery) lattice, simulate each system against
// the same hourly weather the headline cards use, then keep only the
// Pareto-optimal set - a system survives if nothing cheaper covers more.
// Pure functions: no DOM, no network, no globals.

import {
  simulate,
  simulateOffset,
  CHEMISTRIES,
  evaluateOversizeOptimization,
  billCutFraction,
} from "./engine.js?v=20260906f";
import { batteryReplacements, lifetimeCostUsd } from "./money.js?v=20260906f";

// Points below this coverage are real but not decision-useful; plotting them
// squashes the interesting part of the curve into the top corner.
export const FRONTIER_MIN_OUTCOME = 0.25;

// Two points one-third of a percentage point apart are the same answer to a
// human. Thinning keeps the chart readable without touching the math.
export const FRONTIER_MIN_STEP_PP = 1.0;
export const FRONTIER_MAX_POINTS = 22;

// Verdict thresholds. Ratio of marginal cost-per-point AFTER the knee to
// marginal cost-per-point BEFORE it.
export const TAIL_RATIO_TAPERING = 2;
export const TAIL_RATIO_STEEP = 6;

// Coverage a site must reach before "full independence" is honest.
export const CEILING_REACHED_PCT = 99;
export const CEILING_NEAR_PCT = 90;

/**
 * Did the best system found sit on the edge of the lattice? If so, the sweep
 * ran out of road before the physics did, and the top of the curve is a
 * statement about THIS SEARCH, not about the site.
 *
 * This distinction is load-bearing. A sweep capped at 30 kW / 100 kWh reports
 * an 88% "ceiling" for Oslo; widen it to 100 kW / 600 kWh and the same site
 * reports 97%; brute-force 300 kW / 1000 kWh and it covers 100% with zero
 * unmet hours. Every one of those "ceilings" was the corner of the box. Saying
 * "impossible at any price" on that evidence would be a false negative, which
 * is worse than a vague answer.
 */
export function isBoundLimited(front, pvLadderUsed, battLadderUsed) {
  if (!front.length) return false;
  const last = front[front.length - 1];
  const maxPv = pvLadderUsed[pvLadderUsed.length - 1];
  const maxBatt = battLadderUsed[battLadderUsed.length - 1];
  // Either axis pinned to its edge means we cannot claim to have found a limit.
  // Intentional 0-bound (e.g. battery-only or solar-only) is not a sweep bound limit.
  const pvPinned = maxPv > 0 && last.pvKw >= maxPv - 1e-9;
  const battPinned = maxBatt > 0 && last.battKwh >= maxBatt - 1e-9;
  return pvPinned || battPinned;
}

/**
 * Geometric PV ladder: fine where small systems live (where most of the
 * world's decisions get made), coarse out at the expensive end.
 */
export function pvLadder(pvMax, steps = 18) {
  const hi = Math.max(0.5, pvMax);
  const lo = Math.min(0.4, hi / 4);
  const out = [];
  for (let i = 0; i < steps; i++) {
    const v = lo * Math.pow(hi / lo, i / (steps - 1));
    const r = +(v < 2 ? v.toFixed(2) : v.toFixed(1));
    if (!out.includes(r)) out.push(r);
  }
  return out;
}

/**
 * Battery ladder in whole kWh - banks are bought in whole modules, and a
 * lattice of fractional kWh would imply precision the search does not have.
 * `includeZero` covers the solar-only case, which is often the cheapest
 * useful first step on a grid-connected site.
 */
export function battLadder(battMax, steps = 16, includeZero = false) {
  const hi = Math.max(2, Math.round(battMax));
  const out = includeZero ? [0] : [];
  for (let i = 0; i < steps; i++) {
    const v = 1 * Math.pow(hi / 1, i / (steps - 1));
    const r = Math.max(1, Math.round(v));
    if (!out.includes(r)) out.push(r);
  }
  return out;
}

/**
 * Simulate every lattice point once.
 * @returns {Array<{pvKw:number, battKwh:number, outcome:number, capexUsd:number, result:object}>}
 */
export function sweepSystems({
  e1kw,
  loadWh,
  tempsC = null,
  chemistry = "lfp",
  mode = "offgrid",
  capacityScale = null,
  costFn = null,
  costPerWpv = 0.35,
  costPerKwhBatt = 140,
  costPerKwInv = 60,
  pvMax = 30,
  battMax = 100,
  pvSteps = 18,
  battSteps = 16,
  tariff = null,
  exportRate = null,
}) {
  // Prices come from ONE place. When the caller injects the same pricing
  // function the result cards use, the curve's dollars and the cards'
  // dollars can never drift apart - which is the only way the chart is
  // allowed to earn trust. The linear fallback exists for unit tests.
  const price =
    costFn ||
    ((pv, b) => {
      const mid =
        pv * 1000 * costPerWpv + pv * costPerKwInv + b * costPerKwhBatt;
      return { mid, lo: mid, hi: mid };
    });
  let loadTotal = 0;
  for (let i = 0; i < loadWh.length; i++) loadTotal += loadWh[i];
  if (!(loadTotal > 0)) return [];

  const gridTie = mode === "gridtie";
  const pvs =
    pvMax <= 0
      ? [0]
      : gridTie
        ? [0, ...pvLadder(pvMax, pvSteps)]
        : pvLadder(pvMax, pvSteps);
  const bats = battMax <= 0 ? [0] : battLadder(battMax, battSteps, gridTie);
  const out = [];

  for (const pvKw of pvs) {
    for (const battKwh of bats) {
      // Must have at least solar or battery
      if (pvKw <= 0 && battKwh <= 0) continue;
      // Off-grid simulator requires battery and PV
      if (!gridTie && battKwh <= 0) continue;
      if (!gridTie && pvKw <= 0) continue;
      const result = gridTie
        ? simulateOffset({
            pvKw,
            battKwhUsable: battKwh,
            e1kw,
            loadWh,
            chemistry,
            tempsC,
            capacityScale,
          })
        : simulate({
            pvKw,
            battKwhUsable: battKwh,
            e1kw,
            loadWh,
            chemistry,
            tempsC,
            capacityScale,
          });
      // Battery-only systems never reduce TOTAL imports (charging losses add),
      // so in a mixed sweep they honestly score ≤ 0 in energy terms and the
      // outcome filter drops them off the curve. Only a pure-battery sweep
      // (pvMax <= 0, where the whole curve is about peak shifting) ranks by
      // the evening-peak offset fraction — mixing the two metrics on one axis
      // would let a 44% peak offset masquerade as a 44% bill cut.
      // With a feed-in credit the outcome is net-metered (billCutFraction):
      // clipped surplus credited at the feed-in rate, so 1:1 net metering
      // lets solar-only reach 100%. Without a credit this degrades exactly
      // to the import-only fraction.
      const pureBatterySweep = gridTie && !(pvMax > 0);
      const outcome = gridTie
        ? pureBatterySweep && pvKw <= 0 && battKwh > 0
          ? result.peakOffsetFraction
          : billCutFraction({
              importedWh: result.importedWh,
              curtailedWh: result.curtailedWh,
              loadTotalWh: loadTotal,
              tariff,
              exportRate,
            })
        : result.servedWh / loadTotal;
      const cost = price(pvKw, battKwh);
      out.push({
        pvKw,
        battKwh,
        outcome,
        result,
        pointType:
          pvKw === 0 ? "battery_only" : battKwh === 0 ? "solar_only" : "both",
        capexUsd: cost.mid,
        capexLoUsd: cost.lo ?? cost.mid,
        capexHiUsd: cost.hi ?? cost.mid,
      });
    }
  }
  return out;
}

/**
 * Pareto frontier by up-front cost: walking cheapest-first, keep a system
 * only if it covers strictly more than everything cheaper. Up-front cost is
 * the axis because it is the constraint people actually face - lifetime cost
 * rides along on each surviving point for the cards to use.
 */
export function paretoFront(points) {
  const sorted = [...points].sort(
    (a, b) => a.capexUsd - b.capexUsd || b.outcome - a.outcome,
  );
  const front = [];
  let bestOutcome = -Infinity;
  for (const p of sorted) {
    if (p.outcome > bestOutcome + 1e-9) {
      front.push(p);
      bestOutcome = p.outcome;
    }
  }
  return front;
}

/**
 * Drop points too close together to read, and points too far down the curve
 * to be a real option. Always keeps the first and last point.
 */
export function thinFront(
  front,
  {
    minOutcome = FRONTIER_MIN_OUTCOME,
    minStepPp = FRONTIER_MIN_STEP_PP,
    maxPoints = FRONTIER_MAX_POINTS,
  } = {},
) {
  const usable = front.filter((p) => p.outcome >= minOutcome);
  if (usable.length <= 2) return usable;

  let kept = [usable[0]];
  for (let i = 1; i < usable.length - 1; i++) {
    const prev = kept[kept.length - 1];
    if ((usable[i].outcome - prev.outcome) * 100 >= minStepPp)
      kept.push(usable[i]);
  }
  kept.push(usable[usable.length - 1]);

  // Still crowded: drop the points that add least, never the ends.
  while (kept.length > maxPoints) {
    let dropIdx = 1,
      dropGain = Infinity;
    for (let i = 1; i < kept.length - 1; i++) {
      const gain = kept[i].outcome - kept[i - 1].outcome;
      if (gain < dropGain) {
        dropGain = gain;
        dropIdx = i;
      }
    }
    kept.splice(dropIdx, 1);
  }
  return kept;
}

/**
 * The knee: the point of the curve furthest above the straight line from its
 * cheapest to its most capable end. That is where returns stop being
 * proportional to spend - the "good value stops here" marker.
 * @returns {number} index into `front`, or -1 when the curve is too short.
 */
export function findKnee(front) {
  if (front.length < 3) return -1;
  const x0 = front[0].capexUsd,
    y0 = front[0].outcome;
  const x1 = front[front.length - 1].capexUsd,
    y1 = front[front.length - 1].outcome;
  const dx = x1 - x0,
    dy = y1 - y0;
  if (!(dx > 0) || !(dy > 0)) return -1;

  let bestIdx = -1,
    bestDist = 0;
  for (let i = 1; i < front.length - 1; i++) {
    // Normalised so dollars and percentage points are comparable.
    const nx = (front[i].capexUsd - x0) / dx;
    const ny = (front[i].outcome - y0) / dy;
    const dist = ny - nx; // vertical gap above the chord in normalised space
    if (dist > bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/** Marginal cost of one more percentage point of coverage between two points. */
export function costPerPoint(a, b) {
  const pp = (b.outcome - a.outcome) * 100;
  if (!(pp > 0)) return null;
  return (b.capexUsd - a.capexUsd) / pp;
}

/**
 * Turn the curve's shape into a verdict id the UI can translate. Returns ids
 * and raw numbers only - never prose - so every locale can phrase it itself.
 *
 * ids: "already-covered" | "beyond-sweep" | "steep-tail" | "tapering" | "linear"
 *
 * "beyond-sweep" means the searched sizes did not get near full coverage.
 * It never means "impossible" - see isBoundLimited above.
 */
export function classifyReach(front, kneeIdx, envelope = {}) {
  const env = {
    pvMaxKw: envelope.pvMaxKw ?? null,
    battMaxKwh: envelope.battMaxKwh ?? null,
    boundLimited: !!envelope.boundLimited,
  };
  if (!front.length)
    return {
      id: "beyond-sweep",
      ceilingPct: 0,
      kneePct: null,
      kneeCostUsd: null,
      ceilingCostUsd: null,
      headCostPerPoint: null,
      tailCostPerPoint: null,
      tailRatio: null,
      ...env,
    };

  const last = front[front.length - 1];
  const first = front[0];
  const ceilingPct = +(last.outcome * 100).toFixed(1);

  // Independence is a ratio, not an amount. On a small enough load - a phone
  // and some lights - the smallest system anyone can actually buy already
  // covers everything, and there is no curve to draw because there is no
  // trade-off to make. That is the most useful answer this tool can give such
  // a visitor, so it is a verdict, not a reason to render nothing.
  if (first.outcome * 100 >= CEILING_REACHED_PCT) {
    return {
      ...env,
      id: "already-covered",
      ceilingPct,
      ceilingCostUsd: Math.round(last.capexUsd),
      entryPvKw: first.pvKw,
      entryBattKwh: first.battKwh,
      entryCostUsd: Math.round(first.capexUsd),
      kneePct: null,
      kneeCostUsd: null,
      headCostPerPoint: null,
      tailCostPerPoint: null,
      tailRatio: null,
    };
  }
  const base = {
    ceilingPct,
    ceilingCostUsd: Math.round(last.capexUsd),
    kneePct: null,
    kneeCostUsd: null,
    headCostPerPoint: null,
    tailCostPerPoint: null,
    tailRatio: null,
    ...env,
  };

  // Knee economics are reported whenever a knee exists - they are the most
  // useful thing on the chart even when the ceiling is out of reach, because
  // "value flattens here" is exactly what a Nordic visitor needs to see.
  const knee = kneeIdx >= 1 ? front[kneeIdx] : null;
  const head = knee ? costPerPoint(front[0], knee) : null;
  const tail = knee ? costPerPoint(knee, last) : null;
  const ratio = head && tail ? tail / head : null;
  const stats = {
    ...base,
    kneePct: knee ? +(knee.outcome * 100).toFixed(1) : null,
    kneeCostUsd: knee ? Math.round(knee.capexUsd) : null,
    headCostPerPoint: head === null ? null : Math.round(head),
    tailCostPerPoint: tail === null ? null : Math.round(tail),
    tailRatio: ratio === null ? null : +ratio.toFixed(1),
  };

  // Falling short of full coverage is the headline - but it is a statement
  // about the sizes searched, never about what is possible at any price.
  //
  // Any curve that ran out of lattice before reaching full coverage gets this
  // verdict, even a high one: at 92% the "steep tail" wording talks about the
  // last stretch to full independence, and this sweep never got there. Naming
  // the envelope is the only phrasing that cannot mislead.
  if (
    ceilingPct < CEILING_NEAR_PCT ||
    (env.boundLimited && ceilingPct < CEILING_REACHED_PCT)
  ) {
    return { ...stats, id: "beyond-sweep" };
  }

  let id = "linear";
  if (ratio !== null) {
    if (ratio >= TAIL_RATIO_STEEP) id = "steep-tail";
    else if (ratio >= TAIL_RATIO_TAPERING) id = "tapering";
  }
  return { ...stats, id };
}

/**
 * Fully-optimized dots (opt-in via buildFrontier's oversize bundle): for each
 * surviving curve point, check the oversize estimate; when a bigger bank is
 * lifetime-cheaper, verify zero-swap on a FRESH simulation (throughput shifts
 * with bank size) and adopt the verified bank INTO the point — the same
 * hardware, cost and outcome the detail, note and charts then describe. A
 * point that fails verification keeps its lattice hardware (its downstream
 * note describes swaps truthfully instead of advertising an unbuilt bank).
 *
 * Deliberately bank-only, no PV shrink: curve points carry no fixed target
 * to shrink against, and extra storage can only hold or improve the outcome.
 * Re-pareto afterwards keeps every dot on the line it draws.
 *
 * @returns {{front: Array, adopted: number}}
 */
export function adoptOversizedBanks(front, ctx) {
  const {
    e1kw,
    loadWh,
    tempsC = null,
    chemistry = "lfp",
    mode = "offgrid",
    years = 1,
    costPerWpv = 0.35,
    costPerKwhBatt = 140,
    costPerKwInv = 60,
    laborPerKwh = [12, 30],
    invMinKw = 0,
    battMax = 100,
    pvMax = 30,
    capacityScale = null,
    costFn = null,
  } = ctx;
  const chem = CHEMISTRIES[chemistry] || CHEMISTRIES.lfp;
  const linearCapex = (pv, b) =>
    pv * 1000 * costPerWpv +
    Math.max(pv, invMinKw) * costPerKwInv +
    b * costPerKwhBatt;
  const lifetimeOf = (pv, b, r) => {
    const cpy = r.cyclesEquivalent / years;
    const replacements = batteryReplacements(cpy, chem.cyclesTo80);
    return {
      replacements,
      total: lifetimeCostUsd({
        capexMidUsd: linearCapex(pv, b),
        battKwhUsable: b,
        battPriceMidPerKwh: costPerKwhBatt,
        replacements,
        laborPerKwh,
      }).total,
    };
  };
  const simulateAt = (pv, b) => {
    const args = {
      pvKw: pv,
      battKwhUsable: b,
      e1kw,
      loadWh,
      chemistry,
      tempsC,
      capacityScale,
    };
    return mode === "gridtie" ? simulateOffset(args) : simulate(args);
  };
  let loadTotal = 0;
  for (let i = 0; i < loadWh.length; i++) loadTotal += loadWh[i];
  const pureBatterySweep = mode === "gridtie" && !(pvMax > 0);
  const outcomeOf = (pv, b, r) => {
    if (mode !== "gridtie") return r.servedWh / loadTotal;
    if (pureBatterySweep && pv <= 0 && b > 0) return r.peakOffsetFraction;
    return billCutFraction({
      importedWh: r.importedWh,
      curtailedWh: r.curtailedWh,
      loadTotalWh: loadTotal,
      tariff: ctx.tariff ?? null,
      exportRate: ctx.exportRate ?? null,
    });
  };
  const priceOf = (pv, b) => {
    if (costFn) {
      const c = costFn(pv, b);
      return {
        capexUsd: c.mid,
        capexLoUsd: c.lo ?? c.mid,
        capexHiUsd: c.hi ?? c.mid,
      };
    }
    const mid = linearCapex(pv, b);
    return { capexUsd: mid, capexLoUsd: mid, capexHiUsd: mid };
  };
  let adopted = 0;
  for (const p of front) {
    if (!(p.battKwh > 0) || !p.result) continue;
    const opt = evaluateOversizeOptimization({
      pvKw: p.pvKw,
      battKwh: p.battKwh,
      sizingResult: p.result,
      chemistry,
      years,
      costPerWpv,
      costPerKwhBatt,
      costPerKwInv,
      laborPerKwh,
      invMinKw,
    });
    if (!opt.useOversized || !(opt.oversizedBattKwh > p.battKwh)) continue;
    const fromBattKwh = p.battKwh;
    const before = lifetimeOf(p.pvKw, p.battKwh, p.result);
    let b = opt.oversizedBattKwh;
    let winner = null;
    for (let guard = 0; guard < 6 && b <= battMax; guard++) {
      const r = simulateAt(p.pvKw, b);
      const cpy = r.cyclesEquivalent / years;
      if (batteryReplacements(cpy, chem.cyclesTo80) === 0) {
        const after = lifetimeOf(p.pvKw, b, r);
        if (after.total < before.total - 1e-9)
          winner = { b, r, savings: before.total - after.total };
        break;
      }
      b = Math.min(battMax + 1, Math.ceil(b * 1.25));
    }
    if (!winner) continue;
    const price = priceOf(p.pvKw, winner.b);
    p.battKwh = winner.b;
    p.result = winner.r;
    p.outcome = outcomeOf(p.pvKw, winner.b, winner.r);
    p.capexUsd = price.capexUsd;
    p.capexLoUsd = price.capexLoUsd;
    p.capexHiUsd = price.capexHiUsd;
    p.adopted = {
      fromBattKwh,
      savingsUsd: Math.round(winner.savings),
    };
    adopted++;
  }
  return { front, adopted };
}

/**
 * Full frontier for one chemistry at one site.
 *
 * @param {object} [opts.oversize] opt-in fully-optimized dots: when truthy,
 *   surviving points adopt verified zero-swap banks (see
 *   adoptOversizedBanks). Reads years/costPerWpv/costPerKwhBatt/costPerKwInv/
 *   laborPerKwh/invMinKw from opts (sweep defaults apply).
 *
 * @returns {{
 *   points: Array<{pvKw:number, battKwh:number, outcomePct:number, capexUsd:number, result:object, adopted?:{fromBattKwh:number, savingsUsd:number}}>,
 *   kneeIndex: number, reach: object, chemistry: string, mode: string,
 *   simCount: number, adoptedCount: number, lattice: {pv:number[], batt:number[]}
 * }}
 */
export function buildFrontier(opts) {
  const chemistry = opts.chemistry || "lfp";
  const mode = opts.mode === "gridtie" ? "gridtie" : "offgrid";
  const all = sweepSystems({ ...opts, chemistry, mode });
  const thinOpts = {
    minOutcome:
      opts.minOutcome !== undefined
        ? opts.minOutcome
        : (opts.pvMax ?? 30) <= 0
          ? 0.05
          : FRONTIER_MIN_OUTCOME,
    minStepPp: opts.minStepPp ?? FRONTIER_MIN_STEP_PP,
    maxPoints: opts.maxPoints ?? FRONTIER_MAX_POINTS,
  };
  let front = thinFront(paretoFront(all), thinOpts);
  // Fully-optimized dots: adopt verified zero-swap banks into the survivors,
  // then re-pareto/re-thin so every dot is still on the line it draws.
  let adoptedCount = 0;
  if (opts.oversize) {
    const res = adoptOversizedBanks(front, {
      e1kw: opts.e1kw,
      loadWh: opts.loadWh,
      tempsC: opts.tempsC,
      chemistry,
      mode,
      years: opts.years ?? 1,
      costPerWpv: opts.costPerWpv ?? 0.35,
      costPerKwhBatt: opts.costPerKwhBatt ?? 140,
      costPerKwInv: opts.costPerKwInv ?? 60,
      laborPerKwh: opts.laborPerKwh ?? [12, 30],
      invMinKw: opts.invMinKw ?? 0,
      battMax: opts.battMax ?? 100,
      pvMax: opts.pvMax ?? 30,
      capacityScale: opts.capacityScale ?? null,
      costFn: opts.costFn ?? null,
      tariff: opts.tariff ?? null,
      exportRate: opts.exportRate ?? null,
    });
    front = thinFront(paretoFront(res.front), thinOpts);
    adoptedCount = res.adopted;
  }
  const kneeIndex = findKnee(front);
  // Identical ladders to the sweep itself (grid-tie prepends the 0 kW
  // solar-only point) — the bound check must judge the lattice that ran.
  const pvUsed =
    (opts.pvMax ?? 30) <= 0
      ? [0]
      : mode === "gridtie"
        ? [0, ...pvLadder(opts.pvMax ?? 30, opts.pvSteps ?? 18)]
        : pvLadder(opts.pvMax ?? 30, opts.pvSteps ?? 18);
  const battUsed =
    (opts.battMax ?? 100) <= 0
      ? [0]
      : battLadder(
          opts.battMax ?? 100,
          opts.battSteps ?? 16,
          mode === "gridtie",
        );
  const boundLimited = isBoundLimited(front, pvUsed, battUsed);
  return {
    chemistry,
    chemLabel: (CHEMISTRIES[chemistry] || CHEMISTRIES.lfp).label,
    mode,
    points: front.map((p) => ({
      pvKw: p.pvKw,
      battKwh: p.battKwh,
      outcomePct: +(p.outcome * 100).toFixed(1),
      capexUsd: Math.round(p.capexUsd),
      capexLoUsd: Math.round(p.capexLoUsd),
      capexHiUsd: Math.round(p.capexHiUsd),
      result: p.result,
      ...(p.adopted ? { adopted: p.adopted } : null),
    })),
    kneeIndex,
    reach: classifyReach(front, kneeIndex, {
      pvMaxKw: pvUsed[pvUsed.length - 1],
      battMaxKwh: battUsed[battUsed.length - 1],
      boundLimited,
    }),
    boundLimited,
    simCount: all.length,
    adoptedCount,
    lattice: { pv: pvUsed, batt: battUsed },
  };
}
